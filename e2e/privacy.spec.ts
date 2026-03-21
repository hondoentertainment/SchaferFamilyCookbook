import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Privacy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('Privacy tab shows policy heading', async ({ page }) => {
    await page.getByRole('button', { name: 'Privacy' }).first().click();
    await expect(page.getByRole('heading', { name: /Privacy & data/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/What this site stores/i)).toBeVisible();
  });
});
