import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getWeekStart,
    addDays,
    parseDate,
    getEntriesForWeek,
    getAllEntries,
    addEntry,
    removeEntry,
    clearWeek,
    subscribe,
} from './mealPlan';

describe('mealPlan utility', () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => store.delete(key),
            clear: () => store.clear(),
            length: 0,
            key: () => null,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('getWeekStart', () => {
        it('returns the same date when the input is already a Sunday', () => {
            // Sunday April 19, 2026
            const sunday = new Date(2026, 3, 19);
            expect(sunday.getDay()).toBe(0);
            expect(getWeekStart(sunday)).toBe('2026-04-19');
        });

        it('rolls Saturday back to the previous Sunday (start of week)', () => {
            // Saturday April 18, 2026 -> previous Sunday April 12, 2026
            const saturday = new Date(2026, 3, 18);
            expect(saturday.getDay()).toBe(6);
            expect(getWeekStart(saturday)).toBe('2026-04-12');
        });

        it('handles a midweek date (Wednesday)', () => {
            // Wednesday April 15, 2026 -> Sunday April 12, 2026
            const wed = new Date(2026, 3, 15);
            expect(wed.getDay()).toBe(3);
            expect(getWeekStart(wed)).toBe('2026-04-12');
        });

        it('handles month rollover (Sunday Jan 31 -> Sunday Jan 31; Mon Feb 1 -> Sunday Jan 31)', () => {
            // Sunday Jan 31, 2027
            const sun = new Date(2027, 0, 31);
            expect(sun.getDay()).toBe(0);
            expect(getWeekStart(sun)).toBe('2027-01-31');

            // Mon Feb 1, 2027 should roll back to Sunday Jan 31, 2027
            const mon = new Date(2027, 1, 1);
            expect(getWeekStart(mon)).toBe('2027-01-31');
        });

        it('handles year rollover (Sat Jan 1 2028 -> Sun Dec 26 2027)', () => {
            const sat = new Date(2028, 0, 1);
            expect(sat.getDay()).toBe(6);
            expect(getWeekStart(sat)).toBe('2027-12-26');
        });
    });

    describe('addDays / parseDate', () => {
        it('addDays advances by the right number of days, handling month rollover', () => {
            expect(addDays('2026-04-12', 6)).toBe('2026-04-18');
            expect(addDays('2026-04-12', 7)).toBe('2026-04-19');
            expect(addDays('2026-04-29', 7)).toBe('2026-05-06');
        });

        it('addDays accepts negative offsets (for previous-week navigation)', () => {
            expect(addDays('2026-04-12', -7)).toBe('2026-04-05');
        });

        it('parseDate returns a midnight local Date for the given YYYY-MM-DD', () => {
            const d = parseDate('2026-04-12');
            expect(d.getFullYear()).toBe(2026);
            expect(d.getMonth()).toBe(3);
            expect(d.getDate()).toBe(12);
        });
    });

    describe('CRUD: addEntry / getEntriesForWeek / removeEntry / clearWeek', () => {
        it('returns an empty array when no entries exist for that week', () => {
            expect(getEntriesForWeek('2026-04-12')).toEqual([]);
        });

        it('adds an entry that round-trips through getEntriesForWeek', () => {
            const e = addEntry('2026-04-12', 1, { id: 'r1', title: 'Pancakes' });
            expect(e.id).toBeTruthy();
            expect(e.weekStart).toBe('2026-04-12');
            expect(e.day).toBe(1);
            expect(e.recipeId).toBe('r1');
            expect(e.recipeTitle).toBe('Pancakes');

            const entries = getEntriesForWeek('2026-04-12');
            expect(entries).toHaveLength(1);
            expect(entries[0].recipeTitle).toBe('Pancakes');
        });

        it('only returns entries for the requested week', () => {
            addEntry('2026-04-12', 0, { id: 'r1', title: 'Eggs' });
            addEntry('2026-04-19', 0, { id: 'r2', title: 'Waffles' });

            expect(getEntriesForWeek('2026-04-12')).toHaveLength(1);
            expect(getEntriesForWeek('2026-04-19')).toHaveLength(1);
            expect(getAllEntries()).toHaveLength(2);
        });

        it('sorts entries by day ascending', () => {
            addEntry('2026-04-12', 5, { id: 'r3', title: 'Friday' });
            addEntry('2026-04-12', 1, { id: 'r1', title: 'Monday' });
            addEntry('2026-04-12', 3, { id: 'r2', title: 'Wednesday' });

            const days = getEntriesForWeek('2026-04-12').map((e) => e.day);
            expect(days).toEqual([1, 3, 5]);
        });

        it('removeEntry removes only the targeted entry', () => {
            const e1 = addEntry('2026-04-12', 1, { id: 'r1', title: 'Eggs' });
            addEntry('2026-04-12', 2, { id: 'r2', title: 'Soup' });

            removeEntry(e1.id);
            const entries = getEntriesForWeek('2026-04-12');
            expect(entries).toHaveLength(1);
            expect(entries[0].recipeTitle).toBe('Soup');
        });

        it('clearWeek removes all entries for the given week but leaves others', () => {
            addEntry('2026-04-12', 1, { id: 'r1', title: 'Eggs' });
            addEntry('2026-04-12', 2, { id: 'r2', title: 'Soup' });
            addEntry('2026-04-19', 0, { id: 'r3', title: 'Pasta' });

            clearWeek('2026-04-12');
            expect(getEntriesForWeek('2026-04-12')).toEqual([]);
            expect(getEntriesForWeek('2026-04-19')).toHaveLength(1);
        });
    });

    describe('subscribe', () => {
        it('fires the listener when add/remove/clear happen and stops after unsubscribe', () => {
            const listener = vi.fn();
            const unsubscribe = subscribe(listener);

            const e = addEntry('2026-04-12', 1, { id: 'r1', title: 'Eggs' });
            expect(listener).toHaveBeenCalledTimes(1);

            removeEntry(e.id);
            expect(listener).toHaveBeenCalledTimes(2);

            unsubscribe();
            addEntry('2026-04-12', 2, { id: 'r2', title: 'Soup' });
            expect(listener).toHaveBeenCalledTimes(2);
        });
    });
});
