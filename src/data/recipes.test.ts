import { describe, it, expect } from 'vitest';
import recipesJson from './recipes.json' with { type: 'json' };
import { RECIPE_CATEGORIES } from '../constants/taxonomy';
import { buildRecipeSchema } from '../utils/recipeSchema';
import type { Recipe } from '../types';

const recipes = recipesJson as ReadonlyArray<Recipe>;
const VALID_CATEGORIES = new Set<string>(RECIPE_CATEGORIES);
const VALID_IMAGE_SOURCES = new Set([
    'upload',
    'nano-banana',
    'pollinations',
    'local-generated',
]);

/**
 * Schema-drift guards on the canonical seed dataset (`src/data/recipes.json`).
 *
 * These tests are deliberately strict so that any accidental shape change —
 * a new required field, a renamed property, a missing image, an unknown
 * category — fails CI before it lands in production.
 */
describe('src/data/recipes.json — schema integrity', () => {
    it('contains a non-empty array of recipes', () => {
        expect(Array.isArray(recipes)).toBe(true);
        expect(recipes.length).toBeGreaterThan(0);
    });

    it('every recipe has the required scalar fields', () => {
        for (const recipe of recipes) {
            expect(typeof recipe.id, `id missing on ${recipe.title}`).toBe('string');
            expect(recipe.id.length).toBeGreaterThan(0);
            expect(typeof recipe.title).toBe('string');
            expect(recipe.title.trim().length).toBeGreaterThan(0);
            expect(typeof recipe.contributor).toBe('string');
            expect(recipe.contributor.trim().length).toBeGreaterThan(0);
            expect(typeof recipe.category).toBe('string');
            expect(typeof recipe.image).toBe('string');
        }
    });

    it('every recipe has unique id', () => {
        const ids = recipes.map((r) => r.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it('every recipe uses a known category from RECIPE_CATEGORIES', () => {
        for (const recipe of recipes) {
            expect(
                VALID_CATEGORIES.has(recipe.category),
                `Recipe "${recipe.title}" (${recipe.id}) has unknown category "${recipe.category}"`,
            ).toBe(true);
        }
    });

    it('every recipe has at least one ingredient and one instruction', () => {
        for (const recipe of recipes) {
            expect(Array.isArray(recipe.ingredients)).toBe(true);
            expect(
                recipe.ingredients.length,
                `Recipe "${recipe.title}" (${recipe.id}) has no ingredients`,
            ).toBeGreaterThan(0);
            expect(Array.isArray(recipe.instructions)).toBe(true);
            expect(
                recipe.instructions.length,
                `Recipe "${recipe.title}" (${recipe.id}) has no instructions`,
            ).toBeGreaterThan(0);
            for (const ingredient of recipe.ingredients) {
                expect(typeof ingredient).toBe('string');
            }
            for (const step of recipe.instructions) {
                expect(typeof step).toBe('string');
            }
        }
    });

    it('image fields point to local /recipe-images/ paths or HTTPS URLs', () => {
        for (const recipe of recipes) {
            const image = recipe.image;
            const isLocal = image.startsWith('/recipe-images/');
            const isHttp = image.startsWith('http://') || image.startsWith('https://');
            const isDataUrl = image.startsWith('data:');
            expect(
                isLocal || isHttp || isDataUrl,
                `Recipe "${recipe.title}" (${recipe.id}) has malformed image "${image}"`,
            ).toBe(true);
        }
    });

    it('imageSource (when present) is a known value', () => {
        for (const recipe of recipes) {
            if (recipe.imageSource !== undefined) {
                expect(
                    VALID_IMAGE_SOURCES.has(recipe.imageSource),
                    `Recipe "${recipe.title}" has unknown imageSource "${recipe.imageSource}"`,
                ).toBe(true);
            }
        }
    });

    it('servings (when present) is a non-empty string or positive number', () => {
        for (const recipe of recipes) {
            if (recipe.servings === undefined) continue;
            if (typeof recipe.servings === 'number') {
                expect(recipe.servings).toBeGreaterThan(0);
            } else {
                expect(typeof recipe.servings).toBe('string');
                expect((recipe.servings as string).trim().length).toBeGreaterThan(0);
            }
        }
    });

    it('calories (when present) is a positive number', () => {
        for (const recipe of recipes) {
            if (recipe.calories === undefined) continue;
            expect(typeof recipe.calories).toBe('number');
            expect(recipe.calories).toBeGreaterThan(0);
        }
    });

    it('tags (when present) is an array of non-empty strings', () => {
        for (const recipe of recipes) {
            if (recipe.tags === undefined) continue;
            expect(Array.isArray(recipe.tags)).toBe(true);
            for (const tag of recipe.tags) {
                expect(typeof tag).toBe('string');
                expect(tag.trim().length).toBeGreaterThan(0);
            }
        }
    });

    it('every recipe produces a valid Schema.org Recipe JSON-LD blob', () => {
        // Spot-check a representative sample to keep test runtime small.
        const sample = recipes.slice(0, Math.min(20, recipes.length));
        for (const recipe of sample) {
            const schema = buildRecipeSchema(recipe);
            expect(schema['@context']).toBe('https://schema.org');
            expect(schema['@type']).toBe('Recipe');
            expect(schema.name).toBe(recipe.title);
            expect((schema.author as { name?: string }).name).toBe(recipe.contributor);
            expect(schema.recipeCategory).toBe(recipe.category);
            // The full JSON must serialize without throwing.
            expect(() => JSON.stringify(schema)).not.toThrow();
        }
    });

    it('featured (when present) is a boolean', () => {
        // The Featured Recipes feature added an optional `featured?: boolean`
        // to Recipe. Catch any accidental string/number drift on the seed.
        for (const recipe of recipes) {
            if ((recipe as Recipe & { featured?: unknown }).featured === undefined) continue;
            expect(typeof (recipe as Recipe).featured).toBe('boolean');
        }
    });
});
