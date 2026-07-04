import defaultRecipes from '../data/recipes.json';
import { normalizeRecipe, normalizeRecipes } from '../constants/taxonomy';
import type { Recipe } from '../types';

const DEFAULT_RECIPES = normalizeRecipes(defaultRecipes as Recipe[]);
const DEFAULT_BY_ID = new Map(DEFAULT_RECIPES.map((recipe) => [recipe.id, recipe]));

/**
 * Ensures every recipe from the bundled seed (`recipes.json`) is available.
 * Archive / Firestore entries win when the same id exists in both.
 */
export function mergeWithDefaultRecipes(archiveRecipes: Recipe[]): Recipe[] {
    const byId = new Map<string, Recipe>();
    for (const recipe of archiveRecipes) {
        byId.set(recipe.id, normalizeRecipe(recipe));
    }
    for (const [id, recipe] of DEFAULT_BY_ID) {
        if (!byId.has(id)) {
            byId.set(id, recipe);
        }
    }
    return normalizeRecipes(Array.from(byId.values()));
}

export function getDefaultRecipeCount(): number {
    return DEFAULT_RECIPES.length;
}
