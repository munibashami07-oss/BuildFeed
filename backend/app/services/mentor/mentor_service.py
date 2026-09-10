"""
Mentor Service — Module 14: AI Project Mentor

Sends a project-context-aware conversation to the GEMINI Chat Completions API.

Design decisions
────────────────
• Reuses the same httpx + settings pattern as focus_gate_service.
• No DB persistence — conversation history is managed client-side and sent with
  each request so the backend is stateless per call.
• The system prompt is built from the live Project object so the mentor always
  has current step/completion state.
• When no API key is configured a helpful fallback message is returned so the
  UI never crashes in development without credentials.
• max_tokens is configurable via settings to keep costs predictable.
"""

import json
import logging
from typing import Any, Dict, List
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.project import Project
from app.services.project.project_service import project_service

logger = logging.getLogger(__name__)

# ── System prompt template ────────────────────────────────────────────────────
_MENTOR_SYSTEM_TEMPLATE = """You are the BuildFeed AI Project Mentor — a knowledgeable, direct, and encouraging software engineering mentor embedded inside a builder's project workspace.

Your role is to GUIDE the user through completing their project, not to write all the code for them. Provide hints, explain concepts, suggest approaches, and help them think through problems. Keep responses concise and practical (2–4 paragraphs maximum unless a longer explanation is genuinely needed).

## Current Project Context

**Project:** {title}
**Difficulty:** {difficulty}
**Objective:** {objective}
**Tech Stack:** {tech_stack}

**All Milestones ({total_steps} total):**
{all_steps_list}

**Completed Milestones ({completed_count}/{total_steps}):**
{completed_steps_list}

**Remaining Milestones:**
{remaining_steps_list}

**Current Progress:** {progress_percent}%

## Mentor Guidelines
- Always ground your answers in the specific project context above.
- When asked about a step, refer to it by its title from the milestone list.
- If the user is stuck, ask one clarifying question before jumping to solutions.
- Never provide complete production-ready implementations unless they explicitly ask for a full code snippet — guide them to the answer first.
- Be professional and direct. Avoid filler phrases like "Great question!" or "Certainly!".
- If you reference external documentation or concepts, name the relevant docs/RFC/spec so the user can look them up.
"""


def _build_system_prompt(project: Project) -> str:
    """Render the system prompt with live project data."""
    all_steps = project.steps or []
    completed = [s for s in all_steps if s.get("is_completed")]
    remaining = [s for s in all_steps if not s.get("is_completed")]

    def fmt_steps(steps: list) -> str:
        if not steps:
            return "  (none)"
        return "\n".join(f"  - {s.get('title', 'Untitled step')}" for s in steps)

    tech_stack = ", ".join(project.technologies) if project.technologies else "Not specified"

    return _MENTOR_SYSTEM_TEMPLATE.format(
        title=project.title,
        difficulty=project.difficulty_level or "Not specified",
        objective=project.objective or "Not specified",
        tech_stack=tech_stack,
        total_steps=len(all_steps),
        all_steps_list=fmt_steps(all_steps),
        completed_count=len(completed),
        completed_steps_list=fmt_steps(completed),
        remaining_steps_list=fmt_steps(remaining),
        progress_percent=project.progress_percent,
    )


class MentorService:
    def chat(
        self,
        db: Session,
        user_id: UUID,
        project_id: UUID,
        messages: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """
        Send a conversation to the mentor.

        Parameters
        ──────────
        messages  – list of {role: 'user'|'assistant', content: str} in
                    chronological order (client manages history, sends it all).
                    The system message is always prepended here server-side.

        Returns
        ───────
        {
            "reply": str,           # mentor response text
            "has_api_key": bool,    # whether a real GEMINI call was made
        }

        Raises ValueError if the project is not found or belongs to another user.
        """
        # ── Auth + project fetch (reuses existing user-isolation logic) ────────
        project = project_service.get_user_project_by_id(db, user_id=user_id, project_id=project_id)

        # ── No API key — return a graceful offline message ────────────────────
        if not settings.GEMINI_API_KEY:
            logger.warning("Mentor chat requested but GEMINI_API_KEY is not set.")
            step_names = [s.get("title", "") for s in (project.steps or []) if not s.get("is_completed")]
            hint = f' Your next milestone is: "{step_names[0]}".' if step_names else ""
            return {
                "reply": (
                    f"The AI Mentor is offline — no Gemini API key is configured.{hint}\n\n"
                    "To enable the mentor, add your `GEMINI_API_KEY` to the backend `.env` file and restart the server."
                ),
                "has_api_key": False,
            }

        # ── Build message list: system + conversation history ─────────────────
        system_prompt_text = _build_system_prompt(project)

        # Validate and sanitise incoming messages (only allow user/assistant roles)
        safe_messages = [
            {"role": m["role"], "content": str(m["content"])}
            for m in messages
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]

        if not safe_messages:
            return {"reply": "Please send a message to get started.", "has_api_key": True}

        # Gemini uses "model" instead of "assistant" for the assistant role
        gemini_contents = []
        for msg in safe_messages:
            role = "model" if msg["role"] == "assistant" else "user"
            gemini_contents.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })

        # ── Gemini API call ───────────────────────────────────────────────────
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
        )
        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt_text}]
            },
            "contents": gemini_contents,
            "generationConfig": {
                "temperature": 0.5,
                "maxOutputTokens": settings.MENTOR_MAX_TOKENS,
            },
        }
        headers = {"Content-Type": "application/json"}

        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(url, headers=headers, json=payload)

            if res.status_code != 200:
                error_body = res.text[:300]
                logger.error("Gemini API error %s: %s", res.status_code, error_body)
                raise RuntimeError(f"Gemini returned HTTP {res.status_code}. Please try again.")

            data = res.json()
            try:
                reply_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            except (KeyError, IndexError) as exc:
                raise RuntimeError(f"Unexpected Gemini response structure: {data}") from exc

            return {
                "reply": reply_text,
                "has_api_key": True,
            }

        except httpx.TimeoutException:
            logger.warning("Gemini mentor request timed out for project %s.", project_id)
            raise RuntimeError("The AI Mentor took too long to respond. Please try again.")
        except RuntimeError:
            raise
        except Exception as exc:
            logger.exception("Unexpected error in MentorService.chat: %s", exc)
            raise RuntimeError("An unexpected error occurred while contacting the AI Mentor.")


mentor_service = MentorService()
