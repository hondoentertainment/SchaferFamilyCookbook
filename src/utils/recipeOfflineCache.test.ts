import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    cacheRecipeOffline,
    cacheRecipesOffline,
    getOfflineRecipe,
    hasOfflineRecipe,
    listOfflineRecipeIds,
    OFFLINE_CACHE_UPDATED_EVENT,
} from './recipeOfflineCache';
import type { Recipe } from '../types';

const makeRecipe = (id: string): Recipe =>
    ({ id, title: `Recipe ${id}`, category: 'Main', contributor: 'Alice', ingredients: ['x'], instructions: ['y'], image: '' }) as unknown as Recipe;

/**
 * Minimal in-memory IndexedDB fake covering exactly the surface
 * recipeOfflineCache uses: open (upgrade + success), objectStore
 * put/get/getAllKeys, transaction oncomplete, close.
 */
function makeFakeIndexedDB() {
    const stores = new Map<string, Map<string, unknown>>();

    const makeDb = () => ({
        objectStoreNames: { contains: (n: string) => stores.has(n) },
        createObjectStore: (n: string) => {
            stores.set(n, new Map());
            return {};
        },
        close: () => {},
        transaction: (name: string) => {
            const data = stores.get(name)!;
            type Handler = (() => void) | null;
            const tx: {
                oncomplete: Handler;
                onerror: Handler;
                error: unknown;
                objectStore: () => {
                    put: (v: { id: string }) => object;
                    get: (id: string) => { onsuccess: Handler; onerror: Handler; result?: unknown; error?: unknown };
                    getAllKeys: () => { onsuccess: Handler; onerror: Handler; result?: unknown[]; error?: unknown };
                };
            } = {
                oncomplete: null,
                onerror: null,
                error: null,
                objectStore: () => ({
                    put: (v: { id: string }) => {
                        data.set(v.id, v);
                        return {};
                    },
                    get: (id: string) => {
                        const req: { onsuccess: Handler; onerror: Handler; result?: unknown } = { onsuccess: null, onerror: null };
                        queueMicrotask(() => {
                            req.result = data.get(id);
                            req.onsuccess?.();
                        });
                        return req;
                    },
                    getAllKeys: () => {
                        const req: { onsuccess: Handler; onerror: Handler; result?: unknown[] } = { onsuccess: null, onerror: null };
                        queueMicrotask(() => {
                            req.result = [...data.keys()];
                            req.onsuccess?.();
                        });
                        return req;
                    },
                }),
            };
            // Complete after the caller's synchronous puts/handler wiring.
            queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()));
            return tx;
        },
    });

    return {
        stores,
        open: (_name: string, _version: number) => {
            const req: {
                onupgradeneeded: ((ev: { target: { result: unknown } }) => void) | null;
                onsuccess: (() => void) | null;
                onerror: (() => void) | null;
                result?: unknown;
                error?: unknown;
            } = { onupgradeneeded: null, onsuccess: null, onerror: null };
            queueMicrotask(() => {
                const db = makeDb();
                req.result = db;
                if (stores.size === 0) req.onupgradeneeded?.({ target: { result: db } });
                req.onsuccess?.();
            });
            return req;
        },
    };
}

describe('recipeOfflineCache', () => {
    let fake: ReturnType<typeof makeFakeIndexedDB>;

    beforeEach(() => {
        fake = makeFakeIndexedDB();
        vi.stubGlobal('indexedDB', fake);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('caches a single recipe and reads it back', async () => {
        await cacheRecipeOffline(makeRecipe('r1'));
        const cached = await getOfflineRecipe('r1');
        expect(cached).toMatchObject({ id: 'r1', title: 'Recipe r1' });
        expect(await hasOfflineRecipe('r1')).toBe(true);
    });

    it('returns null / false for a recipe that was never cached', async () => {
        await cacheRecipeOffline(makeRecipe('r1'));
        expect(await getOfflineRecipe('missing')).toBeNull();
        expect(await hasOfflineRecipe('missing')).toBe(false);
    });

    it('bulk-caches recipes and lists their ids', async () => {
        await cacheRecipesOffline([makeRecipe('a'), makeRecipe('b'), makeRecipe('c')]);
        const ids = await listOfflineRecipeIds();
        expect(ids.sort()).toEqual(['a', 'b', 'c']);
    });

    it('overwrites an existing entry on re-cache (keyPath id)', async () => {
        await cacheRecipeOffline(makeRecipe('r1'));
        await cacheRecipeOffline({ ...makeRecipe('r1'), title: 'Updated' } as Recipe);
        const cached = await getOfflineRecipe('r1');
        expect(cached?.title).toBe('Updated');
        expect(await listOfflineRecipeIds()).toEqual(['r1']);
    });

    it('dispatches the offline-cache-updated event on writes', async () => {
        const seen = vi.fn();
        window.addEventListener(OFFLINE_CACHE_UPDATED_EVENT, seen);
        try {
            await cacheRecipeOffline(makeRecipe('r1'));
            await cacheRecipesOffline([makeRecipe('r2')]);
            expect(seen).toHaveBeenCalledTimes(2);
        } finally {
            window.removeEventListener(OFFLINE_CACHE_UPDATED_EVENT, seen);
        }
    });

    it('does not dispatch or open the DB for an empty bulk cache', async () => {
        const seen = vi.fn();
        window.addEventListener(OFFLINE_CACHE_UPDATED_EVENT, seen);
        try {
            await cacheRecipesOffline([]);
            expect(seen).not.toHaveBeenCalled();
        } finally {
            window.removeEventListener(OFFLINE_CACHE_UPDATED_EVENT, seen);
        }
    });

    it('no-ops gracefully when indexedDB is unavailable', async () => {
        vi.stubGlobal('indexedDB', undefined);
        await expect(cacheRecipeOffline(makeRecipe('r1'))).resolves.toBeUndefined();
        await expect(cacheRecipesOffline([makeRecipe('r1')])).resolves.toBeUndefined();
        expect(await getOfflineRecipe('r1')).toBeNull();
        expect(await hasOfflineRecipe('r1')).toBe(false);
        expect(await listOfflineRecipeIds()).toEqual([]);
    });

    it('degrades gracefully (warn, safe defaults) when the DB fails to open', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal('indexedDB', {
            open: () => {
                const req: { onsuccess: (() => void) | null; onerror: (() => void) | null; error?: unknown } = {
                    onsuccess: null,
                    onerror: null,
                };
                queueMicrotask(() => {
                    req.error = new Error('quota exceeded');
                    req.onerror?.();
                });
                return req;
            },
        });
        await expect(cacheRecipeOffline(makeRecipe('r1'))).resolves.toBeUndefined();
        expect(await getOfflineRecipe('r1')).toBeNull();
        expect(await listOfflineRecipeIds()).toEqual([]);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
