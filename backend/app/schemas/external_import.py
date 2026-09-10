from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ExternalImportRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2000)


class ExternalProjectPlan(BaseModel):
    project_title: str
    what_the_project_is: str
    required_skills: List[str]
    technologies: List[str]
    difficulty_level: str
    estimated_effort: str
    implementation_steps: List[str]
    suggested_milestones: List[str]
    objective: str
    description: str


class ExternalImportResponse(BaseModel):
    item_id: UUID
    title: str
    description: Optional[str] = None
    source_url: str
    content_type: str
    author: Optional[str] = None
    metadata: Dict[str, Any] = {}
    analysis: Dict[str, Any]
    project_plan: ExternalProjectPlan
    is_saved: bool = False


class ExternalImportSaveResponse(BaseModel):
    status: str
    item_id: UUID
    saved_id: UUID
    title: str
    source_url: str
