import { apiClient } from './client';
import { SearchResponse, SearchParams } from '../../types/search';

export const searchApi = {
  /**
   * Global content search — combines text + semantic search.
   * Requires authentication (JWT sent automatically by apiClient).
   */
  search: async (params: SearchParams): Promise<SearchResponse> => {
    const res = await apiClient.get<SearchResponse>('/search/content', {
      params: {
        q: params.q,
        content_type: params.content_type || undefined,
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
      },
    });
    return res.data;
  },
};
