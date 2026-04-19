import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Recipes tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('displays hero section and recipe count', async ({ page }) => {
    await expect(page.getByText(/Preserving the/)).toBeVisible();
    await expect(page.getByText(/flavor/)).toBeVisible();
    await expect(page.getByText(/Recipes Archived/i)).toBeVisible();
  });

  test('search filter narrows recipes', async ({ page }) => {
    await page.getByRole('textbox', { name: /Search recipes, ingredients/i }).fill('Festive');
    await expect(page.getByRole('button', { name: /View recipe: Festive/i })).toBeVisible({ timeout: 3000 });
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
    await expect(page.getByText(/No recipes match your current filters/i)).toBeVisible({ timeout: 3000 });
  });

  test('featured strip renders from localStorage fallback', async ({ page }) => {
    // Seed featured ids before login so fallback kicks in without Firebase.
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('schafer_featured_ids', JSON.stringify(['749d8765']));
    });
    await page.reload();
    await loginAs(page, 'Alice');

    // Re-seed after loginAs clears storage, then reload so the effect re-runs.
    await page.evaluate(() => {
      localStorage.setItem('schafer_featured_ids', JSON.stringify(['749d8765']));
    });
    await page.reload();

    const featured = page.getByTestId('featured-recipes');
    await expect(featured).toBeVisible({ timeout: 5000 });
    await expect(featured.getByText(/Festive Apple Dip/i)).toBeVisible();
  });
});
