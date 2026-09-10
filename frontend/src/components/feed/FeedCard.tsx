import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark, BookmarkCheck, EyeOff, Sparkles,
  FileText, Play, Hammer, Github, Youtube,
  ThumbsUp, MoreHorizontal, GraduationCap,
  TrendingUp, Ban, Loader2, CheckCircle2,
  ArrowUpRight, Clock, Heart,
} from 'lucide-react';
import { FeedItem, feedApi } from '../../services/api/feedApi';
import { savedApi }          from '../../services/api/savedApi';
import { focusApi }          from '../../services/api/focusApi';
import { projectApi, ProjectItem } from '../../services/api/projectApi';
import { likeApi }           from '../../services/api/likeApi';
import { Button }            from '../ui/Button';
import { useAuth }           from '../../features/auth/AuthContext';
import { BuildSuggestionModal } from '../focus/BuildSuggestionModal';

// ─── Relevance tier — driven entirely by the backend recommendation_reason ───
type RelevanceTier = 'direct' | 'related' | 'none';

function parseRelevanceTier(reason: string): RelevanceTier {
  if (!reason) return 'none';
  const r = reason.toLowerCase();
  if (r.includes('directly relevant') || r.includes('direct match')) return 'direct';
  if (r.includes('related') || r.includes('matches your') || r.includes('based on')) return 'related';
  return 'none';
}

// ─── Platform badge ──────────────────────────────────────────────────────────
type PlatformMeta = { label: string; bgCls: string; textCls: string; icon: React.ReactNode };

function getPlatformMeta(contentType: string, sourceUrl: string): PlatformMeta {
  const t  = contentType?.toLowerCase() || '';
  const yt = t.includes('youtube') || sourceUrl?.includes('youtube.com') || sourceUrl?.includes('youtu.be');

  if (yt || t.includes('video'))
    return { label:'YouTube', bgCls:'bg-red-500/12 dark:bg-red-500/15', textCls:'text-red-500 dark:text-red-400',
             icon:<Youtube size={11}/> };
  if (t.includes('github') || t.includes('repo'))
    return { label:'GitHub',  bgCls:'bg-slate-500/10 dark:bg-slate-400/10', textCls:'text-slate-600 dark:text-slate-300',
             icon:<Github  size={11}/> };
  if (t.includes('paper') || t.includes('research'))
    return { label:'Research',bgCls:'bg-blue-500/10 dark:bg-blue-500/12',  textCls:'text-blue-600 dark:text-blue-400',
             icon:<Sparkles size={11}/> };
  return   { label:'Article', bgCls:'bg-accent/10',                         textCls:'text-accent',
             icon:<FileText size={11}/> };
}

// ─── Difficulty pill style ────────────────────────────────────────────────────
const DIFF_STYLE: Record<string, string> = {
  beginner:     'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20',
  intermediate: 'bg-amber-500/10  text-amber-500  dark:text-amber-400  border border-amber-500/20',
  advanced:     'bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20',
};

// ─── Relative time ────────────────────────────────────────────────────────────
function relativeDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d < 1)   return 'Today';
  if (d < 7)   return `${d}d ago`;
  if (d < 30)  return `${Math.floor(d/7)}w ago`;
  if (d < 365) return `${Math.floor(d/30)}mo ago`;
  return `${Math.floor(d/365)}y ago`;
}

