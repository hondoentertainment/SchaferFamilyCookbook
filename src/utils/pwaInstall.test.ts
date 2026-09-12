import { describe, it, expect } from 'vitest';
import {
    getInstallInstructions,
    hasViewedRecipes,
    isInstallDismissed,
    isIosDevice,
    shouldShowInstallHint,
} from './pwaInstall';

describe('pwaInstall helpers', () => {
    it('detects iPhone / iPad user agents and ignores desktop Chrome', () => {
        expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
        expect(isIosDevice('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')).toBe(true);
        expect(isIosDevice('Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0')).toBe(false);
        expect(isIosDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe(false);
    });

    it('treats empty or [] recently-viewed as no recipe views', () => {
        expect(hasViewedRecipes(null)).toBe(false);
        expect(hasViewedRecipes('')).toBe(false);
        expect(hasViewedRecipes('[]')).toBe(false);
        expect(hasViewedRecipes('[{"id":"r1"}]')).toBe(true);
    });

    it('treats true/1 as dismissed', () => {
        expect(isInstallDismissed('true')).toBe(true);
        expect(isInstallDismissed('1')).toBe(true);
        expect(isInstallDismissed(null)).toBe(false);
        expect(isInstallDismissed('false')).toBe(false);
    });

    it('never shows in standalone or after dismiss', () => {
        expect(
            shouldShowInstallHint({
                standalone: true,
                dismissed: false,
                isIos: true,
                hasNativePrompt: false,
                hasViewedRecipe: true,
                onboardingDone: true,
            }),
        ).toBe(false);
        expect(
            shouldShowInstallHint({
                standalone: false,
                dismissed: true,
                isIos: true,
                hasNativePrompt: false,
                hasViewedRecipe: true,
                onboardingDone: true,
            }),
        ).toBe(false);
    });

    it('shows the iOS Share → Home Screen path once onboarding is done', () => {
        expect(
            shouldShowInstallHint({
                standalone: false,
                dismissed: false,
                isIos: true,
                hasNativePrompt: false,
                hasViewedRecipe: false,
                onboardingDone: true,
            }),
        ).toBe(true);
        expect(
            shouldShowInstallHint({
                standalone: false,
                dismissed: false,
                isIos: true,
                hasNativePrompt: false,
                hasViewedRecipe: false,
                onboardingDone: false,
            }),
        ).toBe(false);
    });

    it('shows the Android native prompt after a recipe view or finished onboarding', () => {
        expect(
            shouldShowInstallHint({
                standalone: false,
                dismissed: false,
                isIos: false,
                hasNativePrompt: true,
                hasViewedRecipe: true,
                onboardingDone: false,
            }),
        ).toBe(true);
        expect(
            shouldShowInstallHint({
                standalone: false,
                dismissed: false,
                isIos: false,
                hasNativePrompt: true,
                hasViewedRecipe: false,
                onboardingDone: true,
            }),
        ).toBe(true);
        expect(
            shouldShowInstallHint({
                standalone: false,
                dismissed: false,
                isIos: false,
                hasNativePrompt: false,
                hasViewedRecipe: true,
                onboardingDone: true,
            }),
        ).toBe(false);
    });

    it('keeps iOS copy about Share → Add to Home Screen', () => {
        expect(getInstallInstructions(true).body).toMatch(/Share/i);
        expect(getInstallInstructions(true).body).toMatch(/Add to Home Screen/i);
        expect(getInstallInstructions(false).title).toMatch(/home screen/i);
    });
});
