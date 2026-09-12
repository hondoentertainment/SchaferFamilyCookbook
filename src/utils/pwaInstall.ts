import { STORAGE_KEYS } from '../constants/storage';

const IOS_UA_RE = /iphone|ipad|ipod/i;

export function isStandaloneDisplay(win: Window = window): boolean {
    const nav = win.navigator as Navigator & { standalone?: boolean };
    return (
        (typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches) ||
        nav.standalone === true
    );
}

export function isIosDevice(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
    return IOS_UA_RE.test(userAgent);
}

export function hasViewedRecipes(raw: string | null | undefined): boolean {
    if (!raw) return false;
    const trimmed = raw.trim();
    return trimmed !== '' && trimmed !== '[]';
}

export function isInstallDismissed(raw: string | null | undefined): boolean {
    return raw === 'true' || raw === '1';
}

export function readInstallDismissed(): boolean {
    try {
        return isInstallDismissed(localStorage.getItem(STORAGE_KEYS.installDismissed));
    } catch {
        return false;
    }
}

export function persistInstallDismissed(): void {
    try {
        localStorage.setItem(STORAGE_KEYS.installDismissed, 'true');
    } catch {
        /* private mode */
    }
}

/**
 * One-time home-screen hint: never in standalone, never after dismiss.
 * iOS never fires beforeinstallprompt, so a Share → Add to Home Screen
 * explanation is the real path. Android uses the native prompt when the
 * browser offers it.
 */
export function shouldShowInstallHint(opts: {
    standalone: boolean;
    dismissed: boolean;
    isIos: boolean;
    hasNativePrompt: boolean;
    hasViewedRecipe: boolean;
    onboardingDone: boolean;
}): boolean {
    if (opts.standalone || opts.dismissed) return false;
    if (opts.isIos) return opts.onboardingDone;
    if (opts.hasNativePrompt) return opts.hasViewedRecipe || opts.onboardingDone;
    return false;
}

export function getInstallInstructions(isIos: boolean): { title: string; body: string } {
    if (isIos) {
        return {
            title: 'Keep this cookbook on your Home Screen',
            body: 'Tap Share, then Add to Home Screen. The family archive will open like an app — no extra login next time.',
        };
    }
    return {
        title: 'Add the Schafer Cookbook to your home screen',
        body: 'Install for the best one-handed experience — recipes, groceries, and family photos in one tap.',
    };
}
