import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { portfolioApi } from '../services/api/portfolioApi';
import { sharingApi } from '../services/api/sharingApi';
import { PortfolioEntry } from '../types/portfolio';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Code,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Github,
  Globe,
  Layers,
  Link2,
  Linkedin,
  Loader2,
  Lock,
  Rocket,
  Save,
  Sparkles,
  X,
} from 'lucide-react';

export const PortfolioShowcasePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const [entry, setEntry] = useState<PortfolioEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal
  const [isEditing, setIsEditing] = useState(false);
  const [editGithub, setEditGithub] = useState('');
  const [editDemo, setEditDemo] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Publishing
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // LinkedIn modal state
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [linkedInCaption, setLinkedInCaption] = useState('');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [isGeneratingLinkedIn, setIsGeneratingLinkedIn] = useState(false);
  const [linkedInError, setLinkedInError] = useState<string | null>(null);
  const [isCaptionCopied, setIsCaptionCopied] = useState(false);

  const handleOpenLinkedIn = async () => {
    if (!projectId) return;
    setShowLinkedInModal(true);
    setLinkedInCaption('');
    setLinkedInUrl('');
    setLinkedInError(null);
    setIsCaptionCopied(false);
    setIsGeneratingLinkedIn(true);
    try {
      const result = await portfolioApi.generateLinkedInPost(projectId);
      setLinkedInCaption(result.caption);
      setLinkedInUrl(result.share_url);
    } catch (err: any) {
      setLinkedInError(err?.message || 'Could not generate a LinkedIn post for this project.');
    } finally {
      setIsGeneratingLinkedIn(false);
    }
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(linkedInCaption);
      setIsCaptionCopied(true);
      setTimeout(() => setIsCaptionCopied(false), 2000);
    } catch {
      setLinkedInError('Could not copy to clipboard.');
    }
  };

  const fetchEntry = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await portfolioApi.getEntry(projectId);
      setEntry(data);
    } catch {
      setError('Portfolio entry not found or project is not completed.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchEntry(); }, [fetchEntry]);

  // ── Edit handlers ──────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!entry) return;
    setEditGithub(entry.github_url || '');
    setEditDemo(entry.demo_url || '');
    setEditSummary(entry.portfolio_summary || '');
    setSaveError(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await portfolioApi.upsertEntry(projectId, {
        github_url: editGithub.trim(),
        demo_url: editDemo.trim(),
        portfolio_summary: editSummary.trim(),
      });
      setEntry(updated);
      setIsEditing(false);
    } catch {
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Publish handlers ───────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!projectId) return;
    setIsPublishing(true);
    setPublishError(null);
    try {
      const result = await sharingApi.publish(projectId);
      setEntry((prev) =>
        prev ? { ...prev, is_public: result.is_public, share_slug: result.share_slug } : prev
      );
    } catch (err: any) {
      setPublishError(err?.response?.data?.detail || 'Failed to publish. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!projectId) return;
    setIsPublishing(true);
    setPublishError(null);
    try {
      const result = await sharingApi.unpublish(projectId);
      setEntry((prev) =>
        prev ? { ...prev, is_public: result.is_public, share_slug: result.share_slug } : prev
      );
    } catch {
      setPublishError('Failed to unpublish. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!entry?.share_slug) return;
    const url = `${window.location.origin}/p/${entry.share_slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement('input');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-paper">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
            <span className="text-xs font-medium uppercase tracking-wider text-secondary">Loading Showcase…</span>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen flex flex-col bg-paper">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12">
          <Alert type="error" title="Error" message={error || 'Project not found.'} />
          <div className="mt-6">
            <Link to="/portfolio">
              <Button variant="secondary" size="md">
                <ArrowLeft size={16} className="mr-1.5" /> Back to Portfolio
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const completedSteps = entry.steps.filter((s) => s.is_completed);
  const completedAt = entry.completed_at
    ? new Date(entry.completed_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const shareUrl = entry.share_slug ? `${window.location.origin}/p/${entry.share_slug}` : null;

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Breadcrumb */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft size={14} /> Back to Portfolio
          </Link>
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-accent border border-borderPaper hover:border-accent/40 px-3 py-1.5 rounded-md transition-all duration-150 bg-surface"
          >
            <Edit3 size={12} /> Edit Portfolio Info
          </button>
        </div>

        {/* Publish / sharing controls */}
        <div className="editorial-card p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Status indicator */}
          <div className="flex items-center gap-2 flex-1">
            {entry.is_public ? (
              <>
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Public</span>
                <span className="text-secondary text-xs hidden sm:inline">— anyone with the link can view this project</span>
              </>
            ) : (
              <>
                <Lock size={13} className="text-secondary" />
                <span className="text-sm font-medium text-secondary">Private</span>
                <span className="text-secondary text-xs hidden sm:inline">— only you can see this project</span>
              </>
            )}
          </div>

          {publishError && (
            <p className="text-xs text-red-500 font-medium">{publishError}</p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {entry.is_public && shareUrl && (
              <button
                onClick={handleCopyLink}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-150 ${
                  copySuccess
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-surface text-secondary border-borderPaper hover:border-accent/40 hover:text-accent'
                }`}
              >
                {copySuccess ? <Check size={13} /> : <Copy size={13} />}
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </button>
            )}

            {entry.is_public && shareUrl && (
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-borderPaper bg-surface text-secondary hover:text-accent hover:border-accent/40 transition-all duration-150"
              >
                <Eye size={13} /> Preview Public Page
              </a>
            )}

            <button
              onClick={handleOpenLinkedIn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#0A66C2]/30 bg-[#0A66C2]/5 text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white transition-all duration-150"
            >
              <Linkedin size={13} /> Post on LinkedIn
            </button>

            {entry.is_public ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUnpublish}
                isLoading={isPublishing}
                className="text-xs !py-1.5"
              >
                <EyeOff size={13} className="mr-1" /> Unpublish
              </Button>
            ) : (
              <Button
                variant="accent"
                size="sm"
                onClick={handlePublish}
                isLoading={isPublishing}
                className="text-xs !py-1.5"
              >
                <Rocket size={13} className="mr-1" /> Publish Project
              </Button>
            )}
          </div>
        </div>

        {/* Hero card */}
        <div className="editorial-card p-6 sm:p-10 mb-8 border-l-4 border-l-accent">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={13} /> Completed
            </span>
            {entry.difficulty_level && (
              <span className="text-xs font-medium text-secondary bg-surface px-2.5 py-0.5 rounded border border-borderPaper">
                {entry.difficulty_level}
              </span>
            )}
            {completedAt && (
              <span className="flex items-center gap-1 text-xs text-secondary">
                <Calendar size={12} /> {completedAt}
              </span>
            )}
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-primary tracking-tight mb-4">
            {entry.title}
          </h1>

          {entry.objective && (
            <p className="text-sm text-secondary leading-relaxed max-w-2xl mb-3">
              <span className="font-semibold text-primary">Objective: </span>{entry.objective}
            </p>
          )}

          {(entry.portfolio_summary || entry.description) && (
            <p className="text-sm text-primary/80 leading-relaxed max-w-2xl mb-5">
              {entry.portfolio_summary || entry.description}
            </p>
          )}

          {entry.technologies.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-6">
              <Code size={13} className="text-accent" />
              <span className="text-xs font-medium text-secondary mr-1">Tech Stack:</span>
              {entry.technologies.map((tech) => (
                <span key={tech} className="px-2.5 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                  {tech}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {entry.github_url && (
              <a href={entry.github_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity">
                <Github size={15} /> View on GitHub
              </a>
            )}
            {entry.demo_url && (
              <a href={entry.demo_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-white hover:bg-accentHover transition-colors">
                <Globe size={15} /> Live Demo
              </a>
            )}
            {!entry.github_url && !entry.demo_url && (
              <button onClick={openEdit}
                className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-accent transition-colors">
                <Edit3 size={14} /> Add GitHub / Demo links
              </button>
            )}
          </div>
        </div>

        {/* Milestones */}
        <div className="editorial-card p-6 sm:p-8 mb-8">
          <h2 className="font-heading text-lg font-bold text-primary flex items-center gap-2 mb-5">
            <Layers size={18} className="text-accent" />
            Project Milestones
            <span className="ml-auto text-sm font-normal text-secondary">
              {completedSteps.length} of {entry.steps.length} completed
            </span>
          </h2>
          <div className="w-full h-2 bg-borderPaper rounded-full overflow-hidden mb-6">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${entry.progress_percent}%` }} />
          </div>
          <div className="space-y-2.5">
            {entry.steps.map((step) => (
              <div key={step.id}
                className={`flex items-start gap-3 p-3.5 rounded-lg border ${
                  step.is_completed ? 'bg-surface/50 border-borderPaper/60' : 'bg-surface border-borderPaper'
                }`}>
                <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5 ${
                  step.is_completed ? 'bg-emerald-500 text-white' : 'border-2 border-borderPaper'
                }`}>
                  {step.is_completed && <Check size={12} strokeWidth={3} />}
                </div>
                <div className="flex-1">
                  <span className={`text-sm font-medium ${step.is_completed ? 'text-secondary line-through' : 'text-primary'}`}>
                    {step.title}
                  </span>
                  {step.completed_at && (
                    <span className="text-[10px] text-secondary block mt-0.5">
                      {new Date(step.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source content */}
        {entry.content_item_title && (
          <div className="editorial-card p-5 sm:p-6">
            <h3 className="font-heading text-sm font-bold text-primary mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-accent" /> Inspired by
            </h3>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-secondary">{entry.content_item_title}</p>
              {entry.content_item_url && (
                <a href={entry.content_item_url} target="_blank" rel="noopener noreferrer"
                  className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-accent hover:text-accentHover">
                  View Source <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="editorial-card p-6 sm:p-8 max-w-lg w-full bg-paper shadow-2xl relative">
            <button onClick={() => setIsEditing(false)}
              className="absolute top-4 right-4 p-1 text-secondary hover:text-primary rounded-full">
              <X size={18} />
            </button>
            <h2 className="font-heading text-xl font-bold text-primary mb-1">Portfolio Details</h2>
            <p className="text-secondary text-xs mb-5">Add links and a description for your portfolio entry.</p>

            {saveError && <Alert type="error" message={saveError} className="mb-4" onDismiss={() => setSaveError(null)} />}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-primary mb-1 flex items-center gap-1.5">
                  <Github size={13} /> GitHub Repository URL
                </label>
                <input type="url" value={editGithub} onChange={(e) => setEditGithub(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-primary mb-1 flex items-center gap-1.5">
                  <Globe size={13} /> Live Demo URL
                </label>
                <input type="url" value={editDemo} onChange={(e) => setEditDemo(e.target.value)}
                  placeholder="https://myproject.vercel.app"
                  className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-primary mb-1">Portfolio Summary</label>
                <textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)}
                  rows={4} placeholder="Describe what you built and what you learned…"
                  className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent resize-none"
                  maxLength={1000} />
                <p className="text-[10px] text-secondary mt-1 text-right">{editSummary.length}/1000</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-borderPaper">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button type="submit" variant="accent" size="sm" isLoading={isSaving}>
                  <Save size={14} className="mr-1.5" /> Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LinkedIn Share Modal */}
      {showLinkedInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="editorial-card p-6 sm:p-8 max-w-lg w-full bg-paper shadow-2xl relative">
            <button
              onClick={() => setShowLinkedInModal(false)}
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
              {entry.title}
            </p>

            {linkedInError && (
              <Alert type="error" message={linkedInError} className="mb-4" onDismiss={() => setLinkedInError(null)} />
            )}

            {isGeneratingLinkedIn ? (
              <div className="py-10 text-center">
                <Loader2 size={24} className="animate-spin text-accent mx-auto mb-2" />
                <span className="text-xs text-secondary">Writing your post…</span>
              </div>
            ) : linkedInCaption ? (
              <>
                <div className="space-y-1.5 mb-4">
                  <label className="block text-xs font-semibold text-primary">
                    AI-generated caption
                  </label>
                  <textarea
                    value={linkedInCaption}
                    onChange={(e) => setLinkedInCaption(e.target.value)}
                    rows={9}
                    className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent resize-none"
                  />
                  <p className="text-[10px] text-secondary">
                    Feel free to tweak it — then copy it and paste it into LinkedIn's post box.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-borderPaper">
                  <Button type="button" variant="secondary" size="sm" onClick={handleCopyCaption}>
                    {isCaptionCopied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
                    {isCaptionCopied ? 'Copied!' : 'Copy Caption'}
                  </Button>
                  <Button type="button" variant="accent" size="sm" onClick={() => window.open(linkedInUrl, '_blank', 'noopener,noreferrer')}>
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
  );
};