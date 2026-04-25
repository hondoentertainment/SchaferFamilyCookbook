import { describe, it, expect } from 'vitest';
import { scaleIngredient, scaleIngredients } from './scaleIngredients';

describe('scaleIngredient', () => {
    describe('scale factor of 1 — no change', () => {
        it('returns the original string unchanged for integers', () => {
            expect(scaleIngredient('2 cups flour', 1)).toBe('2 cups flour');
        });

        it('returns the original string unchanged for fractions', () => {
            expect(scaleIngredient('1/2 tsp salt', 1)).toBe('1/2 tsp salt');
        });

        it('returns the original string unchanged for mixed numbers', () => {
            expect(scaleIngredient('1 1/2 cups milk', 1)).toBe('1 1/2 cups milk');
        });

        it('returns the original string unchanged for no-quantity ingredients', () => {
            expect(scaleIngredient('salt to taste', 1)).toBe('salt to taste');
        });
    });

    describe('integer quantities', () => {
        it('scales 2 cups flour by 2x to 4 cups flour', () => {
            expect(scaleIngredient('2 cups flour', 2)).toBe('4 cups flour');
        });

        it('scales 3 eggs by 2x to 6 eggs', () => {
            expect(scaleIngredient('3 eggs', 2)).toBe('6 eggs');
        });

        it('scales 4 tbsp butter by 0.5x to 2 tbsp butter', () => {
            expect(scaleIngredient('4 tbsp butter', 0.5)).toBe('2 tbsp butter');
        });

        it('scales single integer with no unit', () => {
            expect(scaleIngredient('2', 3)).toBe('6');
        });

        it('handles scale factor > 2', () => {
            expect(scaleIngredient('1 cup sugar', 3)).toBe('3 cup sugar');
        });
    });

    describe('fractions', () => {
        it('scales 1/2 tsp salt by 2x to 1 tsp salt', () => {
            expect(scaleIngredient('1/2 tsp salt', 2)).toBe('1 tsp salt');
        });

        it('scales 1/4 cup oil by 2x to 1/2 cup oil', () => {
            expect(scaleIngredient('1/4 cup oil', 2)).toBe('1/2 cup oil');
        });

        it('scales 3/4 cup broth by 2x to 1 1/2 cup broth', () => {
            expect(scaleIngredient('3/4 cup broth', 2)).toBe('1 1/2 cup broth');
        });

        it('scales 1/3 cup sugar by 3x to 1 cup sugar', () => {
            expect(scaleIngredient('1/3 cup sugar', 3)).toBe('1 cup sugar');
        });

        it('scales 2/3 cup flour by 3x to 2 cup flour', () => {
            expect(scaleIngredient('2/3 cup flour', 3)).toBe('2 cup flour');
        });

        it('scales 1/2 tsp by 0.5x to 1/4 tsp', () => {
            expect(scaleIngredient('1/2 tsp baking powder', 0.5)).toBe('1/4 tsp baking powder');
        });
    });

    describe('mixed numbers', () => {
        it('scales 1 1/2 cups by 2x to 3 cups', () => {
            expect(scaleIngredient('1 1/2 cups milk', 2)).toBe('3 cups milk');
        });

        it('scales 2 1/2 cups by 2x to 5 cups', () => {
            expect(scaleIngredient('2 1/2 cups flour', 2)).toBe('5 cups flour');
        });

        it('scales 1 1/2 cups by 0.5x to 3/4 cups', () => {
            expect(scaleIngredient('1 1/2 cups butter', 0.5)).toBe('3/4 cups butter');
        });

        it('scales 1 1/4 cups by 2x to produce a decimal result', () => {
            const result = scaleIngredient('1 1/4 cups cream', 2);
            expect(result).toMatch(/^2\.5 cups cream$|^2 1\/2 cups cream$/);
        });
    });

    describe('decimal quantities', () => {
        it('scales a decimal quantity', () => {
            expect(scaleIngredient('2.5 cups broth', 2)).toBe('5 cups broth');
        });

        it('scales 1.5 cups by 2x to 3 cups', () => {
            expect(scaleIngredient('1.5 cups water', 2)).toBe('3 cups water');
        });
    });

    describe('no parseable quantity', () => {
        it('returns the original for "salt to taste"', () => {
            expect(scaleIngredient('salt to taste', 2)).toBe('salt to taste');
        });

        it('returns the original for a text-only ingredient', () => {
            expect(scaleIngredient('pepper to taste', 3)).toBe('pepper to taste');
        });

        it('returns the original for an empty string', () => {
            expect(scaleIngredient('', 2)).toBe('');
        });

        it('returns the original for a string with only spaces', () => {
            expect(scaleIngredient('   ', 2)).toBe('   ');
        });
    });

    describe('quantity-only ingredients (no trailing text)', () => {
        it('scales a bare integer', () => {
            expect(scaleIngredient('3', 2)).toBe('6');
        });

        it('scales a bare fraction', () => {
            expect(scaleIngredient('1/2', 4)).toBe('2');
        });
    });

    describe('formatQuantity — common fraction display', () => {
        it('formats 0.25 as 1/4', () => {
            // 1/4 tsp * 1x = 1/4, but with scale 2 from 1/8 → 1/4
            expect(scaleIngredient('1/8 tsp', 2)).toBe('1/4 tsp');
        });

        it('formats 0.5 as 1/2', () => {
            expect(scaleIngredient('1/4 cup', 2)).toBe('1/2 cup');
        });

        it('formats 0.75 as 3/4', () => {
            expect(scaleIngredient('1/4 cup', 3)).toBe('3/4 cup');
        });

        it('formats 1.5 as 1 1/2', () => {
            expect(scaleIngredient('3/4 cup', 2)).toBe('1 1/2 cup');
        });

        it('formats 2.5 as 2 1/2', () => {
            expect(scaleIngredient('5/4 cup', 2)).toBe('2 1/2 cup');
        });
    });
});

describe('scaleIngredients', () => {
    it('returns the original array unchanged when factor is 1', () => {
        const ingredients = ['2 cups flour', '1/2 tsp salt', '3 eggs'];
        const result = scaleIngredients(ingredients, 1);
        expect(result).toEqual(ingredients);
    });

    it('scales all ingredients in an array', () => {
        const ingredients = ['2 cups flour', '1/2 tsp salt', '3 eggs'];
        const result = scaleIngredients(ingredients, 2);
        expect(result).toEqual(['4 cups flour', '1 tsp salt', '6 eggs']);
    });

    it('returns an empty array for an empty input', () => {
        expect(scaleIngredients([], 2)).toEqual([]);
    });

    it('preserves no-quantity ingredients while scaling others', () => {
        const ingredients = ['2 cups flour', 'salt to taste', '1/2 tsp pepper'];
        const result = scaleIngredients(ingredients, 2);
        expect(result[0]).toBe('4 cups flour');
        expect(result[1]).toBe('salt to taste');
        expect(result[2]).toBe('1 tsp pepper');
    });

    it('scales by a fractional factor (halving)', () => {
        const ingredients = ['4 cups broth', '2 tbsp oil'];
        const result = scaleIngredients(ingredients, 0.5);
        expect(result).toEqual(['2 cups broth', '1 tbsp oil']);
    });

    it('scales a single-item array', () => {
        expect(scaleIngredients(['1 cup water'], 3)).toEqual(['3 cup water']);
    });
});
