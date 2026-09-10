import { apiClient } from './client';
import { NotificationListResponse, NotificationItem } from '../../types/notification';

export const notificationApi = {
  getNotifications: async (limit = 30, offset = 0): Promise<NotificationListResponse> => {
    const res = await apiClient.get<NotificationListResponse>('/notifications', {
      params: { limit, offset },
    });
    return res.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await apiClient.get<{ unread_count: number }>('/notifications/unread-count');
    return res.data.unread_count;
  },

  markRead: async (id: string): Promise<NotificationItem> => {
    const res = await apiClient.patch<NotificationItem>(`/notifications/${id}/read`);
    return res.data;
  },

  markAllRead: async (): Promise<number> => {
    const res = await apiClient.post<{ marked_read: number }>('/notifications/read-all');
    return res.data.marked_read;
  },
};
