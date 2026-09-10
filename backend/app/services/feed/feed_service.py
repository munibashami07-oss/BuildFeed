"""
Feed Service — BuildFeed Personalized Recommendation Engine

Pipeline (implemented here):
    User preferences
    → DB candidate retrieval
    → strict topic relevance scoring  (PRIMARY / SECONDARY tier)
    → expertise-level gate            (hard block: Beginner ✗ Advanced)
    → minimum relevance threshold     (items below STRICT_RELEVANCE_THRESHOLD dropped)
    → multi-signal composite scoring  (topic 40 % + expertise 25 % + semantic 15 % + behavioural 10 % + quality/goal/freshness 10 %)
    → re-ranking
    → content-type interleaving       (only for the "All Content" view)
    → like-count attachment
    → paginated FeedResponse

Key design decisions
────────────────────
1.  Two-tier synonym map.  Each interest has PRIMARY terms (core domain
    vocabulary that unambiguously identifies the domain) and SECONDARY
    terms (adjacent / shared vocabulary).  A PRIMARY match scores 1.0;
    a SECONDARY match scores ≤ 0.6.  This prevents a generic "AI" article
    from being ranked equally with a dedicated cybersecurity write-up for a
    Cybersecurity user.

2.  Hard expertise gate.  Beginner+Advanced content = 0.0 expertise score.
    Items that fail the expertise gate AND have no behavioural override are
    excluded from the strict pool entirely.

3.  Minimum relevance threshold.  STRICT_RELEVANCE_THRESHOLD (default 30.0
    on a 0–100 scale) acts as a minimum combined (topic + expertise) score.
    Items below this are rejected before composite scoring runs, which avoids
    penalised-but-still-visible junk in the feed.

4.  Every scoring decision is logged at DEBUG level with a structured dict
    so production log aggregators (Datadog, CloudWatch, etc.) can parse it.

5.  Fallback behaviour:  if the strict pool is empty (no content matched the
    user's interests at all) the service falls back to the broader pool —
    never returning an empty feed.  The fallback is logged at WARNING level.
"""

import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, NamedTuple, Optional, Set, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.content_item import ContentItem
from app.models.content_item_like import ContentItemLike
from app.models.user import User
from app.schemas.feed import FeedItemResponse, FeedResponse
from app.services.embedding.embedding_service import embedding_service

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

# Content types never shown in the feed.
EXCLUDED_CONTENT_TYPES: Set[str] = set()

# Items whose combined (topic_score × TOPIC_WEIGHT + expertise_score × EXPERTISE_WEIGHT)
# falls below this value are excluded from the strict pool.
# Scale: 0 – 100.  Raise to tighten, lower to allow more borderline content.
STRICT_RELEVANCE_THRESHOLD: float = 25.0

# Score weights — must sum to 100.
W_TOPIC:       float = 40.0   # primary signal: is the item about the user's topic?
W_EXPERTISE:   float = 25.0   # expertise-level match
W_SEMANTIC:    float = 15.0   # embedding cosine similarity to user profile
W_BEHAVIOURAL: float = 10.0   # saved / completed-project / search signals
W_QUALITY:     float = 10.0   # AI relevance score, builder relevance, freshness, goals

# Maximum raw scores for each signal (used to normalise to 0–1 before weighting)
_MAX_BEHAVIOURAL_RAW: float = 135.0  # 60 project + 40 saved + 25 search + 10 affinity
_MAX_QUALITY_RAW:     float = 60.0   # 30 ai_relevance + 25 goal + 5 freshness

# Maximum age in days before an article/paper is considered "stale" (slight penalty)
_FRESHNESS_STALE_DAYS: int = 180

# Expertise levels in ascending order
_LEVELS: Tuple[str, ...] = ("beginner", "intermediate", "advanced")

# How many days back "Trending" counts likes (used for behavioural freshness)
_TRENDING_WINDOW_DAYS: int = 7


# ─────────────────────────────────────────────────────────────────────────────
# Two-tier Interest / Domain map
# ─────────────────────────────────────────────────────────────────────────────
#
# Structure:
#   "interest_key" (lower-case, matches user.interests values): {
#       "primary":   frozenset of terms that unambiguously identify this domain,
#       "secondary": frozenset of terms that are *related* but shared with other domains,
#       "category":  frozenset of ai_metadata.content_category values that map here,
#   }
#
# Matching rules (see compute_topic_relevance_score):
#   PRIMARY match  → topic score = 1.0
#   SECONDARY match → topic score = 0.55  (enough to pass threshold but clearly weaker)
#   Title/desc only → topic score ≤ 0.40  (surface-level, easily faked)
#
# Why this matters:  "security", "auth", "encryption" appear in *every* web-dev
# article that mentions HTTPS or JWTs.  They are SECONDARY for cybersecurity,
# meaning a web-dev tutorial won't score as a genuine cybersecurity resource.

