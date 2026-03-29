import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('shows login form when not authenticated', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByRole('heading', { name: /Welcome to the Family Table/i })).toBeVisible();
    await expect(page.getByLabel(/Legacy Contributor Name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Enter The Archive/i })).toBeVisible();
    await expect(page.getByText(/Step into the Schafer Family Archive/i)).toBeVisible();
  });

  test('accepts name and enters the archive', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByPlaceholder(/e\.g\. Grandma Joan/i).fill('Grandma Joan');
    await page.getByRole('button', { name: /Enter The Archive/i }).click();

    await expect(page.getByRole('button', { name: 'Recipes' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL('/');
  });

  test('need access link is present', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByRole('link', { name: /Need access\? Contact an administrator\./i })).toBeVisible();
  });

  test('redirects to login when visiting a protected route unauthenticated', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/gallery');

    await expect(page.getByRole('heading', { name: /Welcome to the Family Table/i })).toBeVisible({ timeout: 10000 });
  });
});
