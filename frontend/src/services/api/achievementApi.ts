import { apiClient } from './client';
import { AchievementsResponse } from '../../types/progression';

export const achievementApi = {
  getAchievements: async (): Promise<AchievementsResponse> => {
    const res = await apiClient.get<AchievementsResponse>('/achievements');
    return res.data;
  },
};
