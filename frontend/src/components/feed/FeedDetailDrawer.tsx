import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  GraduationCap,
  Hammer,
  ShieldCheck,
  ThumbsUp,
  Play,
  Github,
  Youtube,
  FileText,
  Loader2,
  Layers,
  Code2,
} from 'lucide-react';
import { FeedItem } from '../../services/api/feedApi';
import { savedApi } from '../../services/api/savedApi';
import { focusApi } from '../../services/api/focusApi';
import { projectApi, ProjectItem } from '../../services/api/projectApi';
import { Button } from '../ui/Button';
import { useAuth } from '../../features/auth/AuthContext';
import { BuildSuggestionModal } from '../focus/BuildSuggestionModal';

interface FeedDetailDrawerProps {
  item: FeedItem | null;
  isOpen: boolean;
  onClose: () => void;
  isSaved?: boolean;
  onToggleSave?: (itemId: string, newSavedState: boolean) => void;
  onConsume?: (itemId: string) => void;
}

export const FeedDetailDrawer: React.FC<FeedDetailDrawerProps> = ({
  item,
  isOpen,
  onClose,
  isSaved = false,
  onToggleSave,
  onConsume,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saved, setSaved] = useState<boolean>(isSaved);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [showBuildChoice, setShowBuildChoice] = useState<boolean>(false);
  const [isChoosingBuild, setIsChoosingBuild] = useState<boolean>(false);

  // Sync saved state when item changes
  React.useEffect(() => {
    setSaved(isSaved);
  }, [isSaved, item?.id]);

  if (!isOpen || !item) return null;

  const handleSaveToggle = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const targetState = !saved;
    try {
      if (targetState) {
        await savedApi.saveItem(item.id);
      } else {
        await savedApi.unsaveItem(item.id);
      }
      setSaved(targetState);
      if (onToggleSave) onToggleSave(item.id, targetState);
    } catch (err) {
      console.error('Failed to toggle save state in drawer:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenSource = async () => {
    try {
      await focusApi.consumeItem(item.id);
      if (onConsume) onConsume(item.id);
    } catch (err) {
      console.error('Failed to record consumption event:', err);
    }
    window.open(item.source_url, '_blank', 'noopener,noreferrer');
  };

  const handleBuildProject = async () => {
    if (isBuilding) return;
    setBuildError(null);
    setIsBuilding(true);
    try {
      const state = await projectApi.getBuildState(item.id);
      if (state.exists && state.project) {
        navigate(`/projects/${state.project.id}`);
        return;
      }
      setShowBuildChoice(true);
    } catch (err: any) {
      console.error('Failed to check project build state:', err);
      setBuildError(err?.response?.data?.detail || 'Could not verify project state. Please try again.');
    } finally {
      setIsBuilding(false);
    }
  };

  const handleProjectBuilt = (project: ProjectItem) => {
    setShowBuildChoice(false);
    onClose();
    navigate(`/projects/${project.id}`);
  };

  const handleNeedsGithubAuth = async () => {
    try {
      const response = await projectApi.getGithubBuildAuthorizeUrl(item.id);
      window.location.assign(response.github_authorize_url);
    } catch (err: any) {
      console.error('Failed to start GitHub project build:', err);
      setBuildError(err?.response?.data?.detail || 'Could not connect GitHub.');
    }
  };

  const meta = item.ai_metadata || {};
  const summary = meta.short_summary || item.description || 'Comprehensive technical walk-through and resource details.';
  const topics = meta.topics || [];
  const technologies = meta.technologies || [];
  const skills = meta.skills || [];
  const learningValue = meta.learning_value;
  const projectPotential = meta.project_potential;
  const difficulty = meta.difficulty_level || 'Intermediate';
  const category = meta.content_category;
  const qualityScore = Math.min(99, Math.max(90, Math.floor((item.score || 0.88) * 100)));
  const formattedDate = item.published_at
    ? new Date(item.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recent';

  // Badge helpers
  const isVideo = item.content_type?.includes('video') || item.content_type?.includes('youtube') || item.source_url?.includes('youtube.com');
  const isGithub = item.content_type?.includes('github') || item.content_type?.includes('repo');

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 animate-fade-in transition-opacity"
      />

      {/* Slide-over Right Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg md:max-w-xl bg-surface border-l border-borderPaper shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-borderPaper bg-paper/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-accentLight text-accent dark:bg-accent/20">
              {item.content_type?.toUpperCase().replace('_', ' ') || 'ARTICLE'}
            </span>
            {difficulty && (
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {difficulty}
              </span>
            )}
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 ml-1">
              <ThumbsUp size={12} />
              <span>{qualityScore}% Match</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveToggle}
              disabled={isSaving}
              className="p-1.5 rounded-lg text-secondary hover:text-accent hover:bg-surface transition-colors cursor-pointer"
              title={saved ? 'Remove from Saved' : 'Save to Collection'}
            >
              {saved ? (
                <BookmarkCheck size={18} className="text-accent fill-accent" />
              ) : (
                <Bookmark size={18} />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface transition-colors cursor-pointer"
              title="Close drawer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Visual Banner */}
          {item.thumbnail_url ? (
            <div className="w-full h-52 rounded-2xl overflow-hidden bg-paper border border-borderPaper relative">
              <img
                src={item.thumbnail_url}
                alt={item.title}
                className="w-full h-full object-cover"
              />
              {isVideo && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg">
                    <Play size={22} className="fill-slate-900 ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-36 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-5 flex flex-col justify-between text-white">
              <div className="flex items-center justify-between text-xs opacity-75">
                <span className="font-mono text-[10px]">buildfeed://analysis</span>
                {isGithub ? <Github size={18} /> : isVideo ? <Youtube size={18} className="text-red-400" /> : <FileText size={18} className="text-accent" />}
              </div>
              <div className="font-mono text-xs font-semibold line-clamp-2 text-slate-200">
                {item.title}
              </div>
              <div className="text-[10px] text-slate-400">{item.author || 'BuildFeed Source'}</div>
            </div>
          )}

          {/* Title & Metadata */}
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-primary leading-snug mb-2">
              {item.title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-secondary flex-wrap">
              <span className="font-semibold text-primary">{item.author || 'Verified Creator'}</span>
              <span>•</span>
              <span>{formattedDate}</span>
              {category && (
                <>
                  <span>•</span>
                  <span className="text-accent font-medium">{category}</span>
                </>
              )}
            </div>
          </div>

          {/* AI Content Breakdown & Summary */}
          <div className="p-4 rounded-xl bg-accentLight/60 dark:bg-accent/10 border border-accent/20">
            <div className="flex items-center gap-2 mb-2 text-accent font-heading font-semibold text-sm">
              <Sparkles size={16} />
              <span>AI Content Breakdown & Overview</span>
            </div>
            <p className="text-xs sm:text-sm text-primary leading-relaxed">
              {summary}
            </p>
          </div>

          {/* Learning Value */}
          {learningValue && (
            <div className="p-4 rounded-xl bg-paper border border-borderPaper">
              <div className="flex items-center gap-2 mb-1.5 text-primary font-heading font-semibold text-sm">
                <GraduationCap size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>What You'll Learn</span>
              </div>
              <p className="text-xs sm:text-sm text-secondary leading-relaxed">
                {learningValue}
              </p>
            </div>
          )}

          {/* Project Potential */}
          {projectPotential && (
            <div className="p-4 rounded-xl bg-paper border border-borderPaper">
              <div className="flex items-center gap-2 mb-1.5 text-primary font-heading font-semibold text-sm">
                <Hammer size={16} className="text-amber-600 dark:text-amber-400" />
                <span>What You Can Build With This</span>
              </div>
              <p className="text-xs sm:text-sm text-secondary leading-relaxed">
                {projectPotential}
              </p>
            </div>
          )}

          {/* Technologies & Frameworks */}
          {technologies.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Code2 size={14} className="text-accent" />
                Technologies & Tools
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                {technologies.map((tech) => (
                  <span
                    key={tech}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-paper border border-borderPaper text-primary"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Topics & Skills */}
          {(topics.length > 0 || skills.length > 0) && (
            <div>
              <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Layers size={14} className="text-secondary" />
                Topics & Builder Skills
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[...topics, ...skills].map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface border border-borderPaper text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation Reason */}
          {item.recommendation_reason && (
            <div className="text-xs text-muted pt-2 border-t border-borderPaper flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>{item.recommendation_reason}</span>
            </div>
          )}
        </div>

        {/* Action Bar Footer */}
        <div className="p-4 sm:p-5 border-t border-borderPaper bg-paper/90 backdrop-blur-md sticky bottom-0 z-10 flex flex-col gap-2.5">
          {buildError && (
            <div className="text-xs text-red-600 mb-1">{buildError}</div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={handleBuildProject}
              disabled={isBuilding}
            >
              {isBuilding ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Hammer size={16} className="mr-1.5" />}
              <span>Build This Project</span>
            </Button>

            <Button
              variant="accent"
              size="md"
              className="flex-1"
              onClick={handleOpenSource}
            >
              <span>Visit Original Link</span>
              <ExternalLink size={15} className="ml-1.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Build Suggestion Modal: preview classification + realistic steps, refresh, then build */}
      {showBuildChoice && (
        <BuildSuggestionModal
          itemId={item.id}
          githubUsername={user?.github_username}
          onClose={() => setShowBuildChoice(false)}
          onBuilt={handleProjectBuilt}
          onNeedsGithubAuth={handleNeedsGithubAuth}
        />
      )}
    </>
  );
};
