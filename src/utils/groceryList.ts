import { STORAGE_KEYS } from '../constants/storage';

export interface GroceryItem {
  id: string;
  text: string;
  checked: boolean;
  recipeId?: string;
  recipeTitle?: string;
  addedAt: number;
}

const STORAGE_KEY = STORAGE_KEYS.grocery ?? 'schafer_grocery_list';

export function getGroceryList(): GroceryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as GroceryItem[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function setGroceryList(items: GroceryItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addGroceryItems(
  texts: string[],
  opts: { recipeId?: string; recipeTitle?: string } = {},
): GroceryItem[] {
  const current = getGroceryList();
  const now = Date.now();
  const existing = new Set(current.map((i) => i.text.toLowerCase().trim()));
  const additions: GroceryItem[] = texts
    .map((t) => t.trim())
    .filter((t) => t && !existing.has(t.toLowerCase()))
    .map((text, i) => ({
      id: `g_${now}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      text,
      checked: false,
      recipeId: opts.recipeId,
      recipeTitle: opts.recipeTitle,
      addedAt: now,
    }));
  const next = [...additions, ...current];
  setGroceryList(next);
  return next;
}

export function toggleGroceryItem(id: string): GroceryItem[] {
  const next = getGroceryList().map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
  setGroceryList(next);
  return next;
}

export function removeGroceryItem(id: string): GroceryItem[] {
  const next = getGroceryList().filter((i) => i.id !== id);
  setGroceryList(next);
  return next;
}

export function clearCheckedGroceryItems(): GroceryItem[] {
  const next = getGroceryList().filter((i) => !i.checked);
  setGroceryList(next);
  return next;
}

export function clearAllGroceryItems(): GroceryItem[] {
  setGroceryList([]);
  return [];
}
