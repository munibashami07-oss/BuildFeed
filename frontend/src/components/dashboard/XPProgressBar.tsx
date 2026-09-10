import React from 'react';
import { Zap } from 'lucide-react';

interface XPProgressBarProps {
  level: number;
  levelTitle: string;
  totalXp: number;
  xpInCurrentLevel: number;
  xpForCurrentLevelSpan: number;
  xpToNextLevel: number;
  levelProgressPercent: number;
  isMaxLevel: boolean;
  animationDelay?: number;
}

export const XPProgressBar: React.FC<XPProgressBarProps> = ({
  level,
  levelTitle,
  totalXp,
  xpInCurrentLevel,
  xpForCurrentLevelSpan,
  xpToNextLevel,
  levelProgressPercent,
  isMaxLevel,
  animationDelay = 0,
}) => {
  return (
    <div
      className="editorial-card p-5 sm:p-6 animate-fade-in-up"
      style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'both' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-accent" />
          </div>
          <div>
            <p className="text-xs font-medium text-secondary">Level {level}</p>
            <p className="font-heading text-base font-bold text-primary leading-tight">{levelTitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-xl font-bold text-accent">{totalXp.toLocaleString()}</p>
          <p className="text-[10px] text-secondary">total XP</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-borderPaper rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
          style={{ width: `${isMaxLevel ? 100 : levelProgressPercent}%` }}
        />
      </div>

      {/* Below bar labels */}
      <div className="flex items-center justify-between text-[10px] text-secondary">
        <span>{xpInCurrentLevel.toLocaleString()} XP</span>
        {isMaxLevel ? (
          <span className="font-medium text-accent">Max Level Reached</span>
        ) : (
          <span>
            {xpToNextLevel.toLocaleString()} XP to Level {level + 1}
          </span>
        )}
        <span>{xpForCurrentLevelSpan.toLocaleString()} XP span</span>
      </div>
    </div>
  );
};
