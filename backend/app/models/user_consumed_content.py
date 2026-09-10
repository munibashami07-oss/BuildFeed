import uuid
from datetime import date, datetime, timezone
from sqlalchemy import Column, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class UserConsumedContent(Base):
    __tablename__ = "user_consumed_content"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content_item_id = Column(UUID(as_uuid=True), ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False, index=True)
    consumed_date = Column(Date, default=date.today, nullable=False, index=True)
    consumed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", backref="consumed_items")
    content_item = relationship("ContentItem", backref="consumed_by_users")

    __table_args__ = (
        UniqueConstraint("user_id", "content_item_id", "consumed_date", name="uq_user_consumed_item_date"),
    )
