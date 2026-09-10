from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.content_source import ContentSource
from app.models.content_item import ContentItem
from app.schemas.discovery import (
    ContentSourceCreate,
    ContentSourceResponse,
    ContentItemResponse,
    DiscoveryRunResponse,
)
from app.services.discovery.discovery_service import discovery_service
from app.services.discovery.discovery_scheduler import discovery_scheduler
from app.core.rate_limiter import RateLimiter

router = APIRouter(prefix="/discovery", tags=["Discovery"])

discovery_limiter = RateLimiter(calls=5, period=60)


@router.post("/trigger", response_model=DiscoveryRunResponse, dependencies=[Depends(discovery_limiter)])
def trigger_discovery_run(db: Session = Depends(get_db)):
    """Manually trigger discovery pipeline across all active sources."""
    return discovery_service.run_discovery(db)


@router.post("/run-full-cycle", dependencies=[Depends(discovery_limiter)])
def trigger_full_discovery_cycle(
    force: bool = Query(False, description="Set to True to force re-processing and re-embedding"),
    db: Session = Depends(get_db),
):
    """Manually trigger full discovery & enrichment cycle (Discovery -> AI Processing -> Embeddings)."""
    return discovery_scheduler.run_full_cycle(db, force=force)


@router.get("/scheduler-status")
def get_scheduler_status():
    """Get automated 12-hour background scheduler status and last cycle summary."""
    return discovery_scheduler.get_status()


@router.get("/sources", response_model=List[ContentSourceResponse])
def list_content_sources(db: Session = Depends(get_db)):
    """List all content sources. Seeds defaults if none exist."""
    sources = db.query(ContentSource).all()
    if not sources:
        sources = discovery_service.seed_default_sources(db)
    return sources


@router.post("/sources", response_model=ContentSourceResponse, status_code=status.HTTP_201_CREATED)
def create_content_source(req: ContentSourceCreate, db: Session = Depends(get_db)):
    """Add a new content source."""
    source = ContentSource(
        name=req.name,
        source_type=req.source_type,
        base_url=req.base_url,
        is_active=req.is_active,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.get("/items", response_model=List[ContentItemResponse])
def list_content_items(
    content_type: Optional[str] = Query(None, description="Filter by content_type (article, github_repo, research_paper, ai_tool)"),
    source_id: Optional[UUID] = Query(None, description="Filter by source_id"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List discovered content items with optional type filtering and pagination."""
    query = db.query(ContentItem)

    if content_type:
        from app.services.feed.feed_service import normalize_content_type
        target_types = normalize_content_type(content_type)
        if target_types:
            query = query.filter(ContentItem.content_type.in_(target_types))
    if source_id:
        query = query.filter(ContentItem.source_id == source_id)

    items = query.order_by(ContentItem.discovered_at.desc()).offset(offset).limit(limit).all()
    return items
