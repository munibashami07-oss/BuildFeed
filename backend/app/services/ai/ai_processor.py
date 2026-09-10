import json
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.content_item import ContentItem
from app.schemas.ai_processing import AIAnalysisResult, ProcessingBatchResponse, ProcessingStatusSummary

logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc)


SYSTEM_PROMPT = """You are BuildFeed AI, an expert technical content curator for software builders, AI students, developers, researchers, and technical creators.

Your job is to analyze ONE content item at a time. The content may be an article, GitHub repository, research paper, documentation page, tutorial, YouTube video, AI tool, or other technical resource.

Analyze ONLY information supported by the provided content. Do not invent technologies, skills, topics, features, capabilities, or claims that are not supported by the content.

Return ONLY valid JSON with EXACTLY these keys:

{
  "short_summary": "2-3 concise sentences explaining what the content is and why it matters.",
  "content_type": "Article | GitHub Repository | Research Paper | Tutorial | YouTube Video | Documentation | AI Tool | Other",
  "topics": [],
  "technologies": [],
  "skills": [],
  "difficulty_level": "Beginner | Intermediate | Advanced",
  "content_category": "AI/ML | Web Development | Data Science | Robotics | Cybersecurity | Automation | Research | AI Tools | Game Development | Mobile Development | UI/UX | Startups",
  "project_potential": "Explain a concrete way a builder could use this content to build a project.",
  "learning_value": "Explain the main practical skill or knowledge a builder would gain.",
  "builder_relevance": "High | Medium | Low",
  "relevance_score": 50
}

CLASSIFICATION RULES:

1. CONTENT CATEGORY
Choose the single most appropriate primary category based on the actual content.

Do not classify content as "AI Tools" merely because AI is mentioned.

Examples:
- A cybersecurity vulnerability research paper → "Cybersecurity"
- A PyTorch deep-learning tutorial → "AI/ML"
- A ROS robotics repository → "Robotics"
- An LLM-powered developer tool → "AI Tools"
- A FastAPI web application tutorial → "Web Development"
- A Unity game engine tutorial → "Game Development"
- A React Native mobile app guide → "Mobile Development"
- A Figma UI design walkthrough → "UI/UX"
- A startup product launch case study → "Startups"

2. TECHNOLOGIES
Only list technologies explicitly present or clearly demonstrated in the content.

Do not infer technologies simply because they are commonly used for the topic.

3. SKILLS
List practical skills a builder would actually develop by studying or using the content.

Examples:
- Python
- API Integration
- RAG
- Computer Vision
- Prompt Engineering
- Backend Development
- Docker
- Git/GitHub

4. DIFFICULTY — BE STRICT AND PRECISE
Determine difficulty based on prerequisites, technical depth, implementation complexity, and assumed knowledge. Do NOT default to "Intermediate" when unsure — carefully evaluate each piece of content.

Beginner:
- Can be understood with basic programming knowledge (variables, loops, functions).
- Requires no specialized domain knowledge.
- Uses simple tools or introductory frameworks.
- Examples: "What is an API?", "Hello World in Python", "Introduction to HTML/CSS", "Getting started with Git".

Intermediate:
- Requires solid programming fundamentals and some domain knowledge.
- Involves integrating multiple tools, libraries, or services.
- Assumes familiarity with concepts like databases, REST APIs, version control.
- Examples: "Building a REST API with FastAPI", "React state management with Redux", "Deploying with Docker Compose", "Training a basic ML classifier".

Advanced:
- Requires significant specialized knowledge, advanced mathematics, systems knowledge, or research background.
- Involves complex architectures, optimization, low-level systems, or cutting-edge research.
- Assumes deep expertise in the domain.
- Examples: "Implementing a transformer from scratch", "Kernel exploitation techniques", "Distributed systems consensus algorithms", "Fine-tuning LLMs with RLHF", "Custom CUDA kernels for ML inference".

5. PROJECT POTENTIAL
Do not give generic statements such as "This could be useful for AI projects."

Describe at least one realistic project/application a builder could create from the concept.

6. LEARNING VALUE
Focus on what the builder will actually learn or be able to do after studying the content.

7. BUILDER RELEVANCE & TECHNICAL DEPTH — ASSESS STRICTLY
Inspect any provided transcripts, subtitles, or README architecture snippets:
- High:
  Directly teaches how to build, implement, or deploy something. Contains actual code, architecture decisions, practical step-by-step implementation, or hands-on tutorials. A builder can immediately apply what they learn.
- Medium:
  Contains useful concepts or high-level architecture but lacks concrete code examples, requiring significant additional research or implementation work.
- Low:
  Clickbait, marketing, vague summaries, opinion pieces, news announcements, or surface-level listicles with no actionable implementation details or code.

8. RELEVANCE SCORE (0-100) — CRITICAL METRIC
Score how valuable this content is for a technical builder who wants to learn, build, and ship real projects:

90-100: Essential — directly teaches how to build something specific, with working code/architecture and clear technical depth.
70-89: Very useful — strong technical content with practical application, clear learning path or buildable project.
50-69: Moderately useful — has some technical value but may be too theoretical, high-level overview, or only tangentially related to building.
30-49: Marginal — mostly informational, news-like, or requires extensive additional work to be actionable.
0-29: Low value / Clickbait — marketing, opinion pieces, vague announcements, or content with no practical builder application.

Be honest and strict with scoring. Reject or heavily penalize clickbait titles that lack instructional depth in their transcript or README.

9. TOPICS
Use 2-5 precise topic labels.

Avoid overly broad or redundant topics.

10. EMPTY VALUES
If a technology, skill, or topic cannot be reliably identified, return an empty array rather than guessing.

11. SUMMARY
Do not copy large portions of the source.
Write an original concise summary.

12. OUTPUT
Return ONLY valid JSON.
Do not include markdown.
Do not include explanations before or after the JSON.
Do not add keys outside the specified schema.
"""


