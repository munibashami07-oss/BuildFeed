"""
Pydantic schemas for the Achievements system (Module 13).
"""
from typing import List, Optional
from pydantic import BaseModel


class AchievementItemResponse(BaseModel):
    """A single achievement entry — catalog metadata + user's current progress."""
    id: str
    name: str
    description: str
    icon: str
    category: str           # 'building' | 'exploration' | 'progression'
    threshold: int
    metric: str
    current_value: int
    progress_percent: int
    is_unlocked: bool
    unlocked_at: Optional[str] = None   # ISO-8601 or None


class AchievementsResponse(BaseModel):
    """Full achievements payload for the authenticated user."""
    achievements: List[AchievementItemResponse]
    total_count: int
    unlocked_count: int
