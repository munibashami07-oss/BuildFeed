"""
Progression API — Module 12: XP + Progression System

Endpoints:
  GET  /api/v1/progression        — fetch the authenticated user's progression snapshot
  POST /api/v1/progression/reset  — dev-only: wipe XP for the current user (TEST USE ONLY)
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.progression import ProgressionResponse
from app.services.progression.xp_service import xp_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/progression", tags=["Progression"])


@router.get("", response_model=ProgressionResponse)
def get_my_progression(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the authenticated user's current XP and level progression."""
    data = xp_service.get_progression(db, user_id=current_user.id)
    return ProgressionResponse(**data)


@router.post("/reset", status_code=status.HTTP_200_OK)
def reset_my_progression(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    DEV-ONLY: Reset XP, level, and awarded ID sets for the current user.
    Returns 403 in production (APP_ENV != 'development').
    Useful for manual testing of the progression flow.
    """
    if settings.APP_ENV != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Progression reset is only available in development mode.",
        )

    from app.models.user_progression import UserProgression
    from sqlalchemy.orm.attributes import flag_modified

    prog = xp_service.get_or_create_progression(db, user_id=current_user.id)
    prog.total_xp = 0
    prog.level = 1
    prog.awarded_step_ids = []
    prog.awarded_project_ids = []
    prog.completed_steps_count = 0
    prog.completed_projects_count = 0
    flag_modified(prog, "awarded_step_ids")
    flag_modified(prog, "awarded_project_ids")
    db.commit()

    logger.info("DEV: Progression reset for user %s.", current_user.id)
    return {"message": "Progression reset successfully.", "user_id": str(current_user.id)}
