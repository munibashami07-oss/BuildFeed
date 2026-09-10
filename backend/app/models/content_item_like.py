import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class ContentItemLike(Base):
    """
    Stores one like per (user, content_item) pair.
    Used for the global Like system (Module 22) and the Trending This Week widget.
    """
    __tablename__ = "content_item_likes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("content_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", backref="liked_items")
    content_item = relationship("ContentItem", backref="likes")

    __table_args__ = (
        UniqueConstraint("user_id", "content_item_id", name="uq_content_item_likes_user_item"),
    )
