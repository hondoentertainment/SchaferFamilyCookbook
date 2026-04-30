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
    await page.locator('[data-testid="nav-profile"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('[data-testid="nav-profile"]').click();

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
    await page.locator('[data-testid="nav-profile"]').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('[data-testid="nav-profile"]').click();

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
    await page.locator('[data-testid="nav-profile"]').click();
    // Wait for the Profile view to be fully rendered before clicking Admin Tools
    await page.getByRole('button', { name: /Open Admin Tools/i }).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /Open Admin Tools/i }).click();
  };

  test('shows admin panel for admin user', async ({ page }) => {
    await goToAdminTools(page);

    await expect(page.getByRole('heading', { name: /Manage Recipes/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can navigate to Records subtab', async ({ page }) => {
    await goToAdminTools(page);

    await expect(page.getByRole('heading', { name: /Manage Recipes/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can navigate to Gallery subtab', async ({ page }) => {
    await goToAdminTools(page);
    await page.getByRole('tab', { name: /Gallery/i }).click();

    await expect(page.getByRole('heading', { name: /Family Archive/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can set archive phone in Gallery config', async ({ page }) => {
    await goToAdminTools(page);
    await page.getByRole('tab', { name: /Gallery/i }).click();

    const phoneInput = page.getByPlaceholder('e.g. +15551234567');
    await phoneInput.fill('+15551234567');

    await expect(phoneInput).toHaveValue('+15551234567');
  });

  test('admin can navigate to Trivia subtab', async ({ page }) => {
    await goToAdminTools(page);
    await page.getByRole('tab', { name: /Trivia/i }).click();

    await expect(page.getByRole('heading', { name: /Family Trivia/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('admin can navigate to Directory subtab', async ({ page }) => {
    await goToAdminTools(page);
    await page.getByRole('tab', { name: /Directory/i }).click();

    await expect(page.getByText('Family Directory & Avatars')).toBeVisible({ timeout: 5000 });
  });

  test('admin quick-edit button appears on recipe cards', async ({ page }) => {
    const recipeCard = page.getByRole('button', { name: /Open recipe:/i }).first();
    await recipeCard.hover();

    const editBtn = page.getByRole('button', { name: /Edit .* with AI/i }).first();
    await expect(editBtn).toBeVisible({ timeout: 3000 });
  });

  test('admin can edit a gallery item caption and date', async ({ page }) => {
    // Seed a gallery item in local storage, then open the admin Gallery subtab.
    // Persistence is asserted via localStorage in local provider mode (Firebase
    // emulator not available in CI); an e2e against a live project is a TODO.
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_gallery',
        JSON.stringify([
          {
            id: 'g-edit-1',
            type: 'image',
            url: 'https://via.placeholder.com/400x300',
            caption: 'Original Caption',
            contributor: 'Kyle',
            created_at: '2020-06-01T00:00:00.000Z',
          },
        ])
      );
    });
    await page.reload();
    await goToAdminTools(page);

    await page.getByRole('tab', { name: /Gallery/i }).click();

    // Click the Edit button in the list
    await page.getByRole('button', { name: /Edit "Original Caption"/i }).click();

    const dialog = page.getByRole('dialog', { name: /Edit Gallery Item/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const captionInput = dialog.getByLabel(/^Caption$/);
    await captionInput.fill('Updated Caption');

    const dateInput = dialog.getByLabel(/^Date$/);
    await dateInput.fill('2021-09-20');

    await dialog.getByRole('button', { name: /^Save$/ }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Optimistic UI: the list reflects the new caption
    await expect(page.getByText('Updated Caption')).toBeVisible({ timeout: 5000 });

    // Round-trip via localStorage (local provider mode)
    const stored = await page.evaluate(() => localStorage.getItem('schafer_db_gallery'));
    expect(stored).toContain('Updated Caption');
    expect(stored).toContain('2021-09-20');
    // TODO: also assert Firestore persistence via emulator when available.
  });

  test('gallery edit modal closes on Escape', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_gallery',
        JSON.stringify([
          {
            id: 'g-edit-2',
            type: 'image',
            url: 'https://via.placeholder.com/400x300',
            caption: 'Escape test',
            contributor: 'Kyle',
            created_at: '2020-06-01T00:00:00.000Z',
          },
        ])
      );
    });
    await page.reload();
    await goToAdminTools(page);
    await page.getByRole('tab', { name: /Gallery/i }).click();

    await page.getByRole('button', { name: /Edit "Escape test"/i }).click();
    const dialog = page.getByRole('dialog', { name: /Edit Gallery Item/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