DISCOVERY_QUERY_PROMPT = """You are BuildFeed Query Synthesizer, an expert AI specialized in formulating high-precision technical search queries for developer resources, tutorials, repositories, and learning content.

Given a user's technical profile (interests, goals, experience level, per-skill proficiencies, and active projects), formulate 2-4 HIGHLY SPECIFIC, level-appropriate search queries for GitHub and 2-4 for YouTube.

Rules for GitHub Queries:
- Use valid GitHub search qualifiers where appropriate: topic:<topic>, language:<lang>, stars:>10, or descriptive keywords.
- For beginners: prioritize starter templates, tutorial repos, curated examples, and well-documented beginner projects.
- For intermediate/advanced: focus on architecture, deep implementations, production-ready libraries, systems programming, and advanced patterns.
- Keep GitHub query strings URL-safe and concise.

Rules for YouTube Queries:
- Produce realistic, high-quality search queries targeting practical project walkthroughs, deep-dive tutorials, or architecture explanations.
- Include level indicators if relevant (e.g., 'tutorial beginner', 'from scratch', 'deep dive architecture', 'production deployment').

Return ONLY valid JSON with EXACTLY this structure:
{
  "github_queries": ["query 1", "query 2"],
  "youtube_queries": ["query 1", "query 2"]
}
"""

PROJECT_QUIZ_PROMPT = """You are BuildFeed Senior Staff Engineer and Technical Examiner.
Your task is to generate EXACTLY 8 VERY DIFFICULT, highly technical Multiple Choice Questions (MCQs) in JSON format to evaluate a developer's real technical understanding of the software project they just built.

RULES FOR QUESTIONS:
1. Target: Senior / Staff engineering depth.
2. Formulate 8 challenging technical scenarios, edge cases, failure modes, concurrency issues, performance bottlenecks, race conditions, or framework/library internal behaviors directly relevant to the technologies, architecture, and steps of this project.
3. Absolutely NO surface-level syntax questions, no simple definitions, and no basic trivia.
4. Each question must have:
   - "id": integer 1 through 8
   - "question": A detailed technical problem statement, code excerpt, or architectural conundrum.
   - "options": An array of EXACTLY 4 distinct, plausible answer strings.
   - "correct_option_index": 0, 1, 2, or 3 (0-indexed integer).
   - "explanation": A rigorous technical explanation of why the correct option is optimal and why other options are flawed or suboptimal.
   - "concept_tested": A concise title for the advanced concept tested (e.g. "Distributed Cache Invalidation", "Event Loop Starvation", "Zero-Copy Memory Mapping", "Deadlock Prevention in MVCC").

Return ONLY valid JSON with EXACTLY this structure:
{
  "questions": [
    {
      "id": 1,
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct_option_index": 0,
      "explanation": "...",
      "concept_tested": "..."
    }
  ]
}
"""

