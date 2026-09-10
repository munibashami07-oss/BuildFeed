"""Public external URL import for Saved/Projects.

Only publicly accessible HTTP(S) pages are fetched. The fetcher explicitly
honors robots.txt, blocks private/reserved IP destinations, and does not
attempt authentication or access-control bypasses.
"""

import hashlib
import ipaddress
import logging
import re
import socket
from html import unescape
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.content_item import ContentItem
from app.models.content_source import ContentSource
from app.services.ai.ai_processor import ai_processor
from app.services.focus.focus_gate_service import focus_gate_service
from app.services.saved.saved_service import saved_content_service

logger = logging.getLogger(__name__)

_USER_AGENT = "BuildFeedExternalImporter/1.0 (+public-url-import)"
_MAX_HTML_BYTES = 1_500_000
_MAX_TEXT_CHARS = 30_000
_MAX_REDIRECTS = 5


def _clean(value: Optional[str], limit: int = 2000) -> Optional[str]:
    if not value:
        return None
    value = unescape(re.sub(r"\s+", " ", value)).strip()
    return value[:limit] or None


def _is_public_hostname(hostname: str) -> None:
    if not hostname:
        raise ValueError("The URL must include a hostname.")
    if hostname.lower() in {"localhost", "localhost.localdomain"} or hostname.endswith(".local"):
        raise ValueError("Local/private URLs are not allowed.")
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(hostname, None)}
    except socket.gaierror as exc:
        raise ValueError("The URL hostname could not be resolved.") from exc
    for raw in addresses:
        ip = ipaddress.ip_address(raw)
        if not ip.is_global:
            raise ValueError("The URL must resolve to a public internet address.")


def _validate_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only public HTTP(S) URLs are supported.")
    if parsed.username or parsed.password:
        raise ValueError("URLs containing embedded credentials are not allowed.")
    if parsed.fragment:
        # Fragments are client-side and should not affect the fetched document.
        parsed = parsed._replace(fragment="")
    normalized = parsed.geturl()
    _is_public_hostname(parsed.hostname or "")
    return normalized


