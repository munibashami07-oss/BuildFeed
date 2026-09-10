import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Rocket, Zap, Trophy, Github, Youtube, FileText,
  Hammer, Flame, Link as LinkIcon, FolderPlus,
  Bookmark, GraduationCap, ArrowRight, TrendingUp,
  Quote,
} from 'lucide-react';
import { projectApi, ProjectItem } from '../../services/api/projectApi';
import { progressionApi }          from '../../services/api/progressionApi';
import { likeApi, TrendingItem }   from '../../services/api/likeApi';
import { focusApi, FocusGateStatusResponse } from '../../services/api/focusApi';
import { ProgressionData }         from '../../types/progression';
import { useAuth }                 from '../../features/auth/AuthContext';

// ── Level badge colour ────────────────────────────────────────────────────
const LEVEL_BADGE: Record<string, { bg: string; text: string }> = {
  beginner:     { bg: 'bg-emerald-500/15 border border-emerald-500/30', text: 'text-emerald-400' },
  intermediate: { bg: 'bg-amber-500/15 border border-amber-500/30',    text: 'text-amber-400'   },
  advanced:     { bg: 'bg-purple-500/15 border border-purple-500/30',  text: 'text-purple-400'  },
};

export const RightSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  const [progression,   setProgression]   = useState<ProgressionData | null>(null);
  const [trending,      setTrending]      = useState<TrendingItem[]>([]);
  const [trendingLoad,  setTrendingLoad]  = useState(true);
  const [focusStatus,   setFocusStatus]   = useState<FocusGateStatusResponse | null>(null);

  // ── Data load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [projRes, progRes, focusRes] = await Promise.allSettled([
        projectApi.getProjects('in_progress'),
        progressionApi.getProgression(),
        focusApi.getFocusStatus(),
      ]);
      if (projRes.status  === 'fulfilled' && projRes.value.projects.length > 0)
        setActiveProject(projRes.value.projects[0]);
      if (progRes.status  === 'fulfilled') setProgression(progRes.value);
      if (focusRes.status === 'fulfilled') setFocusStatus(focusRes.value);
    };
    load();
    window.addEventListener('buildfeed:progression-updated', load);
    return () => window.removeEventListener('buildfeed:progression-updated', load);
  }, []);

  // ── Trending ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      setTrendingLoad(true);
      try   { setTrending((await likeApi.getTrending(7, 5)).items || []); }
      catch { setTrending([]); }
      finally { setTrendingLoad(false); }
    };
    fetch();
    const onLikeChanged = () =>
      likeApi.getTrending(7, 5).then(r => setTrending(r.items || [])).catch(() => {});
    window.addEventListener('buildfeed:like-changed', onLikeChanged);
    return () => window.removeEventListener('buildfeed:like-changed', onLikeChanged);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const typeIcon = (ct: string, url: string) => {
    const t = ct?.toLowerCase() || '';
    if (t.includes('youtube') || t.includes('video') || url?.includes('youtube.com'))
      return <Youtube size={12} className="text-red-400" />;
    if (t.includes('github') || t.includes('repo'))
      return <Github  size={12} className="text-slate-400" />;
    return <FileText  size={12} className="text-blue-400" />;
  };

  const typeBadge = (item: TrendingItem) => {
    const t = item.content_type?.toLowerCase() || '';
    if (t.includes('github') || t.includes('repo'))   return 'GitHub';
    if (t.includes('youtube') || t.includes('video')) return 'YouTube';
    if (t.includes('research'))                        return 'Research';
    return 'Article';
  };

  const formatLikes = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

  // ── Limit ring maths ─────────────────────────────────────────────────────
  const consumed  = focusStatus?.consumed_today ?? 0;
  const limit     = focusStatus?.limit ?? 10;
  const isLocked  = focusStatus?.is_locked ?? false;
  const remaining = Math.max(0, limit - consumed);
  const pct       = Math.min(1, consumed / (limit || 10));
  const CIRC      = 251;
  const dashOffset= CIRC - pct * CIRC;

  // ── User level badge ─────────────────────────────────────────────────────
  const levelKey   = (user?.experience_level || 'beginner').toLowerCase();
  const lvBadge    = LEVEL_BADGE[levelKey] ?? LEVEL_BADGE['beginner'];

  return (
    <aside className="w-full lg:w-[300px] flex-shrink-0 space-y-3">

      {/* ━━ 1. User profile card ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {user && (
        <div className="bf-card p-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-3 mb-4">
            <Link to="/profile" className="flex-shrink-0">
              <div className="w-11 h-11 rounded-full bg-accent/20 border-2 border-accent/30 text-accent font-bold flex items-center justify-center text-sm overflow-hidden">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  : user.username?.substring(0, 2).toUpperCase()
                }
              </div>
            </Link>
            <div className="min-w-0 flex-1">
              <Link to="/profile" className="text-sm font-bold text-primary hover:text-accent truncate block transition-colors">
                {user.username}
              </Link>
              <p className="text-[10px] text-muted truncate">@{user.username}</p>
            </div>
            {user.experience_level && (
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${lvBadge.bg} ${lvBadge.text}`}>
                {user.experience_level}
              </span>
            )}
          </div>

          {/* 3-column metrics */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Saved',    val: '—',                                         icon: <Bookmark   size={14} />, color: 'text-blue-400' },
              { label: 'Projects', val: progression?.completed_projects_count ?? 0,  icon: <Rocket     size={14} />, color: 'text-accent'    },
              { label: 'XP',       val: progression ? `${(progression.total_xp / 1000).toFixed(1)}K` : '—', icon: <Zap size={14} />, color: 'text-amber-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-raised rounded-lg p-2.5 border border-borderPaper text-center">
                <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
                <div className="text-sm font-bold text-primary">{stat.val}</div>
                <div className="text-[9px] text-muted uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ━━ 2. Today's Limit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className={`bf-card p-4 ${isLocked ? 'border-accent/40' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
            <Flame size={13} className={isLocked ? 'text-accent' : 'text-orange-400'} />
            Today's Limit
          </h3>
          {isLocked && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent animate-glow-pulse">
              Time to build!
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Ring gauge */}
          <div className="flex-shrink-0 relative w-[68px] h-[68px]">
            <svg width="68" height="68" viewBox="0 0 90 90" fill="none" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="45" cy="45" r="40" strokeWidth="7"
                stroke="var(--border-paper)"
              />
              <circle
                cx="45" cy="45" r="40"
                strokeWidth="7"
                stroke={isLocked ? '#6366F1' : 'var(--accent)'}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={CIRC}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.55s cubic-bezier(0.16,1,0.3,1)', filter: isLocked ? 'drop-shadow(0 0 6px rgba(99,102,241,0.5))' : 'none' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-primary leading-none">{consumed}</span>
              <span className="text-[9px] text-muted">/{limit}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {isLocked ? (
              <>
                <p className="text-xs font-bold text-primary mb-1">
                  You've discovered enough!
                </p>
                <p className="text-[11px] text-secondary leading-relaxed mb-2">
                  Keep building, that's where the real progress happens. 🚀
                </p>
                <Link
                  to={activeProject ? `/projects/${activeProject.id}` : '/projects'}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:text-accentHover transition-colors"
                >
                  <Hammer size={11} />
                  Continue Your Project →
                </Link>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-primary mb-0.5">
                  {consumed} / {limit} viewed
                </p>
                <p className="text-[11px] text-secondary leading-relaxed">
                  {remaining} item{remaining !== 1 ? 's' : ''} left before BuildFeed nudges you to build.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ━━ 3. Continue Building ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bf-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Continue Building</h3>
          <Link to="/projects" className="text-[11px] font-semibold text-accent hover:text-accentHover transition-colors">
            View all
          </Link>
        </div>

        {activeProject ? (
          <>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 text-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                <Rocket size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-primary truncate leading-snug">{activeProject.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1 bg-borderPaper rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(3, activeProject.progress_percent || 0)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted flex-shrink-0">{activeProject.progress_percent}%</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate(`/projects/${activeProject.id}`)}
              className="w-full py-2 px-3 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accentHover transition-colors flex items-center justify-center gap-1.5 shadow-purple"
            >
              <Hammer size={12} />
              Continue Build
            </button>
          </>
        ) : (
          <div className="text-center py-3">
            <div className="w-8 h-8 rounded-lg bg-raised border border-borderPaper text-muted flex items-center justify-center mx-auto mb-2">
              <Rocket size={15} />
            </div>
            <p className="text-xs text-secondary mb-2">No active builds yet.</p>
            <Link
              to="/saved"
              className="inline-flex items-center justify-center w-full py-1.5 px-3 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accentHover transition-colors shadow-purple"
            >
              Start from Saved →
            </Link>
          </div>
        )}
      </div>

      {/* ━━ 4. Trending This Week ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bf-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={13} className="text-accent" />
            Trending This Week
          </h3>
          <Link to="/dashboard" className="text-[11px] font-semibold text-accent hover:text-accentHover transition-colors">
            View all →
          </Link>
        </div>

        <div className="space-y-2">
          {trendingLoad
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 animate-pulse">
                  <div className="w-4 h-3 skeleton flex-shrink-0" />
                  <div className="w-7 h-7 skeleton rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-2 skeleton w-4/5" />
                    <div className="h-1.5 skeleton w-1/3" />
                  </div>
                  <div className="h-3 w-8 skeleton" />
                </div>
              ))
            : trending.length > 0
            ? trending.map(item => (
                <a
                  key={item.item_id}
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 group p-1.5 -mx-1.5 rounded-lg hover:bg-raised transition-colors"
                >
                  {/* Rank */}
                  <span className="text-[10px] font-bold text-muted w-3 text-center flex-shrink-0">
                    {item.rank}
                  </span>
                  {/* Platform icon */}
                  <div className="w-7 h-7 rounded-lg bg-raised border border-borderPaper flex items-center justify-center flex-shrink-0 group-hover:border-accent/40 transition-colors">
                    {typeIcon(item.content_type, item.source_url)}
                  </div>
                  {/* Title + type */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-primary truncate group-hover:text-accent transition-colors leading-tight">
                      {item.title}
                    </p>
                    <span className="text-[9px] font-medium text-muted">{typeBadge(item)}</span>
                  </div>
                  {/* Like count */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <TrendingUp size={10} className="text-accent" />
                    <span className="text-[10px] font-bold text-accent">{formatLikes(item.like_count)}</span>
                  </div>
                </a>
              ))
            : (
              <div className="text-center py-4">
                <Flame size={18} className="mx-auto mb-1.5 text-muted" />
                <p className="text-xs text-muted">No trending content yet.</p>
                <p className="text-[10px] text-muted">Be the first to like something!</p>
              </div>
            )
          }
        </div>
      </div>

      {/* ━━ 5. Quick Actions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bf-card p-4">
        <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="space-y-1">
          {[
            { to: '/saved',    icon: <LinkIcon    size={13} />, label: 'Import from URL',    sub: 'Add any public page'   },
            { to: '/projects', icon: <FolderPlus  size={13} />, label: 'Create New Project', sub: 'Start building today'  },
            { to: '/saved',    icon: <Bookmark    size={13} />, label: 'Add to Saved',        sub: 'Bookmark for later'   },
          ].map(action => (
            <Link
              key={action.label}
              to={action.to}
              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-raised border border-transparent hover:border-borderPaper transition-all group"
            >
              <div className="w-7 h-7 rounded-lg bg-raised border border-borderPaper flex items-center justify-center flex-shrink-0 text-muted group-hover:border-accent/40 group-hover:text-accent transition-all">
                {action.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-primary group-hover:text-accent transition-colors">{action.label}</p>
                <p className="text-[10px] text-muted">{action.sub}</p>
              </div>
              <ArrowRight size={11} className="ml-auto text-muted group-hover:text-accent transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* ━━ 6. Philosophy Quote ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bf-card p-4 relative overflow-hidden">
        {/* Decorative quote mark */}
        <Quote
          size={40}
          className="absolute top-2 right-3 text-accent/10 rotate-180 pointer-events-none"
        />
        <div className="relative">
          <p className="text-xs font-medium text-secondary leading-relaxed italic mb-2">
            "The best way to predict your future is to build it."
          </p>
          <p className="text-[10px] font-bold text-accent">— BuildFeed</p>
        </div>
      </div>
    </aside>
  );
};
