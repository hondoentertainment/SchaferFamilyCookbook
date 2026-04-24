import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getAllCollections,
    createCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    getCollectionsForRecipe,
    getRandomCollectionIcon,
} from './collections';

const STORAGE_KEY = 'schafer_collections';

describe('collections utility', () => {
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
    });

    // ---------------------------------------------------------------------------
    describe('getRandomCollectionIcon', () => {
        it('returns a non-empty string', () => {
            const icon = getRandomCollectionIcon();
            expect(typeof icon).toBe('string');
            expect(icon.length).toBeGreaterThan(0);
        });
    });

    // ---------------------------------------------------------------------------
    describe('getAllCollections', () => {
        it('returns an empty array when nothing is stored', () => {
            expect(getAllCollections()).toEqual([]);
        });

        it('parses and returns stored collections', () => {
            const collections = [
                { id: 'c1', name: 'Favourites', recipeIds: [], createdBy: 'Alice', icon: '📚', timestamp: new Date().toISOString() },
            ];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
            const result = getAllCollections();
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('c1');
            expect(result[0].name).toBe('Favourites');
        });

        it('returns an empty array for malformed JSON (corruption)', () => {
            localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
            expect(getAllCollections()).toEqual([]);
        });

        it('returns an empty array when stored value is an empty JSON array', () => {
            localStorage.setItem(STORAGE_KEY, '[]');
            expect(getAllCollections()).toEqual([]);
        });
    });

    // ---------------------------------------------------------------------------
    describe('createCollection', () => {
        it('creates a collection and persists it to localStorage', () => {
            const col = createCollection('Sunday Dinners', 'Bob');
            expect(col.name).toBe('Sunday Dinners');
            expect(col.createdBy).toBe('Bob');
            expect(col.recipeIds).toEqual([]);
            expect(col.id).toBeTruthy();
            expect(col.icon).toBeTruthy();
            expect(col.timestamp).toBeTruthy();

            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
            expect(stored).toHaveLength(1);
            expect(stored[0].id).toBe(col.id);
        });

        it('trims whitespace from name', () => {
            const col = createCollection('  Holiday Baking  ', 'Carol');
            expect(col.name).toBe('Holiday Baking');
        });

        it('accepts an optional description and trims it', () => {
            const col = createCollection('Breakfast', 'Dave', '  Morning meals  ');
            expect(col.description).toBe('Morning meals');
        });

        it('uses the provided icon when supplied', () => {
            const col = createCollection('Soups', 'Eve', undefined, '🥘');
            expect(col.icon).toBe('🥘');
        });

        it('assigns a random icon when none is provided', () => {
            const col = createCollection('Pasta', 'Frank');
            expect(col.icon.length).toBeGreaterThan(0);
        });

        it('appends to existing collections without overwriting', () => {
            createCollection('First', 'Alice');
            createCollection('Second', 'Bob');
            const all = getAllCollections();
            expect(all).toHaveLength(2);
            expect(all.map((c) => c.name)).toEqual(['First', 'Second']);
        });

        it('returns the newly created collection object', () => {
            const col = createCollection('Test', 'User');
            expect(col).toMatchObject({ name: 'Test', createdBy: 'User' });
        });
    });

    // ---------------------------------------------------------------------------
    describe('deleteCollection', () => {
        it('removes the collection with the given id', () => {
            const col1 = createCollection('A', 'Alice');
            const col2 = createCollection('B', 'Bob');

            const remaining = deleteCollection(col1.id);
            expect(remaining).toHaveLength(1);
            expect(remaining[0].id).toBe(col2.id);
        });

        it('persists the deletion to localStorage', () => {
            const col = createCollection('ToDelete', 'User');
            deleteCollection(col.id);
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
            expect(stored.find((c: { id: string }) => c.id === col.id)).toBeUndefined();
        });

        it('leaves other collections intact', () => {
            const col1 = createCollection('Keep1', 'Alice');
            const col2 = createCollection('Remove', 'Bob');
            const col3 = createCollection('Keep2', 'Carol');

            deleteCollection(col2.id);
            const all = getAllCollections();
            expect(all).toHaveLength(2);
            expect(all.map((c) => c.id)).toContain(col1.id);
            expect(all.map((c) => c.id)).toContain(col3.id);
        });

        it('is a no-op when the id does not exist', () => {
            createCollection('Existing', 'Alice');
            const remaining = deleteCollection('nonexistent-id');
            expect(remaining).toHaveLength(1);
        });

        it('returns an empty array after deleting the only collection', () => {
            const col = createCollection('Solo', 'Alice');
            const remaining = deleteCollection(col.id);
            expect(remaining).toEqual([]);
        });
    });

    // ---------------------------------------------------------------------------
    describe('addToCollection', () => {
        it('adds a recipeId to the collection', () => {
            const col = createCollection('My Picks', 'Alice');
            const all = addToCollection(col.id, 'recipe-1');
            const updated = all.find((c) => c.id === col.id);
            expect(updated?.recipeIds).toContain('recipe-1');
        });

        it('persists the updated collection to localStorage', () => {
            const col = createCollection('Saved', 'Bob');
            addToCollection(col.id, 'recipe-42');
            const stored: Array<{ id: string; recipeIds: string[] }> = JSON.parse(
                localStorage.getItem(STORAGE_KEY) ?? '[]'
            );
            const saved = stored.find((c) => c.id === col.id);
            expect(saved?.recipeIds).toContain('recipe-42');
        });

        it('does not add a duplicate recipeId', () => {
            const col = createCollection('NoDupes', 'Alice');
            addToCollection(col.id, 'recipe-1');
            const result = addToCollection(col.id, 'recipe-1');
            const updated = result.find((c) => c.id === col.id);
            expect(updated?.recipeIds).toHaveLength(1);
        });

        it('can add multiple distinct recipes', () => {
            const col = createCollection('Multi', 'Bob');
            addToCollection(col.id, 'recipe-1');
            addToCollection(col.id, 'recipe-2');
            const all = getAllCollections();
            const updated = all.find((c) => c.id === col.id);
            expect(updated?.recipeIds).toEqual(['recipe-1', 'recipe-2']);
        });

        it('is a no-op when the collectionId does not exist', () => {
            createCollection('Existing', 'Alice');
            const result = addToCollection('nonexistent-id', 'recipe-1');
            // All collections returned; none modified
            result.forEach((c) => {
                expect(c.recipeIds).not.toContain('recipe-1');
            });
        });
    });

    // ---------------------------------------------------------------------------
    describe('removeFromCollection', () => {
        it('removes a recipeId from the collection', () => {
            const col = createCollection('To Remove From', 'Alice');
            addToCollection(col.id, 'recipe-1');
            addToCollection(col.id, 'recipe-2');

            const result = removeFromCollection(col.id, 'recipe-1');
            const updated = result.find((c) => c.id === col.id);
            expect(updated?.recipeIds).not.toContain('recipe-1');
            expect(updated?.recipeIds).toContain('recipe-2');
        });

        it('persists the removal to localStorage', () => {
            const col = createCollection('Saved', 'Bob');
            addToCollection(col.id, 'recipe-99');
            removeFromCollection(col.id, 'recipe-99');

            const stored: Array<{ id: string; recipeIds: string[] }> = JSON.parse(
                localStorage.getItem(STORAGE_KEY) ?? '[]'
            );
            const saved = stored.find((c) => c.id === col.id);
            expect(saved?.recipeIds).not.toContain('recipe-99');
        });

        it('leaves other recipes in the same collection intact', () => {
            const col = createCollection('Mixed', 'Carol');
            addToCollection(col.id, 'recipe-A');
            addToCollection(col.id, 'recipe-B');
            addToCollection(col.id, 'recipe-C');

            removeFromCollection(col.id, 'recipe-B');
            const all = getAllCollections();
            const updated = all.find((c) => c.id === col.id);
            expect(updated?.recipeIds).toEqual(['recipe-A', 'recipe-C']);
        });

        it('is a no-op when the recipeId is not in the collection', () => {
            const col = createCollection('NoOp', 'Dave');
            addToCollection(col.id, 'recipe-1');
            removeFromCollection(col.id, 'not-there');
            const all = getAllCollections();
            const updated = all.find((c) => c.id === col.id);
            expect(updated?.recipeIds).toEqual(['recipe-1']);
        });

        it('results in an empty recipeIds array after removing the last recipe', () => {
            const col = createCollection('Empty', 'Eve');
            addToCollection(col.id, 'recipe-1');
            const result = removeFromCollection(col.id, 'recipe-1');
            const updated = result.find((c) => c.id === col.id);
            expect(updated?.recipeIds).toEqual([]);
        });
    });

    // ---------------------------------------------------------------------------
    describe('getCollectionsForRecipe', () => {
        it('returns collections that contain the given recipeId', () => {
            const col1 = createCollection('Col1', 'Alice');
            const col2 = createCollection('Col2', 'Bob');
            addToCollection(col1.id, 'recipe-X');
            addToCollection(col2.id, 'recipe-X');
            addToCollection(col2.id, 'recipe-Y');

            const result = getCollectionsForRecipe('recipe-X');
            expect(result).toHaveLength(2);
            expect(result.map((c) => c.id)).toContain(col1.id);
            expect(result.map((c) => c.id)).toContain(col2.id);
        });

        it('returns only collections that include the recipeId, not others', () => {
            const col1 = createCollection('Contains', 'Alice');
            const col2 = createCollection('DoesNot', 'Bob');
            addToCollection(col1.id, 'recipe-1');
            addToCollection(col2.id, 'recipe-2');

            const result = getCollectionsForRecipe('recipe-1');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(col1.id);
        });

        it('returns an empty array when no collections contain the recipeId', () => {
            createCollection('EmptyCol', 'Alice');
            expect(getCollectionsForRecipe('recipe-not-added')).toEqual([]);
        });

        it('returns an empty array when there are no collections at all', () => {
            expect(getCollectionsForRecipe('recipe-1')).toEqual([]);
        });
    });

    // ---------------------------------------------------------------------------
    describe('localStorage corruption', () => {
        it('getAllCollections returns empty array for malformed JSON', () => {
            localStorage.setItem(STORAGE_KEY, 'undefined');
            expect(getAllCollections()).toEqual([]);
        });

        it('createCollection recovers from corrupt storage and creates a fresh list', () => {
            localStorage.setItem(STORAGE_KEY, 'corrupted!!');
            const col = createCollection('Fresh Start', 'Alice');
            // After recovery the new list should only contain the freshly created collection
            const stored: unknown[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
            expect(stored).toHaveLength(1);
            expect((stored[0] as { id: string }).id).toBe(col.id);
        });
    });
});
