"""
Achievements API — Module 13: Achievements & Milestones

Endpoints:
  GET  /api/v1/achievements   — fetch all achievements with progress for the current user
"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.achievement import AchievementsResponse, AchievementItemResponse
from app.services.achievements.achievement_service import achievement_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/achievements", tags=["Achievements"])


@router.get("", response_model=AchievementsResponse)
def get_my_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all achievements (locked and unlocked) with progress for the authenticated user."""
    items = achievement_service.get_user_achievements(db, user_id=current_user.id)
    unlocked_count = sum(1 for a in items if a["is_unlocked"])
    return AchievementsResponse(
        achievements=[AchievementItemResponse(**item) for item in items],
        total_count=len(items),
        unlocked_count=unlocked_count,
    )
