"""Schemas for Module 22 – Like System & Trending."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LikeResponse(BaseModel):
    """Returned after a successful like or unlike."""
    item_id: UUID
    is_liked: bool
    like_count: int


class LikeCountsRequest(BaseModel):
    """Request body for bulk like-count lookup."""
    item_ids: List[UUID]


class LikeCountsResponse(BaseModel):
    """Bulk like counts keyed by item_id string."""
    counts: Dict[str, int]    # {str(item_id): count}
    liked_ids: List[str]      # item_ids the current user has liked


class TrendingItem(BaseModel):
    """A single entry in the Trending This Week widget."""
    rank: int
    item_id: UUID
    title: str
    content_type: str
    source_url: str
    author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    like_count: int
    ai_metadata: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class TrendingResponse(BaseModel):
    """Ordered list of top-liked content items for the Trending widget."""
    items: List[TrendingItem]
    window_days: int
