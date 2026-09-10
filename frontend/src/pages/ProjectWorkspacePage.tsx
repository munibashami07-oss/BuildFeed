import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { projectApi, ProjectItem } from '../services/api/projectApi';
import { portfolioApi } from '../services/api/portfolioApi';
import { progressionApi } from '../services/api/progressionApi';
import { ProgressionData } from '../types/progression';
import { XPProgressBar } from '../components/dashboard/XPProgressBar';
import { ProjectLearningQuizModal } from '../components/project/ProjectLearningQuizModal';
import { ProjectStepResourcesDrawer } from '../components/project/ProjectStepResourcesDrawer';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Code,
  Copy,
  Edit3,
  ExternalLink,
  Linkedin,
  ListChecks,
  Loader2,
  Rocket,
  Sparkles,
  Trash2,
  X,
  Check,
  Github,
  GraduationCap,
  BookOpen,
  Layers,
  Lightbulb,
} from 'lucide-react';

export const ProjectWorkspacePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // XP / Progression — backed by the existing Module 12 XP system
  const [progression, setProgression] = useState<ProgressionData | null>(null);
  const [xpToast, setXpToast] = useState<{ amount: number; leveledUp: boolean; newLevel?: number | null } | null>(null);

  // Edit form fields
  const [editTitle, setEditTitle] = useState<string>('');
  const [editObjective, setEditObjective] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editTech, setEditTech] = useState<string>('');

  // LinkedIn modal state
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [linkedInCaption, setLinkedInCaption] = useState('');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [isGeneratingLinkedIn, setIsGeneratingLinkedIn] = useState(false);
  const [linkedInError, setLinkedInError] = useState<string | null>(null);
  const [isCaptionCopied, setIsCaptionCopied] = useState(false);

  // Learning quiz modal state
  const [showQuizModal, setShowQuizModal] = useState<boolean>(false);

  // Step Resources Drawer state (JIT discovery)
  const [selectedStepForResources, setSelectedStepForResources] = useState<{ id: string; title: string } | null>(null);

  const getStepPhase = (stepIndex: number, totalSteps: number): string => {
    if (totalSteps <= 1) return 'Phase 1: Architecture & Data Modeling';
    const ratio = stepIndex / Math.max(1, totalSteps - 1);
    if (ratio < 0.25) return 'Phase 1: Architecture & Data Modeling';
    if (ratio < 0.6) return 'Phase 2: Core Logic & Services';
    if (ratio < 0.85) return 'Phase 3: Integration & APIs';
    return 'Phase 4: Testing & Deployment';
  };

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

  const fetchProjectDetails = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await projectApi.getProject(projectId);
      setProject(data);
      setEditTitle(data.title);
      setEditObjective(data.objective || '');
      setEditDescription(data.description || '');
      setEditTech(data.technologies ? data.technologies.join(', ') : '');
    } catch (err: any) {
      console.error('Failed to load project workspace:', err);
      setError(err?.response?.data?.detail || 'Project workspace not found or unauthorized.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const fetchProgression = useCallback(async () => {
    try {
      const data = await progressionApi.getProgression();
      setProgression(data);
    } catch (err) {
      // Non-fatal — the workspace still works without the XP panel.
      console.error('Failed to load XP/progression snapshot:', err);
    }
  }, []);

  useEffect(() => {
    fetchProjectDetails();
    fetchProgression();
  }, [fetchProjectDetails, fetchProgression]);

  /** Apply an XP event returned by the backend to the live progression display. */
  const applyXpEvent = (xpEvent: { xp_earned: number; levelled_up: boolean; new_level: number | null; progression: ProgressionData }) => {
    setProgression(xpEvent.progression);

    // Notify the global navbar so its BUILD LEVEL updates immediately after
    // a step/project awards XP.
    window.dispatchEvent(new Event('buildfeed:progression-updated'));
    window.dispatchEvent(new Event('buildfeed:notifications-updated'));
    if (xpEvent.xp_earned > 0) {
      setXpToast({ amount: xpEvent.xp_earned, leveledUp: xpEvent.levelled_up, newLevel: xpEvent.new_level });
      window.setTimeout(() => setXpToast(null), 4000);
    }
  };

  const handleStepToggle = async (stepId: string, currentCompleted: boolean) => {
    if (!projectId || !project) return;
    const targetState = !currentCompleted;

    // Optimistic UI update (project only — XP is applied only after backend confirms)
    setProject((prev) => {
      if (!prev) return prev;
      const updatedSteps = prev.steps.map((s) =>
        s.id === stepId ? { ...s, is_completed: targetState } : s
      );
      const doneCount = updatedSteps.filter((s) => s.is_completed).length;
      const percent = Math.round((doneCount / updatedSteps.length) * 100);
      return {
        ...prev,
        steps: updatedSteps,
        progress_percent: percent,
        status: percent === 100 ? 'completed' : prev.status,
      };
    });

    try {
      const { project: updated, xp_event } = await projectApi.toggleStep(projectId, stepId, targetState);
      setProject(updated);
      // Only completing a step (not un-completing) ever carries XP, but we always
      // sync the progression snapshot returned by the backend so the display never drifts.
      applyXpEvent(xp_event);
      if (updated.status === 'completed' && project.status !== 'completed') {
        setShowQuizModal(true);
      }
    } catch (err) {
      console.error('Failed to toggle step completion:', err);
      fetchProjectDetails(); // Revert project on failure — no XP was awarded, so progression is left untouched.
    }
  };

  const handleMarkComplete = async () => {
    if (!projectId || !project) return;
    setIsSubmitting(true);
    try {
      const { project: updated, xp_event } = await projectApi.completeProject(projectId);
      setProject(updated);
      applyXpEvent(xp_event);
      setShowQuizModal(true);
    } catch (err) {
      console.error('Failed to complete project:', err);
      // Failed completion — no project/XP state changes applied.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !project) return;
    setIsSubmitting(true);
    try {
      const techArray = editTech
        ? editTech.split(',').map((t) => t.trim()).filter(Boolean)
        : [];
      const updated = await projectApi.updateProject(projectId, {
        title: editTitle,
        objective: editObjective,
        description: editDescription,
        technologies: techArray,
      });
      setProject(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update project details:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId) return;
    if (!window.confirm('Are you sure you want to delete this project workspace?')) return;
    try {
      await projectApi.deleteProject(projectId);
      navigate('/projects');
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-paper">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
            <span className="text-xs font-medium uppercase tracking-wider text-secondary">Loading Workspace...</span>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex flex-col bg-paper">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-12">
          <Alert type="error" title="Workspace Error" message={error || 'Project not found.'} />
          <div className="mt-6 text-center">
            <Link to="/projects">
              <Button variant="secondary" size="md">
                <ArrowLeft size={16} className="mr-1.5" /> Back to Projects
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isCompleted = project.status === 'completed';
  const completedStepsCount = project.steps.filter((s) => s.is_completed).length;

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link to="/projects" className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-primary transition-colors">
            <ArrowLeft size={14} />
            <span>Back to Projects</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="!py-1 text-xs">
              <Edit3 size={13} className="mr-1" /> Edit Details
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDeleteProject} className="!py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
              <Trash2 size={13} className="mr-1" /> Delete
            </Button>
          </div>
        </div>

        {/* Workspace Card Header */}
        <div className="editorial-card p-6 sm:p-8 mb-8 shadow-card border-l-4 border-l-accent">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                  isCompleted
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {isCompleted ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                {isCompleted ? 'Completed' : 'In Progress'}
              </span>

              {project.difficulty_level && (
                <span className="text-xs font-medium text-secondary bg-surface px-2.5 py-0.5 rounded border border-borderPaper">
                  {project.difficulty_level}
                </span>
              )}
            </div>

            {isCompleted ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowQuizModal(true)}
                  className="text-xs !py-1.5 border-orange-500/30 text-orange-600 hover:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-950/40"
                >
                  <GraduationCap size={13} className="mr-1.5 text-orange-500" />
                  <span>What did you learn?</span>
                </Button>
                <button
                  onClick={handleOpenLinkedIn}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#0A66C2]/30 bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white transition-all duration-150"
                >
                  <Linkedin size={13} /> Post on LinkedIn
                </button>
                <Link to={`/portfolio/${project.id}`}>
                  <Button variant="secondary" size="sm" className="text-xs !py-1.5">
                    <span>View in Portfolio</span>
                  </Button>
                </Link>
              </div>
            ) : (
              <Button variant="accent" size="sm" onClick={handleMarkComplete} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Rocket size={14} className="mr-1.5" />}
                <span>Mark Project Complete</span>
              </Button>
            )}
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-primary tracking-tight mb-3">
            {project.title}
          </h1>

          {project.github_repo_url && (
            <a
              href={project.github_repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline mb-4"
            >
              <Github size={15} />
              <span>View repo on GitHub</span>
              <ExternalLink size={12} />
            </a>
          )}

          {project.objective && (
            <p className="text-sm text-secondary leading-relaxed max-w-2xl mb-4">
              <strong className="text-primary font-semibold">Objective: </strong>
              {project.objective}
            </p>
          )}

          {/* Tech stack pills */}
          {project.technologies && project.technologies.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2">
              <span className="text-xs font-medium text-secondary mr-1 flex items-center gap-1">
                <Code size={13} className="text-accent" /> Tech Stack:
              </span>
              {project.technologies.map((tech) => (
                <span key={tech} className="px-2.5 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* XP / Progression — live display wired to the backend XP system (Module 12) */}
        {progression && (
          <div className="mb-8 relative">
            <XPProgressBar
              level={progression.level}
              levelTitle={progression.level_title}
              totalXp={progression.total_xp}
              xpInCurrentLevel={progression.xp_in_current_level}
              xpForCurrentLevelSpan={progression.xp_for_current_level_span}
              xpToNextLevel={progression.xp_to_next_level}
              levelProgressPercent={progression.level_progress_percent}
              isMaxLevel={progression.is_max_level}
            />
            {xpToast && (
              <div className="mt-3">
                <Alert
                  type="success"
                  title={xpToast.leveledUp ? `Level Up! Now Level ${xpToast.newLevel}` : 'XP Earned'}
                  message={`+${xpToast.amount} XP awarded.`}
                  onDismiss={() => setXpToast(null)}
                />
              </div>
            )}
          </div>
        )}

        {/* Progress Tracker Card */}
        <div className="editorial-card p-6 mb-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="font-heading text-lg font-bold text-primary flex items-center gap-2">
              <ListChecks size={18} className="text-accent" />
              <span>Project Milestones</span>
            </h2>

            <span className="text-sm font-semibold text-primary">
              {completedStepsCount} of {project.steps.length} completed ({project.progress_percent}%)
            </span>
          </div>

          <div className="w-full bg-borderPaper h-2.5 rounded-full overflow-hidden mb-6">
            <div
              className={`h-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-accent'}`}
              style={{ width: `${project.progress_percent}%` }}
            ></div>
          </div>

          {/* Step-by-Step Checklist */}
          <div className="space-y-3">
            {project.steps.map((step, idx) => (
              <div
                key={step.id}
                onClick={() => handleStepToggle(step.id, step.is_completed)}
                className={`p-4 rounded-lg border transition-all duration-150 cursor-pointer flex items-start justify-between gap-3.5 ${
                  step.is_completed
                    ? 'bg-surface/50 border-borderPaper/60 text-secondary'
                    : 'bg-surface border-borderPaper text-primary hover:border-accent/40 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      step.is_completed ? 'bg-emerald-500 text-white' : 'border-2 border-borderPaper text-transparent'
                    }`}
                  >
                    <Check size={14} strokeWidth={3} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        {getStepPhase(idx, project.steps.length)}
                      </span>
                    </div>

                    <span className={`text-sm font-medium leading-relaxed block ${step.is_completed ? 'line-through text-secondary' : 'text-primary'}`}>
                      {step.title}
                    </span>

                    {step.completed_at && (
                      <span className="text-[10px] text-secondary mt-0.5 block">
                        Completed {new Date(step.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStepForResources({ id: step.id, title: step.title });
                  }}
                  title="Discover Guides & Resources for this Step"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-accent/30 bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all duration-150 shrink-0"
                >
                  <Lightbulb size={13} />
                  <span className="hidden sm:inline">Step Guides</span>
                  <span className="sm:hidden">Guides</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Source Content Preview Callout */}
        {project.content_item && (
          <div className="editorial-card p-6">
            <h3 className="font-heading text-sm font-bold text-primary mb-2 flex items-center gap-1.5">
              <Sparkles size={14} className="text-accent" />
              <span>Inspired by Saved Content Item</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-2">
              <div>
                <h4 className="text-sm font-semibold text-primary mb-1">{project.content_item.title}</h4>
                <p className="text-xs text-secondary line-clamp-2">{project.content_item.description}</p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(project.content_item?.source_url, '_blank')}
                className="flex-shrink-0 !py-1 text-xs"
              >
                <span>View Source</span>
                <ExternalLink size={13} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Edit Details Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="editorial-card p-6 sm:p-8 max-w-lg w-full bg-paper shadow-2xl relative">
            <button
              onClick={() => setIsEditing(false)}
              className="absolute top-4 right-4 p-1 text-secondary hover:text-primary rounded-full"
            >
              <X size={18} />
            </button>

            <h2 className="font-heading text-2xl font-bold text-primary mb-4">Edit Project Workspace</h2>

            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-primary mb-1">Project Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1">Objective</label>
                <textarea
                  value={editObjective}
                  onChange={(e) => setEditObjective(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-primary mb-1">Technologies (comma separated)</label>
                <input
                  type="text"
                  value={editTech}
                  onChange={(e) => setEditTech(e.target.value)}
                  placeholder="Python, FastAPI, React"
                  className="w-full px-3 py-2 rounded-md bg-surface border border-borderPaper text-sm text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-borderPaper">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                  <span>Save Changes</span>
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
              {project?.title}
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

      {/* Project Learning Quiz Modal */}
      {showQuizModal && project && (
        <ProjectLearningQuizModal
          projectId={project.id}
          projectTitle={project.title}
          isOpen={showQuizModal}
          onClose={() => setShowQuizModal(false)}
        />
      )}

      {/* Project Step Resources Drawer (JIT Discovery) */}
      {selectedStepForResources && project && (
        <ProjectStepResourcesDrawer
          projectId={project.id}
          projectTitle={project.title}
          stepId={selectedStepForResources.id}
          stepTitle={selectedStepForResources.title}
          isOpen={!!selectedStepForResources}
          onClose={() => setSelectedStepForResources(null)}
        />
      )}

      <Footer />
    </div>
  );
};