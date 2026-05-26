import recipesSeed from './recipes.seed.generated.js';

/** Minimal recipe fields needed by OG/share routes */
export type RecipeSeedLike = {
    id: string;
    title: string;
    contributor: string;
    image?: string;
    category?: string;
};

let cachedSeed: RecipeSeedLike[] | null = null;

/** Seed recipes synchronized from src/data/recipes.json at install/build time */
export function loadRecipesSeed(): RecipeSeedLike[] {
    if (cachedSeed) return cachedSeed;
    try {
        const parsed = recipesSeed as RecipeSeedLike[];
        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error('Recipe seed is empty or not an array');
        }
        cachedSeed = parsed;
        return cachedSeed;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to load recipe seed for API routes: ${message}`);
    }
}
