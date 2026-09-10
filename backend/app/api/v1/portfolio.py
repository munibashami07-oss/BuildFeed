"""
Portfolio API — Module 15: Project Portfolio / Showcase

Endpoints
─────────
  GET   /api/v1/portfolio                    → list all portfolio entries (completed projects only)
  GET   /api/v1/portfolio/{project_id}       → single portfolio entry
  PATCH /api/v1/portfolio/{project_id}       → upsert github/demo links and summary
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.portfolio import (
    PortfolioEntryResponse,
    PortfolioListResponse,
    PortfolioUpdateRequest,
    LinkedInPostResponse,
)
from app.services.portfolio.portfolio_service import portfolio_service
from app.services.portfolio.linkedin_post_service import linkedin_post_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


@router.get("", response_model=PortfolioListResponse)
def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all completed projects for the authenticated user as portfolio entries."""
    entries = portfolio_service.get_portfolio(db, user_id=current_user.id)
    return PortfolioListResponse(
        entries=[PortfolioEntryResponse(**e) for e in entries],
        total=len(entries),
    )


@router.get("/{project_id}", response_model=PortfolioEntryResponse)
def get_portfolio_entry(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a single portfolio entry for the given completed project."""
    try:
        entry = portfolio_service.get_entry(db, user_id=current_user.id, project_id=project_id)
        return PortfolioEntryResponse(**entry)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.patch("/{project_id}", response_model=PortfolioEntryResponse)
def upsert_portfolio_entry(
    project_id: UUID,
    req: PortfolioUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create or update portfolio metadata (GitHub URL, demo URL, summary) for a
    completed project. Only fields provided in the request body are changed.
    """
    try:
        entry = portfolio_service.upsert_entry(
            db, user_id=current_user.id, project_id=project_id, req=req
        )
        return PortfolioEntryResponse(**entry)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.post("/{project_id}/linkedin-post", response_model=LinkedInPostResponse)
def generate_linkedin_post(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate an AI-written LinkedIn caption for a completed project, plus the
    LinkedIn "share" deep link for its GitHub/demo URL.

    Note: LinkedIn's share endpoint only accepts a URL parameter — it cannot
    be pre-filled with post text — so the client is expected to let the user
    copy the caption and paste it into LinkedIn's composer.
    """
    try:
        result = linkedin_post_service.generate_post(
            db, user_id=current_user.id, project_id=project_id
        )
        return LinkedInPostResponse(**result)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))