DOMAIN_MAP: Dict[str, Dict[str, frozenset]] = {
    # ── AI / Machine Learning ─────────────────────────────────────────────
    "ai / machine learning": {
        "primary": frozenset({
            "machine learning", "deep learning", "neural network", "llm", "large language model",
            "gpt", "transformer", "diffusion model", "reinforcement learning", "computer vision",
            "natural language processing", "nlp", "pytorch", "tensorflow", "keras",
            "fine-tuning", "rlhf", "embedding", "vector database", "rag",
            "retrieval-augmented generation", "hugging face", "langchain", "gemini api",
            "ai agent", "ai agents", "generative ai", "stable diffusion", "model training",
            "model inference", "gradient descent", "backpropagation",
        }),
        "secondary": frozenset({
            "python", "api", "automation", "data pipeline", "cloud", "aws", "gpu",
            "jupyter", "notebook", "colab", "scikit-learn", "pandas", "numpy",
            "data science", "statistics", "benchmark", "dataset",
        }),
        "category": frozenset({"ai/ml", "ai tools", "research"}),
    },
    "ai/ml": {  # alias
        "primary": frozenset({
            "machine learning", "deep learning", "neural network", "llm", "large language model",
            "gpt", "transformer", "diffusion model", "reinforcement learning", "computer vision",
            "nlp", "pytorch", "tensorflow", "keras", "fine-tuning", "rlhf", "embedding",
            "vector database", "rag", "hugging face", "langchain", "gemini api",
            "ai agent", "ai agents", "generative ai", "stable diffusion", "model training",
        }),
        "secondary": frozenset({
            "python", "api", "automation", "data pipeline", "scikit-learn",
            "pandas", "numpy", "data science", "statistics", "benchmark",
        }),
        "category": frozenset({"ai/ml", "ai tools", "research"}),
    },

    # ── Web Development ───────────────────────────────────────────────────
    "web development": {
        "primary": frozenset({
            "web development", "frontend", "backend", "fullstack", "full-stack",
            "react", "next.js", "vue", "angular", "svelte", "nuxt",
            "html", "css", "javascript", "typescript", "node.js", "express",
            "fastapi", "django", "flask", "rest api", "graphql", "websocket",
            "web app", "spa", "server-side rendering", "ssr", "static site",
            "tailwind", "bootstrap", "webpack", "vite", "bun",
        }),
        "secondary": frozenset({
            "python", "api", "database", "postgresql", "mysql", "redis",
            "docker", "cloud", "aws", "vercel", "netlify", "deployment",
            "authentication", "oauth", "jwt",
        }),
        "category": frozenset({"web development"}),
    },

    # ── Mobile Development ────────────────────────────────────────────────
    "mobile development": {
        "primary": frozenset({
            "mobile development", "android", "ios", "react native", "flutter",
            "swift", "kotlin", "swiftui", "xcode", "android studio",
            "mobile app", "app development", "cross-platform mobile",
            "push notifications", "mobile ui", "jetpack compose",
        }),
        "secondary": frozenset({
            "javascript", "typescript", "api", "backend", "firebase",
            "authentication", "database",
        }),
        "category": frozenset({"mobile development"}),
    },

    # ── Data Science ──────────────────────────────────────────────────────
    "data science": {
        "primary": frozenset({
            "data science", "data analysis", "data engineering", "analytics",
            "pandas", "numpy", "matplotlib", "seaborn", "plotly",
            "sql", "dbt", "airflow", "spark", "databricks", "snowflake",
            "data pipeline", "etl", "elt", "feature engineering",
            "statistical analysis", "hypothesis testing", "regression",
            "classification", "clustering", "time series", "a/b testing",
            "business intelligence", "tableau", "power bi",
        }),
        "secondary": frozenset({
            "python", "jupyter", "machine learning", "model", "database",
            "cloud", "aws", "gcp", "azure",
        }),
        "category": frozenset({"data science"}),
    },

    # ── Cybersecurity ─────────────────────────────────────────────────────
    "cybersecurity": {
        "primary": frozenset({
            "cybersecurity", "penetration testing", "pentest", "ethical hacking",
            "vulnerability", "exploit", "cve", "ctf", "capture the flag",
            "malware", "ransomware", "phishing", "social engineering",
            "incident response", "threat hunting", "threat intelligence",
            "reverse engineering", "buffer overflow", "sql injection",
            "xss", "cross-site scripting", "csrf", "privilege escalation",
            "network security", "firewall", "ids", "ips", "siem",
            "red team", "blue team", "purple team", "osint",
            "nmap", "metasploit", "burp suite", "wireshark", "kali linux",
            "infosec", "security audit", "zero-day", "rootkit", "trojan",
            "cryptography", "pki", "tls certificate", "ssl vulnerability",
            "forensics", "digital forensics", "devsecops",
        }),
        "secondary": frozenset({
            "security", "authentication", "authorization", "encryption",
            "oauth", "jwt", "https", "api security", "access control",
            "docker security", "cloud security", "aws security",
        }),
        "category": frozenset({"cybersecurity"}),
    },

    # ── Automation ────────────────────────────────────────────────────────
    "automation": {
        "primary": frozenset({
            "automation", "ci/cd", "github actions", "gitlab ci", "jenkins",
            "ansible", "terraform", "infrastructure as code", "iac",
            "bash scripting", "shell scripting", "cron", "task scheduling",
            "web scraping", "selenium", "playwright", "puppeteer",
            "robotic process automation", "rpa", "n8n", "zapier", "make",
            "devops", "sre", "site reliability", "kubernetes", "helm",
            "dockerfile", "docker compose",
        }),
        "secondary": frozenset({
            "python", "linux", "cloud", "aws", "gcp", "azure",
            "monitoring", "logging", "alerting",
        }),
        "category": frozenset({"automation"}),
    },

    # ── Robotics ──────────────────────────────────────────────────────────
    "robotics": {
        "primary": frozenset({
            "robotics", "ros", "ros2", "robot operating system",
            "drone", "uav", "autonomous vehicle", "self-driving",
            "embedded systems", "microcontroller", "arduino", "raspberry pi",
            "servo", "sensor fusion", "lidar", "slam",
            "pid controller", "actuator", "kinematics",
            "computer vision robotics", "manipulation",
        }),
        "secondary": frozenset({
            "python", "c++", "linux", "camera", "gpu", "edge computing",
        }),
        "category": frozenset({"robotics"}),
    },

    # ── Game Development ──────────────────────────────────────────────────
    "game development": {
        "primary": frozenset({
            "game development", "game engine", "unity", "unreal engine",
            "godot", "c# unity", "blueprints", "game design",
            "shader", "hlsl", "glsl", "rendering", "3d graphics",
            "physics engine", "collision detection", "game loop",
            "multiplayer", "netcode", "procedural generation",
            "level design", "ecs", "entity component system",
        }),
        "secondary": frozenset({
            "c#", "c++", "python", "javascript", "audio",
            "animation", "blender",
        }),
        "category": frozenset({"game development"}),
    },

    # ── UI/UX ─────────────────────────────────────────────────────────────
    "ui/ux": {
        "primary": frozenset({
            "ui design", "ux design", "user interface", "user experience",
            "figma", "sketch", "adobe xd", "prototyping", "wireframe",
            "design system", "component library", "accessibility", "wcag",
            "usability testing", "user research", "persona",
            "information architecture", "interaction design",
            "color theory", "typography", "design token",
        }),
        "secondary": frozenset({
            "css", "tailwind", "react", "animation", "motion design",
        }),
        "category": frozenset({"ui/ux"}),
    },

    # ── Startups ──────────────────────────────────────────────────────────
    "startups": {
        "primary": frozenset({
            "startup", "saas", "indie hacker", "bootstrapped", "mvp",
            "product market fit", "go-to-market", "growth hacking",
            "fundraising", "venture capital", "y combinator",
            "product launch", "building in public", "customer acquisition",
            "churn", "mrr", "arr", "runway", "pitch deck",
        }),
        "secondary": frozenset({
            "product", "business", "marketing", "landing page",
            "pricing", "monetisation",
        }),
        "category": frozenset({"startups"}),
    },

    # ── Research ──────────────────────────────────────────────────────────
    "research": {
        "primary": frozenset({
            "research paper", "arxiv", "academic paper", "preprint",
            "peer-reviewed", "survey paper", "literature review",
            "benchmark", "dataset", "ablation study", "sota",
            "state of the art", "experimental results", "conference paper",
            "neurips", "icml", "iclr", "cvpr", "acl",
        }),
        "secondary": frozenset({
            "algorithm", "mathematical", "proof", "theorem",
            "machine learning", "statistics",
        }),
        "category": frozenset({"research"}),
    },

    # ── App Development (alias for mobile) ───────────────────────────────
    "app development": {
        "primary": frozenset({
            "mobile app", "android", "ios", "react native", "flutter",
            "swift", "kotlin", "app development", "swiftui",
        }),
        "secondary": frozenset({
            "javascript", "typescript", "firebase", "api",
        }),
        "category": frozenset({"mobile development"}),
    },
}

