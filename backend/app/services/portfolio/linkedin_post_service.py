"""
LinkedIn Post Generator — Module 17: Share Portfolio Project to LinkedIn

Responsibilities
─────────────────
• Build an AI-generated LinkedIn caption for a completed, portfolio-eligible
  project (hook → what it does → tech stack → GitHub link).
• Build the LinkedIn "share" deep link for the project's GitHub/demo URL.

Design decisions
─────────────────
• Reuses the same httpx + settings pattern as mentor_service.py.
• LinkedIn's share-offsite endpoint only accepts a `url` query param — it does
  NOT support pre-filling the post text (LinkedIn removed that for anti-spam
  reasons). So the flow is: generate caption → user copies it → we open
  LinkedIn's composer to the project link → user pastes.
• When no GEMINI API key is configured, a solid template-based caption is
  returned instead so the button always works in dev/demo environments.
"""

import logging
from typing import Any, Dict
from urllib.parse import quote
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.portfolio.portfolio_service import portfolio_service

from app.models.project import Project
from app.models.user import User
from app.services.portfolio.portfolio_service import _build_entry_dict

logger = logging.getLogger(__name__)

LINKEDIN_SHARE_BASE = "https://www.linkedin.com/sharing/share-offsite/"

_SYSTEM_PROMPT = """You write short, high-signal, engaging LinkedIn posts for software developers and builders announcing a project they built or are shipping.

Voice: confident, technical, concise, authentic, no corporate buzzwords, no excessive hashtag spam, at most 1-2 natural emojis.
Structure:
1. A strong one-line hook stating what was built and the problem it solves.
2. 2-3 sentences detailing how it works and key technical highlights.
3. A concise line listing the tech stack.
4. If a GitHub repo or demo link is provided in the prompt, invite people to check out the code or try the demo.

Keep the text under 900 characters. Output ONLY the post body, no markdown header markers, no outer quotes."""


def _fallback_caption(title: str, summary: str, technologies: list, github_url: str = None, demo_url: str = None, showcase_url: str = None) -> str:
    """Template-based caption used when no GEMINI key is configured or on fallback."""
    tech_line = ", ".join(technologies[:6]) if technologies else "a modern software stack"
    summary_line = summary or f"A full-stack build: {title}."
    
    parts = [
        f"Just built and shipped: {title} 🚀",
        "",
        summary_line,
        "",
        f"🛠️ Tech Stack: {tech_line}",
    ]
    
    links_part = []
    if github_url:
        links_part.append(f"📦 GitHub Repository: {github_url}")
    if demo_url:
        links_part.append(f"🔗 Live Demo: {demo_url}")
    if showcase_url and not demo_url and not github_url:
        links_part.append(f"🚀 Project Showcase: {showcase_url}")
        
    if links_part:
        parts.append("")
        parts.extend(links_part)
        
    parts.extend(["", "Check it out and let me know your thoughts! 👇"])
    return "\n".join(parts)


class LinkedInPostService:
    def generate_post(self, db: Session, user_id: UUID, project_id: UUID) -> Dict[str, Any]:
        """
        Build an AI-generated LinkedIn caption + share URL for a project.
        Automatically includes the GitHub repository link if the user has connected GitHub
        or if a repository was created for the project.
        """
        project = (
            db.query(Project)
            .filter(Project.id == project_id, Project.user_id == user_id)
            .first()
        )
        if not project:
            raise ValueError(f"Project {project_id} not found or unauthorized.")

        entry = _build_entry_dict(project)
        user = db.query(User).filter(User.id == user_id).first()

        title = entry.get("title") or project.title
        summary = entry.get("portfolio_summary") or entry.get("objective") or project.description or ""
        technologies = entry.get("technologies") or project.technologies or []
        
        # Determine GitHub repo URL
        github_url = entry.get("github_url") or project.github_repo_url
        if not github_url and user and user.github_username:
            # If user has connected GitHub but no explicit project repo URL was stored,
            # we check if a repo format exists or fallback to user's GitHub
            github_url = f"https://github.com/{user.github_username}"

        demo_url = entry.get("demo_url")
        showcase_url = f"{settings.FRONTEND_URL}/p/{entry['share_slug']}" if entry.get("share_slug") else f"{settings.FRONTEND_URL}/portfolio/{project_id}"

        # Primary link to share on LinkedIn
        primary_link = github_url or demo_url or showcase_url

        has_api_key = bool(settings.GEMINI_API_KEY)

        if not has_api_key:
            logger.warning("LinkedIn post requested but GEMINI_API_KEY is not set; using fallback caption.")
            caption = _fallback_caption(title, summary, technologies, github_url=github_url, demo_url=demo_url, showcase_url=showcase_url)
        else:
            prompt_details = [
                f"Project title: {title}",
                f"Summary: {summary or 'N/A'}",
                f"Tech stack: {', '.join(technologies) if technologies else 'N/A'}",
                f"Difficulty: {entry.get('difficulty_level') or project.difficulty_level or 'N/A'}",
            ]
            if github_url:
                prompt_details.append(f"GitHub Repository: {github_url}")
            if demo_url:
                prompt_details.append(f"Live Demo: {demo_url}")

            user_prompt = "\n".join(prompt_details) + "\n\nWrite the LinkedIn announcement post now. Include the repository and demo links if provided."

            headers = {"Content-Type": "application/json"}
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
            )
            payload = {
                "system_instruction": {
                    "parts": [{"text": _SYSTEM_PROMPT}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": user_prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 450,
                },
            }

            try:
                with httpx.Client(timeout=20.0) as client:
                    res = client.post(url, headers=headers, json=payload)
                if res.status_code != 200:
                    logger.error("Gemini API error %s: %s", res.status_code, res.text[:300])
                    caption = _fallback_caption(title, summary, technologies, github_url=github_url, demo_url=demo_url, showcase_url=showcase_url)
                else:
                    data = res.json()
                    try:
                        caption = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    except (KeyError, IndexError):
                        logger.error("Unexpected Gemini response structure for LinkedIn post: %s", data)
                        caption = _fallback_caption(title, summary, technologies, github_url=github_url, demo_url=demo_url, showcase_url=showcase_url)
            except httpx.TimeoutException:
                logger.warning("LinkedIn caption generation timed out for project %s.", project_id)
                caption = _fallback_caption(title, summary, technologies, github_url=github_url, demo_url=demo_url, showcase_url=showcase_url)
            except Exception:
                logger.exception("Unexpected error generating LinkedIn caption.")
                caption = _fallback_caption(title, summary, technologies, github_url=github_url, demo_url=demo_url, showcase_url=showcase_url)

        # Ensure the GitHub repo and Demo links are explicitly appended if not already present in the AI text
        appended_links = []
        if github_url and github_url not in caption:
            appended_links.append(f"📦 GitHub Repo: {github_url}")
        if demo_url and demo_url not in caption:
            appended_links.append(f"🔗 Live Demo: {demo_url}")
        if not github_url and not demo_url and showcase_url not in caption:
            appended_links.append(f"🚀 Project on BuildFeed: {showcase_url}")

        if appended_links:
            full_caption = f"{caption}\n\n" + "\n".join(appended_links)
        else:
            full_caption = caption

        share_url = f"{LINKEDIN_SHARE_BASE}?url={quote(primary_link, safe='')}"

        return {
            "caption": full_caption,
            "share_url": share_url,
            "has_api_key": has_api_key,
        }


linkedin_post_service = LinkedInPostService()