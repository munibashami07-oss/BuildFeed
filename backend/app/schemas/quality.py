"""
Schemas for Module 21: Content Quality & Moderation.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Per-item quality check result
# ---------------------------------------------------------------------------

class QualityCheckDetail(BaseModel):
    """Result of a single named quality check."""
    check: str           # e.g. "duplicate", "broken_url", "spam", "unsafe", "metadata", "freshness"
    passed: bool
    issue_code: Optional[str] = None   # machine-readable code if failed, e.g. "near_duplicate"
    message: Optional[str] = None      # human-readable explanation
    score: float = 1.0                 # 0.0–1.0 quality contribution for this check


class ItemQualityReport(BaseModel):
    """Full quality report for a single ContentItem."""
    item_id: UUID
    title: str
    content_type: str
    quality_status: str          # "passed" | "rejected" | "flagged" | "pending"
    quality_issues: List[str]    # list of issue_codes
    checks: List[QualityCheckDetail]
    overall_score: float         # 0.0–1.0 weighted aggregate
    checked_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Batch processing response
# ---------------------------------------------------------------------------

class QualityBatchResponse(BaseModel):
    """Summary returned after running a quality-check batch."""
    total_checked: int
    passed: int
    rejected: int
    flagged: int
    skipped: int          # items already checked and not force-rerun
    errors: List[str] = []
    duration_seconds: Optional[float] = None


# ---------------------------------------------------------------------------
# Status summary (for dashboard / admin)
# ---------------------------------------------------------------------------

class QualityStatusSummary(BaseModel):
    """Aggregate counts of content items by quality_status."""
    pending: int
    passed: int
    rejected: int
    flagged: int
    total: int
    rejection_rate_pct: float   # rejected / total * 100
    flag_rate_pct: float        # flagged / total * 100


# ---------------------------------------------------------------------------
# API request bodies
# ---------------------------------------------------------------------------

class QualityReCheckRequest(BaseModel):
    """Request body for manually re-checking specific items."""
    item_ids: List[UUID]
    force: bool = True
