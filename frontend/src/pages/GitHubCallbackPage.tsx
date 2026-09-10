import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Alert } from '../components/ui/Alert';
import { Link } from 'react-router-dom';

/**
 * The backend redirects here after a successful GitHub OAuth exchange, appending
 * the new session token as a URL fragment: /auth/callback#token=xxx. Project-build callbacks may also include action=build&project_id=xxx.
 * A fragment (not a query param) is used so the token never hits server logs.
 */
export const GitHubCallbackPage: React.FC = () => {
  const { completeGithubLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const action = params.get('action');
    const projectId = params.get('project_id');

    if (!token) {
      setError('GitHub sign-in did not return a valid session. Please try signing up again.');
      return;
    }

    completeGithubLogin(token)
      .then(() => {
        if (action === 'build' && projectId) {
          navigate(`/projects/${projectId}`, { replace: true });
        } else {
          navigate('/onboarding', { replace: true });
        }
      })
      .catch(() => setError('We connected your GitHub account, but could not start your session. Please log in.'));
  }, [completeGithubLogin, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md text-center">
        {error ? (
          <>
            <Alert type="error" message={error} className="mb-6" />
            <Link to="/login" className="text-sm font-medium text-primary hover:text-accent underline underline-offset-4">
              Go to login
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-medium uppercase tracking-wider text-secondary">
              Connecting your GitHub account...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
