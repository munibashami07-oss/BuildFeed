// Types for XP / Progression system (Module 12) and Achievements (Module 13)
import type { ProjectItem } from '../services/api/projectApi';

export interface ProgressionData {
  total_xp: number;
  level: number;
  level_title: string;
  xp_in_current_level: number;
  xp_for_current_level_span: number;
  xp_to_next_level: number;
  level_progress_percent: number;
  completed_steps_count: number;
  completed_projects_count: number;
  is_max_level: boolean;
}

export interface XPEvent {
  xp_earned: number;
  already_awarded: boolean;
  levelled_up: boolean;
  new_level: number | null;
  newly_unlocked_achievements: string[];
  progression: ProgressionData;
}

export interface ProjectWithXPResponse {
  project: ProjectItem;
  xp_event: XPEvent;
}

// Achievements

export type AchievementCategory = 'building' | 'exploration' | 'progression';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;              // lucide-react icon name
  category: AchievementCategory;
  threshold: number;
  metric: string;
  current_value: number;
  progress_percent: number;
  is_unlocked: boolean;
  unlocked_at: string | null; // ISO-8601 or null
}

export interface AchievementsResponse {
  achievements: Achievement[];
  total_count: number;
  unlocked_count: number;
}