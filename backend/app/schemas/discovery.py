from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class ContentSourceCreate(BaseModel):
    name: str = Field(..., max_length=255)
    source_type: str = Field(..., max_length=50)  # 'github_trending', 'rss_feed', etc.
    base_url: str = Field(..., max_length=500)
    is_active: bool = True


class ContentSourceResponse(BaseModel):
    id: UUID
    name: str
    source_type: str
    base_url: str
    is_active: bool
    last_fetched_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContentItemResponse(BaseModel):
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
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiscoveryRunResponse(BaseModel):
    sources_processed: int
    items_discovered: int
    items_inserted: int
    duplicates_skipped: int
    errors: List[str] = []
