import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


# ── Notification type constants — import these wherever you create notifications ──
NOTIF_PROJECT_COMPLETED   = "project_completed"
NOTIF_ACHIEVEMENT_UNLOCKED = "achievement_unlocked"
NOTIF_LEVEL_UP            = "level_up"
NOTIF_PROJECT_REMINDER    = "project_reminder"    # stale in-progress project
NOTIF_FOCUS_GATE_UNLOCKED = "focus_gate_unlocked"  # project done → feed unlocked
NOTIF_CONTENT_AVAILABLE   = "content_available"   # new personalised content


class Notification(Base):
    """
    Per-user notification row.

    type          — one of the NOTIF_* constants above
    title         — short heading shown in the bell dropdown
    message       — fuller description (1-2 sentences)
    is_read       — False until the user views/marks the notification
    related_id    — optional FK hint (project id, achievement id, etc.) as string
    related_type  — discriminator for related_id ('project', 'achievement', 'level')
    dedup_key     — optional unique string to prevent duplicate notifications
                    for the same event (e.g. "level_up:5" for reaching level 5).
                    A unique constraint on (user_id, dedup_key) enforces this.
    """
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    type = Column(String(60), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False, server_default="false")

    # Optional navigation target surfaced to the frontend
    link = Column(String(500), nullable=True)

    # For linking to a specific object (project, achievement…)
    related_id   = Column(String(100), nullable=True)
    related_type = Column(String(50), nullable=True)

    # Deduplication: unique per user+key — NULL values are NOT considered duplicates
    # (NULL != NULL in SQL) so only non-null keys participate in dedup.
    dedup_key = Column(String(200), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    user = relationship("User", backref="notifications")
