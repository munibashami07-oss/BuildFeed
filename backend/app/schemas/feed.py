from typing import List, Optional, Any, Dict
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.discovery import ContentItemResponse


class FeedItemResponse(BaseModel):
    id: UUID
    source_id: UUID
    external_id: str
    content_type: str
    title: str
    description: Optional[str] = None
    source_url: str
    author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    published_at: Optional[datetime] = None
    discovered_at: datetime
    raw_metadata: Dict[str, Any] = {}
    status: str
    ai_metadata: Optional[Dict[str, Any]] = None
    embedding_status: str
    created_at: datetime
    updated_at: datetime

    # Feed personalization extra fields
    score: float = Field(0.0, description="Personalized recommendation score")
    recommendation_reason: str = Field("Featured in your builder topics", description="Why this item was recommended")

    # Like system (Module 22)
    like_count: int = Field(0, description="Total number of likes from all users")
    is_liked: bool = Field(False, description="Whether the current user has liked this item")

    model_config = ConfigDict(from_attributes=True)


class FeedResponse(BaseModel):
    items: List[FeedItemResponse]
    total: int
    page: int
    limit: int
    has_more: bool
