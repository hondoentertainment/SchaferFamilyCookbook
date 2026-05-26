import { describe, it, expect } from 'vitest';
import { getFeaturedRecipes, hasFeaturedRecipes, MAX_FEATURED_RECIPES } from './featured';
import type { Recipe } from '../types';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
    return {
        id: 'r-' + Math.random().toString(36).slice(2, 9),
        title: 'Untitled',
        contributor: 'Family',
        category: 'Main',
        ingredients: [],
        instructions: [],
        image: '',
        ...overrides,
    };
}

describe('getFeaturedRecipes', () => {
    it('returns an empty array when there are no recipes', () => {
        expect(getFeaturedRecipes([])).toEqual([]);
    });

    it('returns an empty array when no recipes are flagged featured', () => {
        const recipes = [
            makeRecipe({ id: 'a', title: 'Apple' }),
            makeRecipe({ id: 'b', title: 'Banana', featured: false }),
            makeRecipe({ id: 'c', title: 'Cherry' }),
        ];
        expect(getFeaturedRecipes(recipes)).toEqual([]);
    });

    it('returns only recipes flagged featured === true', () => {
        const recipes = [
            makeRecipe({ id: 'a', title: 'Apple', featured: true, created_at: '2024-01-01T00:00:00Z' }),
            makeRecipe({ id: 'b', title: 'Banana', featured: false, created_at: '2024-02-01T00:00:00Z' }),
            makeRecipe({ id: 'c', title: 'Cherry', created_at: '2024-03-01T00:00:00Z' }),
            makeRecipe({ id: 'd', title: 'Date', featured: true, created_at: '2024-04-01T00:00:00Z' }),
        ];
        const result = getFeaturedRecipes(recipes);
        expect(result.map(r => r.id)).toEqual(['d', 'a']);
    });

    it('sorts featured recipes by created_at descending', () => {
        const recipes = [
            makeRecipe({ id: 'old', title: 'Old', featured: true, created_at: '2020-01-01T00:00:00Z' }),
            makeRecipe({ id: 'new', title: 'New', featured: true, created_at: '2026-01-01T00:00:00Z' }),
            makeRecipe({ id: 'mid', title: 'Mid', featured: true, created_at: '2023-01-01T00:00:00Z' }),
        ];
        expect(getFeaturedRecipes(recipes).map(r => r.id)).toEqual(['new', 'mid', 'old']);
    });

    it('keeps stable order for featured recipes missing created_at', () => {
        const recipes = [
            makeRecipe({ id: 'first', title: 'First', featured: true }),
            makeRecipe({ id: 'second', title: 'Second', featured: true }),
            makeRecipe({ id: 'third', title: 'Third', featured: true }),
        ];
        expect(getFeaturedRecipes(recipes).map(r => r.id)).toEqual(['first', 'second', 'third']);
    });

    it(`caps the result at ${MAX_FEATURED_RECIPES} recipes`, () => {
        const recipes = Array.from({ length: 10 }, (_, i) =>
            makeRecipe({
                id: `r${i}`,
                title: `Recipe ${i}`,
                featured: true,
                created_at: `2024-0${(i % 9) + 1}-01T00:00:00Z`,
            }),
        );
        const result = getFeaturedRecipes(recipes);
        expect(result.length).toBe(MAX_FEATURED_RECIPES);
    });

    it('ignores `featured: false` and missing `featured` field', () => {
        const recipes = [
            makeRecipe({ id: 'a', featured: false }),
            makeRecipe({ id: 'b' }),
            makeRecipe({ id: 'c', featured: true }),
        ];
        expect(getFeaturedRecipes(recipes).map(r => r.id)).toEqual(['c']);
    });

    it('does not mutate the input array', () => {
        const recipes = [
            makeRecipe({ id: 'a', featured: true, created_at: '2020-01-01T00:00:00Z' }),
            makeRecipe({ id: 'b', featured: true, created_at: '2025-01-01T00:00:00Z' }),
        ];
        const snapshot = recipes.map(r => r.id);
        getFeaturedRecipes(recipes);
        expect(recipes.map(r => r.id)).toEqual(snapshot);
    });

    it('tolerates malformed created_at values without throwing', () => {
        const recipes = [
            makeRecipe({ id: 'good', featured: true, created_at: '2024-01-01T00:00:00Z' }),
            makeRecipe({ id: 'bad', featured: true, created_at: 'not-a-date' }),
        ];
        const result = getFeaturedRecipes(recipes);
        expect(result.map(r => r.id)).toEqual(['good', 'bad']);
    });
});

describe('hasFeaturedRecipes', () => {
    it('returns false when none are featured', () => {
        expect(hasFeaturedRecipes([makeRecipe(), makeRecipe({ featured: false })])).toBe(false);
    });

    it('returns true when at least one is featured', () => {
        expect(hasFeaturedRecipes([makeRecipe(), makeRecipe({ featured: true })])).toBe(true);
    });
});
