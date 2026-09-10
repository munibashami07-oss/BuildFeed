from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.content_item import ContentItem
from app.schemas.discovery import ContentItemResponse
from app.schemas.ai_processing import ProcessingBatchResponse, ProcessingStatusSummary
from app.services.ai.ai_processor import ai_processor
from app.core.rate_limiter import RateLimiter

router = APIRouter(prefix="/processing", tags=["AI Processing"])

processing_limiter = RateLimiter(calls=5, period=60)


@router.get("/status", response_model=ProcessingStatusSummary)
def get_processing_status(db: Session = Depends(get_db)):
    """Get status summary counts of content items (discovered/pending, processing, completed, failed)."""
    return ai_processor.get_status_summary(db)


@router.post("/process-all", response_model=ProcessingBatchResponse, dependencies=[Depends(processing_limiter)])
def process_all_pending_items(
    limit: int = Query(10, ge=1, le=100, description="Max number of items to process in this batch"),
    force: bool = Query(False, description="Set to True to re-process completed items"),
    db: Session = Depends(get_db),
):
    """Trigger batch AI processing for pending or failed content items."""
    return ai_processor.process_batch(db, limit=limit, force=force)


@router.post("/items/{item_id}/process", response_model=ContentItemResponse)
def process_single_item(
    item_id: UUID,
    force: bool = Query(False, description="Set to True to force re-processing if already completed"),
    db: Session = Depends(get_db),
):
    """Process or re-process a specific content item by ID."""
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ContentItem not found")

    result_item = ai_processor.process_item(db, item_id, force=force)
    return ContentItemResponse.model_validate(result_item)
