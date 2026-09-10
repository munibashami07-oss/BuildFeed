import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, Video, FileText, Github, Youtube,
  Bookmark, Rocket, Gift, Briefcase,
  Layers, User as UserIcon, X, Settings,
  Shield, Code, Brain, Database, Cpu,
  Gamepad2, Wand2, TrendingUp, FlaskConical,
  BarChart3, Smartphone, Zap, GraduationCap,
  Target, ChevronRight,
} from 'lucide-react';
import { useAuth }        from '../../features/auth/AuthContext';
import { progressionApi } from '../../services/api/progressionApi';
import { ProgressionData } from '../../types/progression';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  selectedContentType?: string;
  onSelectContentType?: (type: string) => void;
}

const DISCOVERY_NAV = [
  { id: '',            label: 'For You',  icon: <Sparkles size={16} /> },
  { id: 'article',     label: 'Articles', icon: <FileText size={16} /> },
  { id: 'github_repo', label: 'GitHub',   icon: <Github   size={16} /> },
  { id: 'youtube',     label: 'YouTube',  icon: <Youtube  size={16} /> },
  { id: 'video',       label: 'Videos',   icon: <Video    size={16} /> },
];

const PERSONAL_NAV = [
  { to: '/saved',     label: 'Saved',     icon: <Bookmark  size={16} /> },
  { to: '/projects',  label: 'Projects',  icon: <Rocket    size={16} /> },
  { to: '/portfolio', label: 'Portfolio', icon: <Briefcase size={16} /> },
  { to: '/rewards',   label: 'Progress',  icon: <TrendingUp size={16} /> },
];

// Map interest name → icon
const INTEREST_ICONS: Record<string, React.ReactNode> = {
  'cybersecurity':         <Shield   size={11} />,
  'web development':       <Code     size={11} />,
  'ai / machine learning': <Brain    size={11} />,
  'ai/ml':                 <Brain    size={11} />,
  'data science':          <BarChart3 size={11} />,
  'mobile development':    <Smartphone size={11} />,
  'automation':            <Zap      size={11} />,
  'robotics':              <Cpu      size={11} />,
  'game development':      <Gamepad2 size={11} />,
  'ui/ux':                 <Wand2    size={11} />,
  'startups':              <TrendingUp size={11} />,
  'research':              <FlaskConical size={11} />,
  'app development':       <Smartphone size={11} />,
};

function getInterestIcon(interest: string): React.ReactNode {
  return INTEREST_ICONS[interest.toLowerCase()] ?? <Target size={11} />;
}

// Level badge styles
const LEVEL_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  beginner: {
    bg:   'bg-emerald-500/10 border border-emerald-500/25',
    text: 'text-emerald-400',
    dot:  'bg-emerald-400',
  },
  intermediate: {
    bg:   'bg-amber-500/10 border border-amber-500/25',
    text: 'text-amber-400',
    dot:  'bg-amber-400',
  },
  advanced: {
    bg:   'bg-purple-500/10 border border-purple-500/25',
    text: 'text-purple-400',
    dot:  'bg-purple-400',
  },
};

