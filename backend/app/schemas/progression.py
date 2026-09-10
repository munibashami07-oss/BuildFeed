"""
Pydantic schemas for the XP / Progression system (Module 12).
"""
from typing import List, Optional
from pydantic import BaseModel


class ProgressionResponse(BaseModel):
    """Full progression snapshot returned to the client."""
    total_xp: int
    level: int
    level_title: str
    xp_in_current_level: int
    xp_for_current_level_span: int
    xp_to_next_level: int
    level_progress_percent: int
    completed_steps_count: int
    completed_projects_count: int
    is_max_level: bool


class XPEventResponse(BaseModel):
    """Returned alongside a project/step update whenever XP may have been awarded."""
    xp_earned: int
    already_awarded: bool
    levelled_up: bool
    new_level: Optional[int] = None
    # Module 13: list of achievement IDs newly unlocked in this event
    newly_unlocked_achievements: List[str] = []
    progression: ProgressionResponse


class ProjectWithXPResponse(BaseModel):
    """
    Envelope used by the step-toggle and project-complete endpoints so the
    frontend can update project state, XP state, and achievements in a single
    round-trip.
    """
    project: dict
    xp_event: XPEventResponse
