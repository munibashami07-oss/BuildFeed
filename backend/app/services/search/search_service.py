"""
Search Service — Module 18: Global Search

Strategy
─────────
1. Text search  — SQLAlchemy ILIKE across title, description, and the
                  ai_metadata JSON field (cast to text so topics/technologies
                  are searchable without per-row JSON parsing in Python).
2. Semantic search — reuse embedding_service.semantic_search() (cosine
                  similarity over GEMINI embeddings). Falls back gracefully
                  when no API key is configured or no embeddings exist.
3. Merge & deduplicate — combine both result sets, keeping the highest score
                  for items that appear in both.
4. Interest boost — items whose topics/technologies intersect with the
                  authenticated user's interests get a small score bump so
                  they sort higher, but non-matching items are never excluded.
5. Content type filter — applied to both text and semantic searches.
6. Pagination — applied after merge+sort, so limit/offset are consistent.

No new DB tables are created.
"""

import logging
import re
from typing import Any, Dict, List, Optional, Set
from uuid import UUID

from sqlalchemy import cast, or_, func
from sqlalchemy.dialects.postgresql import TEXT
from sqlalchemy.orm import Session

from app.models.content_item import ContentItem
from app.models.saved_content import SavedContent
from app.services.embedding.embedding_service import embedding_service
from app.core.config import settings

logger = logging.getLogger(__name__)

# Weight given to semantic similarity vs text match baseline score
_SEMANTIC_WEIGHT = 1.0
_TEXT_MATCH_BASE = 0.5        # text-only matches start at this score
_INTEREST_BOOST  = 0.12       # added to score when item matches user interests


