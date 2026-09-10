"""
Portfolio Service — Module 15: Project Portfolio / Showcase

Responsibilities
────────────────
• get_portfolio(db, user_id)         → list of PortfolioEntryResponse dicts
• get_entry(db, user_id, project_id) → single PortfolioEntryResponse dict
• upsert_entry(db, user_id, project_id, req) → updated PortfolioEntryResponse dict

Rules enforced
──────────────
• Only completed projects (status == 'completed') are included in portfolio listings.
• A PATCH to a non-completed project raises ValueError — no partial portfolio entries.
• User isolation: all queries filter by user_id via the projects table.
• The project_portfolio row is created lazily (upsert on first PATCH).
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_portfolio import ProjectPortfolio
from app.schemas.portfolio import PortfolioUpdateRequest

logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc)


def _build_entry_dict(project: Project) -> Dict[str, Any]:
    """Merge Project + ProjectPortfolio into a single flat dict for the schema."""
    portfolio = project.portfolio  # may be None

    # Source content item info
    content_item_title = None
    content_item_url = None
    if project.content_item:
        content_item_title = project.content_item.title
        content_item_url = getattr(project.content_item, "source_url", None)

    return {
        "project_id": project.id,
        "title": project.title,
        "objective": project.objective,
        "description": project.description,
        "difficulty_level": project.difficulty_level,
        "technologies": project.technologies or [],
        "steps": project.steps or [],
        "progress_percent": project.progress_percent,
        "status": project.status,
        "completed_at": project.completed_at,
        "created_at": project.created_at,
        "content_item_title": content_item_title,
        "content_item_url": content_item_url,
        # Portfolio overlay
        # Prefer a manually-set portfolio link (user can point it at a different/renamed
        # repo), but fall back to the repo BuildFeed auto-created via "Build This" so the
        # link shows up immediately without the user having to type it in.
        "github_url": (portfolio.github_url if portfolio and portfolio.github_url else None)
        or project.github_repo_url,
        "demo_url": portfolio.demo_url if portfolio else None,
        "portfolio_summary": portfolio.portfolio_summary if portfolio else None,
        "portfolio_updated_at": portfolio.updated_at if portfolio else None,
        # Module 16: sharing fields
        "is_public": portfolio.is_public if portfolio else False,
        "share_slug": portfolio.share_slug if portfolio else None,
    }


class PortfolioService:

    def _get_completed_project(
        self, db: Session, user_id: UUID, project_id: UUID
    ) -> Project:
        """Fetch a project that belongs to the user AND is completed. Raises ValueError otherwise."""
        project = (
            db.query(Project)
            .filter(Project.id == project_id, Project.user_id == user_id)
            .first()
        )
        if not project:
            raise ValueError(f"Project {project_id} not found or unauthorized.")
        if project.status != "completed":
            raise ValueError(
                f"Project '{project.title}' is not yet completed and cannot be added to the portfolio."
            )
        return project

    # ── Public API ────────────────────────────────────────────────────────────

    def get_portfolio(self, db: Session, user_id: UUID) -> List[Dict[str, Any]]:
        """Return all completed projects for user, merged with portfolio metadata."""
        projects = (
            db.query(Project)
            .filter(Project.user_id == user_id, Project.status == "completed")
            .order_by(Project.completed_at.desc())
            .all()
        )
        return [_build_entry_dict(p) for p in projects]

    def get_entry(
        self, db: Session, user_id: UUID, project_id: UUID
    ) -> Dict[str, Any]:
        """Return a single portfolio entry. Project must be completed and owned by user."""
        project = self._get_completed_project(db, user_id, project_id)
        return _build_entry_dict(project)

    def upsert_entry(
        self,
        db: Session,
        user_id: UUID,
        project_id: UUID,
        req: PortfolioUpdateRequest,
    ) -> Dict[str, Any]:
        """
        Create or update the ProjectPortfolio row for the given project.
        Project must be completed and owned by user.
        Only fields explicitly provided in the request are updated.
        """
        project = self._get_completed_project(db, user_id, project_id)

        portfolio = (
            db.query(ProjectPortfolio)
            .filter(ProjectPortfolio.project_id == project_id)
            .first()
        )

        if portfolio is None:
            portfolio = ProjectPortfolio(
                project_id=project_id,
                github_url=None,
                demo_url=None,
                portfolio_summary=None,
            )
            db.add(portfolio)
            logger.info("Created portfolio entry for project %s.", project_id)

        # Apply only provided fields
        if req.github_url is not None:
            portfolio.github_url = req.github_url or None
        if req.demo_url is not None:
            portfolio.demo_url = req.demo_url or None
        if req.portfolio_summary is not None:
            portfolio.portfolio_summary = req.portfolio_summary or None

        portfolio.updated_at = utc_now()
        db.commit()
        db.refresh(portfolio)
        # Refresh project to pick up backref
        db.refresh(project)

        logger.info(
            "Portfolio entry updated for project %s (user %s).", project_id, user_id
        )
        return _build_entry_dict(project)


portfolio_service = PortfolioService()