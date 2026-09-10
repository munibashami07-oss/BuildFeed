import { apiClient } from './client';

export interface DiscoveryRunResponse {
  sources_processed: number;
  items_discovered: number;
  items_inserted: number;
  duplicates_skipped: number;
  errors: string[];
}

export const discoveryApi = {
  triggerDiscovery: async (): Promise<DiscoveryRunResponse> => {
    const res = await apiClient.post<DiscoveryRunResponse>('/discovery/trigger');
    return res.data;
  },
};