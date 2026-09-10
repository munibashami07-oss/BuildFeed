import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class ProjectPortfolio(Base):
    """
    Optional 1:1 extension of a Project that holds portfolio-specific metadata.
    A row is created/updated when the user saves portfolio links or a summary.
    Only projects with status='completed' should ever have a row here.

    Module 16 additions:
      is_public   — whether the project is publicly shareable (default False)
      share_slug  — unique URL-safe slug used for the public link (/p/<slug>)
    """
    __tablename__ = "project_portfolio"

    # project_id is both PK and FK — true 1:1 relationship
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )

    github_url = Column(String(500), nullable=True)
    demo_url = Column(String(500), nullable=True)
    # User-written showcase summary (may differ from project.description)
    portfolio_summary = Column(Text, nullable=True)

    # Module 16: public sharing
    is_public = Column(Boolean, nullable=False, default=False, server_default="false")
    share_slug = Column(String(80), nullable=True, unique=True, index=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    project = relationship("Project", backref=backref("portfolio", uselist=False), uselist=False)