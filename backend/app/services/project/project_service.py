import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.project import Project
from app.models.user import User
from app.models.content_item import ContentItem
from app.schemas.project import ProjectCreateRequest, ProjectUpdateRequest
from app.services.focus.focus_gate_service import focus_gate_service
from app.services.progression.xp_service import xp_service
from app.services.achievements.achievement_service import (
    achievement_service,
    TRIGGER_STEP,
    TRIGGER_PROJECT,
)
from app.services.github.github_service import github_service, GitHubServiceError
from app.core.security import decrypt_token

logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc)


class ProjectService:
    def get_project_for_saved_item(self, db: Session, user_id: UUID, item_id: UUID) -> Optional[Project]:
        return (
            db.query(Project)
            .filter(Project.user_id == user_id, Project.content_item_id == item_id)
            .order_by(Project.created_at.desc())
            .first()
        )

    def get_github_authorize_url(self, state: str) -> str:
        return github_service.get_authorize_url(state=state)

    def ensure_github_repo(self, db: Session, user: User, project: Project) -> Project:
        """Create a GitHub repo for this project the first time 'Build This' is clicked.
        Idempotent: no-ops if the project already has a repo attached. Never blocks the
        overall project-creation flow — if GitHub fails, we log and let the user retry.
        """
        if project.github_repo_url:
            return project

        if not user.github_access_token:
            logger.warning("User %s has no GitHub token on file; skipping repo creation for project %s", user.id, project.id)
            return project

        raw_token = decrypt_token(user.github_access_token)
        if not raw_token:
            logger.error("Could not decrypt GitHub token for user %s; skipping repo creation.", user.id)
            return project

        try:
            repo_url = github_service.create_repo_with_readme(
                access_token=raw_token,
                repo_name=project.title,
                project_title=project.title,
                project_description=project.description or project.objective,
                technologies=project.technologies,
            )
            project.github_repo_url = repo_url
            db.commit()
            db.refresh(project)
            logger.info("Created GitHub repo %s for project %s (user %s)", repo_url, project.id, user.id)
        except GitHubServiceError as e:
            # Don't fail "Build This" just because repo creation hiccuped — surface it
            # via github_repo_url staying null; the API layer / frontend can retry.
            logger.error("GitHub repo creation failed for project %s: %s", project.id, e)

        return project

    def create_project_from_saved(self, db: Session, user_id: UUID, item_id: UUID) -> Project:
        """Create a builder project from a saved content item using the existing GEMINI suggestion service."""
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item:
            raise ValueError(f"ContentItem {item_id} not found.")

        # Generate AI project suggestion
        suggestion = focus_gate_service.generate_project_suggestion(db, user_id=user_id, item_id=item_id)

        # Build initial step list
        formatted_steps = []
        for idx, step_text in enumerate(suggestion.basic_steps):
            formatted_steps.append({
                "id": f"step-{idx + 1}",
                "title": step_text,
                "is_completed": False,
                "completed_at": None,
            })

        project = Project(
            user_id=user_id,
            content_item_id=item_id,
            title=suggestion.project_title,
            objective=suggestion.objective,
            description=suggestion.description,
            difficulty_level=item.ai_metadata.get("difficulty_level", "Intermediate") if item.ai_metadata else "Intermediate",
            technologies=suggestion.technologies,
            steps=formatted_steps,
            status="in_progress",
            progress_percent=0,
        )

        db.add(project)
        db.commit()
        db.refresh(project)
        logger.info("Created project %s ('%s') from content item %s for user %s", project.id, project.title, item_id, user_id)
        return project

    def create_project(self, db: Session, user_id: UUID, req: ProjectCreateRequest) -> Project:
        """Create a custom project manually."""
        formatted_steps = []
        if req.steps:
            for idx, s in enumerate(req.steps):
                formatted_steps.append({
                    "id": f"step-{idx + 1}",
                    "title": s,
                    "is_completed": False,
                    "completed_at": None,
                })
        else:
            formatted_steps = [
                {"id": "step-1", "title": "Setup project repository and dependencies", "is_completed": False, "completed_at": None},
                {"id": "step-2", "title": "Implement core architecture & API endpoints", "is_completed": False, "completed_at": None},
                {"id": "step-3", "title": "Build user interface and test features", "is_completed": False, "completed_at": None},
            ]

        project = Project(
            user_id=user_id,
            content_item_id=req.content_item_id,
            title=req.title,
            objective=req.objective,
            description=req.description,
            difficulty_level=req.difficulty_level or "Intermediate",
            technologies=req.technologies or ["Python", "JavaScript"],
            steps=formatted_steps,
            status="in_progress",
            progress_percent=0,
        )

        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    def get_user_projects(
        self, db: Session, user_id: UUID, status: Optional[str] = None
    ) -> Tuple[List[Project], int, int]:
        """List all projects belonging to user with status summary counts."""
        query = db.query(Project).filter(Project.user_id == user_id)
        if status and status != "all":
            query = query.filter(Project.status == status)

        projects = query.order_by(Project.created_at.desc()).all()

        in_progress_count = db.query(Project).filter(Project.user_id == user_id, Project.status == "in_progress").count()
        completed_count = db.query(Project).filter(Project.user_id == user_id, Project.status == "completed").count()

        return projects, in_progress_count, completed_count

    def get_user_project_by_id(self, db: Session, user_id: UUID, project_id: UUID) -> Project:
        """Get single project by ID with strict user isolation."""
        project = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found or unauthorized.")
        return project

    def update_project(self, db: Session, user_id: UUID, project_id: UUID, req: ProjectUpdateRequest) -> Project:
        """Edit project information."""
        project = self.get_user_project_by_id(db, user_id, project_id)

        if req.title is not None:
            project.title = req.title
        if req.objective is not None:
            project.objective = req.objective
        if req.description is not None:
            project.description = req.description
        if req.difficulty_level is not None:
            project.difficulty_level = req.difficulty_level
        if req.technologies is not None:
            project.technologies = req.technologies

        project.updated_at = utc_now()
        db.commit()
        db.refresh(project)
        return project

    def toggle_project_step(
        self, db: Session, user_id: UUID, project_id: UUID, step_id: str, is_completed: bool
    ) -> Tuple[Project, Dict[str, Any]]:
        """Toggle step completion status, update project progress, and award XP when a step is newly completed.

        Returns (project, xp_event_dict) so the API layer can surface both in one response.
        XP is only awarded when is_completed=True and the step has not been awarded before.
        """
        project = self.get_user_project_by_id(db, user_id, project_id)

        # Mutate JSON step list
        updated_steps = []
        for step in project.steps:
            if step.get("id") == step_id:
                step["is_completed"] = is_completed
                step["completed_at"] = utc_now().isoformat() if is_completed else None
            updated_steps.append(step)

        project.steps = updated_steps
        flag_modified(project, "steps")

        # Calculate progress percent
        total_steps = len(updated_steps)
        completed_steps = sum(1 for s in updated_steps if s.get("is_completed"))
        progress_percent = int((completed_steps / total_steps) * 100) if total_steps > 0 else 0
        project.progress_percent = progress_percent
        project.updated_at = utc_now()

        project_completed_this_toggle = False

        # If 100% completed, mark project complete and unlock Focus Gate
        if progress_percent == 100 and project.status != "completed":
            project.status = "completed"
            project.completed_at = utc_now()
            # Unlock Focus Gate for user (existing Module 10 logic — unchanged)
            focus_gate_service.unlock_feed_for_today(db, user_id=user_id)
            logger.info("Project %s completed via step toggle! Focus Gate unlocked for user %s.", project_id, user_id)
            project_completed_this_toggle = True

        db.commit()
        db.refresh(project)

        # --- XP award (Module 12) ---
        # Award step XP only when marking a step as done
        xp_event: Dict[str, Any] = {"xp_earned": 0, "already_awarded": True, "levelled_up": False, "progression": xp_service.build_progression_dict(xp_service.get_or_create_progression(db, user_id))}
        if is_completed:
            xp_event = xp_service.award_step_xp(
                db, user_id=user_id, step_id=step_id, project_id=str(project_id)
            )

        # If the project just reached 100% via this toggle, also award project completion XP
        if project_completed_this_toggle:
            project_xp_event = xp_service.award_project_xp(
                db, user_id=user_id, project_id=str(project_id)
            )
            # Merge: report the combined XP earned in this single action
            combined_xp = (xp_event.get("xp_earned") or 0) + (project_xp_event.get("xp_earned") or 0)
            project_xp_event["xp_earned"] = combined_xp
            xp_event = project_xp_event

        # --- Achievement checks (Module 13) ---
        newly_unlocked: List[str] = []
        if is_completed:
            newly_unlocked = achievement_service.check_and_award(db, user_id, TRIGGER_STEP)
        if project_completed_this_toggle:
            project_ach = achievement_service.check_and_award(db, user_id, TRIGGER_PROJECT)
            newly_unlocked = list(set(newly_unlocked) | set(project_ach))
        if xp_event.get("levelled_up"):
            from app.services.achievements.achievement_service import TRIGGER_LEVEL
            level_ach = achievement_service.check_and_award(db, user_id, TRIGGER_LEVEL)
            newly_unlocked = list(set(newly_unlocked) | set(level_ach))

        xp_event["newly_unlocked_achievements"] = newly_unlocked
        return project, xp_event

    def mark_project_completed(self, db: Session, user_id: UUID, project_id: UUID) -> Tuple[Project, Dict[str, Any]]:
        """Mark project as completed (100% progress), unlock Focus Gate, and award project XP.

        Returns (project, xp_event_dict).
        XP is only awarded once per project (idempotent via awarded_project_ids).
        """
        project = self.get_user_project_by_id(db, user_id, project_id)

        # Mark all steps completed and award XP for any steps not yet credited
        updated_steps = []
        now_iso = utc_now().isoformat()
        step_xp_total = 0
        for step in project.steps:
            step["is_completed"] = True
            step["completed_at"] = step.get("completed_at") or now_iso
            updated_steps.append(step)

        project.steps = updated_steps
        flag_modified(project, "steps")
        project.status = "completed"
        project.progress_percent = 100
        project.completed_at = utc_now()
        project.updated_at = utc_now()

        # Unlock Focus Gate daily feed (existing Module 10 logic — unchanged)
        focus_gate_service.unlock_feed_for_today(db, user_id=user_id)
        logger.info("Project %s marked completed manually. Focus Gate unlocked for user %s.", project_id, user_id)

        db.commit()
        db.refresh(project)

        # --- XP award (Module 12) ---
        # Award XP for each step not yet credited
        for step in project.steps:
            step_event = xp_service.award_step_xp(
                db, user_id=user_id, step_id=step["id"], project_id=str(project_id)
            )
            step_xp_total += step_event.get("xp_earned") or 0

        # Award project completion XP
        project_xp_event = xp_service.award_project_xp(
            db, user_id=user_id, project_id=str(project_id)
        )
        total_xp_earned = step_xp_total + (project_xp_event.get("xp_earned") or 0)
        project_xp_event["xp_earned"] = total_xp_earned

        # --- Achievement checks (Module 13) ---
        step_ach = achievement_service.check_and_award(db, user_id, TRIGGER_STEP)
        project_ach = achievement_service.check_and_award(db, user_id, TRIGGER_PROJECT)
        newly_unlocked = list(set(step_ach) | set(project_ach))
        if project_xp_event.get("levelled_up"):
            from app.services.achievements.achievement_service import TRIGGER_LEVEL
            level_ach = achievement_service.check_and_award(db, user_id, TRIGGER_LEVEL)
            newly_unlocked = list(set(newly_unlocked) | set(level_ach))

        project_xp_event["newly_unlocked_achievements"] = newly_unlocked
        return project, project_xp_event

    def delete_project(self, db: Session, user_id: UUID, project_id: UUID) -> bool:
        """Delete a project for user."""
        project = self.get_user_project_by_id(db, user_id, project_id)
        db.delete(project)
        db.commit()
        return True

    def get_project_learning_quiz(self, db: Session, user_id: UUID, project_id: UUID) -> Dict[str, Any]:
        """Generate 8 difficult MCQs to test user understanding of completed build."""
        from app.services.ai.ai_processor import AIProcessingService
        project = self.get_user_project_by_id(db, user_id, project_id)
        ai_processor = AIProcessingService()

        project_dict = {
            "title": project.title,
            "objective": project.objective or "",
            "description": project.description or "",
            "technologies": project.technologies or [],
            "steps": project.steps or [],
        }
        if project.content_item:
            meta = project.content_item.ai_metadata or {}
            project_dict["learning_value"] = meta.get("learning_value")
            project_dict["project_potential"] = meta.get("project_potential")

        questions = ai_processor.generate_project_learning_quiz(project_dict)

        return {
            "project_id": str(project.id),
            "project_title": project.title,
            "questions": questions,
        }

    def get_step_resources(self, db: Session, user_id: UUID, project_id: UUID, step_id: str) -> Dict[str, Any]:
        """Generate on-demand, milestone-specific resources, code guides, and pitfall warnings for a project step."""
        from app.services.ai.ai_processor import AIProcessingService
        project = self.get_user_project_by_id(db, user_id, project_id)
        user = db.query(User).filter(User.id == user_id).first()

        # Find target step
        steps = project.steps or []
        target_step = None
        step_index = 0
        for idx, s in enumerate(steps):
            if s.get("id") == step_id:
                target_step = s
                step_index = idx
                break

        if not target_step:
            raise ValueError(f"Step '{step_id}' not found in project '{project_id}'.")

        # Query candidate content items from database matching project technologies or topics
        techs = project.technologies or []
        candidate_items = []
        if techs:
            like_filters = [ContentItem.title.ilike(f"%{t}%") for t in techs[:3]]
            if like_filters:
                from sqlalchemy import or_
                db_items = (
                    db.query(ContentItem)
                    .filter(or_(*like_filters))
                    .order_by(ContentItem.created_at.desc())
                    .limit(8)
                    .all()
                )
                for item in db_items:
                    ai_meta = item.ai_metadata or {}
                    source_name = item.source.name if item.source else "BuildFeed"
                    candidate_items.append({
                        "id": str(item.id),
                        "title": item.title,
                        "url": item.source_url,
                        "content_type": item.content_type,
                        "source_name": source_name,
                        "short_summary": ai_meta.get("short_summary") or item.description or "",
                        "difficulty_level": ai_meta.get("difficulty_level", "Intermediate"),
                    })

        ai_processor = AIProcessingService()
        project_dict = {
            "title": project.title,
            "objective": project.objective or "",
            "description": project.description or "",
            "technologies": techs,
        }

        user_level = user.experience_level if user and user.experience_level else "intermediate"
        user_skills = user.skill_levels if user and user.skill_levels else {}

        guide = ai_processor.generate_step_resource_guide(
            project_data=project_dict,
            step_data=target_step,
            step_index=step_index,
            total_steps=len(steps),
            user_level=user_level,
            user_skills=user_skills,
            candidate_items=candidate_items,
        )

        return {
            "project_id": project.id,
            "project_title": project.title,
            "step_id": target_step["id"],
            "step_title": target_step["title"],
            "phase": guide["phase"],
            "key_concepts": guide["key_concepts"],
            "implementation_tips": guide["implementation_tips"],
            "common_pitfalls": guide["common_pitfalls"],
            "recommended_libraries": guide["recommended_libraries"],
            "resources": guide["resources"],
        }


project_service = ProjectService()