STEP_RESOURCE_PROMPT = """You are BuildFeed Technical Architect and Milestone Step Mentor.
Your task is to analyze a project milestone/step within a developer's project build and produce an actionable, structured implementation guide with key concepts, code tips, potential pitfalls, recommended modern libraries, and curated technical resources.

Given:
- Project Title, Objective, and Tech Stack
- Step Title, Step Index, and Total Steps
- User's Skill Level and Per-Skill Proficiencies
- Available Candidate Discovered Resources (if any)

Curriculum Phase options:
- "Phase 1: Architecture & Data Modeling" (for initial setup, schema, design)
- "Phase 2: Core Logic & Services" (for backend workers, algorithms, pipeline)
- "Phase 3: Integration & APIs" (for routes, endpoints, UI state, authentication)
- "Phase 4: Testing, Optimization & Deployment" (for test suites, docker, CI/CD, caching, production launch)

Return ONLY valid JSON with EXACTLY this structure:
{
  "phase": "Phase 1: Architecture & Data Modeling | Phase 2: Core Logic & Services | Phase 3: Integration & APIs | Phase 4: Testing, Optimization & Deployment",
  "key_concepts": ["Concept 1", "Concept 2", "Concept 3"],
  "implementation_tips": ["Concrete tip 1 with code or design guidance", "Concrete tip 2", "Concrete tip 3"],
  "common_pitfalls": ["Pitfall 1 with mitigation", "Pitfall 2 with mitigation"],
  "recommended_libraries": ["lib1", "lib2", "lib3"],
  "suggested_resources": [
    {
      "title": "...",
      "url": "https://...",
      "content_type": "Tutorial | GitHub Repository | Documentation | Article | YouTube Video",
      "source_name": "...",
      "short_summary": "...",
      "difficulty_level": "Beginner | Intermediate | Advanced",
      "relevance_reason": "Specific reason why this resource helps complete this milestone step."
    }
  ]
}
"""


