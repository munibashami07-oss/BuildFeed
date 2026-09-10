import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT bearer token automatically
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('build_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Format errors — preserve structured detail objects for callers that need them
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail;

    // If detail is a structured object (e.g. { title, message }), attach it and
    // produce a human-readable string message for generic consumers.
    if (detail && typeof detail === 'object') {
      const message = detail.message || detail.title || 'An unexpected error occurred';
      const enhanced = new Error(message) as any;
      enhanced.response = error.response;
      return Promise.reject(enhanced);
    }

    let message = 'An unexpected error occurred';
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((e: any) => e.msg).join(', ');
    } else if (error.message) {
      message = error.message;
    }

    const enhanced = new Error(message) as any;
    enhanced.response = error.response;
    return Promise.reject(enhanced);
  }
);
