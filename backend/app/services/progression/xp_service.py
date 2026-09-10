"""
XP Service — Module 12: XP + Progression System

Responsibilities:
  - get_or_create_progression: lazily create a UserProgression row on first XP event
  - award_step_xp: award XP for a completed step (idempotent — ignores duplicate step IDs)
  - award_project_xp: award XP for a completed project (idempotent — ignores duplicate project IDs)
  - get_progression: return full progression snapshot for a user
  - build_progression_dict: shared helper used by both service and API responses

XP values come from settings so they are configurable without code changes.
Level thresholds come from level_config.py so they are easy to modify.
"""

import logging
from uuid import UUID
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.config import settings
from app.models.user_progression import UserProgression
from app.services.notifications.notification_service import notification_service
from app.services.progression.level_config import (
    calculate_level,
    xp_needed_for_next_level,
    xp_progress_in_current_level,
    MAX_LEVEL,
)

logger = logging.getLogger(__name__)


class XPService:
    # ------------------------------------------------------------------ #
    #  Internal helpers                                                    #
    # ------------------------------------------------------------------ #

    def get_or_create_progression(self, db: Session, user_id: UUID) -> UserProgression:
        """Return the UserProgression row for user_id, creating it if absent."""
        prog = db.query(UserProgression).filter(UserProgression.user_id == user_id).first()
        if not prog:
            prog = UserProgression(
                user_id=user_id,
                total_xp=0,
                level=1,
                awarded_step_ids=[],
                awarded_project_ids=[],
                completed_steps_count=0,
                completed_projects_count=0,
            )
            db.add(prog)
            db.flush()  # assign id without full commit
            logger.info("Created new UserProgression row for user %s.", user_id)
        return prog

    def _recalculate_level(self, prog: UserProgression) -> bool:
        """Recalculate and update the level field. Returns True if level changed."""
        new_level = calculate_level(prog.total_xp)
        if new_level != prog.level:
            old_level = prog.level
            prog.level = new_level
            logger.info(
                "User %s levelled up: %s → %s (total_xp=%s).",
                prog.user_id,
                old_level,
                new_level,
                prog.total_xp,
            )
            return True
        return False

    def build_progression_dict(self, prog: UserProgression) -> Dict[str, Any]:
        """Serialise a UserProgression row into a plain dict for API responses."""
        xp_in_level, level_span = xp_progress_in_current_level(prog.total_xp)
        xp_to_next = xp_needed_for_next_level(prog.total_xp)
        at_max = prog.level >= MAX_LEVEL

        return {
            "total_xp": prog.total_xp,
            "level": prog.level,
            "level_title": self._level_title(prog.level),
            "xp_in_current_level": xp_in_level,
            "xp_for_current_level_span": level_span,
            "xp_to_next_level": xp_to_next,
            "level_progress_percent": int((xp_in_level / level_span) * 100) if level_span > 0 else 100,
            "completed_steps_count": prog.completed_steps_count,
            "completed_projects_count": prog.completed_projects_count,
            "is_max_level": at_max,
        }

    @staticmethod
    def _level_title(level: int) -> str:
        """Optional flavour titles — professional, not childish."""
        titles = {
            1:  "Newcomer",
            2:  "Builder",
            3:  "Craftsperson",
            4:  "Engineer",
            5:  "Architect",
            6:  "Lead",
            7:  "Principal",
            8:  "Staff",
            9:  "Distinguished",
            10: "Fellow",
        }
        return titles.get(level, f"Level {level}")

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def get_progression(self, db: Session, user_id: UUID) -> Dict[str, Any]:
        """Return the current progression snapshot for a user (read-only)."""
        prog = self.get_or_create_progression(db, user_id)
        db.commit()
        return self.build_progression_dict(prog)

    def award_step_xp(
        self,
        db: Session,
        user_id: UUID,
        step_id: str,
        project_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Award XP for completing a project step.

        Idempotent: if this (project_id, step_id) pair already exists in
        awarded_step_ids, no XP is awarded and xp_earned=0 is returned.

        NOTE: step_id alone is NOT globally unique — every project's step list is
        generated locally as "step-1", "step-2", "step-3", ... (see
        project_service.create_project / create_project_from_saved), so the same
        step_id is reused across every project a user has. The dedup key must
        therefore be scoped to the project it belongs to, otherwise completing
        "step-1" on a user's first project silently blocks XP for "step-1" on
        every project after that.

        Returns a dict with the XP event outcome and updated progression.
        """
        prog = self.get_or_create_progression(db, user_id)

        awarded_steps: list = list(prog.awarded_step_ids or [])

        # Composite dedup key: scoped to the project so identical step_ids
        # ("step-1", "step-2", ...) across different projects don't collide.
        award_key = f"{project_id}:{step_id}" if project_id else step_id

        # Deduplication guard
        if award_key in awarded_steps:
            logger.debug(
                "Step %s (project=%s) already awarded XP for user %s — skipping.",
                step_id, project_id, user_id,
            )
            return {
                "xp_earned": 0,
                "already_awarded": True,
                "levelled_up": False,
                "progression": self.build_progression_dict(prog),
            }

        xp_amount = settings.XP_PER_STEP_COMPLETION

        # Record the step (project-scoped key)
        awarded_steps.append(award_key)
        prog.awarded_step_ids = awarded_steps
        flag_modified(prog, "awarded_step_ids")

        prog.total_xp += xp_amount
        prog.completed_steps_count += 1

        levelled_up = self._recalculate_level(prog)
        db.commit()
        db.refresh(prog)

        logger.info(
            "Awarded %s XP to user %s for step %s (project=%s). total_xp=%s level=%s.",
            xp_amount,
            user_id,
            step_id,
            project_id,
            prog.total_xp,
            prog.level,
        )

        # Notification is emitted here, at the single source of truth for XP/level changes.
        # This catches level-ups regardless of which feature awarded the XP.
        if levelled_up:
            notification_service.notify_level_up(
                db, user_id, prog.level, self._level_title(prog.level)
            )

        return {
            "xp_earned": xp_amount,
            "already_awarded": False,
            "levelled_up": levelled_up,
            "new_level": prog.level if levelled_up else None,
            "progression": self.build_progression_dict(prog),
        }

    def award_project_xp(
        self,
        db: Session,
        user_id: UUID,
        project_id: str,
    ) -> Dict[str, Any]:
        """
        Award XP for completing a project.

        Idempotent: if this project_id is already in awarded_project_ids,
        no XP is awarded and xp_earned=0 is returned.

        Returns a dict with the XP event outcome and updated progression.
        """
        prog = self.get_or_create_progression(db, user_id)

        awarded_projects: list = list(prog.awarded_project_ids or [])

        # Deduplication guard
        if project_id in awarded_projects:
            logger.debug(
                "Project %s already awarded XP for user %s — skipping.", project_id, user_id
            )
            return {
                "xp_earned": 0,
                "already_awarded": True,
                "levelled_up": False,
                "progression": self.build_progression_dict(prog),
            }

        xp_amount = settings.XP_PER_PROJECT_COMPLETION

        awarded_projects.append(project_id)
        prog.awarded_project_ids = awarded_projects
        flag_modified(prog, "awarded_project_ids")

        prog.total_xp += xp_amount
        prog.completed_projects_count += 1

        levelled_up = self._recalculate_level(prog)
        db.commit()
        db.refresh(prog)

        logger.info(
            "Awarded %s XP to user %s for completing project %s. total_xp=%s level=%s.",
            xp_amount,
            user_id,
            project_id,
            prog.total_xp,
            prog.level,
        )

        # Same central level-up trigger for project-completion XP.
        if levelled_up:
            notification_service.notify_level_up(
                db, user_id, prog.level, self._level_title(prog.level)
            )

        return {
            "xp_earned": xp_amount,
            "already_awarded": False,
            "levelled_up": levelled_up,
            "new_level": prog.level if levelled_up else None,
            "progression": self.build_progression_dict(prog),
        }


# Module-level singleton — matches the pattern of focus_gate_service, project_service, etc.
xp_service = XPService()