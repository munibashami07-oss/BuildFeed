from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    title: str
    message: str
    is_read: bool
    link: Optional[str] = None
    related_id: Optional[str] = None
    related_type: Optional[str] = None
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
    has_more: bool


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int
