import json
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/buildfeed"
    JWT_SECRET: str = "build_super_secret_jwt_key_2026_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    APP_ENV: str = "development"
    TESTING: bool = False

    # GEMINI Settings
    # Model used for all AI content analysis, project suggestions, mentor chat,
    # and external URL import analysis.
    # Set GEMINI_MODEL in .env to override without touching this file.
    # The default here matches Google's migration guidance for deprecated gemini-2.5-flash.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"

    # Automated Discovery Cycle (Module 8)
    CONTENT_DISCOVERY_INTERVAL_HOURS: float = 12.0

    # Focus Gate (Module 10)
    FEED_CONTENT_LIMIT: int = 10

    # XP / Progression System (Module 12)
    XP_PER_STEP_COMPLETION: int = 10
    XP_PER_PROJECT_COMPLETION: int = 100

    # AI Project Mentor (Module 14)
    MENTOR_MAX_TOKENS: int = 600

    # SMTP (password reset emails)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "build."
    FRONTEND_URL: str = "http://localhost:5173"

    # GitHub OAuth (optional at signup — used when the user chooses GitHub for "Build This")
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_OAUTH_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/github/callback"
    GITHUB_TOKEN_ENCRYPTION_KEY: str = ""  # Fernet key; generate with Fernet.generate_key()

    # Content Quality & Moderation (Module 21)
    # Master switch — set to False to bypass all quality checks (useful for initial seeding)
    QUALITY_CHECKS_ENABLED: bool = True
    # Near-duplicate detection: items with title similarity above this threshold are rejected
    # (Jaccard similarity on word-level n-grams). 0.85 = 85% similar words in common.
    QUALITY_DUPLICATE_THRESHOLD: float = 0.85
    # Broken URL check: HTTP HEAD timeout in seconds per URL
    QUALITY_URL_CHECK_TIMEOUT: float = 8.0
    # Spam/low-quality: minimum title length (chars) an item must have to pass
    QUALITY_MIN_TITLE_LENGTH: int = 10
    # Freshness: articles/papers older than this many days are flagged (not rejected) as stale.
    # GitHub repos and videos are excluded from the freshness check — repos evolve continuously.
    QUALITY_MAX_AGE_DAYS: int = 365
    # Broken URL check enabled flag — disable in dev/test to avoid slow network calls
    QUALITY_URL_CHECK_ENABLED: bool = True

    # GitHub API (Module 3 Discovery — GitHub Repository ingestion)
    # Optional personal access token (classic, no scopes needed for public repo search) used
    # ONLY server-side to raise the GitHub Search API rate limit from 10 req/min (unauthenticated)
    # to 30 req/min. Discovery still works with this unset — requests just go out unauthenticated.
    # This is unrelated to GITHUB_CLIENT_ID/SECRET above, which are for the user-facing OAuth login.
    GITHUB_TOKEN: str = ""

    # YouTube Data API v3 (Module 3 Discovery — Video ingestion)
    # Optional. When unset, the YouTube adapter logs a warning and returns no items instead of
    # failing the whole discovery cycle, matching the "graceful no-key" pattern used by the
    # Mentor and LinkedIn-caption features elsewhere in this codebase.
    YOUTUBE_API_KEY: str = "test-api-key"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_cors_origins(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, str):
            try:
                return json.loads(self.CORS_ORIGINS)
            except Exception:
                return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return self.CORS_ORIGINS


settings = Settings()