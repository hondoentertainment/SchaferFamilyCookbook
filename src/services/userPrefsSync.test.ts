import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    deriveUserId,
    mergePrefs,
    mergeCollections,
    mergeMealPlan,
    mergeGroceryList,
    mergeNotes,
    parseNotes,
    fetchRemotePrefs,
    writeRemotePrefs,
    createDebouncedWriter,
} from './userPrefsSync';
import type { RecipeNote } from '../types';
import type { RecipeCollection } from '../types';
import type { MealPlanEntry } from '../utils/mealPlan';
import type { GroceryItem } from '../utils/groceryList';
import { CloudArchive } from './db';
import { setupLocalStorage } from '../test/utils';

describe('userPrefsSync', () => {
    beforeEach(() => {
        setupLocalStorage();
        localStorage.clear();
        CloudArchive._firebaseApp = null;
        CloudArchive._firestore = null;
        CloudArchive._storage = null;
        vi.clearAllMocks();
    });

    describe('deriveUserId', () => {
        it('slugifies a display name', () => {
            expect(deriveUserId('Grandma Joan')).toBe('grandma-joan');
        });

        it('collapses whitespace and non-alphanumerics', () => {
            expect(deriveUserId('  Grandma   Joan!!  ')).toBe('grandma-joan');
        });

        it('strips diacritics', () => {
            expect(deriveUserId('José')).toBe('jose');
        });

        it('returns null for empty or nullish input', () => {
            expect(deriveUserId('')).toBeNull();
            expect(deriveUserId(null)).toBeNull();
            expect(deriveUserId(undefined)).toBeNull();
            expect(deriveUserId('   ')).toBeNull();
            expect(deriveUserId('!!!')).toBeNull();
        });

        it('is stable across case variants', () => {
            expect(deriveUserId('KYLE')).toBe(deriveUserId('kyle'));
            expect(deriveUserId('Kyle')).toBe(deriveUserId('kyle'));
        });
    });

    describe('mergeCollections', () => {
        const col = (overrides: Partial<RecipeCollection> = {}): RecipeCollection => ({
            id: 'col1',
            name: 'Holiday',
            recipeIds: ['r1'],
            createdBy: 'Ada',
            icon: '🎄',
            timestamp: '2026-01-01T00:00:00.000Z',
            ...overrides,
        });

        it('unions recipeIds for matching collection ids', () => {
            const merged = mergeCollections(
                [col({ recipeIds: ['r1', 'r2'] })],
                [col({ recipeIds: ['r2', 'r3'] })]
            );
            expect(merged).toHaveLength(1);
            expect([...merged[0].recipeIds].sort()).toEqual(['r1', 'r2', 'r3']);
        });

        it('includes collections from both sides by id', () => {
            const merged = mergeCollections(
                [col({ id: 'a', name: 'Local' })],
                [col({ id: 'b', name: 'Remote' })]
            );
            expect(merged.map((c) => c.id).sort()).toEqual(['a', 'b']);
        });

        it('prefers newer timestamp for name, description, and icon', () => {
            const merged = mergeCollections(
                [
                    col({
                        name: 'Old Name',
                        description: 'old desc',
                        icon: '📚',
                        timestamp: '2026-01-01T00:00:00.000Z',
                    }),
                ],
                [
                    col({
                        name: 'New Name',
                        description: 'new desc',
                        icon: '🍳',
                        timestamp: '2026-06-01T00:00:00.000Z',
                    }),
                ]
            );
            expect(merged[0].name).toBe('New Name');
            expect(merged[0].description).toBe('new desc');
            expect(merged[0].icon).toBe('🍳');
        });
    });

    describe('mergeMealPlan', () => {
        const entry = (overrides: Partial<MealPlanEntry> = {}): MealPlanEntry => ({
            id: 'mp1',
            date: '2026-06-21',
            recipeId: 'r1',
            addedAt: 100,
            ...overrides,
        });

        it('includes entries from both sides ordered by date then added time', () => {
            const merged = mergeMealPlan(
                [entry({ id: 'local', date: '2026-06-22', addedAt: 200 })],
                [entry({ id: 'remote', date: '2026-06-21', recipeId: 'r2', addedAt: 300 })]
            );
            expect(merged.map((e) => e.id)).toEqual(['remote', 'local']);
        });

        it('dedupes the same recipe on the same day', () => {
            const merged = mergeMealPlan(
                [entry({ id: 'local', addedAt: 200 })],
                [entry({ id: 'remote', addedAt: 100 })]
            );
            expect(merged).toHaveLength(1);
            expect(merged[0].id).toBe('remote');
        });
    });

    describe('mergeGroceryList', () => {
        const item = (overrides: Partial<GroceryItem> = {}): GroceryItem => ({
            id: 'g1',
            text: '2 cups flour',
            recipeId: 'r1',
            recipeTitle: 'Bread',
            checked: false,
            addedAt: 100,
            ...overrides,
        });

        it('unions items from both sides by id', () => {
            const merged = mergeGroceryList(
                [item({ id: 'local' })],
                [item({ id: 'remote', text: '1 cup sugar' })],
            );
            expect(merged.map((g) => g.id).sort()).toEqual(['local', 'remote']);
        });

        it('dedupes recipeId + text pairs and keeps checked state', () => {
            const merged = mergeGroceryList(
                [item({ id: 'local', checked: true, addedAt: 200 })],
                [item({ id: 'remote', checked: false, addedAt: 100 })],
            );
            expect(merged).toHaveLength(1);
            expect(merged[0].checked).toBe(true);
        });
    });

    describe('mergePrefs', () => {
        it('unions favorites from both sides', () => {
            const merged = mergePrefs(
                { favorites: ['a', 'b'], ratings: {}, collections: [] },
                { favorites: ['b', 'c'], ratings: {}, collections: [] }
            );
            expect([...merged.favorites].sort()).toEqual(['a', 'b', 'c']);
        });

        it('prefers remote ratings over local for overlapping recipe ids', () => {
            const merged = mergePrefs(
                { favorites: [], ratings: { r1: 3, r2: 5 }, collections: [] },
                { favorites: [], ratings: { r1: 4, r3: 2 }, collections: [] }
            );
            expect(merged.ratings).toEqual({ r1: 4, r2: 5, r3: 2 });
        });

        it('merges collections from both sides', () => {
            const merged = mergePrefs(
                {
                    favorites: [],
                    ratings: {},
                    collections: [
                        {
                            id: 'c1',
                            name: 'Local',
                            recipeIds: ['r1'],
                            createdBy: 'Ada',
                            icon: '📚',
                            timestamp: '2026-01-01T00:00:00.000Z',
                        },
                    ],
                },
                {
                    favorites: [],
                    ratings: {},
                    collections: [
                        {
                            id: 'c1',
                            name: 'Remote',
                            recipeIds: ['r2'],
                            createdBy: 'Ada',
                            icon: '🍳',
                            timestamp: '2026-06-01T00:00:00.000Z',
                        },
                        {
                            id: 'c2',
                            name: 'Only Remote',
                            recipeIds: [],
                            createdBy: 'Ada',
                            icon: '🥘',
                            timestamp: '2026-02-01T00:00:00.000Z',
                        },
                    ],
                }
            );
            expect(merged.collections.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
            const c1 = merged.collections.find((c) => c.id === 'c1')!;
            expect([...c1.recipeIds].sort()).toEqual(['r1', 'r2']);
            expect(c1.name).toBe('Remote');
        });

        it('merges meal plan entries from both sides', () => {
            const merged = mergePrefs(
                {
                    favorites: [],
                    ratings: {},
                    collections: [],
                    mealPlan: [{ id: 'local', date: '2026-06-22', recipeId: 'r1', addedAt: 100 }],
                },
                {
                    favorites: [],
                    ratings: {},
                    collections: [],
                    mealPlan: [{ id: 'remote', date: '2026-06-23', recipeId: 'r2', addedAt: 200 }],
                }
            );
            expect(merged.mealPlan?.map((entry) => entry.id)).toEqual(['local', 'remote']);
        });

        it('returns empty prefs for two empty inputs', () => {
            const merged = mergePrefs(
                { favorites: [], ratings: {}, collections: [] },
                { favorites: [], ratings: {}, collections: [] }
            );
            expect(merged.favorites).toEqual([]);
            expect(merged.ratings).toEqual({});
            expect(merged.collections).toEqual([]);
            expect(merged.mealPlan).toEqual([]);
        });
    });

    describe('fetchRemotePrefs (no firebase configured)', () => {
        it('returns null when firebase is not configured', async () => {
            const result = await fetchRemotePrefs('grandma-joan');
            expect(result).toBeNull();
        });

        it('returns null for an empty userId', async () => {
            const result = await fetchRemotePrefs('');
            expect(result).toBeNull();
        });
    });

    describe('writeRemotePrefs (no firebase configured)', () => {
        it('returns false silently when firebase is not configured', async () => {
            const ok = await writeRemotePrefs('grandma-joan', {
                favorites: ['a'],
                ratings: { r1: 4 },
                collections: [],
            });
            expect(ok).toBe(false);
        });

        it('returns false for an empty userId even if firebase is configured', async () => {
            localStorage.setItem('schafer_active_provider', 'firebase');
            localStorage.setItem('schafer_firebase_config', JSON.stringify({ apiKey: 'k', projectId: 'p' }));
            const ok = await writeRemotePrefs('', { favorites: [], ratings: {}, collections: [] });
            expect(ok).toBe(false);
        });
    });

    describe('fetchRemotePrefs (firebase configured)', () => {
        beforeEach(() => {
            localStorage.setItem('schafer_active_provider', 'firebase');
            localStorage.setItem(
                'schafer_firebase_config',
                JSON.stringify({ apiKey: 'k', projectId: 'p' })
            );
        });

        it('returns null when the doc does not exist', async () => {
            const firestore = await import('firebase/firestore');
            vi.spyOn(firestore, 'getDoc').mockResolvedValueOnce({
                exists: () => false,
                data: () => undefined,
            } as unknown as Awaited<ReturnType<typeof import('firebase/firestore').getDoc>>);
            const result = await fetchRemotePrefs('grandma-joan');
            expect(result).toBeNull();
        });

        it('parses a well-formed remote doc', async () => {
            const firestore = await import('firebase/firestore');
            vi.spyOn(firestore, 'getDoc').mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    favorites: ['r1', 'r2'],
                    ratings: { r1: 5, r2: 3 },
                    mealPlan: [{ id: 'mp1', date: '2026-06-21', recipeId: 'r1', addedAt: 100 }],
                }),
            } as unknown as Awaited<ReturnType<typeof import('firebase/firestore').getDoc>>);
            const result = await fetchRemotePrefs('grandma-joan');
            expect(result).toEqual({
                favorites: ['r1', 'r2'],
                ratings: { r1: 5, r2: 3 },
                collections: [],
                mealPlan: [{ id: 'mp1', date: '2026-06-21', recipeId: 'r1', addedAt: 100 }],
                groceryList: [],
                notes: [],
                displayName: undefined,
            });
        });

        it('filters bogus favorites and clamps ratings', async () => {
            const firestore = await import('firebase/firestore');
            vi.spyOn(firestore, 'getDoc').mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    favorites: ['r1', 42, null, 'r2'],
                    ratings: { r1: 8, r2: 'nope', r3: 0, r4: 3 },
                }),
            } as unknown as Awaited<ReturnType<typeof import('firebase/firestore').getDoc>>);
            const result = await fetchRemotePrefs('grandma-joan');
            expect(result?.favorites).toEqual(['r1', 'r2']);
            expect(result?.ratings).toEqual({ r1: 5, r3: 1, r4: 3 });
            expect(result?.mealPlan).toEqual([]);
        });

        it('returns null on read errors without throwing', async () => {
            const firestore = await import('firebase/firestore');
            vi.spyOn(firestore, 'getDoc').mockRejectedValueOnce(new Error('offline'));
            const result = await fetchRemotePrefs('grandma-joan');
            expect(result).toBeNull();
        });
    });

    describe('writeRemotePrefs (firebase configured)', () => {
        beforeEach(() => {
            localStorage.setItem('schafer_active_provider', 'firebase');
            localStorage.setItem(
                'schafer_firebase_config',
                JSON.stringify({ apiKey: 'k', projectId: 'p' })
            );
        });

        it('calls setDoc with favorites + ratings + merge option', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValueOnce(undefined as unknown as void);
            const ok = await writeRemotePrefs('grandma-joan', {
                favorites: ['r1', 'r1', 'r2'],
                ratings: { r1: 4 },
                collections: [{ id: 'c1', name: 'Faves', recipeIds: ['r1'], createdBy: 'g', icon: '📚', timestamp: '2026-01-01T00:00:00.000Z' }],
            });
            expect(ok).toBe(true);
            expect(setDocSpy).toHaveBeenCalled();
            const [, payload, options] = setDocSpy.mock.calls[setDocSpy.mock.calls.length - 1];
            const typed = payload as {
                favorites: string[];
                ratings: Record<string, number>;
                collections: RecipeCollection[];
                mealPlan: MealPlanEntry[];
                groceryList: GroceryItem[];
            };
            expect([...typed.favorites].sort()).toEqual(['r1', 'r2']);
            expect(typed.ratings).toEqual({ r1: 4 });
            expect(typed.collections).toHaveLength(1);
            expect(typed.mealPlan).toEqual([]);
            expect(typed.groceryList).toEqual([]);
            expect(options).toEqual({ merge: true });
        });

        it('writes meal plan entries when present', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValueOnce(undefined as unknown as void);
            await writeRemotePrefs('grandma-joan', {
                favorites: [],
                ratings: {},
                collections: [],
                mealPlan: [{ id: 'mp1', date: '2026-06-21', recipeId: 'r1', addedAt: 100 }],
            });
            const [, payload] = setDocSpy.mock.calls[setDocSpy.mock.calls.length - 1];
            expect((payload as { mealPlan: MealPlanEntry[] }).mealPlan).toEqual([
                { id: 'mp1', date: '2026-06-21', recipeId: 'r1', addedAt: 100 },
            ]);
        });

        it('returns false on write errors', async () => {
            const firestore = await import('firebase/firestore');
            vi.mocked(firestore.setDoc).mockRejectedValueOnce(new Error('network down'));
            const ok = await writeRemotePrefs('grandma-joan', { favorites: [], ratings: {}, collections: [] });
            expect(ok).toBe(false);
        });
    });

    describe('createDebouncedWriter', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            localStorage.setItem('schafer_active_provider', 'firebase');
            localStorage.setItem(
                'schafer_firebase_config',
                JSON.stringify({ apiKey: 'k', projectId: 'p' })
            );
        });

        it('coalesces rapid schedules into a single write after the delay', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValue(undefined as unknown as void);

            const writer = createDebouncedWriter(500);
            writer.schedule('grandma-joan', { favorites: ['r1'], ratings: {}, collections: [] });
            writer.schedule('grandma-joan', { favorites: ['r1', 'r2'], ratings: {}, collections: [] });
            writer.schedule('grandma-joan', { favorites: ['r1', 'r2', 'r3'], ratings: {}, collections: [] });

            expect(setDocSpy).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(500);

            expect(setDocSpy).toHaveBeenCalledTimes(1);
            const [, payload] = setDocSpy.mock.calls[0];
            const typed = payload as { favorites: string[] };
            expect([...typed.favorites].sort()).toEqual(['r1', 'r2', 'r3']);
        });

        it('does nothing for an empty userId', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValue(undefined as unknown as void);

            const writer = createDebouncedWriter(100);
            writer.schedule('', { favorites: ['r1'], ratings: {}, collections: [] });
            await vi.advanceTimersByTimeAsync(500);

            expect(setDocSpy).not.toHaveBeenCalled();
        });

        it('cancel prevents a pending write', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValue(undefined as unknown as void);

            const writer = createDebouncedWriter(500);
            writer.schedule('grandma-joan', { favorites: ['r1'], ratings: {}, collections: [] });
            writer.cancel('grandma-joan');
            await vi.advanceTimersByTimeAsync(500);

            expect(setDocSpy).not.toHaveBeenCalled();
        });

        it('flush immediately writes a pending payload', async () => {
            const firestore = await import('firebase/firestore');
            const setDocSpy = vi.mocked(firestore.setDoc);
            setDocSpy.mockResolvedValue(undefined as unknown as void);

            const writer = createDebouncedWriter(10_000);
            writer.schedule('grandma-joan', { favorites: ['r1'], ratings: { r1: 4 }, collections: [] });
            const ok = await writer.flush('grandma-joan');

            expect(setDocSpy).toHaveBeenCalledTimes(1);
            expect(ok).toBe(true);
        });
    });

    describe('parseNotes', () => {
        it('keeps well-formed notes and drops malformed entries', () => {
            const parsed = parseNotes([
                {
                    id: 'n1',
                    recipeId: 'r1',
                    userName: 'Dawn',
                    text: 'Use browned butter.',
                    timestamp: '2026-06-01T00:00:00.000Z',
                },
                { id: 'n2', recipeId: 'r1', userName: 'Dawn', text: '   ', timestamp: 'x' },
                { id: '', recipeId: 'r1', userName: 'Dawn', text: 'no id', timestamp: 'x' },
                'not an object',
                null,
            ]);
            expect(parsed).toHaveLength(1);
            expect(parsed[0]?.id).toBe('n1');
        });

        it('returns an empty list for non-array input', () => {
            expect(parseNotes({ n1: {} })).toEqual([]);
            expect(parseNotes(undefined)).toEqual([]);
        });
    });

    describe('mergeNotes', () => {
        const note = (id: string, timestamp: string, text = 'tip'): RecipeNote => ({
            id,
            recipeId: 'r1',
            userName: 'Dawn',
            text,
            timestamp,
        });

        it('unions notes from both sides by id', () => {
            const merged = mergeNotes(
                [note('a', '2026-06-01T00:00:00.000Z')],
                [note('b', '2026-06-02T00:00:00.000Z')]
            );
            expect(merged.map((n) => n.id)).toEqual(['a', 'b']);
        });

        it('prefers the newer version on id collision', () => {
            const merged = mergeNotes(
                [note('a', '2026-06-01T00:00:00.000Z', 'old')],
                [note('a', '2026-06-05T00:00:00.000Z', 'new')]
            );
            expect(merged).toHaveLength(1);
            expect(merged[0]?.text).toBe('new');
        });

        it('sorts merged notes oldest-first', () => {
            const merged = mergeNotes(
                [note('later', '2026-06-09T00:00:00.000Z')],
                [note('earlier', '2026-06-01T00:00:00.000Z')]
            );
            expect(merged.map((n) => n.id)).toEqual(['earlier', 'later']);
        });
    });
});
