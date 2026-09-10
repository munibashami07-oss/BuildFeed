import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { savedApi, externalImportApi, ExternalImportResponse } from '../services/api/savedApi';
import { projectApi } from '../services/api/projectApi';
import { FeedItem } from '../services/api/feedApi';
import { FeedCard } from '../components/feed/FeedCard';
import { FeedSkeleton } from '../components/feed/FeedSkeleton';
import { FeedDetailDrawer } from '../components/feed/FeedDetailDrawer';
import { Bookmark, Filter, ArrowLeft, Link2, Loader2, Save, FolderPlus, X, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const CONTENT_TYPES = [
  { id: '', label: 'All Saved' },
  { id: 'article', label: 'Articles' },
  { id: 'github_repo', label: 'GitHub Repos' },
  { id: 'research_paper', label: 'Research Papers' },
  { id: 'video', label: 'Videos' },
];

export const SavedPage: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showExternalImport, setShowExternalImport] = useState<boolean>(false);
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<FeedItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [externalUrl, setExternalUrl] = useState<string>('');
  const [externalResult, setExternalResult] = useState<ExternalImportResponse | null>(null);
  const [externalLoading, setExternalLoading] = useState<boolean>(false);
  const [externalSaving, setExternalSaving] = useState<boolean>(false);
  const [externalCreatingProject, setExternalCreatingProject] = useState<boolean>(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  const fetchSavedContent = useCallback(async (contentType: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const [feedRes, idsRes] = await Promise.all([
        savedApi.getSavedItems({
          content_type: contentType || undefined,
          limit: 50,
          offset: 0,
        }),
        savedApi.getSavedItemIds(),
      ]);

      setItems(feedRes.items || []);
      setSavedIds(new Set(idsRes));
    } catch (err: any) {
      console.error('Failed to load saved items:', err);
      setError(
        err?.response?.data?.detail ||
          'Could not load your saved content. Please verify backend connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedContent(selectedType);
  }, [selectedType, fetchSavedContent]);

  const handleToggleSave = (itemId: string, newSavedState: boolean) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (newSavedState) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });

    if (!newSavedState) {
      // Remove unsaved item from page list
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  const handleAnalyzeExternal = async () => {
    const url = externalUrl.trim();
    if (!url) {
      setExternalError('Paste a public URL first.');
      return;
    }
    setExternalLoading(true);
    setExternalError(null);
    setExternalResult(null);
    try {
      const result = await externalImportApi.analyze(url);
      setExternalResult(result);
    } catch (err: any) {
      setExternalError(err?.response?.data?.detail || 'Could not analyze this public URL.');
    } finally {
      setExternalLoading(false);
    }
  };

  const handleSaveExternal = async () => {
    if (!externalResult) return;
    setExternalSaving(true);
    setExternalError(null);
    try {
      await externalImportApi.save(externalResult.item_id);
      setExternalResult((prev) => (prev ? { ...prev, is_saved: true } : prev));
      await fetchSavedContent(selectedType);
    } catch (err: any) {
      setExternalError(err?.response?.data?.detail || 'Could not save this analyzed idea.');
    } finally {
      setExternalSaving(false);
    }
  };

  const handleCreateExternalProject = async () => {
    if (!externalResult || !externalResult.is_saved) return;
    setExternalCreatingProject(true);
    setExternalError(null);
    try {
      const project = await projectApi.createProjectFromSaved(externalResult.item_id);
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setExternalError(err?.response?.data?.detail || 'Could not create the project workspace.');
    } finally {
      setExternalCreatingProject(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-paper text-primary overflow-x-hidden">
      <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
      <Navbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Welcome Header */}
        <div className="editorial-card p-6 sm:p-8 mb-8 shadow-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 border border-accent/20 text-accent mb-3">
                <Bookmark size={14} className="fill-accent" />
                Saved Collection
              </div>

              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-primary tracking-tight">
                Saved Ideas, @{user?.username}
              </h1>

              <p className="text-sm text-secondary mt-1 max-w-xl">
                Your personal repository of saved tech, articles, research, and tools.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="accent" size="sm" onClick={() => { setShowExternalImport(true); setExternalError(null); }}>
                <Link2 size={14} className="mr-1.5" />
                Add External Link
              </Button>
              <Link to="/dashboard">
                <Button variant="secondary" size="sm">
                  <ArrowLeft size={14} className="mr-1.5" />
                  Back to For You
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {showExternalImport && (
          <div className="editorial-card p-6 sm:p-8 mb-8 border border-accent/20 shadow-card">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-accent/10 text-accent mb-2">
                  <Link2 size={13} />
                  External Project Import
                </div>
                <h2 className="font-heading text-2xl font-bold text-primary">Turn a public URL into a build plan</h2>
                <p className="text-sm text-secondary mt-1">Supports public GitHub, articles, Instagram, TikTok, and other public web links. Login-protected or restricted content is not bypassed.</p>
              </div>
              <button type="button" onClick={() => { setShowExternalImport(false); setExternalResult(null); setExternalError(null); }} className="p-1.5 rounded text-secondary hover:text-primary hover:bg-borderPaper/50">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyzeExternal(); }}
                placeholder="https://github.com/... or https://example.com/project"
                className="flex-1 min-w-0 rounded-lg border border-borderPaper bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:border-accent"
                disabled={externalLoading}
              />
              <Button variant="accent" size="md" onClick={handleAnalyzeExternal} disabled={externalLoading}>
                {externalLoading ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <Link2 size={15} className="mr-1.5" />}
                {externalLoading ? 'Analyzing...' : 'Analyze URL'}
              </Button>
            </div>

            {externalError && <div className="mt-4"><Alert type="error" title="External Import Error" message={externalError} /></div>}

            {externalResult && (
              <div className="mt-6 border-t border-borderPaper pt-6 space-y-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-heading text-xl font-bold text-primary">{externalResult.title}</h3>
                    {externalResult.is_saved && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={13} /> Saved</span>}
                  </div>
                  <a href={externalResult.source_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline break-all">{externalResult.source_url}</a>
                  <p className="text-sm text-secondary mt-2 leading-relaxed">{externalResult.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-borderPaper bg-surface p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-1">What the project is</p>
                    <p className="text-sm text-primary leading-relaxed">{externalResult.project_plan.what_the_project_is}</p>
                  </div>
                  <div className="rounded-lg border border-borderPaper bg-surface p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary mb-1">Difficulty / Effort</p>
                    <p className="text-sm text-primary"><strong>{externalResult.project_plan.difficulty_level}</strong> · {externalResult.project_plan.estimated_effort}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-primary mb-2">Required skills & technologies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...externalResult.project_plan.required_skills, ...externalResult.project_plan.technologies].map((value) => (
                      <span key={value} className="px-2 py-1 rounded text-[11px] font-medium bg-accent/5 text-accent border border-accent/15">{value}</span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <p className="text-sm font-semibold text-primary mb-2">Implementation plan</p>
                    <ol className="space-y-2">
                      {externalResult.project_plan.implementation_steps.map((step, index) => <li key={`${index}-${step}`} className="text-sm text-secondary"><span className="font-semibold text-accent mr-2">{index + 1}.</span>{step}</li>)}
                    </ol>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary mb-2">Suggested milestones</p>
                    <ul className="space-y-2">
                      {externalResult.project_plan.suggested_milestones.map((milestone) => <li key={milestone} className="text-sm text-secondary flex gap-2"><span className="text-accent">•</span>{milestone}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-borderPaper">
                  <Button variant="secondary" size="sm" onClick={handleSaveExternal} disabled={externalSaving || externalResult.is_saved}>
                    {externalSaving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />}
                    {externalResult.is_saved ? 'Saved' : 'Save'}
                  </Button>
                  <Button variant="accent" size="sm" onClick={handleCreateExternalProject} disabled={!externalResult.is_saved || externalCreatingProject}>
                    {externalCreatingProject ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <FolderPlus size={14} className="mr-1.5" />}
                    {externalCreatingProject ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Type Filter Bar */}
        <div className="flex items-center justify-between gap-3 mb-6 pb-2 border-b border-borderPaper overflow-x-auto">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-secondary hidden sm:inline" />
            <div className="flex items-center gap-1.5">
              {CONTENT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 whitespace-nowrap cursor-pointer ${
                    selectedType === type.id
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-surface text-secondary hover:text-primary hover:bg-borderPaper/50 border border-borderPaper'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Alert State */}
        {error && (
          <div className="mb-6">
            <Alert type="error" title="Saved Content Error" message={error} />
            <div className="mt-2 text-right">
              <Button variant="secondary" size="sm" onClick={() => fetchSavedContent(selectedType)}>
                Retry Connection
              </Button>
            </div>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading ? (
          <div>
            <FeedSkeleton />
            <FeedSkeleton />
            <FeedSkeleton />
          </div>
        ) : items.length > 0 ? (
          /* Saved Items List */
          <div className="space-y-6">
            {items.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                initialIsSaved={savedIds.has(item.id)}
                onToggleSave={handleToggleSave}
                onSelect={(selected) => {
                  setSelectedDrawerItem(selected);
                  setDrawerOpen(true);
                }}
                showBuildAction
              />
            ))}
          </div>
        ) : (
          /* Empty Saved State */
          !error && (
            <div className="editorial-card p-12 text-center my-6">
              <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center mx-auto mb-4">
                <Bookmark size={24} />
              </div>
              <h2 className="font-heading text-2xl font-bold text-primary mb-2">No Saved Ideas Yet</h2>
              <p className="text-secondary text-sm max-w-md mx-auto mb-6 leading-relaxed">
                Save something interesting from your feed and come back to it later.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link to="/dashboard">
                  <Button variant="accent" size="md">
                    Explore For You Feed
                  </Button>
                </Link>
              </div>
            </div>
          )
        )}
      </main>

      {/* Right Side Slide-Over AI Detail Drawer */}
      <FeedDetailDrawer
        item={selectedDrawerItem}
        isOpen={drawerOpen}
        isSaved={selectedDrawerItem ? savedIds.has(selectedDrawerItem.id) : false}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedDrawerItem(null);
        }}
        onToggleSave={handleToggleSave}
      />

      <Footer />
      </div>
    </div>
  );
};