import { describe, it, expect } from 'vitest';
import { scaleIngredient, scaleIngredients } from './scaleIngredients';

describe('scaleIngredient', () => {
    it('should return original when factor is 1', () => {
        expect(scaleIngredient('2 cups flour', 1)).toBe('2 cups flour');
    });

    it('should scale whole numbers', () => {
        expect(scaleIngredient('2 cups flour', 2)).toBe('4 cups flour');
    });

    it('should scale fractions', () => {
        expect(scaleIngredient('1/2 cup sugar', 2)).toBe('1 cup sugar');
    });

    it('should scale mixed numbers', () => {
        expect(scaleIngredient('1 1/2 cups milk', 2)).toBe('3 cups milk');
    });

    it('should scale decimals', () => {
        expect(scaleIngredient('2.5 tsp salt', 2)).toBe('5 tsp salt');
    });

    it('should format common fractions nicely', () => {
        expect(scaleIngredient('1 cup flour', 0.5)).toBe('1/2 cup flour');
        expect(scaleIngredient('1 cup flour', 0.25)).toBe('1/4 cup flour');
        expect(scaleIngredient('1 cup flour', 0.75)).toBe('3/4 cup flour');
    });

    it('should return original when no quantity found', () => {
        expect(scaleIngredient('salt to taste', 2)).toBe('salt to taste');
        expect(scaleIngredient('pinch of cinnamon', 3)).toBe('pinch of cinnamon');
    });

    it('should handle quantity-only strings', () => {
        expect(scaleIngredient('4', 2)).toBe('8');
    });

    it('should handle zero quantity', () => {
        expect(scaleIngredient('0 cups', 2)).toBe('0 cups');
    });

    it('should scale down', () => {
        expect(scaleIngredient('4 eggs', 0.5)).toBe('2 eggs');
    });

    it('should format 1/3 and 2/3 fractions', () => {
        expect(scaleIngredient('1 cup flour', 1 / 3)).toBe('1/3 cup flour');
        expect(scaleIngredient('1 cup flour', 2 / 3)).toBe('2/3 cup flour');
    });

    it('should format 1 1/2 and 2 1/2', () => {
        expect(scaleIngredient('1 cup flour', 1.5)).toBe('1 1/2 cup flour');
        expect(scaleIngredient('1 cup flour', 2.5)).toBe('2 1/2 cup flour');
    });

    it('should handle awkward decimals with toFixed', () => {
        // 3 * 1.5 = 4.5
        expect(scaleIngredient('3 cups flour', 1.5)).toBe('4.5 cups flour');
    });
});

describe('scaleIngredients', () => {
    it('should return original array when factor is 1', () => {
        const ingredients = ['1 cup flour', '2 eggs'];
        expect(scaleIngredients(ingredients, 1)).toBe(ingredients);
    });

    it('should scale all ingredients', () => {
        const ingredients = ['1 cup flour', '2 eggs', 'salt to taste'];
        const scaled = scaleIngredients(ingredients, 2);
        expect(scaled).toEqual(['2 cup flour', '4 eggs', 'salt to taste']);
    });
});
