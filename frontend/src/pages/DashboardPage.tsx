import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link }     from 'react-router-dom';
import { useAuth }  from '../features/auth/AuthContext';
import { Navbar }   from '../components/layout/Navbar';
import { Sidebar }  from '../components/layout/Sidebar';
import { RightSidebar } from '../components/layout/RightSidebar';
import { Button }   from '../components/ui/Button';
import { Alert }    from '../components/ui/Alert';
import { feedApi, FeedItem }      from '../services/api/feedApi';
import { focusApi, FocusGateStatusResponse } from '../services/api/focusApi';
import { FeedCard } from '../components/feed/FeedCard';
import { FeedSkeleton }     from '../components/feed/FeedSkeleton';
import { FeedDetailDrawer } from '../components/feed/FeedDetailDrawer';
import { FocusGate }        from '../components/focus/FocusGate';
import { NowBuildCard }     from '../components/feed/NowBuildCard';
import {
  RefreshCw, SlidersHorizontal, Loader2, CheckCircle2,
  Sparkles, Hammer, Layers, Filter, ArrowRight,
} from 'lucide-react';

// ── Scroll trigger ────────────────────────────────────────────────────────────
const SCROLL_TRIGGER_PX  = 3600;
const SCROLL_THROTTLE_MS = 100;

