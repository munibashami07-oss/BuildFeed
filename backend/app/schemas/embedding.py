from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from app.schemas.discovery import ContentItemResponse


class EmbeddingBatchResponse(BaseModel):
    total_items: int
    completed: int
    failed: int
    errors: List[str] = []


class EmbeddingStatusSummary(BaseModel):
    pending: int
    processing: int
    completed: int
    failed: int
    total: int


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Search query string")
    content_type: Optional[str] = Field(None, description="Optional filter by content_type (article, github_repo, etc.)")
    limit: int = Field(10, ge=1, le=50, description="Max number of results")


class SemanticSearchResultItem(BaseModel):
    item: ContentItemResponse
    similarity_score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
