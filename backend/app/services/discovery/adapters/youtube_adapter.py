import logging
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from app.core.config import settings
from app.models.content_source import ContentSource
from app.services.discovery.adapters.base import BaseSourceAdapter, NormalizedItem

logger = logging.getLogger(__name__)

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


class YouTubeAdapter(BaseSourceAdapter):
    """
    Fetches videos via the official YouTube Data API v3 (search.list), the only video source
    wired up for now — this is a legitimate, permitted API, not scraping. Instagram/TikTok are
    intentionally out of scope: neither offers a public content-search API, and scraping or
    bypassing their restrictions is not something this adapter does.

    `source.base_url` holds the literal search query text for this source (not a URL) — e.g.
    "React tutorial for beginners". The adapter builds the actual API request itself so the
    YOUTUBE_API_KEY never has to appear in a stored ContentSource row.

    If YOUTUBE_API_KEY is not configured, this returns an empty list and logs a warning rather
    than failing the discovery cycle — same graceful-no-key pattern used by the AI Mentor and
    LinkedIn caption features elsewhere in this codebase.
    """

    def _fetch_video_transcript(self, video_id: str) -> Optional[str]:
        """
        Attempt to extract subtitles/transcript snippet to enable deep technical
        content evaluation by the AI processor. Falls back gracefully if unavailable.
        """
        if not video_id:
            return None
        try:
            from youtube_transcript_api import YouTubeTranscriptApi  # optional dependency
            transcript_data = YouTubeTranscriptApi.get_transcript(video_id, languages=["en", "en-US", "en-GB"])
            full_text = " ".join(t.get("text", "") for t in transcript_data)
            return full_text[:2500].strip() or None
        except Exception as exc:
            logger.debug("Could not fetch YouTube transcript for video %s: %s", video_id, exc)
        return None

    def fetch_items(self, source: ContentSource) -> List[NormalizedItem]:
        if not settings.YOUTUBE_API_KEY:
            logger.warning(
                "YouTube video discovery skipped for source '%s': YOUTUBE_API_KEY is not set.",
                source.name,
            )
            return []

        query = source.base_url or "software engineering project tutorial"
        items: List[NormalizedItem] = []

        params = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": 25 if source.last_fetched_at else 15,
            "order": "date" if source.last_fetched_at else "relevance",
            "safeSearch": "strict",
            "relevanceLanguage": "en",
            "key": settings.YOUTUBE_API_KEY,
        }
        # The official YouTube Data API supports publishedAfter. This turns subsequent cycles
        # into genuinely fresh searches instead of repeatedly returning the same relevant videos.
        if source.last_fetched_at:
            params["publishedAfter"] = source.last_fetched_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
            logger.info(
                "YouTube fresh discovery for '%s': videos published after %s.",
                source.name,
                source.last_fetched_at.isoformat(),
            )

        try:
            with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                res = client.get(YOUTUBE_SEARCH_URL, params=params)
                if res.status_code != 200:
                    logger.warning(
                        "YouTube Data API returned status %s for source %s: %s",
                        res.status_code, source.name, res.text[:200],
                    )
                    raise RuntimeError(f"YouTube Data API returned status {res.status_code} for source {source.name}")

                data = res.json()
                for entry in data.get("items", []):
                    video_id = (entry.get("id") or {}).get("videoId")
                    snippet = entry.get("snippet") or {}
                    if not video_id or not snippet.get("title"):
                        continue

                    thumbnails = snippet.get("thumbnails") or {}
                    thumb = (
                        thumbnails.get("high")
                        or thumbnails.get("medium")
                        or thumbnails.get("default")
                        or {}
                    )

                    published_at = None
                    p_str = snippet.get("publishedAt")
                    if p_str:
                        try:
                            published_at = datetime.fromisoformat(p_str.replace("Z", "+00:00"))
                        except Exception:
                            published_at = None

                    transcript_snippet = self._fetch_video_transcript(video_id)

                    items.append(
                        NormalizedItem(
                            external_id=f"youtube:{video_id}",
                            content_type="video",
                            title=snippet["title"],
                            source_url=f"https://www.youtube.com/watch?v={video_id}",
                            description=snippet.get("description") or "",
                            author=snippet.get("channelTitle"),
                            thumbnail_url=thumb.get("url"),
                            published_at=published_at,
                            raw_metadata={
                                "video_id": video_id,
                                "channel_id": snippet.get("channelId"),
                                "channel_title": snippet.get("channelTitle"),
                                "search_query": query,
                                "transcript_snippet": transcript_snippet,
                                "source": "youtube",
                            },
                        )
                    )
        except Exception as e:
            logger.error("Error fetching YouTube items from query '%s': %s", query, e)
            raise e

        return items
