import logging
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from app.core.config import settings
from app.models.content_source import ContentSource
from app.services.discovery.adapters.base import BaseSourceAdapter, NormalizedItem

logger = logging.getLogger(__name__)


class GitHubAdapter(BaseSourceAdapter):
    """
    Fetches public repositories from the official GitHub REST Search API
    (https://api.github.com/search/repositories).

    `source.base_url` holds a full GitHub search API URL (e.g. one query per interest
    category — see DEFAULT_SOURCES in discovery_service.py). This adapter itself has no
    knowledge of "categories" — personalization happens later, at feed-serving time, in
    feed_service, exactly like every other content type already ingested here.

    Auth: if settings.GITHUB_TOKEN is set, it's sent as a Bearer token, raising the rate
    limit from 10 req/min (unauthenticated) to 30 req/min for the Search API. The token is
    read only from backend settings/env and is never sent to or exposed by the frontend.
    """

    def _fetch_repo_readme(self, full_name: str, client: httpx.Client, headers: dict) -> Optional[str]:
        """Fetch repo README snippet to verify code depth, architecture, and prerequisites."""
        try:
            readme_url = f"https://raw.githubusercontent.com/{full_name}/HEAD/README.md"
            r = client.get(readme_url, headers=headers, timeout=5.0)
            if r.status_code == 200 and r.text:
                return r.text[:2500].strip()
        except Exception as e:
            logger.debug("Failed to fetch README for repo %s: %s", full_name, e)
        return None

    def fetch_items(self, source: ContentSource) -> List[NormalizedItem]:
        items: List[NormalizedItem] = []
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "BuildFeed-Discovery-Bot/1.0",
        }
        if settings.GITHUB_TOKEN:
            headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"

        url = source.base_url
        if not url:
            url = "https://api.github.com/search/repositories?q=topic:ai+sort:stars-desc&per_page=15"

        if source.last_fetched_at:
            last_date = source.last_fetched_at.strftime("%Y-%m-%d")
            if "q=" in url and "pushed:" not in url:
                url = url.replace("q=", f"q=pushed%3A%3E%3D{last_date}+")
            if "sort=" in url:
                import re
                url = re.sub(r"sort=[^&]+", "sort=updated", url)
            if "per_page=" in url:
                import re
                url = re.sub(r"per_page=\d+", "per_page=30", url)

        try:
            with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                res = client.get(url, headers=headers)

                if res.status_code == 403 and "rate limit" in res.text.lower():
                    logger.warning(
                        "GitHub API rate limit hit for source %s. %s",
                        source.name,
                        "Set GITHUB_TOKEN in .env to raise the limit." if not settings.GITHUB_TOKEN else "",
                    )
                    return []
                if res.status_code != 200:
                    logger.warning("GitHub API returned status %s for source %s", res.status_code, source.name)
                    return []

                data = res.json()
                raw_repos = data.get("items", [])
                for repo in raw_repos:
                    full_name = repo.get("full_name") or str(repo.get("id"))
                    html_url = repo.get("html_url") or f"https://github.com/{full_name}"
                    owner = repo.get("owner", {}).get("login")
                    avatar_url = repo.get("owner", {}).get("avatar_url")
                    description = repo.get("description") or ""

                    # published_at = repo creation date (used for "discovered content age" sorting
                    # elsewhere); the more useful freshness signal — last push/update — is stored
                    # separately below in raw_metadata["updated_at"] per the spec.
                    p_at = None
                    p_str = repo.get("created_at")
                    if p_str:
                        try:
                            p_at = datetime.fromisoformat(p_str.replace("Z", "+00:00"))
                        except Exception:
                            p_at = None

                    topics = repo.get("topics", [])
                    is_ai = any("ai" in t or "ml" in t or "llm" in t for t in topics)
                    content_type = "ai_tool" if is_ai else "github_repo"

                    readme_snippet = self._fetch_repo_readme(full_name, client, headers)

                    items.append(
                        NormalizedItem(
                            external_id=f"github:{repo.get('id', full_name)}",
                            content_type=content_type,
                            title=repo.get("name") or full_name,
                            source_url=html_url,
                            description=description,
                            author=owner,
                            thumbnail_url=avatar_url,
                            published_at=p_at,
                            raw_metadata={
                                "full_name": full_name,
                                "stars": repo.get("stargazers_count", 0),
                                "stargazers_count": repo.get("stargazers_count", 0),  # kept for back-compat
                                "forks": repo.get("forks_count", 0),
                                "language": repo.get("language"),
                                "topics": topics,
                                "readme_snippet": readme_snippet,
                                "updated_at": repo.get("updated_at"),
                                "pushed_at": repo.get("pushed_at"),
                                "license": (repo.get("license") or {}).get("spdx_id"),
                                "open_issues_count": repo.get("open_issues_count"),
                                "source": "github",
                            },
                        )
                    )
        except Exception as e:
            logger.error("Error fetching GitHub items from %s: %s", source.base_url, e)
            raise e

        return items