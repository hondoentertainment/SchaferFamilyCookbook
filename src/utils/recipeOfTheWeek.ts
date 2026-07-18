import type { Recipe } from '../types';

/**
 * ISO-8601 week key (`2026-W29`) for a local calendar date. The week-year is
 * decided by the week's Thursday, per ISO 8601, so year boundaries rotate
 * cleanly (Dec 29–31 can belong to week 1 of the next year and vice versa).
 */
export function isoWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

/**
 * Deterministic weekly pick: every family member sees the same recipe all
 * week, and it rotates when the ISO week changes. Sorted by id first so the
 * pick doesn't depend on fetch order.
 */
export function recipeOfTheWeek(recipes: Recipe[], date: Date = new Date()): Recipe | null {
    if (recipes.length === 0) return null;
    const sorted = [...recipes].sort((a, b) => a.id.localeCompare(b.id));
    return sorted[hashString(isoWeekKey(date)) % sorted.length];
}
