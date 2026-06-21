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
