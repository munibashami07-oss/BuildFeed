import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { authApi } from '../services/api/authApi';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type PageState = 'verifying' | 'valid' | 'invalid' | 'success';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [pageState, setPageState] = useState<PageState>('verifying');
  const [tokenEmail, setTokenEmail] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      return;
    }

    authApi.verifyResetToken(token)
      .then((res) => {
        if (res.valid) {
          setTokenEmail(res.email ?? '');
          setPageState('valid');
        } else {
          setPageState('invalid');
        }
      })
      .catch(() => setPageState('invalid'));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    if (!newPassword || !confirmPassword) {
      setFieldError('Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 6) {
      setFieldError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError('Passwords do not match. Please check and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setPageState('success');
    } catch (err: any) {
      setFieldError(err.message || 'Reset failed. The link may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="text-center mb-6">
            <span className="font-heading text-4xl font-bold tracking-tight text-primary">
              build<span className="text-accent">.</span>
            </span>
          </div>

          <div className="editorial-card p-8">
            {/* Verifying state */}
            {pageState === 'verifying' && (
              <div className="text-center py-8 animate-fade-in">
                <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-4" />
                <p className="text-sm text-secondary">Verifying your reset link…</p>
              </div>
            )}

            {/* Invalid token */}
            {pageState === 'invalid' && (
              <div className="text-center animate-fade-in-up">
                <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-5">
                  <XCircle className="w-6 h-6 text-red-500" />
                </div>
                <h1 className="font-heading text-2xl font-bold text-primary mb-2">
                  Link is invalid or expired
                </h1>
                <p className="text-sm text-secondary leading-relaxed mb-6">
                  This password reset link is no longer valid. Reset links expire after 30 minutes.
                </p>
                <Link to="/forgot-password">
                  <Button variant="accent" className="w-full !py-2.5 mb-3">
                    Request a New Link
                  </Button>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors duration-150"
                >
                  <ArrowLeft size={14} />
                  Back to Sign In
                </Link>
              </div>
            )}

            {/* Reset form */}
            {pageState === 'valid' && (
              <>
                <div className="mb-7">
                  <h1 className="font-heading text-2xl font-bold text-primary mb-1.5">
                    Set a new password
                  </h1>
                  {tokenEmail && (
                    <p className="text-sm text-secondary">
                      Resetting password for{' '}
                      <span className="font-medium text-primary">{tokenEmail}</span>
                    </p>
                  )}
                </div>

                {fieldError && (
                  <div className="animate-fade-in-up mb-5 rounded-md border border-red-200 bg-red-50 p-3.5">
                    <p className="text-sm text-red-700">{fieldError}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    label="New Password"
                    type={showNew ? 'text' : 'password'}
                    id="reset-new-password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowNew((v) => !v)}
                        aria-label={showNew ? 'Hide password' : 'Show password'}
                        className="cursor-pointer transition-colors duration-150"
                      >
                        {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    }
                  />

                  <Input
                    label="Confirm New Password"
                    type={showConfirm ? 'text' : 'password'}
                    id="reset-confirm-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                        className="cursor-pointer transition-colors duration-150"
                      >
                        {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    }
                  />

                  <Button
                    type="submit"
                    variant="accent"
                    className="w-full !py-2.5"
                    isLoading={isSubmitting}
                  >
                    Reset Password
                  </Button>
                </form>
              </>
            )}

            {/* Success state */}
            {pageState === 'success' && (
              <div className="text-center animate-fade-in-up">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <h1 className="font-heading text-2xl font-bold text-primary mb-2">
                  Password reset
                </h1>
                <p className="text-sm text-secondary leading-relaxed mb-6">
                  Password reset successfully. You can now sign in with your new password.
                </p>
                <Link to="/login">
                  <Button variant="accent" className="w-full !py-2.5">
                    Go to Sign In
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
