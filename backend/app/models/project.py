import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content_item_id = Column(UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    objective = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    difficulty_level = Column(String(50), nullable=True, default="Intermediate")
    technologies = Column(JSON, nullable=True, default=list)
    steps = Column(JSON, nullable=False, default=list)

    status = Column(String(50), nullable=False, default="in_progress", index=True)
    progress_percent = Column(Integer, nullable=False, default=0)

    # GitHub repo auto-created on first "Build This" click
    github_repo_url = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", backref="projects")
    content_item = relationship("ContentItem", backref="projects")
