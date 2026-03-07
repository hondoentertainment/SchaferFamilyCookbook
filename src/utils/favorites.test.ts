import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFavoriteIds, toggleFavorite, isFavorite } from './favorites';

describe('favorites utility', () => {
    beforeEach(() => {
        const store = new Map();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) || null,
            setItem: (key: string, value: string) => store.set(key, value),
            clear: () => store.clear(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('getFavoriteIds', () => {
        it('returns an empty set if nothing in storage', () => {
            const faves = getFavoriteIds();
            expect(faves.size).toBe(0);
        });

        it('returns saved favorite ids as a Set', () => {
            localStorage.setItem('schafer_favorites', JSON.stringify(['recipe-1', 'recipe-2']));
            const faves = getFavoriteIds();
            expect(faves.size).toBe(2);
            expect(faves.has('recipe-1')).toBe(true);
            expect(faves.has('recipe-2')).toBe(true);
        });

        it('recovers gracefully from corrupt storage data', () => {
            localStorage.setItem('schafer_favorites', 'not-json-array');
            const faves = getFavoriteIds();
            expect(faves.size).toBe(0);
        });
    });

    describe('toggleFavorite', () => {
        it('adds a new favorite if not present', () => {
            const res = toggleFavorite('recipe-1');
            expect(res.size).toBe(1);
            expect(res.has('recipe-1')).toBe(true);

            // Verify storage updated
            const stored = JSON.parse(localStorage.getItem('schafer_favorites') || '[]');
            expect(stored).toEqual(['recipe-1']);
        });

        it('removes an existing favorite', () => {
            toggleFavorite('recipe-1'); // Add
            const res = toggleFavorite('recipe-1'); // Remove
            expect(res.size).toBe(0);
            expect(res.has('recipe-1')).toBe(false);

            // Verify storage updated
            const stored = JSON.parse(localStorage.getItem('schafer_favorites') || '[]');
            expect(stored).toEqual([]);
        });
    });

    describe('isFavorite', () => {
        it('checks if a recipe id is favorited', () => {
            toggleFavorite('recipe-88');
            expect(isFavorite('recipe-88')).toBe(true);
            expect(isFavorite('recipe-99')).toBe(false);
        });
    });
});
