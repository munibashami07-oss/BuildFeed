from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    is_active: bool
    interests: List[str] = []
    experience_level: Optional[str] = None
    skill_levels: Dict[str, str] = {}
    goals: List[str] = []
    onboarding_completed: bool = False
    theme_preference: str = "light"
    # Module 20: extended profile
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    # Module 20: feed preferences
    feed_content_limit: int = 10
    preferred_content_types: List[str] = []
    # Module 20: notification preferences
    notif_enabled: bool = True
    notif_achievements: bool = True
    notif_projects: bool = True
    notif_content: bool = True
    # Module 20: privacy
    portfolio_public: bool = True
    # GitHub integration
    github_username: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str


class VerifyTokenResponse(BaseModel):
    valid: bool
    email: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=100)


class OnboardingRequest(BaseModel):
    interests: List[str] = Field(..., description="Selected interests")
    experience_level: str = Field(..., description="Beginner, Intermediate, or Advanced")
    goals: List[str] = Field(..., description="Selected goals")
    skill_levels: Optional[Dict[str, str]] = Field(default_factory=dict, description="Per-skill experience levels")


class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    interests: Optional[List[str]] = None
    experience_level: Optional[str] = None
    skill_levels: Optional[Dict[str, str]] = None
    goals: Optional[List[str]] = None
    theme_preference: Optional[str] = Field(None, pattern=r"^(light|dark)$")
