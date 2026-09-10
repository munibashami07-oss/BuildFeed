import logging
from datetime import datetime, timezone
from typing import List, Dict, Type, Set, Optional
from sqlalchemy.orm import Session

from app.models.content_source import ContentSource
from app.models.content_item import ContentItem
from app.models.user import User
from app.schemas.discovery import DiscoveryRunResponse
from app.services.discovery.adapters.base import BaseSourceAdapter, NormalizedItem
from app.services.discovery.adapters.github_adapter import GitHubAdapter
from app.services.discovery.adapters.rss_adapter import RSSFeedAdapter
from app.services.discovery.adapters.youtube_adapter import YouTubeAdapter
from app.services.ai.ai_processor import ai_processor

logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc)


# Per-category GitHub topic searches and YouTube search queries. Categories match the keys in
# feed_service.INTEREST_SYNONYM_MAP so that whatever gets discovered here is matchable by the
# existing personalized-feed scoring for any user's stated interests — no category is hardcoded
# as "the" discovery target, and no single category is favored over another. "AI / Machine
# Learning" and "Research" already have dedicated sources below (GitHub AI Projects, arXiv), so
# they're intentionally left out of these per-category loops to avoid duplicate near-identical
# sources.
GITHUB_CATEGORY_TOPICS: Dict[str, str] = {
    "Web Development": "topic:web-development",
    "Mobile Development": "topic:mobile-development",
    "Data Science": "topic:data-science",
    "Cybersecurity": "topic:cybersecurity",
    "Automation": "topic:automation",
    "Robotics": "topic:robotics",
    "Game Development": "topic:game-development",
    "UI/UX": "topic:ui-design",
    "Startups": "topic:startup",
}

YOUTUBE_CATEGORY_QUERIES: Dict[str, str] = {
    "AI / Machine Learning": "machine learning project tutorial",
    "Web Development": "web development project tutorial",
    "Mobile Development": "mobile app development tutorial",
    "Data Science": "data science project tutorial",
    "Cybersecurity": "cybersecurity project tutorial",
    "Automation": "automation scripting tutorial",
    "Robotics": "robotics project tutorial arduino",
    "Game Development": "game development tutorial unity",
    "UI/UX": "ui ux design tutorial figma",
    "Startups": "building a startup in public",
}


# ─── User-Targeted Discovery Query Maps ───────────────────────────────────────
# These provide SPECIFIC, LEVEL-APPROPRIATE search queries tailored to a user's
# interest + experience_level combination. Instead of generic "topic:X" queries,
# they search for content that matches what a beginner/intermediate/advanced user
# in that field actually needs.

