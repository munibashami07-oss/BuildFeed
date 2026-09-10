// Types for Project Portfolio / Showcase (Module 15)
// Updated for Module 16: is_public + share_slug added to PortfolioEntry

export interface PortfolioStep {
  id: string;
  title: string;
  is_completed: boolean;
  completed_at?: string | null;
}

export interface PortfolioEntry {
  project_id: string;
  title: string;
  objective: string | null;
  description: string | null;
  difficulty_level: string | null;
  technologies: string[];
  steps: PortfolioStep[];
  progress_percent: number;
  status: string;
  completed_at: string | null;
  created_at: string;
  content_item_title: string | null;
  content_item_url: string | null;
  github_url: string | null;
  demo_url: string | null;
  portfolio_summary: string | null;
  portfolio_updated_at: string | null;
  // Module 16: sharing
  is_public: boolean;
  share_slug: string | null;
}

export interface PortfolioListResponse {
  entries: PortfolioEntry[];
  total: number;
}

export interface PortfolioUpdateRequest {
  github_url?: string;
  demo_url?: string;
  portfolio_summary?: string;
}

// ── LinkedIn sharing (Module 17) ────────────────────────────────────────────

export interface LinkedInPostResponse {
  caption: string;
  share_url: string;
  has_api_key: boolean;
}

// ── Sharing (Module 16) ───────────────────────────────────────────────────────

export interface PublishResponse {
  project_id: string;
  is_public: boolean;
  share_slug: string | null;
  share_url: string | null;
}

export interface PublicProjectStep {
  id: string;
  title: string;
  is_completed: boolean;
}

export interface PublicProjectData {
  share_slug: string;
  title: string;
  objective: string | null;
  description: string | null;
  difficulty_level: string | null;
  technologies: string[];
  steps: PublicProjectStep[];
  progress_percent: number;
  completed_at: string | null;
  portfolio_summary: string | null;
  github_url: string | null;
  demo_url: string | null;
  inspired_by: string | null;
}