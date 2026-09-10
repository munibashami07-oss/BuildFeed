from typing import List, Optional
from uuid import UUID
from datetime import date
from pydantic import BaseModel, ConfigDict


class FocusGateStatusResponse(BaseModel):
    limit: int
    consumed_today: int
    is_locked: bool
    consumed_date: str
    remaining: int

    model_config = ConfigDict(from_attributes=True)


class ConsumeItemResponse(BaseModel):
    consumed_today: int
    limit: int
    is_locked: bool
    item_id: UUID
    already_consumed_today: bool


class ProjectSuggestionRequest(BaseModel):
    item_id: UUID
    # When the user hits "Refresh Idea", we send back the title(s) already shown
    # so the model is nudged toward a genuinely different suggestion instead of
    # repeating (or barely rewording) the previous one.
    exclude_titles: Optional[List[str]] = None


class ProjectSuggestionResponse(BaseModel):
    # "project_idea"       -> the saved content already describes a buildable project
    # "learning_resource"  -> the content teaches a concept/skill; it is not itself a project
    # "tool_or_library"    -> the content is a tool/library/API meant to be used inside a project
    content_classification: str
    # One or two plain-English sentences telling the user what kind of content this is
    # and why, e.g. "This is a tutorial on X, so we've spun off a project idea that
    # applies what it teaches."
    classification_note: str
    project_title: str
    # Plain-language answer to "what am I actually going to have at the end of this?" —
    # names the concrete artifact (CLI tool, web app, API, bot, etc.) and its behavior.
    what_you_are_building: str
    objective: str
    description: str
    technologies: List[str]
    # Realistic, project-specific implementation steps. Length is NOT fixed —
    # it reflects the actual scope of the project (can be as few as 3 or well over 8).
    basic_steps: List[str]
    # Only populated when content_classification == "tool_or_library": explains
    # concretely how/where the tool fits into the suggested project.
    usage_note: Optional[str] = None
    based_on_item_title: str
    based_on_item_id: UUID


class ExternalProjectPlanResponse(BaseModel):
    project_title: str
    what_the_project_is: str
    required_skills: List[str]
    technologies: List[str]
    difficulty_level: str
    estimated_effort: str
    implementation_steps: List[str]
    suggested_milestones: List[str]
    objective: str
    description: str
