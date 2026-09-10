import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sharingApi } from '../services/api/sharingApi';
import { PublicProjectData } from '../types/portfolio';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Code,
  ExternalLink,
  Github,
  Globe,
  Layers,
  Linkedin,
  Loader2,
  Sparkles,
} from 'lucide-react';

export const PublicShowcasePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [project, setProject] = useState<PublicProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const fetch = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await sharingApi.getPublicProject(slug);
        if (!cancelled) setProject(data);
      } catch {
        if (!cancelled) setError('This project is not available or the link has expired.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-accent mx-auto mb-3" />
          <span className="text-xs font-medium uppercase tracking-wider text-secondary">
            Loading project…
          </span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-paper px-4 text-center">
        <div className="editorial-card p-8 max-w-md w-full">
          <h1 className="font-heading text-2xl font-bold text-primary mb-2">Project Not Found</h1>
          <p className="text-secondary text-sm mb-6">
            {error || 'This project showcase is not available.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accentHover transition-colors"
          >
            <ArrowLeft size={14} /> Go to BuildFeed
          </Link>
        </div>
      </div>
    );
  }

  const completedSteps = project.steps.filter((s) => s.is_completed);
  const completedAt = project.completed_at
    ? new Date(project.completed_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      {/* Minimal top bar — no auth navigation */}
      <header className="border-b border-borderPaper bg-surface/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="font-heading text-lg font-bold text-primary tracking-tight hover:text-accent transition-colors">
            BuildFeed
          </Link>
          <Link
            to="/register"
            className="editorial-btn-accent px-4 py-1.5 text-xs rounded-md"
          >
            Start Building
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Hero card */}
        <div className="editorial-card p-6 sm:p-10 mb-8 border-l-4 border-l-accent animate-fade-in-up">
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={13} />
              Completed on BuildFeed
            </span>
            {project.difficulty_level && (
              <span className="text-xs font-medium text-secondary bg-surface px-2.5 py-0.5 rounded border border-borderPaper">
                {project.difficulty_level}
              </span>
            )}
            {completedAt && (
              <span className="flex items-center gap-1 text-xs text-secondary">
                <Calendar size={12} />
                {completedAt}
              </span>
            )}
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-primary tracking-tight mb-4 leading-tight">
            {project.title}
          </h1>

          {project.objective && (
            <p className="text-sm text-secondary leading-relaxed max-w-2xl mb-3">
              <span className="font-semibold text-primary">Objective: </span>
              {project.objective}
            </p>
          )}

          {(project.portfolio_summary || project.description) && (
            <p className="text-sm text-primary/80 leading-relaxed max-w-2xl mb-6">
              {project.portfolio_summary || project.description}
            </p>
          )}

          {/* Tech stack */}
          {project.technologies.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-6">
              <Code size={13} className="text-accent" />
              <span className="text-xs font-medium text-secondary mr-1">Tech Stack:</span>
              {project.technologies.map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent border border-accent/20"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          {/* Links */}
          <div className="flex items-center gap-3 flex-wrap">
            {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity"
              >
                <Github size={15} />
                View on GitHub
              </a>
            )}
            {project.demo_url && (
              <a
                href={project.demo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-accent text-white hover:bg-accentHover transition-colors"
              >
                <Globe size={15} />
                Live Demo
              </a>
            )}
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-[#0A66C2]/30 bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white transition-all duration-150"
            >
              <Linkedin size={15} />
              Share on LinkedIn
            </a>
          </div>
        </div>

        {/* Milestones */}
        <div className="editorial-card p-6 sm:p-8 mb-8 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <h2 className="font-heading text-lg font-bold text-primary flex items-center gap-2 mb-4">
            <Layers size={18} className="text-accent" />
            Project Milestones
            <span className="ml-auto text-sm font-normal text-secondary">
              {completedSteps.length} / {project.steps.length} completed
            </span>
          </h2>

          {/* Progress bar */}
          <div className="w-full h-2 bg-borderPaper rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${project.progress_percent}%` }}
            />
          </div>

          <div className="space-y-2.5">
            {project.steps.map((step, i) => (
              <div
                key={step.id || i}
                className={`flex items-center gap-3 p-3.5 rounded-lg border ${
                  step.is_completed
                    ? 'bg-surface/50 border-borderPaper/60'
                    : 'bg-surface border-borderPaper'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center ${
                    step.is_completed ? 'bg-emerald-500 text-white' : 'border-2 border-borderPaper'
                  }`}
                >
                  {step.is_completed && <Check size={12} strokeWidth={3} />}
                </div>
                <span
                  className={`text-sm font-medium ${
                    step.is_completed ? 'text-secondary line-through' : 'text-primary'
                  }`}
                >
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Inspired by */}
        {project.inspired_by && (
          <div
            className="editorial-card p-5 sm:p-6 animate-fade-in-up"
            style={{ animationDelay: '120ms' }}
          >
            <h3 className="font-heading text-sm font-bold text-primary mb-1 flex items-center gap-1.5">
              <Sparkles size={14} className="text-accent" />
              Inspired by
            </h3>
            <p className="text-sm text-secondary">{project.inspired_by}</p>
          </div>
        )}

        {/* BuildFeed CTA */}
        <div
          className="mt-10 text-center animate-fade-in-up"
          style={{ animationDelay: '180ms' }}
        >
          <p className="text-sm text-secondary mb-3">
            Built with <span className="font-semibold text-primary">BuildFeed</span> — the platform that turns ideas into projects.
          </p>
          <Link
            to="/register"
            className="editorial-btn-accent px-6 py-2.5 text-sm rounded-md inline-flex items-center gap-2"
          >
            Start Building for Free
          </Link>
        </div>
      </main>

      <footer className="border-t border-borderPaper py-6 text-center">
        <p className="text-xs text-secondary">
          © {new Date().getFullYear()} BuildFeed. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
