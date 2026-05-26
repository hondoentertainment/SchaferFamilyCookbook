import recipesSeed from './recipes.seed.generated.js';

/** Minimal recipe fields needed by OG/share routes */
export type RecipeSeedLike = {
    id: string;
    title: string;
    contributor: string;
    image?: string;
    category?: string;
};

/** Seed recipes synchronized from src/data/recipes.json at install/build time */
export function loadRecipesSeed(): RecipeSeedLike[] {
    return recipesSeed as RecipeSeedLike[];
}
