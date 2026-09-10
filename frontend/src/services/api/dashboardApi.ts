import { apiClient } from './client';
import { DashboardData, ActivityEvent } from '../../types/dashboard';

export const dashboardApi = {
  /** Fetch the full aggregated dashboard payload for the authenticated user. */
  getDashboard: async (): Promise<DashboardData> => {
    const res = await apiClient.get<DashboardData>('/dashboard');
    return res.data;
  },

  /** Fetch only the activity timeline — lighter refresh without full payload. */
  getActivity: async (): Promise<ActivityEvent[]> => {
    const res = await apiClient.get<ActivityEvent[]>('/dashboard/activity');
    return res.data;
  },
};