TARGETED_GITHUB_QUERIES: Dict[str, Dict[str, str]] = {
    "AI / Machine Learning": {
        "beginner": "topic:machine-learning+topic:beginner+language:python&sort=stars&order=desc&per_page=10",
        "intermediate": "topic:deep-learning+topic:pytorch+language:python&sort=updated&order=desc&per_page=10",
        "advanced": "topic:transformer+topic:research+language:python&sort=updated&order=desc&per_page=10",
    },
    "Web Development": {
        "beginner": "topic:web-development+topic:beginner+language:javascript&sort=stars&order=desc&per_page=10",
        "intermediate": "topic:fullstack+topic:react+language:typescript&sort=updated&order=desc&per_page=10",
        "advanced": "topic:microservices+topic:distributed-systems&sort=updated&order=desc&per_page=10",
    },
    "Mobile Development": {
        "beginner": "topic:mobile+topic:tutorial+language:kotlin&sort=stars&order=desc&per_page=10",
        "intermediate": "topic:react-native+topic:mobile-app&sort=updated&order=desc&per_page=10",
        "advanced": "topic:mobile+topic:architecture+topic:performance&sort=updated&order=desc&per_page=10",
    },
    "Data Science": {
        "beginner": "topic:data-science+topic:beginner+language:python&sort=stars&order=desc&per_page=10",
        "intermediate": "topic:data-analysis+topic:pandas+language:python&sort=updated&order=desc&per_page=10",
        "advanced": "topic:data-engineering+topic:spark+topic:pipeline&sort=updated&order=desc&per_page=10",
    },
    "Cybersecurity": {
        "beginner": "topic:cybersecurity+topic:beginner+topic:learning&sort=stars&order=desc&per_page=10",
        "intermediate": "topic:penetration-testing+topic:security-tools&sort=updated&order=desc&per_page=10",
        "advanced": "topic:exploit+topic:vulnerability-research+topic:reverse-engineering&sort=updated&order=desc&per_page=10",
    },
    "Automation": {
        "beginner": "topic:automation+topic:python+topic:beginner&sort=stars&order=desc&per_page=10",
        "intermediate": "topic:ci-cd+topic:devops+topic:docker&sort=updated&order=desc&per_page=10",
        "advanced": "topic:infrastructure-as-code+topic:kubernetes+topic:terraform&sort=updated&order=desc&per_page=10",
    },
    "Robotics": {
        "beginner": "topic:robotics+topic:arduino+topic:beginner&sort=stars&order=desc&per_page=10",
        "intermediate": "topic:ros+topic:robotics+topic:simulation&sort=updated&order=desc&per_page=10",
        "advanced": "topic:autonomous+topic:slam+topic:computer-vision&sort=updated&order=desc&per_page=10",
    },
    "Game Development": {
        "beginner": "topic:game-development+topic:unity+topic:beginner&sort=stars&order=desc&per_page=10",
        "intermediate": "topic:game-engine+topic:3d+language:csharp&sort=updated&order=desc&per_page=10",
        "advanced": "topic:game-engine+topic:rendering+topic:shader&sort=updated&order=desc&per_page=10",
    },
    "UI/UX": {
        "beginner": "topic:ui-design+topic:css+topic:beginner&sort=stars&order=desc&per_page=10",
        "intermediate": "topic:design-system+topic:react+topic:tailwindcss&sort=updated&order=desc&per_page=10",
        "advanced": "topic:design-system+topic:accessibility+topic:animation&sort=updated&order=desc&per_page=10",
    },
    "Startups": {
        "beginner": "topic:startup+topic:mvp+topic:saas&sort=stars&order=desc&per_page=10",
        "intermediate": "topic:saas+topic:product+topic:boilerplate&sort=updated&order=desc&per_page=10",
        "advanced": "topic:startup+topic:scalability+topic:architecture&sort=updated&order=desc&per_page=10",
    },
}

TARGETED_YOUTUBE_QUERIES: Dict[str, Dict[str, str]] = {
    "AI / Machine Learning": {
        "beginner": "machine learning for beginners python tutorial 2024",
        "intermediate": "build deep learning project pytorch hands-on",
        "advanced": "transformer architecture implementation from scratch research",
    },
    "Web Development": {
        "beginner": "web development beginner HTML CSS JavaScript tutorial",
        "intermediate": "fullstack React Node.js project build tutorial",
        "advanced": "microservices architecture distributed systems production",
    },
    "Mobile Development": {
        "beginner": "mobile app development beginner tutorial 2024",
        "intermediate": "React Native mobile app project build",
        "advanced": "mobile app architecture performance optimization advanced",
    },
    "Data Science": {
        "beginner": "data science beginner python pandas tutorial",
        "intermediate": "data analysis machine learning project end-to-end",
        "advanced": "data engineering pipeline spark production advanced",
    },
    "Cybersecurity": {
        "beginner": "cybersecurity beginner ethical hacking tutorial",
        "intermediate": "penetration testing practical labs walkthrough",
        "advanced": "advanced exploit development reverse engineering binary",
    },
    "Automation": {
        "beginner": "python automation scripting beginner tutorial",
        "intermediate": "CI/CD pipeline Docker DevOps project tutorial",
        "advanced": "Kubernetes infrastructure as code Terraform advanced",
    },
    "Robotics": {
        "beginner": "robotics beginner Arduino project tutorial",
        "intermediate": "ROS robot simulation project build",
        "advanced": "autonomous robot SLAM computer vision advanced",
    },
    "Game Development": {
        "beginner": "game development beginner Unity tutorial 2D",
        "intermediate": "Unity 3D game project build complete tutorial",
        "advanced": "game engine rendering pipeline shader programming",
    },
    "UI/UX": {
        "beginner": "UI UX design beginner Figma tutorial",
        "intermediate": "design system React Tailwind CSS component library",
        "advanced": "advanced UI animation micro-interactions design systems",
    },
    "Startups": {
        "beginner": "how to build MVP startup idea validation",
        "intermediate": "SaaS product development launch in public",
        "advanced": "startup scaling architecture production systems",
    },
}

