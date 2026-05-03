import { test, expect } from '@playwright/test';
import { loginAs, openFirstRecipeCardInMainGrid, recipeCardOpenInMainGrid } from './fixtures';

/** Recipe modal exposes aria-label + aria-labelledby on the root; AX name resolves to recipe title via labelledby. */
function recipeDetailsDialog(page: import('@playwright/test').Page) {
  return page.locator('[role="dialog"][aria-label="Recipe details"]');
}

test.describe('Recipe modal', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('opens when clicking a recipe card', async ({ page }) => {
    await openFirstRecipeCardInMainGrid(page);

    await expect(recipeDetailsDialog(page)).toBeVisible({ timeout: 3000 });
    await expect(recipeDetailsDialog(page).getByRole('button', { name: /Close recipe/i })).toBeVisible();
  });

  test('shows recipe details', async ({ page }) => {
    await openFirstRecipeCardInMainGrid(page);

    await expect(recipeDetailsDialog(page)).toBeVisible();
    await expect(recipeDetailsDialog(page).getByRole('heading', { level: 2 }).first()).toBeVisible();
  });

  test('closes on close button', async ({ page }) => {
    await openFirstRecipeCardInMainGrid(page);
    await expect(recipeDetailsDialog(page)).toBeVisible();

    await recipeDetailsDialog(page).getByRole('button', { name: /Close recipe/i }).click();
    await expect(recipeDetailsDialog(page)).not.toBeVisible({ timeout: 2000 });
  });

  test('closes on Escape key', async ({ page }) => {
    await openFirstRecipeCardInMainGrid(page);
    await expect(recipeDetailsDialog(page)).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    await expect(recipeDetailsDialog(page)).not.toBeVisible({ timeout: 2000 });
  });

  test('deep link opens recipe modal directly', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');

    // Dynamically look up the id for Festive Apple Dip from the rendered
    // recipe cards so the test does not depend on a specific seed id that
    // may change if recipes.json is reorganised.
    const festiveCard = recipeCardOpenInMainGrid(page)
        .filter({ has: page.getByAltText('Festive Apple Dip', { exact: true }) })
        .first();
    await festiveCard.waitFor({ state: 'visible', timeout: 5000 });
    // Click the card to trigger the hash update, then read the hash.
    await festiveCard.click();
    await expect(recipeDetailsDialog(page)).toBeVisible({ timeout: 5000 });
    const recipeId = await page.evaluate(() => {
      const m = window.location.hash.match(/^#recipe\/(.+)$/);
      if (!m) return null;
      return decodeURIComponent(m[1].replace(/\/cook\/?$/i, ''));
    });
    expect(recipeId).toBeTruthy();
    // Close modal, then navigate directly via hash to simulate deep-link entry.
    await recipeDetailsDialog(page).getByRole('button', { name: /Close recipe/i }).click();
    await expect(recipeDetailsDialog(page)).not.toBeVisible({ timeout: 2000 });

    await page.goto('/#recipe/' + encodeURIComponent(recipeId!));
    await page.reload();

    await expect(recipeDetailsDialog(page)).toBeVisible({ timeout: 5000 });
    await expect(recipeDetailsDialog(page).getByRole('heading', { name: 'Festive Apple Dip' })).toBeVisible();
  });

  test('deep link with /cook opens cook mode', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');

    const festiveCard = recipeCardOpenInMainGrid(page)
      .filter({ has: page.getByAltText('Festive Apple Dip', { exact: true }) })
      .first();
    await festiveCard.waitFor({ state: 'visible', timeout: 5000 });
    await festiveCard.click();
    await expect(recipeDetailsDialog(page)).toBeVisible({ timeout: 5000 });
    const recipeId = await page.evaluate(() => {
      const m = window.location.hash.match(/^#recipe\/(.+)$/);
      if (!m) return null;
      return decodeURIComponent(m[1].replace(/\/cook\/?$/i, ''));
    });
    expect(recipeId).toBeTruthy();
    await recipeDetailsDialog(page).getByRole('button', { name: /Close recipe/i }).click();
    await expect(recipeDetailsDialog(page)).not.toBeVisible({ timeout: 2000 });

    await page.goto(`/#recipe/${encodeURIComponent(recipeId!)}/cook`);
    await page.reload();

    await expect(page.getByRole('application', { name: /Cook mode:/i })).toBeVisible({ timeout: 10000 });
    await expect(recipeDetailsDialog(page)).toHaveCount(0);
  });

  test('share and print actions are reachable from the More menu', async ({ page }) => {
    await openFirstRecipeCardInMainGrid(page);
    await expect(recipeDetailsDialog(page)).toBeVisible();

    // Share/Print/Email moved into the bottom-bar overflow menu (More actions).
    await recipeDetailsDialog(page).getByRole('button', { name: /^More actions$/i }).click();

    await expect(
      page
        .getByRole('menuitem', { name: /Share recipe:/i })
        .or(page.getByRole('menuitem', { name: /Email recipe/i }))
        .first()
    ).toBeVisible({ timeout: 2000 });

    await expect(page.getByRole('menuitem', { name: /^Print recipe$/ })).toBeVisible({ timeout: 2000 });
  });
});
