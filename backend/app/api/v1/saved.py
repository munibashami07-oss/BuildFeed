from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.discovery import ContentItemResponse
from app.schemas.saved import SavedItemsResponse, SavedItemIdsResponse
from app.services.saved.saved_service import saved_content_service

router = APIRouter(prefix="/saved", tags=["Saved Content"])


@router.get("", response_model=SavedItemsResponse)
def get_user_saved_content(
    content_type: Optional[str] = Query(None, description="Filter by content_type"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get authenticated user's saved content items."""
    items, total = saved_content_service.get_user_saved_items(
        db,
        user_id=current_user.id,
        content_type=content_type,
        limit=limit,
        offset=offset,
    )
    has_more = (offset + limit) < total
    page = (offset // limit) + 1 if limit > 0 else 1

    item_responses = [ContentItemResponse.model_validate(item) for item in items]
    return SavedItemsResponse(
        items=item_responses,
        total=total,
        page=page,
        limit=limit,
        has_more=has_more,
    )


@router.get("/ids", response_model=SavedItemIdsResponse)
def get_user_saved_item_ids(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get array of all content item UUIDs saved by the current user."""
    item_ids = saved_content_service.get_user_saved_item_ids(db, user_id=current_user.id)
    return SavedItemIdsResponse(saved_item_ids=item_ids)


@router.get("/check/{item_id}")
def check_item_is_saved(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if a specific content item is saved by the current user."""
    is_saved = saved_content_service.is_item_saved(db, user_id=current_user.id, item_id=item_id)
    return {"item_id": item_id, "is_saved": is_saved}


@router.post("/{item_id}")
def save_content_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save/bookmark a content item for the current user."""
    try:
        saved_record = saved_content_service.save_item(db, user_id=current_user.id, item_id=item_id)
        return {"status": "saved", "id": saved_record.id, "item_id": item_id}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.delete("/{item_id}")
def unsave_content_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unsave/remove bookmark for a content item for the current user."""
    removed = saved_content_service.unsave_item(db, user_id=current_user.id, item_id=item_id)
    return {"status": "unsaved" if removed else "not_found", "item_id": item_id}
