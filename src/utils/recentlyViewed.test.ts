import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordRecipeView, getRecentRecipeIds, getRecentlyViewedEntries, RecentlyViewedEntry } from './recentlyViewed';

describe('recentlyViewed utility', () => {
    beforeEach(() => {
        const store = new Map();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) || null,
            setItem: (key: string, value: string) => store.set(key, value),
            clear: () => store.clear(),
        });
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    describe('recordRecipeView', () => {
        it('adds a new entry to the front of the list', () => {
            vi.setSystemTime(new Date(2026, 1, 1).getTime());
            recordRecipeView('rec-1', 'Pie');

            const entries = getRecentlyViewedEntries();
            expect(entries).toHaveLength(1);
            expect(entries[0]).toEqual({
                id: 'rec-1',
                title: 'Pie',
                viewedAt: new Date(2026, 1, 1).getTime()
            });
        });

        it('moves an existing entry to the front, updating its timestamp', () => {
            vi.setSystemTime(new Date(2026, 1, 1).getTime());
            recordRecipeView('rec-1', 'Pie');

            vi.setSystemTime(new Date(2026, 1, 2).getTime());
            recordRecipeView('rec-2', 'Cake');

            vi.setSystemTime(new Date(2026, 1, 3).getTime());
            recordRecipeView('rec-1', 'Pie (Updated)');

            const entries = getRecentlyViewedEntries();
            expect(entries).toHaveLength(2);
            expect(entries[0].id).toBe('rec-1');
            expect(entries[0].title).toBe('Pie (Updated)');
            expect(entries[0].viewedAt).toBe(new Date(2026, 1, 3).getTime());
            expect(entries[1].id).toBe('rec-2');
        });

        it('caps the list at max 20 entries', () => {
            for (let i = 1; i <= 25; i++) {
                recordRecipeView(`rec-${i}`, `Recipe ${i}`);
            }

            const entries = getRecentlyViewedEntries();
            expect(entries).toHaveLength(20);
            expect(entries[0].id).toBe('rec-25'); // The most recent
            expect(entries[19].id).toBe('rec-6'); // The oldest of the 20
        });
    });

    describe('getRecentRecipeIds', () => {
        it('returns only the ids in correct order', () => {
            recordRecipeView('rec-1', 'Pie');
            recordRecipeView('rec-2', 'Cake');

            const ids = getRecentRecipeIds();
            expect(ids).toEqual(['rec-2', 'rec-1']);
        });
    });

    describe('getRecentlyViewedEntries', () => {
        it('handles missing or corrupt storage gracefully', () => {
            expect(getRecentlyViewedEntries()).toEqual([]);

            localStorage.setItem('schafer_recently_viewed', 'invalid json');
            expect(getRecentlyViewedEntries()).toEqual([]);
        });
    });
});
