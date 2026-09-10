// Types for Global Search (Module 18)

export type MatchType = 'text' | 'semantic' | 'hybrid';

export interface SearchResultItem {
  id: string;
  content_type: string;
  title: string;
  description: string | null;
  source_url: string;
  author: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  discovered_at: string;
  ai_metadata: {
    short_summary?: string;
    topics?: string[];
    technologies?: string[];
    skills?: string[];
    difficulty_level?: string;
    content_category?: string;
    project_potential?: string;
  } | null;
  similarity_score: number;
  match_type: MatchType;
  interest_boost: boolean;
  is_saved: boolean;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  query: string;
  content_type_filter: string | null;
  has_more: boolean;
  used_semantic: boolean;
}

export interface SearchParams {
  q: string;
  content_type?: string;
  limit?: number;
  offset?: number;
}
