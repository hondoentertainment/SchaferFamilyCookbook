import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    clearRecentSearches,
    getRecentSearches,
    rememberRecentSearch,
    removeRecentSearch,
} from './recentSearches';

describe('recentSearches', () => {
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

    it('starts empty', () => {
        expect(getRecentSearches()).toEqual([]);
    });

    it('remembers queries most-recent first and de-duplicates case-insensitively', () => {
        rememberRecentSearch('pie');
        rememberRecentSearch('soup');
        rememberRecentSearch('PIE');
        expect(getRecentSearches()).toEqual(['PIE', 'soup']);
    });

    it('ignores blank queries', () => {
        rememberRecentSearch('   ');
        expect(getRecentSearches()).toEqual([]);
    });

    it('can remove one query and clear the list', () => {
        rememberRecentSearch('pie');
        rememberRecentSearch('soup');
        expect(removeRecentSearch('pie')).toEqual(['soup']);
        expect(clearRecentSearches()).toEqual([]);
        expect(getRecentSearches()).toEqual([]);
    });
});
