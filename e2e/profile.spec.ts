import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('displays profile with identity and role', async ({ page }) => {
    await page.getByTestId('nav-profile').click();

    await expect(page.getByTestId('profile-display-name')).toBeVisible();
    await expect(page.getByRole('button', { name: /Edit display name/i })).toBeVisible();
    await expect(page.getByLabel(/Family Member|Legacy Custodian/i).first()).toBeVisible();
  });

  test('shows current user name in display', async ({ page }) => {
    await page.getByTestId('nav-profile').click();

    await expect(page.getByTestId('profile-display-name')).toHaveText('Alice');
  });

  test('can edit display name', async ({ page }) => {
    await page.getByTestId('nav-profile').click();

    await page.getByRole('button', { name: /Edit display name/i }).click();
    const nameInput = page.getByLabel(/^Display name$/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Alice Smith');
    await page.getByRole('button', { name: /Save display name/i }).click();

    await expect(page.getByText(/display name updated/i).first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('profile-display-name')).toHaveText('Alice Smith');
  });

  test('avatar picker button is present', async ({ page }) => {
    await page.getByTestId('nav-profile').click();

    await expect(page.getByRole('button', { name: /Change avatar/i })).toBeVisible();
  });

  test('shows user recipes section', async ({ page }) => {
    await page.getByTestId('nav-profile').click();

    await expect(page.getByRole('heading', { name: /My Shared Recipes/i })).toBeVisible({ timeout: 3000 });
  });
});
