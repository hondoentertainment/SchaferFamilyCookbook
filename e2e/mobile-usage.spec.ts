import { test, expect } from '@playwright/test';
import { loginAs, loginAsHome, openFirstRecipeCardInMainGrid } from './fixtures';

function recipeDetailsDialog(page: import('@playwright/test').Page) {
    return page.locator('[role="dialog"][aria-label="Recipe details"]');
}

async function minHeightAtLeast(locator: import('@playwright/test').Locator, min = 44) {
    const box = await locator.boundingBox();
    expect(box, 'expected a visible box').toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(min);
}

test.describe('Phone-width cookbook usage', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
        await page.evaluate(() => localStorage.setItem('schafer_install_dismissed', 'true'));
    });

    test('bottom nav clears the home-indicator inset and meets 44px taps', async ({ page }) => {
        const nav = page.getByTestId('bottom-nav');
        await expect(nav).toBeVisible();
        await expect(nav).toHaveClass(/safe-area-inset-bottom/);
        for (const id of [
            'bottom-nav-home',
            'bottom-nav-recipes',
            'bottom-nav-family',
            'bottom-nav-grocery',
            'bottom-nav-profile',
        ]) {
            await minHeightAtLeast(page.getByTestId(id));
        }
    });

    test('recipe read/cook chrome stays on-screen without horizontal overflow', async ({ page }) => {
        await openFirstRecipeCardInMainGrid(page);
        const dialog = recipeDetailsDialog(page);
        await expect(dialog).toBeVisible({ timeout: 15000 });

        await minHeightAtLeast(dialog.getByRole('tab', { name: /^Read$/i }));
        await minHeightAtLeast(dialog.getByRole('tab', { name: /^Cook$/i }));
        await minHeightAtLeast(dialog.getByRole('tab', { name: /^Share$/i }));

        const overflow = await dialog.evaluate((el) => ({
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
        }));
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

        await dialog.getByRole('tab', { name: /^Cook$/i }).click();
        const step = dialog.getByTestId('recipe-step-text-0');
        await expect(step).toBeVisible();
        const fontSize = await step.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(fontSize).toBeGreaterThanOrEqual(18);

        await dialog.getByRole('tab', { name: /^Share$/i }).click();
        await expect(dialog.getByTestId('share-text-family')).toHaveAttribute('href', /^sms:/);
        await expect(dialog.getByTestId('share-email-family')).toHaveAttribute('href', /^mailto:/);

        const actionBar = dialog.getByTestId('recipe-modal-action-bar');
        await expect(actionBar).toBeVisible();
        const scrollBtn = dialog.getByTestId('recipe-scroll-to-top');
        if (await scrollBtn.isVisible().catch(() => false)) {
            const scrollBox = await scrollBtn.boundingBox();
            const barBox = await actionBar.boundingBox();
            expect(scrollBox && barBox).toBeTruthy();
            expect(scrollBox!.y + scrollBox!.height).toBeLessThanOrEqual(barBox!.y + 4);
        }
    });

    test('grocery list is one-thumb: 16px field, 44px rows, check and add', async ({ page }) => {
        await page.getByTestId('bottom-nav-grocery').click();
        await expect(page.getByRole('heading', { name: /grocery list/i, level: 2 })).toBeVisible();

        const input = page.getByLabel(/Add an item to your grocery list/i);
        await expect(input).toBeVisible();
        const inputSize = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(inputSize).toBeGreaterThanOrEqual(16);

        await input.fill('2 lemons');
        await page.getByRole('button', { name: /^Add$/i }).click();
        await expect(page.getByText('2 lemons')).toBeVisible();

        const row = page.getByTestId('grocery-item-row').first();
        await minHeightAtLeast(row);
        await row.click();
        await expect(page.getByText(/· 1 checked/)).toBeVisible({ timeout: 10000 });
    });
});

test.describe('iOS Add to Home Screen hint', () => {
    test.use({
        viewport: { width: 390, height: 844 },
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        isMobile: true,
        hasTouch: true,
    });

    test('shows a one-time Home Screen hint above the tab bar, then stays dismissed', async ({
        page,
    }) => {
        await loginAsHome(page, 'Pat');
        const banner = page.getByTestId('install-prompt');
        await expect(banner).toBeVisible({ timeout: 10000 });
        await expect(banner).toContainText(/Add to Home Screen/i);
        await expect(banner).toHaveClass(/--app-bottom-nav-clearance/);
        await page.getByTestId('install-prompt-dismiss').click();
        await expect(banner).toHaveCount(0);

        await page.reload();
        await expect(page.getByTestId('bottom-nav')).toBeVisible();
        await expect(page.getByTestId('install-prompt')).toHaveCount(0);
    });
});
