import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('shows login form when not authenticated', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByText('Identify Yourself')).toBeVisible();
    await expect(page.getByPlaceholder(/e\.g\. Grandma Joan/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Enter The Archive/i })).toBeVisible();
    await expect(page.getByText('Welcome to the Schafer Family Archive')).toBeVisible();
  });

  test('accepts name and enters the archive', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByPlaceholder(/e\.g\. Grandma Joan/i).fill('Grandma Joan');
    await page.getByRole('button', { name: /Enter The Archive/i }).click();

    await expect(page.getByRole('button', { name: 'Recipes' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('need access link is present', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(
      page.getByRole('link', { name: /Need access\?/i })
    ).toBeVisible();
  });
});
