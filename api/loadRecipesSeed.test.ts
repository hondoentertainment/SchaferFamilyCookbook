import { describe, it, expect } from 'vitest';
import { loadRecipesSeed, type RecipeSeedLike } from './loadRecipesSeed';
import recipesJson from '../src/data/recipes.json' with { type: 'json' };

describe('loadRecipesSeed (Vercel API recipe seed)', () => {
    it('returns a non-empty array', () => {
        const seed = loadRecipesSeed();
        expect(Array.isArray(seed)).toBe(true);
        expect(seed.length).toBeGreaterThan(0);
    });

    it('matches src/data/recipes.json by recipe count', () => {
        const seed = loadRecipesSeed();
        // The generated TS module is regenerated from recipes.json by
        // scripts/sync-recipes-for-api.mjs (postinstall + test:run). If this
        // assertion fails, run `npm run test:run` (or `node
        // scripts/sync-recipes-for-api.mjs`) and commit the regenerated file.
        expect(seed.length).toBe((recipesJson as unknown[]).length);
    });

    it('each entry has required fields used by /api/og and /api/share', () => {
        const seed = loadRecipesSeed();
        for (const recipe of seed) {
            expect(typeof recipe.id).toBe('string');
            expect(recipe.id.length).toBeGreaterThan(0);
            expect(typeof recipe.title).toBe('string');
            expect(recipe.title.length).toBeGreaterThan(0);
            expect(typeof recipe.contributor).toBe('string');
            // image is optional; when present it must be a string.
            if (recipe.image !== undefined) {
                expect(typeof recipe.image).toBe('string');
            }
            if (recipe.category !== undefined) {
                expect(typeof recipe.category).toBe('string');
            }
        }
    });

    it('preserves recipe ids verbatim from source seed (no truncation)', () => {
        const seed = loadRecipesSeed();
        const seedIds = new Set(seed.map((r) => r.id));
        const sourceIds = new Set(
            (recipesJson as ReadonlyArray<{ id: string }>).map((r) => r.id),
        );
        expect(seedIds.size).toBe(sourceIds.size);
        for (const id of sourceIds) {
            expect(seedIds.has(id)).toBe(true);
        }
    });

    it('returns a plain array that can be safely JSON-serialized round-trip', () => {
        const seed: RecipeSeedLike[] = loadRecipesSeed();
        const roundTrip = JSON.parse(JSON.stringify(seed)) as RecipeSeedLike[];
        expect(roundTrip).toHaveLength(seed.length);
        expect(roundTrip[0].id).toBe(seed[0].id);
    });
});
