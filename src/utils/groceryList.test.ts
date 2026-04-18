import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    GROCERY_LIST_STORAGE_KEY,
    addItems,
    clearAll,
    clearChecked,
    getItems,
    removeItem,
    subscribeGroceryList,
    toggleItem,
} from './groceryList';

describe('groceryList utility', () => {
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

    describe('getItems', () => {
        it('returns an empty array when storage is empty', () => {
            expect(getItems()).toEqual([]);
        });

        it('recovers from corrupt storage data', () => {
            localStorage.setItem(GROCERY_LIST_STORAGE_KEY, 'not-json');
            expect(getItems()).toEqual([]);
        });

        it('filters out malformed entries', () => {
            localStorage.setItem(
                GROCERY_LIST_STORAGE_KEY,
                JSON.stringify([
                    { id: 'a', text: 'ok', checked: false, addedAt: 1 },
                    { text: 'missing-id', checked: false, addedAt: 1 },
                    null,
                    'string-entry',
                ]),
            );
            const items = getItems();
            expect(items).toHaveLength(1);
            expect(items[0]?.text).toBe('ok');
        });
    });

    describe('addItems', () => {
        it('adds items and fills id/checked/addedAt', () => {
            const result = addItems([
                { text: '1 cup flour', recipeId: 'r1', recipeTitle: 'Bread' },
                { text: '2 eggs', recipeId: 'r1', recipeTitle: 'Bread' },
            ]);
            expect(result).toHaveLength(2);
            expect(result[0].id).toMatch(/^g_/);
            expect(result[0].checked).toBe(false);
            expect(typeof result[0].addedAt).toBe('number');
            expect(getItems()).toHaveLength(2);
        });

        it('deduplicates items with the same recipeId + text (case/whitespace insensitive)', () => {
            addItems([{ text: '1 cup flour', recipeId: 'r1', recipeTitle: 'Bread' }]);
            const result = addItems([
                { text: '1 cup flour', recipeId: 'r1', recipeTitle: 'Bread' },
                { text: '  1 Cup Flour  ', recipeId: 'r1', recipeTitle: 'Bread' },
                { text: '2 eggs', recipeId: 'r1', recipeTitle: 'Bread' },
            ]);
            expect(result).toHaveLength(2);
            const texts = result.map((i) => i.text);
            expect(texts.filter((t) => t.toLowerCase() === '1 cup flour')).toHaveLength(1);
        });

        it('treats identical text from different recipes as distinct', () => {
            addItems([{ text: '2 eggs', recipeId: 'r1', recipeTitle: 'Bread' }]);
            const result = addItems([{ text: '2 eggs', recipeId: 'r2', recipeTitle: 'Pasta' }]);
            expect(result).toHaveLength(2);
        });

        it('skips empty / whitespace-only rows', () => {
            const result = addItems([
                { text: '', recipeId: 'r1' },
                { text: '   ', recipeId: 'r1' },
                { text: 'salt', recipeId: 'r1' },
            ]);
            expect(result).toHaveLength(1);
            expect(result[0].text).toBe('salt');
        });

        it('inserts new items at the front of the list', () => {
            addItems([{ text: 'first', recipeId: 'r1' }]);
            const result = addItems([{ text: 'second', recipeId: 'r1' }]);
            expect(result[0].text).toBe('second');
            expect(result[1].text).toBe('first');
        });

        it('supports manual (no recipeId) entries and dedupes them', () => {
            addItems([{ text: 'Milk' }]);
            const result = addItems([{ text: 'Milk' }, { text: 'Butter' }]);
            expect(result).toHaveLength(2);
            expect(result.map((i) => i.text).sort()).toEqual(['Butter', 'Milk']);
        });
    });

    describe('toggleItem', () => {
        it('toggles the checked flag', () => {
            const [item] = addItems([{ text: 'salt' }]);
            const afterCheck = toggleItem(item.id);
            expect(afterCheck[0].checked).toBe(true);
            const afterUncheck = toggleItem(item.id);
            expect(afterUncheck[0].checked).toBe(false);
        });

        it('is a no-op for unknown ids', () => {
            addItems([{ text: 'salt' }]);
            const before = getItems();
            const after = toggleItem('nope');
            expect(after).toEqual(before);
        });
    });

    describe('removeItem', () => {
        it('removes the matching item', () => {
            const items = addItems([{ text: 'a' }, { text: 'b' }]);
            const remaining = removeItem(items[0].id);
            expect(remaining).toHaveLength(1);
            expect(remaining[0].text).not.toBe(items[0].text);
        });

        it('is a no-op for unknown ids', () => {
            const items = addItems([{ text: 'a' }]);
            const after = removeItem('does-not-exist');
            expect(after).toHaveLength(items.length);
        });
    });

    describe('clearChecked', () => {
        it('removes only items with checked=true', () => {
            const items = addItems([{ text: 'a' }, { text: 'b' }, { text: 'c' }]);
            toggleItem(items[0].id);
            toggleItem(items[2].id);
            const remaining = clearChecked();
            expect(remaining).toHaveLength(1);
            expect(remaining[0].text).toBe('b');
        });
    });

    describe('clearAll', () => {
        it('empties the list', () => {
            addItems([{ text: 'a' }, { text: 'b' }]);
            const result = clearAll();
            expect(result).toEqual([]);
            expect(getItems()).toEqual([]);
        });
    });

    describe('subscribeGroceryList', () => {
        it('notifies subscribers on add / toggle / remove / clearChecked / clearAll', () => {
            const listener = vi.fn();
            const unsubscribe = subscribeGroceryList(listener);

            const [item] = addItems([{ text: 'flour' }]);
            expect(listener).toHaveBeenCalledTimes(1);

            toggleItem(item.id);
            expect(listener).toHaveBeenCalledTimes(2);

            addItems([{ text: 'milk' }, { text: 'sugar' }]);
            expect(listener).toHaveBeenCalledTimes(3);

            clearChecked();
            // One item (flour) is checked; list changes
            expect(listener).toHaveBeenCalledTimes(4);

            removeItem(getItems()[0].id);
            expect(listener).toHaveBeenCalledTimes(5);

            // One item still remains, so clearAll does emit
            clearAll();
            expect(listener).toHaveBeenCalledTimes(6);

            unsubscribe();
            addItems([{ text: 'eggs' }]);
            expect(listener).toHaveBeenCalledTimes(6);
        });

        it('does not emit when a mutation is a no-op', () => {
            const listener = vi.fn();
            const unsubscribe = subscribeGroceryList(listener);

            toggleItem('unknown');
            removeItem('unknown');
            clearChecked();
            clearAll();
            addItems([]);
            addItems([{ text: '' }]);

            expect(listener).not.toHaveBeenCalled();
            unsubscribe();
        });
    });
});
