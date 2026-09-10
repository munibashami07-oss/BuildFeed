import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Github, X, Eye, EyeOff } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register, completeSignupWithoutGithub } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupOptions, setSignupOptions] = useState<{ github_authorize_url: string; signup_token: string } | null>(null);
  const [isSkippingGithub, setIsSkippingGithub] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await register({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      setSignupOptions(response);
      setIsSubmitting(false);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Registration failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-md">
          <div className="editorial-card p-8 shadow-card">
            <div className="mb-6 text-center">
              <h1 className="font-heading text-3xl font-bold text-primary mb-2">Create an Account</h1>
              <p className="text-sm text-secondary">
                Join build. to start discovering and shipping projects. You'll connect your
                GitHub account next — every project you build gets its own repo automatically.
              </p>
            </div>

            {error && <Alert type="error" message={error} className="mb-6" />}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Username"
                type="text"
                placeholder="alex_builder"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                helperText="Only letters, numbers, underscores, and hyphens."
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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

              <Input
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="cursor-pointer text-secondary hover:text-primary transition-colors duration-150"
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                }
              />

              <Button
                type="submit"
                variant="accent"
                className="w-full mt-2"
                isLoading={isSubmitting}
              >
                Create Account
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-borderPaper text-center">
              <p className="text-sm text-secondary">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary hover:text-accent underline underline-offset-4">
                  Sign in instead
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>


      {signupOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5" role="dialog" aria-modal="true" aria-labelledby="signup-github-title">
          <div className="w-full max-w-md editorial-card p-7 shadow-card relative">
            <button type="button" onClick={() => setSignupOptions(null)} className="absolute top-4 right-4 p-1.5 rounded text-secondary hover:text-primary hover:bg-borderPaper/50" aria-label="Close">
              <X size={18} />
            </button>
            <div className="w-11 h-11 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-4">
              <Github size={22} />
            </div>
            <h2 id="signup-github-title" className="font-heading text-2xl font-bold text-primary mb-2">Connect GitHub?</h2>
            <p className="text-sm text-secondary leading-relaxed mb-6">
              Connect GitHub now to let BuildFeed create repositories for projects you build. You can also skip this and connect GitHub later when you choose <strong>Build This</strong>.
            </p>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="accent" className="w-full" onClick={() => window.location.assign(signupOptions.github_authorize_url)}>
                <Github size={16} className="mr-2" /> Connect GitHub &amp; Continue
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                isLoading={isSkippingGithub}
                disabled={isSkippingGithub}
                onClick={async () => {
                  setIsSkippingGithub(true);
                  setError(null);
                  try {
                    await completeSignupWithoutGithub(signupOptions.signup_token);
                    window.location.assign('/onboarding');
                  } catch (err: any) {
                    setError(err?.response?.data?.detail || err.message || 'Could not create your account without GitHub. Please try again.');
                    setIsSkippingGithub(false);
                  }
                }}
              >
                Continue without GitHub
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};
