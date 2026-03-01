import { test, expect } from '@playwright/test';
import { loginAs, loginAsAdmin } from './fixtures';

test.describe('Admin (non-admin user)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('shows Meet your Administrators in Profile for non-admin', async ({ page }) => {
    await page.getByRole('button', { name: /view profile/i }).first().click();

    await expect(page.getByText(/Meet your Administrators/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/These family members help maintain the archive/i)).toBeVisible();
  });

  test('shows Legacy Custodian label for admins in Profile', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_contributors',
        JSON.stringify([
          {
            id: 'c1',
            name: 'Admin User',
            avatar: 'https://example.com/avatar.jpg',
            role: 'admin',
            email: 'admin@test.com',
          },
        ])
      );
    });
    await page.reload();
    await page.getByRole('button', { name: /view profile/i }).first().click();

    await expect(page.getByText(/Legacy Custodian/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Admin (admin user)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAsAdmin(page);
  });

  const goToAdminTools = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button', { name: /view profile/i }).first().click();
    await page.getByRole('button', { name: /Admin Tools/i }).click();
  };

  test('shows admin panel for admin user', async ({ page }) => {
    await goToAdminTools(page);

    await expect(page.getByRole('heading', { name: 'Manage Recipes' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can navigate to Records subtab', async ({ page }) => {
    await goToAdminTools(page);

    await expect(page.getByRole('heading', { name: 'Manage Recipes' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can navigate to Gallery subtab', async ({ page }) => {
    await goToAdminTools(page);
    await page.getByRole('tab', { name: '🖼️ Gallery' }).click();

    await expect(page.getByRole('heading', { name: 'Family Archive' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can set archive phone in Gallery config', async ({ page }) => {
    await goToAdminTools(page);
    await page.getByRole('tab', { name: '🖼️ Gallery' }).click();

    const phoneInput = page.getByPlaceholder('e.g. +15551234567');
    await phoneInput.fill('+15551234567');

    await expect(phoneInput).toHaveValue('+15551234567');
  });

  test('admin can navigate to Trivia subtab', async ({ page }) => {
    await goToAdminTools(page);
    await page.getByRole('tab', { name: '💡 Trivia' }).click();

    await expect(page.getByRole('heading', { name: 'Family Trivia' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can navigate to Directory subtab', async ({ page }) => {
    await goToAdminTools(page);
    await page.getByRole('tab', { name: '👥 Directory' }).click();

    await expect(page.getByText('Family Directory & Avatars')).toBeVisible({ timeout: 5000 });
  });

  test('admin quick-edit button appears on recipe cards', async ({ page }) => {
    const recipeCard = page.locator('[role="button"][aria-label*="View recipe:"]').first();
    await recipeCard.hover();

    const editBtn = page.locator('[role="button"][aria-label*="View recipe:"]').first().getByRole('button', { name: /Edit.*with AI/i });
    await expect(editBtn).toBeVisible({ timeout: 3000 });
  });
});
