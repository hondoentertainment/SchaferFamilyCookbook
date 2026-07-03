import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getFamilyPrefsCache,
    setFamilyPrefsCache,
    displayNameFromSlug,
    FAMILY_PREFS_CACHE_KEY,
    FAMILY_PREFS_UPDATED_EVENT,
} from './familyPrefsCache';

describe('familyPrefsCache', () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => {
                store.set(key, value);
            },
            removeItem: (key: string) => {
                store.delete(key);
            },
            clear: () => store.clear(),
            length: 0,
            key: () => null,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns null when nothing is cached', () => {
        expect(getFamilyPrefsCache()).toBeNull();
    });

    it('returns null for malformed JSON', () => {
        localStorage.setItem(FAMILY_PREFS_CACHE_KEY, '{oops');
        expect(getFamilyPrefsCache()).toBeNull();
    });

    it('returns null when members is not an array', () => {
        localStorage.setItem(FAMILY_PREFS_CACHE_KEY, JSON.stringify({ fetchedAt: 'x', members: {} }));
        expect(getFamilyPrefsCache()).toBeNull();
    });

    it('round-trips a cache and dispatches the update event', () => {
        const listener = vi.fn();
        window.addEventListener(FAMILY_PREFS_UPDATED_EVENT, listener);
        const cache = {
            fetchedAt: '2026-07-03T00:00:00.000Z',
            members: [
                { userId: 'dawn', displayName: 'Dawn', ratings: { r1: 5 }, notes: [] },
            ],
        };
        setFamilyPrefsCache(cache);
        expect(getFamilyPrefsCache()).toEqual(cache);
        expect(listener).toHaveBeenCalledTimes(1);
        window.removeEventListener(FAMILY_PREFS_UPDATED_EVENT, listener);
    });

    describe('displayNameFromSlug', () => {
        it('title-cases hyphenated slugs', () => {
            expect(displayNameFromSlug('grandma-joan')).toBe('Grandma Joan');
        });

        it('handles single words', () => {
            expect(displayNameFromSlug('dawn')).toBe('Dawn');
        });

        it('ignores empty segments', () => {
            expect(displayNameFromSlug('-dawn--marie-')).toBe('Dawn Marie');
        });
    });
});
