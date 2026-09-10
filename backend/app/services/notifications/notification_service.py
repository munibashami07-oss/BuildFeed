"""
Notification Service — Module 19: Notifications & Smart Reminders

Responsibilities
────────────────
• create()          — insert a new notification, skip silently if dedup_key already exists
• get_for_user()    — paginated list for a user, newest first
• get_unread_count() — integer count of unread rows
• mark_read()       — mark a single notification read (enforces user ownership)
• mark_all_read()   — bulk-mark all unread as read for a user

Deduplication
─────────────
Any notification created with a non-null dedup_key will be silently skipped
if that (user_id, dedup_key) pair already exists — enforced by a DB partial
unique index AND a code-level check so the API never raises on conflict.

Common dedup_key patterns:
  "level_up:<level>"              — once per level reached
  "achievement:<achievement_id>"  — once per achievement unlocked
  "project_completed:<project_id>"— once per project completed
  "project_reminder:<project_id>:<date_str>" — daily reminder throttle
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.notification import (
    Notification,
    NOTIF_PROJECT_COMPLETED,
    NOTIF_ACHIEVEMENT_UNLOCKED,
    NOTIF_LEVEL_UP,
    NOTIF_PROJECT_REMINDER,
    NOTIF_FOCUS_GATE_UNLOCKED,
    NOTIF_CONTENT_AVAILABLE,
)

logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc)


class NotificationService:

    # ── Notification preference check (Module 20) ────────────────────────────

    def _user_wants_notif(self, db: Session, user_id: UUID, notif_type: str) -> bool:
        """Return False if the user has disabled this notification category."""
        try:
            from app.models.user import User as _User
            user_row = db.query(_User).filter(_User.id == user_id).first()
            if not user_row:
                return True
            # Master switch
            notif_enabled = getattr(user_row, 'notif_enabled', True)
            if notif_enabled is False:
                return False
            # Per-category
            if notif_type == NOTIF_ACHIEVEMENT_UNLOCKED:
                return getattr(user_row, 'notif_achievements', True) is not False
            if notif_type in (NOTIF_PROJECT_COMPLETED, NOTIF_PROJECT_REMINDER, NOTIF_FOCUS_GATE_UNLOCKED, "focus_gate_reminder"):
                return getattr(user_row, 'notif_projects', True) is not False
            if notif_type == NOTIF_CONTENT_AVAILABLE:
                return getattr(user_row, 'notif_content', True) is not False
        except Exception as _err:
            logger.debug("Could not read notification prefs for user %s: %s", user_id, _err)
        return True

    def create(
        self,
        db: Session,
        user_id: UUID,
        type: str,
        title: str,
        message: str,
        link: Optional[str] = None,
        related_id: Optional[str] = None,
        related_type: Optional[str] = None,
        dedup_key: Optional[str] = None,
    ) -> Optional[Notification]:
        """
        Create a notification.  Returns the new Notification, or None if
        the dedup_key already exists for this user (silent no-op).
        """
        # Code-level dedup check (avoids IntegrityError round-trip in the common case)
        if dedup_key:
            existing = (
                db.query(Notification)
                .filter(
                    Notification.user_id == user_id,
                    Notification.dedup_key == dedup_key,
                )
                .first()
            )
            if existing:
                logger.debug(
                    "Notification dedup_key '%s' already exists for user %s — skipping.",
                    dedup_key,
                    user_id,
                )
                return None

        # Module 20: respect per-user notification preferences
        if not self._user_wants_notif(db, user_id, type):
            return None

        notif = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            link=link,
            related_id=related_id,
            related_type=related_type,
            dedup_key=dedup_key,
            is_read=False,
            created_at=utc_now(),
        )
        db.add(notif)
        try:
            db.flush()
        except IntegrityError:
            # DB-level unique constraint hit (race condition) — roll back and skip
            db.rollback()
            logger.debug(
                "Notification IntegrityError for dedup_key '%s' user %s — skipping.",
                dedup_key,
                user_id,
            )
            return None

        logger.info(
            "Created notification type='%s' for user %s (dedup_key=%s).",
            type,
            user_id,
            dedup_key,
        )
        return notif

    def get_for_user(
        self,
        db: Session,
        user_id: UUID,
        limit: int = 30,
        offset: int = 0,
        unread_only: bool = False,
    ) -> List[Notification]:
        q = db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            q = q.filter(Notification.is_read.is_(False))
        return q.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()

    def get_by_id_for_user(self, db: Session, user_id: UUID, notification_id: UUID) -> Optional[Notification]:
        return (
            db.query(Notification)
            .filter(Notification.id == notification_id, Notification.user_id == user_id)
            .first()
        )

    def get_unread_count(self, db: Session, user_id: UUID) -> int:
        return (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
            .count()
        )

    def mark_read(self, db: Session, user_id: UUID, notification_id: UUID) -> bool:
        """Mark a single notification as read. Returns False if not found / not owned."""
        notif = (
            db.query(Notification)
            .filter(Notification.id == notification_id, Notification.user_id == user_id)
            .first()
        )
        if not notif:
            return False
        if not notif.is_read:
            notif.is_read = True
            db.commit()
        return True

    def mark_all_read(self, db: Session, user_id: UUID) -> int:
        """Mark all unread notifications as read. Returns number of rows updated."""
        count = (
            db.query(Notification)
            .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
            .update({"is_read": True})
        )
        db.commit()
        return count

    # ── Convenience builders — called from other services ────────────────────

    def notify_project_completed(
        self, db: Session, user_id: UUID, project_id: str, project_title: str
    ) -> None:
        self.create(
            db,
            user_id=user_id,
            type=NOTIF_PROJECT_COMPLETED,
            title="Project Complete",
            message=f'You finished "{project_title}". Great work — your portfolio has been updated.',
            link=f"/portfolio/{project_id}",
            related_id=project_id,
            related_type="project",
            dedup_key=f"project_completed:{project_id}",
        )
        db.commit()

    def notify_level_up(
        self, db: Session, user_id: UUID, new_level: int, level_title: str
    ) -> None:
        self.create(
            db,
            user_id=user_id,
            type=NOTIF_LEVEL_UP,
            title=f"Level {new_level} — {level_title}",
            message=f"You reached Level {new_level} ({level_title}). Keep building to unlock the next level.",
            link="/rewards",
            related_id=str(new_level),
            related_type="level",
            dedup_key=f"level_up:{new_level}",
        )
        db.commit()

    def notify_achievement_unlocked(
        self,
        db: Session,
        user_id: UUID,
        achievement_id: str,
        achievement_name: str,
        achievement_description: str,
    ) -> None:
        self.create(
            db,
            user_id=user_id,
            type=NOTIF_ACHIEVEMENT_UNLOCKED,
            title=f'Achievement Unlocked: "{achievement_name}"',
            message=achievement_description,
            link="/rewards",
            related_id=achievement_id,
            related_type="achievement",
            dedup_key=f"achievement:{achievement_id}",
        )
        db.commit()

    def notify_focus_gate_unlocked(
        self, db: Session, user_id: UUID, project_title: str
    ) -> None:
        """Notify that completing a project unlocked today's feed."""
        from datetime import date
        today = date.today().isoformat()
        self.create(
            db,
            user_id=user_id,
            type="focus_gate_unlocked",
            title="Feed Unlocked",
            message=f'You completed "{project_title}" — your discovery feed is now unlocked for today.',
            link="/dashboard",
            dedup_key=f"focus_gate_unlocked:{today}",
        )
        db.commit()

    def notify_focus_gate_reminder(
        self, db: Session, user_id: UUID, project_id: str, project_title: str
    ) -> None:
        """Remind the user to continue an active project when today's feed is locked."""
        from datetime import date
        today = date.today().isoformat()
        self.create(
            db,
            user_id=user_id,
            type="focus_gate_reminder",
            title="Focus Gate Reminder",
            message=f'Your discovery feed is locked for today. Continue building "{project_title}" to keep moving forward.',
            link=f"/projects/{project_id}",
            related_id=project_id,
            related_type="project",
            dedup_key=f"focus_gate_reminder:{today}",
        )
        db.commit()

    def notify_content_available(
        self, db: Session, user_id: UUID, count: int
    ) -> None:
        """Group newly discovered personalized content into one daily notification."""
        from datetime import date
        today = date.today().isoformat()
        label = "item" if count == 1 else "items"
        self.create(
            db,
            user_id=user_id,
            type=NOTIF_CONTENT_AVAILABLE,
            title="New Content For You",
            message=f"{count} new personalized {label} match your interests. See what is worth building next.",
            link="/dashboard",
            dedup_key=f"content_available:{today}",
        )
        db.commit()

    def notify_project_reminder(
        self, db: Session, user_id: UUID, project_id: str, project_title: str, progress: int
    ) -> None:
        """Remind user about a stale in-progress project (called from an external trigger, not auto-fired)."""
        from datetime import date
        today = date.today().isoformat()
        self.create(
            db,
            user_id=user_id,
            type=NOTIF_PROJECT_REMINDER,
            title="Continue Building",
            message=f'Your project "{project_title}" is {progress}% complete. Pick up where you left off.',
            link=f"/projects/{project_id}",
            related_id=project_id,
            related_type="project",
            dedup_key=f"project_reminder:{project_id}:{today}",
        )
        db.commit()


notification_service = NotificationService()
