import { test, expect } from '@playwright/test';
import { loginAs, openFirstRecipeCardInMainGrid } from './fixtures';

test.describe('Grocery list', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
    });

    test('add recipe ingredients, check one off, clear checked, and clear all', async ({ page }) => {
        // Open the first recipe in the main grid (exclude horizontal shelves).
        await openFirstRecipeCardInMainGrid(page);
        await expect(page.locator('[role="dialog"][aria-label="Recipe details"]')).toBeVisible({ timeout: 5000 });

        // Click "Add to Grocery List"
        const addBtn = page.getByTestId('recipe-modal-add-to-grocery');
        await expect(addBtn).toBeVisible();
        await addBtn.click();

        // Toast confirms the add; optional shortcut to grocery tab
        await expect(page.getByText(/Added \d+ items? to Grocery List/i)).toBeVisible({
            timeout: 3000,
        });
        await page.getByTestId('toast-action').click();
        await expect(page.getByRole('heading', { name: /grocery list/i, level: 2 })).toBeVisible({ timeout: 5000 });

        // There should be at least one checkbox for a grocery item
        const checkboxes = page.getByRole('checkbox', { name: /Mark ".+" as bought/i });
        await expect(checkboxes.first()).toBeVisible();
        const totalBefore = await checkboxes.count();
        expect(totalBefore).toBeGreaterThan(0);

        // Check one specific item. Plain click (not check()): checking flips
        // the aria-label to "as not bought" and moves the row into the bought
        // group, so check()'s post-click verification would wait forever for
        // the original locator. Force skips stability checks during the
        // reorder; the flipped-label assertion verifies the state change.
        const firstLabel = await checkboxes.first().getAttribute('aria-label');
        await page.getByRole('checkbox', { name: firstLabel!, exact: true }).click({ force: true });
        // The bought row moves into a collapsed section; the Clear-checked
        // counter is the stable signal that exactly one item is now checked.
        await expect(page.getByRole('button', { name: /Clear checked \(1\)/i })).toBeVisible({ timeout: 5000 });

        // Clear checked
        await page.getByRole('button', { name: /Clear checked/i }).click();

        // One fewer item should remain
        const remaining = page.getByRole('checkbox', { name: /Mark ".+" as bought/i });
        await expect.poll(async () => remaining.count()).toBe(totalBefore - 1);

        // Clear all (confirm)
        await page.getByRole('button', { name: /^Clear all$/i }).click();
        await expect(page.getByRole('dialog', { name: /Clear grocery list\?/i })).toBeVisible();
        // Click the dialog's confirm button (labelled "Clear all")
        await page
            .getByRole('dialog')
            .getByRole('button', { name: /^Clear all$/i })
            .click();

        await expect(
            page.getByText(/Your grocery list is empty\. Add ingredients from a recipe\./i),
        ).toBeVisible();
    });

    test('manual "Add item" input adds a standalone entry', async ({ page }) => {
        // Navigate straight to Grocery List via the Cook tab.
        await page.getByRole('button', { name: /^Groceries$/i }).click();

        await page.getByLabel(/Add an item to your grocery list/i).fill('12 limes');
        await page.getByRole('button', { name: /^Add$/i }).click();
        await expect(page.getByText('12 limes')).toBeVisible();
        // Manual items group under "Other"
        await expect(page.getByRole('heading', { name: 'Other', level: 3 })).toBeVisible();
    });
});
