"""
Module 22 – Like System & Trending This Week

Endpoints
─────────
POST   /likes/{item_id}          — like a content item (idempotent)
DELETE /likes/{item_id}          — unlike a content item
GET    /likes/my-likes           — all item IDs the current user has liked
POST   /likes/counts             — bulk like counts + current user's liked state
GET    /likes/trending           — top-liked content items in a rolling window

Design notes:
  • One like per (user, content_item) pair enforced by DB unique constraint.
  • POST is idempotent: liking an already-liked item returns the current state
    without raising an error (safe for optimistic UI updates).
  • Trending uses a rolling window (default 7 days) so the ranking updates
    automatically as new likes arrive — no cron job required.
  • The trending query counts only likes within the window, ranks by count,
    and returns full ContentItem data so the frontend can render type icons.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.database import get_db
from app.models.content_item import ContentItem
from app.models.content_item_like import ContentItemLike
from app.models.user import User
from app.schemas.likes import (
    LikeCountsRequest,
    LikeCountsResponse,
    LikeResponse,
    TrendingItem,
    TrendingResponse,
)

router = APIRouter(prefix="/likes", tags=["Likes & Trending"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ── Like a content item ───────────────────────────────────────────────────────

@router.post("/{item_id}", response_model=LikeResponse)
def like_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Like a content item. Idempotent — calling this when already liked returns
    the current state without error (safe for React optimistic updates).
    """
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found.")

    existing = (
        db.query(ContentItemLike)
        .filter(
            ContentItemLike.user_id == current_user.id,
            ContentItemLike.content_item_id == item_id,
        )
        .first()
    )

    if not existing:
        like = ContentItemLike(
            user_id=current_user.id,
            content_item_id=item_id,
            created_at=_utc_now(),
        )
        db.add(like)
        db.commit()

    like_count = (
        db.query(func.count(ContentItemLike.id))
        .filter(ContentItemLike.content_item_id == item_id)
        .scalar()
    ) or 0

    return LikeResponse(item_id=item_id, is_liked=True, like_count=like_count)


# ── Unlike a content item ─────────────────────────────────────────────────────

@router.delete("/{item_id}", response_model=LikeResponse)
def unlike_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unlike (remove like from) a content item."""
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found.")

    existing = (
        db.query(ContentItemLike)
        .filter(
            ContentItemLike.user_id == current_user.id,
            ContentItemLike.content_item_id == item_id,
        )
        .first()
    )

    if existing:
        db.delete(existing)
        db.commit()

    like_count = (
        db.query(func.count(ContentItemLike.id))
        .filter(ContentItemLike.content_item_id == item_id)
        .scalar()
    ) or 0

    return LikeResponse(item_id=item_id, is_liked=False, like_count=like_count)


# ── Get current user's liked item IDs ────────────────────────────────────────

@router.get("/my-likes")
def get_my_liked_ids(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all content item IDs that the current user has liked."""
    rows = (
        db.query(ContentItemLike.content_item_id)
        .filter(ContentItemLike.user_id == current_user.id)
        .all()
    )
    return {"liked_item_ids": [str(r[0]) for r in rows]}


# ── Bulk like counts ──────────────────────────────────────────────────────────

@router.post("/counts", response_model=LikeCountsResponse)
def get_like_counts(
    req: LikeCountsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return total like counts and the current user's liked state for a batch
    of content item IDs.  Used when rendering a page of feed cards so the
    frontend can make one request instead of N per-item requests.
    """
    if not req.item_ids:
        return LikeCountsResponse(counts={}, liked_ids=[])

    # Total counts per item
    count_rows = (
        db.query(
            ContentItemLike.content_item_id,
            func.count(ContentItemLike.id).label("cnt"),
        )
        .filter(ContentItemLike.content_item_id.in_(req.item_ids))
        .group_by(ContentItemLike.content_item_id)
        .all()
    )
    counts = {str(row.content_item_id): row.cnt for row in count_rows}

    # Ensure every requested ID has an entry (even if 0)
    for iid in req.item_ids:
        if str(iid) not in counts:
            counts[str(iid)] = 0

    # Current user's liked set
    liked_rows = (
        db.query(ContentItemLike.content_item_id)
        .filter(
            ContentItemLike.user_id == current_user.id,
            ContentItemLike.content_item_id.in_(req.item_ids),
        )
        .all()
    )
    liked_ids = [str(r[0]) for r in liked_rows]

    return LikeCountsResponse(counts=counts, liked_ids=liked_ids)


# ── Trending This Week ────────────────────────────────────────────────────────

@router.get("/trending", response_model=TrendingResponse)
def get_trending(
    window_days: int = Query(7, ge=1, le=30, description="Rolling window in days"),
    limit: int = Query(5, ge=1, le=20, description="Number of trending items to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the top-liked content items within a rolling time window, ranked
    by total like count descending.

    Counts only likes made within the window, so the ranking automatically
    shifts as older likes age out — no cron job or cache flush needed.
    """
    since = _utc_now() - timedelta(days=window_days)

    # Aggregate like counts within the window, join to get item details
    rows = (
        db.query(
            ContentItem,
            func.count(ContentItemLike.id).label("like_count"),
        )
        .join(ContentItemLike, ContentItemLike.content_item_id == ContentItem.id)
        .filter(ContentItemLike.created_at >= since)
        .group_by(ContentItem.id)
        .order_by(func.count(ContentItemLike.id).desc())
        .limit(limit)
        .all()
    )

    trending_items = [
        TrendingItem(
            rank=idx + 1,
            item_id=item.id,
            title=item.title,
            content_type=item.content_type,
            source_url=item.source_url,
            author=item.author,
            thumbnail_url=item.thumbnail_url,
            like_count=like_count,
            ai_metadata=item.ai_metadata,
        )
        for idx, (item, like_count) in enumerate(rows)
    ]

    return TrendingResponse(items=trending_items, window_days=window_days)
