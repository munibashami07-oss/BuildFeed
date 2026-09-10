"""
Module 21: Content Quality & Moderation Service.

Runs between Step 1 (Discovery) and Step 2 (AI Processing) in the discovery cycle.
Items that pass all checks get quality_status="passed" and proceed to AI processing.
Items that hard-fail are marked quality_status="rejected" and are excluded from the feed
and from AI processing (preventing wasted GEMINI calls on junk content).
Items that soft-fail are marked quality_status="flagged" — they still flow to AI
processing and the feed but carry a quality_issues list so the UI can surface a caveat.

Checks applied (in order):
  1. near_duplicate      — title-level Jaccard similarity against recently ingested items
  2. broken_url          — HTTP HEAD request to source_url; non-2xx / timeout = broken
  3. spam_low_quality    — heuristic spam signals: title too short, ALL CAPS, excessive
                           punctuation, known clickbait patterns, zero-info titles
  4. unsafe_irrelevant   — keyword block-list scan for adult/dangerous content plus a
                           topic relevance guard (rejects content with zero tech signals)
  5. missing_metadata    — required fields audit (title, source_url, description/raw_metadata)
  6. freshness           — articles/papers published more than QUALITY_MAX_AGE_DAYS ago
                           are flagged as stale (GitHub repos & videos are exempt)

Design decisions:
  * No external API calls beyond the optional URL HEAD check — keeps the check fast and
    free.  The unsafe filter is a keyword block-list, not an GEMINI moderation call, to
    avoid doubling API costs.  If you want GEMINI moderation, add it here as a 7th check.
  * Only items with quality_status="pending" are processed unless force=True, so re-runs
    are idempotent and cheap.
  * "rejected" items are excluded from AI processing (discovery_scheduler checks this).
    "flagged" and "passed" items both proceed.
  * The feed_service is NOT touched — it already filters by EXCLUDED_CONTENT_TYPES and
    scores by relevance.  Quality filtering happens upstream so by the time feed_service
    sees an item it has already been validated.
"""

import logging
import re
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Set, Tuple
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.content_item import ContentItem
from app.schemas.quality import (
    ItemQualityReport,
    QualityBatchResponse,
    QualityCheckDetail,
    QualityStatusSummary,
)

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Spam / low-quality heuristics
# ---------------------------------------------------------------------------

# Titles consisting entirely of these words (case-insensitive) are zero-signal
_ZERO_SIGNAL_TITLES: Set[str] = {
    "untitled", "no title", "n/a", "na", "null", "none", "test", "example",
    "sample", "demo", "placeholder", "todo", "fixme", "temp", "tmp",
}

# Regex patterns that strongly suggest spam / clickbait
_SPAM_PATTERNS: List[re.Pattern] = [
    re.compile(r"\b(earn|make)\s+\$[\d,]+\s+(a\s+)?(day|week|month|hour)\b", re.I),
    re.compile(r"\b(free\s+money|get\s+rich\s+quick|100%\s+free|limited\s+time\s+offer)\b", re.I),
    re.compile(r"\b(click\s+here|click\s+now|act\s+now|don'?t\s+miss)\b", re.I),
    re.compile(r"\b(you\s+won'?t\s+believe|shocking|mind[\s-]?blowing)\b", re.I),
    re.compile(r"\b(lose\s+\d+\s+pounds?|weight\s+loss\s+secret|diet\s+pill)\b", re.I),
    re.compile(r"\b(crypto|bitcoin|nft|web3)\s+(profit|gains?|moon|lambo)\b", re.I),
    re.compile(r"(!{3,}|\?{3,})", re.I),           # !!!  or ???
    re.compile(r"[A-Z\s]{20,}"),                    # 20+ consecutive uppercase chars
]

# ---------------------------------------------------------------------------
# Unsafe / adult / dangerous content block-list (hard reject)
# ---------------------------------------------------------------------------

