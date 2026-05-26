import { test, expect } from '@playwright/test';
import { loginAs, loginAsAdmin, recipeCardOpenInMainGrid } from './fixtures';

/**
 * Admin E2E coverage strategy:
 * - UI flows (tabs, forms, optimistic updates) run against the local provider
 *   with data seeded via localStorage — no custodian Google auth required.
 * - Firestore persistence and security rules are asserted separately by
 *   `firebase/firestore.rules.test.ts` in the CI `firestore-rules` job
 *   (Firestore emulator). Playwright CI starts Firestore + Storage emulators for
 *   app wiring, but these specs intentionally avoid credentialed cloud writes.
 */

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
    const recipeCard = recipeCardOpenInMainGrid(page).first();
    await recipeCard.hover();

    const editBtn = page.getByRole('button', { name: /Edit .* with AI/i }).first();
    await expect(editBtn).toBeVisible({ timeout: 3000 });
  });

  test('admin can edit a gallery item caption and date', async ({ page }) => {
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

    // Local provider round-trip (Firestore writes covered by rules tests in CI).
    const stored = await page.evaluate(() => localStorage.getItem('schafer_db_gallery'));
    expect(stored).toContain('Updated Caption');
    expect(stored).toContain('2021-09-20');
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

  test('featured recipes appear on Recipes tab and open the recipe modal', async ({ page }) => {
    // Seed a featured recipe directly so the test is deterministic and does not
    // depend on the admin form persistence path (covered by AdminView unit tests).
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_recipes',
        JSON.stringify([
          {
            id: 'feat-e2e-1',
            title: 'Heirloom Hero Pie',
            contributor: 'Kyle',
            category: 'Dessert',
            ingredients: ['1 cup flour', '2 apples'],
            instructions: ['Mix', 'Bake at 375'],
            image: 'https://via.placeholder.com/600x400',
            featured: true,
            created_at: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'plain-e2e-1',
            title: 'Plain Toast',
            contributor: 'Kyle',
            category: 'Breakfast',
            ingredients: ['Bread'],
            instructions: ['Toast'],
            image: '',
            created_at: '2024-01-01T00:00:00.000Z',
          },
        ])
      );
    });
    await page.reload();

    // Admin Tools → Manage Recipes should show the Featured badge for our seed.
    await goToAdminTools(page);
    await expect(page.getByLabel(/Heirloom Hero Pie is featured/i)).toBeVisible({ timeout: 5000 });

    // Navigate to the Recipes tab and verify the Featured strip renders.
    await page.getByRole('button', { name: /^Recipes$/, exact: true }).first().click();
    const strip = page.getByTestId('featured-strip');
    await expect(strip).toBeVisible({ timeout: 5000 });

    const card = strip.getByRole('button', { name: /Open featured recipe: Heirloom Hero Pie/i });
    await expect(card).toBeVisible();
    await card.click();

    // Recipe modal opens with the recipe title.
    await expect(page.getByRole('dialog').filter({ hasText: /Heirloom Hero Pie/ }).first()).toBeVisible({ timeout: 5000 });
  });

  test('admin toggle persists featured flag and surfaces a Featured badge', async ({ page }) => {
    // Seed a single, non-featured recipe owned by the admin.
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_recipes',
        JSON.stringify([
          {
            id: 'toggle-e2e-1',
            title: 'Toggle Me Pie',
            contributor: 'Kyle',
            category: 'Dessert',
            ingredients: ['1 cup flour'],
            instructions: ['Bake'],
            image: 'https://via.placeholder.com/600x400',
            created_at: '2025-02-01T00:00:00.000Z',
          },
        ])
      );
    });
    await page.reload();
    await goToAdminTools(page);

    // No featured badge yet.
    await expect(page.getByLabel(/Toggle Me Pie is featured/i)).toHaveCount(0);

    // Open the recipe in the editor by clicking Edit in the Manage Recipes list.
    await page.getByRole('button', { name: /Edit Toggle Me Pie/i }).first().click();

    // Toggle the Feature switch on and save.
    const toggle = page.getByRole('switch', { name: /Feature on Home and Recipes/i });
    await expect(toggle).toBeVisible({ timeout: 5000 });
    await toggle.check();

    await page.getByRole('button', { name: /Update Record/i }).click();

    // Badge should now appear in the Manage Recipes list (optimistic UI).
    await expect(page.getByLabel(/Toggle Me Pie is featured/i)).toBeVisible({ timeout: 5000 });

    // Featured strip on the Recipes tab reflects the persisted flag.
    await page.getByRole('button', { name: /^Recipes$/, exact: true }).first().click();
    const strip = page.getByTestId('featured-strip');
    await expect(strip).toBeVisible({ timeout: 5000 });
    await expect(strip.getByRole('button', { name: /Open featured recipe: Toggle Me Pie/i })).toBeVisible();

    // Local provider round-trip (Firestore writes covered by rules tests in CI).
    const stored = await page.evaluate(() => localStorage.getItem('schafer_db_recipes'));
    expect(stored).toContain('"featured":true');
  });
});
