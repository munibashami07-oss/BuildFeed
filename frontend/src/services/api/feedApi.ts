import { apiClient } from './client';

export interface FeedItem {
  id: string;
  source_id: string;
  external_id: string;
  content_type: 'article' | 'image' | 'video' | 'github_repo' | 'research_paper' | 'ai_tool' | string;
  title: string;
  description?: string;
  source_url: string;
  author?: string;
  thumbnail_url?: string;
  published_at?: string;
  discovered_at: string;
  raw_metadata?: Record<string, any>;
  status: string;
  ai_metadata?: {
    short_summary?: string;
    topics?: string[];
    technologies?: string[];
    skills?: string[];
    difficulty_level?: 'Beginner' | 'Intermediate' | 'Advanced' | string;
    content_category?: string;
    project_potential?: string;
    learning_value?: string;
  };
  embedding_status?: string;
  created_at: string;
  updated_at: string;
  score: number;
  recommendation_reason: string;
  // Like system (Module 22)
  like_count?: number;
  is_liked?: boolean;
}

export interface FeedResponse {
  items: FeedItem[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface FeedFeedbackResponse {
  status: string;
  message: string;
  feedback_type: string;
  updated_skill_levels: Record<string, string>;
}

export const feedApi = {
  getForYouFeed: async (params?: {
    content_type?: string;
    limit?: number;
    offset?: number;
    seed?: number;
    refresh?: boolean;
  }): Promise<FeedResponse> => {
    const res = await apiClient.get<FeedResponse>('/feed/for-you', { params });
    return res.data;
  },

  submitFeedback: async (
    itemId: string,
    feedbackType: 'too_easy' | 'too_hard' | 'irrelevant' | 'dismiss',
    reason?: string
  ): Promise<FeedFeedbackResponse> => {
    const res = await apiClient.post<FeedFeedbackResponse>(`/feed/${itemId}/feedback`, {
      feedback_type: feedbackType,
      reason,
    });
    return res.data;
  },
};

