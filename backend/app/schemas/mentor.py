"""
Pydantic schemas for the AI Project Mentor (Module 14).
"""
from typing import List, Literal
from pydantic import BaseModel, Field


class MentorMessage(BaseModel):
    """A single turn in the conversation history."""
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class MentorChatRequest(BaseModel):
    """
    The client sends the full conversation history with every request.
    The backend prepends the project-context system prompt server-side.
    """
    messages: List[MentorMessage] = Field(
        ...,
        min_length=1,
        max_length=40,           # cap history depth to control token usage
        description="Full conversation history, newest message last.",
    )


class MentorChatResponse(BaseModel):
    """The mentor's reply for this turn."""
    reply: str
    has_api_key: bool            # lets the frontend show a config notice if False
