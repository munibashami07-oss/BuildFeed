import { apiClient } from './client';
import { FeedItem } from './feedApi';
import { ProjectWithXPResponse } from '../../types/progression';

export interface ProjectStep {
  id: string;
  title: string;
  is_completed: boolean;
  completed_at?: string | null;
}

export interface ProjectItem {
  id: string;
  user_id: string;
  content_item_id?: string | null;
  title: string;
  objective?: string | null;
  description?: string | null;
  difficulty_level?: string | null;
  technologies: string[];
  steps: ProjectStep[];
  status: string;
  progress_percent: number;
  github_repo_url?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  content_item?: FeedItem | null;
}

export interface BuildStateResponse {
  exists: boolean;
  project: ProjectItem | null;
}

export interface GithubBuildAuthorizeResponse {
  github_authorize_url: string;
}

export interface ProjectListResponse {
  projects: ProjectItem[];
  total: number;
  in_progress_count: number;
  completed_count: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  concept_tested: string;
}

export interface LearningQuizResponse {
  project_id: string;
  project_title: string;
  questions: QuizQuestion[];
}

export interface StepResourceItem {
  id?: string | null;
  title: string;
  url: string;
  content_type: string;
  source_name?: string | null;
  short_summary: string;
  difficulty_level?: string | null;
  relevance_reason: string;
}

export interface StepResourceGuide {
  project_id: string;
  project_title: string;
  step_id: string;
  step_title: string;
  phase: string;
  key_concepts: string[];
  implementation_tips: string[];
  common_pitfalls: string[];
  recommended_libraries: string[];
  resources: StepResourceItem[];
}

export const projectApi = {
  getBuildState: async (itemId: string): Promise<BuildStateResponse> => {
    const res = await apiClient.get<BuildStateResponse>(`/projects/by-saved/${itemId}`);
    return res.data;
  },

  createProjectFromSaved: async (itemId: string, createGithubRepo = false): Promise<ProjectItem> => {
    const res = await apiClient.post<ProjectItem>(`/projects/create-from-saved/${itemId}`, null, {
      params: { create_github_repo: createGithubRepo },
    });
    return res.data;
  },

  getGithubBuildAuthorizeUrl: async (itemId: string): Promise<GithubBuildAuthorizeResponse> => {
    const res = await apiClient.get<GithubBuildAuthorizeResponse>(`/projects/build-from-saved/${itemId}/github-authorize`);
    return res.data;
  },

  createProject: async (
    data: {
      title: string;
      objective?: string;
      description?: string;
      difficulty_level?: string;
      technologies?: string[];
      steps?: string[];
      content_item_id?: string;
    },
    createGithubRepo = false
  ): Promise<ProjectItem> => {
    const res = await apiClient.post<ProjectItem>('/projects', data, {
      params: { create_github_repo: createGithubRepo },
    });
    return res.data;
  },

  getProjects: async (status?: string): Promise<ProjectListResponse> => {
    const res = await apiClient.get<ProjectListResponse>('/projects', {
      params: { status: status || 'all' },
    });
    return res.data;
  },

  getProject: async (projectId: string): Promise<ProjectItem> => {
    const res = await apiClient.get<ProjectItem>(`/projects/${projectId}`);
    return res.data;
  },

  getLearningQuiz: async (projectId: string): Promise<LearningQuizResponse> => {
    const res = await apiClient.get<LearningQuizResponse>(`/projects/${projectId}/learning-quiz`);
    return res.data;
  },

  getStepResources: async (projectId: string, stepId: string): Promise<StepResourceGuide> => {
    const res = await apiClient.get<StepResourceGuide>(`/projects/${projectId}/steps/${stepId}/resources`);
    return res.data;
  },

  updateProject: async (
    projectId: string,
    data: {
      title?: string;
      objective?: string;
      description?: string;
      difficulty_level?: string;
      technologies?: string[];
    }
  ): Promise<ProjectItem> => {
    const res = await apiClient.put<ProjectItem>(`/projects/${projectId}`, data);
    return res.data;
  },

  /** Returns the full XP+achievements envelope. Callers extract .project and .xp_event. */
  toggleStep: async (
    projectId: string,
    stepId: string,
    isCompleted: boolean
  ): Promise<ProjectWithXPResponse> => {
    const res = await apiClient.patch<ProjectWithXPResponse>(
      `/projects/${projectId}/steps/${stepId}`,
      null,
      { params: { is_completed: isCompleted } }
    );
    return res.data;
  },

  /** Returns the full XP+achievements envelope. Callers extract .project and .xp_event. */
  completeProject: async (projectId: string): Promise<ProjectWithXPResponse> => {
    const res = await apiClient.post<ProjectWithXPResponse>(`/projects/${projectId}/complete`);
    return res.data;
  },

  deleteProject: async (projectId: string): Promise<{ status: string; project_id: string }> => {
    const res = await apiClient.delete<{ status: string; project_id: string }>(`/projects/${projectId}`);
    return res.data;
  },
};
