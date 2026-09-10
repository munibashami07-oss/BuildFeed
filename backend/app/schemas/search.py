"""
Pydantic schemas for the Global Search system (Module 18).
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class SearchResultItem(BaseModel):
    """A single search result — ContentItem fields + search-specific enrichment."""
    # Core ContentItem fields
    id: UUID
    content_type: str
    title: str
    description: Optional[str] = None
    source_url: str
    author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    published_at: Optional[datetime] = None
    discovered_at: datetime
    # AI metadata flattened for easy frontend access
    ai_metadata: Optional[Dict[str, Any]] = None
    # Search-specific
    similarity_score: float = 0.0    # 0.0 for pure text matches, cosine sim for semantic
    match_type: str = "text"          # "text" | "semantic" | "hybrid"
    # Personalisation
    interest_boost: bool = False      # True if result matches user's saved interests
    # Saved state for the requesting user
    is_saved: bool = False

    model_config = ConfigDict(from_attributes=True)


class SearchResponse(BaseModel):
    results: List[SearchResultItem]
    total: int
    query: str
    content_type_filter: Optional[str] = None
    has_more: bool
    used_semantic: bool    # whether semantic search was attempted (requires embeddings + API key)