_UNSAFE_KEYWORDS: Set[str] = {
    # Adult
    "porn", "xxx", "nude", "naked", "sex tape", "onlyfans leak",
    "adult content", "explicit content", "18+",
    # Violence / extremism
    "how to make a bomb", "make explosives", "terrorist", "isis", "jihad",
    "white supremac", "neo-nazi",
    # Illegal
    "buy drugs online", "darkweb marketplace", "credit card dump",
    "carding tutorial", "hack bank account",
    # Spam-specific
    "casino bonus", "online casino", "slot machine win", "gambling tips",
}

# At least one of these tech-domain signals must appear somewhere in the item
# to pass the relevance gate. This prevents off-topic lifestyle / entertainment
# content from leaking through RSS feeds like Hacker News comment threads.
_TECH_RELEVANCE_SIGNALS: Set[str] = {
    # Programming & software
    "python", "javascript", "typescript", "java", "rust", "go", "c++", "c#",
    "swift", "kotlin", "ruby", "php", "scala", "elixir", "clojure", "haskell",
    "html", "css", "sql", "bash", "shell", "powershell",
    # Frameworks & tools
    "react", "vue", "angular", "django", "flask", "fastapi", "spring", "rails",
    "node", "next.js", "nuxt", "svelte", "tailwind", "bootstrap",
    "docker", "kubernetes", "terraform", "ansible", "jenkins", "github",
    "git", "api", "rest", "graphql", "grpc", "websocket",
    # AI / ML / data
    "machine learning", "deep learning", "neural", "llm", "gpt", "transformer",
    "pytorch", "tensorflow", "keras", "hugging face", "GEMINI", "langchain",
    "pandas", "numpy", "scikit", "spark", "airflow", "dbt", "embedding",
    "vector", "model", "inference", "fine-tun",
    # Infrastructure & cloud
    "aws", "azure", "gcp", "cloud", "serverless", "lambda", "devops",
    "ci/cd", "microservice", "monolith", "database", "postgres", "mysql",
    "redis", "mongodb", "elasticsearch", "kafka", "rabbitmq",
    # Security
    "security", "vulnerability", "exploit", "pentest", "ctf", "cryptography",
    "authentication", "oauth", "jwt", "ssl", "tls",
    # General tech
    "algorithm", "data structure", "open source", "open-source", "repository",
    "framework", "library", "sdk", "cli", "terminal", "linux", "unix",
    "raspberry pi", "arduino", "iot", "robotics", "hardware",
    "startup", "saas", "product", "launch", "build", "developer", "engineer",
    "software", "code", "coding", "programming", "tech", "technology",
    # Content-type specific signals
    "tutorial", "guide", "introduction", "beginner", "advanced", "course",
    "research", "paper", "arxiv", "benchmark", "dataset", "experiment",
}

# Content types that are inherently tech-relevant — skip the relevance gate
_ALWAYS_RELEVANT_TYPES: Set[str] = {"github_repo", "ai_tool", "research_paper", "video"}


