import React, { useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Cpu,
  ExternalLink,
  FileText,
  Github,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Video,
  Zap,
} from 'lucide-react';
import { SearchResultItem } from '../../types/search';
import { savedApi } from '../../services/api/savedApi';

// ── Content type badge ────────────────────────────────────────────────────────
function ContentTypeBadge({ type }: { type: string }) {
  const map: Record<string, { icon: React.ReactNode; label: string; classes: string }> = {
    github_repo:     { icon: <Github size={11} />,         label: 'GitHub Repo',     classes: 'bg-stone-100 text-stone-800 border-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700' },
    research_paper:  { icon: <GraduationCap size={11} />,  label: 'Research Paper',  classes: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800' },
    ai_tool:         { icon: <Cpu size={11} />,             label: 'AI Tool',         classes: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800' },
    video:           { icon: <Video size={11} />,           label: 'Video',           classes: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800' },
    image:           { icon: <ImageIcon size={11} />,       label: 'Image',           classes: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800' },
    article:         { icon: <FileText size={11} />,        label: 'Article',         classes: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800' },
  };
  const cfg = map[type] ?? map['article'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.classes}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

interface SearchResultCardProps {
  item: SearchResultItem;
  onSaveToggle?: (itemId: string, newState: boolean) => void;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  item,
  onSaveToggle,
}) => {
  const [isSaved, setIsSaved] = useState(item.is_saved);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving) return;
    setIsSaving(true);
    const next = !isSaved;
    try {
      if (next) {
        await savedApi.saveItem(item.id);
      } else {
        await savedApi.unsaveItem(item.id);
      }
      setIsSaved(next);
      onSaveToggle?.(item.id, next);
    } catch (err) {
      console.error('Save toggle failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpen = () => {
    window.open(item.source_url, '_blank', 'noopener,noreferrer');
  };

  const summary = item.ai_metadata?.short_summary || item.description;
  const topics = item.ai_metadata?.topics?.slice(0, 4) ?? [];
  const technologies = item.ai_metadata?.technologies?.slice(0, 3) ?? [];
  const difficulty = item.ai_metadata?.difficulty_level;

  return (
    <article className="editorial-card p-5 sm:p-6 flex flex-col gap-3 animate-fade-in-up hover:border-accent/30 transition-all duration-200">
      {/* Type + interest boost badge row */}
      <div className="flex items-center gap-2 flex-wrap">
        <ContentTypeBadge type={item.content_type} />
        {item.interest_boost && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent">
            <Sparkles size={10} /> Matches your interests
          </span>
        )}
        {difficulty && (
          <span className="text-[10px] font-medium text-secondary bg-surface px-2 py-0.5 rounded border border-borderPaper">
            {difficulty}
          </span>
        )}
        {item.author && (
          <span className="text-[10px] text-secondary ml-auto truncate max-w-[140px]">
            by {item.author}
          </span>
        )}
      </div>

      {/* Title */}
      <h2
        onClick={handleOpen}
        className="font-heading text-base font-bold text-primary hover:text-accent cursor-pointer leading-snug transition-colors duration-150 line-clamp-2"
      >
        {item.title}
      </h2>

      {/* Summary */}
      {summary && (
        <p className="text-xs text-secondary leading-relaxed line-clamp-3">
          {summary}
        </p>
      )}

      {/* Topics + technologies */}
      {(topics.length > 0 || technologies.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {topics.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface border border-borderPaper text-secondary">
              #{t}
            </span>
          ))}
          {technologies.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded text-[10px] font-medium bg-accent/8 text-accent border border-accent/20">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-borderPaper flex-wrap">
        {/* Save button */}
        <button
          onClick={handleSaveToggle}
          disabled={isSaving}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all duration-150 ${
            isSaved
              ? 'bg-accent text-white border-accent'
              : 'bg-surface text-secondary border-borderPaper hover:border-accent/40 hover:text-accent'
          }`}
        >
          {isSaving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : isSaved ? (
            <BookmarkCheck size={13} />
          ) : (
            <Bookmark size={13} />
          )}
          {isSaved ? 'Saved' : 'Save'}
        </button>

        {/* Open link */}
        <button
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-surface text-secondary border border-borderPaper hover:border-accent/40 hover:text-accent transition-all duration-150"
        >
          Open <ExternalLink size={12} />
        </button>
      </div>
    </article>
  );
};
