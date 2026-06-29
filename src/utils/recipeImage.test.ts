import { describe, it, expect } from 'vitest';
import { isHandwrittenRecipeCard } from './recipeImage';
import type { Recipe } from '../types';

const baseRecipe: Pick<Recipe, 'imageSource' | 'imageApprovalStatus' | 'generatedImageFallback' | 'notes'> = {
    imageSource: 'upload',
    imageApprovalStatus: 'approved',
    generatedImageFallback: false,
    notes: 'Transcribed from a handwritten family recipe card.',
};

describe('isHandwrittenRecipeCard', () => {
    it('returns true for approved upload with handwritten notes', () => {
        expect(isHandwrittenRecipeCard(baseRecipe)).toBe(true);
    });

    it('returns false for generated fallback images', () => {
        expect(isHandwrittenRecipeCard({ ...baseRecipe, generatedImageFallback: true })).toBe(false);
    });

    it('returns false for non-upload sources', () => {
        expect(isHandwrittenRecipeCard({ ...baseRecipe, imageSource: 'local-generated' })).toBe(false);
    });

    it('returns false when notes do not mention a card scan', () => {
        expect(isHandwrittenRecipeCard({ ...baseRecipe, notes: 'Family favorite' })).toBe(false);
    });
});
