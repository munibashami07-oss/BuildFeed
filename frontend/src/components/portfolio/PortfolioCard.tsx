import React from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Code,
  Eye,
  Github,
  Globe,
  Linkedin,
  Lock,
} from 'lucide-react';
import { PortfolioEntry } from '../../types/portfolio';

interface PortfolioCardProps {
  entry: PortfolioEntry;
  onEdit?: (entry: PortfolioEntry) => void;
  onShareLinkedIn?: (entry: PortfolioEntry) => void;
}

export const PortfolioCard: React.FC<PortfolioCardProps> = ({ entry, onEdit, onShareLinkedIn }) => {
  const completedAt = entry.completed_at
    ? new Date(entry.completed_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const completedSteps = entry.steps.filter((s) => s.is_completed).length;

  return (
    <div className="editorial-card p-5 sm:p-6 flex flex-col gap-4 group hover:border-accent/30 transition-all duration-200">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={11} />
              Completed
            </span>
            {entry.difficulty_level && (
              <span className="text-[10px] font-medium text-secondary bg-surface px-2 py-0.5 rounded border border-borderPaper">
                {entry.difficulty_level}
              </span>
            )}
            {/* Public / private indicator */}
            {entry.is_public ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <Eye size={10} /> Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary">
                <Lock size={10} /> Private
              </span>
            )}
          </div>

          <h3 className="font-heading text-base font-bold text-primary leading-snug line-clamp-2 group-hover:text-accent transition-colors duration-150">
            {entry.title}
          </h3>
        </div>

        {onEdit && (
          <button
            onClick={() => onEdit(entry)}
            className="flex-shrink-0 text-xs font-medium text-secondary hover:text-accent border border-borderPaper hover:border-accent/40 px-2.5 py-1 rounded-md transition-all duration-150 bg-surface"
          >
            Edit
          </button>
        )}
      </div>

      {/* Objective / summary */}
      {(entry.portfolio_summary || entry.objective) && (
        <p className="text-xs text-secondary leading-relaxed line-clamp-3">
          {entry.portfolio_summary || entry.objective}
        </p>
      )}

      {/* Tech stack */}
      {entry.technologies.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Code size={12} className="text-accent flex-shrink-0" />
          {entry.technologies.slice(0, 5).map((tech) => (
            <span key={tech} className="px-2 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent border border-accent/20">
              {tech}
            </span>
          ))}
          {entry.technologies.length > 5 && (
            <span className="text-[10px] text-secondary">+{entry.technologies.length - 5} more</span>
          )}
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[10px] text-secondary flex-wrap border-t border-borderPaper pt-3">
        <span className="flex items-center gap-1">
          <CheckCircle2 size={11} className="text-emerald-500" />
          {completedSteps} of {entry.steps.length} milestones
        </span>
        {completedAt && (
          <span className="flex items-center gap-1">
            <Calendar size={11} /> {completedAt}
          </span>
        )}
      </div>

      {/* Links row */}
      <div className="flex items-center gap-2 flex-wrap">
        {entry.github_url && (
          <a href={entry.github_url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-primary border border-borderPaper hover:border-primary px-2.5 py-1 rounded-md transition-all duration-150 bg-surface">
            <Github size={13} /> GitHub
          </a>
        )}
        {entry.demo_url && (
          <a href={entry.demo_url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-accent border border-borderPaper hover:border-accent/40 px-2.5 py-1 rounded-md transition-all duration-150 bg-surface">
            <Globe size={13} /> Live Demo
          </a>
        )}

        {onShareLinkedIn && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShareLinkedIn(entry);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0A66C2] hover:text-white border border-[#0A66C2]/30 hover:bg-[#0A66C2] px-2.5 py-1 rounded-md transition-all duration-150 bg-[#0A66C2]/5"
          >
            <Linkedin size={13} /> Post on LinkedIn
          </button>
        )}

        <Link to={`/portfolio/${entry.project_id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accentHover ml-auto">
          Manage <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
};