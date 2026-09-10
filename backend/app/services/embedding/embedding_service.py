import json
import logging
import math
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.content_item import ContentItem
from app.schemas.embedding import EmbeddingBatchResponse, EmbeddingStatusSummary

logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc)


import functools
from typing import Tuple




@functools.lru_cache(maxsize=1024)
def _cached_embedding_vector(api_key: str, model: str, text: str) -> Tuple[float, ...]:
    """
    Call the Gemini Embeddings API (text-embedding-004 or similar).

    Endpoint:  POST /v1beta/models/{model}:embedContent?key={api_key}
    Request:   { "content": { "parts": [{ "text": "..." }] } }
    Response:  { "embedding": { "values": [...] } }
    """
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:embedContent?key={api_key}"
    )
    payload = {
        "model": f"models/{model}",
        "content": {
            "parts": [{"text": text}]
        },
    }
    headers = {"Content-Type": "application/json"}

    res = httpx.post(url, headers=headers, json=payload, timeout=20.0)
    if res.status_code != 200:
        raise RuntimeError(f"Gemini Embeddings API error [{res.status_code}]: {res.text}")

    res_data = res.json()
    try:
        vector = res_data["embedding"]["values"]
    except (KeyError, TypeError) as exc:
        raise RuntimeError(f"Unexpected Gemini embedding response structure: {res_data}") from exc

    return tuple(vector)


