from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.discovery import router as discovery_router
from app.api.v1.processing import router as processing_router
from app.api.v1.search import router as search_router
from app.api.v1.feed import router as feed_router
from app.api.v1.saved import router as saved_router
from app.api.v1.focus import router as focus_router
from app.api.v1.projects import router as projects_router
from app.api.v1.progression import router as progression_router
from app.api.v1.achievements import router as achievements_router
from app.api.v1.mentor import router as mentor_router
from app.api.v1.portfolio import router as portfolio_router
from app.api.v1.sharing import portfolio_actions_router, public_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.settings import router as settings_router
from app.api.v1.quality import router as quality_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.external_import import router as external_import_router
from app.api.v1.likes import router as likes_router  # Module 22: Like System & Trending

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth_router)
api_v1_router.include_router(discovery_router)
api_v1_router.include_router(processing_router)
api_v1_router.include_router(search_router)
api_v1_router.include_router(feed_router)
api_v1_router.include_router(saved_router)
api_v1_router.include_router(external_import_router)
api_v1_router.include_router(focus_router)
api_v1_router.include_router(projects_router)
api_v1_router.include_router(mentor_router, prefix="/projects")
api_v1_router.include_router(progression_router)
api_v1_router.include_router(achievements_router)
api_v1_router.include_router(portfolio_router)
api_v1_router.include_router(portfolio_actions_router, prefix="/portfolio")
api_v1_router.include_router(public_router, prefix="/public")
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(settings_router)
api_v1_router.include_router(quality_router)  # Module 21: Content Quality & Moderation
api_v1_router.include_router(notifications_router)
api_v1_router.include_router(likes_router)  # Module 22: Like System & Trending
