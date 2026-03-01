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
    await page.getByRole('button', { name: /view profile/i }).first().click();

    await expect(page.getByLabel(/Display Identity/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Save Profile/i })).toBeVisible();
    await expect(page.getByText(/Family Member|Legacy Custodian/i)).toBeVisible();
  });

  test('shows current user name in display', async ({ page }) => {
    await page.getByRole('button', { name: /view profile/i }).first().click();

    const nameInput = page.getByLabel(/Display Identity/i);
    await expect(nameInput).toHaveValue('Alice');
  });

  test('can edit display name', async ({ page }) => {
    await page.getByRole('button', { name: /view profile/i }).first().click();

    const nameInput = page.getByLabel(/Display Identity/i);
    await nameInput.clear();
    await nameInput.fill('Alice Smith');
    await page.getByRole('button', { name: /Save Profile/i }).click();

    await expect(page.getByText(/Profile [Uu]pdated/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('avatar picker button is present', async ({ page }) => {
    await page.getByRole('button', { name: /view profile/i }).first().click();

    await expect(page.getByRole('button', { name: /🎭/ }).or(
      page.locator('button').filter({ hasText: '🎭' })
    )).toBeVisible();
  });

  test('shows user recipes section', async ({ page }) => {
    await page.getByRole('button', { name: /view profile/i }).first().click();

    await expect(page.getByRole('heading', { name: /My Shared Recipes/i })).toBeVisible({ timeout: 3000 });
  });
});
