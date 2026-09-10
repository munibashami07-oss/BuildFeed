"""
Sharing API — Module 16: Project Sharing & Public Showcase

Authenticated endpoints (require JWT):
  POST /api/v1/portfolio/{project_id}/publish    → publish a completed project
  POST /api/v1/portfolio/{project_id}/unpublish  → unpublish (keeps slug)

Unauthenticated endpoint (public):
  GET  /api/v1/public/p/{slug}                   → fetch public project data by slug
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.sharing import PublishResponse, PublicProjectResponse
from app.services.sharing.sharing_service import sharing_service

logger = logging.getLogger(__name__)

# Two separate routers so they can be mounted at different prefixes
portfolio_actions_router = APIRouter(tags=["Sharing"])
public_router = APIRouter(tags=["Public Showcase"])


def _frontend_base_url(request: Request) -> str:
    """Derive the frontend base URL from settings or from the incoming request origin."""
    if getattr(settings, "FRONTEND_URL", None):
        return settings.FRONTEND_URL.rstrip("/")
    # Fallback: mirror the API host (useful in development)
    return str(request.base_url).rstrip("/")


# ── Authenticated: publish / unpublish ───────────────────────────────────────

@portfolio_actions_router.post("/{project_id}/publish", response_model=PublishResponse)
def publish_project(
    project_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Publish a completed project to the public showcase. Returns share URL."""
    try:
        result = sharing_service.publish(
            db,
            user_id=current_user.id,
            project_id=project_id,
            frontend_base_url=_frontend_base_url(request),
        )
        return PublishResponse(**result)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@portfolio_actions_router.post("/{project_id}/unpublish", response_model=PublishResponse)
def unpublish_project(
    project_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unpublish a project. The share slug is preserved for future re-publishing."""
    try:
        result = sharing_service.unpublish(
            db,
            user_id=current_user.id,
            project_id=project_id,
            frontend_base_url=_frontend_base_url(request),
        )
        return PublishResponse(**result)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


# ── Unauthenticated: public project page ─────────────────────────────────────

@public_router.get("/p/{slug}", response_model=PublicProjectResponse)
def get_public_project(
    slug: str,
    db: Session = Depends(get_db),
):
    """
    Return public project data by share slug.
    No authentication required. Returns 404 if the project is not published.
    """
    try:
        data = sharing_service.get_public_by_slug(db, slug=slug)
        return PublicProjectResponse(**data)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
