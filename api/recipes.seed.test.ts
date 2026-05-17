import { describe, it, expect } from 'vitest';
import { loadRecipesSeed } from './loadRecipesSeed';
import recipesJson from '../src/data/recipes.json' with { type: 'json' };

/**
 * Guards the generated serverless seed (api/recipes.seed.generated.ts) against
 * drifting from its source (src/data/recipes.json). The seed feeds the /api/og
 * and /api/share routes; a broken sync script would ship them stale data.
 */
type RecipeLike = { id: string; title: string; contributor: string };

const source = recipesJson as RecipeLike[];

describe('bundled recipe seed', () => {
    it('matches src/data/recipes.json recipe count', () => {
        expect(loadRecipesSeed().length).toBe(source.length);
    });

    it('contains exactly the same set of recipe ids', () => {
        const seedIds = new Set(loadRecipesSeed().map((r) => r.id));
        const sourceIds = new Set(source.map((r) => r.id));
        expect(seedIds.size).toBe(sourceIds.size);
        for (const id of sourceIds) {
            expect(seedIds.has(id)).toBe(true);
        }
    });

    it('preserves title and contributor for every recipe', () => {
        const seedById = new Map(loadRecipesSeed().map((r) => [r.id, r]));
        for (const recipe of source) {
            const seeded = seedById.get(recipe.id);
            expect(seeded?.title).toBe(recipe.title);
            expect(seeded?.contributor).toBe(recipe.contributor);
        }
    });
});
