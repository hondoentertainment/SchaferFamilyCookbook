import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getActivityFeed,
    addActivity,
    formatTimeAgo,
    getActivityIcon,
    type ActivityEvent,
} from './activityFeed';

const STORAGE_KEY = 'schafer_activity_feed';
const MAX_EVENTS = 50;

describe('activityFeed utility', () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => { store.set(key, value); },
            removeItem: (key: string) => { store.delete(key); },
            clear: () => store.clear(),
            length: 0,
            key: () => null,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    // -------------------------------------------------------------------------
    describe('getActivityFeed', () => {
        it('returns an empty array when nothing is stored', () => {
            expect(getActivityFeed()).toEqual([]);
        });

        it('parses and returns stored events', () => {
            const events: ActivityEvent[] = [
                { id: 'act1', type: 'recipe_added', userName: 'Alice', detail: 'Added Pie', timestamp: new Date().toISOString() },
                { id: 'act2', type: 'recipe_rated', userName: 'Bob', detail: 'Rated Cake 5 stars', timestamp: new Date().toISOString() },
            ];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
            const result = getActivityFeed();
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('act1');
            expect(result[1].userName).toBe('Bob');
        });

        it('returns an empty array for malformed JSON', () => {
            localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
            expect(getActivityFeed()).toEqual([]);
        });

        it('returns an empty array when stored value is an empty JSON array', () => {
            localStorage.setItem(STORAGE_KEY, '[]');
            expect(getActivityFeed()).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    describe('addActivity', () => {
        it('adds a new event to the front of the feed', () => {
            addActivity('recipe_added', 'Alice', 'Added Apple Pie');
            const feed = getActivityFeed();
            expect(feed).toHaveLength(1);
            expect(feed[0].type).toBe('recipe_added');
            expect(feed[0].userName).toBe('Alice');
            expect(feed[0].detail).toBe('Added Apple Pie');
        });

        it('assigns a unique id to each event', () => {
            addActivity('recipe_added', 'Alice', 'Event 1');
            addActivity('recipe_added', 'Alice', 'Event 2');
            const feed = getActivityFeed();
            expect(feed[0].id).not.toBe(feed[1].id);
        });

        it('stores a timestamp on each event', () => {
            addActivity('note_added', 'Bob', 'Added note');
            const feed = getActivityFeed();
            expect(feed[0].timestamp).toBeTruthy();
            expect(typeof feed[0].timestamp).toBe('string');
        });

        it('prepends the newest event (most recent is index 0)', () => {
            addActivity('recipe_added', 'Alice', 'First');
            addActivity('recipe_rated', 'Bob', 'Second');
            const feed = getActivityFeed();
            expect(feed[0].detail).toBe('Second');
            expect(feed[1].detail).toBe('First');
        });

        it('persists events to localStorage', () => {
            addActivity('favorite_added', 'Carol', 'Favorited Brownies');
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
            expect(stored).toHaveLength(1);
            expect(stored[0].detail).toBe('Favorited Brownies');
        });

        it('supports all valid event types', () => {
            const types: ActivityEvent['type'][] = [
                'recipe_added',
                'recipe_rated',
                'note_added',
                'collection_created',
                'favorite_added',
            ];
            types.forEach((type) => addActivity(type, 'User', `Event of type ${type}`));
            const feed = getActivityFeed();
            expect(feed).toHaveLength(types.length);
        });

        it('caps the feed at MAX_EVENTS (50)', () => {
            for (let i = 0; i < MAX_EVENTS; i++) {
                addActivity('recipe_added', 'User', `Event ${i}`);
            }
            // Add one more to exceed the cap
            addActivity('recipe_added', 'User', 'Overflow event');
            const feed = getActivityFeed();
            expect(feed).toHaveLength(MAX_EVENTS);
        });

        it('the oldest event is dropped when the cap is exceeded', () => {
            for (let i = 0; i < MAX_EVENTS; i++) {
                addActivity('recipe_added', 'User', `Event ${i}`);
            }
            addActivity('recipe_added', 'User', 'Newest');
            const feed = getActivityFeed();
            expect(feed[0].detail).toBe('Newest');
            // The very first event added ("Event 0") should have been pushed off
            expect(feed.some((e) => e.detail === 'Event 0')).toBe(false);
        });

        it('preserves up to MAX_EVENTS without trimming when exactly at the limit', () => {
            for (let i = 0; i < MAX_EVENTS; i++) {
                addActivity('recipe_added', 'User', `Event ${i}`);
            }
            const feed = getActivityFeed();
            expect(feed).toHaveLength(MAX_EVENTS);
        });
    });

    // -------------------------------------------------------------------------
    describe('formatTimeAgo', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it('returns "just now" for timestamps less than 1 minute ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000).toISOString();
            expect(formatTimeAgo(thirtySecondsAgo)).toBe('just now');
        });

        it('returns "just now" for a timestamp equal to now', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            expect(formatTimeAgo(now.toISOString())).toBe('just now');
        });

        it('returns minutes ago for timestamps 1–59 minutes ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
            expect(formatTimeAgo(fiveMinutesAgo)).toBe('5m ago');
        });

        it('returns 1m ago for exactly 1 minute ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
            expect(formatTimeAgo(oneMinuteAgo)).toBe('1m ago');
        });

        it('returns 59m ago for 59 minutes ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            const ts = new Date(now.getTime() - 59 * 60 * 1000).toISOString();
            expect(formatTimeAgo(ts)).toBe('59m ago');
        });

        it('returns hours ago for timestamps 1–23 hours ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
            expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago');
        });

        it('returns 1h ago for exactly 60 minutes ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            const ts = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
            expect(formatTimeAgo(ts)).toBe('1h ago');
        });

        it('returns days ago for timestamps 1–6 days ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
            expect(formatTimeAgo(twoDaysAgo)).toBe('2d ago');
        });

        it('returns 1d ago for exactly 24 hours ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            const ts = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            expect(formatTimeAgo(ts)).toBe('1d ago');
        });

        it('returns weeks ago for timestamps 1–4 weeks ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
            expect(formatTimeAgo(twoWeeksAgo)).toBe('2w ago');
        });

        it('returns 1w ago for exactly 7 days ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            const ts = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            expect(formatTimeAgo(ts)).toBe('1w ago');
        });

        it('returns a locale date string for timestamps 5+ weeks ago', () => {
            const now = new Date('2026-04-24T12:00:00.000Z');
            vi.setSystemTime(now);
            // 35 days = exactly 5 weeks
            const fiveWeeksAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
            const ts = fiveWeeksAgo.toISOString();
            const result = formatTimeAgo(ts);
            // Should be a locale date string, not a relative label
            expect(result).not.toMatch(/ago$/);
            expect(result).not.toBe('just now');
            expect(result).toBe(fiveWeeksAgo.toLocaleDateString());
        });
    });

    // -------------------------------------------------------------------------
    describe('getActivityIcon', () => {
        it('returns the correct icon for recipe_added', () => {
            expect(getActivityIcon('recipe_added')).toBe('📝');
        });

        it('returns the correct icon for recipe_rated', () => {
            expect(getActivityIcon('recipe_rated')).toBe('⭐');
        });

        it('returns the correct icon for note_added', () => {
            expect(getActivityIcon('note_added')).toBe('💬');
        });

        it('returns the correct icon for collection_created', () => {
            expect(getActivityIcon('collection_created')).toBe('📚');
        });

        it('returns the correct icon for favorite_added', () => {
            expect(getActivityIcon('favorite_added')).toBe('❤️');
        });

        it('returns a non-empty string for all valid event types', () => {
            const types: ActivityEvent['type'][] = [
                'recipe_added',
                'recipe_rated',
                'note_added',
                'collection_created',
                'favorite_added',
            ];
            types.forEach((type) => {
                const icon = getActivityIcon(type);
                expect(typeof icon).toBe('string');
                expect(icon.length).toBeGreaterThan(0);
            });
        });
    });
});