class EmbeddingService:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_EMBEDDING_MODEL

    def build_composite_text(self, item: ContentItem) -> str:
        """Construct rich composite text representation (title + summary + topics + technologies + skills)."""
        parts = [f"Title: {item.title}"]

        if item.ai_metadata and isinstance(item.ai_metadata, dict):
            meta = item.ai_metadata
            if meta.get("short_summary"):
                parts.append(f"Summary: {meta['short_summary']}")
            if meta.get("content_category"):
                parts.append(f"Category: {meta['content_category']}")
            if meta.get("topics"):
                parts.append(f"Topics: {', '.join(meta['topics'])}")
            if meta.get("technologies"):
                parts.append(f"Technologies: {', '.join(meta['technologies'])}")
            if meta.get("skills"):
                parts.append(f"Skills: {', '.join(meta['skills'])}")
            if meta.get("difficulty_level"):
                parts.append(f"Difficulty: {meta['difficulty_level']}")
        elif item.description:
            parts.append(f"Description: {item.description}")

        parts.append(f"Type: {item.content_type}")
        return "\n".join(parts)

    def get_embedding_vector(self, text: str) -> List[float]:
        """Call Gemini Embeddings API to generate embedding vector (cached safely)."""
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in settings or environment.")

        return list(_cached_embedding_vector(self.api_key, self.model, text))

    def process_item_embedding(self, db: Session, item_id: UUID, force: bool = False) -> ContentItem:
        """Generate and store embedding for a single ContentItem."""
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item:
            raise ValueError(f"ContentItem {item_id} not found.")

        if item.embedding_status == "completed" and item.embedding is not None and not force:
            logger.info("Item %s already has completed embedding. Skipping (force=False).", item_id)
            return item

        item.embedding_status = "processing"
        item.embedding_error = None
        db.commit()

        try:
            composite_text = self.build_composite_text(item)
            vector = self.get_embedding_vector(composite_text)

            item.embedding = vector
            item.embedding_status = "completed"
            item.embedded_at = utc_now()
            item.embedding_error = None
            db.commit()
            db.refresh(item)
            return item

        except Exception as e:
            db.rollback()
            err_msg = f"Embedding generation failed for item {item.id} ({item.title}): {str(e)}"
            logger.error(err_msg, exc_info=True)

            item.embedding_status = "failed"
            item.embedding_error = str(e)
            db.commit()
            db.refresh(item)
            return item

    def process_batch(self, db: Session, limit: int = 10, force: bool = False) -> EmbeddingBatchResponse:
        """Batch process pending/failed items for embeddings.

        Module 21: Items with quality_status='rejected' are excluded — no point
        generating embeddings for content that will never be served in the feed.
        """
        query = db.query(ContentItem)
        if not force:
            query = query.filter(ContentItem.embedding_status.in_(["pending", "discovered", "failed"]))
        # Exclude quality-rejected items regardless of force flag
        query = query.filter(ContentItem.quality_status != "rejected")

        items = query.order_by(ContentItem.created_at.asc()).limit(limit).all()

        completed_count = 0
        failed_count = 0
        errors: List[str] = []

        for item in items:
            try:
                processed_item = self.process_item_embedding(db, item.id, force=force)
                if processed_item.embedding_status == "completed":
                    completed_count += 1
                else:
                    failed_count += 1
                    if processed_item.embedding_error:
                        errors.append(processed_item.embedding_error)
            except Exception as e:
                failed_count += 1
                errors.append(str(e))

        return EmbeddingBatchResponse(
            total_items=len(items),
            completed=completed_count,
            failed=failed_count,
            errors=errors,
        )

    def get_status_summary(self, db: Session) -> EmbeddingStatusSummary:
        """Get counts of items by embedding status."""
        pending = db.query(ContentItem).filter(ContentItem.embedding_status.in_(["pending", "discovered"])).count()
        processing = db.query(ContentItem).filter(ContentItem.embedding_status == "processing").count()
        completed = db.query(ContentItem).filter(ContentItem.embedding_status == "completed").count()
        failed = db.query(ContentItem).filter(ContentItem.embedding_status == "failed").count()
        total = db.query(ContentItem).count()

        return EmbeddingStatusSummary(
            pending=pending,
            processing=processing,
            completed=completed,
            failed=failed,
            total=total,
        )

    @staticmethod
    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Compute cosine similarity between two vector lists (accelerated with NumPy)."""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0

        try:
            import numpy as np
            a = np.array(vec_a, dtype=np.float32)
            b = np.array(vec_b, dtype=np.float32)
            norm_a = np.linalg.norm(a)
            norm_b = np.linalg.norm(b)
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return float(np.dot(a, b) / (norm_a * norm_b))
        except Exception:
            dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
            norm_a = math.sqrt(sum(a * a for a in vec_a))
            norm_b = math.sqrt(sum(b * b for b in vec_b))
            if norm_a == 0.0 or norm_b == 0.0:
                return 0.0
            return dot_product / (norm_a * norm_b)

    def semantic_search(
        self,
        db: Session,
        query_text: str,
        content_type: Optional[str] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Perform semantic similarity search for a text query across embedded items."""
        query_vector = self.get_embedding_vector(query_text)

        query = db.query(ContentItem).filter(
            ContentItem.embedding_status == "completed",
            ContentItem.embedding.isnot(None),
        )
        if content_type:
            from app.services.feed.feed_service import normalize_content_type
            target_types = normalize_content_type(content_type)
            if target_types:
                query = query.filter(ContentItem.content_type.in_(target_types))

        candidates = query.all()
        results = []

        for item in candidates:
            if not item.embedding:
                continue
            sim = self.cosine_similarity(query_vector, item.embedding)
            results.append({"item": item, "similarity_score": round(sim, 4)})

        # Sort by similarity score descending
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:limit]

    def find_similar_items(
        self,
        db: Session,
        item_id: UUID,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """Find items semantically similar to a target ContentItem."""
        target = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not target:
            raise ValueError(f"ContentItem {item_id} not found.")

        if not target.embedding:
            target = self.process_item_embedding(db, item_id)
            if not target.embedding:
                raise ValueError(f"Could not generate embedding for ContentItem {item_id}.")

        target_vector = target.embedding

        candidates = (
            db.query(ContentItem)
            .filter(
                ContentItem.id != item_id,
                ContentItem.embedding_status == "completed",
                ContentItem.embedding.isnot(None),
            )
            .all()
        )

        results = []
        for item in candidates:
            if not item.embedding:
                continue
            sim = self.cosine_similarity(target_vector, item.embedding)
            results.append({"item": item, "similarity_score": round(sim, 4)})

        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:limit]


embedding_service = EmbeddingService()
