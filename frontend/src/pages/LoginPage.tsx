import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { Alert } from '../components/ui/Alert';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface LoginNotification {
  type: 'error' | 'success';
  title: string;
  message: string;
}

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState<LoginNotification | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-dismiss the notification after a few seconds; user can also dismiss it manually.
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 6000);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    if (!email.trim() || !password) {
      setNotification({
        type: 'error',
        title: 'Missing fields.',
        message: 'Please enter both your email and password.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate('/dashboard');
    } catch (err: any) {
      const status = err?.response?.status;

      if (!err?.response) {
        // Request never reached the server (offline, DNS failure, backend down, timeout, etc.)
        setNotification({
          type: 'error',
          title: 'Network error.',
          message: 'Unable to reach the server. Please check your connection and try again.',
        });
      } else if (status === 401) {
        setNotification({
          type: 'error',
          title: 'Invalid email or password.',
          message: 'Please check your credentials and try again.',
        });
      } else {
        // Parse structured error from backend for any other failure (detail can be object or string)
        let title = 'Something went wrong.';
        let message = 'Please try again.';

        const raw = err?.response?.data?.detail ?? err?.message;
        if (raw && typeof raw === 'object') {
          title = raw.title ?? title;
          message = raw.message ?? message;
        } else if (typeof raw === 'string') {
          message = raw;
        }

        setNotification({ type: 'error', title, message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md animate-fade-in-up">
      
          <div className="editorial-card p-8">
            <div className="mb-7 text-center">
              <h1 className="font-heading text-2xl font-bold text-primary mb-1.5">
                Welcome back
              </h1>
              <p className="text-sm text-secondary">
                Sign in to access your build workspace.
              </p>
            </div>

            {/* Notification Banner */}
            {notification && (
              <Alert
                type={notification.type}
                title={notification.title}
                message={notification.message}
                className="animate-fade-in-up mb-6"
                onDismiss={() => setNotification(null)}
              />
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email Address"
                type="email"
                id="login-email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                labelRightElement={
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-secondary hover:text-accent transition-colors duration-150 underline underline-offset-2"
                    tabIndex={-1}
                  >
                    Forgot password?
                  </Link>
                }
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="cursor-pointer text-secondary hover:text-primary transition-colors duration-150"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                }
              />

              <Button
                type="submit"
                variant="accent"
                className="w-full !py-2.5"
                isLoading={isSubmitting}
              >
                Sign In
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-borderPaper text-center">
              <p className="text-sm text-secondary">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-medium text-primary hover:text-accent underline underline-offset-4 transition-colors duration-150"
                >
                  Create one now
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};