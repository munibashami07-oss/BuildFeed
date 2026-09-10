import json
import logging
from datetime import date, datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user_consumed_content import UserConsumedContent
from app.models.project import Project
from app.services.notifications.notification_service import notification_service
from app.models.content_item import ContentItem
from app.schemas.focus_gate import ProjectSuggestionResponse, ExternalProjectPlanResponse

logger = logging.getLogger(__name__)


def today_date() -> date:
    return date.today()


PROJECT_SUGGESTION_PROMPT = """You are BuildFeed AI Mentor, an expert software architect helping builders turn inspiration into working projects.

You will be given a saved content item. Work in two passes:

PASS 1 — CLASSIFY. Decide what the content actually is:
- "project_idea": the content already describes something concrete and buildable
  (an app, a system, a specific technical build) — a real project on its own.
- "learning_resource": the content teaches a concept, skill, or technique (a tutorial,
  course, article, explainer, paper, talk). It is NOT itself a project — someone
  finishing it has learned something, not built something.
- "tool_or_library": the content is a tool, library, framework, API, or platform meant
  to be USED inside a project, not a project in itself.

PASS 2 — RESPOND based on the classification:
- If "project_idea": suggest the project the content is already describing. Don't invent
  a different idea — sharpen and scope the one that's there.
- If "learning_resource": write a "classification_note" telling the user this is for
  learning, not a project by itself, then propose ONE concrete project idea that applies
  what the content teaches (something a learner could realistically build right after).
- If "tool_or_library": write a "classification_note" explaining what the tool/library
  does, then propose ONE concrete project idea built using that tool, and fill
  "usage_note" with specifically how the tool is used inside that project (which part of
  the build it powers).

WHAT_YOU_ARE_BUILDING — this is critical and separate from "objective":
- Fill "what_you_are_building" with a plain-language, concrete answer to "what am I
  actually going to have at the end of this?" — e.g. "A command-line tool that watches
  a folder for new CSVs, validates them against a schema, and posts a summary to Slack."
- This must name the actual artifact (CLI tool / web app / API / browser extension /
  Discord bot / etc.) and its core behavior. Never a vague phrase like "a project that
  applies these concepts" — that tells the user nothing about what they'll be looking at.

STEPS — this is critical:
- "basic_steps" is a real implementation plan, not a template. The NUMBER of steps must
  match the actual scope of this specific project — do not default to any fixed count.
  A small script might need 3 steps; a multi-service app might need 9+. Never pad or
  trim to hit a round number.
- Every step must be concrete and specific to THIS project — name the actual component,
  data, endpoint, screen, or logic involved (e.g. "Build a rate-limiter middleware that
  buckets requests by API key using Redis" — not "Implement backend logic"). Steps like
  "Setup project", "Build UI", "Test and deploy" are only acceptable if genuinely that's
  all that's left; never use them as filler.
- This applies EQUALLY when the classification is "learning_resource" or
  "tool_or_library". The steps describe how to BUILD the spun-off project you proposed
  — never steps like "Learn X", "Read the docs", "Watch the tutorial", or "Practice the
  concept". The learner already has the content; the steps are the engineering work to
  build the thing you named in "what_you_are_building".
- Order steps the way an engineer would actually sequence the work.

REFRESH REQUESTS: if the user prompt includes a list of previously-shown project titles
to exclude, this is a refresh — the user rejected those and wants something visibly
different. For "learning_resource" and "tool_or_library" content, propose a different
concrete project idea entirely. For "project_idea" content (where you don't invent a
different core idea), still change the concrete angle in a way a user would immediately
notice: a different primary feature set, a different platform/interface (CLI vs web vs
API), or a meaningfully different scope — and the steps must reflect that, not be a
reworded copy of the previous plan. Never return the same "project_title" or a
near-identical "basic_steps" list on a refresh.

Output ONLY valid JSON with EXACTLY these keys:
- "content_classification": one of "project_idea", "learning_resource", "tool_or_library"
- "classification_note": string (1-2 plain sentences; see PASS 2 rules above)
- "project_title": string (catchy, clear project title)
- "what_you_are_building": string (see WHAT_YOU_ARE_BUILDING rules above)
- "objective": string (1-2 sentence core goal of the project)
- "description": string (detailed overview of what to build)
- "technologies": array of strings (recommended tech stack, e.g. ["Python", "FastAPI", "React"])
- "basic_steps": array of strings (a realistic, project-specific number of implementation steps — see STEPS rules above)
- "usage_note": string or null (only non-null for "tool_or_library"; how the tool is used in the suggested project)
"""