# Build a fast lookup: lower-case interest → domain config
# Also expand aliases so that any casing variation from user.interests is handled.
_NORMALISED_DOMAIN_MAP: Dict[str, Dict[str, frozenset]] = {
    k.lower().strip(): v for k, v in DOMAIN_MAP.items()
}


# ─────────────────────────────────────────────────────────────────────────────
# Helper types
# ─────────────────────────────────────────────────────────────────────────────

class TopicScore(NamedTuple):
    score: float          # 0.0 – 1.0
    tier: str             # "primary" | "secondary" | "title_desc" | "none"
    matched_interest: Optional[str]
    matched_term: Optional[str]


class ExpertiseScore(NamedTuple):
    score: float          # 0.0 | 0.4 | 1.0
    explanation: str


class ItemScoreBreakdown(NamedTuple):
    topic:       float    # 0 – W_TOPIC
    expertise:   float    # 0 – W_EXPERTISE
    semantic:    float    # 0 – W_SEMANTIC
    behavioural: float    # 0 – W_BEHAVIOURAL
    quality:     float    # 0 – W_QUALITY
    total:       float    # sum
    reason:      str
    rejected:    bool
    reject_reason: str


# ─────────────────────────────────────────────────────────────────────────────
# Content-type normalisation (unchanged from original)
# ─────────────────────────────────────────────────────────────────────────────

def normalize_content_type(ctype: Optional[str]) -> Optional[List[str]]:
    """Map frontend/API content_type strings to DB content_type values."""
    if not ctype:
        return None
    c = ctype.strip().lower()
    if c in ("youtube", "video", "videos", "youtube_video", "youtube_videos"):
        return ["video", "youtube"]
    if c in ("article", "articles"):
        return ["article"]
    if c in ("github_repo", "github", "github_repos", "repo", "repos"):
        return ["github_repo"]
    if c in ("research_paper", "research", "research_papers", "paper", "papers"):
        return ["research_paper"]
    if c in ("ai_tool", "tool", "tools", "ai_tools"):
        return ["ai_tool"]
    return [c]


# ─────────────────────────────────────────────────────────────────────────────
# Topic relevance scorer  (Task 2)
# ─────────────────────────────────────────────────────────────────────────────

def compute_topic_relevance_score(
    item: ContentItem,
    user_interests: List[str],
) -> TopicScore:
    """
    Return a TopicScore (0.0 – 1.0) measuring how directly this item matches
    the user's selected interest domains.

    Scoring tiers:
        1.0  primary + category match   (e.g. content_category == "Cybersecurity" AND
                                          "penetration testing" in topics)
        0.90 primary category match     (content_category alone maps to the domain)
        0.80 primary term in topics/tech/skills
        0.65 primary term in title
        0.55 secondary term in topics/tech/skills
        0.40 secondary term in title/description   (surface-level, easily coincidental)
        0.20 primary/secondary term only in description
        0.0  no match

    The *best* score across all interests is returned.
    """
    if not user_interests:
        return TopicScore(1.0, "no_filter", None, None)

    meta        = item.ai_metadata or {}
    cat         = str(meta.get("content_category", "")).lower().strip()
    topics      = [str(t).lower().strip() for t in meta.get("topics", [])]
    techs       = [str(t).lower().strip() for t in meta.get("technologies", [])]
    skills      = [str(s).lower().strip() for s in meta.get("skills", [])]
    raw_topics  = [str(t).lower().strip()
                   for t in (item.raw_metadata or {}).get("topics", [])]
    title_lower = (item.title or "").lower()
    desc_lower  = (item.description or "").lower()

    best_score = 0.0
    best_tier  = "none"
    best_interest: Optional[str] = None
    best_term: Optional[str]     = None

    for interest in user_interests:
        key    = interest.lower().strip()
        domain = _NORMALISED_DOMAIN_MAP.get(key)
        if domain is None:
            # Unknown interest — fall back to a simple substring match capped at 0.55
            # Use exact match against title/cat/topics to avoid false positives
            import re as _re
            def _exact_word_in_text(kw: str, text: str) -> bool:
                if not kw or not text:
                    return False
                if kw in text:
                    return True
                # Also try whole-word boundary for short keywords
                if len(kw) <= 6:
                    tokens = _re.split(r"[^a-z0-9]+", text)
                    return kw in tokens
                return False

            if (_exact_word_in_text(key, cat)
                    or any(_exact_word_in_text(key, t) for t in topics + techs)):
                _score, _tier, _term = 0.55, "secondary", key
            elif _exact_word_in_text(key, title_lower):
                _score, _tier, _term = 0.40, "secondary", key
            elif _exact_word_in_text(key, desc_lower):
                _score, _tier, _term = 0.20, "desc_only", key
            else:
                continue
            if _score > best_score:
                best_score, best_tier, best_interest, best_term = (
                    _score, _tier, interest, _term
                )
            continue

        primary   = domain["primary"]
        secondary = domain["secondary"]
        cat_set   = domain["category"]

        # ── Category-level matching ───────────────────────────────────
        cat_matches_domain = cat in cat_set or any(c in cat for c in cat_set)

        # ── Term-level matching ───────────────────────────────────────
        # IMPORTANT: matching direction is intentionally one-way:
        #   p in t  → the primary term is a substring of the item tag/topic
        #             e.g. primary="penetration testing", tag="intro to penetration testing" ✓
        #
        # We deliberately DO NOT use `t in p` (item tag inside primary term) because
        # that direction creates false positives:
        #   tag="network" would match primary="network security"  ← WRONG
        #   tag="engineer" would match primary="social engineering" ← WRONG
        #   tag="internship" would match primary="incident response" ← WRONG
        #
        # For short primary terms (≤ 6 chars like "ids", "xss", "cve", "nmap"),
        # we require an exact whole-word match against the item tag to avoid
        # accidental substring collisions (e.g., "ids" inside "android-studio").

        def _term_matches_tag(term: str, tag: str) -> bool:
            """
            Return True when `term` genuinely describes `tag`.

            Rules:
              1. Exact match:   tag == term
              2. Term is multi-word (contains space): term is a substring of tag
                 e.g. term="penetration testing", tag="intro to penetration testing"
              3. Term is a single long word (> 6 chars): term is a substring of tag
                 e.g. term="metasploit", tag="using metasploit framework"
              4. Term is short (≤ 6 chars, e.g. "nmap", "ids", "xss"):
                 ONLY exact match or whole-word boundary in tag.
                 This prevents "ids" matching "android-studio".
            """
            if tag == term:
                return True
            # Multi-word primary term (phrase) — substring of tag is fine
            if " " in term:
                return term in tag
            # Long single-word term — substring match is reasonably safe
            if len(term) > 6:
                return term in tag
            # Short single-word term (≤ 6 chars) — require whole-word boundary
            # Split tag on non-alphanumeric chars and check for exact token match
            import re as _re
            tag_tokens = _re.split(r"[^a-z0-9]+", tag)
            return term in tag_tokens

        def _term_in_list(term: str, tag_list: List[str]) -> bool:
            return any(_term_matches_tag(term, tag) for tag in tag_list)

        all_structured = topics + techs + skills + raw_topics

        primary_in_topics   = any(_term_in_list(p, all_structured) for p in primary)
        primary_in_title    = any(_term_matches_tag(p, title_lower) for p in primary if len(p) > 3)
        primary_in_desc     = any(_term_matches_tag(p, desc_lower)  for p in primary if len(p) > 3)
        secondary_in_topics = any(_term_in_list(s, all_structured) for s in secondary)
        secondary_in_title  = any(_term_matches_tag(s, title_lower) for s in secondary if len(s) > 3)
        secondary_in_desc   = any(_term_matches_tag(s, desc_lower)  for s in secondary if len(s) > 3)

        # Identify the matched term for logging
        def _first_primary_match(search_in: List[str]) -> Optional[str]:
            for p in primary:
                if _term_in_list(p, search_in):
                    return p
            return None

        def _first_secondary_match(search_in: List[str]) -> Optional[str]:
            for s in secondary:
                if _term_in_list(s, search_in):
                    return s
            return None

        # ── Score assignment ──────────────────────────────────────────
        score: float = 0.0
        tier:  str   = "none"
        term: Optional[str] = None

        if cat_matches_domain and primary_in_topics:
            score, tier = 1.0, "primary"
            term = _first_primary_match(topics + techs + skills)
        elif cat_matches_domain:
            score, tier = 0.90, "primary"
            term = cat
        elif primary_in_topics:
            score, tier = 0.80, "primary"
            term = _first_primary_match(topics + techs + skills + raw_topics)
        elif primary_in_title:
            score, tier = 0.65, "primary"
            term = _first_primary_match([title_lower])
        elif secondary_in_topics:
            score, tier = 0.55, "secondary"
            term = _first_secondary_match(topics + techs + skills + raw_topics)
        elif secondary_in_title:
            score, tier = 0.40, "secondary"
            term = _first_secondary_match([title_lower])
        elif primary_in_desc:
            score, tier = 0.20, "primary"
            term = _first_primary_match([desc_lower])
        elif secondary_in_desc:
            score, tier = 0.15, "secondary"
            term = _first_secondary_match([desc_lower])

        if score > best_score:
            best_score    = score
            best_tier     = tier
            best_interest = interest
            best_term     = term

    return TopicScore(best_score, best_tier, best_interest, best_term)


