"""
Achievement Catalog — Module 13: Achievements & Milestones

Single source of truth for every achievement in the system.
To add a new achievement: add one AchievementDef entry here — nothing else changes.

Each AchievementDef carries:
  id          – slug used as the DB key (never change once in production)
  name        – display name
  description – short description shown in the UI
  icon        – lucide-react icon name (string, resolved in the frontend)
  category    – 'building' | 'exploration' | 'progression'
  threshold   – the numeric target (steps, projects, items, level) that unlocks it
  metric      – logical metric name used by AchievementService to read progress
"""
from dataclasses import dataclass, field
from typing import List


@dataclass(frozen=True)
class AchievementDef:
    id: str
    name: str
    description: str
    icon: str           # lucide-react icon name string
    category: str       # 'building' | 'exploration' | 'progression'
    threshold: int      # value at which the achievement unlocks
    metric: str         # logical key used by AchievementService


# ── Catalog ──────────────────────────────────────────────────────────────────
# Ordering: building → exploration → progression

ACHIEVEMENT_CATALOG: List[AchievementDef] = [

    # ── Building ──────────────────────────────────────────────────────────────
    AchievementDef(
        id="first_step",
        name="First Step",
        description="Complete your very first project milestone.",
        icon="CheckCircle2",
        category="building",
        threshold=1,
        metric="completed_steps",
    ),
    AchievementDef(
        id="step_streak_10",
        name="In the Zone",
        description="Complete 10 project milestones in total.",
        icon="Zap",
        category="building",
        threshold=10,
        metric="completed_steps",
    ),
    AchievementDef(
        id="step_streak_50",
        name="Milestone Maker",
        description="Complete 50 project milestones in total.",
        icon="Target",
        category="building",
        threshold=50,
        metric="completed_steps",
    ),
    AchievementDef(
        id="first_build",
        name="First Build",
        description="Complete your first project from start to finish.",
        icon="Rocket",
        category="building",
        threshold=1,
        metric="completed_projects",
    ),
    AchievementDef(
        id="builder",
        name="Builder",
        description="Complete 5 projects.",
        icon="Hammer",
        category="building",
        threshold=5,
        metric="completed_projects",
    ),
    AchievementDef(
        id="serial_builder",
        name="Serial Builder",
        description="Complete 10 projects.",
        icon="Layers",
        category="building",
        threshold=10,
        metric="completed_projects",
    ),
    AchievementDef(
        id="consistent_builder",
        name="Consistent Builder",
        description="Complete projects on 3 different calendar days.",
        icon="CalendarCheck",
        category="building",
        threshold=3,
        metric="project_completion_days",
    ),

    # ── Exploration ───────────────────────────────────────────────────────────
    AchievementDef(
        id="first_discovery",
        name="First Discovery",
        description="Read your first piece of content.",
        icon="BookOpen",
        category="exploration",
        threshold=1,
        metric="consumed_items",
    ),
    AchievementDef(
        id="explorer",
        name="Explorer",
        description="Discover 25 pieces of content.",
        icon="Compass",
        category="exploration",
        threshold=25,
        metric="consumed_items",
    ),
    AchievementDef(
        id="deep_diver",
        name="Deep Diver",
        description="Discover 100 pieces of content.",
        icon="Search",
        category="exploration",
        threshold=100,
        metric="consumed_items",
    ),

    # ── Progression ───────────────────────────────────────────────────────────
    AchievementDef(
        id="level_2",
        name="Level Up",
        description="Reach Level 2.",
        icon="TrendingUp",
        category="progression",
        threshold=2,
        metric="level",
    ),
    AchievementDef(
        id="level_5",
        name="Architect",
        description="Reach Level 5.",
        icon="Award",
        category="progression",
        threshold=5,
        metric="level",
    ),
    AchievementDef(
        id="level_10",
        name="Fellow",
        description="Reach the maximum level.",
        icon="Star",
        category="progression",
        threshold=10,
        metric="level",
    ),
]

# Fast lookup by id
CATALOG_BY_ID: dict = {a.id: a for a in ACHIEVEMENT_CATALOG}
