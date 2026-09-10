from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models.content_source import ContentSource


@dataclass
class NormalizedItem:
    external_id: str
    content_type: str  # 'article', 'image', 'video', 'github_repo', 'research_paper', 'ai_tool'
    title: str
    source_url: str
    description: Optional[str] = None
    author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    published_at: Optional[datetime] = None
    raw_metadata: Dict[str, Any] = field(default_factory=dict)


class BaseSourceAdapter(ABC):
    @abstractmethod
    def fetch_items(self, source: ContentSource) -> List[NormalizedItem]:
        """Fetch items from source and return a list of normalized items."""
        pass
