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
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/Preserving the/)).toBeVisible();
    await expect(page.getByText(/flavor/)).toBeVisible();
    await expect(page.getByText(/Recipes Archived/i)).toBeVisible();
  });

  test('search filter narrows recipes', async ({ page }) => {
    await page.getByPlaceholder(/Search by title/).fill('Festive');
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
    await page.getByPlaceholder(/Search by title/).fill('xyznonexistent123');
    await expect(page.getByText(/No recipes match your current filters/i)).toBeVisible({ timeout: 3000 });
  });
});
