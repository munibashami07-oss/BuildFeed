import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class UserProgression(Base):
    """Per-user XP and level tracking. One row per user, auto-created on first XP event."""
    __tablename__ = "user_progression"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    total_xp = Column(Integer, nullable=False, default=0)
    level = Column(Integer, nullable=False, default=1)

    # JSON sets of project/step IDs that have already been awarded XP — prevents double-award
    awarded_step_ids = Column(JSON, nullable=False, default=list)
    awarded_project_ids = Column(JSON, nullable=False, default=list)

    # Denormalized counters for fast reads
    completed_steps_count = Column(Integer, nullable=False, default=0)
    completed_projects_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", backref="progression", uselist=False)
