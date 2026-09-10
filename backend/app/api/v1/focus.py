from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.focus_gate import (
    FocusGateStatusResponse,
    ConsumeItemResponse,
    ProjectSuggestionRequest,
    ProjectSuggestionResponse,
)
from app.services.focus.focus_gate_service import focus_gate_service

router = APIRouter(prefix="/focus", tags=["Focus Gate"])


@router.get("/status", response_model=FocusGateStatusResponse)
def get_focus_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's daily Focus Gate consumption status."""
    st = focus_gate_service.get_focus_gate_status(db, user_id=current_user.id)
    return FocusGateStatusResponse(**st)


@router.post("/consume/{item_id}", response_model=ConsumeItemResponse)
def consume_content_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record consumption of a content item by the current user."""
    try:
        res = focus_gate_service.consume_item(db, user_id=current_user.id, item_id=item_id)
        return ConsumeItemResponse(**res)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.post("/unlock", response_model=FocusGateStatusResponse)
def unlock_focus_feed(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unlock current user's feed for today (clears consumption count for dev / project completion)."""
    st = focus_gate_service.unlock_feed_for_today(db, user_id=current_user.id)
    return FocusGateStatusResponse(**st)


@router.post("/suggest-project", response_model=ProjectSuggestionResponse)
def generate_project_suggestion(
    req: ProjectSuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate an AI project suggestion based on a saved content item."""
    try:
        return focus_gate_service.generate_project_suggestion(
            db, user_id=current_user.id, item_id=req.item_id, exclude_titles=req.exclude_titles
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
