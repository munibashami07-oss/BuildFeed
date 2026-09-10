from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_v1_router
from app.services.discovery.discovery_scheduler import discovery_scheduler


import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start background discovery scheduler unless running under pytest
    is_testing = bool(os.environ.get("PYTEST_CURRENT_TEST")) or getattr(settings, "TESTING", False)
    if not is_testing:
        discovery_scheduler.start()
    yield
    # Shutdown: Stop background discovery scheduler unless running under pytest
    if not is_testing:
        discovery_scheduler.stop()


app = FastAPI(
    title="build. API",
    description="AI Inspiration & Project Building Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
origins = settings.get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 router
app.include_router(api_v1_router)


import logging
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler masking internal details in production."""
    logger.exception("Unhandled error processing request: %s %s", request.method, request.url.path)

    if settings.APP_ENV == "development":
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc)},
        )

    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "build. API", "environment": settings.APP_ENV}
