"""
Dashboard API — Module 17: Activity & Progress Dashboard

Endpoints:
  GET /api/v1/dashboard          — full aggregated dashboard payload
  GET /api/v1/dashboard/activity — activity timeline only (lightweight refresh)
"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.dashboard import (
    DashboardResponse,
    ActivityEvent,
    InProgressProject,
    RecentAchievement,
    FocusStatusSummary,
)
from app.services.dashboard.dashboard_service import dashboard_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the full personalized dashboard payload for the authenticated user.

    Aggregates from: UserProgression, Project, SavedContent, UserAchievement,
    UserConsumedContent (today). No additional DB tables are created.
    All data is strictly scoped to the authenticated user.
    """
    data = dashboard_service.get_dashboard(db, user_id=current_user.id)

    return DashboardResponse(
        total_xp=data["total_xp"],
        level=data["level"],
        level_title=data["level_title"],
        xp_in_current_level=data["xp_in_current_level"],
        xp_for_current_level_span=data["xp_for_current_level_span"],
        xp_to_next_level=data["xp_to_next_level"],
        level_progress_percent=data["level_progress_percent"],
        is_max_level=data["is_max_level"],
        projects_completed=data["projects_completed"],
        projects_in_progress=data["projects_in_progress"],
        completed_steps_count=data["completed_steps_count"],
        saved_count=data["saved_count"],
        achievements_unlocked=data["achievements_unlocked"],
        achievements_total=data["achievements_total"],
        focus=FocusStatusSummary(**data["focus"]),
        in_progress_projects=[InProgressProject(**p) for p in data["in_progress_projects"]],
        recent_achievements=[RecentAchievement(**a) for a in data["recent_achievements"]],
        activity=[ActivityEvent(**e) for e in data["activity"]],
    )


@router.get("/activity", response_model=list[ActivityEvent])
def get_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the activity timeline only — lighter endpoint for real-time refresh
    without refetching the full dashboard payload.
    """
    data = dashboard_service.get_dashboard(db, user_id=current_user.id)
    return [ActivityEvent(**e) for e in data["activity"]]
