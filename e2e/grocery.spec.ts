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

        // Toast confirms the add
        await expect(page.getByText(/Added \d+ items? to Grocery List/i)).toBeVisible({
            timeout: 3000,
        });

        // Close the modal
        await page.locator('[role="dialog"][aria-label="Recipe details"]').getByRole('button', { name: /Close recipe/i }).click();
        await expect(page.locator('[role="dialog"][aria-label="Recipe details"]')).not.toBeVisible({ timeout: 3000 });

        await page.getByRole('button', { name: /^Groceries$/i }).click();

        await expect(page.getByRole('heading', { name: /grocery list/i, level: 2 })).toBeVisible();

        // There should be at least one checkbox for a grocery item
        const checkboxes = page.getByRole('checkbox', { name: /Mark ".+" as bought/i });
        await expect(checkboxes.first()).toBeVisible();
        const totalBefore = await checkboxes.count();
        expect(totalBefore).toBeGreaterThan(0);

        // Check the first item
        await checkboxes.first().check();

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
