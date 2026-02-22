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
    await expect(page.locator('.print-recipe-content h1, [role="dialog"] h1').first()).toBeVisible();
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

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 });
  });

  test('deep link opens recipe modal directly', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');

    // Default recipes include "imported_9mrpvyxve" (Festive Apple Dip)
    const recipeId = 'imported_9mrpvyxve';
    await page.goto(`/#recipe/${encodeURIComponent(recipeId)}`);
    await page.reload();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Festive Apple Dip')).toBeVisible();
  });

  test('share button is present', async ({ page }) => {
    await page.getByRole('button', { name: /View recipe:/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(
      page.getByRole('button', { name: /Share|Copy link|Email/i })
    ).toBeVisible({ timeout: 2000 });
  });

  test('print button is present', async ({ page }) => {
    await page.getByRole('button', { name: /View recipe:/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await expect(page.getByRole('button', { name: /Print/i })).toBeVisible({ timeout: 2000 });
  });
});
