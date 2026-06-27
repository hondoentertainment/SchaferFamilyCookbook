import { describe, expect, it } from 'vitest';
import { mergeWithDefaultRecipes, getDefaultRecipeCount } from './mergeDefaultRecipes';
import defaultRecipes from '../data/recipes.json';
import type { Recipe } from '../types';

describe('mergeWithDefaultRecipes', () => {
    it('returns full default catalog when archive is empty', () => {
        const merged = mergeWithDefaultRecipes([]);
        expect(merged.length).toBe(getDefaultRecipeCount());
        expect(merged.length).toBe((defaultRecipes as Recipe[]).length);
    });

    it('prefers archive recipe over default when ids match', () => {
        const first = (defaultRecipes as Recipe[])[0];
        const override = { ...first, title: 'Cloud override title' };
        const merged = mergeWithDefaultRecipes([override]);
        const found = merged.find((r) => r.id === first.id);
        expect(found?.title).toBe('Cloud override title');
        expect(merged.length).toBe(getDefaultRecipeCount());
    });

    it('adds missing defaults without dropping archive-only recipes', () => {
        const archiveOnly: Recipe = {
            id: 'custom-archive-only',
            title: 'New family recipe',
            contributor: 'Kyle',
            category: 'Main',
            image: '/recipe-images/749d8765.webp',
            ingredients: ['1 cup flour'],
            instructions: ['Mix and bake'],
        };
        const merged = mergeWithDefaultRecipes([archiveOnly]);
        expect(merged.some((r) => r.id === 'custom-archive-only')).toBe(true);
        expect(merged.length).toBe(getDefaultRecipeCount() + 1);
    });
});
