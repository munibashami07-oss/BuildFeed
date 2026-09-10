"""
Mentor API — Module 14: AI Project Mentor

Endpoint:
  POST /api/v1/projects/{project_id}/mentor/chat

The endpoint is scoped to a project so:
  • User isolation is enforced by project_service.get_user_project_by_id
  • The mentor always receives live, up-to-date project context
  • No separate authentication scheme is needed
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.mentor import MentorChatRequest, MentorChatResponse
from app.services.mentor.mentor_service import mentor_service

logger = logging.getLogger(__name__)

# Prefix is intentionally empty — this router is mounted under /projects in router.py
router = APIRouter(tags=["AI Mentor"])


@router.post("/{project_id}/mentor/chat", response_model=MentorChatResponse)
def mentor_chat(
    project_id: UUID,
    req: MentorChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a message to the AI Project Mentor for the given project.

    The full conversation history is submitted with each request; the backend
    prepends a project-context system prompt so the mentor always understands
    the current state of the project (title, tech stack, remaining steps, etc.).

    User isolation: only the owner of the project can use its mentor.
    """
    try:
        messages = [{"role": m.role, "content": m.content} for m in req.messages]
        result = mentor_service.chat(
            db,
            user_id=current_user.id,
            project_id=project_id,
            messages=messages,
        )
        return MentorChatResponse(**result)
    except ValueError as ve:
        # Project not found or belongs to another user
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except RuntimeError as re:
        # GEMINI timeout, HTTP error, or unexpected failure
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(re))