# Goal-based query modifiers — appended to targeted queries to align with user's stated goals
GOAL_QUERY_MODIFIERS: Dict[str, str] = {
    "learn": "tutorial learn step by step",
    "build projects": "build project hands-on coding",
    "build": "build project hands-on coding",
    "discover project ideas": "project ideas inspiration",
    "discover new technology": "new tools latest technology",
    "improve my skills": "advanced techniques best practices production",
    "improve": "advanced techniques best practices production",
}


def _build_default_sources() -> List[Dict[str, str]]:
    sources: List[Dict[str, str]] = [
        {
            "name": "GitHub AI Projects",
            "source_type": "github_trending",
            "base_url": "https://api.github.com/search/repositories?q=topic:ai+topic:machine-learning&sort=stars&order=desc&per_page=15",
        },
        {
            "name": "arXiv CS.AI Preprints",
            "source_type": "rss_feed",
            "base_url": "https://rss.arxiv.org/rss/cs.AI",
        },
        {
            "name": "Hacker News Top Stories",
            "source_type": "rss_feed",
            "base_url": "https://news.ycombinator.com/rss",
        },
    ]

    for category, topic_query in GITHUB_CATEGORY_TOPICS.items():
        sources.append({
            "name": f"GitHub Repos — {category}",
            "source_type": "github_trending",
            "base_url": f"https://api.github.com/search/repositories?q={topic_query}&sort=stars&order=desc&per_page=15",
        })

    for category, search_query in YOUTUBE_CATEGORY_QUERIES.items():
        sources.append({
            "name": f"YouTube — {category}",
            "source_type": "youtube",
            # base_url holds the literal search query text for YouTube sources, not a URL —
            # see YouTubeAdapter for why.
            "base_url": search_query,
        })

    return sources


DEFAULT_SOURCES = _build_default_sources()

# Content types we deliberately never ingest. Empty by default now that GitHub repositories and
# videos are in scope — kept as a set (rather than removed outright) as a defense-in-depth hook
# for any future content type that needs to be turned off without touching the adapters.
EXCLUDED_CONTENT_TYPES: set = set()


