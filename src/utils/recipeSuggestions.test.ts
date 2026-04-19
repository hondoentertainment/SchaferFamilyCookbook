import { describe, it, expect } from 'vitest';
import { Recipe } from '../types';
import { getSuggestions, scoreRecipe } from './recipeSuggestions';

const makeRecipe = (overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'title'>): Recipe => ({
    contributor: 'Alice',
    category: 'Main',
    ingredients: [],
    instructions: [],
    image: '',
    ...overrides,
});

describe('recipeSuggestions', () => {
    describe('scoreRecipe', () => {
        it('awards +3 for matching category', () => {
            const current = makeRecipe({ id: 'a', title: 'A', category: 'Dessert', contributor: 'Zoe' });
            const candidate = makeRecipe({ id: 'b', title: 'Plain', category: 'Dessert', contributor: 'Other' });
            expect(scoreRecipe(current, candidate)).toBe(3);
        });

        it('awards +2 for matching contributor', () => {
            const current = makeRecipe({ id: 'a', title: 'A', category: 'Main', contributor: 'Zoe' });
            const candidate = makeRecipe({ id: 'b', title: 'Plain', category: 'Side', contributor: 'Zoe' });
            expect(scoreRecipe(current, candidate)).toBe(2);
        });

        it('awards +1 per category keyword overlap, capped at +2', () => {
            const current = makeRecipe({ id: 'a', title: 'A', category: 'Dessert', contributor: 'Zoe' });
            // Title contains three dessert keywords: chocolate, cake, cookie — but bucket caps at 2
            const candidate = makeRecipe({
                id: 'b',
                title: 'Chocolate Cake Cookie Surprise',
                category: 'Main',
                contributor: 'Other',
            });
            expect(scoreRecipe(current, candidate)).toBe(2);
        });

        it('combines all signals', () => {
            const current = makeRecipe({ id: 'a', title: 'A', category: 'Dessert', contributor: 'Zoe' });
            const candidate = makeRecipe({
                id: 'b',
                title: 'Chocolate Cake',
                category: 'Dessert',
                contributor: 'Zoe',
            });
            // +3 category, +2 contributor, +2 keyword overlap
            expect(scoreRecipe(current, candidate)).toBe(7);
        });
    });

    describe('getSuggestions', () => {
        const current = makeRecipe({ id: 'current', title: 'Apple Pie', category: 'Dessert', contributor: 'Alice' });

        it('excludes the current recipe', () => {
            const all = [current, makeRecipe({ id: 'b', title: 'Brownies', category: 'Dessert' })];
            const result = getSuggestions(current, all);
            expect(result.find((r) => r.id === 'current')).toBeUndefined();
        });

        it('orders by score (higher first)', () => {
            const topScore = makeRecipe({
                id: 'top',
                title: 'Chocolate Cake',
                category: 'Dessert',
                contributor: 'Alice',
            });
            const midScore = makeRecipe({
                id: 'mid',
                title: 'Quinoa Bowl',
                category: 'Dessert',
                contributor: 'Bob',
            });
            const lowScore = makeRecipe({
                id: 'low',
                title: 'Steak',
                category: 'Main',
                contributor: 'Bob',
            });
            const result = getSuggestions(current, [current, midScore, lowScore, topScore]);
            expect(result.map((r) => r.id)).toEqual(['top', 'mid', 'low']);
        });

        it('honors the limit parameter', () => {
            const all: Recipe[] = [
                current,
                makeRecipe({ id: '1', title: 'One', category: 'Dessert' }),
                makeRecipe({ id: '2', title: 'Two', category: 'Dessert' }),
                makeRecipe({ id: '3', title: 'Three', category: 'Dessert' }),
                makeRecipe({ id: '4', title: 'Four', category: 'Dessert' }),
                makeRecipe({ id: '5', title: 'Five', category: 'Dessert' }),
            ];
            expect(getSuggestions(current, all, 3)).toHaveLength(3);
            expect(getSuggestions(current, all, 2)).toHaveLength(2);
            expect(getSuggestions(current, all, 10)).toHaveLength(5);
        });

        it('breaks ties alphabetically by title', () => {
            // All tied at the same score — pure alphabetical order
            const all: Recipe[] = [
                current,
                makeRecipe({ id: 'z', title: 'Zebra', category: 'Main', contributor: 'X' }),
                makeRecipe({ id: 'a', title: 'Alpha', category: 'Main', contributor: 'X' }),
                makeRecipe({ id: 'm', title: 'Middle', category: 'Main', contributor: 'X' }),
            ];
            const result = getSuggestions(current, all);
            expect(result.map((r) => r.title)).toEqual(['Alpha', 'Middle', 'Zebra']);
        });

        it('returns an empty array when no candidates exist', () => {
            expect(getSuggestions(current, [current])).toEqual([]);
            expect(getSuggestions(current, [])).toEqual([]);
        });

        it('returns an empty array when current is falsy', () => {
            expect(getSuggestions(null as unknown as Recipe, [current])).toEqual([]);
        });
    });
});
