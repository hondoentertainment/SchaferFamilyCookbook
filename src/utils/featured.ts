import type { Recipe } from '../types';

/** Maximum number of recipes that can be highlighted in the Featured strip. */
export const MAX_FEATURED_RECIPES = 6;

/**
 * Returns the curated set of featured recipes, ordered for display.
 *
 * Ordering rules (deterministic):
 *  1. Only recipes with `featured === true`.
 *  2. Sort by `created_at` (descending) so the freshest curated picks lead.
 *     Recipes without a `created_at` fall to the bottom, but maintain
 *     stable insertion order relative to each other.
 *  3. Cap to {@link MAX_FEATURED_RECIPES}.
 */
export function getFeaturedRecipes(recipes: readonly Recipe[]): Recipe[] {
    if (!Array.isArray(recipes) || recipes.length === 0) return [];

    const featuredWithIndex = recipes
        .map((recipe, index) => ({ recipe, index }))
        .filter(({ recipe }) => recipe.featured === true);

    featuredWithIndex.sort((a, b) => {
        const aTime = parseCreatedAt(a.recipe.created_at);
        const bTime = parseCreatedAt(b.recipe.created_at);
        if (aTime !== bTime) return bTime - aTime;
        return a.index - b.index;
    });

    return featuredWithIndex.slice(0, MAX_FEATURED_RECIPES).map(({ recipe }) => recipe);
}

/**
 * Convenience helper for callers that only need to know whether the strip
 * should render at all.
 */
export function hasFeaturedRecipes(recipes: readonly Recipe[]): boolean {
    return getFeaturedRecipes(recipes).length > 0;
}

function parseCreatedAt(value: string | undefined): number {
    if (!value) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}
