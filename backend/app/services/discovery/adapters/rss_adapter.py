import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List, Optional
import httpx
from app.models.content_source import ContentSource
from app.services.discovery.adapters.base import BaseSourceAdapter, NormalizedItem

logger = logging.getLogger(__name__)


class RSSFeedAdapter(BaseSourceAdapter):
    def fetch_items(self, source: ContentSource) -> List[NormalizedItem]:
        items: List[NormalizedItem] = []
        headers = {
            "User-Agent": "BuildFeed-Discovery-Bot/1.0",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml",
        }

        try:
            with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                res = client.get(source.base_url, headers=headers)
                if res.status_code != 200:
                    logger.warning("RSS Feed returned status %s for source %s", res.status_code, source.name)
                    raise RuntimeError(f"RSS Feed returned status {res.status_code} for source {source.name}")

                root = ET.fromstring(res.content)
                
                # Check RSS 2.0 vs Atom
                if root.tag.endswith("rss") or root.find("channel") is not None:
                    items = self._parse_rss2(root, source)
                elif root.tag.endswith("feed"):
                    items = self._parse_atom(root, source)
                else:
                    # Fallback search for items
                    channel = root.find("channel")
                    if channel is not None:
                        items = self._parse_rss2(root, source)

        except Exception as e:
            logger.error("Error fetching RSS feed from %s: %s", source.base_url, e)
            raise e

        return items

    def _parse_rss2(self, root: ET.Element, source: ContentSource) -> List[NormalizedItem]:
        items: List[NormalizedItem] = []
        channel = root.find("channel")
        if channel is None:
            channel = root

        for el in channel.findall("item"):
            title = el.findtext("title") or "Untitled"
            link = el.findtext("link") or ""
            guid = el.findtext("guid") or link
            description = el.findtext("description") or ""
            author = el.findtext("author") or el.findtext("{http://purl.org/dc/elements/1.1/}creator") or ""
            pub_date_str = el.findtext("pubDate") or el.findtext("{http://purl.org/dc/elements/1.1/}date")

            published_at = self._parse_date(pub_date_str)

            # Determine content type based on source name / URL
            content_type = "article"
            if "arxiv" in source.base_url.lower() or "arxiv" in source.name.lower():
                content_type = "research_paper"

            if not link:
                continue

            items.append(
                NormalizedItem(
                    external_id=guid if guid else link,
                    content_type=content_type,
                    title=title.strip(),
                    source_url=link.strip(),
                    description=description.strip(),
                    author=author.strip() if author else None,
                    published_at=published_at,
                    raw_metadata={"source_name": source.name},
                )
            )

        return items

    def _parse_atom(self, root: ET.Element, source: ContentSource) -> List[NormalizedItem]:
        items: List[NormalizedItem] = []
        ns = {"atom": "http://www.w3.org/2005/Atom"}

        for el in root.findall("atom:entry", ns) or root.findall("entry"):
            title = el.findtext("atom:title", namespaces=ns) or el.findtext("title") or "Untitled"
            entry_id = el.findtext("atom:id", namespaces=ns) or el.findtext("id") or ""
            
            link = ""
            link_el = el.find("atom:link[@rel='alternate']", ns) or el.find("link")
            if link_el is not None:
                link = link_el.attrib.get("href", "")
            if not link:
                link = entry_id

            summary = el.findtext("atom:summary", namespaces=ns) or el.findtext("summary") or el.findtext("atom:content", namespaces=ns) or ""
            author_el = el.find("atom:author/atom:name", ns) or el.find("author/name")
            author = author_el.text if author_el is not None else None
            updated_str = el.findtext("atom:published", namespaces=ns) or el.findtext("atom:updated", namespaces=ns) or el.findtext("published") or el.findtext("updated")

            published_at = self._parse_date(updated_str)

            content_type = "article"
            if "arxiv" in source.base_url.lower() or "arxiv" in source.name.lower():
                content_type = "research_paper"

            if not link:
                continue

            items.append(
                NormalizedItem(
                    external_id=entry_id if entry_id else link,
                    content_type=content_type,
                    title=title.strip(),
                    source_url=link.strip(),
                    description=summary.strip(),
                    author=author,
                    published_at=published_at,
                    raw_metadata={"source_name": source.name},
                )
            )

        return items

    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        if not date_str:
            return None
        try:
            return parsedate_to_datetime(date_str)
        except Exception:
            pass
        try:
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except Exception:
            return None
