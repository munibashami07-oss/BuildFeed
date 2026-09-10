import logging
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.saved_content import SavedContent
from app.models.content_item import ContentItem

logger = logging.getLogger(__name__)


class SavedContentService:
    def save_item(self, db: Session, user_id: UUID, item_id: UUID) -> SavedContent:
        """Bookmark a content item for a user. Prevents duplicate saves gracefully."""
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item:
            raise ValueError(f"ContentItem {item_id} not found.")

        existing = (
            db.query(SavedContent)
            .filter(SavedContent.user_id == user_id, SavedContent.content_item_id == item_id)
            .first()
        )
        if existing:
            logger.info("ContentItem %s already saved by user %s. Returning existing record.", item_id, user_id)
            return existing

        saved_record = SavedContent(user_id=user_id, content_item_id=item_id)
        db.add(saved_record)
        db.commit()
        db.refresh(saved_record)
        return saved_record

    def unsave_item(self, db: Session, user_id: UUID, item_id: UUID) -> bool:
        """Remove bookmark for a user."""
        record = (
            db.query(SavedContent)
            .filter(SavedContent.user_id == user_id, SavedContent.content_item_id == item_id)
            .first()
        )
        if not record:
            return False

        db.delete(record)
        db.commit()
        return True

    def get_user_saved_items(
        self,
        db: Session,
        user_id: UUID,
        content_type: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Tuple[List[ContentItem], int]:
        """Query user's saved items with optional content_type filter and pagination."""
        query = (
            db.query(ContentItem)
            .join(SavedContent, SavedContent.content_item_id == ContentItem.id)
            .filter(SavedContent.user_id == user_id)
        )

        if content_type:
            from app.services.feed.feed_service import normalize_content_type
            target_types = normalize_content_type(content_type)
            if target_types:
                query = query.filter(ContentItem.content_type.in_(target_types))

        total = query.count()
        items = query.order_by(SavedContent.created_at.desc()).offset(offset).limit(limit).all()
        return items, total

    def get_user_saved_item_ids(self, db: Session, user_id: UUID) -> List[UUID]:
        """Get set of all content_item_ids saved by user for fast frontend state syncing."""
        records = (
            db.query(SavedContent.content_item_id)
            .filter(SavedContent.user_id == user_id)
            .all()
        )
        return [r[0] for r in records]

    def is_item_saved(self, db: Session, user_id: UUID, item_id: UUID) -> bool:
        """Check if single item is saved by user."""
        count = (
            db.query(SavedContent)
            .filter(SavedContent.user_id == user_id, SavedContent.content_item_id == item_id)
            .count()
        )
        return count > 0


saved_content_service = SavedContentService()
