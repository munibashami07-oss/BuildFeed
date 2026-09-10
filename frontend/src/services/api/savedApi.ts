import { apiClient } from './client';
import { FeedItem, FeedResponse } from './feedApi';

export interface SavedItemIdsResponse {
  saved_item_ids: string[];
}

export const savedApi = {
  saveItem: async (itemId: string): Promise<{ status: string; id: string; item_id: string }> => {
    const res = await apiClient.post<{ status: string; id: string; item_id: string }>(`/saved/${itemId}`);
    return res.data;
  },

  unsaveItem: async (itemId: string): Promise<{ status: string; item_id: string }> => {
    const res = await apiClient.delete<{ status: string; item_id: string }>(`/saved/${itemId}`);
    return res.data;
  },

  getSavedItems: async (params?: {
    content_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<FeedResponse> => {
    const res = await apiClient.get<FeedResponse>('/saved', { params });
    return res.data;
  },

  getSavedItemIds: async (): Promise<string[]> => {
    const res = await apiClient.get<SavedItemIdsResponse>('/saved/ids');
    return res.data.saved_item_ids || [];
  },

  checkIsSaved: async (itemId: string): Promise<boolean> => {
    const res = await apiClient.get<{ item_id: string; is_saved: boolean }>(`/saved/check/${itemId}`);
    return res.data.is_saved;
  },
};


export interface ExternalProjectPlan {
  project_title: string;
  what_the_project_is: string;
  required_skills: string[];
  technologies: string[];
  difficulty_level: string;
  estimated_effort: string;
  implementation_steps: string[];
  suggested_milestones: string[];
  objective: string;
  description: string;
}

export interface ExternalImportResponse {
  item_id: string;
  title: string;
  description?: string | null;
  source_url: string;
  content_type: string;
  author?: string | null;
  metadata: Record<string, unknown>;
  analysis: Record<string, unknown>;
  project_plan: ExternalProjectPlan;
  is_saved: boolean;
}

export const externalImportApi = {
  analyze: async (url: string): Promise<ExternalImportResponse> => {
    const res = await apiClient.post<ExternalImportResponse>('/saved/external/analyze', { url });
    return res.data;
  },

  save: async (itemId: string): Promise<{ status: string; item_id: string; saved_id: string; title: string; source_url: string }> => {
    const res = await apiClient.post('/saved/external/' + itemId + '/save');
    return res.data;
  },
};
