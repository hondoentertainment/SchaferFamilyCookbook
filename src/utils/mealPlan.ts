const STORAGE_KEY = 'schafer_meal_plan';
const EVENT_NAME = 'schafer:meal-plan-changed';

export interface MealPlanEntry {
    id: string;
    /** Sunday of the week, formatted YYYY-MM-DD */
    weekStart: string;
    /** Day of week: 0 = Sunday, 6 = Saturday */
    day: number;
    recipeId: string;
    recipeTitle: string;
    addedAt: number;
}

/** Pad a number to 2 digits (e.g. 4 -> "04"). */
function pad(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}

/** Format a Date as a local YYYY-MM-DD string (no timezone shift). */
function formatLocalDate(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Returns the Sunday (start of week) for the given date as YYYY-MM-DD.
 * Sunday itself returns its own date; Saturday rolls back 6 days.
 */
export function getWeekStart(d: Date): string {
    const day = d.getDay();
    const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    return formatLocalDate(sunday);
}

/** Parse a YYYY-MM-DD string into a local Date (midnight). */
export function parseDate(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

/** Add `days` days to a YYYY-MM-DD string and return the new YYYY-MM-DD. */
export function addDays(weekStart: string, days: number): string {
    const d = parseDate(weekStart);
    d.setDate(d.getDate() + days);
    return formatLocalDate(d);
}

function loadAll(): MealPlanEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw) as MealPlanEntry[];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function saveAll(entries: MealPlanEntry[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    notifyChange();
}

function notifyChange(): void {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
            window.dispatchEvent(new CustomEvent(EVENT_NAME));
        } catch {
            // ignore (e.g. CustomEvent unsupported in test env)
        }
    }
}

/** Subscribe to meal plan changes; returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = () => listener();
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
}

/** Get all entries for the given week (sorted by day, then addedAt). */
export function getEntriesForWeek(weekStart: string): MealPlanEntry[] {
    return loadAll()
        .filter((e) => e.weekStart === weekStart)
        .sort((a, b) => a.day - b.day || a.addedAt - b.addedAt);
}

/** Get all stored meal plan entries (any week). */
export function getAllEntries(): MealPlanEntry[] {
    return loadAll();
}

/** Add a recipe to a day; returns the new entry. */
export function addEntry(
    weekStart: string,
    day: number,
    recipe: { id: string; title: string },
): MealPlanEntry {
    const entry: MealPlanEntry = {
        id: `mp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        weekStart,
        day,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        addedAt: Date.now(),
    };
    const all = loadAll();
    all.push(entry);
    saveAll(all);
    return entry;
}

/** Remove a single entry by id. */
export function removeEntry(id: string): void {
    const all = loadAll().filter((e) => e.id !== id);
    saveAll(all);
}

/** Remove all entries for the given week. */
export function clearWeek(weekStart: string): void {
    const all = loadAll().filter((e) => e.weekStart !== weekStart);
    saveAll(all);
}
