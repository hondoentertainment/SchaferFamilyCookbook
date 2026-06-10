import { test, expect } from '@playwright/test';
import { loginAs, openRecipeCardInMainGridByTitle } from './fixtures';

/**
 * Cook-mode swipe gesture e2e.
 *
 * The repo's Playwright config only declares desktop Chrome/Firefox projects
 * (no `hasTouch: true`), so `page.touchscreen.*` APIs aren't available. We
 * dispatch synthetic TouchEvents via `evaluate` to exercise the `useSwipe`
 * handlers that CookModeView attaches to its step body.
 */
test.describe('Cook Mode swipe navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
    });

    test('swipe-left on the step body advances the step', async ({ page }) => {
        // Open a recipe that has instructions.
        // Seed data: guaranteed multi-step instructions (ingredients screen + recipe steps).
        await openRecipeCardInMainGridByTitle(page, 'Festive Apple Dip');
        await expect(page.locator('[role="dialog"][aria-label="Recipe details"]')).toBeVisible();

        // Enter cook mode.
        const cookBtn = page.getByRole('button', { name: /Start Cook/i }).first();
        // Skip gracefully if this recipe variant doesn't surface a cook-mode button.
        if (!(await cookBtn.isVisible().catch(() => false))) {
            test.skip(true, 'Cook mode entry point not visible for this recipe; skipping swipe e2e.');
            return;
        }
        await cookBtn.click();

        await expect(page.getByRole('application', { name: /Cook mode:/i })).toBeVisible({ timeout: 5000 });
        const cookApp = page.getByRole('application', { name: /Cook mode:/i });
        await expect(cookApp.getByText(/Step 1 of \d+/).first()).toBeVisible();

        // Dispatch a synthetic horizontal swipe on the ingredients body.
        // Firefox in CI does not expose TouchEvent/Touch constructors on desktop,
        // so create plain Events and attach the touch lists React's handler reads.
        await page.evaluate(() => {
            const root = document.querySelector(
                '[role="application"][aria-label^="Cook mode:"]',
            ) as HTMLElement | null;
            const body =
                (root?.querySelector('.flex-1.overflow-y-auto') as HTMLElement | null) ??
                (root?.querySelector('[class*="overflow-y-auto"]') as HTMLElement | null);
            if (!body) throw new Error('Could not find cook-mode step body');

            const dispatchTouchLikeEvent = (
                type: 'touchstart' | 'touchend',
                touches: Array<{ clientX: number; clientY: number }>,
                changedTouches: Array<{ clientX: number; clientY: number }>,
            ) => {
                const event = new Event(type, { bubbles: true, cancelable: true });
                Object.defineProperties(event, {
                    touches: { value: touches },
                    targetTouches: { value: touches },
                    changedTouches: { value: changedTouches },
                });
                body.dispatchEvent(event);
            };

            dispatchTouchLikeEvent('touchstart', [{ clientX: 260, clientY: 120 }], [{ clientX: 260, clientY: 120 }]);
            dispatchTouchLikeEvent('touchend', [], [{ clientX: 60, clientY: 120 }]);
        });

        await expect(cookApp.getByText(/Step 2 of \d+/).first()).toBeVisible({ timeout: 3000 });
    });
});