def _robots_allowed(client: httpx.Client, url: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    try:
        response = client.get(robots_url, headers={"User-Agent": _USER_AGENT}, follow_redirects=False)
    except httpx.HTTPError as exc:
        raise ValueError("Could not verify robots.txt for this site; import was not attempted.") from exc

    if response.status_code == 404:
        return True
    if 200 <= response.status_code < 300:
        parser = RobotFileParser()
        parser.set_url(robots_url)
        parser.parse(response.text.splitlines())
        return parser.can_fetch(_USER_AGENT, url)
    # Treat inaccessible robots policy as non-importable rather than bypassing it.
    raise ValueError("This site's robots.txt could not be verified, so BuildFeed will not fetch it.")


def _extract_metadata(html: str, final_url: str) -> Tuple[Dict[str, Any], str]:
    """Extract metadata from ordinary pages and JS-heavy social pages."""
    def _attrs(tag: str) -> Dict[str, str]:
        attrs: Dict[str, str] = {}
        for match in re.finditer(r'''([:\w-]+)\s*=\s*(["'])(.*?)\2''', tag, re.I | re.S):
            attrs[match.group(1).lower()] = unescape(match.group(3)).strip()
        return attrs

    meta_values: Dict[str, str] = {}
    for match in re.finditer(r"<meta\b[^>]*>", html, re.I | re.S):
        attrs = _attrs(match.group(0))
        key = (attrs.get("property") or attrs.get("name") or attrs.get("itemprop") or "").lower()
        value = attrs.get("content")
        if key and value:
            meta_values[key] = value

    def meta(*names: str) -> Optional[str]:
        for name in names:
            value = meta_values.get(name.lower())
            if value:
                return _clean(value, 3000)
        return None

    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = _clean(title_match.group(1), 500) if title_match else None
    title = meta("og:title", "twitter:title", "title") or title or urlparse(final_url).netloc
    description = meta("og:description", "twitter:description", "description")
    author = meta("author", "article:author", "parsely-author")

    canonical_match = re.search(r'<link\b[^>]*\brel=["\'][^"\']*canonical[^"\']*["\'][^>]*\bhref=["\']([^"\']+)', html, re.I | re.S)
    if not canonical_match:
        canonical_match = re.search(r'<link\b[^>]*\bhref=["\']([^"\']+)["\'][^>]*\brel=["\'][^"\']*canonical[^"\']*["\']', html, re.I | re.S)
    canonical = urljoin(final_url, canonical_match.group(1)) if canonical_match else final_url
    thumbnail = meta("og:image", "twitter:image", "twitter:image:src")
    site_name = meta("og:site_name", "application-name")
    media_type = meta("og:type", "twitter:card")

    json_ld: list[Any] = []
    for match in re.finditer(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.I | re.S):
        raw = match.group(1).strip()
        if not raw:
            continue
        try:
            import json
            parsed = json.loads(unescape(raw))
            if isinstance(parsed, list):
                json_ld.extend(parsed[:10])
            else:
                json_ld.append(parsed)
        except (ValueError, TypeError):
            continue

    structured_text: list[str] = []
    structured_author = author
    for obj in json_ld:
        if not isinstance(obj, dict):
            continue
        if not title and isinstance(obj.get("name"), str):
            title = _clean(obj["name"], 500)
        if not description and isinstance(obj.get("description"), str):
            description = _clean(obj["description"], 3000)
        if not structured_author:
            author_obj = obj.get("author")
            if isinstance(author_obj, dict):
                structured_author = _clean(author_obj.get("name"), 500)
            elif isinstance(author_obj, list) and author_obj and isinstance(author_obj[0], dict):
                structured_author = _clean(author_obj[0].get("name"), 500)
            elif isinstance(author_obj, str):
                structured_author = _clean(author_obj, 500)
        for key in ("articleBody", "text", "description", "headline", "caption", "name"):
            value = obj.get(key)
            if isinstance(value, str):
                structured_text.append(value)

    visible = re.sub(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", html, flags=re.I | re.S)
    visible = re.sub(r"<[^>]+>", " ", visible)
    visible = _clean(visible, _MAX_TEXT_CHARS) or ""
    structured_excerpt = _clean(" ".join(structured_text), 12000) or ""
    combined_text = _clean(f"{visible} {structured_excerpt}", _MAX_TEXT_CHARS) or ""

    metadata = {
        "import_method": "external_url",
        "canonical_url": canonical,
        "site_name": site_name,
        "author": structured_author,
        "thumbnail_url": thumbnail,
        "media_type": media_type,
        "fetched_from": final_url,
        "page_title": title,
        "page_description": description,
        "page_text_excerpt": combined_text,
        "json_ld": json_ld[:10],
    }
    return metadata, combined_text

def _content_type(url: str, metadata: Dict[str, Any]) -> str:
    host = (urlparse(url).hostname or "").lower()
    if host == "github.com" or host.endswith(".github.com"):
        return "github_repo"
    if host in {"tiktok.com", "www.tiktok.com", "instagram.com", "www.instagram.com", "youtube.com", "www.youtube.com", "youtu.be", "x.com", "www.x.com", "twitter.com", "www.twitter.com", "linkedin.com", "www.linkedin.com", "reddit.com", "www.reddit.com"}:
        return "social_project"
    # Generic public pages remain compatible with the existing Saved/feed model.
    return "article"


def _social_host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().removeprefix("www.")


def _is_instagram_url(url: str) -> bool:
    host = _social_host(url)
    return host in {"instagram.com", "instagr.am"} and bool(
        re.match(r"^/(?:reel|reels|p|tv)/[^/?#]+", urlparse(url).path, re.I)
    )


def _is_tiktok_url(url: str) -> bool:
    host = _social_host(url)
    return host in {"tiktok.com", "vm.tiktok.com", "vt.tiktok.com"}


def _strip_tracking_query(url: str) -> str:
    parsed = urlparse(url)
    return parsed._replace(query="", fragment="").geturl()


def _social_oembed(client: httpx.Client, url: str) -> Optional[Tuple[str, Dict[str, Any], str]]:
    """Use first-party public oEmbed endpoints for supported social URLs.

    This does not authenticate, scrape a logged-in session, or disable robots
    rules for the original social page. It asks the platform's public embed
    endpoint for metadata that the platform exposes for public content.
    """
    clean_url = _strip_tracking_query(url)
    host = _social_host(clean_url)
    endpoint: Optional[str] = None
    provider = None

    if _is_instagram_url(clean_url):
        endpoint = "https://graph.facebook.com/v25.0/instagram_oembed"
        provider = "Instagram"
    elif _is_tiktok_url(clean_url):
        # TikTok's documented public oEmbed endpoint.
        endpoint = "https://www.tiktok.com/oembed"
        provider = "TikTok"
    else:
        return None

    try:
        response = client.get(
            endpoint,
            params={"url": clean_url},
            headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
            follow_redirects=True,
        )
    except httpx.HTTPError as exc:
        logger.info("%s public oEmbed request failed: %s", provider, exc)
        raise ValueError(f"{provider} did not expose public metadata for this URL.") from exc

    if response.status_code in {401, 403}:
        raise ValueError(f"{provider} requires access that BuildFeed will not bypass.")
    if response.status_code < 200 or response.status_code >= 300:
        raise ValueError(f"{provider} did not expose public metadata for this URL (HTTP {response.status_code}).")

    try:
        data = response.json()
    except ValueError as exc:
        raise ValueError(f"{provider} returned an invalid public metadata response.") from exc

    embed_html = data.get("html") if isinstance(data.get("html"), str) else ""
    # The oEmbed response can contain the public caption/description inside
    # the embed markup. Extract only text; never execute or persist the embed HTML.
    embed_text = ""
    if embed_html:
        embed_text = re.sub(r"<script\b[^>]*>.*?</script>", " ", embed_html, flags=re.I | re.S)
        embed_text = re.sub(r"<[^>]+>", " ", embed_text)
        embed_text = _clean(embed_text, 12000) or ""

    title = _clean(data.get("title"), 500)
    author = _clean(data.get("author_name"), 500)
    description = _clean(data.get("description"), 3000)
    if not description and embed_text:
        description = embed_text[:3000]
    if not title:
        title = f"{provider} public post"
        if author:
            title = f"{provider} post by {author}"

    metadata: Dict[str, Any] = {
        "import_method": f"{provider.lower()}_public_oembed",
        "provider": provider,
        "canonical_url": clean_url,
        "fetched_from": endpoint,
        "page_title": title,
        "page_description": description,
        "author": author,
        "thumbnail_url": _clean(data.get("thumbnail_url"), 2000),
        "media_type": _clean(data.get("type"), 100),
        "provider_url": _clean(data.get("provider_url"), 500),
        "embed_width": data.get("width"),
        "embed_height": data.get("height"),
        "public_metadata": {
            key: value for key, value in data.items()
            if key not in {"html"}
        },
    }
    text = _clean(f"{title} {description or ''} {embed_text}", _MAX_TEXT_CHARS) or title
    return clean_url, metadata, text


class ExternalImportService:
    def fetch_public_page(self, url: str) -> Tuple[str, Dict[str, Any], str]:
        current_url = _validate_url(url)
        timeout = httpx.Timeout(15.0, connect=8.0)
        with httpx.Client(timeout=timeout, headers={"User-Agent": _USER_AGENT}) as client:
            # Instagram and TikTok public posts are handled through their
            # first-party public oEmbed endpoints. This avoids scraping a
            # robots-disallowed social page and does not bypass access control.
            social_result = _social_oembed(client, current_url)
            if social_result:
                final_url, metadata, text = social_result
                metadata["page_text_excerpt"] = text
                return final_url, metadata, text

            for _ in range(_MAX_REDIRECTS + 1):
                current_url = _validate_url(current_url)
                if not _robots_allowed(client, current_url):
                    raise ValueError("This URL is disallowed by robots.txt.")

                try:
                    response = client.get(current_url, follow_redirects=False)
                except httpx.HTTPError as exc:
                    raise ValueError("The public page could not be fetched.") from exc

                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise ValueError("The page returned an invalid redirect.")
                    current_url = urljoin(current_url, location)
                    # A short-link redirect may land on TikTok. Give its
                    # first-party oEmbed endpoint the normalized destination.
                    social_result = _social_oembed(client, current_url)
                    if social_result:
                        final_url, metadata, text = social_result
                        metadata["page_text_excerpt"] = text
                        return final_url, metadata, text
                    continue

                if response.status_code in {401, 403}:
                    raise ValueError("The page requires access that BuildFeed will not bypass.")
                if response.status_code < 200 or response.status_code >= 300:
                    raise ValueError(f"The public page returned HTTP {response.status_code}.")

                content_type = response.headers.get("content-type", "").lower()
                if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
                    raise ValueError("The URL does not point to a supported public HTML page.")
                if len(response.content) > _MAX_HTML_BYTES:
                    raise ValueError("The public page is too large to import.")

                metadata, text = _extract_metadata(response.text, current_url)
                return current_url, metadata, text

        raise ValueError("Too many redirects while fetching the public page.")

    def _get_or_create_source(self, db: Session, source_url: str) -> ContentSource:
        parsed = urlparse(source_url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        source = (
            db.query(ContentSource)
            .filter(ContentSource.source_type == "external_url", ContentSource.base_url == base_url)
            .first()
        )
        if source:
            return source
        source = ContentSource(name=f"External: {parsed.netloc}", source_type="external_url", base_url=base_url)
        db.add(source)
        db.flush()
        return source

    def analyze_and_prepare(self, db: Session, url: str, user_id=None) -> Dict[str, Any]:
        final_url, metadata, html = self.fetch_public_page(url)
        page_metadata, page_text = _extract_metadata(html, final_url)
        metadata.update(page_metadata)
        title = _clean(metadata.get("page_title"), 500) or urlparse(final_url).netloc
        description = _clean(metadata.get("page_description"), 3000) or page_text[:500] or None
        ctype = _content_type(final_url, metadata)

        analysis = ai_processor.analyze_item(
            title=title,
            description=description,
            content_type=ctype,
            raw_metadata={**metadata, "page_text_excerpt": page_text},
        )

        source = self._get_or_create_source(db, final_url)
        external_id = hashlib.sha256(final_url.encode("utf-8")).hexdigest()[:64]
        item = (
            db.query(ContentItem)
            .filter(ContentItem.source_id == source.id, ContentItem.external_id == external_id)
            .first()
        )
        if not item:
            item = ContentItem(
                source_id=source.id,
                external_id=external_id,
                content_type=ctype,
                title=title,
                description=analysis.short_summary or description,
                source_url=final_url,
                author=metadata.get("author"),
                thumbnail_url=metadata.get("thumbnail_url"),
                raw_metadata=metadata,
                status="completed",
                ai_metadata=analysis.model_dump(),
            )
            db.add(item)
        else:
            item.title = title
            item.description = analysis.short_summary or description
            item.source_url = final_url
            item.author = metadata.get("author")
            item.thumbnail_url = metadata.get("thumbnail_url")
            item.raw_metadata = metadata
            item.status = "completed"
            item.ai_metadata = analysis.model_dump()
        db.commit()
        db.refresh(item)

        plan = focus_gate_service.generate_external_project_plan(db, item_id=item.id)
        return {
            "item_id": item.id,
            "title": item.title,
            "description": item.description,
            "source_url": item.source_url,
            "content_type": item.content_type,
            "author": item.author,
            "metadata": item.raw_metadata or {},
            "analysis": analysis.model_dump(),
            "project_plan": plan.model_dump(),
            "is_saved": bool(user_id and saved_content_service.is_item_saved(db, user_id=user_id, item_id=item.id)),
        }

    def save_analyzed_item(self, db: Session, user_id, item_id: Any):
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item or not (item.raw_metadata or {}).get("import_method") == "external_url":
            raise ValueError("External imported item not found.")
        return saved_content_service.save_item(db, user_id=user_id, item_id=item_id)


external_import_service = ExternalImportService()
