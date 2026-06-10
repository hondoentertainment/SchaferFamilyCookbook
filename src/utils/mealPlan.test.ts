import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addDays,
  addToMealPlan,
  clearMealPlan,
  getEntriesForDate,
  getEntriesInRange,
  getMealPlan,
  getWeekDates,
  getWeekStart,
  removeFromMealPlan,
  toDateKey,
} from './mealPlan';

describe('mealPlan date helpers', () => {
  it('toDateKey formats a local YYYY-MM-DD without UTC drift', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('addDays advances the date and crosses month boundaries', () => {
    expect(toDateKey(addDays(new Date(2026, 0, 30), 3))).toBe('2026-02-02');
  });

  it('getWeekStart returns the Sunday of the containing week', () => {
    // 2026-05-16 is a Saturday → week starts Sunday 2026-05-10.
    expect(getWeekStart(new Date(2026, 4, 16)).getDay()).toBe(0);
    expect(toDateKey(getWeekStart(new Date(2026, 4, 16)))).toBe('2026-05-10');
  });

  it('getWeekDates returns seven consecutive days', () => {
    const dates = getWeekDates(getWeekStart(new Date(2026, 4, 16)));
    expect(dates).toHaveLength(7);
    expect(toDateKey(dates[0])).toBe('2026-05-10');
    expect(toDateKey(dates[6])).toBe('2026-05-16');
  });
});

describe('mealPlan persistence', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
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
    expect(getMealPlan()).toEqual([]);
  });

  it('adds a recipe to a day', () => {
    addToMealPlan('2026-05-11', 'r1');
    const entries = getEntriesForDate('2026-05-11');
    expect(entries).toHaveLength(1);
    expect(entries[0].recipeId).toBe('r1');
  });

  it('does not duplicate the same recipe on the same day', () => {
    addToMealPlan('2026-05-11', 'r1');
    addToMealPlan('2026-05-11', 'r1');
    expect(getEntriesForDate('2026-05-11')).toHaveLength(1);
  });

  it('allows the same recipe on different days', () => {
    addToMealPlan('2026-05-11', 'r1');
    addToMealPlan('2026-05-12', 'r1');
    expect(getMealPlan()).toHaveLength(2);
  });

  it('removes an entry by id', () => {
    const all = addToMealPlan('2026-05-11', 'r1');
    removeFromMealPlan(all[0].id);
    expect(getMealPlan()).toEqual([]);
  });

  it('getEntriesInRange filters to the inclusive date window', () => {
    addToMealPlan('2026-05-09', 'before');
    addToMealPlan('2026-05-11', 'inside');
    addToMealPlan('2026-05-17', 'after');
    const range = getEntriesInRange('2026-05-10', '2026-05-16');
    expect(range.map((e) => e.recipeId)).toEqual(['inside']);
  });

  it('clearMealPlan empties the plan', () => {
    addToMealPlan('2026-05-11', 'r1');
    clearMealPlan();
    expect(getMealPlan()).toEqual([]);
  });
});
