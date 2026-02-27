import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('shows all main nav tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Recipes' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'A–Z' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gallery' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Grocery' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trivia' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Family Story' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contributors' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Profile' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Admin/i })).toBeVisible();
  });

  test('navigates to Recipes tab by default', async ({ page }) => {
    await expect(page.getByText(/Preserving the/)).toBeVisible();
    await expect(page.getByPlaceholder(/Search by title/)).toBeVisible();
  });

  test('navigates to Index tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Index' }).click();
    await expect(page.getByRole('heading', { name: /Alphabetical|Index/i })).toBeVisible({ timeout: 5000 });
  });

  test('navigates to Gallery tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Gallery' }).click();
    await expect(page.getByRole('heading', { name: 'Family Gallery' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Want to add photos?' }).or(
        page.getByRole('heading', { name: 'The gallery awaits your memories' })
      ).first()
    ).toBeVisible();
  });

  test('navigates to Trivia tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Trivia' }).click();
    await expect(
      page.getByRole('heading', { name: 'Family Heritage Quiz' }).or(
        page.getByText('Quiz Archive is Empty')
      ).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('navigates to Family Story tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Family Story' }).click();
    await expect(
      page.getByRole('heading', { name: /Schafer.*Oehler|Family Food History/ }).or(
        page.getByText('Our family has been involved')
      ).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('navigates to Contributors tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Contributors' }).click();
    await expect(page.getByText(/The Contributors|Contributors/i)).toBeVisible({ timeout: 5000 });
  });

  test('navigates to Profile tab', async ({ page }) => {
    await page.locator('#tab-Profile').click();
    await expect(page.getByLabel(/Display Identity/i)).toBeVisible({ timeout: 5000 });
  });

  test('can log out', async ({ page }) => {
    await page.getByRole('button', { name: /Log out/i }).click();
    await expect(page.getByText('Identify Yourself')).toBeVisible({ timeout: 3000 });
  });

  test('logo link returns to Recipes', async ({ page }) => {
    await page.getByRole('button', { name: 'Gallery' }).click();
    await page.getByRole('button', { name: /Go to Recipes/i }).click();
    await expect(page.getByPlaceholder(/Search by title/)).toBeVisible();
  });
});
