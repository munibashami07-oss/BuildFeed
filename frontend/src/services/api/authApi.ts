import { apiClient } from './client';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  User,
  OnboardingRequest,
  ProfileUpdateRequest,
} from '../../types/auth';

export interface ForgotPasswordResponse {
  message: string;
}

export interface VerifyTokenResponse {
  valid: boolean;
  email?: string;
}

export const authApi = {
  /** Step 1 of signup: validates the form and returns a GitHub OAuth URL to redirect to.
   *  The account is NOT created until GitHub is connected (see /auth/github/callback). */
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const res = await apiClient.post<RegisterResponse>('/auth/register', data);
    return res.data;
  },

  skipGithubSignup: async (signupToken: string): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/register/skip-github', { signup_token: signupToken });
    return res.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', data);
    return res.data;
  },

  logout: async (): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/logout');
    return res.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  completeOnboarding: async (data: OnboardingRequest): Promise<User> => {
    const res = await apiClient.post<User>('/auth/onboarding', data);
    return res.data;
  },

  updateProfile: async (data: ProfileUpdateRequest): Promise<User> => {
    const res = await apiClient.put<User>('/auth/profile', data);
    return res.data;
  },

  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const res = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
    return res.data;
  },

  verifyResetToken: async (token: string): Promise<VerifyTokenResponse> => {
    const res = await apiClient.get<VerifyTokenResponse>(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
    return res.data;
  },

  resetPassword: async (token: string, new_password: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/reset-password', {
      token,
      new_password,
    });
    return res.data;
  },
};
