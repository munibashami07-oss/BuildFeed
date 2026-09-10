from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.content_item import ContentItem
from app.schemas.discovery import ContentItemResponse
from app.schemas.embedding import (
    EmbeddingBatchResponse,
    EmbeddingStatusSummary,
    SemanticSearchRequest,
    SemanticSearchResultItem,
)
from app.schemas.search import SearchResponse, SearchResultItem
from app.services.embedding.embedding_service import embedding_service
from app.services.search.search_service import search_service

router = APIRouter(tags=["Embeddings & Semantic Search"])


@router.get("/embeddings/status", response_model=EmbeddingStatusSummary)
def get_embedding_status(db: Session = Depends(get_db)):
    """Get status summary counts of content items (pending, processing, completed, failed)."""
    return embedding_service.get_status_summary(db)


@router.post("/embeddings/process-all", response_model=EmbeddingBatchResponse)
def process_all_pending_embeddings(
    limit: int = Query(10, ge=1, le=100, description="Max number of items to embed in this batch"),
    force: bool = Query(False, description="Set to True to re-generate embeddings for completed items"),
    db: Session = Depends(get_db),
):
    """Trigger batch vector embedding generation for pending or failed content items."""
    return embedding_service.process_batch(db, limit=limit, force=force)


@router.post("/embeddings/items/{item_id}/process", response_model=ContentItemResponse)
def process_single_item_embedding(
    item_id: UUID,
    force: bool = Query(False, description="Set to True to force re-embedding if already completed"),
    db: Session = Depends(get_db),
):
    """Generate or re-generate embedding for a specific content item by ID."""
    item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ContentItem not found")

    result_item = embedding_service.process_item_embedding(db, item_id, force=force)
    return ContentItemResponse.model_validate(result_item)


@router.post("/search/semantic", response_model=List[SemanticSearchResultItem])
def search_semantic(
    req: SemanticSearchRequest,
    db: Session = Depends(get_db),
):
    """Perform semantic similarity search for a text query across embedded content."""
    try:
        raw_results = embedding_service.semantic_search(
            db,
            query_text=req.query,
            content_type=req.content_type,
            limit=req.limit,
        )
        return [
            SemanticSearchResultItem(
                item=ContentItemResponse.model_validate(res["item"]),
                similarity_score=res["similarity_score"],
            )
            for res in raw_results
        ]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/search/similar/{item_id}", response_model=List[SemanticSearchResultItem])
def get_similar_items(
    item_id: UUID,
    limit: int = Query(5, ge=1, le=20, description="Max number of similar items to return"),
    db: Session = Depends(get_db),
):
    """Find content items semantically similar to a given content item."""
    try:
        raw_results = embedding_service.find_similar_items(db, item_id=item_id, limit=limit)
        return [
            SemanticSearchResultItem(
                item=ContentItemResponse.model_validate(res["item"]),
                similarity_score=res["similarity_score"],
            )
            for res in raw_results
        ]
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ── Module 18: Global Search ──────────────────────────────────────────────────

@router.get("/search/content", response_model=SearchResponse, tags=["Global Search"])
def search_content(
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    content_type: Optional[str] = Query(
        None,
        description="Filter by content type: article, github_repo, research_paper, ai_tool, video, image",
    ),
    limit: int = Query(20, ge=1, le=50, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Global content search for the authenticated user.

    Combines text search (title, description, AI metadata) with semantic
    similarity search (GEMINI embeddings) when available. Results are
    personalised using the user's saved interests without excluding
    non-matching content.

    Returns SearchResponse with is_saved state for each result.
    """
    data = search_service.search(
        db,
        user_id=current_user.id,
        query=q,
        content_type=content_type or None,
        limit=limit,
        offset=offset,
        user_interests=list(current_user.interests or []),
    )
    return SearchResponse(
        results=[SearchResultItem(**r) for r in data["results"]],
        total=data["total"],
        query=data["query"],
        content_type_filter=data["content_type_filter"],
        has_more=data["has_more"],
        used_semantic=data["used_semantic"],
    )
