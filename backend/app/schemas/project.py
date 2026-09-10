from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.discovery import ContentItemResponse


class ProjectStep(BaseModel):
    id: str
    title: str
    is_completed: bool = False
    completed_at: Optional[datetime] = None


class ProjectCreateRequest(BaseModel):
    title: str
    objective: Optional[str] = None
    description: Optional[str] = None
    difficulty_level: Optional[str] = "Intermediate"
    technologies: Optional[List[str]] = None
    steps: Optional[List[str]] = None
    content_item_id: Optional[UUID] = None


class ProjectUpdateRequest(BaseModel):
    title: Optional[str] = None
    objective: Optional[str] = None
    description: Optional[str] = None
    difficulty_level: Optional[str] = None
    technologies: Optional[List[str]] = None


class ProjectResponse(BaseModel):
    id: UUID
    user_id: UUID
    content_item_id: Optional[UUID] = None
    title: str
    objective: Optional[str] = None
    description: Optional[str] = None
    difficulty_level: Optional[str] = "Intermediate"
    technologies: List[str] = []
    steps: List[Dict[str, Any]] = []
    status: str
    progress_percent: int
    github_repo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    content_item: Optional[ContentItemResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
    in_progress_count: int
    completed_count: int


class StepResourceItem(BaseModel):
    id: Optional[str] = None
    title: str
    url: str
    content_type: str
    source_name: Optional[str] = None
    short_summary: str
    difficulty_level: Optional[str] = None
    relevance_reason: str


class StepResourceGuideResponse(BaseModel):
    project_id: UUID
    project_title: str
    step_id: str
    step_title: str
    phase: str
    key_concepts: List[str] = []
    implementation_tips: List[str] = []
    common_pitfalls: List[str] = []
    recommended_libraries: List[str] = []
    resources: List[StepResourceItem] = []

