/**
 * Weekly meal-plan persistence.
 *
 * Stored in localStorage under `STORAGE_KEYS.mealPlan` as a JSON array of
 * `MealPlanEntry`. Each entry assigns one recipe to one calendar day.
 */
import { STORAGE_KEYS } from '../constants/storage';
import { notifyPrefsChanged } from '../services/userPrefsSync';

export interface MealPlanEntry {
  id: string;
  /** Local calendar day, formatted YYYY-MM-DD. */
  date: string;
  recipeId: string;
  addedAt: number;
}

/** Format a Date as a local YYYY-MM-DD key (timezone-stable, no UTC shift). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Return a new Date `n` days after `d`, normalized to local midnight. */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** Sunday of the week containing `d`, at local midnight. */
export function getWeekStart(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - r.getDay());
  return r;
}

/** The seven local-midnight Dates of the week beginning at `weekStart`. */
export function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function getMealPlan(): MealPlanEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.mealPlan);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is MealPlanEntry =>
        x &&
        typeof x === 'object' &&
        typeof x.id === 'string' &&
        typeof x.date === 'string' &&
        typeof x.recipeId === 'string' &&
        typeof x.addedAt === 'number',
    );
  } catch {
    return [];
  }
}

function save(entries: MealPlanEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.mealPlan, JSON.stringify(entries));
    notifyPrefsChanged();
  } catch {
    // ignore quota / disabled storage
  }
}

/** Entries assigned to a single day, oldest first. */
export function getEntriesForDate(dateKey: string): MealPlanEntry[] {
  return getMealPlan()
    .filter((e) => e.date === dateKey)
    .sort((a, b) => a.addedAt - b.addedAt);
}

/** Entries assigned to any day within `[startKey, endKey]` inclusive. */
export function getEntriesInRange(startKey: string, endKey: string): MealPlanEntry[] {
  return getMealPlan().filter((e) => e.date >= startKey && e.date <= endKey);
}

/**
 * Assign a recipe to a day. A recipe already on that day is left untouched.
 * Returns the full plan after insertion.
 */
export function addToMealPlan(dateKey: string, recipeId: string): MealPlanEntry[] {
  const all = getMealPlan();
  if (all.some((e) => e.date === dateKey && e.recipeId === recipeId)) {
    return all;
  }
  const next: MealPlanEntry[] = [
    ...all,
    {
      id: 'mp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: dateKey,
      recipeId,
      addedAt: Date.now(),
    },
  ];
  save(next);
  return next;
}

/** Remove a single entry by id. */
export function removeFromMealPlan(entryId: string): MealPlanEntry[] {
  const next = getMealPlan().filter((e) => e.id !== entryId);
  save(next);
  return next;
}

function genEntryId(): string {
  return 'mp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Copy every recipe assigned to `fromKey` onto `toKey`, skipping recipes that
 * already exist on the destination day. Returns the number of entries added.
 */
export function copyDay(fromKey: string, toKey: string): number {
  if (fromKey === toKey) return 0;
  const all = getMealPlan();
  const source = all.filter((e) => e.date === fromKey);
  if (source.length === 0) return 0;

  const existing = new Set(
    all.filter((e) => e.date === toKey).map((e) => e.recipeId),
  );
  const now = Date.now();
  const added: MealPlanEntry[] = [];
  for (const entry of source) {
    if (existing.has(entry.recipeId)) continue;
    existing.add(entry.recipeId);
    added.push({ id: genEntryId(), date: toKey, recipeId: entry.recipeId, addedAt: now });
  }
  if (added.length === 0) return 0;
  save([...all, ...added]);
  return added.length;
}

/**
 * Copy a full week's plan onto another week. `fromWeekKeys` and `toWeekKeys`
 * are parallel 7-element arrays of date keys. Recipes already present on a
 * destination day are skipped. Returns the number of entries added.
 */
export function copyWeek(fromWeekKeys: string[], toWeekKeys: string[]): number {
  const all = getMealPlan();
  const now = Date.now();
  const added: MealPlanEntry[] = [];
  const len = Math.min(fromWeekKeys.length, toWeekKeys.length);
  for (let i = 0; i < len; i++) {
    const fromKey = fromWeekKeys[i];
    const toKey = toWeekKeys[i];
    if (fromKey === toKey) continue;
    const existing = new Set(
      [...all, ...added].filter((e) => e.date === toKey).map((e) => e.recipeId),
    );
    for (const entry of all.filter((e) => e.date === fromKey)) {
      if (existing.has(entry.recipeId)) continue;
      existing.add(entry.recipeId);
      added.push({ id: genEntryId(), date: toKey, recipeId: entry.recipeId, addedAt: now });
    }
  }
  if (added.length === 0) return 0;
  save([...all, ...added]);
  return added.length;
}

/** Remove every entry from the plan. */
export function clearMealPlan(): MealPlanEntry[] {
  save([]);
  return [];
}
