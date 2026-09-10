"""
Pydantic schemas for the Activity & Progress Dashboard (Module 17).
"""
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel


# ── Activity timeline ─────────────────────────────────────────────────────────

class ActivityEvent(BaseModel):
    """A single event in the user's activity timeline."""
    event_type: str          # 'project_completed' | 'project_started' | 'achievement_unlocked'
                             # | 'xp_earned' | 'content_saved' | 'level_up'
    title: str               # Human-readable summary line
    detail: Optional[str] = None   # Secondary detail (e.g. "+100 XP", achievement description)
    icon: str                # lucide-react icon name
    timestamp: datetime
    # Optional link target so the frontend can make the event clickable
    link: Optional[str] = None     # e.g. "/projects/<id>", "/profile"


# ── Progress summary ──────────────────────────────────────────────────────────

class InProgressProject(BaseModel):
    """Lightweight project snapshot for the dashboard — no full step list."""
    id: str
    title: str
    progress_percent: int
    difficulty_level: Optional[str] = None
    technologies: List[str] = []
    updated_at: datetime


class RecentAchievement(BaseModel):
    """Recently unlocked achievement shown in the preview strip."""
    id: str
    name: str
    description: str
    icon: str
    category: str
    unlocked_at: datetime


class FocusStatusSummary(BaseModel):
    consumed_today: int
    limit: int
    remaining: int
    is_locked: bool


# ── Main dashboard response ───────────────────────────────────────────────────

class DashboardResponse(BaseModel):
    """
    Single-shot aggregated response for the dashboard page.
    All data belongs to the authenticated user — user_id is never returned.
    """
    # XP / Progression
    total_xp: int
    level: int
    level_title: str
    xp_in_current_level: int
    xp_for_current_level_span: int
    xp_to_next_level: int
    level_progress_percent: int
    is_max_level: bool

    # Project counts
    projects_completed: int
    projects_in_progress: int
    completed_steps_count: int

    # Saved content
    saved_count: int

    # Achievements
    achievements_unlocked: int
    achievements_total: int

    # Focus Gate (today)
    focus: FocusStatusSummary

    # Detail lists
    in_progress_projects: List[InProgressProject]   # up to 3, most-recently updated
    recent_achievements: List[RecentAchievement]    # up to 4 most recent
    activity: List[ActivityEvent]                   # up to 15 most recent events
