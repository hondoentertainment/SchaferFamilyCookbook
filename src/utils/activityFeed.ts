import { STORAGE_KEYS } from '../constants/storage';

export interface ActivityEvent {
  id: string;
  type:
    | 'recipe_added'
    | 'recipe_rated'
    | 'note_added'
    | 'collection_created'
    | 'favorite_added'
    | 'recipe_cooked'
    | 'profile_updated';
  userName: string;
  detail: string;
  timestamp: string;
}

const MAX_EVENTS = 50;

export function getActivityFeed(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.activityFeed);
    if (!raw) return [];
    return JSON.parse(raw) as ActivityEvent[];
  } catch {
    return [];
  }
}

export function addActivity(
  type: ActivityEvent['type'],
  userName: string,
  detail: string,
): void {
  const feed = getActivityFeed();
  feed.unshift({
    id: 'act' + Date.now() + Math.random().toString(36).slice(2, 6),
    type,
    userName,
    detail,
    timestamp: new Date().toISOString(),
  });
  // Keep only the last MAX_EVENTS
  if (feed.length > MAX_EVENTS) feed.length = MAX_EVENTS;
  localStorage.setItem(STORAGE_KEYS.activityFeed, JSON.stringify(feed));
}

export function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function getActivityIcon(type: ActivityEvent['type']): string {
  switch (type) {
    case 'recipe_added': return '📝';
    case 'recipe_rated': return '⭐';
    case 'note_added': return '💬';
    case 'collection_created': return '📚';
    case 'favorite_added': return '❤️';
    case 'recipe_cooked': return '🍳';
    case 'profile_updated': return '👤';
  }
}
