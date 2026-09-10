"""
Pydantic schemas for the Settings & Personalization system (Module 20).
"""
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, field_validator


class SettingsUpdateRequest(BaseModel):
    """PATCH body — all fields optional; only provided fields are updated."""

    # Profile
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, max_length=500)

    # Appearance
    theme_preference: Optional[str] = Field(None, pattern=r"^(light|dark)$")

    # Feed preferences
    interests: Optional[List[str]] = None
    experience_level: Optional[str] = None
    skill_levels: Optional[Dict[str, str]] = None
    goals: Optional[List[str]] = None
    feed_content_limit: Optional[int] = Field(None, ge=5, le=50)
    preferred_content_types: Optional[List[str]] = None

    # Notification preferences
    notif_enabled: Optional[bool] = None
    notif_achievements: Optional[bool] = None
    notif_projects: Optional[bool] = None
    notif_content: Optional[bool] = None

    # Privacy
    portfolio_public: Optional[bool] = None

    @field_validator("bio", mode="before")
    @classmethod
    def empty_str_to_none_bio(cls, v):
        return None if v == "" else v

    @field_validator("avatar_url", mode="before")
    @classmethod
    def empty_str_to_none_avatar(cls, v):
        return None if v == "" else v


class SettingsResponse(BaseModel):
    """Full settings snapshot returned to the client — mirrors all configurable User fields."""

    # Identity
    username: str
    email: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    # Appearance
    theme_preference: str

    # Feed preferences
    interests: List[str] = []
    experience_level: Optional[str] = None
    skill_levels: Dict[str, str] = {}
    goals: List[str] = []
    feed_content_limit: int = 10
    preferred_content_types: List[str] = []

    # Notification preferences
    notif_enabled: bool = True
    notif_achievements: bool = True
    notif_projects: bool = True
    notif_content: bool = True

    # Privacy
    portfolio_public: bool = True


class DeleteAccountRequest(BaseModel):
    """Password confirmation required to delete account."""
    password: str = Field(..., min_length=1, description="Current password for confirmation")
