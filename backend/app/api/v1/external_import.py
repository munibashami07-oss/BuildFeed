import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.external_import import (
    ExternalImportRequest,
    ExternalImportResponse,
    ExternalImportSaveResponse,
)
from app.services.external_import import external_import_service
from app.core.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/saved/external", tags=["External Saved Imports"])

external_import_limiter = RateLimiter(calls=10, period=60)


@router.post("/analyze", response_model=ExternalImportResponse, dependencies=[Depends(external_import_limiter)])
def analyze_external_url(
    req: ExternalImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch a public URL, run the existing BuildFeed AI analysis, and generate a mentor plan."""
    try:
        return external_import_service.analyze_and_prepare(db, req.url, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    except Exception:
        logger.exception("Unexpected external URL import failure")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not analyze the public URL.")


@router.post("/{item_id}/save", response_model=ExternalImportSaveResponse)
def save_external_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save an analyzed external item into the existing Saved collection."""
    try:
        record = external_import_service.save_analyzed_item(db, current_user.id, item_id)
        item = record.content_item
        return ExternalImportSaveResponse(
            status="saved",
            item_id=item.id,
            saved_id=record.id,
            title=item.title,
            source_url=item.source_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
