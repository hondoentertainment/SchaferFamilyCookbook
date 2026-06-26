/**
 * Grocery list persistence + event-based subscription.
 *
 * Stored in localStorage under `groceryList:v1` as a JSON array of `GroceryItem`.
 * Components can subscribe via `subscribeGroceryList` to re-render when the list changes.
 * When Firebase is configured, changes also sync via `userPrefs.groceryList`.
 */

import { notifyPrefsChanged } from '../services/userPrefsSync';
import type { Recipe } from '../types';

export interface GroceryItem {
    id: string;
    text: string;
    recipeId?: string;
    recipeTitle?: string;
    checked: boolean;
    addedAt: number;
}

export const GROCERY_LIST_STORAGE_KEY = 'groceryList:v1';
const GROCERY_LIST_EVENT = 'grocery-list:changed';

type Listener = () => void;

function loadItems(): GroceryItem[] {
    try {
        const raw = localStorage.getItem(GROCERY_LIST_STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        // Filter to well-formed entries; tolerate partial legacy data
        return arr
            .filter(
                (x): x is GroceryItem =>
                    x &&
                    typeof x === 'object' &&
                    typeof x.id === 'string' &&
                    typeof x.text === 'string' &&
                    typeof x.checked === 'boolean' &&
                    typeof x.addedAt === 'number',
            )
            .map((x) => ({
                id: x.id,
                text: x.text,
                recipeId: typeof x.recipeId === 'string' ? x.recipeId : undefined,
                recipeTitle: typeof x.recipeTitle === 'string' ? x.recipeTitle : undefined,
                checked: x.checked,
                addedAt: x.addedAt,
            }));
    } catch {
        return [];
    }
}

function saveItems(items: GroceryItem[], options?: { skipSync?: boolean }): void {
    try {
        localStorage.setItem(GROCERY_LIST_STORAGE_KEY, JSON.stringify(items));
    } catch {
        // ignore quota / disabled storage
    }
    emitChange();
    if (!options?.skipSync) {
        notifyPrefsChanged();
    }
}

/** Replace the full list during cloud hydration without scheduling a remote write. */
export function applyGroceryItemsFromSync(items: GroceryItem[]): void {
    saveItems(items, { skipSync: true });
}

/** Return the current grocery list (most-recently-added first). */
export function getItems(): GroceryItem[] {
    return loadItems();
}

function dedupKey(recipeId: string | undefined, text: string): string {
    const normalized = text.trim().toLowerCase();
    return `${recipeId ?? ''}::${normalized}`;
}

function genId(): string {
    return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Append items to the list. Duplicates (same `recipeId` + normalized `text`) are skipped.
 * Returns the full list after insertion.
 */
export function addItems(
    items: Array<Omit<GroceryItem, 'id' | 'checked' | 'addedAt'>>,
): GroceryItem[] {
    const current = loadItems();
    const existingKeys = new Set(current.map((it) => dedupKey(it.recipeId, it.text)));
    const now = Date.now();
    const toAdd: GroceryItem[] = [];
    for (const raw of items) {
        const text = (raw?.text ?? '').trim();
        if (!text) continue;
        const key = dedupKey(raw.recipeId, text);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        toAdd.push({
            id: genId(),
            text,
            recipeId: raw.recipeId,
            recipeTitle: raw.recipeTitle,
            checked: false,
            addedAt: now,
        });
    }
    if (toAdd.length === 0) {
        return current;
    }
    // Newest first so the UI naturally shows recent additions up top
    const next = [...toAdd, ...current];
    saveItems(next);
    return next;
}

/** Toggle the `checked` flag for a single item. No-op if the id is unknown. */
export function toggleItem(id: string): GroceryItem[] {
    const current = loadItems();
    let changed = false;
    const next = current.map((it) => {
        if (it.id === id) {
            changed = true;
            return { ...it, checked: !it.checked };
        }
        return it;
    });
    if (!changed) return current;
    saveItems(next);
    return next;
}

/** Remove a single item by id. */
export function removeItem(id: string): GroceryItem[] {
    const current = loadItems();
    const next = current.filter((it) => it.id !== id);
    if (next.length === current.length) return current;
    saveItems(next);
    return next;
}

/** Remove all checked items. */
export function clearChecked(): GroceryItem[] {
    const current = loadItems();
    const next = current.filter((it) => !it.checked);
    if (next.length === current.length) return current;
    saveItems(next);
    return next;
}

/** Remove every item from the list. */
export function clearAll(): GroceryItem[] {
    const current = loadItems();
    if (current.length === 0) return current;
    saveItems([]);
    return [];
}

function emitChange(): void {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    try {
        window.dispatchEvent(new CustomEvent(GROCERY_LIST_EVENT));
    } catch {
        // CustomEvent may not be supported in very old browsers; ignore.
    }
}

/**
 * Subscribe to grocery-list changes. Returns an unsubscribe function.
 * Listeners are fired after any mutation from this module and on `storage`
 * events (so other tabs stay in sync too).
 */
export function subscribeGroceryList(listener: Listener): () => void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
        return () => {};
    }
    const handler = () => listener();
    const storageHandler = (e: StorageEvent) => {
        if (e.key === GROCERY_LIST_STORAGE_KEY) listener();
    };
    window.addEventListener(GROCERY_LIST_EVENT, handler);
    window.addEventListener('storage', storageHandler);
    return () => {
        window.removeEventListener(GROCERY_LIST_EVENT, handler);
        window.removeEventListener('storage', storageHandler);
    };
}

/** Plain-text export grouped by recipe for copy/share at the store. */
export function formatGroceryListExport(items: GroceryItem[]): string {
    if (items.length === 0) return '';

    const order: string[] = [];
    const map = new Map<string, GroceryItem[]>();
    for (const item of items) {
        const key = item.recipeTitle?.trim() ? item.recipeTitle.trim() : 'Other';
        if (!map.has(key)) {
            map.set(key, []);
            order.push(key);
        }
        map.get(key)!.push(item);
    }
    const ordered = order.filter((k) => k !== 'Other');
    if (map.has('Other')) ordered.push('Other');

    const lines: string[] = ['Schafer Family Cookbook — Grocery List', ''];
    for (const title of ordered) {
        const group = map.get(title) ?? [];
        lines.push(title);
        for (const item of group) {
            const mark = item.checked ? '☑' : '☐';
            lines.push(`  ${mark} ${item.text}`);
        }
        lines.push('');
    }
    return lines.join('\n').trimEnd();
}

/** Build grocery rows from one or more recipes (ingredients only). */
export function buildGroceryRowsFromRecipes(recipes: Recipe[]): Array<Omit<GroceryItem, 'id' | 'checked' | 'addedAt'>> {
    return recipes.flatMap((recipe) =>
        recipe.ingredients
            .filter((ing) => ing.trim().length > 0)
            .map((ing) => ({ text: ing, recipeId: recipe.id, recipeTitle: recipe.title })),
    );
}

/** Add ingredients from recipes; returns how many rows were added vs skipped as duplicates. */
export function addRecipeIngredientsToGrocery(recipes: Recipe[]): { added: number; skipped: number } {
    const rows = buildGroceryRowsFromRecipes(recipes);
    if (rows.length === 0) return { added: 0, skipped: 0 };
    const prevCount = loadItems().length;
    const next = addItems(rows);
    const added = Math.max(0, next.length - prevCount);
    return { added, skipped: Math.max(0, rows.length - added) };
}
