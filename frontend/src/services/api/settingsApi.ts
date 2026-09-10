import { apiClient } from './client';
import { SettingsData, SettingsUpdateRequest } from '../../types/settings';

export const settingsApi = {
  getSettings: async (): Promise<SettingsData> => {
    const res = await apiClient.get<SettingsData>('/settings');
    return res.data;
  },

  updateSettings: async (data: SettingsUpdateRequest): Promise<SettingsData> => {
    const res = await apiClient.patch<SettingsData>('/settings', data);
    return res.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/settings/change-password', null, {
      params: { current_password: currentPassword, new_password: newPassword },
    });
    return res.data;
  },

  deleteAccount: async (password: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>('/settings/account', {
      data: { password },
    });
    return res.data;
  },
};
