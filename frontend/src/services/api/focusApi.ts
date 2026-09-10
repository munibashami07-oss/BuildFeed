import { apiClient } from './client';

export interface FocusGateStatusResponse {
  limit: number;
  consumed_today: number;
  is_locked: boolean;
  consumed_date: string;
  remaining: number;
}

export interface ConsumeItemResponse {
  consumed_today: number;
  limit: number;
  is_locked: boolean;
  item_id: string;
  already_consumed_today: boolean;
}

export type ContentClassification = 'project_idea' | 'learning_resource' | 'tool_or_library';

export interface ProjectSuggestionResponse {
  content_classification: ContentClassification;
  classification_note: string;
  project_title: string;
  what_you_are_building: string;
  objective: string;
  description: string;
  technologies: string[];
  basic_steps: string[];
  usage_note?: string | null;
  based_on_item_title: string;
  based_on_item_id: string;
}

export const focusApi = {
  getFocusStatus: async (): Promise<FocusGateStatusResponse> => {
    const res = await apiClient.get<FocusGateStatusResponse>('/focus/status');
    return res.data;
  },

  consumeItem: async (itemId: string): Promise<ConsumeItemResponse> => {
    const res = await apiClient.post<ConsumeItemResponse>(`/focus/consume/${itemId}`);
    return res.data;
  },

  unlockFeed: async (): Promise<FocusGateStatusResponse> => {
    const res = await apiClient.post<FocusGateStatusResponse>('/focus/unlock');
    return res.data;
  },

  suggestProject: async (itemId: string, excludeTitles?: string[]): Promise<ProjectSuggestionResponse> => {
    const res = await apiClient.post<ProjectSuggestionResponse>('/focus/suggest-project', {
      item_id: itemId,
      exclude_titles: excludeTitles && excludeTitles.length ? excludeTitles : undefined,
    });
    return res.data;
  },
};
