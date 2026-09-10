"""
Dashboard Service — Module 17: Activity & Progress Dashboard

Aggregates data from existing tables (no new DB schema required):
  • UserProgression  → XP, level, step/project counts
  • Project          → in-progress list, completed count, project events
  • UserAchievement  → unlocked count, recent achievements, achievement events
  • SavedContent     → saved count, recent save events
  • UserConsumedContent → today's focus gate consumption

The activity timeline is synthesised by merging timestamped events from
several tables and returning the most recent N items sorted descending.
No separate activity_log table is created or needed.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.saved_content import SavedContent
from app.models.user_achievement import UserAchievement
from app.models.user_consumed_content import UserConsumedContent
from app.models.content_item import ContentItem
from app.services.progression.xp_service import xp_service
from app.services.focus.focus_gate_service import focus_gate_service, today_date
from app.services.achievements.achievement_catalog import CATALOG_BY_ID, ACHIEVEMENT_CATALOG

logger = logging.getLogger(__name__)

# ── Event type constants ──────────────────────────────────────────────────────
_EVT_PROJECT_COMPLETED  = "project_completed"
_EVT_PROJECT_STARTED    = "project_started"
_EVT_ACHIEVEMENT        = "achievement_unlocked"
_EVT_XP_EARNED          = "xp_earned"
_EVT_CONTENT_SAVED      = "content_saved"
_EVT_LEVEL_UP           = "level_up"


def _fmt(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware UTC."""
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class DashboardService:

    def get_dashboard(self, db: Session, user_id: UUID) -> Dict[str, Any]:
        """Return the full dashboard payload for a user in one DB round-trip set."""

        # ── 1. Progression ────────────────────────────────────────────────────
        prog_dict = xp_service.get_progression(db, user_id)

        # ── 2. Project counts + in-progress list ──────────────────────────────
        completed_count = (
            db.query(func.count(Project.id))
            .filter(Project.user_id == user_id, Project.status == "completed")
            .scalar() or 0
        )
        in_progress_projects_raw = (
            db.query(Project)
            .filter(Project.user_id == user_id, Project.status == "in_progress")
            .order_by(Project.updated_at.desc())
            .limit(3)
            .all()
        )
        in_progress_count = (
            db.query(func.count(Project.id))
            .filter(Project.user_id == user_id, Project.status == "in_progress")
            .scalar() or 0
        )

        in_progress_list = [
            {
                "id": str(p.id),
                "title": p.title,
                "progress_percent": p.progress_percent,
                "difficulty_level": p.difficulty_level,
                "technologies": p.technologies or [],
                "updated_at": _fmt(p.updated_at),
            }
            for p in in_progress_projects_raw
        ]

        # ── 3. Saved content count ────────────────────────────────────────────
        saved_count = (
            db.query(func.count(SavedContent.id))
            .filter(SavedContent.user_id == user_id)
            .scalar() or 0
        )

        # ── 4. Achievements ───────────────────────────────────────────────────
        achievement_rows = (
            db.query(UserAchievement)
            .filter(UserAchievement.user_id == user_id)
            .order_by(UserAchievement.unlocked_at.desc())
            .all()
        )
        achievements_unlocked = len(achievement_rows)
        achievements_total = len(ACHIEVEMENT_CATALOG)

        recent_achievements = []
        for row in achievement_rows[:4]:
            ach_def = CATALOG_BY_ID.get(row.achievement_id)
            if ach_def:
                recent_achievements.append(
                    {
                        "id": ach_def.id,
                        "name": ach_def.name,
                        "description": ach_def.description,
                        "icon": ach_def.icon,
                        "category": ach_def.category,
                        "unlocked_at": _fmt(row.unlocked_at),
                    }
                )

        # ── 5. Focus Gate status ──────────────────────────────────────────────
        focus_raw = focus_gate_service.get_focus_gate_status(db, user_id=user_id)
        focus_summary = {
            "consumed_today": focus_raw["consumed_today"],
            "limit": focus_raw["limit"],
            "remaining": focus_raw["remaining"],
            "is_locked": focus_raw["is_locked"],
        }

        # ── 6. Activity timeline ──────────────────────────────────────────────
        events: List[Dict[str, Any]] = []

        # Completed projects → events
        completed_projects = (
            db.query(Project)
            .filter(
                Project.user_id == user_id,
                Project.status == "completed",
                Project.completed_at.isnot(None),
            )
            .order_by(Project.completed_at.desc())
            .limit(10)
            .all()
        )
        for p in completed_projects:
            xp_note = f"+{100} XP"  # project completion XP from settings would be ideal but avoid circular import
            events.append(
                {
                    "event_type": _EVT_PROJECT_COMPLETED,
                    "title": f'Completed "{p.title}"',
                    "detail": xp_note,
                    "icon": "CheckCircle2",
                    "timestamp": _fmt(p.completed_at),
                    "link": f"/projects/{p.id}",
                }
            )

        # Project started → events
        started_projects = (
            db.query(Project)
            .filter(Project.user_id == user_id)
            .order_by(Project.created_at.desc())
            .limit(8)
            .all()
        )
        for p in started_projects:
            events.append(
                {
                    "event_type": _EVT_PROJECT_STARTED,
                    "title": f'Started "{p.title}"',
                    "detail": p.difficulty_level,
                    "icon": "Rocket",
                    "timestamp": _fmt(p.created_at),
                    "link": f"/projects/{p.id}",
                }
            )

        # Achievement unlocks → events
        for row in achievement_rows[:10]:
            ach_def = CATALOG_BY_ID.get(row.achievement_id)
            if ach_def:
                events.append(
                    {
                        "event_type": _EVT_ACHIEVEMENT,
                        "title": f'Unlocked "{ach_def.name}"',
                        "detail": ach_def.description,
                        "icon": ach_def.icon,
                        "timestamp": _fmt(row.unlocked_at),
                        "link": "/profile",
                    }
                )

        # Recent saved content → events
        recent_saves = (
            db.query(SavedContent, ContentItem)
            .join(ContentItem, SavedContent.content_item_id == ContentItem.id)
            .filter(SavedContent.user_id == user_id)
            .order_by(SavedContent.created_at.desc())
            .limit(8)
            .all()
        )
        for saved, item in recent_saves:
            events.append(
                {
                    "event_type": _EVT_CONTENT_SAVED,
                    "title": f'Saved "{item.title}"',
                    "detail": item.content_type.replace("_", " ").title() if item.content_type else None,
                    "icon": "Bookmark",
                    "timestamp": _fmt(saved.created_at),
                    "link": "/saved",
                }
            )

        # Sort all events by timestamp descending, keep top 15
        events.sort(key=lambda e: e["timestamp"], reverse=True)
        events = events[:15]

        return {
            # Progression
            "total_xp": prog_dict["total_xp"],
            "level": prog_dict["level"],
            "level_title": prog_dict["level_title"],
            "xp_in_current_level": prog_dict["xp_in_current_level"],
            "xp_for_current_level_span": prog_dict["xp_for_current_level_span"],
            "xp_to_next_level": prog_dict["xp_to_next_level"],
            "level_progress_percent": prog_dict["level_progress_percent"],
            "is_max_level": prog_dict["is_max_level"],
            # Counts
            "projects_completed": completed_count,
            "projects_in_progress": in_progress_count,
            "completed_steps_count": prog_dict["completed_steps_count"],
            "saved_count": saved_count,
            "achievements_unlocked": achievements_unlocked,
            "achievements_total": achievements_total,
            # Focus gate
            "focus": focus_summary,
            # Lists
            "in_progress_projects": in_progress_list,
            "recent_achievements": recent_achievements,
            "activity": events,
        }


dashboard_service = DashboardService()
