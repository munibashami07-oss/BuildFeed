"""
Module 21: Content Quality & Moderation API endpoints.

Endpoints:
  GET  /quality/status              — aggregate counts by quality_status
  GET  /quality/items               — paginated list of items filtered by quality_status
  GET  /quality/items/{id}/report   — full quality report for a single item
  POST /quality/run                 — manually trigger a quality-check batch
  POST /quality/recheck             — force re-check a specific list of item IDs
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.content_item import ContentItem
from app.models.user import User
from app.schemas.quality import (
    ItemQualityReport,
    QualityBatchResponse,
    QualityReCheckRequest,
    QualityStatusSummary,
)
from app.services.quality.content_quality_service import content_quality_service

router = APIRouter(prefix="/quality", tags=["Quality & Moderation"])


# ---------------------------------------------------------------------------
# Status summary
# ---------------------------------------------------------------------------

@router.get("/status", response_model=QualityStatusSummary)
def get_quality_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return aggregate counts of content items grouped by quality_status.
    Useful for an admin dashboard to see how much content has been rejected/flagged.
    """
    return content_quality_service.get_status_summary(db)


# ---------------------------------------------------------------------------
# Filtered item listing
# ---------------------------------------------------------------------------

@router.get("/items", response_model=List[dict])
def list_quality_items(
    quality_status: Optional[str] = Query(
        None,
        description="Filter by quality_status: pending | passed | rejected | flagged",
    ),
    content_type: Optional[str] = Query(None, description="Filter by content_type"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List content items with optional quality_status and content_type filters.
    Returns lightweight item summaries including quality fields.
    """
    valid_statuses = {"pending", "passed", "rejected", "flagged"}
    if quality_status and quality_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"quality_status must be one of: {', '.join(sorted(valid_statuses))}",
        )

    query = db.query(ContentItem)
    if quality_status:
        query = query.filter(ContentItem.quality_status == quality_status)
    if content_type:
        from app.services.feed.feed_service import normalize_content_type
        target_types = normalize_content_type(content_type)
        if target_types:
            query = query.filter(ContentItem.content_type.in_(target_types))

    items = (
        query.order_by(ContentItem.discovered_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": str(item.id),
            "title": item.title,
            "content_type": item.content_type,
            "source_url": item.source_url,
            "quality_status": item.quality_status,
            "quality_issues": item.quality_issues or [],
            "quality_score": item.quality_score,
            "quality_checked_at": item.quality_checked_at.isoformat() if item.quality_checked_at else None,
            "discovered_at": item.discovered_at.isoformat(),
            "status": item.status,
        }
        for item in items
    ]


# ---------------------------------------------------------------------------
# Single-item report
# ---------------------------------------------------------------------------

@router.get("/items/{item_id}/report", response_model=ItemQualityReport)
def get_item_quality_report(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the stored quality report for a single content item.
    If the item has not been quality-checked yet, returns quality_status='pending'
    with no check details.
    """
    report = content_quality_service.get_item_report(db, item_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content item {item_id} not found.",
        )
    return report


# ---------------------------------------------------------------------------
# Manual batch trigger
# ---------------------------------------------------------------------------

@router.post("/run", response_model=QualityBatchResponse)
def run_quality_check_batch(
    limit: int = Query(100, ge=1, le=500, description="Max items to check per run"),
    force: bool = Query(False, description="Re-check already-checked items"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Manually trigger a quality-check batch.  Processes up to `limit` items with
    quality_status='pending' (or all items if force=True).

    This is the same logic that runs automatically as Step 1.5 of the 12-hour
    discovery cycle — calling it here lets you check new items immediately without
    waiting for the next scheduled cycle.
    """
    return content_quality_service.check_batch(db, limit=limit, force=force)


# ---------------------------------------------------------------------------
# Force re-check specific items
# ---------------------------------------------------------------------------

@router.post("/recheck", response_model=QualityBatchResponse)
def recheck_items(
    req: QualityReCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Force re-run all quality checks on a specific list of content item IDs.
    Useful for manually reviewing and clearing previously rejected/flagged items
    after a configuration change (e.g. loosening the duplicate threshold).

    Accepts a JSON body:
      { "item_ids": ["uuid1", "uuid2", ...], "force": true }
    """
    if not req.item_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="item_ids list cannot be empty.",
        )
    if len(req.item_ids) > 200:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Maximum 200 item IDs per recheck request.",
        )
    return content_quality_service.recheck_items(db, item_ids=req.item_ids)
