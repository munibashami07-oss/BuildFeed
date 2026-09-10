"""
Sharing Service — Module 16: Project Sharing & Public Showcase

Responsibilities
────────────────
• publish(db, user_id, project_id)   → set is_public=True, generate share_slug
• unpublish(db, user_id, project_id) → set is_public=False (slug kept for re-publish)
• get_public_by_slug(db, slug)       → return public project data (no auth required)
• build_publish_response(portfolio, base_url) → PublishResponse dict

Rules
─────
• Only a completed project owned by the authenticated user can be published.
• Projects are private by default (is_public=False).
• share_slug is generated once and kept stable across publish/unpublish cycles
  so bookmarked links remain valid when the user re-publishes.
• Slug format: first 5 words of title (slugified) + 8-char hex suffix for uniqueness.
• get_public_by_slug intentionally returns only safe public fields — user_id,
  internal UUIDs, and private step IDs are never exposed.
"""

import logging
import re
import secrets
import string
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_portfolio import ProjectPortfolio

logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc)


def _slugify(text: str, max_words: int = 5) -> str:
    """Convert a title to a lowercase hyphen-separated slug using the first N words."""
    words = re.sub(r"[^a-zA-Z0-9\s]", "", text).split()
    slug_words = words[:max_words]
    return "-".join(w.lower() for w in slug_words) if slug_words else "project"


def _generate_slug(title: str) -> str:
    """Return a unique slug: slugified-title + hyphen + 8-char hex suffix."""
    base = _slugify(title, max_words=5)
    suffix = secrets.token_hex(4)  # 8 hex chars
    return f"{base}-{suffix}"


class SharingService:

    # ── Internal helpers ─────────────────────────────────────────────────────

    def _get_owned_completed_project(
        self, db: Session, user_id: UUID, project_id: UUID
    ) -> Project:
        project = (
            db.query(Project)
            .filter(Project.id == project_id, Project.user_id == user_id)
            .first()
        )
        if not project:
            raise ValueError(f"Project {project_id} not found or unauthorized.")
        if project.status != "completed":
            raise ValueError(
                "Only completed projects can be published to the public showcase."
            )
        return project

    def _get_or_create_portfolio(
        self, db: Session, project_id: UUID
    ) -> ProjectPortfolio:
        portfolio = (
            db.query(ProjectPortfolio)
            .filter(ProjectPortfolio.project_id == project_id)
            .first()
        )
        if portfolio is None:
            portfolio = ProjectPortfolio(
                project_id=project_id,
                is_public=False,
            )
            db.add(portfolio)
            db.flush()
        return portfolio

    def build_publish_response(
        self, portfolio: ProjectPortfolio, frontend_base_url: str = ""
    ) -> Dict[str, Any]:
        share_url = None
        if portfolio.is_public and portfolio.share_slug:
            share_url = f"{frontend_base_url}/p/{portfolio.share_slug}"
        return {
            "project_id": portfolio.project_id,
            "is_public": portfolio.is_public,
            "share_slug": portfolio.share_slug,
            "share_url": share_url,
        }

    # ── Public API ────────────────────────────────────────────────────────────

    def publish(
        self,
        db: Session,
        user_id: UUID,
        project_id: UUID,
        frontend_base_url: str = "",
    ) -> Dict[str, Any]:
        """
        Publish a completed project.
        Generates a share_slug on first publish; reuses it on subsequent publishes.
        """
        project = self._get_owned_completed_project(db, user_id, project_id)
        portfolio = self._get_or_create_portfolio(db, project_id)

        if not portfolio.share_slug:
            # Generate a stable slug on first publish
            slug = _generate_slug(project.title)
            # Retry on the tiny chance of collision
            while db.query(ProjectPortfolio).filter(
                ProjectPortfolio.share_slug == slug
            ).first():
                slug = _generate_slug(project.title)
            portfolio.share_slug = slug
            logger.info("Generated share slug '%s' for project %s.", slug, project_id)

        portfolio.is_public = True
        portfolio.updated_at = utc_now()
        db.commit()
        db.refresh(portfolio)

        logger.info("Project %s published (slug=%s).", project_id, portfolio.share_slug)
        return self.build_publish_response(portfolio, frontend_base_url)

    def unpublish(
        self,
        db: Session,
        user_id: UUID,
        project_id: UUID,
        frontend_base_url: str = "",
    ) -> Dict[str, Any]:
        """
        Unpublish a project — sets is_public=False.
        The slug is preserved so re-publishing restores the same URL.
        """
        self._get_owned_completed_project(db, user_id, project_id)
        portfolio = self._get_or_create_portfolio(db, project_id)

        portfolio.is_public = False
        portfolio.updated_at = utc_now()
        db.commit()
        db.refresh(portfolio)

        logger.info("Project %s unpublished.", project_id)
        return self.build_publish_response(portfolio, frontend_base_url)

    def get_public_by_slug(self, db: Session, slug: str) -> Dict[str, Any]:
        """
        Return public project data by share slug.
        No authentication required — called by the unauthenticated public page.
        Raises ValueError if slug not found or project is not public.
        Only exposes safe public fields.
        """
        portfolio = (
            db.query(ProjectPortfolio)
            .filter(
                ProjectPortfolio.share_slug == slug,
                ProjectPortfolio.is_public.is_(True),
            )
            .first()
        )
        if not portfolio:
            raise ValueError("Project not found or is not publicly shared.")

        project: Project = portfolio.project
        if not project or project.status != "completed":
            raise ValueError("Project not found or is not publicly shared.")

        # Respect the account-level "portfolio_public" privacy setting (Settings page).
        # Even if this specific project is published, the owner may have disabled
        # public visibility for their whole portfolio.
        if project.user is not None and project.user.portfolio_public is False:
            raise ValueError("Project not found or is not publicly shared.")

        # Source attribution (title only — no internal IDs)
        inspired_by = None
        if project.content_item:
            inspired_by = project.content_item.title

        # Only expose step title + completion state — no internal step IDs to frontend
        public_steps = [
            {"id": s.get("id", ""), "title": s.get("title", ""), "is_completed": s.get("is_completed", False)}
            for s in (project.steps or [])
        ]

        return {
            "share_slug": portfolio.share_slug,
            "title": project.title,
            "objective": project.objective,
            "description": project.description,
            "difficulty_level": project.difficulty_level,
            "technologies": project.technologies or [],
            "steps": public_steps,
            "progress_percent": project.progress_percent,
            "completed_at": project.completed_at,
            "portfolio_summary": portfolio.portfolio_summary,
            "github_url": portfolio.github_url,
            "demo_url": portfolio.demo_url,
            "inspired_by": inspired_by,
        }


sharing_service = SharingService()