const ALL_LEVELS = ['beginner', 'intermediate', 'advanced'];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onClose,
  selectedContentType,
  onSelectContentType,
}) => {
  const { user }     = useAuth();
  const location     = useLocation();
  const navigate     = useNavigate();
  const [progression, setProgression] = useState<ProgressionData | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      try { setProgression(await progressionApi.getProgression()); }
      catch { /* silent */ }
    };
    fetch();
    window.addEventListener('buildfeed:progression-updated', fetch);
    return () => window.removeEventListener('buildfeed:progression-updated', fetch);
  }, [user, location.pathname]);

  const handleContentTypeClick = (typeId: string) => {
    if (location.pathname !== '/dashboard') navigate('/dashboard');
    onSelectContentType?.(typeId);
    onClose?.();
  };

  const isDiscoveryActive = (id: string) =>
    location.pathname === '/dashboard' &&
    (id === '' ? (!selectedContentType || selectedContentType === '') : selectedContentType === id);

  const isPersonalActive = (to: string) =>
    to === '/projects'
      ? location.pathname.startsWith('/projects')
      : to === '/portfolio'
      ? location.pathname.startsWith('/portfolio')
      : location.pathname === to;

  const userLevel = (user?.experience_level || 'beginner').toLowerCase();
  const lvStyle = LEVEL_STYLES[userLevel] ?? LEVEL_STYLES['beginner'];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 bottom-0 z-50
          w-[252px] bg-surface border-r border-borderPaper
          flex flex-col
          transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0 lg:z-auto lg:h-screen lg:sticky lg:top-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* ── Scrollable body ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-5">

          {/* Logo */}
          <div className="flex items-center justify-between px-1 pb-1">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-purple">
                <Layers size={17} className="text-white" />
              </div>
              <div>
                <span className="font-heading text-sm font-bold text-primary block leading-tight">BuildFeed</span>
                <span className="text-[9px] text-muted leading-none tracking-wide">Scroll → Build</span>
              </div>
            </Link>
            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden p-1.5 rounded-lg text-muted hover:text-primary hover:bg-raised"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* ── Discover nav ─────────────────────────────────────────── */}
          <div>
            <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">Discover</p>
            <div className="space-y-px">
              {DISCOVERY_NAV.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleContentTypeClick(item.id)}
                  className={`nav-item w-full ${isDiscoveryActive(item.id) ? 'active' : ''}`}
                >
                  <span className="flex-shrink-0 opacity-80">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.id === '' && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent dark:text-brand-300">
                      NEW
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Personal nav ─────────────────────────────────────────── */}
          <div>
            <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">Personal</p>
            <div className="space-y-px">
              {PERSONAL_NAV.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={`nav-item ${isPersonalActive(item.to) ? 'active' : ''}`}
                >
                  <span className="flex-shrink-0 opacity-80">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Your Interests ───────────────────────────────────────── */}
          {user?.interests && user.interests.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Your Interests</p>
                <Link
                  to="/settings"
                  className="text-[10px] font-semibold text-accent hover:text-accentHover transition-colors"
                >
                  Edit
                </Link>
              </div>
              <div className="px-1 flex flex-wrap gap-1.5">
                {user.interests.slice(0, 6).map(interest => (
                  <button
                    key={interest}
                    onClick={() => handleContentTypeClick('')}
                    className="interest-chip"
                  >
                    <span className="opacity-70">{getInterestIcon(interest)}</span>
                    <span className="truncate max-w-[100px]">{interest}</span>
                  </button>
                ))}
                {user.interests.length > 6 && (
                  <span className="interest-chip opacity-60 cursor-default">
                    +{user.interests.length - 6}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Your Level ───────────────────────────────────────────── */}
          <div className="px-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Your Level</p>
              <Link
                to="/settings"
                className="text-[10px] font-semibold text-accent hover:text-accentHover transition-colors"
              >
                Change
              </Link>
            </div>
            {/* Level radio pills */}
            <div className="flex gap-1.5">
              {ALL_LEVELS.map(level => {
                const active = userLevel === level;
                const s = LEVEL_STYLES[level];
                return (
                  <span
                    key={level}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold
                      transition-all duration-150 capitalize
                      ${active
                        ? `${s.bg} ${s.text} shadow-sm`
                        : 'bg-raised border border-borderPaper text-muted opacity-50'
                      }
                    `}
                  >
                    {active && (
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                    )}
                    {level}
                  </span>
                );
              })}
            </div>
          </div>

          {/* ── Progress / motivational card ─────────────────────────── */}
          <div className="mx-1 rounded-xl bg-gradient-to-br from-accent/20 via-accent/10 to-transparent border border-accent/20 p-4">
            {/* Robot/builder icon placeholder */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
                <Rocket size={18} className="text-accent" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary leading-tight">Small steps.</p>
                <p className="text-xs font-bold text-primary leading-tight">Big progress.</p>
              </div>
            </div>

            <p className="text-[10px] text-secondary mb-2.5 leading-relaxed">
              Keep exploring, keep building!
            </p>

            {/* Content viewed progress */}
            {progression && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted">Level {progression.level} · {progression.level_title}</span>
                  <span className="text-accent font-semibold">{progression.total_xp.toLocaleString()} XP</span>
                </div>
                <div className="w-full h-1.5 bg-accent/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, progression.level_progress_percent || 0)}%` }}
                  />
                </div>
              </div>
            )}

            <Link
              to="/projects"
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg bg-accent text-white text-[11px] font-semibold hover:bg-accentHover transition-colors shadow-purple"
            >
              Continue Building
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>

        {/* ── Bottom user card ─────────────────────────────────────── */}
        {user && (
          <div className="border-t border-borderPaper p-3">
            <Link
              to="/profile"
              onClick={onClose}
              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-raised transition-colors group"
            >
              <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 text-accent font-bold flex items-center justify-center flex-shrink-0 text-[11px] overflow-hidden">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
                  : user.username?.substring(0, 2).toUpperCase() || <UserIcon size={14} />
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-primary truncate group-hover:text-accent transition-colors">{user.username}</div>
                <div className="text-[9px] text-muted truncate">@{user.username}</div>
              </div>
              <Link
                to="/settings"
                onClick={e => e.stopPropagation()}
                className="p-1 text-muted hover:text-primary rounded-lg"
              >
                <Settings size={13} />
              </Link>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
};