// ─── Domain from URL ──────────────────────────────────────────────────────────
function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface FeedCardProps {
  item:             FeedItem;
  initialIsSaved?:  boolean;
  onDismiss?:       (itemId: string) => void;
  onToggleSave?:    (itemId: string, newSaved: boolean) => void;
  onConsume?:       (itemId: string) => void;
  onSelect?:        (item: FeedItem) => void;
  showBuildAction?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
const FeedCardComponent: React.FC<FeedCardProps> = ({
  item, initialIsSaved = false,
  onDismiss, onToggleSave, onConsume, onSelect,
  showBuildAction = false,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isSaved,              setIsSaved]              = useState(initialIsSaved);
  const [isSaving,             setIsSaving]             = useState(false);
  const [isDismissed,          setIsDismissed]          = useState(false);
  const [isBuilding,           setIsBuilding]           = useState(false);
  const [buildError,           setBuildError]           = useState<string | null>(null);
  const [showBuildChoice,      setShowBuildChoice]      = useState(false);
  const [isCheckingBuild,      setIsCheckingBuild]      = useState(false);
  const [moreMenuOpen,         setMoreMenuOpen]         = useState(false);
  const [feedbackToast,        setFeedbackToast]        = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isLiked,              setIsLiked]              = useState(item.is_liked   ?? false);
  const [likeCount,            setLikeCount]            = useState(item.like_count ?? 0);
  const [isLiking,             setIsLiking]             = useState(false);
  const [likeAnimating,        setLikeAnimating]        = useState(false);

  useEffect(() => { setIsSaved(initialIsSaved); }, [initialIsSaved]);
  useEffect(() => { setIsLiked(item.is_liked ?? false); setLikeCount(item.like_count ?? 0); },
    [item.is_liked, item.like_count]);

  if (isDismissed) return null;

  // ─── handlers (all unchanged — same API calls) ────────────────────────
  const handleDismiss = () => { setIsDismissed(true); onDismiss?.(item.id); };

  const handleFeedback = async (type: 'too_easy'|'too_hard'|'irrelevant'|'dismiss') => {
    setMoreMenuOpen(false);
    setIsSubmittingFeedback(true);
    try {
      await feedApi.submitFeedback(item.id, type);
      const msgs: Record<string,string> = {
        too_easy:   'Calibrated: recommending more advanced content.',
        too_hard:   'Calibrated: focusing on prerequisite fundamentals.',
        irrelevant: 'Calibrated: topic suppressed from your feed.',
        dismiss:    'Content hidden.',
      };
      setFeedbackToast(msgs[type]);
      setTimeout(handleDismiss, 1200);
    } catch { handleDismiss(); }
    finally { setIsSubmittingFeedback(false); }
  };

  const handleSaveToggle = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isSaving) return;
    setIsSaving(true);
    const next = !isSaved;
    try {
      next ? await savedApi.saveItem(item.id) : await savedApi.unsaveItem(item.id);
      setIsSaved(next);
      onToggleSave?.(item.id, next);
    } catch { /* silent */ }
    finally { setIsSaving(false); }
  };

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);
    const prev = { liked: isLiked, count: likeCount };
    const next = !isLiked;
    setIsLiked(next);
    setLikeCount(c => next ? c + 1 : Math.max(0, c - 1));
    if (next) { setLikeAnimating(true); setTimeout(() => setLikeAnimating(false), 380); }
    try {
      const res = next ? await likeApi.likeItem(item.id) : await likeApi.unlikeItem(item.id);
      setIsLiked(res.is_liked);
      setLikeCount(res.like_count);
    } catch {
      setIsLiked(prev.liked);
      setLikeCount(prev.count);
    } finally { setIsLiking(false); }
  };

  const handleBuildProject = async () => {
    if (isBuilding || isCheckingBuild) return;
    setBuildError(null);
    setIsCheckingBuild(true);
    try {
      const state = await projectApi.getBuildState(item.id);
      if (state.exists && state.project) { navigate(`/projects/${state.project.id}`); return; }
      setShowBuildChoice(true);
    } catch (err: any) {
      setBuildError(err?.response?.data?.detail || 'Could not check project state.');
    } finally { setIsCheckingBuild(false); }
  };

  const handleProjectBuilt = (project: ProjectItem) => {
    setShowBuildChoice(false);
    navigate(`/projects/${project.id}`);
  };

  const handleNeedsGithubAuth = async () => {
    try {
      const res = await projectApi.getGithubBuildAuthorizeUrl(item.id);
      window.location.assign(res.github_authorize_url);
    } catch (err: any) {
      setBuildError(err?.response?.data?.detail || 'Could not connect GitHub.');
    }
  };

  const handleOpenSource = async () => {
    try { await focusApi.consumeItem(item.id); onConsume?.(item.id); } catch { /* silent */ }
    window.open(item.source_url, '_blank', 'noopener,noreferrer');
  };

  const handleCardClick = () => { onSelect ? onSelect(item) : handleOpenSource(); };

  // ─── derived ──────────────────────────────────────────────────────────
  const meta       = item.ai_metadata || {};
  const platform   = getPlatformMeta(item.content_type, item.source_url);
  const relevance  = parseRelevanceTier(item.recommendation_reason || '');
  const diff       = (meta.difficulty_level || '').toLowerCase();
  const diffStyle  = DIFF_STYLE[diff] || '';
  const summary    = meta.short_summary || item.description || '';
  const topics     = meta.topics        || [];
  const techs      = meta.technologies  || [];
  const tags       = [...techs, ...topics].filter(Boolean).slice(0, 5);
  const dateStr    = relativeDate(item.published_at);
  const domain     = hostOf(item.source_url);
  const isVideo    = item.content_type?.includes('video') || item.content_type?.includes('youtube');

  return (
    <article
      onClick={handleCardClick}
      className="feed-card group animate-fade-in-up w-full min-w-0"
    >
      {/* Feedback calibration banner */}
      {feedbackToast && (
        <div className="rounded-t-[12px] px-4 py-2 bg-accent/10 border-b border-accent/20
                        flex items-center gap-2 text-xs text-accent font-semibold animate-fade-in">
          <CheckCircle2 size={13} className="flex-shrink-0" />
          {feedbackToast}
        </div>
      )}

      <div className="p-4">
        <div className="flex gap-3">

          {/* ── Thumbnail / platform graphic ─────────────────────── */}
          <div
            onClick={e => { e.stopPropagation(); handleCardClick(); }}
            className="
              w-[88px] h-[88px] sm:w-[104px] sm:h-[104px]
              rounded-xl overflow-hidden flex-shrink-0 cursor-pointer
              bg-raised border border-borderPaper relative
            "
          >
            {item.thumbnail_url ? (
              <img
                src={item.thumbnail_url}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              /* Generated dark-code thumbnail */
              <div className="w-full h-full bg-gradient-to-br from-[#0f1523] via-[#161f33] to-[#1a1040]
                              flex flex-col items-center justify-center gap-1.5 p-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                                 ${platform.bgCls}`}>
                  <span className={platform.textCls}>{
                    item.content_type?.includes('github') ? <Github size={16} /> :
                    item.content_type?.includes('video')  ? <Youtube size={16} /> :
                    <FileText size={16} />
                  }</span>
                </div>
                <p className="text-[8px] font-mono text-slate-500 text-center leading-tight line-clamp-2 px-1">
                  {item.title?.slice(0, 32)}
                </p>
              </div>
            )}

            {/* Video play overlay */}
            {isVideo && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-md
                                group-hover:scale-110 transition-transform duration-150">
                  <Play size={14} className="fill-slate-900 ml-0.5 text-slate-900" />
                </div>
              </div>
            )}
          </div>

          {/* ── Body ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col">

            {/* Top line: platform badge + relevance pill */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {/* Platform badge */}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                               text-[10px] font-bold tracking-wide uppercase
                               ${platform.bgCls} ${platform.textCls}`}>
                {platform.icon}
                {platform.label}
              </span>

              {/* Relevance pill — from backend recommendation_reason only */}
              {relevance === 'direct' && (
                <span className="relevance-direct inline-flex items-center gap-1
                                 px-2 py-0.5 rounded-md text-[10px] font-bold">
                  <Sparkles size={9} />
                  Directly relevant
                </span>
              )}
              {relevance === 'related' && (
                <span className="relevance-related inline-flex items-center gap-1
                                 px-2 py-0.5 rounded-md text-[10px] font-bold">
                  Related
                </span>
              )}

              {/* Difficulty */}
              {diff && (
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold capitalize ${diffStyle}`}>
                  {diff}
                </span>
              )}
            </div>

            {/* Title */}
            <h2
              onClick={e => { e.stopPropagation(); handleCardClick(); }}
              className="font-heading text-sm font-bold text-primary leading-snug line-clamp-2 mb-1
                         group-hover:text-accent transition-colors duration-150 cursor-pointer"
            >
              {item.title}
            </h2>

            {/* Description */}
            {summary && (
              <p className="text-[11px] text-secondary leading-relaxed line-clamp-2 mb-2">
                {summary}
              </p>
            )}

            {/* Tag pills */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded-md text-[9px] font-medium
                               bg-raised border border-borderPaper text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Bottom meta bar */}
            <div
              className="mt-auto flex items-center justify-between gap-2 pt-2
                         border-t border-borderPaper/50"
              onClick={e => e.stopPropagation()}
            >
              {/* Left: domain + date */}
              <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <span className="text-[10px] text-muted font-mono truncate hidden sm:block">
                  {domain}
                </span>
                {dateStr && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted flex-shrink-0">
                    <Clock size={9} />
                    {dateStr}
                  </span>
                )}
              </div>

              {/* Right: action icons */}
              <div className="flex items-center gap-0.5 flex-shrink-0">

                {/* Save */}
                <button
                  onClick={handleSaveToggle}
                  disabled={isSaving}
                  title={isSaved ? 'Unsave' : 'Save'}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer text-[11px] font-medium
                    ${isSaved
                      ? 'text-accent bg-accent/10'
                      : 'text-muted hover:text-primary hover:bg-raised'
                    }`}
                >
                  {isSaved
                    ? <BookmarkCheck size={14} className="text-accent" />
                    : <Bookmark size={14} />
                  }
                </button>

                {/* Like */}
                <button
                  onClick={handleLikeToggle}
                  disabled={isLiking}
                  title={isLiked ? 'Unlike' : 'Like'}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px]
                    font-semibold transition-all cursor-pointer select-none
                    ${isLiked
                      ? 'text-red-400 bg-red-500/10'
                      : 'text-muted hover:text-primary hover:bg-raised'
                    } ${isLiking ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <Heart
                    size={13}
                    className={`transition-all ${isLiked ? 'fill-red-400' : ''}
                                ${likeAnimating ? 'animate-like-pop' : ''}`}
                  />
                  {likeCount > 0 && (
                    <span className="text-[10px] font-bold">{likeCount.toLocaleString()}</span>
                  )}
                </button>

                {/* Open */}
                <button
                  onClick={e => { e.stopPropagation(); handleOpenSource(); }}
                  title="Open original"
                  className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-raised transition-colors"
                >
                  <ArrowUpRight size={14} />
                </button>

                {/* Build */}
                {showBuildAction && (
                  <button
                    onClick={e => { e.stopPropagation(); handleBuildProject(); }}
                    disabled={isBuilding || isCheckingBuild}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold
                               bg-accent text-white hover:bg-accentHover transition-colors shadow-purple"
                  >
                    {isCheckingBuild
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Hammer  size={11} />
                    }
                    <span>Build</span>
                  </button>
                )}

                {/* More menu */}
                <div className="relative">
                  <button
                    onClick={e => { e.stopPropagation(); setMoreMenuOpen(v => !v); }}
                    className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-raised transition-colors"
                    aria-label="More options"
                  >
                    <MoreHorizontal size={14} />
                  </button>

                  {moreMenuOpen && (
                    <div className="absolute right-0 bottom-9 w-52 rounded-xl border border-borderPaper
                                    bg-surface shadow-overlay p-1.5 z-30 animate-scale-in">
                      <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest
                                      text-muted border-b border-borderPaper mb-1">
                        Tune Recommendations
                      </div>
                      {[
                        { type: 'too_easy'   as const, icon: <GraduationCap size={12} className="text-emerald-500" />, label: 'Too Basic',    sub: 'Recommend more advanced content'    },
                        { type: 'too_hard'   as const, icon: <TrendingUp    size={12} className="text-amber-400"   />, label: 'Too Advanced', sub: 'Focus on prerequisite fundamentals' },
                        { type: 'irrelevant' as const, icon: <Ban           size={12} className="text-amber-500"   />, label: 'Not Relevant', sub: 'Suppress this topic from feed'      },
                      ].map(a => (
                        <button
                          key={a.type}
                          type="button"
                          onClick={e => { e.stopPropagation(); handleFeedback(a.type); }}
                          disabled={isSubmittingFeedback}
                          className="w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs
                                     text-primary hover:bg-raised transition-colors text-left"
                        >
                          <span className="mt-0.5 flex-shrink-0">{a.icon}</span>
                          <div>
                            <div className="font-semibold text-[11px]">{a.label}</div>
                            <div className="text-[9px] text-muted">{a.sub}</div>
                          </div>
                        </button>
                      ))}
                      <div className="border-t border-borderPaper mt-1 pt-1">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleFeedback('dismiss'); }}
                          disabled={isSubmittingFeedback}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs
                                     text-red-500 hover:bg-red-50 dark:hover:bg-red-950/25
                                     transition-colors text-left font-semibold"
                        >
                          <EyeOff size={12} />
                          Hide this item
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {buildError && !showBuildChoice && (
              <p className="text-[10px] text-red-400 mt-1 font-medium">{buildError}</p>
            )}
          </div>
        </div>

        {/* AI Breakdown chip — below the card body */}
        <div
          className="mt-3 pt-2.5 border-t border-borderPaper/40 flex items-center gap-2"
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={e => { e.stopPropagation(); handleCardClick(); }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px]
                       font-semibold bg-accent/10 text-accent hover:bg-accent hover:text-white
                       transition-all cursor-pointer border border-accent/20"
          >
            <Sparkles size={11} />
            AI Breakdown
          </button>
          {item.recommendation_reason && (
            <span className="text-[10px] text-muted truncate">
              • {item.recommendation_reason}
            </span>
          )}
        </div>
      </div>

      {/* Build Suggestion Modal — unchanged */}
      {showBuildChoice && (
        <BuildSuggestionModal
          itemId={item.id}
          githubUsername={user?.github_username}
          onClose={() => setShowBuildChoice(false)}
          onBuilt={handleProjectBuilt}
          onNeedsGithubAuth={handleNeedsGithubAuth}
        />
      )}
    </article>
  );
};

export const FeedCard = React.memo(FeedCardComponent);
