import React, { useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { useTheme } from '../features/theme/ThemeContext';
import { authApi } from '../services/api/authApi';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Save, User as UserIcon, Settings, Check, Sun, Moon } from 'lucide-react';

const INTEREST_OPTIONS = [
  'AI / Machine Learning',
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Robotics',
  'Cybersecurity',
  'Automation',
  'Game Development',
  'UI/UX',
  'Startups',
  'Other',
];

const EXPERIENCE_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];

const GOAL_OPTIONS = [
  'Learn',
  'Discover project ideas',
  'Build projects',
  'Discover new technology',
  'Improve my skills',
];

export const ProfilePage: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [username, setUsername] = useState<string>(user?.username || '');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests || []);
  const [selectedExperience, setSelectedExperience] = useState<string>(user?.experience_level || '');
  const [selectedGoals, setSelectedGoals] = useState<string[]>(user?.goals || []);
  const [themePref, setThemePref] = useState<'light' | 'dark'>(user?.theme_preference || theme);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setThemePref(newTheme);
    setTheme(newTheme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    if (!username.trim()) {
      setNotification({ type: 'error', message: 'Username cannot be empty.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedUser = await authApi.updateProfile({
        username: username.trim(),
        interests: selectedInterests,
        experience_level: selectedExperience || undefined,
        goals: selectedGoals,
        theme_preference: themePref,
      });

      updateUser(updatedUser);
      setNotification({
        type: 'success',
        message: 'Your profile preferences have been updated successfully!',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to update profile. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper text-primary transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto py-10 px-4 sm:px-6">
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <UserIcon size={20} />
            </div>
            <div>
              <h1 className="font-heading text-3xl font-bold text-primary">Your Profile</h1>
              <p className="text-secondary text-sm">
                Manage your builder identity, interests, and theme preferences.
              </p>
            </div>
          </div>
        </div>

        {notification && (
          <Alert
            type={notification.type}
            message={notification.message}
            className="mb-6 animate-fade-in-up"
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in-up">
          {/* Identity & Account Settings Card */}
          <div className="editorial-card p-6 sm:p-8">
            <h2 className="font-heading text-xl font-bold text-primary mb-6 flex items-center gap-2">
              <Settings size={20} className="text-accent" />
              Account Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">
                  Email Address (Read-only)
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="editorial-input w-full opacity-60 cursor-not-allowed bg-paper"
                />
              </div>

              <div>
                <Input
                  label="Username"
                  id="profile-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="builder_name"
                  required
                />
              </div>
            </div>
          </div>

          {/* Theme Preference Card */}
          <div className="editorial-card p-6 sm:p-8">
            <h2 className="font-heading text-xl font-bold text-primary mb-2">
              Theme Preference
            </h2>
            <p className="text-secondary text-sm mb-6">
              Choose your preferred appearance for BuildFeed.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`flex items-center justify-between p-4 rounded-md border text-left transition-all duration-150 cursor-pointer ${
                  themePref === 'light'
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'bg-surface border-borderPaper text-primary hover:border-cardHoverBorder'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sun size={20} className="text-amber-500" />
                  <div>
                    <div className="font-semibold text-sm">Light Mode</div>
                    <div className="text-xs text-secondary">Clean paper & dark text</div>
                  </div>
                </div>
                {themePref === 'light' && <Check size={18} className="text-accent" />}
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`flex items-center justify-between p-4 rounded-md border text-left transition-all duration-150 cursor-pointer ${
                  themePref === 'dark'
                    ? 'bg-accent/10 border-accent text-accent dark:bg-accent/20'
                    : 'bg-surface border-borderPaper text-primary hover:border-cardHoverBorder'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Moon size={20} className="text-indigo-400" />
                  <div>
                    <div className="font-semibold text-sm">Dark Mode</div>
                    <div className="text-xs text-secondary">Dark charcoal & light text</div>
                  </div>
                </div>
                {themePref === 'dark' && <Check size={18} className="text-accent" />}
              </button>
            </div>
          </div>

          {/* Experience Level Card */}
          <div className="editorial-card p-6 sm:p-8">
            <h2 className="font-heading text-xl font-bold text-primary mb-2">
              Experience Level
            </h2>
            <p className="text-secondary text-sm mb-6">
              Select your current skill level in software and tech building.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {EXPERIENCE_OPTIONS.map((exp) => {
                const isSelected = selectedExperience === exp;
                return (
                  <button
                    key={exp}
                    type="button"
                    onClick={() => setSelectedExperience(exp)}
                    className={`flex items-center justify-between p-3.5 rounded-md border text-sm font-medium transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-accent/10 border-accent text-accent dark:bg-accent/20'
                        : 'bg-surface border-borderPaper text-primary hover:border-cardHoverBorder'
                    }`}
                  >
                    <span>{exp}</span>
                    {isSelected && <Check size={16} className="text-accent" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interests Card */}
          <div className="editorial-card p-6 sm:p-8">
            <h2 className="font-heading text-xl font-bold text-primary mb-2">
              Building Interests
            </h2>
            <p className="text-secondary text-sm mb-6">
              Choose topics you enjoy working on or learning about.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {INTEREST_OPTIONS.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`flex items-center justify-between p-3 rounded-md border text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-accent/10 border-accent text-accent dark:bg-accent/20'
                        : 'bg-surface border-borderPaper text-primary hover:border-cardHoverBorder'
                    }`}
                  >
                    <span className="truncate mr-1">{interest}</span>
                    {isSelected && <Check size={14} className="text-accent flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goals Card */}
          <div className="editorial-card p-6 sm:p-8">
            <h2 className="font-heading text-xl font-bold text-primary mb-2">
              BuildFeed Goals
            </h2>
            <p className="text-secondary text-sm mb-6">
              Select what you want to achieve using BuildFeed.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GOAL_OPTIONS.map((goal) => {
                const isSelected = selectedGoals.includes(goal);
                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggleGoal(goal)}
                    className={`flex items-center justify-between p-3.5 rounded-md border text-sm font-medium transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-accent/10 border-accent text-accent dark:bg-accent/20'
                        : 'bg-surface border-borderPaper text-primary hover:border-cardHoverBorder'
                    }`}
                  >
                    <span>{goal}</span>
                    {isSelected && <Check size={16} className="text-accent flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save Button Bar */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              variant="accent"
              className="px-8 !py-3 font-semibold text-base"
              isLoading={isSubmitting}
            >
              <Save size={18} className="mr-2" />
              Save Profile Changes
            </Button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
};