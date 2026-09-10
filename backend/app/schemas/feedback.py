from typing import Dict, Literal, Optional
from pydantic import BaseModel, Field


class FeedItemFeedbackRequest(BaseModel):
    feedback_type: Literal["too_easy", "too_hard", "irrelevant", "dismiss"] = Field(
        ...,
        description="Type of feedback: too_easy, too_hard, irrelevant, or dismiss"
    )
    reason: Optional[str] = Field(None, max_length=500, description="Optional explanation or context")


class FeedItemFeedbackResponse(BaseModel):
    status: str = "success"
    message: str
    feedback_type: str
    updated_skill_levels: Dict[str, str] = {}
