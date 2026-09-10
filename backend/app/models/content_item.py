import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, JSON, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class ContentItem(Base):
    __tablename__ = "content_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    source_id = Column(UUID(as_uuid=True), ForeignKey("content_sources.id", ondelete="CASCADE"), nullable=False, index=True)
    external_id = Column(String(255), nullable=False, index=True)
    content_type = Column(String(50), nullable=False, index=True)  # 'article', 'image', 'video', 'github_repo', 'research_paper', 'ai_tool'
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    source_url = Column(String(1000), nullable=False, index=True)
    author = Column(String(255), nullable=True)
    thumbnail_url = Column(String(1000), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True, index=True)
    discovered_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    raw_metadata = Column(JSON, default=dict, nullable=False)
    
    # Status & AI Processing metadata (Module 4)
    status = Column(String(50), default="discovered", nullable=False)  # 'discovered'/'pending', 'processing', 'completed', 'failed'
    ai_metadata = Column(JSON, nullable=True)
    processing_error = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Embeddings & Vector Search (Module 5)
    embedding = Column(JSON, nullable=True)  # Stores array of 1536 float values
    embedding_status = Column(String(50), default="pending", nullable=False)  # 'pending', 'processing', 'completed', 'failed'
    embedding_error = Column(Text, nullable=True)
    embedded_at = Column(DateTime(timezone=True), nullable=True)

    # Content Quality & Moderation (Module 21)
    quality_status = Column(String(50), default="pending", nullable=False, index=True)
    quality_issues = Column(JSON, nullable=True)
    quality_score = Column(JSON, nullable=True)
    quality_checked_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    source = relationship("ContentSource", backref="items")

    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_content_items_source_external"),
        Index("idx_content_items_feed_filter", "quality_status", "content_type", "discovered_at"),
    )
