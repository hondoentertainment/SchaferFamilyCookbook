import { describe, it, expect } from 'vitest';
import { isHandwrittenRecipeCard, buildRecipeImageSrcSet } from './recipeImage';
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

describe('buildRecipeImageSrcSet', () => {
    it('builds a 480/800/1200 srcset for a bundled recipe photo', () => {
        expect(buildRecipeImageSrcSet('/recipe-images/abc123.webp')).toBe(
            '/recipe-images/abc123-480.webp 480w, /recipe-images/abc123-800.webp 800w, /recipe-images/abc123.webp 1200w',
        );
    });

    it('returns undefined for external URLs (no generated variants)', () => {
        expect(buildRecipeImageSrcSet('https://example.com/photo.webp')).toBeUndefined();
        expect(buildRecipeImageSrcSet('http://example.com/photo.webp')).toBeUndefined();
    });

    it('returns undefined for non-webp bundled paths', () => {
        expect(buildRecipeImageSrcSet('/recipe-images/abc.jpg')).toBeUndefined();
    });

    it('returns undefined for empty or nullish input', () => {
        expect(buildRecipeImageSrcSet('')).toBeUndefined();
        expect(buildRecipeImageSrcSet(undefined)).toBeUndefined();
        expect(buildRecipeImageSrcSet(null)).toBeUndefined();
    });

    it('does not build variants from an already-variant path', () => {
        expect(buildRecipeImageSrcSet('/recipe-images/abc-480.webp')).toBeUndefined();
    });
});
