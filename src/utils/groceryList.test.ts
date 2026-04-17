import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addGroceryItems,
  clearAllGroceryItems,
  clearCheckedGroceryItems,
  getGroceryList,
  removeGroceryItem,
  toggleGroceryItem,
} from './groceryList';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('groceryList', () => {
  it('starts empty', () => {
    expect(getGroceryList()).toEqual([]);
  });

  it('adds items and dedupes case-insensitively', () => {
    addGroceryItems(['2 cups flour', 'Salt']);
    const after = addGroceryItems(['SALT', 'sugar']);
    const texts = after.map((i) => i.text.toLowerCase());
    expect(texts).toContain('2 cups flour');
    expect(texts).toContain('sugar');
    expect(texts.filter((t) => t === 'salt').length).toBe(1);
  });

  it('associates with a recipe', () => {
    addGroceryItems(['eggs'], { recipeId: 'r1', recipeTitle: 'Pancakes' });
    const list = getGroceryList();
    expect(list[0].recipeId).toBe('r1');
    expect(list[0].recipeTitle).toBe('Pancakes');
  });

  it('toggles checked state', () => {
    addGroceryItems(['milk']);
    const id = getGroceryList()[0].id;
    const after = toggleGroceryItem(id);
    expect(after[0].checked).toBe(true);
    const again = toggleGroceryItem(id);
    expect(again[0].checked).toBe(false);
  });

  it('removes one item', () => {
    addGroceryItems(['a', 'b']);
    const id = getGroceryList()[0].id;
    const after = removeGroceryItem(id);
    expect(after.length).toBe(1);
  });

  it('clears checked items', () => {
    addGroceryItems(['a', 'b', 'c']);
    const ids = getGroceryList().map((i) => i.id);
    toggleGroceryItem(ids[0]);
    toggleGroceryItem(ids[2]);
    const after = clearCheckedGroceryItems();
    expect(after.length).toBe(1);
    expect(after[0].text).toBe('b');
  });

  it('clears all', () => {
    addGroceryItems(['a', 'b']);
    expect(clearAllGroceryItems()).toEqual([]);
    expect(getGroceryList()).toEqual([]);
  });

  it('ignores empty / whitespace strings', () => {
    const after = addGroceryItems(['   ', '', 'flour']);
    expect(after.map((i) => i.text)).toEqual(['flour']);
  });
});
