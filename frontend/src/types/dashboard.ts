// Types for Activity & Progress Dashboard (Module 17)

export type ActivityEventType =
  | 'project_completed'
  | 'project_started'
  | 'achievement_unlocked'
  | 'xp_earned'
  | 'content_saved'
  | 'level_up';

export interface ActivityEvent {
  event_type: ActivityEventType;
  title: string;
  detail: string | null;
  icon: string;           // lucide-react icon name
  timestamp: string;      // ISO-8601
  link: string | null;    // optional navigation target
}

export interface InProgressProject {
  id: string;
  title: string;
  progress_percent: number;
  difficulty_level: string | null;
  technologies: string[];
  updated_at: string;
}

export interface RecentAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked_at: string;
}

export interface FocusStatusSummary {
  consumed_today: number;
  limit: number;
  remaining: number;
  is_locked: boolean;
}

export interface DashboardData {
  // XP / Progression
  total_xp: number;
  level: number;
  level_title: string;
  xp_in_current_level: number;
  xp_for_current_level_span: number;
  xp_to_next_level: number;
  level_progress_percent: number;
  is_max_level: boolean;

  // Counts
  projects_completed: number;
  projects_in_progress: number;
  completed_steps_count: number;
  saved_count: number;
  achievements_unlocked: number;
  achievements_total: number;

  // Focus Gate
  focus: FocusStatusSummary;

  // Lists
  in_progress_projects: InProgressProject[];
  recent_achievements: RecentAchievement[];
  activity: ActivityEvent[];
}
