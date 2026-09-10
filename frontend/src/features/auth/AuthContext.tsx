import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, LoginRequest, RegisterRequest } from '../../types/auth';
import { authApi } from '../../services/api/authApi';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  /** Validates the signup form and returns the GitHub option without forcing OAuth. */
  register: (data: RegisterRequest) => Promise<import('../../types/auth').RegisterResponse>;
  /** Completes signup without connecting GitHub. */
  completeSignupWithoutGithub: (signupToken: string) => Promise<void>;
  /** Called by GitHubCallbackPage once GitHub redirects back with a token. */
  completeGithubLogin: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AUTH_TOKEN_KEY = 'build_access_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await authApi.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.warn('Session bootstrap failed or token expired:', err);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    const response = await authApi.login(credentials);
    localStorage.setItem(AUTH_TOKEN_KEY, response.access_token);
    setUser(response.user);
  };

  const register = async (data: RegisterRequest) => {
    return authApi.register(data);
  };

  const completeSignupWithoutGithub = async (signupToken: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.skipGithubSignup(signupToken);
      localStorage.setItem(AUTH_TOKEN_KEY, response.access_token);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const completeGithubLogin = async (token: string) => {
    setIsLoading(true);
    try {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } catch {
      // Ignore network error on logout
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
      setIsLoading(false);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        completeSignupWithoutGithub,
        completeGithubLogin,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};