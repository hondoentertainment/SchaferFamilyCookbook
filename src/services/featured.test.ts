import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getFeaturedIds,
    setFeaturedIds,
    isFeaturedAvailable,
    FEATURED_LIMIT,
    FEATURED_CACHE_KEY,
} from './featured';
import { CloudArchive } from './db';
import { setupLocalStorage } from '../test/utils';
import * as firestore from 'firebase/firestore';

describe('featured service', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
        vi.clearAllMocks();
        // Reset cached firebase state on CloudArchive so getFirebase() re-evaluates.
        const archive = CloudArchive as unknown as Record<string, unknown>;
        archive._firebaseApp = null;
        archive._firestore = null;
        archive._storage = null;
    });

    describe('without Firebase configured', () => {
        it('getFeaturedIds returns empty when no cache', async () => {
            const ids = await getFeaturedIds();
            expect(ids).toEqual([]);
        });

        it('getFeaturedIds falls back to localStorage cache', async () => {
            localStorage.setItem(FEATURED_CACHE_KEY, JSON.stringify(['a', 'b', 'c']));
            const ids = await getFeaturedIds();
            expect(ids).toEqual(['a', 'b', 'c']);
        });

        it('setFeaturedIds writes to localStorage when no Firebase', async () => {
            await setFeaturedIds(['x', 'y']);
            expect(localStorage.getItem(FEATURED_CACHE_KEY)).toBe(JSON.stringify(['x', 'y']));
            // No firebase call expected.
            expect(firestore.setDoc).not.toHaveBeenCalled();
        });

        it('isFeaturedAvailable returns true when cache exists', () => {
            localStorage.setItem(FEATURED_CACHE_KEY, JSON.stringify(['a']));
            expect(isFeaturedAvailable()).toBe(true);
        });

        it('isFeaturedAvailable returns false when no cache and no firebase', () => {
            expect(isFeaturedAvailable()).toBe(false);
        });

        it('sanitizes input: dedupes and respects the limit', async () => {
            const tooMany = Array.from({ length: 20 }, (_, i) => `r${i}`);
            await setFeaturedIds([...tooMany, 'r0', 'r0']); // dupes + over the cap
            const stored = JSON.parse(localStorage.getItem(FEATURED_CACHE_KEY)!);
            expect(stored.length).toBe(FEATURED_LIMIT);
            expect(stored[0]).toBe('r0');
            expect(new Set(stored).size).toBe(FEATURED_LIMIT);
        });

        it('getFeaturedIds recovers from invalid cache JSON', async () => {
            localStorage.setItem(FEATURED_CACHE_KEY, '{not-json');
            const ids = await getFeaturedIds();
            expect(ids).toEqual([]);
        });

        it('getFeaturedIds filters non-strings from cache', async () => {
            localStorage.setItem(FEATURED_CACHE_KEY, JSON.stringify(['a', 42, null, 'b']));
            const ids = await getFeaturedIds();
            expect(ids).toEqual(['a', 'b']);
        });
    });

    describe('with Firebase configured', () => {
        beforeEach(() => {
            localStorage.setItem(
                'schafer_firebase_config',
                JSON.stringify({ apiKey: 'k', projectId: 'p' })
            );
        });

        it('getFeaturedIds reads from Firestore and caches locally', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ recipeIds: ['cloud1', 'cloud2'] }),
            } as unknown as Awaited<ReturnType<typeof firestore.getDoc>>);

            const ids = await getFeaturedIds();
            expect(ids).toEqual(['cloud1', 'cloud2']);
            expect(localStorage.getItem(FEATURED_CACHE_KEY)).toBe(JSON.stringify(['cloud1', 'cloud2']));
        });

        it('getFeaturedIds returns empty when the doc is missing', async () => {
            vi.mocked(firestore.getDoc).mockResolvedValueOnce({
                exists: () => false,
                data: () => undefined,
            } as unknown as Awaited<ReturnType<typeof firestore.getDoc>>);
            const ids = await getFeaturedIds();
            expect(ids).toEqual([]);
        });

        it('getFeaturedIds falls back to cache when Firestore throws (offline)', async () => {
            vi.mocked(firestore.getDoc).mockRejectedValueOnce(new Error('offline'));
            localStorage.setItem(FEATURED_CACHE_KEY, JSON.stringify(['offline1']));

            const ids = await getFeaturedIds();
            expect(ids).toEqual(['offline1']);
        });

        it('setFeaturedIds calls setDoc and caches locally', async () => {
            vi.mocked(firestore.setDoc).mockResolvedValueOnce(undefined);

            await setFeaturedIds(['fid1', 'fid2']);

            expect(firestore.setDoc).toHaveBeenCalled();
            const callArgs = vi.mocked(firestore.setDoc).mock.calls[0];
            expect(callArgs[1]).toMatchObject({ recipeIds: ['fid1', 'fid2'] });
            expect(localStorage.getItem(FEATURED_CACHE_KEY)).toBe(JSON.stringify(['fid1', 'fid2']));
        });

        it('isFeaturedAvailable returns true when firebase is configured', () => {
            expect(isFeaturedAvailable()).toBe(true);
        });
    });
});