class ContentQualityService:
    """
    Runs all quality checks on discovered content items and writes results back
    to the database.  Thread-safe for concurrent reads; writes are per-item with
    individual commits so a single failure does not roll back the whole batch.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def check_item(
        self,
        db: Session,
        item: ContentItem,
        existing_titles: Optional[List[str]] = None,
        force: bool = False,
    ) -> ItemQualityReport:
        """
        Run all quality checks on a single ContentItem and persist the result.

        Args:
            db:               SQLAlchemy session.
            item:             The ContentItem ORM instance to evaluate.
            existing_titles:  Optional pre-fetched list of other items' titles for
                              near-duplicate detection.  Pass None to skip dup check
                              or pre-build the list once per batch for efficiency.
            force:            If True, re-check even if already checked.

        Returns:
            ItemQualityReport with full check details.
        """
        if item.quality_status not in ("pending", None) and not force:
            # Already checked — return cached result without DB write
            return self._build_report_from_item(item)

        checks: List[QualityCheckDetail] = []

        # 1. Near-duplicate detection
        checks.append(self._check_duplicate(item, existing_titles or []))

        # 2. Broken URL
        checks.append(self._check_url(item))

        # 3. Spam / low quality
        checks.append(self._check_spam(item))

        # 4. Unsafe / irrelevant content
        checks.append(self._check_unsafe_irrelevant(item))

        # 5. Missing metadata
        checks.append(self._check_metadata(item))

        # 6. Freshness
        checks.append(self._check_freshness(item))

        # Determine final status and aggregate score
        quality_status, quality_issues, overall_score = self._aggregate(checks)

        # Persist to DB
        item.quality_status = quality_status
        item.quality_issues = quality_issues
        item.quality_score = {c.check: round(c.score, 3) for c in checks}
        item.quality_checked_at = utc_now()
        try:
            db.commit()
            db.refresh(item)
        except Exception as exc:
            db.rollback()
            logger.error("Failed to persist quality result for item %s: %s", item.id, exc)

        return ItemQualityReport(
            item_id=item.id,
            title=item.title,
            content_type=item.content_type,
            quality_status=quality_status,
            quality_issues=quality_issues,
            checks=checks,
            overall_score=round(overall_score, 3),
            checked_at=item.quality_checked_at,
        )

    def check_batch(
        self,
        db: Session,
        limit: int = 100,
        force: bool = False,
    ) -> QualityBatchResponse:
        """
        Quality-check a batch of newly discovered items.  Only processes items
        with quality_status='pending' (or all items if force=True).

        Args:
            db:     SQLAlchemy session.
            limit:  Maximum number of items to process per call.
            force:  Re-check already-checked items.

        Returns:
            QualityBatchResponse summary.
        """
        if not settings.QUALITY_CHECKS_ENABLED:
            logger.info("Quality checks are disabled (QUALITY_CHECKS_ENABLED=False). Skipping batch.")
            return QualityBatchResponse(
                total_checked=0, passed=0, rejected=0, flagged=0, skipped=0,
                errors=["Quality checks disabled via QUALITY_CHECKS_ENABLED setting."],
            )

        start = time.monotonic()

        query = db.query(ContentItem)
        if not force:
            query = query.filter(ContentItem.quality_status == "pending")
        items: List[ContentItem] = query.order_by(ContentItem.discovered_at.asc()).limit(limit).all()

        if not items:
            return QualityBatchResponse(
                total_checked=0, passed=0, rejected=0, flagged=0, skipped=0,
            )

        # Pre-fetch all existing titles for duplicate detection (once per batch).
        # Exclude the IDs we are about to check so we don't compare an item to itself.
        item_ids = {i.id for i in items}
        existing_titles: List[str] = [
            row[0] for row in
            db.query(ContentItem.title)
            .filter(ContentItem.id.notin_(item_ids))
            .all()
        ]

        passed = rejected = flagged = skipped = 0
        errors: List[str] = []

        for item in items:
            try:
                report = self.check_item(db, item, existing_titles=existing_titles, force=force)
                if report.quality_status == "passed":
                    passed += 1
                elif report.quality_status == "rejected":
                    rejected += 1
                elif report.quality_status == "flagged":
                    flagged += 1
                else:
                    skipped += 1
                # Add this item's title to the existing pool so subsequent items in the same
                # batch can detect duplicates against it too.
                existing_titles.append(item.title)
            except Exception as exc:
                skipped += 1
                err_msg = f"Quality check error for item {item.id} ({item.title[:60]}): {exc}"
                logger.error(err_msg, exc_info=True)
                errors.append(err_msg)

        duration = round(time.monotonic() - start, 2)
        logger.info(
            "Quality batch complete: %d checked, %d passed, %d rejected, %d flagged in %.2fs",
            len(items), passed, rejected, flagged, duration,
        )
        return QualityBatchResponse(
            total_checked=len(items),
            passed=passed,
            rejected=rejected,
            flagged=flagged,
            skipped=skipped,
            errors=errors,
            duration_seconds=duration,
        )

    def recheck_items(
        self,
        db: Session,
        item_ids: List[UUID],
    ) -> QualityBatchResponse:
        """Force re-check a specific list of items by UUID."""
        items: List[ContentItem] = (
            db.query(ContentItem).filter(ContentItem.id.in_(item_ids)).all()
        )
        existing_titles: List[str] = [
            row[0] for row in
            db.query(ContentItem.title)
            .filter(ContentItem.id.notin_(item_ids))
            .all()
        ]

        passed = rejected = flagged = skipped = 0
        errors: List[str] = []

        for item in items:
            try:
                report = self.check_item(db, item, existing_titles=existing_titles, force=True)
                if report.quality_status == "passed":
                    passed += 1
                elif report.quality_status == "rejected":
                    rejected += 1
                elif report.quality_status == "flagged":
                    flagged += 1
                else:
                    skipped += 1
                existing_titles.append(item.title)
            except Exception as exc:
                skipped += 1
                err_msg = f"Re-check error for item {item.id}: {exc}"
                logger.error(err_msg, exc_info=True)
                errors.append(err_msg)

        return QualityBatchResponse(
            total_checked=len(items),
            passed=passed,
            rejected=rejected,
            flagged=flagged,
            skipped=skipped,
            errors=errors,
        )

    def get_status_summary(self, db: Session) -> QualityStatusSummary:
        """Return aggregate counts by quality_status."""
        pending = db.query(ContentItem).filter(ContentItem.quality_status == "pending").count()
        passed = db.query(ContentItem).filter(ContentItem.quality_status == "passed").count()
        rejected = db.query(ContentItem).filter(ContentItem.quality_status == "rejected").count()
        flagged = db.query(ContentItem).filter(ContentItem.quality_status == "flagged").count()
        total = db.query(ContentItem).count()

        rejection_rate = round((rejected / total * 100), 1) if total else 0.0
        flag_rate = round((flagged / total * 100), 1) if total else 0.0

        return QualityStatusSummary(
            pending=pending,
            passed=passed,
            rejected=rejected,
            flagged=flagged,
            total=total,
            rejection_rate_pct=rejection_rate,
            flag_rate_pct=flag_rate,
        )

    def get_item_report(self, db: Session, item_id: UUID) -> Optional[ItemQualityReport]:
        """Return the stored quality report for a single item, or None if not found."""
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item:
            return None
        return self._build_report_from_item(item)

    # ------------------------------------------------------------------
    # Individual checks
    # ------------------------------------------------------------------

    def _check_duplicate(
        self,
        item: ContentItem,
        existing_titles: List[str],
    ) -> QualityCheckDetail:
        """
        Near-duplicate detection using Jaccard similarity on word-level bigrams.
        Only compares titles because descriptions are often None/short and the
        URL-level exact-duplicate check already happens in discovery_service.
        """
        check_name = "duplicate"
        if not existing_titles:
            return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                      message="No existing items to compare against.")

        item_bigrams = self._word_bigrams(item.title)
        if not item_bigrams:
            # Title too short to build bigrams — let the spam/metadata check handle it
            return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                      message="Title too short for bigram comparison.")

        max_sim = 0.0
        most_similar_title = ""
        threshold = settings.QUALITY_DUPLICATE_THRESHOLD

        for existing_title in existing_titles:
            existing_bigrams = self._word_bigrams(existing_title)
            if not existing_bigrams:
                continue
            sim = self._jaccard(item_bigrams, existing_bigrams)
            if sim > max_sim:
                max_sim = sim
                most_similar_title = existing_title

        if max_sim >= threshold:
            return QualityCheckDetail(
                check=check_name,
                passed=False,
                issue_code="near_duplicate",
                message=f"Title is {max_sim:.0%} similar to existing: \"{most_similar_title[:80]}\"",
                score=0.0,
            )

        # Score inversely proportional to similarity — 1.0 when unique, <1 when close
        score = 1.0 - max_sim
        return QualityCheckDetail(check=check_name, passed=True, score=round(score, 3),
                                  message=f"Unique (max similarity {max_sim:.0%}).")

    def _check_url(self, item: ContentItem) -> QualityCheckDetail:
        """
        Checks that source_url is reachable via an HTTP HEAD request.
        GitHub repo URLs and YouTube video URLs are exempt — they are always valid
        because the adapters build them from authoritative API responses.
        """
        check_name = "broken_url"

        # Exempt always-valid programmatic URLs
        url = item.source_url or ""
        if item.content_type in ("github_repo", "ai_tool"):
            return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                      message="GitHub repo URL exempt from URL check.")
        if item.content_type == "video":
            return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                      message="YouTube video URL exempt from URL check.")

        if not url.startswith(("http://", "https://")):
            return QualityCheckDetail(
                check=check_name, passed=False, issue_code="invalid_url_scheme",
                message=f"URL does not start with http(s)://: {url[:100]}",
                score=0.0,
            )

        if not settings.QUALITY_URL_CHECK_ENABLED:
            return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                      message="URL check disabled via QUALITY_URL_CHECK_ENABLED=False.")

        try:
            with httpx.Client(
                timeout=settings.QUALITY_URL_CHECK_TIMEOUT,
                follow_redirects=True,
                headers={"User-Agent": "BuildFeed-QualityChecker/1.0"},
            ) as client:
                response = client.head(url)
                # Some servers don't support HEAD — fall back to GET with stream
                if response.status_code == 405:
                    response = client.get(url, extensions={"stream": True})
                    response.close()

            if response.status_code < 400:
                return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                          message=f"URL reachable (HTTP {response.status_code}).")
            elif response.status_code in (404, 410):
                return QualityCheckDetail(
                    check=check_name, passed=False, issue_code="broken_url",
                    message=f"URL returned HTTP {response.status_code} (not found / gone).",
                    score=0.0,
                )
            else:
                # 5xx, 429, etc. — flag rather than hard-reject (transient error)
                return QualityCheckDetail(
                    check=check_name, passed=True, issue_code="url_transient_error",
                    message=f"URL returned HTTP {response.status_code} (transient — not rejected).",
                    score=0.6,
                )
        except httpx.TimeoutException:
            return QualityCheckDetail(
                check=check_name, passed=False, issue_code="url_timeout",
                message=f"URL timed out after {settings.QUALITY_URL_CHECK_TIMEOUT}s.",
                score=0.0,
            )
        except httpx.RequestError as exc:
            return QualityCheckDetail(
                check=check_name, passed=False, issue_code="url_unreachable",
                message=f"URL unreachable: {str(exc)[:120]}",
                score=0.0,
            )

    def _check_spam(self, item: ContentItem) -> QualityCheckDetail:
        """
        Heuristic spam / low-quality signal detection.
        Checks:
          - Title length below minimum
          - Title is a known zero-signal placeholder
          - ALL CAPS title (>70% uppercase letters)
          - Known spam regex patterns in title + description
          - Excessive punctuation density
        """
        check_name = "spam_low_quality"
        title = (item.title or "").strip()
        desc = (item.description or "").strip()
        combined = f"{title} {desc}".lower()

        issues: List[str] = []

        # Minimum title length
        if len(title) < settings.QUALITY_MIN_TITLE_LENGTH:
            issues.append(f"Title too short ({len(title)} chars, min {settings.QUALITY_MIN_TITLE_LENGTH}).")

        # Zero-signal titles
        if title.lower() in _ZERO_SIGNAL_TITLES:
            issues.append(f"Title is a known zero-signal placeholder: \"{title}\".")

        # ALL CAPS check (ignore short all-caps acronyms like "API", "LLM")
        if len(title) > 15:
            alpha_chars = [c for c in title if c.isalpha()]
            if alpha_chars and sum(1 for c in alpha_chars if c.isupper()) / len(alpha_chars) > 0.70:
                issues.append("Title is predominantly uppercase (possible spam).")

        # Spam pattern matching
        for pattern in _SPAM_PATTERNS:
            if pattern.search(combined):
                issues.append(f"Spam pattern detected: {pattern.pattern[:60]}")
                break  # One match is enough

        # Excessive punctuation density (>15% of chars are punctuation)
        if len(title) > 10:
            punct_count = sum(1 for c in title if c in "!?.,;:@#$%^&*()[]{}<>|\\~/`\"'")
            if punct_count / len(title) > 0.15:
                issues.append(f"Excessive punctuation density ({punct_count}/{len(title)} chars).")

        if issues:
            return QualityCheckDetail(
                check=check_name, passed=False, issue_code="spam_detected",
                message=" | ".join(issues),
                score=0.0,
            )
        return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                  message="No spam signals detected.")

    def _check_unsafe_irrelevant(self, item: ContentItem) -> QualityCheckDetail:
        """
        Two sub-checks combined:
        a) Unsafe / blocked content: keyword scan against _UNSAFE_KEYWORDS.
        b) Relevance gate: at least one tech signal must appear somewhere in the
           item's searchable text, unless the content_type is inherently technical.

        The relevance gate exists because Hacker News (and similar RSS feeds) include
        commentary, opinion pieces, and off-topic threads that have no place in a
        developer-focused feed.
        """
        check_name = "unsafe_irrelevant"
        title = (item.title or "").lower()
        desc = (item.description or "").lower()
        combined = f"{title} {desc}"

        # a) Unsafe keyword scan
        for kw in _UNSAFE_KEYWORDS:
            if kw in combined:
                return QualityCheckDetail(
                    check=check_name, passed=False, issue_code="unsafe_content",
                    message=f"Blocked keyword detected: \"{kw}\".",
                    score=0.0,
                )

        # b) Relevance gate — skip for inherently technical content types
        if item.content_type in _ALWAYS_RELEVANT_TYPES:
            return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                      message=f"Content type '{item.content_type}' is always relevant.")

        # For articles and other RSS-sourced items, require at least one tech signal
        raw_meta_text = ""
        if item.raw_metadata and isinstance(item.raw_metadata, dict):
            raw_meta_text = " ".join(str(v) for v in item.raw_metadata.values()).lower()

        searchable = f"{combined} {raw_meta_text}"
        has_tech_signal = any(signal in searchable for signal in _TECH_RELEVANCE_SIGNALS)

        if not has_tech_signal:
            return QualityCheckDetail(
                check=check_name, passed=False, issue_code="not_relevant",
                message="No technology/programming signals found — content appears off-topic for BuildFeed.",
                score=0.0,
            )

        return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                  message="Content passes relevance and safety checks.")

    def _check_metadata(self, item: ContentItem) -> QualityCheckDetail:
        """
        Validates that the item has sufficient metadata to be useful.
        Missing fields are soft-fails (flagged, not rejected).

        Required (hard-fail → rejection handled by _aggregate severity logic):
          - title (already enforced by the DB NOT NULL constraint + spam check)
          - source_url (already enforced)

        Recommended (soft-fail → flagged):
          - description OR non-empty raw_metadata
          - published_at (for articles and papers)
          - author (for articles and papers)
        """
        check_name = "missing_metadata"
        missing: List[str] = []

        if not item.description and (
            not item.raw_metadata or item.raw_metadata == {}
        ):
            missing.append("description")

        if item.content_type in ("article", "research_paper"):
            if not item.published_at:
                missing.append("published_at")
            if not item.author:
                missing.append("author")

        if missing:
            return QualityCheckDetail(
                check=check_name, passed=False, issue_code="missing_metadata",
                message=f"Missing recommended fields: {', '.join(missing)}.",
                score=0.4,  # soft-fail: non-zero score so _aggregate can flag vs reject
            )
        return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                  message="All recommended metadata fields present.")

    def _check_freshness(self, item: ContentItem) -> QualityCheckDetail:
        """
        Flags articles and research papers published beyond QUALITY_MAX_AGE_DAYS.
        GitHub repos, videos, and items with no published_at are exempt.
        """
        check_name = "freshness"
        exempt_types = {"github_repo", "ai_tool", "video", "image"}

        if item.content_type in exempt_types:
            return QualityCheckDetail(check=check_name, passed=True, score=1.0,
                                      message=f"Content type '{item.content_type}' is exempt from freshness check.")

        if not item.published_at:
            return QualityCheckDetail(check=check_name, passed=True, score=0.8,
                                      message="No published_at date — freshness cannot be evaluated.")

        now = utc_now()
        # Ensure published_at is timezone-aware for comparison
        pub = item.published_at
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=timezone.utc)

        age_days = (now - pub).days
        max_age = settings.QUALITY_MAX_AGE_DAYS

        if age_days > max_age:
            return QualityCheckDetail(
                check=check_name, passed=False, issue_code="stale_content",
                message=f"Content is {age_days} days old (threshold: {max_age} days).",
                score=0.3,  # soft-fail score — _aggregate will flag, not reject
            )

        # Score decays linearly from 1.0 (today) to 0.5 (at max_age boundary)
        freshness_score = max(0.5, 1.0 - (age_days / max_age) * 0.5)
        return QualityCheckDetail(check=check_name, passed=True, score=round(freshness_score, 3),
                                  message=f"Content is {age_days} days old (within {max_age}-day threshold).")

    # ------------------------------------------------------------------
    # Aggregation logic
    # ------------------------------------------------------------------

    def _aggregate(
        self,
        checks: List[QualityCheckDetail],
    ) -> Tuple[str, List[str], float]:
        """
        Combine individual check results into a final quality_status.

        Rules:
          - "rejected" if ANY of these checks hard-failed (score == 0.0):
              duplicate, broken_url, spam_low_quality, unsafe_irrelevant
          - "flagged"  if no hard-fail but ANY check failed with score > 0.0:
              missing_metadata, freshness (soft-fails)
          - "passed"   if all checks passed
        """
        # Checks that cause a hard rejection when they fail
        HARD_REJECT_CHECKS = {"duplicate", "broken_url", "spam_low_quality", "unsafe_irrelevant"}

        quality_issues: List[str] = []
        hard_failed = False
        soft_failed = False

        for chk in checks:
            if not chk.passed and chk.issue_code:
                quality_issues.append(chk.issue_code)
                if chk.check in HARD_REJECT_CHECKS and chk.score == 0.0:
                    hard_failed = True
                else:
                    soft_failed = True

        if hard_failed:
            quality_status = "rejected"
        elif soft_failed:
            quality_status = "flagged"
        else:
            quality_status = "passed"

        # Weighted average score (equal weights across all checks)
        overall_score = sum(c.score for c in checks) / len(checks) if checks else 0.0

        return quality_status, quality_issues, overall_score

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _word_bigrams(text: str) -> Set[str]:
        """Return the set of consecutive word-pair bigrams from a normalised title."""
        words = re.findall(r"[a-z0-9]+", text.lower())
        if len(words) < 2:
            return set()
        return {f"{words[i]} {words[i+1]}" for i in range(len(words) - 1)}

    @staticmethod
    def _jaccard(set_a: Set[str], set_b: Set[str]) -> float:
        """Jaccard similarity between two sets."""
        if not set_a or not set_b:
            return 0.0
        intersection = len(set_a & set_b)
        union = len(set_a | set_b)
        return intersection / union if union else 0.0

    @staticmethod
    def _build_report_from_item(item: ContentItem) -> ItemQualityReport:
        """Reconstruct an ItemQualityReport from persisted item data (no re-check)."""
        # Rebuild minimal check details from stored quality_score dict
        score_map: Dict[str, float] = item.quality_score or {}
        issues: List[str] = item.quality_issues or []

        checks = [
            QualityCheckDetail(
                check=check_name,
                passed=(check_name not in issues and check_name not in
                        {_code_to_check(c) for c in issues}),
                score=score_map.get(check_name, 1.0),
            )
            for check_name in ("duplicate", "broken_url", "spam_low_quality",
                               "unsafe_irrelevant", "missing_metadata", "freshness")
        ]
        overall = sum(c.score for c in checks) / len(checks) if checks else 0.0

        return ItemQualityReport(
            item_id=item.id,
            title=item.title,
            content_type=item.content_type,
            quality_status=item.quality_status or "pending",
            quality_issues=issues,
            checks=checks,
            overall_score=round(overall, 3),
            checked_at=item.quality_checked_at,
        )


def _code_to_check(issue_code: str) -> str:
    """Map an issue code back to its parent check name."""
    mapping = {
        "near_duplicate": "duplicate",
        "broken_url": "broken_url",
        "invalid_url_scheme": "broken_url",
        "url_timeout": "broken_url",
        "url_unreachable": "broken_url",
        "url_transient_error": "broken_url",
        "spam_detected": "spam_low_quality",
        "unsafe_content": "unsafe_irrelevant",
        "not_relevant": "unsafe_irrelevant",
        "missing_metadata": "missing_metadata",
        "stale_content": "freshness",
    }
    return mapping.get(issue_code, issue_code)


# Module-level singleton
content_quality_service = ContentQualityService()