class FocusGateService:
    def get_focus_gate_status(
        self, db: Session, user_id: UUID, target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Get focus gate status for user for today (or specified date)."""
        current_date = target_date or today_date()
        consumed_today = (
            db.query(UserConsumedContent)
            .filter(
                UserConsumedContent.user_id == user_id,
                UserConsumedContent.consumed_date == current_date,
            )
            .count()
        )

        # Use per-user feed limit if set (Module 20); fall back to global setting
        from app.models.user import User as _User
        user_row = db.query(_User).filter(_User.id == user_id).first()
        user_limit = getattr(user_row, 'feed_content_limit', None)
        limit = user_limit if (user_limit and user_limit > 0) else settings.FEED_CONTENT_LIMIT

        is_locked = consumed_today >= limit
        remaining = max(0, limit - consumed_today)

        return {
            "limit": limit,
            "consumed_today": consumed_today,
            "is_locked": is_locked,
            "consumed_date": current_date.isoformat(),
            "remaining": remaining,
        }

    def consume_item(
        self, db: Session, user_id: UUID, item_id: UUID, target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Record content consumption event for current user. Prevents double-counting the same item on the same day."""
        current_date = target_date or today_date()

        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item:
            raise ValueError(f"ContentItem {item_id} not found.")

        existing = (
            db.query(UserConsumedContent)
            .filter(
                UserConsumedContent.user_id == user_id,
                UserConsumedContent.content_item_id == item_id,
                UserConsumedContent.consumed_date == current_date,
            )
            .first()
        )

        already_consumed = False
        if existing:
            already_consumed = True
            logger.info("Item %s already consumed by user %s on %s.", item_id, user_id, current_date)
        else:
            record = UserConsumedContent(
                user_id=user_id,
                content_item_id=item_id,
                consumed_date=current_date,
            )
            db.add(record)
            db.commit()

        # --- Achievement checks (Module 13) — content consumption trigger ---
        newly_unlocked: List[str] = []
        if not already_consumed:
            try:
                from app.services.achievements.achievement_service import (
                    achievement_service as _ach_svc,
                    TRIGGER_CONTENT,
                )
                newly_unlocked = _ach_svc.check_and_award(db, user_id, TRIGGER_CONTENT)
                from app.services.achievements.achievement_catalog import CATALOG_BY_ID
                for achievement_id in newly_unlocked:
                    achievement = CATALOG_BY_ID.get(achievement_id)
                    if achievement:
                        notification_service.notify_achievement_unlocked(
                            db, user_id, achievement.id, achievement.name, achievement.description
                        )
            except Exception as _ach_err:
                logger.warning("Achievement check failed on consume_item: %s", _ach_err)

        status = self.get_focus_gate_status(db, user_id=user_id, target_date=current_date)

        # A Focus Gate reminder is an intentional event: it fires when a user
        # actually reaches today's consumption limit, not when the feed refreshes.
        if status["is_locked"] and not already_consumed:
            active_project = (
                db.query(Project)
                .filter(Project.user_id == user_id, Project.status == "in_progress")
                .order_by(Project.updated_at.desc())
                .first()
            )
            if active_project:
                notification_service.notify_focus_gate_reminder(
                    db, user_id, str(active_project.id), active_project.title
                )

        return {
            "consumed_today": status["consumed_today"],
            "limit": status["limit"],
            "is_locked": status["is_locked"],
            "item_id": item_id,
            "already_consumed_today": already_consumed,
            "newly_unlocked_achievements": newly_unlocked,
        }

    def unlock_feed_for_today(
        self, db: Session, user_id: UUID, target_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Clear today's consumed items to unlock feed for testing or project completion."""
        current_date = target_date or today_date()
        db.query(UserConsumedContent).filter(
            UserConsumedContent.user_id == user_id,
            UserConsumedContent.consumed_date == current_date,
        ).delete()
        db.commit()
        return self.get_focus_gate_status(db, user_id=user_id, target_date=current_date)

    # Content types in ContentItem that are inherently learning material vs. tools,
    # used only for the no-API-key fallback classifier below. The real classification
    # for GEMINI-backed suggestions is done by the model itself from full context.
    _LEARNING_CONTENT_TYPES = {"tutorial", "course", "article", "video", "paper", "talk", "blog_post"}
    _TOOL_CONTENT_TYPES = {"tool", "library", "framework", "repository", "package", "sdk", "api"}

    def generate_project_suggestion(
        self,
        db: Session,
        user_id: UUID,
        item_id: UUID,
        exclude_titles: Optional[List[str]] = None,
    ) -> ProjectSuggestionResponse:
        """Use existing GEMINI configuration to generate an AI project suggestion based on a saved content item.

        `exclude_titles` is passed when the user clicks "Refresh Idea" — it nudges the
        model away from repeating a suggestion it already gave for this same item.
        """
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item:
            raise ValueError(f"ContentItem {item_id} not found.")

        summary = item.ai_metadata.get("short_summary") if item.ai_metadata else item.description
        topics = item.ai_metadata.get("topics", []) if item.ai_metadata else []
        technologies = item.ai_metadata.get("technologies", []) if item.ai_metadata else []

        api_key = settings.GEMINI_API_KEY
        model = settings.GEMINI_MODEL

        if api_key:
            try:
                exclusion_clause = ""
                if exclude_titles:
                    joined = "; ".join(t for t in exclude_titles if t)
                    exclusion_clause = f"\nThe user already saw and rejected these project ideas for this content — propose a genuinely different angle, not a reword: {joined}\n"

                user_prompt = f"""Content Title: {item.title}
Content Type: {item.content_type}
Summary: {summary or 'N/A'}
Topics: {', '.join(topics) if topics else 'N/A'}
Technologies: {', '.join(technologies) if technologies else 'N/A'}
Source URL: {item.source_url}
{exclusion_clause}"""

                # Gemini REST API: API key as query param, no Bearer header
                gemini_url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent?key={api_key}"
                )
                payload = {
                    "system_instruction": {
                        "parts": [{"text": PROJECT_SUGGESTION_PROMPT}]
                    },
                    "contents": [
                        {"role": "user", "parts": [{"text": user_prompt}]}
                    ],
                    "generationConfig": {
                        "temperature": 0.55 if exclude_titles else 0.4,
                        "responseMimeType": "application/json",
                    },
                }
                headers = {"Content-Type": "application/json"}

                res = httpx.post(gemini_url, headers=headers, json=payload, timeout=20.0)
                if res.status_code == 200:
                    try:
                        raw_content = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                    except (KeyError, IndexError):
                        raw_content = None
                    if raw_content:
                        parsed = json.loads(raw_content)
                        fallback_steps = self._fallback_steps(item, technologies)
                        return ProjectSuggestionResponse(
                            content_classification=parsed.get("content_classification", "project_idea"),
                            classification_note=parsed.get("classification_note", ""),
                            project_title=parsed.get("project_title", f"Build: {item.title}"),
                            what_you_are_building=parsed.get("what_you_are_building", f"A working build inspired by {item.title}."),
                            objective=parsed.get("objective", f"Implement a functional prototype inspired by {item.title}."),
                            description=parsed.get("description", summary or "Build an interactive application using these principles."),
                            technologies=parsed.get("technologies", technologies or ["Python", "JavaScript"]),
                            basic_steps=parsed.get("basic_steps") or fallback_steps,
                            usage_note=parsed.get("usage_note"),
                            based_on_item_title=item.title,
                            based_on_item_id=item.id,
                        )
            except Exception as e:
                logger.warning("GEMINI project suggestion generation failed (%s). Using fallback generator.", str(e))

        # Fallback (no API key / API failure): a lighter heuristic classification plus
        # a project-shaped plan whose length and content depend on the actual topics/tech
        # we know about, and which genuinely varies on refresh via exclude_titles.
        return self._fallback_suggestion(item, summary, topics, technologies, exclude_titles)

    def _classify_fallback(self, item: ContentItem) -> str:
        content_type = (item.content_type or "").lower()
        if content_type in self._LEARNING_CONTENT_TYPES:
            return "learning_resource"
        if content_type in self._TOOL_CONTENT_TYPES:
            return "tool_or_library"
        return "project_idea"

    # A handful of distinct "shapes" a project can take. The fallback generator picks
    # a different one each refresh (indexed by how many ideas the user has already
    # rejected) so a "Refresh Idea" click always produces a visibly different result,
    # even with no GEMINI key configured.
    _PROJECT_VARIANTS = [
        {
            "artifact": "a command-line tool",
            "label": "CLI Tool",
            "interface_step": "Build a CLI entry point with argument parsing (input path/flags) using {tech0}",
        },
        {
            "artifact": "a small web app with a REST API backend",
            "label": "Web App",
            "interface_step": "Build REST endpoints in {tech0} for the core actions, and a minimal frontend page to trigger and view them",
        },
        {
            "artifact": "a browser extension",
            "label": "Browser Extension",
            "interface_step": "Build the extension popup UI and wire it to a background script that talks to the core logic",
        },
        {
            "artifact": "an automated bot/worker",
            "label": "Automated Bot",
            "interface_step": "Build a scheduled worker process that runs the core logic on a timer and reports results (log/webhook/Slack)",
        },
    ]

    def _fallback_steps(self, item: ContentItem, technologies: List[str], variant_idx: int = 0) -> List[str]:
        """Build a step list whose length and content depend on how much we actually
        know about the project (topics/tech), and which changes shape on refresh."""
        tech = technologies if technologies else ["Python", "FastAPI", "React", "TypeScript"]
        variant = self._PROJECT_VARIANTS[variant_idx % len(self._PROJECT_VARIANTS)]
        title = item.title

        steps = [
            f"Initialize the repository and install {', '.join(tech[:2])} as core dependencies",
            f"Model the core data this project works with (the inputs/outputs '{title}' is about) as concrete types/classes",
            f"Implement the core processing logic that turns those inputs into the result '{title}' is meant to produce",
        ]
        if len(tech) > 2:
            steps.append(f"Wire in {', '.join(tech[2:])} for the parts of the pipeline that need it (storage, calls, orchestration)")
        steps.append(variant["interface_step"].format(tech0=tech[0]))
        if (item.ai_metadata or {}).get("difficulty_level") in ("Advanced", "Expert"):
            steps.append("Add authentication/authorization and handle the realistic failure cases (bad input, timeouts, rate limits)")
        steps.append(f"Write a couple of end-to-end tests covering the main flow of {variant['artifact']}, then package/demo it")
        return steps

    def _fallback_suggestion(
        self,
        item: ContentItem,
        summary: Optional[str],
        topics: List[str],
        technologies: List[str],
        exclude_titles: Optional[List[str]] = None,
    ) -> ProjectSuggestionResponse:
        classification = self._classify_fallback(item)
        fallback_tech = technologies if technologies else ["Python", "FastAPI", "React", "TypeScript"]
        # Cycle to a different project "shape" each time we've already shown one — this
        # is what makes Refresh Idea actually change something without an LLM in the loop.
        variant_idx = len(exclude_titles) if exclude_titles else 0
        variant = self._PROJECT_VARIANTS[variant_idx % len(self._PROJECT_VARIANTS)]
        steps = self._fallback_steps(item, technologies, variant_idx)
        topic_hint = topics[0] if topics else item.title

        what_building = f"{variant['label']} that takes the core idea behind '{item.title}' ({topic_hint}) and turns it into something you run and interact with."

        if classification == "learning_resource":
            note = f"'{item.title}' looks like learning material rather than a project on its own. Here's {variant['artifact']} that puts what it teaches into practice."
            title = f"{variant['label']}: applying {item.title}"
            objective = f"Practice the concepts from '{item.title}' by building {variant['artifact']} that uses them for something real."
        elif classification == "tool_or_library":
            note = f"'{item.title}' is a tool/library rather than a project by itself. Here's {variant['artifact']} you could build that uses it."
            title = f"{variant['label']} powered by {item.title}"
            objective = f"Build {variant['artifact']} that integrates {item.title} to solve a real problem."
        else:
            note = f"'{item.title}' already describes a concrete project — here's a scoped plan to build it as {variant['artifact']}."
            title = f"Build: {item.title}"
            objective = f"Create {variant['artifact']} based on {item.title}."

        return ProjectSuggestionResponse(
            content_classification=classification,
            classification_note=note,
            project_title=title,
            what_you_are_building=what_building,
            objective=objective,
            description=summary or f"An interactive project applying principles from {item.title}.",
            technologies=fallback_tech,
            basic_steps=steps,
            usage_note=(f"Use {item.title} for the core logic {variant['artifact']} depends on, then build the rest of the app around it." if classification == "tool_or_library" else None),
            based_on_item_title=item.title,
            based_on_item_id=item.id,
        )

    def generate_external_project_plan(self, db: Session, item_id: UUID) -> ExternalProjectPlanResponse:
        """Generate the richer practical plan used by the external URL importer.

        This intentionally reuses BuildFeed's existing GEMINI settings/integration;
        it does not introduce a second AI client or project persistence model.
        """
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item:
            raise ValueError(f"ContentItem {item_id} not found.")

        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured in settings or environment.")

        ai = item.ai_metadata or {}
        prompt = f"""Create a practical software project plan from this publicly imported idea.

Title: {item.title}
Source URL: {item.source_url}
Description: {item.description or 'N/A'}
AI analysis: {json.dumps(ai, default=str)}
Metadata: {json.dumps(item.raw_metadata or {}, default=str)}

Return ONLY valid JSON with exactly these keys:
- project_title: string
- what_the_project_is: string
- required_skills: array of strings
- technologies: array of strings
- difficulty_level: Beginner, Intermediate, or Advanced
- estimated_effort: concise estimate such as "1-2 weeks, 6-10 hours/week"
- implementation_steps: 5-8 concrete sequential steps
- suggested_milestones: 3-6 milestone names
- objective: 1-2 sentence project objective
- description: practical build description
"""
        headers = {"Content-Type": "application/json"}
        gemini_url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.GEMINI_MODEL}:generateContent?key={api_key}"
        )
        payload = {
            "system_instruction": {
                "parts": [{"text": "You are the BuildFeed AI Project Mentor. Turn external technical inspiration into realistic build plans."}]
            },
            "contents": [
                {"role": "user", "parts": [{"text": prompt}]}
            ],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": settings.MENTOR_MAX_TOKENS,
                "responseMimeType": "application/json",
            },
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(gemini_url, headers=headers, json=payload)
            if res.status_code != 200:
                raise RuntimeError(f"Gemini API error [{res.status_code}]: {res.text[:300]}")
            try:
                raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError) as exc:
                raise RuntimeError(f"Unexpected Gemini response structure: {res.json()}") from exc
            parsed = json.loads(raw_text)
            return ExternalProjectPlanResponse.model_validate(parsed)
        except Exception:
            logger.exception("External project plan generation failed for item %s", item_id)
            raise RuntimeError("The AI Project Mentor could not generate a plan for this URL.")


focus_gate_service = FocusGateService()
