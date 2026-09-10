import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { portfolioApi } from '../services/api/portfolioApi';
import { PortfolioEntry } from '../types/portfolio';
import { PortfolioCard } from '../components/portfolio/PortfolioCard';
import {
  Briefcase,
  Github,
  Globe,
  Linkedin,
  Loader2,
  Save,
  X,
  FolderGit2,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

export const PortfolioPage: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user } = useAuth();

  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [editEntry, setEditEntry] = useState<PortfolioEntry | null>(null);
  const [editGithub, setEditGithub] = useState('');
  const [editDemo, setEditDemo] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // LinkedIn share modal
  const [shareEntry, setShareEntry] = useState<PortfolioEntry | null>(null);
  const [shareCaption, setShareCaption] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await portfolioApi.getPortfolio();
      setEntries(data.entries);
    } catch {
      setError('Could not load your portfolio. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const openEdit = (entry: PortfolioEntry) => {
    setEditEntry(entry);
    setEditGithub(entry.github_url || '');
    setEditDemo(entry.demo_url || '');
    setEditSummary(entry.portfolio_summary || '');
    setSaveError(null);
    setSaveSuccess(false);
  };

  const closeEdit = () => {
    setEditEntry(null);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const openShare = async (entry: PortfolioEntry) => {
    setShareEntry(entry);
    setShareCaption('');
    setShareUrl('');
    setShareError(null);
    setIsCopied(false);
    setIsGeneratingShare(true);
    try {
      const result = await portfolioApi.generateLinkedInPost(entry.project_id);
      setShareCaption(result.caption);
      setShareUrl(result.share_url);
    } catch (err: any) {
      setShareError(err?.message || 'Could not generate a LinkedIn post for this project.');
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const closeShare = () => {
    setShareEntry(null);
    setShareError(null);
    setIsCopied(false);
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(shareCaption);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setShareError('Could not copy to clipboard — select the text and copy it manually.');
    }
  };

  const handleOpenLinkedIn = () => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEntry) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await portfolioApi.upsertEntry(editEntry.project_id, {
        github_url: editGithub.trim() || '',
        demo_url: editDemo.trim() || '',
        portfolio_summary: editSummary.trim() || '',
      });
      setEntries((prev) =>
        prev.map((e) => (e.project_id === updated.project_id ? updated : e))
      );
      setSaveSuccess(true);
      setTimeout(() => closeEdit(), 900);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save portfolio details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-paper text-primary">
      <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
      <Navbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header Banner */}
        <div className="editorial-card p-6 sm:p-8 mb-8 shadow-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 border border-accent/20 text-accent mb-3">
                <Briefcase size={14} />
                Builder Showcase
              </div>

              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-primary tracking-tight">
                Portfolio, @{user?.username}
              </h1>

              <p className="text-sm text-secondary mt-1 max-w-xl">
                {entries.length > 0
                  ? `${entries.length} completed project${entries.length > 1 ? 's' : ''} — add links and publish any of them to the public showcase.`
                  : 'Completed projects appear here automatically, ready to publish to a public showcase.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/projects">
                <Button variant="secondary" size="sm">
                  <FolderGit2 size={15} className="mr-1.5" />
                  <span>View Projects</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {!isLoading && error && (
          <div className="mb-6">
            <Alert type="error" title="Portfolio Error" message={error} />
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 size={28} className="animate-spin text-accent mx-auto mb-2" />
            <span className="text-xs text-secondary">Loading portfolio…</span>
          </div>
        ) : !error && entries.length === 0 ? (
          /* Empty State */
          <div className="py-16 text-center border border-dashed border-borderPaper rounded-lg">
            <Briefcase size={36} className="mx-auto text-secondary mb-3 opacity-40" />
            <p className="text-sm text-secondary font-medium">No completed projects yet.</p>
            <p className="text-xs text-secondary mt-1 max-w-sm mx-auto mb-5">
              Complete a project in your workspace and it'll show up here automatically, ready to add links and publish.
            </p>
            <Link to="/projects">
              <Button variant="accent" size="sm">
                <FolderGit2 size={15} className="mr-1.5" />
                Go to Projects
              </Button>
            </Link>
          </div>
        ) : !error && (
          /* Portfolio Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {entries.map((entry) => (
              <PortfolioCard key={entry.project_id} entry={entry} onEdit={openEdit} onShareLinkedIn={openShare} />
            ))}
          </div>
        )}
      </main>

      {/* Edit Links Modal */}
      {editEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="editorial-card p-6 sm:p-8 max-w-lg w-full bg-paper shadow-2xl relative">
            <button
              onClick={closeEdit}
              className="absolute top-4 right-4 p-1 text-secondary hover:text-primary rounded-full"
            >
              <X size={18} />
            </button>

            <h2 className="font-heading text-xl font-bold text-primary mb-1">
              Edit Portfolio Entry
            </h2>
            <p className="text-secondary text-xs mb-5 line-clamp-1">
              {editEntry.title}
            </p>

            {saveError && (
              <Alert type="error" message={saveError} className="mb-4" onDismiss={() => setSaveError(null)} />
            )}
            {saveSuccess && (
              <Alert type="success" message="Portfolio entry saved!" className="mb-4" />
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-primary mb-1 flex items-center gap-1.5">
                  <Github size={13} /> GitHub Repository URL
                </label>
                <input
                  type="url"
                  value={editGithub}
                  onChange={(e) => setEditGithub(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1 flex items-center gap-1.5">
                  <Globe size={13} /> Live Demo URL
                </label>
                <input
                  type="url"
                  value={editDemo}
                  onChange={(e) => setEditDemo(e.target.value)}
                  placeholder="https://myproject.vercel.app"
                  className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1">
                  Portfolio Summary
                </label>
                <textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  rows={4}
                  placeholder="Describe what you built and what you learned…"
                  className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent resize-none"
                  maxLength={1000}
                />
                <p className="text-[10px] text-secondary mt-1 text-right">
                  {editSummary.length}/1000
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-borderPaper">
                <Button type="button" variant="secondary" size="sm" onClick={closeEdit}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="sm" isLoading={isSaving}>
                  <Save size={14} className="mr-1.5" />
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LinkedIn Share Modal */}
      {shareEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="editorial-card p-6 sm:p-8 max-w-lg w-full bg-paper shadow-2xl relative">
            <button
              onClick={closeShare}
              className="absolute top-4 right-4 p-1 text-secondary hover:text-primary rounded-full"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Linkedin size={18} className="text-[#0A66C2]" />
              <h2 className="font-heading text-xl font-bold text-primary">
                Post to LinkedIn
              </h2>
            </div>
            <p className="text-secondary text-xs mb-5 line-clamp-1">
              {shareEntry.title}
            </p>

            {shareError && (
              <Alert type="error" message={shareError} className="mb-4" onDismiss={() => setShareError(null)} />
            )}

            {isGeneratingShare ? (
              <div className="py-10 text-center">
                <Loader2 size={24} className="animate-spin text-accent mx-auto mb-2" />
                <span className="text-xs text-secondary">Writing your post…</span>
              </div>
            ) : shareCaption ? (
              <>
                <div className="space-y-1.5 mb-4">
                  <label className="block text-xs font-semibold text-primary">
                    AI-generated caption
                  </label>
                  <textarea
                    value={shareCaption}
                    onChange={(e) => setShareCaption(e.target.value)}
                    rows={9}
                    className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent resize-none"
                  />
                  <p className="text-[10px] text-secondary">
                    Feel free to tweak it — then copy it and paste it into LinkedIn's post box.
                    LinkedIn doesn't allow pre-filling post text automatically, so this last step is manual.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-borderPaper">
                  <Button type="button" variant="secondary" size="sm" onClick={handleCopyCaption}>
                    {isCopied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
                    {isCopied ? 'Copied!' : 'Copy Caption'}
                  </Button>
                  <Button type="button" variant="accent" size="sm" onClick={handleOpenLinkedIn}>
                    <ExternalLink size={14} className="mr-1.5" />
                    Open LinkedIn
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <Footer />
      </div>
    </div>
  );
};