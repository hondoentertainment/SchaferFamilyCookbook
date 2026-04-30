import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('shows login form when not authenticated', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByRole('heading', { name: /who's cooking/i })).toBeVisible();
    await expect(page.getByPlaceholder(/your name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^continue$/i })).toBeVisible();
  });

  test('accepts name and enters the archive', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByPlaceholder(/your name/i).fill('Grandma Joan');
    await page.getByRole('button', { name: /^continue$/i }).click();

    // Lands on Home tab, where the personalized greeting is shown.
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening|night)/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Recipes', exact: true }).first()).toBeVisible();
  });

  test('need access link is present', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByRole('link', { name: /Need access\? Email an admin\./i })).toBeVisible();
  });
});
