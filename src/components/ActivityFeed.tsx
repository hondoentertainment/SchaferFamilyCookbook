import React from 'react';
import { getActivityFeed, formatTimeAgo, getActivityIcon } from '../utils/activityFeed';
import type { ActivityEvent } from '../utils/activityFeed';

interface ActivityFeedProps {
  maxItems?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ maxItems = 15 }) => {
  const feed: ActivityEvent[] = getActivityFeed().slice(0, maxItems);

  if (feed.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <span className="text-3xl">📢</span>
        <p className="text-sm text-stone-400 font-serif italic">
          No activity yet. Rate a recipe or leave a note to get started!
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Family activity feed">
      {feed.map((event) => (
        <li
          key={event.id}
          className="flex items-start gap-3 p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <span className="text-lg mt-0.5 shrink-0">{getActivityIcon(event.type)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-stone-700 dark:text-stone-300">
              <span className="font-bold text-[#2D4635] dark:text-emerald-400">{event.userName}</span>{' '}
              {event.detail}
            </p>
            <time className="text-[10px] text-stone-400">{formatTimeAgo(event.timestamp)}</time>
          </div>
        </li>
      ))}
    </ul>
  );
};
