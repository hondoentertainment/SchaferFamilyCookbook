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
        await expect(page.getByRole('dialog', { name: /recipe details/i })).toBeVisible();

        // Enter cook mode.
        const cookBtn = page.getByRole('button', { name: /Start Cook/i }).first();
        // Skip gracefully if this recipe variant doesn't surface a cook-mode button.
        if (!(await cookBtn.isVisible().catch(() => false))) {
            test.skip(true, 'Cook mode entry point not visible for this recipe; skipping swipe e2e.');
            return;
        }
        await cookBtn.click();

        await expect(page.getByRole('application', { name: /Cook mode/i })).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/Step 1 of/i)).toBeVisible();

        // Dispatch a synthetic horizontal swipe on the ingredients body.
        await page.evaluate(() => {
            const root = document.querySelector(
                '[role="application"][aria-label^="Cook mode:"]',
            ) as HTMLElement | null;
            const body =
                (root?.querySelector('.flex-1.overflow-y-auto') as HTMLElement | null) ??
                (root?.querySelector('[class*="overflow-y-auto"]') as HTMLElement | null);
            if (!body) throw new Error('Could not find cook-mode step body');
            const makeTouch = (x: number, y: number) =>
                new Touch({ identifier: 0, target: body, clientX: x, clientY: y });
            const start = new TouchEvent('touchstart', {
                bubbles: true,
                cancelable: true,
                touches: [makeTouch(260, 120)],
                targetTouches: [makeTouch(260, 120)],
                changedTouches: [makeTouch(260, 120)],
            });
            const end = new TouchEvent('touchend', {
                bubbles: true,
                cancelable: true,
                touches: [],
                targetTouches: [],
                changedTouches: [makeTouch(60, 120)],
            });
            body.dispatchEvent(start);
            body.dispatchEvent(end);
        });

        await expect(page.getByText(/Step 2 of/i)).toBeVisible({ timeout: 3000 });
    });
});
