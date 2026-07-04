import { test, expect } from '@playwright/test';
import { loginAs, loginAsHome, openFirstRecipeCardInMainGrid } from './fixtures';

function recipeDetailsDialog(page: import('@playwright/test').Page) {
    return page.locator('[role="dialog"][aria-label="Recipe details"]');
}

test.describe('UX collapsible panels (batch 5)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAsHome(page, 'Alice');
    });

    test('Browse all recipes focuses the search field', async ({ page }) => {
        await page.getByRole('button', { name: 'Browse all recipes' }).click();
        const search = page.getByRole('textbox', { name: /Search recipes, ingredients/i });
        await expect(search).toBeVisible({ timeout: 10000 });
        await expect(search).toBeFocused({ timeout: 3000 });
    });

    test('recipe shelf tabs switch between recent and favorites when both exist', async ({ page }) => {
        await page.getByRole('button', { name: 'Browse all recipes' }).click();
        await expect(page.getByTestId('recipe-card-grid')).toBeVisible({ timeout: 10000 });
        await openFirstRecipeCardInMainGrid(page);
        await recipeDetailsDialog(page).getByRole('button', { name: /Close recipe/i }).click();

        await page.getByRole('button', { name: 'Home', exact: true }).click();
        const recentTab = page.getByRole('tab', { name: /Recently viewed/i });
        const favTab = page.getByRole('tab', { name: /Favorites/i });
        if (!(await recentTab.isVisible().catch(() => false)) || !(await favTab.isVisible().catch(() => false))) {
            test.skip();
            return;
        }
        await favTab.click();
        await expect(favTab).toHaveAttribute('aria-selected', 'true');
        await recentTab.click();
        await expect(recentTab).toHaveAttribute('aria-selected', 'true');
    });

    test('meal plan week actions stay visible in sticky footer', async ({ page }) => {
        await page.getByRole('button', { name: /^Groceries$/i }).click();
        await page.getByRole('button', { name: /^Meal Plan$/i }).click();
        await expect(page.getByTestId('meal-plan-view')).toBeVisible({ timeout: 5000 });

        const copyWeek = page.getByTestId('meal-plan-copy-week');
        await expect(copyWeek).toBeVisible();
        const box = await copyWeek.boundingBox();
        expect(box).toBeTruthy();
        if (box) {
            const viewport = page.viewportSize();
            expect(viewport).toBeTruthy();
            if (viewport) {
                expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2);
            }
        }
    });
});

test.describe('Recipe modal suggestions', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
    });

    test('You might also like expands before navigation', async ({ page }) => {
        await openFirstRecipeCardInMainGrid(page);
        await expect(recipeDetailsDialog(page)).toBeVisible({ timeout: 5000 });
        const suggestionsToggle = recipeDetailsDialog(page).getByRole('button', { name: /You might also like/i });
        if (!(await suggestionsToggle.isVisible().catch(() => false))) {
            test.skip();
            return;
        }
        await suggestionsToggle.click();
        await expect(suggestionsToggle).toHaveAttribute('aria-expanded', 'true');
    });
});
