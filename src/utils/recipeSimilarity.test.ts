import { describe, it, expect } from 'vitest';
import { getRelatedRecipes, scoreRecipe } from './recipeSimilarity';
import { Recipe } from '../types';

const makeRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
    id: 'r-default',
    title: 'Default Recipe',
    contributor: 'Alice',
    category: 'Main',
    ingredients: ['1 cup flour', '2 eggs'],
    instructions: ['Mix', 'Bake'],
    image: '',
    ...overrides,
});

describe('recipeSimilarity', () => {
    describe('scoreRecipe', () => {
        it('awards +3 for same category', () => {
            const current = makeRecipe({ id: 'a', category: 'Dessert', contributor: 'A', ingredients: [] });
            const same = makeRecipe({ id: 'b', category: 'Dessert', contributor: 'B', ingredients: [] });
            expect(scoreRecipe(current, same)).toBe(3);
        });

        it('awards +2 for same contributor', () => {
            const current = makeRecipe({ id: 'a', category: 'Main', contributor: 'Alice', ingredients: [] });
            const same = makeRecipe({ id: 'b', category: 'Side', contributor: 'Alice', ingredients: [] });
            expect(scoreRecipe(current, same)).toBe(2);
        });

        it('awards +1 for ingredient word overlap (case-insensitive, >=4 chars)', () => {
            const current = makeRecipe({ id: 'a', category: 'Main', contributor: 'A', ingredients: ['1 cup FLOUR'] });
            const overlap = makeRecipe({ id: 'b', category: 'Side', contributor: 'B', ingredients: ['flour mixture'] });
            expect(scoreRecipe(current, overlap)).toBe(1);
        });

        it('does not award overlap for words shorter than 4 chars', () => {
            const current = makeRecipe({ id: 'a', category: 'Main', contributor: 'A', ingredients: ['2 eggs'] });
            // "egg" shares a 3-char root, but "eggs" is 4 chars and overlaps; use a deliberately short token.
            const noOverlap = makeRecipe({ id: 'b', category: 'Side', contributor: 'B', ingredients: ['1 oz oil'] });
            expect(scoreRecipe(current, noOverlap)).toBe(0);
        });

        it('combines all three signals additively', () => {
            const current = makeRecipe({ id: 'a', category: 'Dessert', contributor: 'Alice', ingredients: ['flour'] });
            const triple = makeRecipe({ id: 'b', category: 'Dessert', contributor: 'Alice', ingredients: ['flour'] });
            expect(scoreRecipe(current, triple)).toBe(6);
        });
    });

    describe('getRelatedRecipes', () => {
        const current = makeRecipe({
            id: 'current',
            title: 'Current Recipe',
            category: 'Dessert',
            contributor: 'Alice',
            ingredients: ['1 cup flour', '2 cups sugar'],
        });

        it('excludes the current recipe', () => {
            const all = [
                current,
                makeRecipe({ id: 'r1', title: 'A', category: 'Dessert' }),
                makeRecipe({ id: 'r2', title: 'B', category: 'Dessert' }),
            ];
            const result = getRelatedRecipes(current, all);
            expect(result.find((r) => r.id === current.id)).toBeUndefined();
        });

        it('prioritizes same category over same contributor', () => {
            const all = [
                current,
                makeRecipe({ id: 'cat', title: 'CategoryMatch', category: 'Dessert', contributor: 'Bob', ingredients: [] }),
                makeRecipe({ id: 'con', title: 'ContributorMatch', category: 'Main', contributor: 'Alice', ingredients: [] }),
            ];
            const result = getRelatedRecipes(current, all, 2);
            expect(result[0].id).toBe('cat');
            expect(result[1].id).toBe('con');
        });

        it('places same-contributor matches above ingredient-only overlaps', () => {
            const all = [
                current,
                makeRecipe({ id: 'con', title: 'Z Contributor', category: 'Main', contributor: 'Alice', ingredients: [] }),
                makeRecipe({ id: 'ing', title: 'A Ingredient', category: 'Main', contributor: 'Bob', ingredients: ['flour blend'] }),
            ];
            const result = getRelatedRecipes(current, all, 2);
            expect(result[0].id).toBe('con');
            expect(result[1].id).toBe('ing');
        });

        it('boosts candidates that share ingredient words', () => {
            const all = [
                current,
                makeRecipe({ id: 'plain', title: 'Plain', category: 'Main', contributor: 'Bob', ingredients: ['oil', 'salt'] }),
                makeRecipe({ id: 'overlap', title: 'Overlap', category: 'Main', contributor: 'Bob', ingredients: ['flour'] }),
            ];
            const result = getRelatedRecipes(current, all, 1);
            expect(result[0].id).toBe('overlap');
        });

        it('breaks ties by title ascending', () => {
            const all = [
                current,
                makeRecipe({ id: 'b', title: 'Banana Bread', category: 'Dessert', contributor: 'Bob', ingredients: [] }),
                makeRecipe({ id: 'a', title: 'Apple Tart', category: 'Dessert', contributor: 'Bob', ingredients: [] }),
            ];
            const result = getRelatedRecipes(current, all, 2);
            expect(result.map((r) => r.id)).toEqual(['a', 'b']);
        });

        it('tops up with deterministic title-sorted picks when no candidates score > 0', () => {
            const isolated = makeRecipe({
                id: 'isolated',
                title: 'Isolated',
                category: 'Snack',
                contributor: 'Zach',
                ingredients: ['quinoa'],
            });
            const all = [
                isolated,
                makeRecipe({ id: 'b', title: 'Bravo', category: 'Bread', contributor: 'Bob', ingredients: ['xanthan'] }),
                makeRecipe({ id: 'a', title: 'Alpha', category: 'Bread', contributor: 'Bob', ingredients: ['xanthan'] }),
                makeRecipe({ id: 'c', title: 'Charlie', category: 'Bread', contributor: 'Bob', ingredients: ['xanthan'] }),
            ];
            const result = getRelatedRecipes(isolated, all, 3);
            expect(result.map((r) => r.id)).toEqual(['a', 'b', 'c']);
        });

        it('mixes positive-score picks with title-sorted top-ups when needed', () => {
            const all = [
                current,
                makeRecipe({ id: 'cat', title: 'Z Cat Match', category: 'Dessert', contributor: 'Bob', ingredients: ['oil'] }),
                makeRecipe({ id: 'fillerB', title: 'Bravo Filler', category: 'Snack', contributor: 'Zane', ingredients: ['xanthan'] }),
                makeRecipe({ id: 'fillerA', title: 'Alpha Filler', category: 'Snack', contributor: 'Zane', ingredients: ['xanthan'] }),
            ];
            const result = getRelatedRecipes(current, all, 3);
            expect(result[0].id).toBe('cat');
            expect(result.slice(1).map((r) => r.id)).toEqual(['fillerA', 'fillerB']);
        });

        it('never returns duplicates', () => {
            const all = [
                current,
                makeRecipe({ id: 'r1', title: 'One', category: 'Dessert', contributor: 'Alice', ingredients: ['flour'] }),
                makeRecipe({ id: 'r2', title: 'Two', category: 'Main', contributor: 'Bob', ingredients: ['salt'] }),
                makeRecipe({ id: 'r3', title: 'Three', category: 'Main', contributor: 'Bob', ingredients: ['oil'] }),
            ];
            const result = getRelatedRecipes(current, all, 3);
            const ids = result.map((r) => r.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('respects the limit argument', () => {
            const all = [
                current,
                makeRecipe({ id: 'r1', title: 'One', category: 'Dessert' }),
                makeRecipe({ id: 'r2', title: 'Two', category: 'Dessert' }),
                makeRecipe({ id: 'r3', title: 'Three', category: 'Dessert' }),
                makeRecipe({ id: 'r4', title: 'Four', category: 'Dessert' }),
            ];
            expect(getRelatedRecipes(current, all, 2)).toHaveLength(2);
            expect(getRelatedRecipes(current, all, 3)).toHaveLength(3);
            expect(getRelatedRecipes(current, all, 10)).toHaveLength(4);
        });

        it('produces deterministic output across calls (same input -> same order)', () => {
            const all = [
                current,
                makeRecipe({ id: 'r1', title: 'Gamma', category: 'Dessert', contributor: 'Bob' }),
                makeRecipe({ id: 'r2', title: 'Alpha', category: 'Dessert', contributor: 'Bob' }),
                makeRecipe({ id: 'r3', title: 'Beta', category: 'Main', contributor: 'Alice' }),
                makeRecipe({ id: 'r4', title: 'Delta', category: 'Snack', contributor: 'Zach' }),
            ];
            const a = getRelatedRecipes(current, all, 3);
            const b = getRelatedRecipes(current, all, 3);
            expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
        });

        it('returns empty array when no other recipes exist', () => {
            expect(getRelatedRecipes(current, [current])).toEqual([]);
            expect(getRelatedRecipes(current, [])).toEqual([]);
        });

        it('handles recipes with empty ingredients without errors', () => {
            const noIng = makeRecipe({ id: 'curr', ingredients: [] });
            const all = [
                noIng,
                makeRecipe({ id: 'r1', title: 'One', category: noIng.category, ingredients: [] }),
            ];
            const result = getRelatedRecipes(noIng, all);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('r1');
        });
    });
});
