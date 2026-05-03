import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('shows the six primary nav tabs and no More menu', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recipes', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'A–Z', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Family', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Me', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'More sections' })).toHaveCount(0);
  });

  test('Recipes tab still has its editorial masthead', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Find something worth cooking tonight/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Search recipes, ingredients/i })).toBeVisible();
  });

  test('navigates to Gallery tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Family', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Family Gallery' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Want to add photos?' }).or(
        page.getByRole('heading', { name: 'The gallery awaits your memories' })
      ).first()
    ).toBeVisible();
  });

  test('navigates to Profile tab', async ({ page }) => {
    await page.getByTestId('nav-profile').click();
    await expect(page.getByRole('heading', { name: /^Identity$/i })).toBeVisible({ timeout: 5000 });
  });

  test('can log out', async ({ page }) => {
    await page.getByRole('button', { name: /Log out/i }).click();
    await expect(page.getByRole('heading', { name: /who's cooking/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByPlaceholder(/your name/i)).toBeVisible();
  });

  test('logo link returns to Home', async ({ page }) => {
    await page.getByRole('button', { name: 'Family', exact: true }).click();
    await page.getByRole('button', { name: /go to home/i }).click();
    await expect(
      page.locator('#main-content-home').getByRole('heading', { level: 1 }).filter({ hasText: /Good (morning|afternoon|evening)|Late night/i }),
    ).toBeVisible();
  });
});
