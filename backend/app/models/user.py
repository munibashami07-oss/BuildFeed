import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Profile & Onboarding fields
    interests = Column(JSON, default=list, nullable=False)
    experience_level = Column(String(50), nullable=True)
    skill_levels = Column(JSON, default=dict, nullable=False)
    goals = Column(JSON, default=list, nullable=False)
    onboarding_completed = Column(Boolean, default=False, nullable=False)
    theme_preference = Column(String(20), default="light", nullable=False)

    # Module 20: extended profile
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)

    # Module 20: feed preferences
    feed_content_limit = Column(Integer, nullable=False, default=10, server_default="10")
    preferred_content_types = Column(JSON, nullable=False, default=list, server_default="[]")
    # Timestamp of the last successful personalized discovery cycle used for this user's feed.
    # Page opens/refreshes do not update this value; only a successful discovery does.
    last_feed_discovery_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Module 20: notification preferences
    notif_enabled      = Column(Boolean, nullable=False, default=True,  server_default="true")
    notif_achievements = Column(Boolean, nullable=False, default=True,  server_default="true")
    notif_projects     = Column(Boolean, nullable=False, default=True,  server_default="true")
    notif_content      = Column(Boolean, nullable=False, default=True,  server_default="true")

    # Module 20: privacy
    portfolio_public   = Column(Boolean, nullable=False, default=True,  server_default="true")

    # GitHub integration (optional; can be connected later when building a project)
    github_username     = Column(String(255), nullable=True)
    github_access_token = Column(String(500), nullable=True)  # encrypted at rest (see security.encrypt_token)
    github_connected_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
