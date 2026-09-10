from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.feed import FeedResponse
from app.schemas.feedback import FeedItemFeedbackRequest, FeedItemFeedbackResponse
from app.services.feed.feed_service import feed_service
from app.services.focus.focus_gate_service import focus_gate_service
from app.services.discovery.discovery_scheduler import discovery_scheduler

router = APIRouter(prefix="/feed", tags=["Discovery Feed"])


@router.get("/for-you", response_model=FeedResponse)
def get_for_you_feed(
    content_type: Optional[str] = Query(None, description="Optional filter by content_type (article, github_repo, research_paper, ai_tool)"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    seed: Optional[int] = Query(None, description="Optional seed for recommendation jitter"),
    refresh: bool = Query(False, description="User requested a feed refresh; still respects the 12-hour discovery guard"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve personalized 'For You' discovery feed for the authenticated user. Enforces Focus Gate limits."""
    gate_status = focus_gate_service.get_focus_gate_status(db, user_id=current_user.id)
    if gate_status["is_locked"]:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Focus Gate active: daily content limit ({gate_status['limit']}) reached. Select a saved idea to start building!",
        )

    # Normal page loads and the existing Refresh Feed button use the same stale-feed guard.
    # The refresh flag never bypasses the 12-hour limit; it simply makes the user's intent
    # explicit to the existing backend discovery pipeline.
    discovery_scheduler.ensure_fresh_for_user(
        db,
        user=current_user,
        force_request=refresh,
    )

    return feed_service.get_personalized_feed(
        db,
        user=current_user,
        content_type=content_type,
        limit=limit,
        offset=offset,
        seed=seed,
    )


@router.post("/{item_id}/feedback", response_model=FeedItemFeedbackResponse)
def submit_feed_item_feedback(
    item_id: UUID,
    payload: FeedItemFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Record granular user feedback (too_easy, too_hard, irrelevant, dismiss)
    and dynamically update technology skill proficiencies and feed suppression.
    """
    return feed_service.record_user_feedback(
        db=db,
        user=current_user,
        item_id=item_id,
        feedback_type=payload.feedback_type,
        reason=payload.reason,
    )
