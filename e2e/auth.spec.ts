import { test, expect } from '@playwright/test';
import { confirmCookbookLogin, waitForHomeMainHeading } from './fixtures';

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
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('schafer_onboarding_done', 'true');
    });
    await page.reload();

    await page.getByPlaceholder(/your name/i).fill('Grandma Joan');
    await page.getByRole('button', { name: /^continue$/i }).click();
    await confirmCookbookLogin(page);

    await waitForHomeMainHeading(page);
    await expect(page.getByRole('button', { name: 'Recipes', exact: true }).first()).toBeVisible();
  });

  test('need access link is present', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByRole('link', { name: /Email an admin/i })).toBeVisible();
  });
});