class DiscoveryService:
    def __init__(self):
        self.adapters: Dict[str, BaseSourceAdapter] = {
            "github_trending": GitHubAdapter(),
            "rss_feed": RSSFeedAdapter(),
            "youtube": YouTubeAdapter(),
        }

    def register_adapter(self, source_type: str, adapter: BaseSourceAdapter):
        self.adapters[source_type] = adapter

    def seed_default_sources(self, db: Session) -> List[ContentSource]:
        """
        Ensure every default source exists, matched by name. Additive and idempotent: safe to
        call on a database that already has sources (e.g. an existing deployment gaining GitHub
        repo / video sources for the first time) — it will only insert the ones that are missing,
        never duplicate or touch existing rows (including any custom sources an operator added).
        """
        existing_names = {name for (name,) in db.query(ContentSource.name).all()}

        created_sources = []
        for src_def in DEFAULT_SOURCES:
            if src_def["name"] in existing_names:
                continue
            src = ContentSource(
                name=src_def["name"],
                source_type=src_def["source_type"],
                base_url=src_def["base_url"],
                is_active=True,
            )
            db.add(src)
            created_sources.append(src)

        if created_sources:
            db.commit()
            for src in created_sources:
                db.refresh(src)
            logger.info("Seeded %d new default content source(s).", len(created_sources))

        return db.query(ContentSource).all()

    def run_discovery(self, db: Session) -> DiscoveryRunResponse:
        # Exclude external_url sources at DB level — they are created by the manual
        # URL-import flow (ExternalImportService) and have no scheduled adapter.
        # The automated discovery cycle must never attempt to call an adapter on them.
        sources = (
            db.query(ContentSource)
            .filter(
                ContentSource.is_active == True,
                ContentSource.source_type != "external_url",
            )
            .all()
        )
        if not sources:
            # seed_default_sources returns all sources in the DB — apply the same
            # external_url exclusion so the adapter-lookup loop is never surprised.
            all_sources = self.seed_default_sources(db)
            sources = [s for s in all_sources if s.source_type != "external_url"]

        sources_processed = 0
        total_discovered = 0
        total_inserted = 0
        total_duplicates = 0
        errors: List[str] = []

        for source in sources:
            # All sources reaching this loop are already guaranteed to be non-external_url
            # (filtered at query + fallback level above). This guard is kept as belt-and-suspenders.
            if source.source_type == "external_url":
                continue
            adapter = self.adapters.get(source.source_type)
            if not adapter:
                err_msg = f"No adapter registered for source type '{source.source_type}' (Source: {source.name}) — skipping."
                logger.warning(err_msg)
                errors.append(err_msg)
                continue

            sources_processed += 1
            try:
                raw_items: List[NormalizedItem] = adapter.fetch_items(source)
                total_discovered += len(raw_items)

                source_inserted = 0
                source_duplicates = 0

                # Pre-fetch existing external IDs and URLs for O(1) set lookup
                existing_ext_ids: Set[str] = {
                    ext for (ext,) in db.query(ContentItem.external_id)
                    .filter(ContentItem.source_id == source.id)
                    .all()
                }
                existing_urls: Set[str] = {
                    url for (url,) in db.query(ContentItem.source_url).all()
                }

                for norm_item in raw_items:
                    # Validate required fields
                    if not norm_item.title or not norm_item.source_url or not norm_item.external_id:
                        continue

                    # Skip content types excluded by product scope (defense in depth, in case an
                    # adapter ever mixes content types — e.g. an RSS feed tagging something 'video').
                    if norm_item.content_type in EXCLUDED_CONTENT_TYPES:
                        continue

                    # Deduplicate 1: Check by (source_id, external_id)
                    if norm_item.external_id in existing_ext_ids:
                        source_duplicates += 1
                        continue

                    # Deduplicate 2: Check canonical source_url
                    if norm_item.source_url in existing_urls:
                        source_duplicates += 1
                        continue

                    # Insert new item
                    new_item = ContentItem(
                        source_id=source.id,
                        external_id=norm_item.external_id,
                        content_type=norm_item.content_type,
                        title=norm_item.title[:500],
                        description=norm_item.description,
                        source_url=norm_item.source_url[:1000],
                        author=norm_item.author[:255] if norm_item.author else None,
                        thumbnail_url=norm_item.thumbnail_url[:1000] if norm_item.thumbnail_url else None,
                        published_at=norm_item.published_at,
                        discovered_at=utc_now(),
                        raw_metadata=norm_item.raw_metadata or {},
                        status="discovered",
                    )
                    db.add(new_item)
                    existing_ext_ids.add(norm_item.external_id)
                    existing_urls.add(norm_item.source_url)
                    source_inserted += 1

                source.last_fetched_at = utc_now()
                db.commit()

                total_inserted += source_inserted
                total_duplicates += source_duplicates

            except Exception as e:
                db.rollback()
                err_msg = f"Failed to fetch from '{source.name}' ({source.base_url}): {str(e)}"
                logger.error(err_msg, exc_info=True)
                errors.append(err_msg)

        return DiscoveryRunResponse(
            sources_processed=sources_processed,
            items_discovered=total_discovered,
            items_inserted=total_inserted,
            duplicates_skipped=total_duplicates,
            errors=errors,
        )

    def discover_for_user(self, db: Session, user: User, max_queries: int = 5) -> Dict[str, int]:
        """Run dynamic personalized discovery for a single user using Gemini query synthesis with fallback.

        Synthesizes queries matching the user's specific interests, goals, experience level,
        and per-skill proficiency matrix, and fetches targeted repositories and tutorials.
        """
        user_profile = {
            "interests": user.interests or [],
            "experience_level": user.experience_level or "intermediate",
            "skill_levels": user.skill_levels or {},
            "goals": user.goals or [],
        }

        # Try dynamic AI query synthesis first
        ai_queries = ai_processor.generate_targeted_discovery_queries(user_profile)
        gh_queries: List[str] = ai_queries.get("github_queries", [])
        yt_queries: List[str] = ai_queries.get("youtube_queries", [])

        # Fall back to static query maps if AI returned no queries
        if not gh_queries and not yt_queries:
            level = (user.experience_level or "intermediate").lower()
            for interest in (user.interests or []):
                gq = TARGETED_GITHUB_QUERIES.get(interest, {}).get(level)
                if gq:
                    gh_queries.append(gq)
                yq = TARGETED_YOUTUBE_QUERIES.get(interest, {}).get(level)
                if yq:
                    yt_queries.append(yq)

        existing_urls: Set[str] = {
            url for (url,) in db.query(ContentItem.source_url).all()
        }
        existing_ext_ids_all: Set[str] = {
            ext for (ext,) in db.query(ContentItem.external_id).all()
        }

        total_inserted = 0
        queries_run = 0

        # Run GitHub queries
        github_adapter = self.adapters.get("github_trending")
        if github_adapter:
            for q in gh_queries[:max_queries]:
                if not q.startswith("topic:") and "q=" not in q:
                    query_param = f"q={q}&sort=stars&order=desc&per_page=10"
                elif not q.startswith("http") and not q.startswith("q="):
                    query_param = f"q={q}"
                else:
                    query_param = q

                base_url = f"https://api.github.com/search/repositories?{query_param}" if not query_param.startswith("http") else query_param
                temp_source = ContentSource(
                    name=f"Targeted — GitHub — {user.username}",
                    source_type="github_trending",
                    base_url=base_url,
                    is_active=True,
                )
                try:
                    items = github_adapter.fetch_items(temp_source)
                    queries_run += 1
                    for norm_item in items:
                        if not norm_item.title or not norm_item.source_url or not norm_item.external_id:
                            continue
                        if norm_item.external_id in existing_ext_ids_all or norm_item.source_url in existing_urls:
                            continue

                        source_name = f"Targeted — GitHub — {user.username}"
                        source = db.query(ContentSource).filter(ContentSource.name == source_name).first()
                        if not source:
                            source = ContentSource(
                                name=source_name,
                                source_type="github_trending",
                                base_url=temp_source.base_url,
                                is_active=True,
                            )
                            db.add(source)
                            db.flush()

                        new_item = ContentItem(
                            source_id=source.id,
                            external_id=norm_item.external_id,
                            content_type=norm_item.content_type,
                            title=norm_item.title[:500],
                            description=norm_item.description,
                            source_url=norm_item.source_url[:1000],
                            author=norm_item.author[:255] if norm_item.author else None,
                            thumbnail_url=norm_item.thumbnail_url[:1000] if norm_item.thumbnail_url else None,
                            published_at=norm_item.published_at,
                            discovered_at=utc_now(),
                            raw_metadata={**(norm_item.raw_metadata or {}), "targeted_user": str(user.id)},
                            status="discovered",
                        )
                        db.add(new_item)
                        existing_ext_ids_all.add(norm_item.external_id)
                        existing_urls.add(norm_item.source_url)
                        total_inserted += 1

                    db.commit()
                except Exception as e:
                    db.rollback()
                    logger.warning("Targeted GitHub discovery failed for user %s with query %s: %s", user.id, q, e)

        # Run YouTube queries
        yt_adapter = self.adapters.get("youtube")
        if yt_adapter:
            for yq in yt_queries[:max_queries]:
                temp_source = ContentSource(
                    name=f"Targeted — YouTube — {user.username}",
                    source_type="youtube",
                    base_url=yq,
                    is_active=True,
                )
                try:
                    items = yt_adapter.fetch_items(temp_source)
                    queries_run += 1
                    for norm_item in items:
                        if not norm_item.title or not norm_item.source_url or not norm_item.external_id:
                            continue
                        if norm_item.external_id in existing_ext_ids_all or norm_item.source_url in existing_urls:
                            continue

                        source_name = f"Targeted — YouTube — {user.username}"
                        source = db.query(ContentSource).filter(ContentSource.name == source_name).first()
                        if not source:
                            source = ContentSource(
                                name=source_name,
                                source_type="youtube",
                                base_url=yq,
                                is_active=True,
                            )
                            db.add(source)
                            db.flush()

                        new_item = ContentItem(
                            source_id=source.id,
                            external_id=norm_item.external_id,
                            content_type=norm_item.content_type,
                            title=norm_item.title[:500],
                            description=norm_item.description,
                            source_url=norm_item.source_url[:1000],
                            author=norm_item.author[:255] if norm_item.author else None,
                            thumbnail_url=norm_item.thumbnail_url[:1000] if norm_item.thumbnail_url else None,
                            published_at=norm_item.published_at,
                            discovered_at=utc_now(),
                            raw_metadata={**(norm_item.raw_metadata or {}), "targeted_user": str(user.id)},
                            status="discovered",
                        )
                        db.add(new_item)
                        existing_ext_ids_all.add(norm_item.external_id)
                        existing_urls.add(norm_item.source_url)
                        total_inserted += 1

                    db.commit()
                except Exception as e:
                    db.rollback()
                    logger.warning("Targeted YouTube discovery failed for user %s with query %s: %s", user.id, yq, e)

        return {"targeted_items_inserted": total_inserted, "targeted_queries_run": queries_run}

    def run_user_targeted_discovery(self, db: Session) -> Dict[str, int]:
        """Run targeted content discovery based on active users' interests and experience levels.

        Instead of discovering content for ALL categories generically, this method:
        1. Aggregates all active users' unique (interest, experience_level, goals) combinations
        2. Builds SPECIFIC search queries tailored to each combination
        3. Runs discovery with those targeted queries
        4. Deduplicates against existing content

        This ensures the content pool is dominated by material that is *specifically relevant*
        to actual users, not generic content for categories nobody cares about.
        """
        active_users = (
            db.query(User)
            .filter(User.is_active == True, User.onboarding_completed == True)
            .all()
        )

        if not active_users:
            logger.info("No active onboarded users found for targeted discovery.")
            return {"targeted_items_inserted": 0, "targeted_queries_run": 0}

        # Run per-user discovery for up to first 5 active users, then aggregate general pairs
        total_inserted = 0
        queries_run = 0

        for user in active_users[:5]:
            try:
                res = self.discover_for_user(db, user, max_queries=3)
                total_inserted += res.get("targeted_items_inserted", 0)
                queries_run += res.get("targeted_queries_run", 0)
            except Exception as e:
                logger.warning("Dynamic discovery failed for user %s: %s", user.id, e)

        # Aggregate unique (interest, level) pairs across all active users
        interest_level_pairs: Set[tuple] = set()
        goal_keywords: Set[str] = set()

        for user in active_users:
            level = (user.experience_level or "intermediate").lower()
            for interest in (user.interests or []):
                interest_level_pairs.add((interest, level))
            for goal in (user.goals or []):
                goal_keywords.add(goal.lower())

        # Build the primary goal modifier from aggregated goals
        goal_modifier_parts = []
        for goal_key, modifier in GOAL_QUERY_MODIFIERS.items():
            if any(goal_key in g for g in goal_keywords):
                goal_modifier_parts.append(modifier)
        goal_modifier = " ".join(goal_modifier_parts[:2])  # Limit to 2 modifiers to keep queries focused

        logger.info(
            "Running user-targeted discovery for %d unique (interest, level) pairs from %d active users. Goals: %s",
            len(interest_level_pairs),
            len(active_users),
            goal_keywords,
        )

        # Pre-fetch existing URLs for deduplication
        existing_urls: Set[str] = {
            url for (url,) in db.query(ContentItem.source_url).all()
        }
        existing_ext_ids_all: Set[str] = {
            ext for (ext,) in db.query(ContentItem.external_id).all()
        }

        for interest, level in interest_level_pairs:
            # ── GitHub targeted queries ──
            github_queries = TARGETED_GITHUB_QUERIES.get(interest, {})
            github_query = github_queries.get(level, github_queries.get("intermediate"))

            if github_query:
                github_adapter = self.adapters.get("github_trending")
                if github_adapter:
                    # Create a temporary source-like object for the adapter
                    temp_source = ContentSource(
                        name=f"Targeted — GitHub — {interest} ({level})",
                        source_type="github_trending",
                        base_url=f"https://api.github.com/search/repositories?q={github_query}",
                        is_active=True,
                    )
                    try:
                        items = github_adapter.fetch_items(temp_source)
                        queries_run += 1
                        for norm_item in items:
                            if not norm_item.title or not norm_item.source_url or not norm_item.external_id:
                                continue
                            if norm_item.external_id in existing_ext_ids_all:
                                continue
                            if norm_item.source_url in existing_urls:
                                continue

                            # Find or create a persistent source for this targeted category
                            source_name = f"Targeted — GitHub — {interest} ({level})"
                            source = db.query(ContentSource).filter(ContentSource.name == source_name).first()
                            if not source:
                                source = ContentSource(
                                    name=source_name,
                                    source_type="github_trending",
                                    base_url=temp_source.base_url,
                                    is_active=True,
                                )
                                db.add(source)
                                db.flush()

                            new_item = ContentItem(
                                source_id=source.id,
                                external_id=norm_item.external_id,
                                content_type=norm_item.content_type,
                                title=norm_item.title[:500],
                                description=norm_item.description,
                                source_url=norm_item.source_url[:1000],
                                author=norm_item.author[:255] if norm_item.author else None,
                                thumbnail_url=norm_item.thumbnail_url[:1000] if norm_item.thumbnail_url else None,
                                published_at=norm_item.published_at,
                                discovered_at=utc_now(),
                                raw_metadata={**(norm_item.raw_metadata or {}), "targeted_interest": interest, "targeted_level": level},
                                status="discovered",
                            )
                            db.add(new_item)
                            existing_ext_ids_all.add(norm_item.external_id)
                            existing_urls.add(norm_item.source_url)
                            total_inserted += 1

                        db.commit()
                    except Exception as e:
                        db.rollback()
                        logger.warning("Targeted GitHub discovery failed for %s/%s: %s", interest, level, e)

            # ── YouTube targeted queries ──
            yt_queries = TARGETED_YOUTUBE_QUERIES.get(interest, {})
            yt_query = yt_queries.get(level, yt_queries.get("intermediate"))

            if yt_query:
                # Append goal modifier for more specific results
                if goal_modifier:
                    yt_query = f"{yt_query} {goal_modifier}"

                yt_adapter = self.adapters.get("youtube")
                if yt_adapter:
                    temp_source = ContentSource(
                        name=f"Targeted — YouTube — {interest} ({level})",
                        source_type="youtube",
                        base_url=yt_query,
                        is_active=True,
                    )
                    try:
                        items = yt_adapter.fetch_items(temp_source)
                        queries_run += 1
                        for norm_item in items:
                            if not norm_item.title or not norm_item.source_url or not norm_item.external_id:
                                continue
                            if norm_item.external_id in existing_ext_ids_all:
                                continue
                            if norm_item.source_url in existing_urls:
                                continue

                            source_name = f"Targeted — YouTube — {interest} ({level})"
                            source = db.query(ContentSource).filter(ContentSource.name == source_name).first()
                            if not source:
                                source = ContentSource(
                                    name=source_name,
                                    source_type="youtube",
                                    base_url=yt_query,
                                    is_active=True,
                                )
                                db.add(source)
                                db.flush()

                            new_item = ContentItem(
                                source_id=source.id,
                                external_id=norm_item.external_id,
                                content_type=norm_item.content_type,
                                title=norm_item.title[:500],
                                description=norm_item.description,
                                source_url=norm_item.source_url[:1000],
                                author=norm_item.author[:255] if norm_item.author else None,
                                thumbnail_url=norm_item.thumbnail_url[:1000] if norm_item.thumbnail_url else None,
                                published_at=norm_item.published_at,
                                discovered_at=utc_now(),
                                raw_metadata={**(norm_item.raw_metadata or {}), "targeted_interest": interest, "targeted_level": level},
                                status="discovered",
                            )
                            db.add(new_item)
                            existing_ext_ids_all.add(norm_item.external_id)
                            existing_urls.add(norm_item.source_url)
                            total_inserted += 1

                        db.commit()
                    except Exception as e:
                        db.rollback()
                        logger.warning("Targeted YouTube discovery failed for %s/%s: %s", interest, level, e)

        logger.info(
            "User-targeted discovery complete: %d queries run, %d new items inserted.",
            queries_run, total_inserted,
        )

        return {"targeted_items_inserted": total_inserted, "targeted_queries_run": queries_run}


discovery_service = DiscoveryService()