class AIProcessingService:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL

    def generate_step_resource_guide(
        self,
        project_data: Dict[str, Any],
        step_data: Dict[str, Any],
        step_index: int,
        total_steps: int,
        user_level: str = "intermediate",
        user_skills: Optional[Dict[str, str]] = None,
        candidate_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Generate a milestone-specific technical guide and curated resources for an active project step."""
        title = project_data.get("title", "Project")
        objective = project_data.get("objective", "")
        technologies = project_data.get("technologies", [])
        step_title = step_data.get("title", f"Step {step_index + 1}")

        # Determine curriculum phase
        if total_steps <= 1:
            default_phase = "Phase 1: Architecture & Data Modeling"
        else:
            ratio = step_index / max(1, total_steps - 1)
            if ratio < 0.25:
                default_phase = "Phase 1: Architecture & Data Modeling"
            elif ratio < 0.60:
                default_phase = "Phase 2: Core Logic & Services"
            elif ratio < 0.85:
                default_phase = "Phase 3: Integration & APIs"
            else:
                default_phase = "Phase 4: Testing, Optimization & Deployment"

        api_key = self.api_key or settings.GEMINI_API_KEY
        if api_key:
            candidate_summary = []
            if candidate_items:
                for c in candidate_items[:6]:
                    candidate_summary.append({
                        "id": str(c.get("id", "")),
                        "title": c.get("title", ""),
                        "url": c.get("url", ""),
                        "content_type": c.get("content_type", "Article"),
                        "source": c.get("source_name", "Web"),
                        "summary": c.get("short_summary", "")[:160],
                    })

            user_prompt = f"""Project Title: {title}
Objective: {objective}
Technologies: {', '.join(technologies) if technologies else 'Full Stack Web'}
Current Milestone Step ({step_index + 1} of {total_steps}): {step_title}
User Experience Level: {user_level}
User Skill Proficiencies: {json.dumps(user_skills or {})}
Available Candidates: {json.dumps(candidate_summary)}

Produce an actionable step guide and curated resource list for this exact step."""

            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{self.model}:generateContent?key={api_key}"
            )

            payload = {
                "system_instruction": {
                    "parts": [{"text": STEP_RESOURCE_PROMPT}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": user_prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "responseMimeType": "application/json",
                },
            }

            headers = {"Content-Type": "application/json"}

            try:
                res = httpx.post(url, headers=headers, json=payload, timeout=20.0)
                if res.status_code == 200:
                    res_data = res.json()
                    raw_content = res_data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw_content)

                    # Map parsed resources back or format them
                    parsed_resources = parsed.get("suggested_resources", [])
                    formatted_resources = []
                    for r in parsed_resources:
                        if isinstance(r, dict) and r.get("title") and r.get("url"):
                            formatted_resources.append({
                                "id": r.get("id"),
                                "title": str(r.get("title", "")),
                                "url": str(r.get("url", "")),
                                "content_type": str(r.get("content_type", "Tutorial")),
                                "source_name": str(r.get("source_name", "Documentation")),
                                "short_summary": str(r.get("short_summary", "")),
                                "difficulty_level": str(r.get("difficulty_level", user_level.capitalize())),
                                "relevance_reason": str(r.get("relevance_reason", f"Directly applicable to {step_title}")),
                            })

                    # If AI returned no resources, populate from candidates
                    if not formatted_resources and candidate_items:
                        for item in candidate_items[:4]:
                            formatted_resources.append({
                                "id": str(item.get("id", "")),
                                "title": item.get("title", ""),
                                "url": item.get("url", "#"),
                                "content_type": item.get("content_type", "Tutorial"),
                                "source_name": item.get("source_name", "BuildFeed Feed"),
                                "short_summary": item.get("short_summary", item.get("description", ""))[:180],
                                "difficulty_level": item.get("difficulty_level", user_level.capitalize()),
                                "relevance_reason": f"Covers {', '.join(technologies[:2]) if technologies else 'core dependencies'} for {step_title}",
                            })

                    return {
                        "phase": parsed.get("phase", default_phase),
                        "key_concepts": [str(k) for k in parsed.get("key_concepts", []) if str(k)],
                        "implementation_tips": [str(t) for t in parsed.get("implementation_tips", []) if str(t)],
                        "common_pitfalls": [str(p) for p in parsed.get("common_pitfalls", []) if str(p)],
                        "recommended_libraries": [str(l) for l in parsed.get("recommended_libraries", []) if str(l)],
                        "resources": formatted_resources,
                    }
            except Exception as exc:
                logger.warning("Gemini step resource generation failed, falling back to local synthesizer: %s", exc)

        # Fallback generator
        primary_tech = technologies[0] if technologies else "Modern Web Stack"
        secondary_tech = technologies[1] if len(technologies) > 1 else "Database/Worker Layer"

        fallback_resources = []
        if candidate_items:
            for item in candidate_items[:4]:
                fallback_resources.append({
                    "id": str(item.get("id", "")),
                    "title": item.get("title", ""),
                    "url": item.get("url", "#"),
                    "content_type": item.get("content_type", "Tutorial"),
                    "source_name": item.get("source_name", "BuildFeed Feed"),
                    "short_summary": item.get("short_summary", item.get("description", ""))[:180],
                    "difficulty_level": item.get("difficulty_level", user_level.capitalize()),
                    "relevance_reason": f"Provides battle-tested patterns for {primary_tech} in {step_title}.",
                })

        if not fallback_resources:
            fallback_resources = [
                {
                    "id": None,
                    "title": f"{primary_tech} Official Architecture Guide & Reference",
                    "url": f"https://github.com/search?q={primary_tech.lower()}+tutorial+architecture&type=repositories",
                    "content_type": "Documentation",
                    "source_name": "Official Docs & GitHub",
                    "short_summary": f"Standard patterns, configuration schemas, and clean architecture practices for {primary_tech}.",
                    "difficulty_level": user_level.capitalize(),
                    "relevance_reason": f"Essential reference for implementing '{step_title}' reliably.",
                },
                {
                    "id": None,
                    "title": f"Production-Ready {secondary_tech} Setup & Best Practices",
                    "url": f"https://github.com/search?q={secondary_tech.lower()}+best+practices&type=repositories",
                    "content_type": "GitHub Repository",
                    "source_name": "GitHub",
                    "short_summary": f"Well-structured example codebase demonstrating dependency injection and error handling.",
                    "difficulty_level": user_level.capitalize(),
                    "relevance_reason": f"Provides real-world code templates and tests for this phase of {title}.",
                }
            ]

        return {
            "phase": default_phase,
            "key_concepts": [
                f"{primary_tech} Architectural Invariants & Data Flow",
                f"{secondary_tech} Connection Lifecycle & Error Boundaries",
                f"Stateless Protocol Design for '{step_title}'",
            ],
            "implementation_tips": [
                f"Define clear type contracts and data validation models before writing service logic for '{step_title}'.",
                f"Ensure error handlers return structured JSON responses rather than leaking raw exception stack traces.",
                f"Write unit or integration tests for the primary happy path and edge-case failure modes of this milestone.",
            ],
            "common_pitfalls": [
                "Hardcoding environment variables or credentials instead of using 12-Factor config management.",
                "Unbounded network timeouts or missing retry backoff on third-party API dependencies.",
                "Blocking synchronous calls inside asynchronous event handlers causing thread starvation.",
            ],
            "recommended_libraries": [
                primary_tech.lower(),
                secondary_tech.lower(),
                "pytest" if "python" in primary_tech.lower() else "vitest",
                "pydantic" if "python" in primary_tech.lower() else "zod",
            ],
            "resources": fallback_resources,
        }

    def generate_project_learning_quiz(self, project_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate 8 very difficult MCQs based on a completed project to test user depth of understanding."""
        title = project_data.get("title", "Software Project")
        objective = project_data.get("objective", "")
        description = project_data.get("description", "")
        technologies = project_data.get("technologies", [])
        steps = project_data.get("steps", [])

        api_key = self.api_key or settings.GEMINI_API_KEY
        if api_key:
            user_prompt = f"""Project Title: {title}
Objective: {objective}
Description: {description}
Technologies Used: {', '.join(technologies) if technologies else 'Full Stack Web / Python / Systems'}
Implementation Steps: {json.dumps([s.get('title') if isinstance(s, dict) else str(s) for s in steps])}

Generate EXACTLY 8 very difficult, deeply technical MCQs testing the developer's mastery of the underlying architecture, edge cases, performance tradeoffs, and library internals for this project."""

            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{self.model}:generateContent?key={api_key}"
            )

            payload = {
                "system_instruction": {
                    "parts": [{"text": PROJECT_QUIZ_PROMPT}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": user_prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.4,
                    "responseMimeType": "application/json",
                },
            }

            headers = {"Content-Type": "application/json"}

            try:
                res = httpx.post(url, headers=headers, json=payload, timeout=25.0)
                if res.status_code == 200:
                    res_data = res.json()
                    raw_content = res_data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw_content)
                    raw_questions = parsed.get("questions", [])
                    if len(raw_questions) == 8:
                        validated = []
                        for i, q in enumerate(raw_questions, 1):
                            opts = q.get("options", [])
                            if len(opts) == 4 and "correct_option_index" in q:
                                validated.append({
                                    "id": i,
                                    "question": str(q.get("question", "")),
                                    "options": [str(o) for o in opts],
                                    "correct_option_index": int(q.get("correct_option_index", 0)) % 4,
                                    "explanation": str(q.get("explanation", "")),
                                    "concept_tested": str(q.get("concept_tested", "Architectural Mastery")),
                                })
                        if len(validated) == 8:
                            return validated
            except Exception as exc:
                logger.warning("Gemini quiz generation failed: %s. Falling back to local synthesizer.", exc)

        # Fallback generator: 8 challenging MCQs synthesized from the project tech stack and architecture
        primary_tech = technologies[0] if technologies else "System Architecture"
        secondary_tech = technologies[1] if len(technologies) > 1 else "State Management"

        return [
            {
                "id": 1,
                "question": f"In {title}, when handling high-concurrency requests in {primary_tech}, what is the primary risk of executing un-awaited blocking I/O calls inside an asynchronous event loop handler?",
                "options": [
                    "It immediately crashes the OS process due to SIGSEGV.",
                    "It monopolizes the event loop thread, preventing all concurrent asynchronous tasks and active connections from processing until the blocking call returns.",
                    "It automatically forces the runtime to spin up an unbounded number of OS worker threads without throttling.",
                    "It corrupts HTTP/2 multiplexing headers on the reverse proxy layer."
                ],
                "correct_option_index": 1,
                "explanation": "In single-threaded event loop models (such as Node.js or Python asyncio used in modern backend architectures), blocking synchronous I/O operations block the entire event loop thread, causing latency spikes and starvation for all concurrent client connections.",
                "concept_tested": "Event Loop Concurrency & Thread Starvation"
            },
            {
                "id": 2,
                "question": f"During data mutations in {title}, how should you prevent race conditions and lost updates when two clients attempt to update the same record concurrently?",
                "options": [
                    "Rely exclusively on client-side state caching and optimism without backend verification.",
                    "Use pessimistic locking with 'SELECT ... FOR UPDATE' or optimistic concurrency control via a version/hash column check.",
                    "Disable database indexing during updates to speed up write locks.",
                    "Re-execute the API request on the client if HTTP status 200 is not received within 50ms."
                ],
                "correct_option_index": 1,
                "explanation": "Optimistic Concurrency Control (checking version/timestamp during UPDATE) or Pessimistic Locking (SELECT FOR UPDATE within a transaction) ensures ACID isolation and guarantees no concurrent write overwrites another transaction silently.",
                "concept_tested": "Database Isolation & Concurrency Control"
            },
            {
                "id": 3,
                "question": f"When caching frequently read endpoints in {title}, what is the most robust strategy to prevent a 'Cache Stampede' (Thundering Herd) when a hot key expires under heavy traffic?",
                "options": [
                    "Set the TTL to zero so items are always dynamically recomputed on every request.",
                    "Use probabilistic early expiration (XFetch algorithm) or a distributed mutex (mutex lock) so only one worker regenerates the cache while others await or serve stale-while-revalidate.",
                    "Flush all keys in Redis synchronously upon any write operation.",
                    "Increase client HTTP connection timeout to 60 seconds."
                ],
                "correct_option_index": 1,
                "explanation": "The XFetch probabilistic early expiration or mutex lock pattern prevents thousands of simultaneous cache misses from overwhelming the database when a popular cached key reaches its expiration time.",
                "concept_tested": "Distributed Cache Invalidation & Stampede Mitigation"
            },
            {
                "id": 4,
                "question": f"In the context of {secondary_tech} within this project, how does memory cleanup and garbage collection behavior impact long-running background workers?",
                "options": [
                    "Retaining references in global sets, unbounded closures, or unclosed connection pools prevents object deallocation, creating a slow memory leak that leads to OOM termination.",
                    "Modern garbage collectors automatically eliminate cyclic references even if active global roots point to them.",
                    "Garbage collection pauses can never exceed 1 microsecond regardless of heap size.",
                    "Stateless functions always consume zero heap memory throughout their lifecycle."
                ],
                "correct_option_index": 0,
                "explanation": "Unbounded caches, lingering listeners, circular references attached to active roots, or unclosed database connections prevent the garbage collector from reclaiming memory, eventually causing worker process crashes under load.",
                "concept_tested": "Heap Memory Allocation & Resource Leakage"
            },
            {
                "id": 5,
                "question": f"If an external network dependency in {title} experiences severe packet loss and elevated latency, what architectural pattern ensures the service degrades gracefully without cascading failure?",
                "options": [
                    "Indefinite exponential retry loop without backoff or jitter.",
                    "Circuit Breaker pattern combined with strict request timeouts and fallback degraded responses.",
                    "Synchronously queueing all incoming requests in RAM until the dependency recovers.",
                    "Dropping all TCP socket buffers on the host OS."
                ],
                "correct_option_index": 1,
                "explanation": "A Circuit Breaker trips after a threshold of failures or timeouts, fast-failing subsequent requests to protect system resources and allowing downstream services time to recover.",
                "concept_tested": "Fault Tolerance & Circuit Breaker Architecture"
            },
            {
                "id": 6,
                "question": f"When designing idempotent API endpoints (such as order placements or builds) in {title}, why is an Idempotency-Key header essential?",
                "options": [
                    "It encrypts the payload using asymmetric TLS certificates.",
                    "It allows the server to recognize duplicate requests caused by client retries or network timeouts and return the original cached response without re-executing side effects.",
                    "It replaces the database primary key with a client-supplied UUID.",
                    "It bypasses all rate limiting and authentication checks on the gateway."
                ],
                "correct_option_index": 1,
                "explanation": "An idempotency key enables safe retries across unstable networks: if a client retry occurs due to a dropped response, the backend serves the already-committed transaction result rather than creating duplicates.",
                "concept_tested": "API Idempotency & Distributed Transaction Safety"
            },
            {
                "id": 7,
                "question": f"In {title}, what is the security and architectural difference between stateful session cookies and stateless signed JWT tokens when scaling horizontally across multiple server instances?",
                "options": [
                    "JWTs cannot be verified without querying the central database on every request.",
                    "Stateless JWTs allow any backend node possessing the secret key to authenticate claims without shared session storage, but immediate token revocation requires a blacklist or short TTL with refresh rotation.",
                    "Session cookies are completely immune to Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF) by default.",
                    "JWT payloads are encrypted by default, preventing any client from reading claim contents."
                ],
                "correct_option_index": 1,
                "explanation": "Stateless JWT tokens scale horizontally with zero shared database session lookups, but revoking compromised tokens before expiration requires maintaining an active revocation list or using short-lived tokens with rotating refresh tokens.",
                "concept_tested": "Stateless Authentication & Scalability Tradeoffs"
            },
            {
                "id": 8,
                "question": f"To optimize database performance in {title} for complex queries involving multiple filters and sorting, which indexing strategy is most effective?",
                "options": [
                    "Creating a separate single-column index on every column in the table regardless of query pattern.",
                    "A composite (multi-column) index ordered by equality columns first, followed by range/sort columns to satisfy the index prefix rule and avoid file-sort operations.",
                    "Relying entirely on full table scans since modern NVMe SSDs make indexing obsolete.",
                    "Adding a UNIQUE constraint on the foreign key column to force an index scan."
                ],
                "correct_option_index": 1,
                "explanation": "Composite indexes must be structured according to the Left-to-Right prefix rule: placing equality filters first and range/order-by columns last enables index-only scans and avoids costly disk lookups and temporary sort buffers.",
                "concept_tested": "Query Optimization & Composite B-Tree Indexing"
            }
        ]

    def generate_targeted_discovery_queries(self, user_profile: Dict[str, Any]) -> Dict[str, List[str]]:
        """Call Gemini to generate tailored GitHub and YouTube search queries for a user profile."""
        api_key = self.api_key or settings.GEMINI_API_KEY
        if not api_key:
            logger.debug("GEMINI_API_KEY not configured. Skipping dynamic query synthesis.")
            return {"github_queries": [], "youtube_queries": []}

        user_prompt = f"User Profile:\n{json.dumps(user_profile, indent=2, default=str)}"

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={api_key}"
        )

        payload = {
            "system_instruction": {
                "parts": [{"text": DISCOVERY_QUERY_PROMPT}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.5,
                "responseMimeType": "application/json",
            },
        }

        headers = {"Content-Type": "application/json"}

        try:
            res = httpx.post(url, headers=headers, json=payload, timeout=20.0)
            if res.status_code != 200:
                logger.warning("Gemini query generation API error [%d]: %s", res.status_code, res.text)
                return {"github_queries": [], "youtube_queries": []}

            res_data = res.json()
            raw_content = res_data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw_content)

            gh_queries = [str(q).strip() for q in parsed.get("github_queries", []) if str(q).strip()]
            yt_queries = [str(q).strip() for q in parsed.get("youtube_queries", []) if str(q).strip()]

            return {
                "github_queries": gh_queries,
                "youtube_queries": yt_queries,
            }
        except Exception as exc:
            logger.warning("Failed to generate dynamic discovery queries via Gemini: %s", exc)
            return {"github_queries": [], "youtube_queries": []}

    def analyze_item(self, title: str, description: Optional[str], content_type: str, raw_metadata: Dict[str, Any]) -> AIAnalysisResult:
        """Call Gemini API to analyze content item and return validated AIAnalysisResult."""
        api_key = self.api_key or settings.GEMINI_API_KEY
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured in settings or environment.")

        prompt_parts = [
            f"Content Type: {content_type}",
            f"Title: {title}",
            f"Description: {description or 'N/A'}",
        ]
        if raw_metadata and raw_metadata.get("transcript_snippet"):
            prompt_parts.append(f"Video Transcript / Subtitles:\n{raw_metadata['transcript_snippet']}")
        if raw_metadata and raw_metadata.get("readme_snippet"):
            prompt_parts.append(f"Repository README Architecture / Instructions:\n{raw_metadata['readme_snippet']}")
        prompt_parts.append(f"Metadata: {json.dumps(raw_metadata or {}, default=str)}")

        user_prompt = "\n\n".join(prompt_parts)

        # Gemini REST API: POST to generateContent endpoint, API key as query param
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={api_key}"
        )

        # Gemini uses a single "contents" list; the system instruction is separate
        payload = {
            "system_instruction": {
                "parts": [{"text": SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "responseMimeType": "application/json",
            },
        }

        headers = {"Content-Type": "application/json"}

        print("--> calling httpx.post in analyze_item...")
        res = httpx.post(url, headers=headers, json=payload, timeout=30.0)
        print("<-- returned from httpx.post in analyze_item")
        if res.status_code != 200:
            raise RuntimeError(f"Gemini API error [{res.status_code}]: {res.text}")

        res_data = res.json()

        # Gemini response: candidates[0].content.parts[0].text
        try:
            raw_content = res_data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise RuntimeError(f"Unexpected Gemini response structure: {res_data}") from exc

        analysis = AIAnalysisResult.model_validate_json(raw_content)
        return analysis

    def process_item(self, db: Session, item_id: UUID, force: bool = False) -> ContentItem:
        """Process a single ContentItem by ID."""
        item = db.query(ContentItem).filter(ContentItem.id == item_id).first()
        if not item:
            raise ValueError(f"ContentItem {item_id} not found.")

        if item.status == "completed" and not force:
            logger.info("Item %s is already completed. Skipping (force=False).", item_id)
            return item

        # Mark as processing
        item.status = "processing"
        item.processing_error = None
        db.commit()

        try:
            analysis = self.analyze_item(
                title=item.title,
                description=item.description,
                content_type=item.content_type,
                raw_metadata=item.raw_metadata,
            )

            item.ai_metadata = analysis.model_dump()
            item.status = "completed"
            item.processed_at = utc_now()
            item.processing_error = None
            db.commit()
            db.refresh(item)
            return item

        except Exception as e:
            db.rollback()
            err_msg = f"AI Processing failed for item {item.id} ({item.title}): {str(e)}"
            logger.error(err_msg, exc_info=True)
            
            # Update item status to failed
            item.status = "failed"
            item.processing_error = str(e)
            db.commit()
            db.refresh(item)
            return item

    def process_batch(self, db: Session, limit: int = 10, force: bool = False) -> ProcessingBatchResponse:
        """Process a batch of pending/discovered/failed content items.

        Module 21: Items with quality_status='rejected' are excluded - they have been
        confirmed as duplicates, spam, unsafe, or broken and should not consume GEMINI
        tokens.  Items with quality_status='pending' (quality check not yet run) are
        still eligible so that deployments without quality checks enabled are unaffected.
        """
        query = db.query(ContentItem)
        if not force:
            query = query.filter(ContentItem.status.in_(["discovered", "pending", "failed"]))
        # Exclude quality-rejected items regardless of force flag
        query = query.filter(ContentItem.quality_status != "rejected")

        items = query.order_by(ContentItem.created_at.asc()).limit(limit).all()
        
        completed_count = 0
        failed_count = 0
        errors: List[str] = []

        for item in items:
            try:
                processed_item = self.process_item(db, item.id, force=force)
                if processed_item.status == "completed":
                    completed_count += 1
                else:
                    failed_count += 1
                    if processed_item.processing_error:
                        errors.append(processed_item.processing_error)
            except Exception as e:
                failed_count += 1
                errors.append(str(e))

        return ProcessingBatchResponse(
            total_items=len(items),
            completed=completed_count,
            failed=failed_count,
            errors=errors,
        )

    def get_status_summary(self, db: Session) -> ProcessingStatusSummary:
        """Get summary count of items by processing status."""
        discovered = db.query(ContentItem).filter(ContentItem.status.in_(["discovered", "pending"])).count()
        processing = db.query(ContentItem).filter(ContentItem.status == "processing").count()
        completed = db.query(ContentItem).filter(ContentItem.status == "completed").count()
        failed = db.query(ContentItem).filter(ContentItem.status == "failed").count()
        total = db.query(ContentItem).count()

        return ProcessingStatusSummary(
            discovered=discovered,
            processing=processing,
            completed=completed,
            failed=failed,
            total=total,
        )


ai_processor = AIProcessingService()
