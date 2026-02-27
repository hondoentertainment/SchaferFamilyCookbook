/** Tracks recipe IDs that have already shown an "Image failed to load" toast this session to avoid spam. */
const imageErrorToastedRecipeIds = new Set<string>();

export function shouldToastImageError(recipeId: string): boolean {
    if (imageErrorToastedRecipeIds.has(recipeId)) return false;
    imageErrorToastedRecipeIds.add(recipeId);
    return true;
}