class SearchService:

    # ── Text search ──────────────────────────────────────────────────────────

    def _text_search(
        self,
        db: Session,
        query: str,
        content_type: Optional[str],
        limit: int,
    ) -> List[Dict[str, Any]]:
        """
        ILIKE search across title, description, and ai_metadata cast to text.
        Returns list of {item, score, match_type}.
        """
        pattern = f"%{query}%"

        q = db.query(ContentItem).filter(
            or_(
                ContentItem.title.ilike(pattern),
                ContentItem.description.ilike(pattern),
                # Cast JSON ai_metadata column to text for substring search
                cast(ContentItem.ai_metadata, TEXT).ilike(pattern),
            )
        )

        if content_type:
            from app.services.feed.feed_service import normalize_content_type
            target_types = normalize_content_type(content_type)
            if target_types:
                q = q.filter(ContentItem.content_type.in_(target_types))

        # Prioritise items whose title contains the query over description-only matches
        items = q.order_by(ContentItem.discovered_at.desc()).limit(limit * 3).all()

        results = []
        query_lower = query.lower()
        for item in items:
            # Give a higher score to title matches
            if query_lower in item.title.lower():
                score = _TEXT_MATCH_BASE + 0.2
            else:
                score = _TEXT_MATCH_BASE
            results.append({"item": item, "score": score, "match_type": "text"})

        return results

    # ── Semantic search ───────────────────────────────────────────────────────

    def _semantic_search(
        self,
        db: Session,
        query: str,
        content_type: Optional[str],
        limit: int,
    ) -> tuple[List[Dict[str, Any]], bool]:
        """
        Reuse embedding_service.semantic_search().
        Returns (results, used_semantic) — used_semantic=False when unavailable.
        """
        if not settings.GEMINI_API_KEY:
            logger.debug("Semantic search skipped — GEMINI_API_KEY not configured.")
            return [], False

        try:
            raw = embedding_service.semantic_search(
                db,
                query_text=query,
                content_type=content_type,
                limit=limit,
            )
            results = [
                {
                    "item": r["item"],
                    "score": r["similarity_score"] * _SEMANTIC_WEIGHT,
                    "match_type": "semantic",
                }
                for r in raw
            ]
            return results, True
        except Exception as exc:
            logger.warning("Semantic search failed (falling back to text): %s", exc)
            return [], False

    # ── Interest boost ────────────────────────────────────────────────────────

    @staticmethod
    def _interest_terms(user_interests: List[str]) -> Set[str]:
        """Lower-case set of interest words for fast matching."""
        terms: Set[str] = set()
        for interest in user_interests:
            for word in re.split(r"[\s,/]+", interest.lower()):
                if word:
                    terms.add(word)
        return terms

    @staticmethod
    def _item_matches_interests(item: ContentItem, interest_terms: Set[str]) -> bool:
        if not interest_terms:
            return False
        meta = item.ai_metadata or {}
        item_terms: Set[str] = set()
        for field in ("topics", "technologies", "skills"):
            for val in meta.get(field) or []:
                item_terms.update(re.split(r"[\s,/]+", val.lower()))
        item_terms.update(re.split(r"[\s,/]+", item.title.lower()))
        return bool(item_terms & interest_terms)

    # ── Saved-state lookup ────────────────────────────────────────────────────

    @staticmethod
    def _saved_ids(db: Session, user_id: UUID) -> Set[str]:
        rows = (
            db.query(SavedContent.content_item_id)
            .filter(SavedContent.user_id == user_id)
            .all()
        )
        return {str(r[0]) for r in rows}

    # ── Public API ────────────────────────────────────────────────────────────

    def search(
        self,
        db: Session,
        user_id: UUID,
        query: str,
        content_type: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        user_interests: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Run text + semantic search, merge, boost by interests, paginate.

        Returns a dict matching SearchResponse schema.
        """
        query = query.strip()
        if not query:
            return {
                "results": [],
                "total": 0,
                "query": query,
                "content_type_filter": content_type,
                "has_more": False,
                "used_semantic": False,
            }

        fetch_limit = max(limit * 4, 60)  # fetch more than needed before pagination

        # Record search query for behavioral personalization
        if user_id and query:
            try:
                from app.models.user_search_query import UserSearchQuery
                search_log = UserSearchQuery(user_id=user_id, query=query[:255])
                db.add(search_log)
                db.commit()
            except Exception as err:
                db.rollback()
                logger.debug("Failed to record search query: %s", err)

        # 1. Text search
        text_results = self._text_search(db, query, content_type, fetch_limit)

        # 2. Semantic search
        semantic_results, used_semantic = self._semantic_search(
            db, query, content_type, fetch_limit
        )

        # 3. Merge by item ID — keep highest score per item; track match_type
        merged: Dict[str, Dict[str, Any]] = {}
        for r in text_results:
            key = str(r["item"].id)
            if key not in merged or r["score"] > merged[key]["score"]:
                merged[key] = r

        for r in semantic_results:
            key = str(r["item"].id)
            if key not in merged:
                merged[key] = r
            else:
                # Both text and semantic matched — take average + bonus
                combined_score = (merged[key]["score"] + r["score"]) / 2 + 0.05
                merged[key] = {
                    "item": r["item"],
                    "score": combined_score,
                    "match_type": "hybrid",
                }

        # 4. Interest boost
        interest_terms = self._interest_terms(user_interests or [])
        for key, r in merged.items():
            if self._item_matches_interests(r["item"], interest_terms):
                r["score"] += _INTEREST_BOOST
                r["interest_boost"] = True
            else:
                r["interest_boost"] = False

        # 5. Sort by score descending
        ranked = sorted(merged.values(), key=lambda x: x["score"], reverse=True)

        # 6. Saved-state lookup for this user
        saved_ids = self._saved_ids(db, user_id)

        # 7. Build response items
        total = len(ranked)
        page_items = ranked[offset: offset + limit]

        results = []
        for r in page_items:
            item: ContentItem = r["item"]
            results.append(
                {
                    "id": item.id,
                    "content_type": item.content_type,
                    "title": item.title,
                    "description": item.description,
                    "source_url": item.source_url,
                    "author": item.author,
                    "thumbnail_url": item.thumbnail_url,
                    "published_at": item.published_at,
                    "discovered_at": item.discovered_at,
                    "ai_metadata": item.ai_metadata,
                    "similarity_score": round(r["score"], 4),
                    "match_type": r["match_type"],
                    "interest_boost": r.get("interest_boost", False),
                    "is_saved": str(item.id) in saved_ids,
                }
            )

        return {
            "results": results,
            "total": total,
            "query": query,
            "content_type_filter": content_type,
            "has_more": (offset + limit) < total,
            "used_semantic": used_semantic,
        }


search_service = SearchService()
