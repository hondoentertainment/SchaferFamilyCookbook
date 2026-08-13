import { describe, it, expect } from 'vitest';
import { isoWeekKey, recipeOfTheWeek } from './recipeOfTheWeek';
import type { Recipe } from '../types';

const makeRecipe = (id: string): Recipe =>
    ({ id, title: `Recipe ${id}`, category: 'Main', contributor: 'Alice', ingredients: [], instructions: [], image: '' }) as unknown as Recipe;

const catalog = ['r1', 'r2', 'r3', 'r4', 'r5'].map(makeRecipe);

describe('isoWeekKey', () => {
    it('computes known ISO weeks', () => {
        // Thu Jan 1 2026 → first week of 2026.
        expect(isoWeekKey(new Date(2026, 0, 1))).toBe('2026-W01');
        // Fri Jan 1 2027 belongs to 2026's final week (W53), per ISO 8601.
        expect(isoWeekKey(new Date(2027, 0, 1))).toBe('2026-W53');
        // Mon Dec 28 2026 is still W53 of 2026.
        expect(isoWeekKey(new Date(2026, 11, 28))).toBe('2026-W53');
    });

    it('is stable across all days of one ISO week (Mon–Sun)', () => {
        // Mon Jul 13 2026 … Sun Jul 19 2026 are one ISO week.
        const keys = [13, 14, 15, 16, 17, 18, 19].map((d) => isoWeekKey(new Date(2026, 6, d)));
        expect(new Set(keys).size).toBe(1);
        // The following Monday starts a new week.
        expect(isoWeekKey(new Date(2026, 6, 20))).not.toBe(keys[0]);
    });
});

describe('recipeOfTheWeek', () => {
    it('returns null for an empty catalog', () => {
        expect(recipeOfTheWeek([], new Date(2026, 6, 15))).toBeNull();
    });

    it('picks the same recipe for every day of the same week', () => {
        const picks = [13, 14, 15, 16, 17, 18, 19].map(
            (d) => recipeOfTheWeek(catalog, new Date(2026, 6, d))!.id
        );
        expect(new Set(picks).size).toBe(1);
    });

    it('is independent of input ordering', () => {
        const shuffled = [catalog[3], catalog[0], catalog[4], catalog[2], catalog[1]];
        const date = new Date(2026, 6, 15);
        expect(recipeOfTheWeek(shuffled, date)!.id).toBe(recipeOfTheWeek(catalog, date)!.id);
    });

    it('rotates across weeks (covers multiple recipes over a stretch of weeks)', () => {
        const picks = new Set<string>();
        for (let week = 0; week < 20; week++) {
            const date = new Date(2026, 0, 5 + week * 7); // consecutive Mondays
            picks.add(recipeOfTheWeek(catalog, date)!.id);
        }
        // A 31-multiplier week-key hash over 20 weeks must hit more than one
        // of five recipes; a constant pick would mean rotation is broken.
        expect(picks.size).toBeGreaterThan(1);
    });

    it('never returns undefined for a single-recipe catalog', () => {
        const single = [makeRecipe('only')];
        expect(recipeOfTheWeek(single, new Date(2026, 6, 15))!.id).toBe('only');
    });
});