# ─────────────────────────────────────────────────────────────────────────────
# Expertise / difficulty scorer  (Task 3)
# ─────────────────────────────────────────────────────────────────────────────

def compute_expertise_match_score(
    user_experience: str,
    item_difficulty: str,
    skill_levels: Optional[Dict[str, str]] = None,
    item_technologies: Optional[List[str]] = None,
    item_topics: Optional[List[str]] = None,
) -> ExpertiseScore:
    """
    Return an ExpertiseScore.

    If skill_levels is provided, checks if the item pertains to a specific technology
    where the user has a declared proficiency level.

    Scoring:
        Exact match                    → 1.0
        Adjacent level (±1 step)       → 0.4
        Opposite ends (beginner+adv)   → 0.0  ← hard gate
        Either value is empty/unknown  → 0.5  (neutral, no penalty, no boost)

    "Advanced" content for a "Beginner" user scores 0.0 regardless of topic.
    This is intentional: overwhelming content hurts learning and engagement.
    """
    effective_experience = user_experience
    matched_skill_name = None

    if skill_levels and (item_technologies or item_topics):
        cand_terms = [t.lower().strip() for t in (item_technologies or []) + (item_topics or [])]
        for skill, lvl in skill_levels.items():
            s_clean = skill.lower().strip()
            if any(s_clean in t or t in s_clean for t in cand_terms):
                if lvl and lvl.strip().lower() in _LEVELS:
                    effective_experience = lvl.strip().lower()
                    matched_skill_name = skill
                    break

    u = effective_experience.strip().lower() if effective_experience else ""
    d = item_difficulty.strip().lower()  if item_difficulty  else ""

    if not u or not d or d not in _LEVELS or u not in _LEVELS:
        return ExpertiseScore(0.5, "unknown difficulty or experience level — neutral")

    u_idx = _LEVELS.index(u)
    d_idx = _LEVELS.index(d)
    gap   = abs(u_idx - d_idx)

    suffix = f" (via skill: {matched_skill_name})" if matched_skill_name else ""

    if gap == 0:
        return ExpertiseScore(1.0, f"exact match: {d}{suffix}")
    if gap == 1:
        direction = "above" if d_idx > u_idx else "below"
        return ExpertiseScore(0.4, f"one level {direction}: user={u}, content={d}{suffix}")
    # gap == 2: beginner↔advanced
    return ExpertiseScore(
        0.0,
        f"hard mismatch: user={u}, content={d} (opposite ends){suffix}",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Direct-relevance gate  (Task 5 — replaces is_directly_relevant_to_interests)
# ─────────────────────────────────────────────────────────────────────────────

def is_directly_relevant(
    item: ContentItem,
    user_interests: List[str],
    user_experience: str,
    topic_score: TopicScore,
    expertise_score: ExpertiseScore,
) -> Tuple[bool, str]:
    """
    Strict gate: an item is "directly relevant" only if:
      - topic_score.tier == "primary"  (i.e. unambiguous domain match)
        OR topic_score.score >= 0.70   (high secondary score, e.g. 3 secondary hits)
      AND
      - expertise_score.score > 0.0   (not a hard expertise mismatch)

    Returns (is_relevant: bool, gate_reason: str).
    """
    if not user_interests:
        return True, "no interest filter"

    topic_ok    = topic_score.tier == "primary" or topic_score.score >= 0.70
    expertise_ok = expertise_score.score > 0.0

    if topic_ok and expertise_ok:
        return True, f"topic={topic_score.tier}({topic_score.score:.2f}) expertise={expertise_score.score:.2f}"

    if not topic_ok:
        return False, (
            f"topic too weak: tier={topic_score.tier}, score={topic_score.score:.2f} "
            f"(need primary OR ≥0.70)"
        )
    # topic ok but expertise hard mismatch
    return False, f"expertise hard mismatch: {expertise_score.explanation}"


# ─────────────────────────────────────────────────────────────────────────────
# UserBehaviorProfile  (unchanged from Module 22 — preserved exactly)
# ─────────────────────────────────────────────────────────────────────────────

class UserBehaviorProfile:
    """Aggregates historical building and activity signals per user."""

    def __init__(self):
        self.saved_item_ids:               Set[str]       = set()
        self.saved_topics:                 Set[str]       = set()
        self.saved_techs:                  Set[str]       = set()
        self.saved_categories:             Set[str]       = set()
        self.saved_content_types:          Dict[str, int] = {}
        self.completed_project_titles:     List[str]      = []
        self.completed_project_techs:      Set[str]       = set()
        self.completed_project_topics:     Set[str]       = set()
        self.completed_project_categories: Set[str]       = set()
        self.consumed_item_ids:            Set[str]       = set()
        self.consumed_topics:              Set[str]       = set()
        self.consumed_techs:               Set[str]       = set()
        self.search_query_terms:           Set[str]       = set()
        self.preferred_content_types:      Set[str]       = set()
        self.suppressed_item_ids:          Set[str]       = set()
        self.negative_topics:              Set[str]       = set()

    @classmethod
    def build(cls, db: Session, user: User) -> "UserBehaviorProfile":
        profile  = cls()
        user_id  = user.id

        # 1. Saved content
        try:
            from app.models.saved_content import SavedContent
            for sc in (
                db.query(SavedContent)
                .options(joinedload(SavedContent.content_item))
                .filter(SavedContent.user_id == user_id)
                .all()
            ):
                if sc.content_item:
                    item = sc.content_item
                    profile.saved_item_ids.add(str(item.id))
                    meta = item.ai_metadata or {}
                    cat  = str(meta.get("content_category", "")).lower()
                    if cat:
                        profile.saved_categories.add(cat)
                    profile.saved_topics.update(str(t).lower() for t in meta.get("topics", []))
                    profile.saved_techs.update(str(t).lower() for t in meta.get("technologies", []))
                    if item.content_type:
                        profile.saved_content_types[item.content_type] = (
                            profile.saved_content_types.get(item.content_type, 0) + 1
                        )
        except Exception as exc:
            logger.debug("Saved signals error for %s: %s", user_id, exc)

        # 2. Completed projects
        try:
            from app.models.project import Project
            for p in (
                db.query(Project)
                .options(joinedload(Project.content_item))
                .filter(Project.user_id == user_id, Project.status == "completed")
                .all()
            ):
                if p.title:
                    profile.completed_project_titles.append(p.title.lower())
                profile.completed_project_techs.update(
                    str(t).lower() for t in (p.technologies or [])
                )
                if p.content_item:
                    meta = p.content_item.ai_metadata or {}
                    cat  = str(meta.get("content_category", "")).lower()
                    if cat:
                        profile.completed_project_categories.add(cat)
                    profile.completed_project_topics.update(
                        str(t).lower() for t in meta.get("topics", [])
                    )
                    profile.completed_project_techs.update(
                        str(t).lower() for t in meta.get("technologies", [])
                    )
        except Exception as exc:
            logger.debug("Completed project signals error for %s: %s", user_id, exc)

        # 3. Consumed content
        try:
            from app.models.user_consumed_content import UserConsumedContent
            for uc in (
                db.query(UserConsumedContent)
                .options(joinedload(UserConsumedContent.content_item))
                .filter(UserConsumedContent.user_id == user_id)
                .all()
            ):
                profile.consumed_item_ids.add(str(uc.content_item_id))
                if uc.content_item:
                    meta = uc.content_item.ai_metadata or {}
                    profile.consumed_topics.update(
                        str(t).lower() for t in meta.get("topics", [])
                    )
                    profile.consumed_techs.update(
                        str(t).lower() for t in meta.get("technologies", [])
                    )
        except Exception as exc:
            logger.debug("Consumed signals error for %s: %s", user_id, exc)

        # 4. Search queries (last 20)
        try:
            from app.models.user_search_query import UserSearchQuery
            for s in (
                db.query(UserSearchQuery)
                .filter(UserSearchQuery.user_id == user_id)
                .order_by(UserSearchQuery.created_at.desc())
                .limit(20)
                .all()
            ):
                profile.search_query_terms.update(
                    w for w in re.split(r"[\s,/]+", s.query.lower()) if len(w) > 2
                )
        except Exception as exc:
            logger.debug("Search signals error for %s: %s", user_id, exc)

        # 5. User feedback signals (dismiss & irrelevant content suppression)
        try:
            from app.models.user_content_feedback import UserContentFeedback
            for fb in (
                db.query(UserContentFeedback)
                .options(joinedload(UserContentFeedback.content_item))
                .filter(UserContentFeedback.user_id == user_id)
                .all()
            ):
                if fb.feedback_type in ("dismiss", "irrelevant", "too_easy", "too_hard"):
                    profile.suppressed_item_ids.add(str(fb.content_item_id))
                    if fb.feedback_type == "irrelevant" and fb.content_item and fb.content_item.ai_metadata:
                        profile.negative_topics.update(
                            str(t).lower() for t in fb.content_item.ai_metadata.get("topics", [])
                        )
                        profile.negative_topics.update(
                            str(t).lower() for t in fb.content_item.ai_metadata.get("technologies", [])
                        )
        except Exception as exc:
            logger.debug("Feedback signals error for %s: %s", user_id, exc)

        # Preferred content types (saved ≥ 2 times)
        profile.preferred_content_types = {
            ct for ct, n in profile.saved_content_types.items() if n >= 2
        }

        return profile


# ─────────────────────────────────────────────────────────────────────────────
# Core scoring function  (Task 6)
# ─────────────────────────────────────────────────────────────────────────────

def _score_item(
    item:              ContentItem,
    user_interests:    List[str],
    user_experience:   str,
    user_goals:        List[str],
    target_content_type: Optional[str],
    user_vector:       Optional[List[float]],
    seed:              Optional[int],
    behavior_profile:  Optional[UserBehaviorProfile],
    topic_score_cache: Optional[TopicScore]    = None,
    exp_score_cache:   Optional[ExpertiseScore] = None,
    user_skill_levels: Optional[Dict[str, str]] = None,
) -> ItemScoreBreakdown:
    """
    Compute a structured score breakdown for one item.

    All signals are normalised to [0, 1] before multiplying by their weight,
    so the final total is on a 0 – 100 scale matching the weight constants.

    Logs a DEBUG record with all sub-scores for every item.
    """
    meta           = item.ai_metadata or {}
    difficulty     = str(meta.get("difficulty_level", "")).lower()
    builder_rel    = str(meta.get("builder_relevance", "")).lower()
    title_lower    = (item.title or "").lower()
    desc_lower     = (item.description or "").lower()
    topics         = [str(t).lower() for t in meta.get("topics", [])]
    technologies   = [str(t).lower() for t in meta.get("technologies", [])]

    # ── Pre-computed scores (may be passed in from the loop) ──────────────
    ts = topic_score_cache   or compute_topic_relevance_score(item, user_interests)
    es = exp_score_cache     or compute_expertise_match_score(
        user_experience=user_experience,
        item_difficulty=difficulty,
        skill_levels=user_skill_levels,
        item_technologies=technologies,
        item_topics=topics,
    )

    # ── 1. TOPIC component (0 – W_TOPIC) ─────────────────────────────────
    topic_component = ts.score * W_TOPIC

    # Content-type category filter: if a specific type is requested and the
    # item matches, give a small additional boost (does not inflate topic score).
    type_boost = 0.0
    if target_content_type:
        target_types = normalize_content_type(target_content_type) or [target_content_type]
        if item.content_type in target_types:
            type_boost = 5.0   # modest — content type filter is UI preference, not relevance

    # ── 2. EXPERTISE component (0 – W_EXPERTISE) ─────────────────────────
    expertise_component = es.score * W_EXPERTISE

    # ── 3. SEMANTIC component (0 – W_SEMANTIC) ───────────────────────────
    semantic_component = 0.0
    semantic_sim       = 0.0
    if user_vector and item.embedding:
        sim = embedding_service.cosine_similarity(user_vector, item.embedding)
        semantic_sim = sim
        # Only count similarity above the noise floor (0.35).
        # Cap at 0.90 so semantic alone cannot dominate.
        if sim > 0.35:
            normalised = min((sim - 0.35) / (0.90 - 0.35), 1.0)
            semantic_component = normalised * W_SEMANTIC

    # ── 4. BEHAVIOURAL component (0 – W_BEHAVIOURAL) ─────────────────────
    behavioural_raw  = 0.0
    behav_reason_parts: List[str] = []

    if behavior_profile:
        item_topics_set = {str(t).lower() for t in meta.get("topics", [])}
        item_techs_set  = {str(t).lower() for t in meta.get("technologies", [])}
        category_lower  = str(meta.get("content_category", "")).lower()

        # Completed project match (+60 raw) — strongest signal
        proj_match = False
        if item_techs_set & behavior_profile.completed_project_techs:
            behavioural_raw += 60.0
            proj_match = True
            behav_reason_parts.append("completed-project-tech")
        elif item_topics_set & behavior_profile.completed_project_topics:
            behavioural_raw += 60.0
            proj_match = True
            behav_reason_parts.append("completed-project-topic")
        elif category_lower and category_lower in behavior_profile.completed_project_categories:
            behavioural_raw += 60.0
            proj_match = True
            behav_reason_parts.append("completed-project-category")
        else:
            for ptitle in behavior_profile.completed_project_titles:
                title_words = [w for w in ptitle.split() if len(w) > 3]
                if any(w in title_lower or w in desc_lower for w in title_words):
                    behavioural_raw += 60.0
                    proj_match = True
                    behav_reason_parts.append("completed-project-title")
                    break

        # Saved content match (+40 raw) — only if not already counted via project
        if not proj_match and (
            (item_topics_set & behavior_profile.saved_topics)
            or (item_techs_set & behavior_profile.saved_techs)
            or (category_lower and category_lower in behavior_profile.saved_categories)
        ):
            behavioural_raw += 40.0
            behav_reason_parts.append("saved-match")

        # Search query match (+25 raw)
        for term in behavior_profile.search_query_terms:
            if (
                term in title_lower
                or any(term in t for t in topics)
                or any(term in t for t in technologies)
            ):
                behavioural_raw += 25.0
                behav_reason_parts.append(f"search:{term}")
                break

        # Preferred content type (+10 raw)
        if item.content_type in behavior_profile.preferred_content_types:
            behavioural_raw += 10.0

        # Consumed affinity (+10 raw)
        if (item_topics_set & behavior_profile.consumed_topics) or (
            item_techs_set & behavior_profile.consumed_techs
        ):
            behavioural_raw += 10.0
            behav_reason_parts.append("consumed-affinity")

        # Negative topic suppression (−20 raw)
        if (item_topics_set | item_techs_set) & behavior_profile.negative_topics:
            behavioural_raw -= 25.0
            behav_reason_parts.append("negative-topic-penalty")

        # Repeat penalty (−30 raw)
        if str(item.id) in behavior_profile.consumed_item_ids:
            behavioural_raw -= 30.0
            behav_reason_parts.append("repeat-penalty")

    behavioural_raw = max(0.0, min(behavioural_raw, _MAX_BEHAVIOURAL_RAW))
    behavioural_component = (behavioural_raw / _MAX_BEHAVIOURAL_RAW) * W_BEHAVIOURAL

    # ── 5. QUALITY / GOAL / FRESHNESS component (0 – W_QUALITY) ─────────
    quality_raw = 0.0

    # AI relevance score (+30 raw max)
    ai_relevance = meta.get("relevance_score")
    if ai_relevance is not None:
        try:
            rel = float(ai_relevance)
            quality_raw += (rel / 100.0) * 30.0
        except (ValueError, TypeError):
            pass
    else:
        quality_raw += 15.0  # no AI score → neutral 50 %

    # Builder relevance penalty
    if builder_rel == "low":
        quality_raw = max(0.0, quality_raw - 15.0)
    elif builder_rel == "medium":
        quality_raw = max(0.0, quality_raw - 5.0)

    # Goal alignment (+20 raw max across all goals)
    if any("build" in g for g in user_goals) and meta.get("project_potential"):
        quality_raw += 10.0
    if any("learn" in g for g in user_goals) and meta.get("learning_value"):
        quality_raw += 10.0
    if any("improve" in g or "skill" in g for g in user_goals):
        if len(meta.get("skills", [])) >= 2:
            quality_raw += 7.0

    # Freshness (articles/papers only) — slight bonus for recent, slight penalty for stale
    if item.published_at and item.content_type in ("article", "research_paper"):
        pub = item.published_at
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=timezone.utc)
        age_days = (datetime.now(timezone.utc) - pub).days
        if age_days <= 30:
            quality_raw += 5.0     # fresh
        elif age_days > _FRESHNESS_STALE_DAYS:
            quality_raw = max(0.0, quality_raw - 5.0)  # stale

    # Seed perturbation (jitter for Refresh variety — max 3 pts, reduced from original 5)
    if seed is not None:
        item_hash  = abs(hash(str(item.id) + str(seed))) % 1000
        quality_raw += (item_hash / 1000.0) * 3.0

    quality_raw = max(0.0, min(quality_raw, _MAX_QUALITY_RAW))
    quality_component = (quality_raw / _MAX_QUALITY_RAW) * W_QUALITY

    # ── Totals ────────────────────────────────────────────────────────────
    total = (
        topic_component
        + type_boost
        + expertise_component
        + semantic_component
        + behavioural_component
        + quality_component
    )

    # ── Determine rejection ───────────────────────────────────────────────
    # An item fails the threshold only when user interests are set.
    threshold_score = topic_component + expertise_component
    rejected      = False
    reject_reason = ""
    if user_interests and threshold_score < STRICT_RELEVANCE_THRESHOLD:
        rejected      = True
        reject_reason = (
            f"below threshold: topic_score={ts.score:.2f}*{W_TOPIC}="
            f"{topic_component:.1f} + expertise={es.score:.2f}*{W_EXPERTISE}="
            f"{expertise_component:.1f} = {threshold_score:.1f} < {STRICT_RELEVANCE_THRESHOLD}"
        )

    # ── Build human-readable recommendation reason ────────────────────────
    reason_parts: List[str] = []

    if behav_reason_parts and "completed-project" in " ".join(behav_reason_parts):
        reason_parts.append("Related to your completed projects")
    elif "saved-match" in behav_reason_parts:
        reason_parts.append("Based on your saved content")
    elif any(r.startswith("search:") for r in behav_reason_parts):
        term = next(r.split(":")[1] for r in behav_reason_parts if r.startswith("search:"))
        reason_parts.append(f"Matches your search for '{term}'")

    if ts.matched_interest and ts.tier == "primary":
        reason_parts.append(f"Directly relevant to {ts.matched_interest}")
    elif ts.matched_interest:
        reason_parts.append(f"Related to {ts.matched_interest}")

    if es.score == 1.0 and user_experience:
        reason_parts.append(f"{user_experience.capitalize()} level")

    if semantic_sim > 0.60:
        reason_parts.append("Strong semantic match")

    if not reason_parts:
        # Generic fallback reasons per content type
        _fallbacks = {
            "github_repo":    "Popular repository for builders",
            "ai_tool":        "Featured AI tool for developers",
            "research_paper": "Latest research in tech & AI",
            "video":          "Featured video tutorial",
        }
        reason_parts.append(_fallbacks.get(item.content_type, "Trending in the builder community"))

    reason = reason_parts[0]

    # ── DEBUG logging ─────────────────────────────────────────────────────
    logger.debug(
        "feed_score item_id=%s content_type=%s "
        "topic=%.2f(%s,%.2f) expertise=%.2f(%.2f) "
        "semantic=%.2f(sim=%.3f) behavioural=%.2f(raw=%.1f,[%s]) "
        "quality=%.2f(raw=%.1f) total=%.2f threshold=%.2f "
        "rejected=%s reject_reason=%r reason=%r",
        item.id, item.content_type,
        topic_component, ts.tier, ts.score,
        expertise_component, es.score,
        semantic_component, semantic_sim,
        behavioural_component, behavioural_raw, ",".join(behav_reason_parts),
        quality_component, quality_raw,
        total, threshold_score,
        rejected, reject_reason, reason,
    )

    return ItemScoreBreakdown(
        topic       = round(topic_component, 3),
        expertise   = round(expertise_component, 3),
        semantic    = round(semantic_component, 3),
        behavioural = round(behavioural_component, 3),
        quality     = round(quality_component, 3),
        total       = round(total, 3),
        reason      = reason,
        rejected    = rejected,
        reject_reason = reject_reason,
    )


