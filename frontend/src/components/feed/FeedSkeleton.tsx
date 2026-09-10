import React from 'react';

export const FeedSkeleton: React.FC = () => (
  <div className="feed-card p-4 animate-pulse">
    <div className="flex gap-3">
      {/* Thumbnail */}
      <div className="w-[88px] h-[88px] sm:w-[104px] sm:h-[104px] rounded-xl skeleton flex-shrink-0" />

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        {/* Top badges */}
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-14 skeleton rounded-md" />
          <div className="h-4 w-20 skeleton rounded-md" />
        </div>

        {/* Title */}
        <div className="space-y-1">
          <div className="h-3.5 skeleton w-full rounded" />
          <div className="h-3.5 skeleton w-4/5 rounded" />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <div className="h-2.5 skeleton w-full rounded" />
          <div className="h-2.5 skeleton w-3/4 rounded" />
        </div>

        {/* Tags */}
        <div className="flex gap-1">
          <div className="h-4 w-16 skeleton rounded-md" />
          <div className="h-4 w-20 skeleton rounded-md" />
          <div className="h-4 w-14 skeleton rounded-md" />
        </div>

        {/* Bottom meta bar */}
        <div className="mt-auto pt-2 border-t border-borderPaper/40 flex items-center justify-between">
          <div className="h-2.5 w-24 skeleton rounded" />
          <div className="flex gap-1.5">
            <div className="h-6 w-6 skeleton rounded-lg" />
            <div className="h-6 w-10 skeleton rounded-lg" />
            <div className="h-6 w-6 skeleton rounded-lg" />
          </div>
        </div>
      </div>
    </div>

    {/* AI chip */}
    <div className="mt-3 pt-2.5 border-t border-borderPaper/30">
      <div className="h-6 w-24 skeleton rounded-lg" />
    </div>
  </div>
);
