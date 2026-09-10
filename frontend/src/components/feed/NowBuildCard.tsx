/**
 * NowBuildCard — "Scroll → Build" Transition Engine  (Priority 3)
 *
 * Contextual intervention modal.  Rendered as a portal over the full page
 * after the user has scrolled through SCROLL_TRIGGER_PX of feed content.
 *
 * ─── Three dynamic states (priority order) ──────────────────────────────
 *
 *  STATE A — Active project exists
 *    "You have momentum on [Title]. Ready to apply what you just learned?"
 *    CTA: "Resume [Title] →"  (routes directly to /projects/:id)
 *
 *  STATE B — User saved ≥1 item this session
 *    "Convert [Item Title] into a project"
 *    CTA: "Quickstart Project from [Title] →"
 *    Calls focusApi.suggestProject to pre-populate the project draft,
 *    then projectApi.createProject with that draft without any extra clicks.
 *
 *  STATE C — No active projects & no session saves
 *    Starter template based on user's topic + experience level.
 *    CTA: "Start [Template Title] →"
 *
 * ─── Unchanged from previous iteration ──────────────────────────────────
 *  • Hammer icon badge, "Time to build" pill
 *  • Accent gradient top strip
 *  • X close button (top-right)
 *  • Backdrop dismiss + Escape key dismiss
 *  • Body scroll lock while open
 *  • Secondary links: Review Saved Items · Manage Feed Topics · Dismiss
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Code,
  Hammer,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { focusApi } from '../../services/api/focusApi';
import { projectApi, ProjectItem } from '../../services/api/projectApi';
import { FeedItem } from '../../services/api/feedApi';
import { Button } from '../ui/Button';

// ─────────────────────────────────────────────────────────────────────────────
// Starter templates for State C (no projects, no saves).
// Keyed loosely by user interest + experience level combination.
// Extends easily — just add more entries here.
// ─────────────────────────────────────────────────────────────────────────────
interface StarterTemplate {
  title:       string;
  objective:   string;
  technologies: string[];
  steps:       string[];
}

const STARTER_TEMPLATES: Record<string, Record<string, StarterTemplate>> = {
  cybersecurity: {
    beginner: {
      title:       'Port Scanner in Python',
      objective:   'Build a command-line tool that scans a target host for open TCP ports and reports results.',
      technologies: ['Python', 'socket', 'argparse'],
      steps: [
        'Set up a Python virtualenv and project structure',
        'Implement basic TCP socket connection for a single port',
        'Loop over a configurable port range (1–1024)',
        'Add timeout handling and error messages',
        'Format and print open/closed results to the terminal',
      ],
    },
    intermediate: {
      title:       'OWASP Vulnerability Audit Checklist',
      objective:   'Create a guided CLI tool that walks through OWASP Top 10 checks for a given web URL.',
      technologies: ['Python', 'requests', 'BeautifulSoup', 'OWASP'],
      steps: [
        'Parse the target URL and enumerate reachable pages',
        'Check for missing security headers (CSP, HSTS, X-Frame-Options)',
        'Detect common XSS injection points in form inputs',
        'Test for SQL injection patterns in URL parameters',
        'Generate a markdown audit report',
      ],
    },
    advanced: {
      title:       'Custom Metasploit Module',
      objective:   'Write a Metasploit auxiliary module in Ruby that exploits a known CVE in a test environment.',
      technologies: ['Ruby', 'Metasploit Framework', 'Kali Linux'],
      steps: [
        'Set up a local Metasploit development environment',
        'Choose a public CVE and analyse the exploit path',
        'Scaffold the module using the Msf::Auxiliary mixin',
        'Implement the run() method with target validation',
        'Test against a purposely vulnerable VM (e.g., Metasploitable)',
      ],
    },
  },
  'ai / machine learning': {
    beginner: {
      title:       'Movie Recommendation CLI',
      objective:   'Build a content-based movie recommender that suggests films based on genre similarity.',
      technologies: ['Python', 'pandas', 'scikit-learn'],
      steps: [
        'Download the MovieLens small dataset',
        'Load and inspect the CSV with pandas',
        'Build a TF-IDF genre matrix',
        'Compute cosine similarity between films',
        'Create a CLI that accepts a movie title and prints top-5 matches',
      ],
    },
    intermediate: {
      title:       'Fine-Tune BERT for Sentiment Analysis',
      objective:   'Fine-tune a pretrained BERT model on the SST-2 dataset and deploy a prediction endpoint.',
      technologies: ['Python', 'PyTorch', 'Hugging Face Transformers', 'FastAPI'],
      steps: [
        'Load the SST-2 dataset from the Hugging Face hub',
        'Tokenise inputs with BertTokenizerFast',
        'Fine-tune BertForSequenceClassification for 3 epochs',
        'Evaluate accuracy on the validation split',
        'Wrap the model in a FastAPI endpoint that accepts text input',
      ],
    },
    advanced: {
      title:       'LangGraph Autonomous Research Agent',
      objective:   'Build a multi-step autonomous agent that searches the web, summarises findings, and writes a report.',
      technologies: ['Python', 'LangGraph', 'LangChain', 'Gemini API', 'Tavily'],
      steps: [
        'Set up LangGraph and define the agent state schema',
        'Add a web-search node using the Tavily API',
        'Add a summarisation node backed by the Gemini API',
        'Wire nodes into a conditional graph with a planning loop',
        'Render the final report as a markdown document',
      ],
    },
  },
  'web development': {
    beginner: {
      title:       'Personal Link-in-Bio Page',
      objective:   'Build a responsive single-page site that showcases your projects and social links.',
      technologies: ['HTML', 'CSS', 'JavaScript'],
      steps: [
        'Create the HTML skeleton with semantic elements',
        'Style with CSS variables and a mobile-first layout',
        'Add a project card grid that reads from a JS data array',
        'Implement a dark/light theme toggle',
        'Deploy to GitHub Pages',
      ],
    },
    intermediate: {
      title:       'Full-Stack Task Manager with Auth',
      objective:   'Build a task manager with user auth, CRUD operations, and a React frontend.',
      technologies: ['React', 'TypeScript', 'FastAPI', 'PostgreSQL', 'JWT'],
      steps: [
        'Scaffold a FastAPI backend with /auth and /tasks routers',
        'Implement JWT register/login/refresh endpoints',
        'Build a React frontend with protected routes',
        'Wire up task CRUD (create, complete, delete) with optimistic UI',
        'Containerise both services with Docker Compose',
      ],
    },
    advanced: {
      title:       'Real-Time Collaborative Whiteboard',
      objective:   'Build a multi-user canvas app using WebSockets with cursor sync and shape history.',
      technologies: ['React', 'TypeScript', 'WebSocket', 'Node.js', 'Canvas API'],
      steps: [
        'Set up a Node.js WebSocket server with room management',
        'Implement a React Canvas component with mouse event drawing',
        'Broadcast cursor position and shape events to all room members',
        'Add an undo/redo stack backed by a shared event log',
        'Persist snapshots to Redis for session recovery',
      ],
    },
  },
};

// Fallback if the user's interest has no template defined
const DEFAULT_TEMPLATE: StarterTemplate = {
  title:       'Developer Portfolio Site',
  objective:   'Build a polished portfolio that showcases your projects, skills, and contact info.',
  technologies: ['React', 'TypeScript', 'Tailwind CSS'],
  steps: [
    'Scaffold the project with Vite + React + TypeScript',
    'Design a hero section and navigation bar',
    'Create a project grid with individual project cards',
    'Add an about section and skills list',
    'Deploy to Vercel or Netlify',
  ],
};

function resolveTemplate(
  interests: string[],
  experience: string,
): StarterTemplate {
  const level = (experience || 'beginner').toLowerCase() as 'beginner' | 'intermediate' | 'advanced';
  const validLevels: Array<'beginner' | 'intermediate' | 'advanced'> = ['beginner', 'intermediate', 'advanced'];
  const safeLevel = validLevels.includes(level) ? level : 'beginner';

  for (const interest of interests) {
    const key = interest.toLowerCase().trim();
    if (STARTER_TEMPLATES[key]?.[safeLevel]) {
      return STARTER_TEMPLATES[key][safeLevel];
    }
  }
  return DEFAULT_TEMPLATE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface NowBuildCardProps {
  /** Dismiss the modal (X, backdrop, Escape, or "Dismiss" link). */
  onDismiss: () => void;
  /** Items the user saved during this browsing session, most-recent first. */
  sessionSavedItems: FeedItem[];
  /** Fired when the user commits to a project action so the parent can show a toast. */
  onProjectTransition: () => void;
  /** User's selected interests (from user.interests). */
  userInterests: string[];
  /** User's experience level string. */
  userExperience: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const NowBuildCard: React.FC<NowBuildCardProps> = ({
  onDismiss,
  sessionSavedItems,
  onProjectTransition,
  userInterests,
  userExperience,
}) => {
  const navigate = useNavigate();

  // ── Modal infrastructure ─────────────────────────────────────────────────

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  // ── Data loading ──────────────────────────────────────────────────────────

  // The state machine resolves after the first fetch.
  type ModalState = 'loading' | 'state_a' | 'state_b' | 'state_c';
  const [modalState, setModalState] = useState<ModalState>('loading');
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  // For State B: the saved item we'll convert + AI-generated draft
  const [targetItem, setTargetItem] = useState<FeedItem | null>(null);
  const [draftTitle, setDraftTitle]       = useState('');
  const [draftTechs, setDraftTechs]       = useState<string[]>([]);
  const [draftSteps, setDraftSteps]       = useState<string[]>([]);
  const [draftObjective, setDraftObjective] = useState('');
  // For State C
  const [template, setTemplate] = useState<StarterTemplate | null>(null);
  // Action state
  const [isWorking, setIsWorking] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);

  // Keep track of whether a suggestion fetch is in flight so we don't fire twice
  const suggestionFetchedRef = useRef(false);

  // Resolve which state to show
  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      try {
        // 1. Check for active project (State A — highest priority)
        const res = await projectApi.getProjects('in_progress');
        if (!cancelled && res.projects.length > 0) {
          setActiveProject(res.projects[0]);
          setModalState('state_a');
          return;
        }
      } catch {
        // Silent — proceed to next check
      }

      if (cancelled) return;

      // 2. Check for session-saved items (State B)
      if (sessionSavedItems.length > 0 && !suggestionFetchedRef.current) {
        suggestionFetchedRef.current = true;
        const item = sessionSavedItems[0]; // most-recently saved
        setTargetItem(item);

        // Pre-populate draft from AI metadata while we wait for suggestion
        const meta = item.ai_metadata || {};
        const defaultTechs = meta.technologies?.slice(0, 5) ?? [];
        const itemTitle = item.title.length > 50
          ? item.title.slice(0, 47) + '…'
          : item.title;
        setDraftTitle(`Build: ${itemTitle}`);
        setDraftTechs(defaultTechs);
        setDraftObjective(meta.project_potential || `Build a project inspired by "${item.title}".`);

        // Enrich with AI-generated steps (non-blocking — update after render)
        setModalState('state_b');

        try {
          const suggestion = await focusApi.suggestProject(item.id);
          if (!cancelled) {
            setDraftTitle(suggestion.project_title);
            setDraftTechs(suggestion.technologies.slice(0, 5));
            setDraftSteps(suggestion.basic_steps.slice(0, 5));
            setDraftObjective(suggestion.objective);
          }
        } catch {
          // Use the metadata-based defaults set above — still a useful draft
        }
        return;
      }

      if (cancelled) return;

      // 3. State C — starter template
      const tmpl = resolveTemplate(userInterests, userExperience);
      if (!cancelled) {
        setTemplate(tmpl);
        setModalState('state_c');
      }
    };

    resolve();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Action handlers ───────────────────────────────────────────────────────

  const doTransition = useCallback((route: string) => {
    onProjectTransition();
    onDismiss();
    navigate(route);
  }, [onDismiss, onProjectTransition, navigate]);

  // State A: resume active project
  const handleResume = () => {
    if (activeProject) doTransition(`/projects/${activeProject.id}`);
  };

  // State B: one-click project creation from the AI-generated draft
  const handleQuickstart = async () => {
    if (isWorking) return;
    setIsWorking(true);
    setWorkError(null);
    try {
      const project = await projectApi.createProject({
        title:          draftTitle,
        objective:      draftObjective,
        technologies:   draftTechs,
        steps:          draftSteps,
        content_item_id: targetItem?.id,
      });
      onProjectTransition();
      onDismiss();
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setWorkError(err?.message || 'Could not create project. Please try again.');
      setIsWorking(false);
    }
  };

  // State C: one-click project creation from starter template
  const handleStartTemplate = async () => {
    if (!template || isWorking) return;
    setIsWorking(true);
    setWorkError(null);
    try {
      const project = await projectApi.createProject({
        title:        template.title,
        objective:    template.objective,
        technologies: template.technologies,
        steps:        template.steps,
      });
      onProjectTransition();
      onDismiss();
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setWorkError(err?.message || 'Could not create project. Please try again.');
      setIsWorking(false);
    }
  };

  // ── Derived labels ────────────────────────────────────────────────────────

  const activeLabel = activeProject
    ? activeProject.title.length > 36
      ? activeProject.title.slice(0, 33) + '…'
      : activeProject.title
    : '';

  const targetLabel = targetItem
    ? targetItem.title.length > 42
      ? targetItem.title.slice(0, 39) + '…'
      : targetItem.title
    : '';

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Time to build"
      onClick={onDismiss}
      className="
        fixed inset-0 z-[200]
        flex items-center justify-center
        bg-black/50 backdrop-blur-sm
        px-4 py-8
        animate-fade-in
      "
    >
      <div
        onClick={stopProp}
        className="
          relative w-full max-w-lg
          bg-surface rounded-2xl border-2 border-accent/30
          shadow-elevated
          p-5 sm:p-8
          animate-fade-in-up
          overflow-hidden
          max-h-[92vh] overflow-y-auto
          mx-auto
        "
      >
        {/* Accent strip */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-accent via-brand-300 to-accent/60"
        />

        {/* Close (X) button */}
        <button
          onClick={onDismiss}
          aria-label="Close"
          className="
            absolute top-4 right-4
            w-8 h-8 rounded-lg
            flex items-center justify-center
            text-muted hover:text-primary hover:bg-paper
            transition-colors duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
          "
        >
          <X size={16} strokeWidth={2} />
        </button>

        {/* ── Header (always the same) ──────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-5 pr-8">
          <div className="w-12 h-12 rounded-xl bg-accentLight text-accent flex items-center justify-center flex-shrink-0 shadow-sm">
            <Hammer size={22} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-accentLight text-accent mb-1.5">
              <Sparkles size={11} />
              Time to build
            </div>

            {/* Dynamic headline per state */}
            {modalState === 'loading' && (
              <>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-primary leading-snug">
                  You've discovered enough for now.
                </h2>
                <p className="text-secondary text-sm mt-1">Finding your best next move…</p>
              </>
            )}
            {modalState === 'state_a' && (
              <>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-primary leading-snug">
                  You have momentum on <span className="text-accent">"{activeLabel}"</span>.
                </h2>
                <p className="text-secondary text-sm mt-1 leading-relaxed">
                  Ready to apply what you just learned?
                </p>
              </>
            )}
            {modalState === 'state_b' && (
              <>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-primary leading-snug">
                  You've discovered enough for now.
                </h2>
                <p className="text-secondary text-sm mt-1 leading-relaxed">
                  Turn <span className="font-semibold text-primary">"{targetLabel}"</span> into your next project.
                </p>
              </>
            )}
            {modalState === 'state_c' && (
              <>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-primary leading-snug">
                  You've discovered enough for now.
                </h2>
                <p className="text-secondary text-sm mt-1 leading-relaxed">
                  Jump-start a project matched to your level and interests.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-borderPaper mb-5" />

        {/* ── Loading skeleton ─────────────────────────────────────────── */}
        {modalState === 'loading' && (
          <div className="flex items-center gap-3 py-2">
            <div className="w-44 h-10 rounded-xl bg-borderPaper/60 animate-pulse" />
            <div className="w-28 h-10 rounded-xl bg-borderPaper/40 animate-pulse" />
          </div>
        )}

        {/* ── State A: Active project ───────────────────────────────────── */}
        {modalState === 'state_a' && activeProject && (
          <div className="space-y-4">
            {/* Project progress context */}
            <div className="rounded-xl bg-paper border border-borderPaper p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-accentLight text-accent flex items-center justify-center flex-shrink-0">
                <Layers size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-primary truncate">{activeProject.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-borderPaper rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${Math.max(4, activeProject.progress_percent)}%` }}
                    />
                  </div>
                  <span className="text-xs text-secondary font-medium flex-shrink-0">
                    {activeProject.progress_percent}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="accent"
                size="md"
                onClick={handleResume}
                className="group flex items-center gap-2 w-full sm:w-auto"
              >
                <Layers size={16} className="flex-shrink-0" />
                <span className="truncate">Resume&nbsp;<span className="font-bold">{activeLabel}</span></span>
                <ArrowRight size={15} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => doTransition('/projects')}
                className="w-full sm:w-auto"
              >
                Start a New Project
              </Button>
            </div>
          </div>
        )}

        {/* ── State B: Convert session-saved item ──────────────────────── */}
        {modalState === 'state_b' && targetItem && (
          <div className="space-y-4">
            {/* Draft preview */}
            <div className="rounded-xl bg-paper border border-borderPaper p-4 space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Project draft
                </p>
                <p className="text-sm font-bold text-primary leading-snug">{draftTitle}</p>
                {draftObjective && (
                  <p className="text-xs text-secondary mt-1 leading-relaxed line-clamp-2">
                    {draftObjective}
                  </p>
                )}
              </div>

              {draftTechs.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1 mb-1.5">
                    <Code size={11} className="text-accent" /> Stack
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {draftTechs.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {draftSteps.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1 mb-1.5">
                    <ListChecks size={11} className="text-accent" /> Steps
                  </span>
                  <ul className="space-y-1">
                    {draftSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-secondary">
                        <span className="w-4 h-4 rounded-full bg-accent/15 text-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Shimmer while suggestion is loading */}
              {draftSteps.length === 0 && (
                <div className="space-y-1.5">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-3 bg-borderPaper/60 rounded animate-pulse" style={{ width: `${70 + n * 8}%` }} />
                  ))}
                </div>
              )}
            </div>

            {workError && (
              <p className="text-xs text-red-500 font-medium">{workError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="accent"
                size="md"
                onClick={handleQuickstart}
                disabled={isWorking}
                className="group flex items-center gap-2 w-full sm:w-auto"
              >
                {isWorking
                  ? <Loader2 size={16} className="animate-spin flex-shrink-0" />
                  : <Zap size={16} className="flex-shrink-0" />
                }
                <span>{isWorking ? 'Creating project…' : 'Quickstart Project'}</span>
                {!isWorking && (
                  <ArrowRight size={15} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
                )}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => doTransition('/projects')}
                disabled={isWorking}
                className="w-full sm:w-auto"
              >
                Browse All Projects
              </Button>
            </div>
          </div>
        )}

        {/* ── State C: Starter template ─────────────────────────────────── */}
        {modalState === 'state_c' && template && (
          <div className="space-y-4">
            <div className="rounded-xl bg-paper border border-borderPaper p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accentLight text-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Lightbulb size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-0.5">
                    Starter project
                  </p>
                  <p className="text-sm font-bold text-primary leading-snug">{template.title}</p>
                  <p className="text-xs text-secondary mt-1 leading-relaxed line-clamp-2">
                    {template.objective}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {template.technologies.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                    {t}
                  </span>
                ))}
              </div>

              <ul className="space-y-1">
                {template.steps.slice(0, 4).map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-secondary">
                    <CheckCircle2 size={13} className="text-accent/60 flex-shrink-0 mt-0.5" />
                    {step}
                  </li>
                ))}
                {template.steps.length > 4 && (
                  <li className="text-xs text-muted pl-5">+{template.steps.length - 4} more steps…</li>
                )}
              </ul>
            </div>

            {workError && (
              <p className="text-xs text-red-500 font-medium">{workError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="accent"
                size="md"
                onClick={handleStartTemplate}
                disabled={isWorking}
                className="group flex items-center gap-2 w-full sm:w-auto"
              >
                {isWorking
                  ? <Loader2 size={16} className="animate-spin flex-shrink-0" />
                  : <Hammer size={16} className="flex-shrink-0" />
                }
                <span>{isWorking ? 'Creating project…' : `Start: ${template.title}`}</span>
                {!isWorking && (
                  <ArrowRight size={15} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
                )}
              </Button>
              <Link to="/saved" onClick={onDismiss} className="w-full sm:w-auto">
                <Button variant="secondary" size="md" className="w-full flex items-center gap-2">
                  <Bookmark size={15} />
                  Create from Saved Items
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── Secondary quiet links (always shown) ─────────────────────── */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Link
            to="/saved"
            onClick={onDismiss}
            className="text-xs text-muted hover:text-secondary transition-colors inline-flex items-center gap-1"
          >
            <Bookmark size={12} />
            Review Saved Items
          </Link>
          <span className="text-borderPaper select-none hidden sm:inline">·</span>
          <Link
            to="/settings"
            onClick={onDismiss}
            className="text-xs text-muted hover:text-secondary transition-colors"
          >
            Manage Feed Topics
          </Link>
          <span className="text-borderPaper select-none hidden sm:inline">·</span>
          <button
            onClick={onDismiss}
            className="text-xs text-muted hover:text-secondary transition-colors"
          >
            Dismiss for this session
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