# ─────────────────────────────────────────────────────────────────────────────
# FeedService
# ─────────────────────────────────────────────────────────────────────────────

class FeedService:

    def get_personalized_feed(
        self,
        db:           Session,
        user:         User,
        content_type: Optional[str] = None,
        limit:        int           = 20,
        offset:       int           = 0,
        seed:         Optional[int] = None,
    ) -> FeedResponse:
        """
        Build the personalised For You feed.

        Pipeline:
            1. DB retrieval (respects discovery timestamp + content-type filter)
            2. Per-item topic + expertise scoring
            3. Threshold filtering → strict pool
            4. Composite scoring → sort
            5. Content-type interleaving (All Content view only)
            6. Like-count attachment
            7. Paginate + return
        """
        user_interests   = user.interests       or []
        user_experience  = (user.experience_level or "").lower()
        user_skill_levels = user.skill_levels   or {}
        user_goals       = [g.lower() for g in (user.goals or [])]

        # ── Behavioural profile (Module 22) ───────────────────────────────
        behavior_profile = UserBehaviorProfile.build(db, user)

        # ── Candidate retrieval ───────────────────────────────────────────
        base_filter = (
            db.query(ContentItem)
            .filter(ContentItem.content_type.notin_(EXCLUDED_CONTENT_TYPES))
            .filter(ContentItem.quality_status != "rejected")
        )
        target_types = normalize_content_type(content_type)
        if target_types:
            base_filter = base_filter.filter(ContentItem.content_type.in_(target_types))

        # Prefer items from the most recent discovery cycle when available
        all_items: List[ContentItem] = []
        if user.last_feed_discovery_at is not None:
            all_items = base_filter.filter(
                ContentItem.discovered_at >= user.last_feed_discovery_at
            ).all()
        if not all_items:
            all_items = base_filter.all()

        # Suppress items user has dismissed or marked irrelevant
        if behavior_profile.suppressed_item_ids:
            all_items = [item for item in all_items if str(item.id) not in behavior_profile.suppressed_item_ids]

        if not all_items:
            return FeedResponse(items=[], total=0, page=1, limit=limit, has_more=False)

        logger.info(
            "feed_build user=%s interests=%s experience=%s skill_levels=%s candidates=%d",
            user.id, user_interests, user_experience, user_skill_levels, len(all_items),
        )

        # ── Semantic embedding vector for user profile ────────────────────
        user_profile_text = (
            f"Interests: {', '.join(user_interests)}. "
            f"Goals: {', '.join(user_goals)}. "
            f"Experience: {user_experience}"
        )
        user_vector: Optional[List[float]] = None
        if user_interests:
            try:
                user_vector = embedding_service.get_embedding_vector(user_profile_text)
            except Exception as exc:
                logger.warning("Failed to generate user embedding vector: %s", exc)

        # ── Score every candidate ─────────────────────────────────────────
        strict_pool:   List[Tuple[ContentItem, ItemScoreBreakdown]] = []
        fallback_pool: List[Tuple[ContentItem, ItemScoreBreakdown]] = []
        rejected_count = 0

        for item in all_items:
            # Pre-compute topic/expertise scores so they can be reused in both
            # the gate check and the composite scorer without duplication.
            ts = compute_topic_relevance_score(item, user_interests)
            meta       = item.ai_metadata or {}
            difficulty = str(meta.get("difficulty_level", "")).lower()
            techs      = [str(t).lower() for t in meta.get("technologies", [])]
            topics     = [str(t).lower() for t in meta.get("topics", [])]
            es = compute_expertise_match_score(
                user_experience=user_experience,
                item_difficulty=difficulty,
                skill_levels=user_skill_levels,
                item_technologies=techs,
                item_topics=topics,
            )

            breakdown = _score_item(
                item               = item,
                user_interests     = user_interests,
                user_experience    = user_experience,
                user_goals         = user_goals,
                target_content_type= content_type,
                user_vector        = user_vector,
                seed               = seed,
                behavior_profile   = behavior_profile,
                topic_score_cache  = ts,
                exp_score_cache    = es,
                user_skill_levels  = user_skill_levels,
            )

            if breakdown.rejected:
                rejected_count += 1
                # Items that fail the threshold but still have SOME topic match
                # go to the fallback pool so we never show a completely empty feed.
                if ts.score > 0.0:
                    fallback_pool.append((item, breakdown))
                continue

            # Check the direct-relevance gate
            relevant, gate_reason = is_directly_relevant(
                item, user_interests, user_experience, ts, es
            )
            if relevant:
                strict_pool.append((item, breakdown))
            else:
                fallback_pool.append((item, breakdown))

        logger.info(
            "feed_pools user=%s strict=%d fallback=%d rejected=%d",
            user.id, len(strict_pool), len(fallback_pool), rejected_count,
        )

        # Choose which pool to use.
        # Use strict pool if it has items. Fall back only for the FIRST page
        # when the strict pool is completely empty (e.g. user's topic has no
        # matching content yet) — never mix pools across pages.
        if strict_pool:
            scored_items = sorted(strict_pool,  key=lambda x: x[1].total, reverse=True)
        elif offset == 0:
            logger.warning(
                "feed_fallback user=%s: no strictly relevant items found, "
                "using fallback pool (interests=%s)",
                user.id, user_interests,
            )
            scored_items = sorted(fallback_pool, key=lambda x: x[1].total, reverse=True)
        else:
            # Page 2+ with no strict items — return empty rather than mixing
            scored_items = []

        # ── Content-type interleaving (All Content view) ──────────────────
        if not content_type and len(scored_items) > 5:
            scored_items = self._interleave(scored_items)

        total     = len(scored_items)
        paginated = scored_items[offset : offset + limit]

        # ── Like counts (batch query) ─────────────────────────────────────
        page_ids = [item.id for item, _ in paginated]
        like_count_map: Dict = {}
        user_liked_set: Set  = set()
        if page_ids:
            count_rows = (
                db.query(
                    ContentItemLike.content_item_id,
                    func.count(ContentItemLike.id).label("cnt"),
                )
                .filter(ContentItemLike.content_item_id.in_(page_ids))
                .group_by(ContentItemLike.content_item_id)
                .all()
            )
            like_count_map = {str(r.content_item_id): r.cnt for r in count_rows}
            liked_rows = (
                db.query(ContentItemLike.content_item_id)
                .filter(
                    ContentItemLike.user_id == user.id,
                    ContentItemLike.content_item_id.in_(page_ids),
                )
                .all()
            )
            user_liked_set = {str(r[0]) for r in liked_rows}

        # ── Build response ────────────────────────────────────────────────
        feed_items: List[FeedItemResponse] = []
        for item, bd in paginated:
            iid = str(item.id)
            feed_items.append(FeedItemResponse(
                id                   = item.id,
                source_id            = item.source_id,
                external_id          = item.external_id,
                content_type         = item.content_type,
                title                = item.title,
                description          = item.description,
                source_url           = item.source_url,
                author               = item.author,
                thumbnail_url        = item.thumbnail_url,
                published_at         = item.published_at,
                discovered_at        = item.discovered_at,
                raw_metadata         = item.raw_metadata or {},
                status               = item.status,
                ai_metadata          = item.ai_metadata,
                embedding_status     = item.embedding_status,
                created_at           = item.created_at,
                updated_at           = item.updated_at,
                score                = round(bd.total, 2),
                recommendation_reason= bd.reason,
                like_count           = like_count_map.get(iid, 0),
                is_liked             = iid in user_liked_set,
            ))

        has_more = (offset + limit) < total
        page     = (offset // limit) + 1 if limit > 0 else 1

        return FeedResponse(
            items    = feed_items,
            total    = total,
            page     = page,
            limit    = limit,
            has_more = has_more,
        )

    # ── calculate_item_score — kept for backwards-compat / external callers ──
    def calculate_item_score(
        self,
        item:               ContentItem,
        user_interests:     List[str],
        user_experience:    str,
        user_goals:         List[str],
        target_content_type: Optional[str]          = None,
        user_vector:        Optional[List[float]]   = None,
        seed:               Optional[int]           = None,
        behavior_profile:   Optional[UserBehaviorProfile] = None,
    ) -> Tuple[float, str]:
        """
        Public shim that delegates to _score_item.
        Preserved so any existing callers (tests, API endpoints) still work.
        """
        bd = _score_item(
            item               = item,
            user_interests     = user_interests,
            user_experience    = user_experience,
            user_goals         = user_goals,
            target_content_type= target_content_type,
            user_vector        = user_vector,
            seed               = seed,
            behavior_profile   = behavior_profile,
        )
        return bd.total, bd.reason

    # ── Content-type interleaving ─────────────────────────────────────────
    @staticmethod
    def _interleave(
        scored_items: List[Tuple[ContentItem, ItemScoreBreakdown]],
    ) -> List[Tuple[ContentItem, ItemScoreBreakdown]]:
        """Round-robin across content types to keep the feed visually diverse."""
        by_type: Dict[str, List[Tuple[ContentItem, ItemScoreBreakdown]]] = {}
        for entry in scored_items:
            ctype = entry[0].content_type or "article"
            by_type.setdefault(ctype, []).append(entry)

        interleaved: List[Tuple[ContentItem, ItemScoreBreakdown]] = []
        types   = list(by_type.keys())
        max_len = max(len(v) for v in by_type.values()) if by_type else 0
        for i in range(max_len):
            for ctype in types:
                if i < len(by_type[ctype]):
                    interleaved.append(by_type[ctype][i])
        return interleaved

    # ── Legacy interleave_content_types — kept for any existing callers ───
    def interleave_content_types(
        self,
        scored_items: List[Tuple],
    ) -> List[Tuple]:
        """Compatibility wrapper around _interleave."""
        return self._interleave(scored_items)  # type: ignore[arg-type]

    def record_user_feedback(
        self,
        db: Session,
        user: User,
        item_id: Any,
        feedback_type: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Record user feedback on a content item and adapt their skill levels / feed preferences in real time.
        """
        from app.models.user_content_feedback import UserContentFeedback
        from app.models.content_item import ContentItem
        from sqlalchemy.orm.attributes import flag_modified
        from fastapi import HTTPException, status

        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")

        # Save or update feedback
        feedback = (
            db.query(UserContentFeedback)
            .filter(
                UserContentFeedback.user_id == user.id,
                UserContentFeedback.content_item_id == item_id,
                UserContentFeedback.feedback_type == feedback_type,
            )
            .first()
        )
        if not feedback:
            feedback = UserContentFeedback(
                user_id=user.id,
                content_item_id=item_id,
                feedback_type=feedback_type,
                reason=reason,
            )
            db.add(feedback)
        else:
            feedback.reason = reason

        meta = item.ai_metadata or {}
        techs = [str(t).lower().strip() for t in meta.get("technologies", []) if str(t).strip()]
        topics = [str(t).lower().strip() for t in meta.get("topics", []) if str(t).strip()]

        # Real-time skill adaptation
        skill_levels = dict(user.skill_levels or {})
        modified_skills = False

        target_keys = techs if techs else topics[:2]

        if feedback_type == "too_easy":
            for k in target_keys:
                cur = skill_levels.get(k, user.experience_level or "beginner").lower()
                if cur == "beginner":
                    skill_levels[k] = "intermediate"
                    modified_skills = True
                elif cur == "intermediate":
                    skill_levels[k] = "advanced"
                    modified_skills = True
        elif feedback_type == "too_hard":
            for k in target_keys:
                cur = skill_levels.get(k, user.experience_level or "advanced").lower()
                if cur == "advanced":
                    skill_levels[k] = "intermediate"
                    modified_skills = True
                elif cur == "intermediate":
                    skill_levels[k] = "beginner"
                    modified_skills = True

        if modified_skills:
            user.skill_levels = skill_levels
            flag_modified(user, "skill_levels")

        db.commit()
        db.refresh(user)

        return {
            "status": "success",
            "message": f"Feedback '{feedback_type}' recorded successfully",
            "feedback_type": feedback_type,
            "updated_skill_levels": user.skill_levels or {},
        }


feed_service = FeedService()
