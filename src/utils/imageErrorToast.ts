/** Single consolidated toast per session to avoid stacked "Image failed to load" messages. */
let hasShownImageErrorToast = false;

export function shouldToastImageError(_recipeId: string): boolean {
    if (hasShownImageErrorToast) return false;
    hasShownImageErrorToast = true;
    return true;
}
