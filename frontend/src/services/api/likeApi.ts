import { apiClient } from './client';

export interface LikeResponse {
  item_id: string;
  is_liked: boolean;
  like_count: number;
}

export interface LikeCountsResponse {
  counts: Record<string, number>;  // { [itemId]: count }
  liked_ids: string[];
}

export interface TrendingItem {
  rank: number;
  item_id: string;
  title: string;
  content_type: string;
  source_url: string;
  author?: string;
  thumbnail_url?: string;
  like_count: number;
  ai_metadata?: Record<string, any>;
}

export interface TrendingResponse {
  items: TrendingItem[];
  window_days: number;
}

export const likeApi = {
  /** Like a content item. Idempotent — safe to call even if already liked. */
  likeItem: async (itemId: string): Promise<LikeResponse> => {
    const res = await apiClient.post<LikeResponse>(`/likes/${itemId}`);
    return res.data;
  },

  /** Remove a like from a content item. */
  unlikeItem: async (itemId: string): Promise<LikeResponse> => {
    const res = await apiClient.delete<LikeResponse>(`/likes/${itemId}`);
    return res.data;
  },

  /** Get all item IDs the current user has liked. */
  getMyLikedIds: async (): Promise<string[]> => {
    const res = await apiClient.get<{ liked_item_ids: string[] }>('/likes/my-likes');
    return res.data.liked_item_ids || [];
  },

  /** Bulk fetch like counts + current user's liked state for a list of item IDs. */
  getLikeCounts: async (itemIds: string[]): Promise<LikeCountsResponse> => {
    const res = await apiClient.post<LikeCountsResponse>('/likes/counts', { item_ids: itemIds });
    return res.data;
  },

  /** Trending content ranked by total likes in a rolling window (default 7 days). */
  getTrending: async (windowDays = 7, limit = 5): Promise<TrendingResponse> => {
    const res = await apiClient.get<TrendingResponse>('/likes/trending', {
      params: { window_days: windowDays, limit },
    });
    return res.data;
  },
};
