import { apiClient } from './client';
import {
  PortfolioEntry,
  PortfolioListResponse,
  PortfolioUpdateRequest,
  LinkedInPostResponse,
} from '../../types/portfolio';

export const portfolioApi = {
  /** Return all completed projects as portfolio entries for the authenticated user. */
  getPortfolio: async (): Promise<PortfolioListResponse> => {
    const res = await apiClient.get<PortfolioListResponse>('/portfolio');
    return res.data;
  },

  /** Return a single portfolio entry by project ID. */
  getEntry: async (projectId: string): Promise<PortfolioEntry> => {
    const res = await apiClient.get<PortfolioEntry>(`/portfolio/${projectId}`);
    return res.data;
  },

  /** Create or update portfolio metadata (GitHub URL, demo URL, summary). */
  upsertEntry: async (
    projectId: string,
    data: PortfolioUpdateRequest
  ): Promise<PortfolioEntry> => {
    const res = await apiClient.patch<PortfolioEntry>(`/portfolio/${projectId}`, data);
    return res.data;
  },

  /** Generate an AI-written LinkedIn caption + share link for a completed project. */
  generateLinkedInPost: async (projectId: string): Promise<LinkedInPostResponse> => {
    const res = await apiClient.post<LinkedInPostResponse>(`/portfolio/${projectId}/linkedin-post`);
    return res.data;
  },
};