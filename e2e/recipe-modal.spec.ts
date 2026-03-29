import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Recipe modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('opens when clicking a recipe card', async ({ page }) => {
    const firstRecipe = page.getByRole('button', { name: /View recipe:/i }).first();
    await firstRecipe.click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /Close recipe/i })).toBeVisible();
  });

  test('shows recipe details', async ({ page }) => {
    await page.getByRole('button', { name: /View recipe:/i }).first().click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('[role="dialog"] h2').first()).toBeVisible();
  });

  test('closes on close button', async ({ page }) => {
    await page.getByRole('button', { name: /View recipe:/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('button', { name: /Close recipe/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 });
  });

  test('closes on Escape key', async ({ page }) => {
    await page.getByRole('button', { name: /View recipe:/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 });
  });

  test('deep link opens recipe modal directly via /recipes/:id', async ({ page }) => {
    const recipeId = 'imported_9mrpvyxve';
    await page.goto('/recipes/' + encodeURIComponent(recipeId));

    // Should redirect to login first since we cleared storage in beforeEach
    // Log in again, then navigate to the deep link
    await loginAs(page, 'Alice');
    await page.goto('/recipes/' + encodeURIComponent(recipeId));

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Festive Apple Dip' })).toBeVisible();
  });

  test('share button is present', async ({ page }) => {
    await page.getByRole('button', { name: /View recipe:/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(
      page.getByRole('button', { name: /Share recipe/i }).or(
        page.getByRole('link', { name: /Email recipe/i })
      ).first()
    ).toBeVisible({ timeout: 2000 });
  });

  test('print button is present', async ({ page }) => {
    await page.getByRole('button', { name: /View recipe:/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(page.getByRole('button', { name: /Print recipe/i })).toBeVisible({ timeout: 2000 });
  });
});
