import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { authApi } from '../services/api/authApi';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
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
            {submitted ? (
              /* Success state */
              <div className="animate-fade-in-up text-center">
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-accent/20 flex items-center justify-center mx-auto mb-5">
                  <Mail className="w-6 h-6 text-accent" />
                </div>
                <h1 className="font-heading text-2xl font-bold text-primary mb-2">
                  Check your email
                </h1>
                <p className="text-sm text-secondary leading-relaxed mb-1">
                  If an account exists for{' '}
                  <span className="font-medium text-primary">{email}</span>,
                  you'll receive a password reset link shortly.
                </p>
                <p className="text-xs text-secondary mt-3 mb-6">
                  Didn't receive it? Check your spam folder, or try again.
                </p>
                <button
                  type="button"
                  onClick={() => { setSubmitted(false); setEmail(''); }}
                  className="text-sm font-medium text-accent hover:text-accentHover underline underline-offset-4 transition-colors duration-150"
                >
                  Try a different email
                </button>
                <div className="mt-6 pt-6 border-t border-borderPaper">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors duration-150"
                  >
                    <ArrowLeft size={14} />
                    Back to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              /* Form state */
              <>
                <div className="mb-7">
                  <h1 className="font-heading text-2xl font-bold text-primary mb-1.5">
                    Reset your password
                  </h1>
                  <p className="text-sm text-secondary leading-relaxed">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                </div>

                {error && (
                  <div className="animate-fade-in-up mb-5 rounded-md border border-red-200 bg-red-50 p-3.5">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    label="Email Address"
                    type="email"
                    id="forgot-email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />

                  <Button
                    type="submit"
                    variant="accent"
                    className="w-full !py-2.5"
                    isLoading={isSubmitting}
                  >
                    Send Reset Link
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-borderPaper">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors duration-150"
                  >
                    <ArrowLeft size={14} />
                    Back to Sign In
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
