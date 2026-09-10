import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Lock,
  Sparkles,
  Bookmark,
  CheckCircle2,
  Rocket,
  ArrowRight,
  RefreshCw,
  Code,
  ListChecks,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import { focusApi, FocusGateStatusResponse, ProjectSuggestionResponse } from '../../services/api/focusApi';
import { savedApi } from '../../services/api/savedApi';
import { projectApi } from '../../services/api/projectApi';
import { FeedItem } from '../../services/api/feedApi';
import { Button } from '../ui/Button';

interface FocusGateProps {
  status: FocusGateStatusResponse;
  onUnlock?: () => void;
}

export const FocusGate: React.FC<FocusGateProps> = ({ status, onUnlock }) => {
  const navigate = useNavigate();
  const [savedItems, setSavedItems] = useState<FeedItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ProjectSuggestionResponse | null>(null);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [isRefreshingIdea, setIsRefreshingIdea] = useState<boolean>(false);
  const [seenTitles, setSeenTitles] = useState<string[]>([]);

  useEffect(() => {
    const loadSaved = async () => {
      setIsLoadingSaved(true);
      try {
        const res = await savedApi.getSavedItems({ limit: 10 });
        const items = res.items || [];
        setSavedItems(items);
        if (items.length > 0) {
          setSelectedItemId(items[0].id);
          generateSuggestion(items[0].id);
        }
      } catch (err) {
        console.error('Failed to load saved items for Focus Gate:', err);
      } finally {
        setIsLoadingSaved(false);
      }
    };
    loadSaved();
  }, []);

  const generateSuggestion = async (itemId: string, excludeTitles?: string[]) => {
    setIsGenerating(true);
    if (!excludeTitles) setSuggestion(null);
    try {
      const res = await focusApi.suggestProject(itemId, excludeTitles);
      setSuggestion(res);
      setSeenTitles((prev) => (prev.includes(res.project_title) ? prev : [...prev, res.project_title]));
    } catch (err) {
      console.error('Failed to generate project suggestion:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setSeenTitles([]);
    generateSuggestion(itemId);
  };

  const handleRefreshIdea = async () => {
    if (!selectedItemId || isRefreshingIdea) return;
    setIsRefreshingIdea(true);
    try {
      await generateSuggestion(selectedItemId, seenTitles);
    } finally {
      setIsRefreshingIdea(false);
    }
  };

  const handleStartBuilding = async () => {
    if (!selectedItemId || isBuilding) return;
    setIsBuilding(true);
    try {
      // Create the project from the exact suggestion shown on screen (including any
      // "Refresh Idea" the user picked) instead of silently regenerating a new one,
      // so what the user reviewed is what actually gets built.
      const project = suggestion
        ? await projectApi.createProject({
            title: suggestion.project_title,
            objective: suggestion.objective,
            description: `${suggestion.what_you_are_building}\n\n${suggestion.description}`,
            technologies: suggestion.technologies,
            steps: suggestion.basic_steps,
            content_item_id: selectedItemId,
          })
        : await projectApi.createProjectFromSaved(selectedItemId);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      console.error('Failed to create project workspace:', err);
      navigate('/projects');
    } finally {
      setIsBuilding(false);
    }
  };

  const handleUnlockFeed = async () => {
    setIsUnlocking(true);
    try {
      await focusApi.unlockFeed();
      if (onUnlock) {
        onUnlock();
      }
    } catch (err) {
      console.error('Failed to unlock feed:', err);
    } finally {
      setIsUnlocking(false);
    }
  };

  const percentage = Math.min(100, Math.round((status.consumed_today / status.limit) * 100));

  return (
    <div className="editorial-card p-6 sm:p-10 mb-8 border-2 border-accent/40 shadow-xl bg-paper animate-fade-in-up">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-borderPaper">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-3">
            <Lock size={14} className="text-amber-500" />
            Focus Gate Active — Daily Limit Reached
          </div>

          <h2 className="font-heading text-3xl font-bold text-primary tracking-tight">
            Time to Build What You Discovered
          </h2>

          <p className="text-secondary text-sm mt-1 max-w-xl leading-relaxed">
            You've consumed <span className="font-bold text-accent">{status.consumed_today} of {status.limit}</span> ideas today. BuildFeed prevents endless consumption so you can focus on building!
          </p>
        </div>

        {/* Progress Counter Pill */}
        <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-surface border border-borderPaper min-w-[140px]">
          <span className="text-xs font-medium text-secondary uppercase tracking-wider">Consumed Today</span>
          <span className="font-heading text-2xl font-bold text-primary mt-0.5">
            {status.consumed_today} <span className="text-sm font-normal text-secondary">/ {status.limit}</span>
          </span>
          <div className="w-full bg-borderPaper h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-accent h-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
          </div>
        </div>
      </div>

      {/* Main Focus Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        {/* Left Column: Select Saved Idea */}
        <div className="lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-bold text-primary flex items-center gap-2">
              <Bookmark size={18} className="text-accent fill-accent/20" />
              <span>Select a Saved Idea</span>
            </h3>

            <Link to="/saved" className="text-xs font-medium text-accent hover:underline">
              View All ({savedItems.length})
            </Link>
          </div>

          {isLoadingSaved ? (
            <div className="p-8 text-center bg-surface rounded-lg border border-borderPaper">
              <Loader2 size={24} className="animate-spin text-accent mx-auto mb-2" />
              <span className="text-xs text-secondary">Loading your saved collection...</span>
            </div>
          ) : savedItems.length > 0 ? (
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {savedItems.map((item) => {
                const isSelected = selectedItemId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item.id)}
                    className={`p-3.5 rounded-lg border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'border-accent bg-accent/5 dark:bg-accent/15 shadow-sm'
                        : 'border-borderPaper bg-surface hover:border-accent/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-primary line-clamp-2 leading-snug">
                        {item.title}
                      </h4>
                      {isSelected && <CheckCircle2 size={16} className="text-accent flex-shrink-0 mt-0.5" />}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-borderPaper/40 text-secondary">
                        {item.content_type.replace('_', ' ')}
                      </span>
                      {item.ai_metadata?.difficulty_level && (
                        <span className="text-[10px] font-medium text-secondary">
                          • {item.ai_metadata.difficulty_level}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center bg-surface rounded-lg border border-borderPaper">
              <Lightbulb size={24} className="text-secondary mx-auto mb-2" />
              <p className="text-xs text-secondary mb-3">No saved items found. Save something from your feed next time!</p>
              <Link to="/saved">
                <Button variant="secondary" size="sm">Go to Saved Page</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Right Column: AI Project Suggestion Card */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-bold text-primary flex items-center gap-2">
              <Sparkles size={18} className="text-accent" />
              <span>AI Project Suggestion</span>
            </h3>
            {suggestion && !isGenerating && (
              <button
                type="button"
                onClick={handleRefreshIdea}
                disabled={isRefreshingIdea}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-50"
              >
                {isRefreshingIdea ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                <span>Refresh Idea</span>
              </button>
            )}
          </div>

          <div className="p-5 sm:p-6 rounded-lg bg-surface border border-borderPaper min-h-[320px] flex flex-col justify-between">
            {isGenerating ? (
              <div className="my-auto py-12 text-center">
                <Loader2 size={28} className="animate-spin text-accent mx-auto mb-3" />
                <p className="text-sm font-semibold text-primary">Architecting Project Suggestion...</p>
                <p className="text-xs text-secondary mt-1">Analyzing content metadata and step-by-step milestones</p>
              </div>
            ) : suggestion ? (
              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-accent/10 text-accent mb-2">
                  <span>Based on: {suggestion.based_on_item_title}</span>
                </div>

                {suggestion.classification_note && (
                  <div
                    className={`rounded-lg border px-3 py-2 mb-3 text-[11px] leading-relaxed ${
                      suggestion.content_classification === 'learning_resource'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                        : suggestion.content_classification === 'tool_or_library'
                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    <p className="font-bold mb-0.5">
                      {suggestion.content_classification === 'learning_resource'
                        ? 'Learning material — here is a project idea inspired by it'
                        : suggestion.content_classification === 'tool_or_library'
                        ? 'Tool / library — here is a project idea that uses it'
                        : 'This is already a project idea'}
                    </p>
                    <p className="opacity-90">{suggestion.classification_note}</p>
                    {suggestion.usage_note && (
                      <p className="opacity-90 mt-1">
                        <strong>How to use it: </strong>
                        {suggestion.usage_note}
                      </p>
                    )}
                  </div>
                )}

                <h4 className="font-heading text-xl font-bold text-primary mb-2">
                  {suggestion.project_title}
                </h4>

                {suggestion.what_you_are_building && (
                  <div className="rounded-lg bg-paper border border-borderPaper px-3 py-2.5 mb-3">
                    <p className="text-[11px] font-bold text-primary uppercase tracking-wide mb-0.5">What you're building</p>
                    <p className="text-xs text-secondary leading-relaxed">{suggestion.what_you_are_building}</p>
                  </div>
                )}

                <p className="text-xs text-secondary leading-relaxed mb-4">
                  <strong className="text-primary">Objective: </strong> {suggestion.objective}
                </p>

                {/* Tech Stack Pills */}
                <div className="mb-4">
                  <span className="text-[11px] font-semibold text-primary block mb-1.5 flex items-center gap-1">
                    <Code size={13} className="text-accent" /> Recommended Tech Stack
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {suggestion.technologies.map((tech) => (
                      <span key={tech} className="px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Basic Steps Checklist */}
                <div>
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
              </div>
            ) : (
              <div className="my-auto py-12 text-center text-secondary">
                <Rocket size={32} className="mx-auto mb-2 text-accent/50" />
                <p className="text-sm font-medium">Select a saved idea on the left to generate an AI project plan.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-borderPaper">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="accent"
            size="md"
            onClick={handleStartBuilding}
            disabled={!selectedItemId || isBuilding}
            className="w-full sm:w-auto"
          >
            {isBuilding ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Rocket size={16} className="mr-2" />
            )}
            <span>{isBuilding ? 'Opening Workspace...' : 'Start Building Now'}</span>
          </Button>

          <Link to="/saved" className="w-full sm:w-auto">
            <Button variant="secondary" size="md" className="w-full sm:w-auto">
              <span>View Saved Ideas</span>
              <ArrowRight size={16} className="ml-1.5" />
            </Button>
          </Link>
        </div>

        {/* Development Reset Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUnlockFeed}
          disabled={isUnlocking}
          className="text-xs text-secondary hover:text-primary !py-1"
        >
          {isUnlocking ? <Loader2 size={13} className="mr-1 animate-spin" /> : <RefreshCw size={13} className="mr-1" />}
          <span>Unlock Feed (Dev Reset)</span>
        </Button>
      </div>
    </div>
  );
};
