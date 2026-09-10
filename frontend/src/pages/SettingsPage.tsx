import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Input } from '../components/ui/Input';
import { settingsApi } from '../services/api/settingsApi';
import { useAuth } from '../features/auth/AuthContext';
import { useTheme } from '../features/theme/ThemeContext';
import { SettingsData } from '../types/settings';
import {
  Bell,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  LogOut,
  Moon,
  Save,
  Settings,
  Shield,
  Sliders,
  Sun,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const INTEREST_OPTIONS = [
  'AI / Machine Learning', 'Web Development', 'Mobile Development',
  'Data Science', 'Robotics', 'Cybersecurity', 'Automation',
  'Game Development', 'UI/UX', 'Startups', 'Other',
];
const EXPERIENCE_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];
const GOAL_OPTIONS = [
  'Learn', 'Discover project ideas', 'Build projects',
  'Discover new technology', 'Improve my skills',
];
const CONTENT_TYPE_OPTIONS = [
  { id: 'article',        label: 'Articles' },
  { id: 'github_repo',    label: 'GitHub Repos' },
  { id: 'research_paper', label: 'Research Papers' },
  { id: 'video',          label: 'Videos' },
];
const FEED_LIMIT_OPTIONS = [5, 10, 15, 20, 30, 50];

type Section = 'profile' | 'appearance' | 'feed' | 'notifications' | 'privacy' | 'account';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',       label: 'Profile',        icon: <UserIcon size={16} /> },
  { id: 'appearance',    label: 'Appearance',     icon: <Sun size={16} /> },
  { id: 'feed',          label: 'Feed',           icon: <Sliders size={16} /> },
  { id: 'notifications', label: 'Notifications',  icon: <Bell size={16} /> },
  { id: 'privacy',       label: 'Privacy',        icon: <Shield size={16} /> },
  { id: 'account',       label: 'Account',        icon: <Settings size={16} /> },
];

