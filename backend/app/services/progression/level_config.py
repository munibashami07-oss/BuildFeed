"""
Level threshold configuration for the XP / Progression system.

To add or change levels, edit LEVEL_THRESHOLDS only.
Everything else (level calculation, next-level XP) derives from this list automatically.

Each entry is (level_number, xp_required_to_reach_that_level).
Level 1 always starts at 0 XP.
"""
from typing import List, Tuple

# (level, cumulative_xp_required)
LEVEL_THRESHOLDS: List[Tuple[int, int]] = [
    (1,    0),
    (2,    100),
    (3,    250),
    (4,    500),
    (5,    1_000),
    (6,    1_750),
    (7,    2_750),
    (8,    4_000),
    (9,    5_500),
    (10,   7_500),
]

MAX_LEVEL: int = LEVEL_THRESHOLDS[-1][0]


def calculate_level(total_xp: int) -> int:
    """Return the level corresponding to a total XP value."""
    level = 1
    for lvl, threshold in LEVEL_THRESHOLDS:
        if total_xp >= threshold:
            level = lvl
        else:
            break
    return level


def xp_for_level(level: int) -> int:
    """Return the cumulative XP required to reach a given level."""
    for lvl, threshold in LEVEL_THRESHOLDS:
        if lvl == level:
            return threshold
    # Beyond the table: extrapolate with a simple step
    last_lvl, last_xp = LEVEL_THRESHOLDS[-1]
    step = last_xp - LEVEL_THRESHOLDS[-2][1]
    return last_xp + (level - last_lvl) * step


def xp_needed_for_next_level(total_xp: int) -> int:
    """Return how many more XP points are needed to reach the next level.

    Returns 0 if the user is already at max level.
    """
    current_level = calculate_level(total_xp)
    next_level = current_level + 1
    next_threshold = xp_for_level(next_level)
    if current_level >= MAX_LEVEL:
        return 0
    return max(0, next_threshold - total_xp)


def xp_progress_in_current_level(total_xp: int) -> Tuple[int, int]:
    """Return (xp_earned_in_current_level, xp_required_for_current_level_span).

    Used to render a progress bar for the current level band.
    """
    current_level = calculate_level(total_xp)
    current_threshold = xp_for_level(current_level)

    if current_level >= MAX_LEVEL:
        span = xp_for_level(MAX_LEVEL) - xp_for_level(MAX_LEVEL - 1)
        earned = total_xp - current_threshold
        return (min(earned, span), span)

    next_threshold = xp_for_level(current_level + 1)
    span = next_threshold - current_threshold
    earned = total_xp - current_threshold
    return (max(0, earned), span)
