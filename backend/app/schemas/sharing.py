"""
Pydantic schemas for the Project Sharing system (Module 16).
"""
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class PublishResponse(BaseModel):
    """Returned after publish or unpublish actions."""
    project_id: UUID
    is_public: bool
    share_slug: Optional[str] = None
    share_url: Optional[str] = None    # absolute URL for copy-link (built by API layer)


class PublicProjectStep(BaseModel):
    id: str
    title: str
    is_completed: bool


class PublicProjectResponse(BaseModel):
    """
    Public-facing project showcase data.
    Only information safe for unauthenticated viewers is included.
    user_id and private internal IDs are intentionally omitted.
    """
    share_slug: str
    title: str
    objective: Optional[str] = None
    description: Optional[str] = None
    difficulty_level: Optional[str] = None
    technologies: List[str] = []
    steps: List[PublicProjectStep] = []
    progress_percent: int
    completed_at: Optional[datetime] = None
    # Portfolio extras
    portfolio_summary: Optional[str] = None
    github_url: Optional[str] = None
    demo_url: Optional[str] = None
    # Source content item attribution (title only — no internal IDs)
    inspired_by: Optional[str] = None
