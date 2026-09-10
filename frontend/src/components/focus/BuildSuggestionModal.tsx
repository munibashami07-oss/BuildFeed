import React, { useEffect, useState } from 'react';
import {
  X,
  Hammer,
  Github,
  Loader2,
  RefreshCw,
  ListChecks,
  Code,
  GraduationCap,
  Wrench,
  Rocket,
  AlertCircle,
} from 'lucide-react';
import { focusApi, ProjectSuggestionResponse } from '../../services/api/focusApi';
import { projectApi, ProjectItem } from '../../services/api/projectApi';
import { Button } from '../ui/Button';

interface BuildSuggestionModalProps {
  itemId: string;
  githubUsername?: string | null;
  onClose: () => void;
  onBuilt: (project: ProjectItem) => void;
  onNeedsGithubAuth: () => void;
}

/** Small badge explaining what kind of content this was, matched to the AI's classification. */
const ClassificationBanner: React.FC<{ suggestion: ProjectSuggestionResponse }> = ({ suggestion }) => {
  const config = {
    learning_resource: {
      icon: GraduationCap,
      label: 'Learning material — here is a project idea inspired by it',
      classes: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    },
    tool_or_library: {
      icon: Wrench,
      label: 'Tool / library — here is how to use it in a project',
      classes: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    },
    project_idea: {
      icon: Rocket,
      label: 'This is already a project idea',
      classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    },
  } as const;

  const c = config[suggestion.content_classification] || config.project_idea;
  const Icon = c.icon;

  return (
    <div className={`rounded-lg border px-3 py-2.5 mb-4 ${c.classes}`}>
      <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
        <Icon size={14} />
        <span>{c.label}</span>
      </div>
      {suggestion.classification_note && (
        <p className="text-xs leading-relaxed opacity-90">{suggestion.classification_note}</p>
      )}
      {suggestion.usage_note && (
        <p className="text-xs leading-relaxed opacity-90 mt-1">
          <strong>How to use it: </strong>
          {suggestion.usage_note}
        </p>
      )}
    </div>
  );
};

export const BuildSuggestionModal: React.FC<BuildSuggestionModalProps> = ({
  itemId,
  githubUsername,
  onClose,
  onBuilt,
  onNeedsGithubAuth,
}) => {
  const [suggestion, setSuggestion] = useState<ProjectSuggestionResponse | null>(null);
  const [seenTitles, setSeenTitles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stage, setStage] = useState<'preview' | 'github-choice'>('preview');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuggestion = async (excludeTitles?: string[]) => {
    try {
      const res = await focusApi.suggestProject(itemId, excludeTitles);
      setSuggestion(res);
      setSeenTitles((prev) => (prev.includes(res.project_title) ? prev : [...prev, res.project_title]));
    } catch (err: any) {
      console.error('Failed to generate project suggestion:', err);
      setError(err?.response?.data?.detail || 'Could not generate a project suggestion. Please try again.');
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadSuggestion().finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setError(null);
    await loadSuggestion(seenTitles);
    setIsRefreshing(false);
  };

  const createFromSuggestion = async (withGithub: boolean) => {
    if (!suggestion || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      if (withGithub && !githubUsername) {
        onNeedsGithubAuth();
        return;
      }
      const project = await projectApi.createProject(
        {
          title: suggestion.project_title,
          objective: suggestion.objective,
          description: `${suggestion.what_you_are_building}\n\n${suggestion.description}`,
          technologies: suggestion.technologies,
          steps: suggestion.basic_steps,
          content_item_id: itemId,
        },
        withGithub
      );
      onBuilt(project);
    } catch (err: any) {
      console.error('Failed to create project from suggestion:', err);
      setError(err?.response?.data?.detail || 'Could not start the project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
      <div className="w-full max-w-lg bg-surface rounded-2xl p-6 border border-borderPaper shadow-elevated relative max-h-[85vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-secondary hover:bg-paper"
        >
          <X size={18} />
        </button>

        <div className="w-11 h-11 rounded-xl bg-accentLight text-accent flex items-center justify-center mb-4">
          <Hammer size={22} />
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 size={26} className="animate-spin text-accent mx-auto mb-3" />
            <p className="text-sm font-semibold text-primary">Analyzing this content...</p>
            <p className="text-xs text-secondary mt-1">Figuring out if it's a project, a tool, or learning material</p>
          </div>
        ) : !suggestion ? (
          <div className="py-8 text-center">
            <AlertCircle size={24} className="text-red-500 mx-auto mb-2" />
            <p className="text-sm text-secondary">{error || 'Something went wrong.'}</p>
          </div>
        ) : stage === 'preview' ? (
          <div>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h2 className="font-heading text-xl font-bold text-primary">{suggestion.project_title}</h2>
            </div>

            {suggestion.what_you_are_building && (
              <div className="rounded-lg bg-paper border border-borderPaper px-3 py-2.5 mb-3">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wide mb-0.5">What you're building</p>
                <p className="text-xs text-secondary leading-relaxed">{suggestion.what_you_are_building}</p>
              </div>
            )}

            <ClassificationBanner suggestion={suggestion} />

            <p className="text-xs text-secondary leading-relaxed mb-4">
              <strong className="text-primary">Objective: </strong>
              {suggestion.objective}
            </p>

            <div className="mb-4">
              <span className="text-[11px] font-semibold text-primary block mb-1.5 flex items-center gap-1">
                <Code size={13} className="text-accent" /> Recommended Tech Stack
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {suggestion.technologies.map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <span className="text-[11px] font-semibold text-primary block mb-1.5 flex items-center gap-1">
                <ListChecks size={13} className="text-accent" /> Build Steps ({suggestion.basic_steps.length})
              </span>
              <ul className="space-y-1.5 text-xs text-secondary">
                {suggestion.basic_steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {error && <div className="mt-4 text-xs text-red-600">{error}</div>}

            <div className="flex flex-col gap-2 mt-5">
              <Button
                type="button"
                variant="accent"
                className="w-full"
                onClick={() => setStage('github-choice')}
                disabled={isRefreshing}
              >
                <Hammer size={16} className="mr-2" />
                Build This
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <RefreshCw size={16} className="mr-2" />
                )}
                Refresh Idea
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="font-heading text-xl font-bold text-primary mb-2">Ready to build this project?</h2>
            <p className="text-xs text-secondary leading-relaxed mb-5">
              Choose whether BuildFeed should create a GitHub repository for this project.
            </p>
            {error && <div className="mb-4 text-xs text-red-600">{error}</div>}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="accent"
                className="w-full"
                onClick={() => createFromSuggestion(true)}
                disabled={isCreating}
              >
                {isCreating ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Github size={16} className="mr-2" />}
                {githubUsername ? 'Build with GitHub' : 'Connect with GitHub'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => createFromSuggestion(false)}
                disabled={isCreating}
              >
                Go without GitHub
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => setStage('preview')}
                disabled={isCreating}
              >
                Back to plan
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