const CATEGORY_TABS = [
  { id: '',               label: 'For You',  icon: <Sparkles size={12} /> },
  { id: 'article',        label: 'Articles', icon: null },
  { id: 'github_repo',    label: 'GitHub',   icon: null },
  { id: 'research_paper', label: 'Research', icon: null },
  { id: 'youtube',        label: 'YouTube',  icon: null },
];

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  // ── Feed state ────────────────────────────────────────────────────────────
  const [items,               setItems]               = useState<FeedItem[]>([]);
  const [selectedType,        setSelectedType]        = useState<string>('');
  const [sortOrder,           setSortOrder]           = useState<string>('relevant');
  const [sortDropdownOpen,    setSortDropdownOpen]    = useState(false);
  const [isLoading,           setIsLoading]           = useState(true);
  const [isRefreshing,        setIsRefreshing]        = useState(false);
  const [error,               setError]               = useState<string | null>(null);
  const [refreshSeed,         setRefreshSeed]         = useState<number | undefined>(undefined);
  const [focusStatus,         setFocusStatus]         = useState<FocusGateStatusResponse | null>(null);
  const [mobileSidebarOpen,   setMobileSidebarOpen]   = useState(false);
  const [hasMore,             setHasMore]             = useState(false);
  const [isLoadingMore,       setIsLoadingMore]       = useState(false);

  // ── Drawer ────────────────────────────────────────────────────────────────
  const [selectedDrawerItem, setSelectedDrawerItem]  = useState<FeedItem | null>(null);
  const [drawerOpen,         setDrawerOpen]          = useState(false);

  // ── Session saves ─────────────────────────────────────────────────────────
  const [sessionSavedItems,  setSessionSavedItems]   = useState<FeedItem[]>([]);

  // ── Feed-paused toast ─────────────────────────────────────────────────────
  const [feedPausedToast,    setFeedPausedToast]     = useState(false);

  // ── Scroll-triggered NowBuild modal ──────────────────────────────────────
  const [limitReached,       setLimitReached]        = useState(false);
  const [nowBuildDismissed,  setNowBuildDismissed]   = useState(false);

  const scrollAccumRef    = useRef<number>(0);
  const lastScrollYRef    = useRef<number>(0);
  const throttleTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedReadyRef      = useRef(false);
  const listenerActiveRef = useRef(false);

  const visibleItems = items;
  const showNowBuild = limitReached && !nowBuildDismissed && !isLoading && !isRefreshing;

  // ── Scroll tracker ────────────────────────────────────────────────────────
  const attachScrollListener = useCallback(() => {
    if (listenerActiveRef.current) return;
    const handleScroll = () => {
      if (throttleTimerRef.current !== null) return;
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        if (!feedReadyRef.current) { lastScrollYRef.current = window.scrollY; return; }
        const delta = window.scrollY - lastScrollYRef.current;
        lastScrollYRef.current = window.scrollY;
        if (delta > 0) {
          scrollAccumRef.current += delta;
          if (scrollAccumRef.current >= SCROLL_TRIGGER_PX) {
            setLimitReached(true);
            detachScrollListener();
          }
        }
      }, SCROLL_THROTTLE_MS);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    listenerActiveRef.current = true;
    return () => {
      window.removeEventListener('scroll', handleScroll);
      listenerActiveRef.current = false;
      if (throttleTimerRef.current !== null) { clearTimeout(throttleTimerRef.current); throttleTimerRef.current = null; }
    };
  }, []); // eslint-disable-line

  const detachScrollListener = useCallback(() => {
    listenerActiveRef.current = false;
    if (throttleTimerRef.current !== null) { clearTimeout(throttleTimerRef.current); throttleTimerRef.current = null; }
  }, []);

  useEffect(() => {
    const cleanup = attachScrollListener();
    return () => { cleanup?.(); listenerActiveRef.current = false; };
  }, []); // eslint-disable-line

  // ── Helpers ───────────────────────────────────────────────────────────────
  const checkFocusStatus = useCallback(async () => {
    try { const st = await focusApi.getFocusStatus(); setFocusStatus(st); return st; }
    catch { return null; }
  }, []);

  const fetchFeed = useCallback(async (
    contentType: string,
    isRefresh = false,
    seedVal?: number,
    requestRefresh = false,
  ) => {
    isRefresh ? setIsRefreshing(true) : setIsLoading(true);
    setError(null);
    if (isRefresh || requestRefresh) {
      setLimitReached(false); setNowBuildDismissed(false);
      scrollAccumRef.current = 0; lastScrollYRef.current = window.scrollY;
      feedReadyRef.current = false; listenerActiveRef.current = false;
    }
    try {
      const st = (!requestRefresh && focusStatus) ? focusStatus : await checkFocusStatus();
      if (st?.is_locked) { setItems([]); setHasMore(false); return; }
      const res = await feedApi.getForYouFeed({
        content_type: contentType || undefined,
        limit: 20, offset: 0, seed: seedVal, refresh: requestRefresh,
      });
      const seen = new Set<string>();
      const deduped = (res.items || []).filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      setItems(deduped);
      setHasMore(res.has_more);
      feedReadyRef.current = true;
      lastScrollYRef.current = window.scrollY;
      if (!listenerActiveRef.current) attachScrollListener();
    } catch (err: any) {
      if (err?.response?.status === 423) checkFocusStatus();
      else setError(err?.response?.data?.detail || 'Could not connect to BuildFeed. Please verify backend status.');
    } finally {
      setIsLoading(false); setIsRefreshing(false);
    }
  }, [checkFocusStatus, focusStatus, attachScrollListener]); // eslint-disable-line

  useEffect(() => {
    setLimitReached(false); setNowBuildDismissed(false); setSessionSavedItems([]);
    scrollAccumRef.current = 0; lastScrollYRef.current = window.scrollY;
    feedReadyRef.current = false; listenerActiveRef.current = false;
    fetchFeed(selectedType, false, refreshSeed);
  }, [selectedType, refreshSeed]); // eslint-disable-line

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await feedApi.getForYouFeed({
        content_type: selectedType || undefined, limit: 20,
        offset: items.length, seed: refreshSeed,
      });
      setItems(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const newItems = (res.items || []).filter(i => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
      setHasMore(res.has_more);
    } catch { /* silent */ }
    finally { setIsLoadingMore(false); }
  };

  const handleRefresh = () => fetchFeed(selectedType, true, undefined, true);
  const handleDismissItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const handleSessionSaveToggle = useCallback((item: FeedItem, isSaved: boolean) => {
    setSessionSavedItems(prev =>
      isSaved ? [item, ...prev.filter(i => i.id !== item.id)] : prev.filter(i => i.id !== item.id)
    );
  }, []);

  const handleProjectTransition = useCallback(() => {
    setFeedPausedToast(true);
    setTimeout(() => setFeedPausedToast(false), 4500);
  }, []);

  const handleItemConsumed = async () => {
    const st = await checkFocusStatus();
    if (st?.is_locked) setItems([]);
  };

  const handleUnlockFeed = async () => {
    await checkFocusStatus();
    fetchFeed(selectedType, true);
  };

  const handleDismissModal = () => {
    setNowBuildDismissed(true);
    listenerActiveRef.current = false;
    if (throttleTimerRef.current !== null) { clearTimeout(throttleTimerRef.current); throttleTimerRef.current = null; }
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const userName         = user?.username        || 'Builder';
  const primaryInterest  = user?.interests?.[0]  || null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-paper text-primary overflow-x-hidden">
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        selectedContentType={selectedType}
        onSelectContentType={setSelectedType}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-5 lg:px-8 py-5">
          <div className="flex flex-col lg:flex-row gap-5 items-start">

            {/* ── CENTER FEED ─────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 w-full space-y-4">

              {/* ── HERO BANNER ──────────────────────────────────────────── */}
              {!focusStatus?.is_locked && (
                <div className="relative rounded-2xl overflow-hidden border border-borderPaper">
                  {/* Gradient background simulating mountain/summit landscape */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0f1523] via-[#111827] to-[#0d0f1a]" />

                  {/* Indigo/violet glow layers */}
                  <div className="absolute inset-0"
                    style={{
                      background: `
                        radial-gradient(ellipse 70% 60% at 50% 110%, rgba(99,102,241,0.28) 0%, transparent 70%),
                        radial-gradient(ellipse 40% 40% at 80% 20%, rgba(139,92,246,0.15) 0%, transparent 60%)
                      `
                    }}
                  />

                  {/* Mountain silhouette SVG */}
                  <div className="absolute bottom-0 inset-x-0 pointer-events-none" aria-hidden>
                    <svg viewBox="0 0 800 160" preserveAspectRatio="none" className="w-full h-[80px] sm:h-[100px]">
                      {/* Back range — darkest */}
                      <polygon points="0,160 0,100 80,60 160,80 260,30 360,70 420,20 500,60 580,40 660,70 740,50 800,80 800,160"
                        fill="rgba(30,41,59,0.5)" />
                      {/* Mid range */}
                      <polygon points="0,160 0,120 100,90 180,110 260,70 340,100 420,55 500,90 600,75 680,100 760,85 800,100 800,160"
                        fill="rgba(15,23,42,0.7)" />
                      {/* Foreground ridge */}
                      <polygon points="0,160 0,140 60,125 140,135 220,118 310,130 400,112 490,128 570,115 660,130 740,120 800,130 800,160"
                        fill="rgba(11,15,26,0.9)" />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="relative px-5 sm:px-7 pt-5 pb-10 sm:pb-12">
                    {/* Top pill tag */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                                    bg-white/8 border border-white/12 text-[10px] font-bold
                                    text-white/70 uppercase tracking-widest mb-4">
                      Build &gt; Learn &gt; Grow
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                      <div className="max-w-lg">
                        <h1 className="font-heading text-xl sm:text-2xl font-bold text-white leading-tight mb-2">
                          Curated for your goals,
                          <br />
                          <span className="text-brand-300">not just your interests.</span>
                        </h1>
                        <p className="text-sm text-white/55 leading-relaxed">
                          {primaryInterest
                            ? `Discover the right ${primaryInterest} content, build real projects, and turn your curiosity into skills.`
                            : 'Discover the right content, build real projects, and turn your curiosity into skills.'}
                        </p>
                      </div>

                      {/* CTAs */}
                      <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0">
                        <Link
                          to="/projects"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                                     bg-accent text-white text-xs font-bold
                                     hover:bg-accentHover shadow-purple transition-all
                                     hover:shadow-purpleHover hover:scale-[1.02] active:scale-[0.98]
                                     whitespace-nowrap"
                        >
                          <Hammer size={13} />
                          Continue Your Project →
                        </Link>
                        <button
                          onClick={handleRefresh}
                          disabled={isLoading || isRefreshing}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                                     bg-white/8 border border-white/12 text-white/70
                                     text-xs font-semibold hover:bg-white/12 transition-all"
                        >
                          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                          Refresh Feed
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Focus Gate ──────────────────────────────────────────── */}
              {focusStatus?.is_locked ? (
                <FocusGate status={focusStatus} onUnlock={handleUnlockFeed} />
              ) : (
                <>
                  {/* ── Filter / sort bar ─────────────────────────────── */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {CATEGORY_TABS.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setSelectedType(tab.id)}
                          className={`filter-pill flex items-center gap-1 ${selectedType === tab.id ? 'active' : ''}`}
                        >
                          {tab.icon}
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Sort */}
                    <div className="relative ml-auto">
                      <button
                        onClick={() => setSortDropdownOpen(v => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                   bg-surface border border-borderPaper text-xs font-semibold
                                   text-secondary hover:text-primary hover:border-cardHoverBorder
                                   transition-all"
                      >
                        <Filter size={11} />
                        <span className="capitalize">{sortOrder}</span>
                      </button>
                      {sortDropdownOpen && (
                        <div className="absolute right-0 top-9 w-32 rounded-xl border border-borderPaper
                                        bg-surface shadow-elevated p-1 z-20 animate-scale-in">
                          {['relevant', 'latest', 'trending'].map(opt => (
                            <button
                              key={opt}
                              onClick={() => { setSortOrder(opt); setSortDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium
                                          capitalize transition-colors ${
                                sortOrder === opt
                                  ? 'bg-accentLight text-accent font-semibold'
                                  : 'text-secondary hover:text-primary hover:bg-raised'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Error ──────────────────────────────────────────── */}
                  {error && (
                    <div>
                      <Alert type="error" title="Feed Connection Error" message={error} />
                      <div className="mt-2 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => fetchFeed(selectedType, false, refreshSeed)}
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── Loading skeletons ──────────────────────────────── */}
                  {(isLoading || isRefreshing) ? (
                    <div className="space-y-3 stagger-children">
                      <FeedSkeleton /><FeedSkeleton /><FeedSkeleton />
                    </div>
                  ) : visibleItems.length > 0 ? (
                    <div className="space-y-3 stagger-children">
                      {visibleItems.map(item => (
                        <FeedCard
                          key={item.id}
                          item={item}
                          onSelect={selected => { setSelectedDrawerItem(selected); setDrawerOpen(true); }}
                          onDismiss={handleDismissItem}
                          onConsume={handleItemConsumed}
                          onToggleSave={(itemId, saved) => {
                            const found = visibleItems.find(i => i.id === itemId);
                            if (found) handleSessionSaveToggle(found, saved);
                          }}
                        />
                      ))}

                      {/* Load More */}
                      {hasMore && (
                        <div className="text-center pt-2">
                          <button
                            onClick={handleLoadMore}
                            disabled={isLoadingMore}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl
                                       bg-surface border border-borderPaper text-xs font-semibold
                                       text-secondary hover:text-primary hover:border-cardHoverBorder
                                       transition-all disabled:opacity-50"
                          >
                            {isLoadingMore ? (
                              <><Loader2 size={13} className="animate-spin text-accent" />Loading…</>
                            ) : (
                              <>Load More <ArrowRight size={13} /></>
                            )}
                          </button>
                        </div>
                      )}

                      {/* End of feed */}
                      {!hasMore && (
                        <div className="text-center py-10 border-t border-borderPaper">
                          <div className="w-9 h-9 rounded-xl bg-raised border border-borderPaper
                                          text-muted flex items-center justify-center mx-auto mb-2">
                            <Layers size={16} />
                          </div>
                          <p className="text-sm font-semibold text-primary mb-0.5">You're all caught up!</p>
                          <p className="text-xs text-muted mb-4">End of your personalized feed for now.</p>
                          <div className="flex items-center justify-center gap-2.5">
                            <button
                              onClick={handleRefresh}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg
                                         bg-surface border border-borderPaper text-xs font-semibold
                                         text-secondary hover:text-primary transition-all"
                            >
                              <RefreshCw size={12} />
                              Check for updates
                            </button>
                            <Link
                              to="/projects"
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg
                                         bg-accent text-white text-xs font-semibold
                                         hover:bg-accentHover shadow-purple transition-all"
                            >
                              <Hammer size={12} />
                              Start Building
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    !error && (
                      <div className="bf-card p-10 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-raised border border-borderPaper
                                        text-muted flex items-center justify-center mx-auto mb-4">
                          <SlidersHorizontal size={20} />
                        </div>
                        <h2 className="font-heading text-base font-bold text-primary mb-2">
                          {selectedType
                            ? `No ${CATEGORY_TABS.find(t => t.id === selectedType)?.label ?? selectedType} content yet.`
                            : 'Nothing strong enough yet.'
                          }
                        </h2>
                        <p className="text-sm text-secondary max-w-xs mx-auto mb-5 leading-relaxed">
                          {user?.interests?.length
                            ? `We're curating more ${user.interests[0]} content for ${user.experience_level ?? 'your'} level developers.`
                            : "We couldn't find content matching your filters. Try clearing them or refreshing."
                          }
                        </p>
                        <div className="flex items-center justify-center gap-2.5">
                          <button
                            onClick={() => setSelectedType('')}
                            className="px-4 py-2 rounded-lg bg-surface border border-borderPaper
                                       text-xs font-semibold text-secondary hover:text-primary transition-all"
                          >
                            Show All
                          </button>
                          <button
                            onClick={handleRefresh}
                            className="px-4 py-2 rounded-lg bg-accent text-white
                                       text-xs font-semibold hover:bg-accentHover shadow-purple transition-all"
                          >
                            Refresh
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </>
              )}
            </div>

            {/* ── RIGHT SIDEBAR ─────────────────────────────────────────── */}
            <RightSidebar />
          </div>
        </main>

        {/* Drawer */}
        <FeedDetailDrawer
          item={selectedDrawerItem}
          isOpen={drawerOpen}
          onClose={() => { setDrawerOpen(false); setSelectedDrawerItem(null); }}
          onConsume={handleItemConsumed}
        />

        {/* NowBuild intervention modal */}
        {showNowBuild && (
          <NowBuildCard
            onDismiss={handleDismissModal}
            sessionSavedItems={sessionSavedItems}
            onProjectTransition={handleProjectTransition}
            userInterests={user?.interests    ?? []}
            userExperience={user?.experience_level ?? ''}
          />
        )}

        {/* Feed-paused toast */}
        {feedPausedToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300]
                          flex items-center gap-2.5 px-5 py-3 rounded-2xl
                          bg-surface border border-accent/30 shadow-overlay
                          text-sm font-semibold text-primary animate-fade-in-up">
            <CheckCircle2 size={15} className="text-accent flex-shrink-0" />
            Feed paused. <span className="text-accent">Project session active.</span>
          </div>
        )}
      </div>
    </div>
  );
};
