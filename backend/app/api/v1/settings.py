"""
Settings API — Module 20: Settings & Personalization

Endpoints:
  GET    /api/v1/settings              — fetch all configurable settings for current user
  PATCH  /api/v1/settings              — update any subset of settings
  DELETE /api/v1/settings/account      — delete account (requires password confirmation)
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.settings import SettingsResponse, SettingsUpdateRequest, DeleteAccountRequest
from app.schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])


def utc_now():
    return datetime.now(timezone.utc)


@router.get("", response_model=SettingsResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
):
    """Return all configurable settings for the authenticated user."""
    return SettingsResponse(
        username=current_user.username,
        email=current_user.email,
        bio=current_user.bio,
        avatar_url=current_user.avatar_url,
        theme_preference=current_user.theme_preference,
        interests=current_user.interests or [],
        experience_level=current_user.experience_level,
        skill_levels=current_user.skill_levels or {},
        goals=current_user.goals or [],
        feed_content_limit=current_user.feed_content_limit if current_user.feed_content_limit is not None else 10,
        preferred_content_types=current_user.preferred_content_types or [],
        notif_enabled=current_user.notif_enabled if current_user.notif_enabled is not None else True,
        notif_achievements=current_user.notif_achievements if current_user.notif_achievements is not None else True,
        notif_projects=current_user.notif_projects if current_user.notif_projects is not None else True,
        notif_content=current_user.notif_content if current_user.notif_content is not None else True,
        portfolio_public=current_user.portfolio_public if current_user.portfolio_public is not None else True,
    )


@router.patch("", response_model=SettingsResponse)
def update_settings(
    req: SettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update any subset of user settings. Only provided fields are changed.
    Returns the full updated settings snapshot.
    """
    # Username uniqueness check
    if req.username is not None and req.username != current_user.username:
        existing = db.query(User).filter(User.username == req.username).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken.",
            )
        current_user.username = req.username

    # Profile
    if req.bio is not None:
        current_user.bio = req.bio or None
    if req.avatar_url is not None:
        current_user.avatar_url = req.avatar_url or None

    # Appearance
    if req.theme_preference is not None:
        current_user.theme_preference = req.theme_preference

    # Feed preferences
    if req.interests is not None:
        current_user.interests = req.interests
    if req.experience_level is not None:
        current_user.experience_level = req.experience_level
    if req.skill_levels is not None:
        current_user.skill_levels = req.skill_levels
    if req.goals is not None:
        current_user.goals = req.goals
    if req.feed_content_limit is not None:
        current_user.feed_content_limit = req.feed_content_limit
    if req.preferred_content_types is not None:
        current_user.preferred_content_types = req.preferred_content_types

    # Notification preferences
    if req.notif_enabled is not None:
        current_user.notif_enabled = req.notif_enabled
    if req.notif_achievements is not None:
        current_user.notif_achievements = req.notif_achievements
    if req.notif_projects is not None:
        current_user.notif_projects = req.notif_projects
    if req.notif_content is not None:
        current_user.notif_content = req.notif_content

    # Privacy
    if req.portfolio_public is not None:
        current_user.portfolio_public = req.portfolio_public

    current_user.updated_at = utc_now()
    db.commit()
    db.refresh(current_user)

    logger.info("Settings updated for user %s.", current_user.id)
    return get_settings(current_user)


@router.delete("/account", status_code=status.HTTP_200_OK)
def delete_account(
    req: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Permanently delete the authenticated user's account.
    Requires password confirmation. Cascades to all user data via DB FK constraints.
    """
    if not verify_password(req.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password. Account deletion cancelled.",
        )

    user_id = str(current_user.id)
    db.delete(current_user)
    db.commit()

    logger.warning("Account permanently deleted for user_id=%s.", user_id)
    return {"message": "Account permanently deleted.", "user_id": user_id}


@router.post("/change-password", response_model=dict)
def change_password(
    current_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change password — requires current password for verification."""
    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters.",
        )
    current_user.password_hash = get_password_hash(new_password)
    current_user.updated_at = utc_now()
    db.commit()
    logger.info("Password changed for user %s.", current_user.id)
    return {"message": "Password changed successfully."}
