import time
import logging
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status

from app.core.config import settings

logger = logging.getLogger(__name__)


class RateLimiter:
    """Sliding-window rate limiter dependency for FastAPI routes."""

    def __init__(self, calls: int = 10, period: int = 60):
        self.calls = calls
        self.period = period
        self.hits: Dict[str, List[float]] = defaultdict(list)

    def __call__(self, request: Request):
        if getattr(settings, "TESTING", False):
            return

        now = time.time()
        # Identify client by IP address and authorization prefix if available
        client_ip = request.client.host if request.client and request.client.host else "127.0.0.1"
        auth_header = request.headers.get("Authorization", "")
        key = f"{client_ip}:{auth_header[:30]}" if auth_header else client_ip

        # Clean timestamps outside the sliding window
        valid_timestamps = [ts for ts in self.hits[key] if now - ts < self.period]
        if len(valid_timestamps) >= self.calls:
            logger.warning("Rate limit exceeded for client %s on %s", client_ip, request.url.path)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {self.calls} requests per {self.period} seconds.",
                headers={"Retry-After": str(self.period)},
            )

        valid_timestamps.append(now)
        self.hits[key] = valid_timestamps
