import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Privacy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('Privacy is reachable from the Me tab', async ({ page }) => {
    await page.getByTestId('nav-profile').click();
    await page.getByRole('button', { name: /Open Privacy and Data view/i }).click();
    await expect(page.getByRole('heading', { name: /Privacy & data/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/What this site stores/i)).toBeVisible();
  });
});
