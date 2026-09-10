import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Compass,
  Hammer,
  Layers,
  Loader2,
  Rocket,
  Search,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { achievementApi } from '../../services/api/achievementApi';
import { Achievement, AchievementCategory } from '../../types/progression';

// ── Icon resolver ─────────────────────────────────────────────────────────────
// Maps the string icon names stored in the catalog to actual lucide components
const ICON_MAP: Record<string, any> = {
  Award,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Compass,
  Hammer,
  Layers,
  Rocket,
  Search,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Zap,
};

function AchievementIcon({
  name,
  size = 20,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Component = ICON_MAP[name] ?? Trophy;
  return <Component size={size} className={className} />;
}

// ── Category label helper ─────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  building: 'Building',
  exploration: 'Exploration',
  progression: 'Progression',
};

const CATEGORY_ORDER: AchievementCategory[] = ['building', 'exploration', 'progression'];

// ── Single achievement card ───────────────────────────────────────────────────
function AchievementCard({ ach }: { ach: Achievement }) {
  const isUnlocked = ach.is_unlocked;

  return (
    <div
      className={`editorial-card p-4 flex items-start gap-3.5 transition-all duration-150 ${
        isUnlocked
          ? 'border-accent/30 bg-surface'
          : 'opacity-60 bg-surface/60'
      }`}
    >
      {/* Icon badge */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          isUnlocked
            ? 'bg-accent/15 text-accent'
            : 'bg-borderPaper/60 text-secondary'
        }`}
      >
        <AchievementIcon name={ach.icon} size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span
            className={`text-sm font-semibold leading-snug ${
              isUnlocked ? 'text-primary' : 'text-secondary'
            }`}
          >
            {ach.name}
          </span>
          {isUnlocked && (
            <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
          )}
        </div>

        <p className="text-xs text-secondary leading-relaxed mb-2">{ach.description}</p>

        {/* Progress bar */}
        {!isUnlocked && (
          <div className="mb-1.5">
            <div className="w-full h-1.5 bg-borderPaper rounded-full overflow-hidden">
              <div
                className="h-full bg-accent/60 rounded-full transition-all duration-500"
                style={{ width: `${ach.progress_percent}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-secondary">
                {ach.current_value} / {ach.threshold}
              </span>
              <span className="text-[10px] text-secondary">{ach.progress_percent}%</span>
            </div>
          </div>
        )}

        {/* Unlock date */}
        {isUnlocked && ach.unlocked_at && (
          <span className="text-[10px] text-secondary">
            Unlocked {new Date(ach.unlocked_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────
interface AchievementsSectionProps {
  /** If provided, the component skips its own fetch and uses this data.
   *  Used by ProfilePage which already fetched achievements. */
  achievements?: Achievement[];
  isLoading?: boolean;
}

export const AchievementsSection: React.FC<AchievementsSectionProps> = ({
  achievements: propAchievements,
  isLoading: propLoading,
}) => {
  const [achievements, setAchievements] = useState<Achievement[]>(propAchievements ?? []);
  const [loading, setLoading] = useState<boolean>(propLoading ?? !propAchievements);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<AchievementCategory | 'all'>('all');

  useEffect(() => {
    if (propAchievements !== undefined) {
      setAchievements(propAchievements);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await achievementApi.getAchievements();
        if (!cancelled) setAchievements(data.achievements);
      } catch {
        if (!cancelled) setError('Could not load achievements.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [propAchievements]);

  const unlockedCount = achievements.filter((a) => a.is_unlocked).length;

  const filtered =
    activeCategory === 'all'
      ? achievements
      : achievements.filter((a) => a.category === activeCategory);

  if (loading) {
    return (
      <div className="editorial-card p-6 flex items-center justify-center gap-2 text-secondary">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading achievements…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editorial-card p-6 text-sm text-secondary text-center">{error}</div>
    );
  }

  return (
    <div className="editorial-card p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-heading text-xl font-bold text-primary flex items-center gap-2">
            <Trophy size={20} className="text-accent" />
            Achievements
          </h2>
          <p className="text-secondary text-sm mt-0.5">
            {unlockedCount} of {achievements.length} unlocked
          </p>
        </div>

        {/* Overall progress bar */}
        <div className="w-full sm:w-48">
          <div className="w-full h-2 bg-borderPaper rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700"
              style={{ width: `${achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-secondary mt-1 text-right">
            {achievements.length > 0
              ? Math.round((unlockedCount / achievements.length) * 100)
              : 0}% complete
          </p>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', ...CATEGORY_ORDER] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
              activeCategory === cat
                ? 'bg-accent text-white border-accent'
                : 'bg-surface text-secondary border-borderPaper hover:border-accent/40'
            }`}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      {CATEGORY_ORDER.filter((cat) => activeCategory === 'all' || cat === activeCategory).map((cat) => {
        const group = filtered.filter((a) => a.category === cat);
        if (group.length === 0) return null;
        return (
          <div key={cat} className="mb-6 last:mb-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary mb-3">
              {CATEGORY_LABELS[cat]}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.map((ach) => (
                <AchievementCard key={ach.id} ach={ach} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
