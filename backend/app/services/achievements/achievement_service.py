"""
Achievement Service — Module 13: Achievements & Milestones

Responsibilities
────────────────
• _get_metric_value(db, user_id, metric) → current int value for a metric
• check_and_award(db, user_id, trigger) → evaluate all applicable achievements,
  award any newly unlocked ones, return list of newly-unlocked AchievementDef IDs
• get_user_achievements(db, user_id) → full list with progress for the API

Design
──────
• Uses existing DB data only — no second XP / progression system.
• Deduplication is enforced at DB level (UniqueConstraint) *and* in code
  (pre-query before INSERT) so duplicate awards are impossible.
• Every metric read is a lightweight COUNT or scalar query — no N+1 issues.
• Trigger constants are just string tags that group which achievements to
  re-evaluate; they map to broad event categories, not individual actions.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user_achievement import UserAchievement
from app.models.user_progression import UserProgression
from app.models.user_consumed_content import UserConsumedContent
from app.models.project import Project
from app.services.notifications.notification_service import notification_service
from app.services.achievements.achievement_catalog import (
    ACHIEVEMENT_CATALOG,
    CATALOG_BY_ID,
    AchievementDef,
)

logger = logging.getLogger(__name__)

# ── Trigger tags ─────────────────────────────────────────────────────────────
TRIGGER_STEP       = "step"        # a project step was completed
TRIGGER_PROJECT    = "project"     # a project was completed
TRIGGER_CONTENT    = "content"     # a content item was consumed
TRIGGER_LEVEL      = "level"       # user levelled up

# Which metrics to re-evaluate per trigger (avoids evaluating the full catalog
# on every event — keeps check_and_award O(constant)).
TRIGGER_METRICS: Dict[str, List[str]] = {
    TRIGGER_STEP:    ["completed_steps", "completed_projects", "project_completion_days"],
    TRIGGER_PROJECT: ["completed_projects", "project_completion_days", "completed_steps"],
    TRIGGER_CONTENT: ["consumed_items"],
    TRIGGER_LEVEL:   ["level"],
}


class AchievementService:
    # ── Metric resolution ────────────────────────────────────────────────────

    def _get_metric_value(self, db: Session, user_id: UUID, metric: str) -> int:
        """Return the current integer value for a metric for the given user."""

        if metric == "completed_steps":
            prog = db.query(UserProgression).filter(UserProgression.user_id == user_id).first()
            return prog.completed_steps_count if prog else 0

        if metric == "completed_projects":
            prog = db.query(UserProgression).filter(UserProgression.user_id == user_id).first()
            return prog.completed_projects_count if prog else 0

        if metric == "level":
            prog = db.query(UserProgression).filter(UserProgression.user_id == user_id).first()
            return prog.level if prog else 1

        if metric == "consumed_items":
            return (
                db.query(func.count(UserConsumedContent.id))
                .filter(UserConsumedContent.user_id == user_id)
                .scalar()
                or 0
            )

        if metric == "project_completion_days":
            # Count distinct calendar dates on which the user completed a project
            rows = (
                db.query(func.date(Project.completed_at))
                .filter(
                    Project.user_id == user_id,
                    Project.status == "completed",
                    Project.completed_at.isnot(None),
                )
                .distinct()
                .all()
            )
            return len(rows)

        logger.warning("Unknown achievement metric: %s", metric)
        return 0

    # ── Already-unlocked fast set ─────────────────────────────────────────────

    def _unlocked_ids(self, db: Session, user_id: UUID) -> set:
        rows = (
            db.query(UserAchievement.achievement_id)
            .filter(UserAchievement.user_id == user_id)
            .all()
        )
        return {r.achievement_id for r in rows}

    # ── Award helper ─────────────────────────────────────────────────────────

    def _award(self, db: Session, user_id: UUID, achievement_id: str) -> bool:
        """Insert a UserAchievement row. Returns True if newly inserted, False if already existed."""
        existing = (
            db.query(UserAchievement)
            .filter(
                UserAchievement.user_id == user_id,
                UserAchievement.achievement_id == achievement_id,
            )
            .first()
        )
        if existing:
            return False

        record = UserAchievement(
            user_id=user_id,
            achievement_id=achievement_id,
            unlocked_at=datetime.now(timezone.utc),
        )
        db.add(record)
        db.flush()
        logger.info("Achievement unlocked: %s for user %s.", achievement_id, user_id)
        return True

    # ── Public API ────────────────────────────────────────────────────────────

    def check_and_award(
        self,
        db: Session,
        user_id: UUID,
        trigger: str,
    ) -> List[str]:
        """
        Evaluate achievements relevant to `trigger`, award any newly unlocked
        ones, and return a list of newly-awarded achievement IDs.

        Called after every XP event; safe to call repeatedly (idempotent).
        """
        relevant_metrics = TRIGGER_METRICS.get(trigger, [])
        if not relevant_metrics:
            return []

        already_unlocked = self._unlocked_ids(db, user_id)

        # Filter catalog to achievements whose metric is relevant to this trigger
        candidates = [a for a in ACHIEVEMENT_CATALOG if a.metric in relevant_metrics]

        newly_awarded: List[str] = []
        for ach in candidates:
            if ach.id in already_unlocked:
                continue  # already awarded — skip metric query entirely

            current_value = self._get_metric_value(db, user_id, ach.metric)
            if current_value >= ach.threshold:
                awarded = self._award(db, user_id, ach.id)
                if awarded:
                    newly_awarded.append(ach.id)

        if newly_awarded:
            db.commit()
            logger.info(
                "Awarded %d achievement(s) to user %s: %s",
                len(newly_awarded),
                user_id,
                newly_awarded,
            )

            # Achievement service is the single source of truth for unlocks.
            # Emit the notification here so every achievement trigger is covered.
            for achievement_id in newly_awarded:
                achievement = CATALOG_BY_ID.get(achievement_id)
                if achievement:
                    notification_service.notify_achievement_unlocked(
                        db, user_id, achievement.id, achievement.name, achievement.description
                    )

        return newly_awarded

    def get_user_achievements(self, db: Session, user_id: UUID) -> List[Dict[str, Any]]:
        """
        Return the full achievement list for a user — every achievement in the
        catalog, enriched with the user's current progress and unlock state.
        """
        unlocked_rows = (
            db.query(UserAchievement)
            .filter(UserAchievement.user_id == user_id)
            .all()
        )
        unlocked_map: Dict[str, datetime] = {
            r.achievement_id: r.unlocked_at for r in unlocked_rows
        }

        # Pre-fetch all metrics used by the catalog (one query per unique metric)
        unique_metrics = list({a.metric for a in ACHIEVEMENT_CATALOG})
        metric_values: Dict[str, int] = {
            m: self._get_metric_value(db, user_id, m) for m in unique_metrics
        }

        result = []
        for ach in ACHIEVEMENT_CATALOG:
            current = metric_values.get(ach.metric, 0)
            is_unlocked = ach.id in unlocked_map
            unlocked_at = unlocked_map.get(ach.id)

            result.append(
                {
                    "id": ach.id,
                    "name": ach.name,
                    "description": ach.description,
                    "icon": ach.icon,
                    "category": ach.category,
                    "threshold": ach.threshold,
                    "metric": ach.metric,
                    "current_value": current,
                    "progress_percent": min(100, int((current / ach.threshold) * 100))
                    if ach.threshold > 0
                    else 100,
                    "is_unlocked": is_unlocked,
                    "unlocked_at": unlocked_at.isoformat() if unlocked_at else None,
                }
            )

        return result


achievement_service = AchievementService()
