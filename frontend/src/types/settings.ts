// Types for Settings & Personalization (Module 20)

export interface SettingsData {
  // Identity
  username: string;
  email: string;
  bio: string | null;
  avatar_url: string | null;
  // Appearance
  theme_preference: 'light' | 'dark';
  // Feed preferences
  interests: string[];
  experience_level: string | null;
  goals: string[];
  feed_content_limit: number;
  preferred_content_types: string[];
  // Notification preferences
  notif_enabled: boolean;
  notif_achievements: boolean;
  notif_projects: boolean;
  notif_content: boolean;
  // Privacy
  portfolio_public: boolean;
}

export interface SettingsUpdateRequest {
  username?: string;
  bio?: string;
  avatar_url?: string;
  theme_preference?: 'light' | 'dark';
  interests?: string[];
  experience_level?: string;
  goals?: string[];
  feed_content_limit?: number;
  preferred_content_types?: string[];
  notif_enabled?: boolean;
  notif_achievements?: boolean;
  notif_projects?: boolean;
  notif_content?: boolean;
  portfolio_public?: boolean;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface DeleteAccountRequest {
  password: string;
}
