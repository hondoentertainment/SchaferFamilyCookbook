import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Meal plan', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
    });

    test('assign a recipe to a day, then build a grocery list from the week', async ({ page }) => {
        // Reach the meal plan via Groceries → Meal Plan.
        await page.getByRole('button', { name: /^Groceries$/i }).click();
        await page.getByRole('button', { name: /^Meal Plan$/i }).click();
        await expect(page.getByTestId('meal-plan-view')).toBeVisible({ timeout: 5000 });

        // The grocery action starts disabled with an empty week.
        const generate = page.getByTestId('meal-plan-generate-groceries');
        await expect(generate).toBeDisabled();

        // Open the first day's picker and assign the first recipe.
        await page.getByTestId('meal-plan-add-recipe').first().click();
        const firstOption = page.getByTestId('meal-plan-picker-option').first();
        await expect(firstOption).toBeVisible();
        await firstOption.click();

        // The recipe now shows as a planned entry and the grocery action is enabled.
        await expect(page.getByTestId('meal-plan-entry').first()).toBeVisible();
        await expect(generate).toBeEnabled();

        // Build a grocery list from the planned week.
        await generate.click();
        await expect(page.getByText(/Added \d+ items? to Grocery List/i)).toBeVisible({ timeout: 3000 });

        // The toast action navigates to the grocery list.
        await page.getByTestId('toast-action').click();
        await expect(page.getByRole('heading', { name: /grocery list/i, level: 2 })).toBeVisible({
            timeout: 5000,
        });
    });
});
