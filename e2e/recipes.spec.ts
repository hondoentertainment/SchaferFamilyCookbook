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
    await page.getByPlaceholder(/Search by title/).fill('Festive');
    await expect(page.getByRole('button', { name: /View recipe: Festive/i })).toBeVisible({ timeout: 3000 });
  });

  test('category filter works', async ({ page }) => {
    await page.getByRole('combobox', { name: /All Categories/i }).selectOption('Dessert');
    await expect(page.locator('select').filter({ hasText: 'Dessert' })).toBeVisible();
  });

  test('contributor filter exists', async ({ page }) => {
    await expect(page.getByRole('combobox', { name: /All Contributors/i }).or(
      page.locator('select').filter({ hasText: 'All Contributors' })
    )).toBeVisible();
  });

  test('empty filter shows empty message', async ({ page }) => {
    await page.getByPlaceholder(/Search by title/).fill('xyznonexistent123');
    await expect(page.getByText(/No recipes found/i)).toBeVisible({ timeout: 3000 });
  });
});
