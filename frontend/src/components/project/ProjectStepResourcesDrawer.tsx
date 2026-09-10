import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  Lightbulb,
  Layers,
  Code,
  Package,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Flame,
} from 'lucide-react';
import { projectApi, StepResourceGuide } from '../../services/api/projectApi';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';

interface ProjectStepResourcesDrawerProps {
  projectId: string;
  projectTitle: string;
  stepId: string;
  stepTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectStepResourcesDrawer: React.FC<ProjectStepResourcesDrawerProps> = ({
  projectId,
  projectTitle,
  stepId,
  stepTitle,
  isOpen,
  onClose,
}) => {
  const [guide, setGuide] = useState<StepResourceGuide | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'resources' | 'tips'>('all');

  const loadResources = useCallback(async () => {
    if (!projectId || !stepId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await projectApi.getStepResources(projectId, stepId);
      setGuide(data);
    } catch (err: any) {
      console.error('Failed to load step resources:', err);
      setError(err?.response?.data?.detail || 'Could not fetch step guides and resources. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, stepId]);

  useEffect(() => {
    if (isOpen) {
      loadResources();
    }
  }, [isOpen, loadResources]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-paper shadow-2xl flex flex-col border-l border-borderPaper">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-borderPaper bg-surface/80 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                  <Sparkles size={13} />
                  JIT Milestone Discovery
                </span>
                {guide?.phase && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <Layers size={13} />
                    {guide.phase}
                  </span>
                )}
              </div>

              <h2 className="font-heading text-xl font-bold text-primary truncate">
                {stepTitle}
              </h2>
              <p className="text-xs text-secondary mt-0.5 truncate">
                Workspace: {projectTitle}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadResources}
                title="Refresh recommendations"
                disabled={isLoading}
              >
                <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
              </Button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-secondary hover:text-primary hover:bg-borderPaper/50 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {isLoading ? (
              <div className="py-20 text-center">
                <Loader2 size={36} className="animate-spin text-accent mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-primary mb-1">
                  Synthesizing Milestone Guides...
                </h3>
                <p className="text-xs text-secondary max-w-sm mx-auto">
                  AI is analyzing this step's engineering invariants, querying tailored tutorials, and extracting failure modes.
                </p>
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <Alert type="error" message={error} className="mb-4" />
                <Button variant="secondary" size="sm" onClick={loadResources}>
                  <RotateCcw size={14} className="mr-1.5" />
                  Retry Discovery
                </Button>
              </div>
            ) : guide ? (
              <>
                {/* Key Concepts Tags */}
                {guide.key_concepts && guide.key_concepts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 mb-2.5">
                      <Lightbulb size={14} className="text-amber-500" />
                      Core Engineering Concepts
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {guide.key_concepts.map((concept, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-borderPaper text-primary shadow-xs"
                        >
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Implementation Tips */}
                {guide.implementation_tips && guide.implementation_tips.length > 0 && (
                  <div className="p-4 rounded-xl border border-borderPaper bg-surface space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Code size={14} className="text-accent" />
                      Actionable Implementation Tips
                    </h4>
                    <ul className="space-y-2.5 text-xs text-secondary">
                      {guide.implementation_tips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2 leading-relaxed">
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-primary">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Common Pitfalls & Gotchas */}
                {guide.common_pitfalls && guide.common_pitfalls.length > 0 && (
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-500" />
                      Common Pitfalls & Runtime Nuances
                    </h4>
                    <ul className="space-y-2 text-xs text-secondary">
                      {guide.common_pitfalls.map((pitfall, idx) => (
                        <li key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-amber-500 font-bold shrink-0">•</span>
                          <span>{pitfall}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommended Libraries / Tools */}
                {guide.recommended_libraries && guide.recommended_libraries.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 mb-2.5">
                      <Package size={14} className="text-accent" />
                      Recommended Packages & Tools
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {guide.recommended_libraries.map((lib, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-accent/10 text-accent border border-accent/20"
                        >
                          {lib}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Curated Resources */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 mb-3">
                    <BookOpen size={14} className="text-accent" />
                    Targeted Step Resources & Repositories ({guide.resources.length})
                  </h4>

                  {guide.resources.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-borderPaper text-center text-xs text-secondary">
                      No external resources returned for this step. Use the implementation guidance above!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {guide.resources.map((res, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border border-borderPaper bg-surface hover:border-accent/40 transition-all duration-150 space-y-2.5 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/15">
                                  {res.content_type}
                                </span>
                                {res.source_name && (
                                  <span className="text-[10px] text-secondary">
                                    {res.source_name}
                                  </span>
                                )}
                                {res.difficulty_level && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-borderPaper text-secondary font-medium">
                                    {res.difficulty_level}
                                  </span>
                                )}
                              </div>
                              <h5 className="font-heading text-sm font-bold text-primary leading-snug">
                                {res.title}
                              </h5>
                            </div>

                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-accent/10 hover:bg-accent hover:text-white text-accent transition-colors shrink-0"
                              title="Open Resource"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>

                          {res.short_summary && (
                            <p className="text-xs text-secondary leading-relaxed">
                              {res.short_summary}
                            </p>
                          )}

                          {res.relevance_reason && (
                            <div className="p-2.5 rounded-lg bg-paper border border-borderPaper text-[11px] text-primary leading-relaxed flex items-start gap-1.5">
                              <Sparkles size={12} className="text-accent shrink-0 mt-0.5" />
                              <div>
                                <strong className="font-semibold text-accent">Why this helps: </strong>
                                {res.relevance_reason}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-borderPaper bg-surface flex items-center justify-between gap-3">
            <span className="text-[11px] text-secondary">
              Just-In-Time guidance calibrated to your tech stack and proficiency.
            </span>
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
