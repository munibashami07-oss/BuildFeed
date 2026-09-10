from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.discovery import ContentItemResponse


class SavedContentItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    content_item_id: UUID
    created_at: datetime
    content_item: ContentItemResponse

    model_config = ConfigDict(from_attributes=True)


class SavedItemsResponse(BaseModel):
    items: List[ContentItemResponse]
    total: int
    page: int
    limit: int
    has_more: bool


class SavedItemIdsResponse(BaseModel):
    saved_item_ids: List[UUID]
