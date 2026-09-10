import React from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Bookmark,
  CheckCircle2,
  Clock,
  Compass,
  Rocket,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { ActivityEvent } from '../../types/dashboard';

// ── Icon resolver ─────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, any> = {
  Award,
  Bookmark,
  CheckCircle2,
  Clock,
  Compass,
  Rocket,
  Star,
  TrendingUp,
  Zap,
  // Catalog icons re-used in achievements
  CalendarCheck: CheckCircle2,
  Hammer: Rocket,
  Layers: TrendingUp,
  Target: CheckCircle2,
  Search: Compass,
  BookOpen: Bookmark,
};

function EventIcon({ name, className }: { name: string; className?: string }) {
  const Comp = ICON_MAP[name] ?? Clock;
  return <Comp size={14} className={className} />;
}

// ── Event color by type ───────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  project_completed:   'text-emerald-500',
  project_started:     'text-blue-500',
  achievement_unlocked:'text-accent',
  xp_earned:           'text-amber-500',
  content_saved:       'text-purple-500',
  level_up:            'text-accent',
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface ActivityTimelineProps {
  events: ActivityEvent[];
  maxItems?: number;
  animationDelay?: number;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  events,
  maxItems = 10,
  animationDelay = 0,
}) => {
  const visible = events.slice(0, maxItems);

  return (
    <div
      className="editorial-card p-5 sm:p-6 animate-fade-in-up"
      style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'both' }}
    >
      <h2 className="font-heading text-base font-bold text-primary mb-4 flex items-center gap-2">
        <Clock size={15} className="text-accent" />
        Recent Activity
      </h2>

      {visible.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-secondary">No activity yet. Start building!</p>
        </div>
      ) : (
        <div className="space-y-0">
          {visible.map((event, idx) => {
            const iconColorClass = TYPE_COLORS[event.event_type] ?? 'text-secondary';
            const isLast = idx === visible.length - 1;

            const inner = (
              <div
                className={`flex gap-3 py-2.5 group ${
                  event.link ? 'cursor-pointer hover:bg-surface/50 -mx-2 px-2 rounded-md transition-colors duration-150' : ''
                }`}
              >
                {/* Icon + vertical line */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-surface border border-borderPaper ${iconColorClass} group-hover:border-accent/40 transition-colors duration-150`}>
                    <EventIcon name={event.icon} className={iconColorClass} />
                  </div>
                  {!isLast && (
                    <div className="w-px flex-1 bg-borderPaper mt-1 min-h-[12px]" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-sm font-medium text-primary leading-snug line-clamp-1">
                    {event.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {event.detail && (
                      <span className={`text-[10px] font-medium ${iconColorClass}`}>
                        {event.detail}
                      </span>
                    )}
                    <span className="text-[10px] text-secondary ml-auto flex-shrink-0">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );

            return event.link ? (
              <Link key={idx} to={event.link} className="block no-underline">
                {inner}
              </Link>
            ) : (
              <div key={idx}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
};
