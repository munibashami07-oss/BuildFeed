"""
Pydantic schemas for the Portfolio / Showcase system (Module 15).
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class PortfolioUpdateRequest(BaseModel):
    """PATCH body — all fields optional; send only what changed."""
    github_url: Optional[str] = None
    demo_url: Optional[str] = None
    portfolio_summary: Optional[str] = None

    @field_validator("github_url", "demo_url", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        """Treat empty string as None so users can clear URLs."""
        if v == "":
            return None
        return v


class PortfolioEntryResponse(BaseModel):
    """
    Full portfolio entry — project data merged with portfolio metadata.
    Returned for both list and single-item endpoints.
    """
    # Project fields
    project_id: UUID
    title: str
    objective: Optional[str] = None
    description: Optional[str] = None
    difficulty_level: Optional[str] = None
    technologies: List[str] = []
    steps: List[Dict[str, Any]] = []
    progress_percent: int
    status: str
    completed_at: Optional[datetime] = None
    created_at: datetime
    # Source content item (if project was created from saved content)
    content_item_title: Optional[str] = None
    content_item_url: Optional[str] = None

    # Portfolio-specific fields (may be None if no portfolio row yet)
    github_url: Optional[str] = None
    demo_url: Optional[str] = None
    portfolio_summary: Optional[str] = None
    portfolio_updated_at: Optional[datetime] = None

    # Module 16: sharing
    is_public: bool = False
    share_slug: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PortfolioListResponse(BaseModel):
    entries: List[PortfolioEntryResponse]
    total: int


class LinkedInPostResponse(BaseModel):
    """Response for the AI-generated LinkedIn post caption."""
    caption: str
    share_url: str
    has_api_key: bool