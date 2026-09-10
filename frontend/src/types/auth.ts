export interface User {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  interests: string[];
  experience_level: string | null;
  goals: string[];
  onboarding_completed: boolean;
  theme_preference: 'light' | 'dark';
  // Module 20: extended profile
  bio: string | null;
  avatar_url: string | null;
  // Module 20: feed preferences
  feed_content_limit: number;
  preferred_content_types: string[];
  // Module 20: notification preferences
  notif_enabled: boolean;
  notif_achievements: boolean;
  notif_projects: boolean;
  notif_content: boolean;
  // Module 20: privacy
  portfolio_public: boolean;
  // GitHub integration
  github_username: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterResponse {
  github_authorize_url: string;
  signup_token: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OnboardingRequest {
  interests: string[];
  experience_level: string;
  goals: string[];
}

export interface ProfileUpdateRequest {
  username?: string;
  interests?: string[];
  experience_level?: string;
  goals?: string[];
  theme_preference?: 'light' | 'dark';
}
