import { apiClient } from './client';
import { ProgressionData } from '../../types/progression';

let cachedProgression: { data: ProgressionData; timestamp: number } | null = null;
let inFlightPromise: Promise<ProgressionData> | null = null;
const CACHE_TTL_MS = 5000;

export const progressionApi = {
  getProgression: async (forceRefresh = false): Promise<ProgressionData> => {
    const now = Date.now();
    if (!forceRefresh && cachedProgression && now - cachedProgression.timestamp < CACHE_TTL_MS) {
      return cachedProgression.data;
    }
    if (inFlightPromise && !forceRefresh) {
      return inFlightPromise;
    }

    inFlightPromise = apiClient
      .get<ProgressionData>('/progression')
      .then((res) => {
        cachedProgression = { data: res.data, timestamp: Date.now() };
        inFlightPromise = null;
        return res.data;
      })
      .catch((err) => {
        inFlightPromise = null;
        throw err;
      });

    return inFlightPromise;
  },

  invalidateCache: () => {
    cachedProgression = null;
    inFlightPromise = null;
  },

  /** DEV-ONLY: resets XP and level for the current user */
  resetProgression: async (): Promise<{ message: string }> => {
    progressionApi.invalidateCache();
    const res = await apiClient.post<{ message: string }>('/progression/reset');
    return res.data;
  },
};
