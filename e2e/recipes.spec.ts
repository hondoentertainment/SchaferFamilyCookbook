import { test, expect } from '@playwright/test';
import { loginAs, recipeCardOpenInMainGrid } from './fixtures';

test.describe('Recipes tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('displays hero section and recipe count', async ({ page }) => {
    // The headline exists in both the mobile and desktop hero sections; use
    // getByRole so the CSS-hidden variant (absent from the a11y tree) is
    // excluded and only the visible heading matches.
    await expect(page.getByRole('heading', { name: /Find something worth cooking tonight/i })).toBeVisible();
    await expect(page.getByText(/The Schafer Cookbook/i)).toBeVisible();
    await expect(page.getByText(/Search \d+ family recipes by dish, ingredient, person, season, or occasion/i)).toBeVisible();
  });

  test('search filter narrows recipes', async ({ page }) => {
    await page.getByRole('textbox', { name: /Search recipes, ingredients/i }).fill('Festive');
    await expect(recipeCardOpenInMainGrid(page).filter({ has: page.getByAltText(/Festive/) })).toBeVisible({
      timeout: 3000,
    });
  });

  test('category filter works', async ({ page }) => {
    const categoryFilter = page.getByLabel(/Filter by category/i).first();
    await categoryFilter.selectOption('Dessert');
    await expect(categoryFilter).toHaveValue('Dessert');
  });

  test('contributor filter exists', async ({ page }) => {
    await expect(page.getByLabel(/Filter by contributor/i).first()).toBeVisible();
  });

  test('empty filter shows empty message', async ({ page }) => {
    await page.getByRole('textbox', { name: /Search recipes, ingredients/i }).fill('xyznonexistent123');
    await expect(page.getByText(/No recipes match your search or filters/i)).toBeVisible({ timeout: 3000 });
  });
});