// ── Toggle switch component ───────────────────────────────────────────────────
const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="flex-1">
      <p className="text-sm font-medium text-primary">{label}</p>
      {description && <p className="text-xs text-secondary mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative flex-shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 ${
        checked ? 'bg-accent' : 'bg-borderPaper'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-4.5' : 'translate-x-0'
        }`}
        style={{ width: '18px', height: '18px', top: '2px', left: '2px',
                 transform: checked ? 'translateX(18px)' : 'translateX(0)' }}
      />
    </button>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
export const SettingsPage: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user, updateUser, logout } = useAuth();
  const { setTheme } = useTheme();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState<Section>('profile');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Local form state (mirrors settings, editable)
  const [username, setUsername]       = useState('');
  const [bio, setBio]                 = useState('');
  const [avatarUrl, setAvatarUrl]     = useState('');
  const [theme, setThemePref]         = useState<'light' | 'dark'>('light');
  const [interests, setInterests]     = useState<string[]>([]);
  const [experience, setExperience]   = useState('');
  const [goals, setGoals]             = useState<string[]>([]);
  const [feedLimit, setFeedLimit]     = useState(10);
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [notifEnabled, setNotifEnabled]       = useState(true);
  const [notifAchievements, setNotifAchievements] = useState(true);
  const [notifProjects, setNotifProjects]         = useState(true);
  const [notifContent, setNotifContent]           = useState(true);
  const [portfolioPublic, setPortfolioPublic]     = useState(true);

  // Password change
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd]         = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdMsg, setPwdMsg]         = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPwdSaving, setIsPwdSaving] = useState(false);

  // Account deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePwd, setDeletePwd]             = useState('');
  const [showDeletePwd, setShowDeletePwd]     = useState(false);
  const [deleteMsg, setDeleteMsg]             = useState<string | null>(null);
  const [isDeleting, setIsDeleting]           = useState(false);

  // Load settings on mount
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await settingsApi.getSettings();
      setSettings(data);
      setUsername(data.username);
      setBio(data.bio || '');
      setAvatarUrl(data.avatar_url || '');
      setThemePref(data.theme_preference);
      setInterests(data.interests);
      setExperience(data.experience_level || '');
      setGoals(data.goals);
      setFeedLimit(data.feed_content_limit);
      setContentTypes(data.preferred_content_types);
      setNotifEnabled(data.notif_enabled);
      setNotifAchievements(data.notif_achievements);
      setNotifProjects(data.notif_projects);
      setNotifContent(data.notif_content);
      setPortfolioPublic(data.portfolio_public);
    } catch {
      setSaveMsg({ type: 'error', text: 'Failed to load settings.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const updated = await settingsApi.updateSettings({
        username: username.trim(),
        bio: bio.trim() || '',
        avatar_url: avatarUrl.trim() || '',
        theme_preference: theme,
        interests,
        experience_level: experience || undefined,
        goals,
        feed_content_limit: feedLimit,
        preferred_content_types: contentTypes,
        notif_enabled: notifEnabled,
        notif_achievements: notifAchievements,
        notif_projects: notifProjects,
        notif_content: notifContent,
        portfolio_public: portfolioPublic,
      });
      setSettings(updated);
      // Apply theme immediately
      setTheme(updated.theme_preference);
      // Sync user context with new username/theme
      if (user) {
        updateUser({
          ...user,
          username: updated.username,
          theme_preference: updated.theme_preference,
          interests: updated.interests,
          experience_level: updated.experience_level,
          goals: updated.goals,
          bio: updated.bio,
          avatar_url: updated.avatar_url,
          feed_content_limit: updated.feed_content_limit,
          preferred_content_types: updated.preferred_content_types,
          notif_enabled: updated.notif_enabled,
          notif_achievements: updated.notif_achievements,
          notif_projects: updated.notif_projects,
          notif_content: updated.notif_content,
          portfolio_public: updated.portfolio_public,
        });
      }
      setSaveMsg({ type: 'success', text: 'Settings saved successfully.' });
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err?.message || 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    setIsPwdSaving(true);
    setPwdMsg(null);
    try {
      await settingsApi.changePassword(currentPwd, newPwd);
      setPwdMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: err?.message || 'Failed to change password.' });
    } finally {
      setIsPwdSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePwd) { setDeleteMsg('Please enter your password.'); return; }
    setIsDeleting(true);
    setDeleteMsg(null);
    try {
      await settingsApi.deleteAccount(deletePwd);
      await logout();
      navigate('/');
    } catch (err: any) {
      setDeleteMsg(err?.message || 'Failed to delete account.');
      setIsDeleting(false);
    }
  };

  const toggle = (arr: string[], val: string, set: (v: string[]) => void) =>
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-paper text-primary">
        <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-accent" />
          </main>
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-paper text-primary">
      <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
      <Navbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-primary flex items-center gap-2">
            <Settings size={24} className="text-accent" /> Settings
          </h1>
          <p className="text-secondary text-sm mt-1">Manage your BuildFeed profile and preferences.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar nav */}
          <aside className="lg:w-52 flex-shrink-0">
            <nav className="editorial-card p-2 lg:sticky lg:top-24">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium text-left transition-all duration-150 ${
                    activeSection === s.id
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-secondary hover:text-primary hover:bg-surface'
                  }`}
                >
                  <span className={activeSection === s.id ? 'text-accent' : 'text-secondary'}>
                    {s.icon}
                  </span>
                  {s.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content area */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Global save feedback */}
            {saveMsg && (
              <Alert
                type={saveMsg.type}
                message={saveMsg.text}
                onDismiss={() => setSaveMsg(null)}
                className="animate-fade-in"
              />
            )}

            {/* ── PROFILE ─────────────────────────────────────────────── */}
            {activeSection === 'profile' && (
              <div className="editorial-card p-6 sm:p-8 animate-fade-in-up">
                <h2 className="font-heading text-xl font-bold text-primary mb-6 flex items-center gap-2">
                  <UserIcon size={18} className="text-accent" /> Profile
                </h2>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-primary mb-1">Email (read-only)</label>
                      <input value={settings?.email || ''} disabled
                        className="w-full px-3 py-2 rounded-md bg-paper border border-borderPaper text-sm text-secondary opacity-60 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-primary mb-1">Username</label>
                      <input value={username} onChange={(e) => setUsername(e.target.value)}
                        placeholder="your_username" maxLength={50}
                        className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-primary mb-1">Bio</label>
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                      rows={3} maxLength={500} placeholder="Tell other builders a bit about yourself…"
                      className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent resize-none" />
                    <p className="text-[10px] text-secondary text-right mt-0.5">{bio.length}/500</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-primary mb-1">Avatar URL</label>
                    <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://example.com/avatar.png" type="url"
                      className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent" />
                    {avatarUrl && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={avatarUrl} alt="avatar preview"
                          className="w-10 h-10 rounded-full object-cover border border-borderPaper"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        <span className="text-xs text-secondary">Preview</span>
                      </div>
                    )}
                  </div>
                  <SaveButton onClick={handleSave} isLoading={isSaving} />
                </div>
              </div>
            )}

            {/* ── APPEARANCE ──────────────────────────────────────────── */}
            {activeSection === 'appearance' && (
              <div className="editorial-card p-6 sm:p-8 animate-fade-in-up">
                <h2 className="font-heading text-xl font-bold text-primary mb-6 flex items-center gap-2">
                  <Sun size={18} className="text-accent" /> Appearance
                </h2>
                <p className="text-secondary text-sm mb-5">Choose your preferred visual theme.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {(['light', 'dark'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => { setThemePref(t); setTheme(t); }}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-150 ${
                        theme === t ? 'bg-accent/10 border-accent text-accent' : 'bg-surface border-borderPaper text-primary hover:border-accent/30'
                      }`}>
                      <div className="flex items-center gap-3">
                        {t === 'light' ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-indigo-400" />}
                        <div>
                          <p className="text-sm font-semibold">{t === 'light' ? 'Light Mode' : 'Dark Mode'}</p>
                          <p className="text-xs text-secondary">{t === 'light' ? 'Clean paper & dark text' : 'Dark charcoal & light text'}</p>
                        </div>
                      </div>
                      {theme === t && <Check size={16} className="text-accent" />}
                    </button>
                  ))}
                </div>
                <SaveButton onClick={handleSave} isLoading={isSaving} />
              </div>
            )}

            {/* ── FEED PREFERENCES ────────────────────────────────────── */}
            {activeSection === 'feed' && (
              <div className="editorial-card p-6 sm:p-8 animate-fade-in-up space-y-8">
                <h2 className="font-heading text-xl font-bold text-primary flex items-center gap-2">
                  <Sliders size={18} className="text-accent" /> Feed Preferences
                </h2>

                {/* Interests */}
                <div>
                  <p className="text-sm font-semibold text-primary mb-1">Interests</p>
                  <p className="text-xs text-secondary mb-3">Topics that shape your personalised feed.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {INTEREST_OPTIONS.map((opt) => (
                      <button key={opt} type="button"
                        onClick={() => toggle(interests, opt, setInterests)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs font-medium transition-all duration-150 ${
                          interests.includes(opt) ? 'bg-accent/10 border-accent text-accent' : 'bg-surface border-borderPaper text-primary hover:border-accent/30'
                        }`}>
                        <span className="truncate mr-1">{opt}</span>
                        {interests.includes(opt) && <Check size={12} className="flex-shrink-0 text-accent" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Skill level */}
                <div>
                  <p className="text-sm font-semibold text-primary mb-1">Skill Level</p>
                  <div className="flex gap-2 flex-wrap">
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <button key={opt} type="button" onClick={() => setExperience(opt)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                          experience === opt ? 'bg-accent text-white border-accent' : 'bg-surface border-borderPaper text-secondary hover:border-accent/40'
                        }`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goals */}
                <div>
                  <p className="text-sm font-semibold text-primary mb-1">Goals</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {GOAL_OPTIONS.map((opt) => (
                      <button key={opt} type="button"
                        onClick={() => toggle(goals, opt, setGoals)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs font-medium transition-all duration-150 ${
                          goals.includes(opt) ? 'bg-accent/10 border-accent text-accent' : 'bg-surface border-borderPaper text-primary hover:border-accent/30'
                        }`}>
                        {opt}
                        {goals.includes(opt) && <Check size={12} className="text-accent" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preferred content types */}
                <div>
                  <p className="text-sm font-semibold text-primary mb-1">Preferred Content Types</p>
                  <p className="text-xs text-secondary mb-3">Leave empty to see all types.</p>
                  <div className="flex flex-wrap gap-2">
                    {CONTENT_TYPE_OPTIONS.map((opt) => (
                      <button key={opt.id} type="button"
                        onClick={() => toggle(contentTypes, opt.id, setContentTypes)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
                          contentTypes.includes(opt.id) ? 'bg-accent text-white border-accent' : 'bg-surface border-borderPaper text-secondary hover:border-accent/40'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Daily feed limit */}
                <div>
                  <p className="text-sm font-semibold text-primary mb-1">Daily Feed Limit</p>
                  <p className="text-xs text-secondary mb-3">
                    How many articles you can read before the Focus Gate activates. Default: 10.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FEED_LIMIT_OPTIONS.map((n) => (
                      <button key={n} type="button" onClick={() => setFeedLimit(n)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                          feedLimit === n ? 'bg-accent text-white border-accent' : 'bg-surface border-borderPaper text-secondary hover:border-accent/40'
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <SaveButton onClick={handleSave} isLoading={isSaving} />
              </div>
            )}

            {/* ── NOTIFICATIONS ────────────────────────────────────────── */}
            {activeSection === 'notifications' && (
              <div className="editorial-card p-6 sm:p-8 animate-fade-in-up">
                <h2 className="font-heading text-xl font-bold text-primary mb-2 flex items-center gap-2">
                  <Bell size={18} className="text-accent" /> Notifications
                </h2>
                <p className="text-secondary text-sm mb-6">
                  Control which events send you in-app notifications.
                </p>
                <div className="divide-y divide-borderPaper">
                  <Toggle checked={notifEnabled} onChange={setNotifEnabled}
                    label="Enable notifications"
                    description="Master switch — disabling this silences all notifications." />
                  <Toggle checked={notifAchievements} onChange={setNotifAchievements}
                    label="Achievement unlocks"
                    description="Notify when you earn a new achievement."
                    disabled={!notifEnabled} />
                  <Toggle checked={notifProjects} onChange={setNotifProjects}
                    label="Project reminders &amp; completions"
                    description="Notify when a project is completed or a reminder fires."
                    disabled={!notifEnabled} />
                  <Toggle checked={notifContent} onChange={setNotifContent}
                    label="New personalised content"
                    description="Notify when fresh content matches your interests."
                    disabled={!notifEnabled} />
                </div>
                <div className="mt-6">
                  <SaveButton onClick={handleSave} isLoading={isSaving} />
                </div>
              </div>
            )}

            {/* ── PRIVACY ──────────────────────────────────────────────── */}
            {activeSection === 'privacy' && (
              <div className="editorial-card p-6 sm:p-8 animate-fade-in-up">
                <h2 className="font-heading text-xl font-bold text-primary mb-2 flex items-center gap-2">
                  <Shield size={18} className="text-accent" /> Privacy
                </h2>
                <p className="text-secondary text-sm mb-6">
                  Control what others can see about your work.
                </p>
                <div className="divide-y divide-borderPaper">
                  <Toggle
                    checked={portfolioPublic}
                    onChange={setPortfolioPublic}
                    label="Public portfolio"
                    description="Allow completed projects to be published and shared publicly via share links."
                  />
                </div>
                {!portfolioPublic && (
                  <p className="mt-3 text-xs text-secondary bg-surface border border-borderPaper rounded-md px-3 py-2">
                    Your portfolio is private. Existing share links will continue to work for already-published projects.
                    To fully hide a project, use Unpublish on the project's Portfolio page.
                  </p>
                )}
                <div className="mt-6">
                  <SaveButton onClick={handleSave} isLoading={isSaving} />
                </div>
              </div>
            )}

            {/* ── ACCOUNT ──────────────────────────────────────────────── */}
            {activeSection === 'account' && (
              <div className="space-y-6 animate-fade-in-up">
                {/* Change password */}
                <div className="editorial-card p-6 sm:p-8">
                  <h2 className="font-heading text-lg font-bold text-primary mb-5 flex items-center gap-2">
                    <Lock size={16} className="text-accent" /> Change Password
                  </h2>
                  {pwdMsg && (
                    <Alert type={pwdMsg.type} message={pwdMsg.text}
                      onDismiss={() => setPwdMsg(null)} className="mb-4" />
                  )}
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                      <Input
                        label="Current Password"
                        type={showCurrentPwd ? 'text' : 'password'}
                        value={currentPwd}
                        onChange={(e) => setCurrentPwd(e.target.value)}
                        required
                        placeholder="••••••••"
                        rightElement={
                          <button
                            type="button"
                            onClick={() => setShowCurrentPwd((v) => !v)}
                            aria-label={showCurrentPwd ? 'Hide password' : 'Show password'}
                            className="cursor-pointer text-secondary hover:text-primary transition-colors duration-150"
                          >
                            {showCurrentPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        }
                      />
                    </div>
                    <div>
                      <Input
                        label="New Password"
                        type={showNewPwd ? 'text' : 'password'}
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                        required
                        minLength={6}
                        placeholder="At least 6 characters"
                        rightElement={
                          <button
                            type="button"
                            onClick={() => setShowNewPwd((v) => !v)}
                            aria-label={showNewPwd ? 'Hide password' : 'Show password'}
                            className="cursor-pointer text-secondary hover:text-primary transition-colors duration-150"
                          >
                            {showNewPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        }
                      />
                    </div>
                    <div>
                      <Input
                        label="Confirm New Password"
                        type={showConfirmPwd ? 'text' : 'password'}
                        value={confirmPwd}
                        onChange={(e) => setConfirmPwd(e.target.value)}
                        required
                        placeholder="Repeat new password"
                        rightElement={
                          <button
                            type="button"
                            onClick={() => setShowConfirmPwd((v) => !v)}
                            aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}
                            className="cursor-pointer text-secondary hover:text-primary transition-colors duration-150"
                          >
                            {showConfirmPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        }
                      />
                    </div>
                    <Button type="submit" variant="primary" size="sm" isLoading={isPwdSaving}>
                      <Lock size={14} className="mr-1.5" /> Update Password
                    </Button>
                  </form>
                </div>

                {/* Logout */}
                <div className="editorial-card p-6 sm:p-8">
                  <h2 className="font-heading text-lg font-bold text-primary mb-2 flex items-center gap-2">
                    <LogOut size={16} className="text-secondary" /> Sign Out
                  </h2>
                  <p className="text-secondary text-sm mb-4">Sign out of BuildFeed on this device.</p>
                  <Button variant="secondary" size="sm" onClick={async () => { await logout(); navigate('/'); }}>
                    <LogOut size={14} className="mr-1.5" /> Log Out
                  </Button>
                </div>

                {/* Delete account */}
                <div className="editorial-card p-6 sm:p-8 border-red-200 dark:border-red-900">
                  <h2 className="font-heading text-lg font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                    <Trash2 size={16} /> Delete Account
                  </h2>
                  <p className="text-secondary text-sm mb-4">
                    Permanently delete your account and all associated data. This cannot be undone.
                  </p>
                  <Button variant="secondary" size="sm"
                    className="!text-red-600 !border-red-200 hover:!bg-red-50 dark:hover:!bg-red-950/40"
                    onClick={() => setShowDeleteModal(true)}>
                    <Trash2 size={14} className="mr-1.5" /> Delete My Account
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete account confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="editorial-card p-6 sm:p-8 max-w-md w-full bg-paper shadow-2xl relative">
            <button onClick={() => { setShowDeleteModal(false); setDeletePwd(''); setDeleteMsg(null); }}
              className="absolute top-4 right-4 p-1 text-secondary hover:text-primary">
              <X size={18} />
            </button>
            <h2 className="font-heading text-xl font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-2">
              <Trash2 size={18} /> Delete Account
            </h2>
            <p className="text-secondary text-sm mb-4">
              All your projects, XP, achievements, saved content, and notifications will be permanently deleted. Enter your password to confirm.
            </p>
            {deleteMsg && <p className="text-sm text-red-500 mb-3">{deleteMsg}</p>}
            <div className="relative flex items-center w-full mb-4">
              <input
                type={showDeletePwd ? 'text' : 'password'}
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                placeholder="Your current password"
                className="w-full px-3 py-2 pr-10 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-red-500"
              />
              <button
                type="button"
                onClick={() => setShowDeletePwd((v) => !v)}
                aria-label={showDeletePwd ? 'Hide password' : 'Show password'}
                className="absolute right-3 cursor-pointer text-secondary hover:text-primary transition-colors duration-150"
              >
                {showDeletePwd ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" size="sm" onClick={() => { setShowDeleteModal(false); setDeletePwd(''); setDeleteMsg(null); }}>
                Cancel
              </Button>
              <Button variant="secondary" size="sm" isLoading={isDeleting}
                className="!text-red-600 !border-red-300 hover:!bg-red-50"
                onClick={handleDeleteAccount}>
                <Trash2 size={14} className="mr-1.5" /> Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      </div>
    </div>
  );
};

// ── Reusable save button ──────────────────────────────────────────────────────
const SaveButton: React.FC<{ onClick: () => void; isLoading: boolean }> = ({ onClick, isLoading }) => (
  <div className="flex justify-end pt-4 border-t border-borderPaper">
    <Button variant="accent" size="sm" onClick={onClick} isLoading={isLoading} className="px-6">
      <Save size={14} className="mr-1.5" /> Save Changes
    </Button>
  </div>
);
