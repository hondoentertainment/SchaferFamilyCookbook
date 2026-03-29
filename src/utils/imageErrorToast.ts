import { TIMING } from '../constants/theme';

/** Single consolidated toast per session to avoid stacked "Image failed to load" messages. */
let hasShownImageErrorToast = false;
let lastShownTimestamp = 0;

export function shouldToastImageError(_recipeId: string): boolean {
    const now = Date.now();
    // Reset the flag after the AI cooldown period (5 minutes) so it can show again in new sessions
    if (hasShownImageErrorToast && now - lastShownTimestamp >= TIMING.aiCooldownMs) {
        hasShownImageErrorToast = false;
    }
    if (hasShownImageErrorToast) return false;
    hasShownImageErrorToast = true;
    lastShownTimestamp = now;
    return true;
}
