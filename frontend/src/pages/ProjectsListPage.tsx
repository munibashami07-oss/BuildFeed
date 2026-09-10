import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { projectApi, ProjectItem } from '../services/api/projectApi';
import { portfolioApi } from '../services/api/portfolioApi';
import { savedApi } from '../services/api/savedApi';
import {
  Code,
  Copy,
  ExternalLink,
  FolderGit2,
  Linkedin,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  Trash2,
  Loader2,
  Filter,
  Check,
  X,
  GraduationCap,
} from 'lucide-react';
import { ProjectLearningQuizModal } from '../components/project/ProjectLearningQuizModal';

export const ProjectsListPage: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [inProgressCount, setInProgressCount] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [hasSavedItems, setHasSavedItems] = useState<boolean>(false);

  // LinkedIn Share modal state
  const [shareProject, setShareProject] = useState<ProjectItem | null>(null);
  const [shareCaption, setShareCaption] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Learning Quiz modal state
  const [quizProject, setQuizProject] = useState<ProjectItem | null>(null);

  const handleOpenLinkedIn = async (project: ProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setShareProject(project);
    setShareCaption('');
    setShareUrl('');
    setShareError(null);
    setIsCopied(false);
    setIsGeneratingShare(true);
    try {
      const result = await portfolioApi.generateLinkedInPost(project.id);
      setShareCaption(result.caption);
      setShareUrl(result.share_url);
    } catch (err: any) {
      setShareError(err?.message || 'Could not generate a LinkedIn post for this project.');
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const closeShare = () => {
    setShareProject(null);
    setShareError(null);
    setIsCopied(false);
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(shareCaption);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setShareError('Could not copy to clipboard.');
    }
  };

  const fetchProjects = useCallback(async (status: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectsRes, savedIds] = await Promise.all([
        projectApi.getProjects(status),
        savedApi.getSavedItemIds().catch(() => [] as string[]),
      ]);
      setProjects(projectsRes.projects || []);
      setInProgressCount(projectsRes.in_progress_count || 0);
      setCompletedCount(projectsRes.completed_count || 0);
      setHasSavedItems(savedIds.length > 0);
    } catch (err: any) {
      console.error('Failed to load projects:', err);
      setError(err?.response?.data?.detail || 'Could not load your projects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects(statusFilter);
  }, [statusFilter, fetchProjects]);

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project workspace?')) return;
    try {
      await projectApi.deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleMarkComplete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { project: updated } = await projectApi.completeProject(projectId);
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
      setQuizProject(updated);
    } catch (err) {
      console.error('Failed to complete project:', err);
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
                <FolderGit2 size={14} />
                Builder Workspaces
              </div>

              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-primary tracking-tight">
                Projects, @{user?.username}
              </h1>

              <p className="text-sm text-secondary mt-1 max-w-xl">
                Track your active technical builds, milestone steps, and completed project portfolio.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/saved">
                <Button variant="accent" size="sm">
                  <Plus size={15} className="mr-1.5" />
                  <span>New Project from Saved</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center justify-between gap-3 mb-6 pb-2 border-b border-borderPaper">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-secondary hidden sm:inline" />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-surface text-secondary hover:text-primary border border-borderPaper'
                }`}
              >
                All ({inProgressCount + completedCount})
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer ${
                  statusFilter === 'in_progress'
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-surface text-secondary hover:text-primary border border-borderPaper'
                }`}
              >
                In Progress ({inProgressCount})
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer ${
                  statusFilter === 'completed'
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-surface text-secondary hover:text-primary border border-borderPaper'
                }`}
              >
                Completed ({completedCount})
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6">
            <Alert type="error" title="Projects Error" message={error} />
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 size={28} className="animate-spin text-accent mx-auto mb-2" />
            <span className="text-xs text-secondary">Loading project workspaces...</span>
          </div>
        ) : projects.length > 0 ? (
          /* Projects Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project) => {
              const isDone = project.status === 'completed';
              const completedSteps = project.steps.filter((s) => s.is_completed).length;

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="editorial-card p-6 flex flex-col justify-between hover:border-cardHoverBorder transition-all duration-200 cursor-pointer group"
                >
                  <div>
                    {/* Header badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {isDone ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {isDone ? 'Completed' : 'In Progress'}
                      </span>

                      {project.difficulty_level && (
                        <span className="text-[11px] font-medium text-secondary bg-surface px-2 py-0.5 rounded border border-borderPaper">
                          {project.difficulty_level}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-heading text-xl font-bold text-primary group-hover:text-accent transition-colors duration-150 leading-snug mb-2">
                      {project.title}
                    </h3>

                    {/* Objective / Description */}
                    {project.objective && (
                      <p className="text-xs text-secondary line-clamp-2 leading-relaxed mb-4">
                        {project.objective}
                      </p>
                    )}

                    {/* Tech stack */}
                    {project.technologies && project.technologies.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mb-4">
                        {project.technologies.slice(0, 4).map((tech) => (
                          <span
                            key={tech}
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-accent/5 text-accent border border-accent/15"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Progress & Action Footer */}
                  <div className="pt-4 border-t border-borderPaper mt-2">
                    <div className="flex items-center justify-between text-xs text-secondary mb-1.5">
                      <span className="font-medium">
                        Progress: <strong className="text-primary">{project.progress_percent}%</strong>
                      </span>
                      <span>
                        {completedSteps} / {project.steps.length} steps
                      </span>
                    </div>

                    <div className="w-full bg-borderPaper h-1.5 rounded-full overflow-hidden mb-4">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isDone ? 'bg-emerald-500' : 'bg-accent'
                        }`}
                        style={{ width: `${project.progress_percent}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="secondary" size="sm" className="!py-1 text-xs">
                          <span>Open Workspace</span>
                          <ArrowRight size={13} className="ml-1" />
                        </Button>

                        {isDone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuizProject(project);
                            }}
                            title="Take Deep Learning Quiz"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white transition-all duration-150 shadow-sm"
                          >
                            <GraduationCap size={13} />
                            <span>What did you learn? (AI Quiz)</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleOpenLinkedIn(project, e)}
                          title="Post on LinkedIn"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-[#0A66C2]/30 bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white transition-all duration-150"
                        >
                          <Linkedin size={13} />
                          <span>Post on LinkedIn</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {!isDone && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkComplete(project.id, e)}
                            title="Mark Complete"
                            className="p-1.5 rounded text-secondary hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          title="Delete Project"
                          className="p-1.5 rounded text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          !error && (
            <div className="editorial-card p-12 text-center my-6">
              <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center mx-auto mb-4">
                <FolderGit2 size={24} />
              </div>
              <h2 className="font-heading text-2xl font-bold text-primary mb-2">No Projects Found</h2>
              <p className="text-secondary text-sm max-w-md mx-auto mb-6 leading-relaxed">
                {hasSavedItems
                  ? 'You have saved ideas ready to build. Pick one and hit "Build This" to turn it into a project workspace.'
                  : 'Save something from your feed first, then come back here and choose it to generate an actionable builder workspace.'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link to="/saved">
                  <Button variant="accent" size="md">
                    {hasSavedItems ? 'Choose from Saved Ideas' : 'Explore Saved Collection'}
                  </Button>
                </Link>
              </div>
            </div>
          )
        )}
      </main>

      {/* LinkedIn Share Modal */}
      {shareProject && (
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
              {shareProject.title}
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
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-borderPaper">
                  <Button type="button" variant="secondary" size="sm" onClick={handleCopyCaption}>
                    {isCopied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
                    {isCopied ? 'Copied!' : 'Copy Caption'}
                  </Button>
                  <Button type="button" variant="accent" size="sm" onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink size={14} className="mr-1.5" />
                    Open LinkedIn
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Learning Quiz Modal */}
      {quizProject && (
        <ProjectLearningQuizModal
          projectId={quizProject.id}
          projectTitle={quizProject.title}
          isOpen={!!quizProject}
          onClose={() => setQuizProject(null)}
        />
      )}

      <Footer />
      </div>
    </div>
  );
};