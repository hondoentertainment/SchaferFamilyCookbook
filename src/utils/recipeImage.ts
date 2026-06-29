import type { Recipe } from '../types';

/**
 * A recipe image URL is renderable only when it points at a bundled asset
 * (`/recipe-images/...`) or an absolute http(s) URL. Anything else (empty
 * strings, relative junk, data we can't trust) falls back to a placeholder.
 */
export const isValidRecipeImageUrl = (url: string | undefined | null): url is string =>
    !!url && (url.startsWith('/recipe-images/') || url.startsWith('http://') || url.startsWith('https://'));

/**
 * "Cookbook cover" images are locally generated portrait art meant to be shown
 * matted (object-contain) rather than bled to the edges (object-cover).
 */
export const isCookbookCoverImage = (recipe: Pick<Recipe, 'imageSource'>): boolean =>
    recipe.imageSource === 'local-generated';

/**
 * Handwritten recipe-card scans read better as category art in dense grids;
 * the full card photo still shows in the recipe modal.
 */
export const isHandwrittenRecipeCard = (
    recipe: Pick<Recipe, 'imageSource' | 'imageApprovalStatus' | 'generatedImageFallback' | 'notes'>,
): boolean => {
    if (recipe.imageSource !== 'upload' || recipe.imageApprovalStatus !== 'approved') return false;
    if (recipe.generatedImageFallback === true) return false;
    const notes = recipe.notes?.toLowerCase() ?? '';
    return notes.includes('handwritten') || notes.includes('recipe card');
};
