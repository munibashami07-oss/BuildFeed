from typing import Optional, List, Any, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectUpdateRequest,
    ProjectResponse,
    ProjectListResponse,
    StepResourceGuideResponse,
)
from app.schemas.progression import ProjectWithXPResponse, XPEventResponse, ProgressionResponse
from app.services.project.project_service import project_service
from app.core.security import create_access_token
from app.core.config import settings
from jose import jwt
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/projects", tags=["Projects Workspace"])


def _build_project_with_xp(project, xp_event: Dict[str, Any]) -> ProjectWithXPResponse:
    """Assemble the ProjectWithXPResponse envelope from a (project, xp_event) pair."""
    progression_data = xp_event.get("progression", {})
    xp_resp = XPEventResponse(
        xp_earned=xp_event.get("xp_earned", 0),
        already_awarded=xp_event.get("already_awarded", True),
        levelled_up=xp_event.get("levelled_up", False),
        new_level=xp_event.get("new_level"),
        newly_unlocked_achievements=xp_event.get("newly_unlocked_achievements", []),
        progression=ProgressionResponse(**progression_data),
    )
    return ProjectWithXPResponse(
        project=ProjectResponse.model_validate(project).model_dump(mode="json"),
        xp_event=xp_resp,
    )


@router.get("/by-saved/{item_id}")
def get_build_state(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return whether this saved idea already has a project workspace.

    Existing in-progress/completed projects bypass the new Build This choice and
    simply open their current workspace.
    """
    project = project_service.get_project_for_saved_item(db, user_id=current_user.id, item_id=item_id)
    return {"exists": project is not None, "project": ProjectResponse.model_validate(project) if project else None}


@router.post("/create-from-saved/{item_id}", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project_from_saved_item(
    item_id: UUID,
    create_github_repo: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project workspace, optionally creating its GitHub repo.

    The default is deliberately GitHub-free. This preserves the existing project
    creation behavior while making repository creation an explicit user choice.
    """
    try:
        existing = project_service.get_project_for_saved_item(db, user_id=current_user.id, item_id=item_id)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This saved idea already has a project workspace.")
        project = project_service.create_project_from_saved(db, user_id=current_user.id, item_id=item_id)
        if create_github_repo:
            project = project_service.ensure_github_repo(db, user=current_user, project=project)
        return project
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.get("/build-from-saved/{item_id}/github-authorize")
def get_github_build_authorize_url(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a signed GitHub OAuth URL for a new Build This action."""
    if project_service.get_project_for_saved_item(db, user_id=current_user.id, item_id=item_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This saved idea already has a project workspace.")

    state_payload = {
        "purpose": "project_build",
        "user_id": str(current_user.id),
        "item_id": str(item_id),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    state = jwt.encode(state_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return {"github_authorize_url": project_service.get_github_authorize_url(state)}


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_custom_project(
    req: ProjectCreateRequest,
    create_github_repo: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new custom project workspace.

    Used both for fully manual projects and for confirming an AI-generated
    suggestion the user already reviewed (title/objective/steps are passed
    through as-is instead of being regenerated), so what the user saw and
    what gets saved always match.
    """
    project = project_service.create_project(db, user_id=current_user.id, req=req)
    if create_github_repo:
        project = project_service.ensure_github_repo(db, user=current_user, project=project)
    return project


@router.get("", response_model=ProjectListResponse)
def get_user_projects(
    status_filter: Optional[str] = Query("all", alias="status", description="Filter by status (all, in_progress, completed)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all project workspaces belonging to the authenticated user."""
    projects, in_progress_count, completed_count = project_service.get_user_projects(
        db, user_id=current_user.id, status=status_filter
    )
    return ProjectListResponse(
        projects=[ProjectResponse.model_validate(p) for p in projects],
        total=len(projects),
        in_progress_count=in_progress_count,
        completed_count=completed_count,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_by_id(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get project workspace details by ID."""
    try:
        project = project_service.get_user_project_by_id(db, user_id=current_user.id, project_id=project_id)
        return ProjectResponse.model_validate(project)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    req: ProjectUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit project title, objective, description, or tech stack."""
    try:
        project = project_service.update_project(db, user_id=current_user.id, project_id=project_id, req=req)
        return ProjectResponse.model_validate(project)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.patch("/{project_id}/steps/{step_id}", response_model=ProjectWithXPResponse)
def toggle_project_step(
    project_id: UUID,
    step_id: str,
    is_completed: bool = Query(..., description="Set to true to complete step, false to uncomplete"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle completion status of a project step. Returns project state + XP event + newly unlocked achievements."""
    try:
        project, xp_event = project_service.toggle_project_step(
            db, user_id=current_user.id, project_id=project_id, step_id=step_id, is_completed=is_completed
        )
        return _build_project_with_xp(project, xp_event)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.post("/{project_id}/complete", response_model=ProjectWithXPResponse)
def mark_project_complete(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark project complete (100% progress). Returns project state + XP event + newly unlocked achievements."""
    try:
        project, xp_event = project_service.mark_project_completed(db, user_id=current_user.id, project_id=project_id)
        return _build_project_with_xp(project, xp_event)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.get("/{project_id}/learning-quiz")
def get_project_learning_quiz(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate 8 difficult MCQs based on the completed project to assess
    the user's true technical understanding of the build.
    """
    try:
        return project_service.get_project_learning_quiz(
            db, user_id=current_user.id, project_id=project_id
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.get("/{project_id}/steps/{step_id}/resources", response_model=StepResourceGuideResponse)
def get_project_step_resources(
    project_id: UUID,
    step_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    On-demand Just-In-Time discovery of tailored guides, key concepts, code patterns,
    common pitfalls, and curated resources for a specific project milestone step.
    """
    try:
        return project_service.get_step_resources(
            db, user_id=current_user.id, project_id=project_id, step_id=step_id
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.delete("/{project_id}")
def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a project workspace."""
    try:
        project_service.delete_project(db, user_id=current_user.id, project_id=project_id)
        return {"status": "deleted", "project_id": project_id}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))

