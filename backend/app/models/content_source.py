import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class ContentSource(Base):
    __tablename__ = "content_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False)  # 'github_trending', 'rss_feed', etc.
    base_url = Column(String(500), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_fetched_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
