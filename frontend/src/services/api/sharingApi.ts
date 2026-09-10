import { apiClient } from './client';
import { PublishResponse, PublicProjectData } from '../../types/portfolio';

export const sharingApi = {
  /** Publish a completed project and get back the share URL. Requires auth. */
  publish: async (projectId: string): Promise<PublishResponse> => {
    const res = await apiClient.post<PublishResponse>(`/portfolio/${projectId}/publish`);
    return res.data;
  },

  /** Unpublish a project (keeps slug). Requires auth. */
  unpublish: async (projectId: string): Promise<PublishResponse> => {
    const res = await apiClient.post<PublishResponse>(`/portfolio/${projectId}/unpublish`);
    return res.data;
  },

  /** Fetch a public project by share slug. No auth required. */
  getPublicProject: async (slug: string): Promise<PublicProjectData> => {
    const res = await apiClient.get<PublicProjectData>(`/public/p/${slug}`);
    return res.data;
  },
};
