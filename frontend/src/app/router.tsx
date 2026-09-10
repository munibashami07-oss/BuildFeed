import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { GitHubCallbackPage } from '../pages/GitHubCallbackPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { ProfilePage } from '../pages/ProfilePage';
import { SavedPage } from '../pages/SavedPage';
import { ProjectsListPage } from '../pages/ProjectsListPage';
import { ProjectWorkspacePage } from '../pages/ProjectWorkspacePage';
import { PortfolioPage } from '../pages/PortfolioPage';
import { PortfolioShowcasePage } from '../pages/PortfolioShowcasePage';
import { PublicShowcasePage } from '../pages/PublicShowcasePage';
import { SearchPage } from '../pages/SearchPage';
import { SettingsPage } from '../pages/SettingsPage';
import { RewardsPage } from '../pages/RewardsPage';

const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-paper text-primary">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs font-medium uppercase tracking-wider text-secondary">Loading build...</span>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && !user.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

const OnboardingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && user.onboarding_completed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (isAuthenticated) {
    if (user && !user.onboarding_completed) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnlyRoute>
        <RegisterPage />
      </PublicOnlyRoute>
    ),
  },
  {
    // GitHub redirects here after OAuth consent to finish signup and start the session.
    // Not wrapped in PublicOnlyRoute: isAuthenticated is still false while this runs.
    path: '/auth/callback',
    element: <GitHubCallbackPage />,
  },
  {
    path: '/forgot-password',
    element: (
      <PublicOnlyRoute>
        <ForgotPasswordPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/onboarding',
    element: (
      <OnboardingGuard>
        <OnboardingPage />
      </OnboardingGuard>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/rewards',
    element: (
      <ProtectedRoute>
        <RewardsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/saved',
    element: (
      <ProtectedRoute>
        <SavedPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects',
    element: (
      <ProtectedRoute>
        <ProjectsListPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects/:projectId',
    element: (
      <ProtectedRoute>
        <ProjectWorkspacePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/portfolio',
    element: (
      <ProtectedRoute>
        <PortfolioPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/portfolio/:projectId',
    element: (
      <ProtectedRoute>
        <PortfolioShowcasePage />
      </ProtectedRoute>
    ),
  },
  {
    // Public project showcase — no authentication required
    path: '/p/:slug',
    element: <PublicShowcasePage />,
  },
  {
    path: '/search',
    element: (
      <ProtectedRoute>
        <SearchPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);