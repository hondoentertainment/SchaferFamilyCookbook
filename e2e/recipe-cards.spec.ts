import { test, expect } from '@playwright/test';
import { loginAs, recipeCardOpenInMainGrid } from './fixtures';

function recipeDetailsDialog(page: import('@playwright/test').Page) {
  return page.locator('[role="dialog"][aria-label="Recipe details"]');
}

test.describe('Recipe cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('horizontal shelf card opens recipe modal', async ({ page }) => {
    const shelf = page.getByRole('region', { name: 'Sweet finish' });
    await shelf.waitFor({ state: 'visible', timeout: 15000 });
    await shelf.getByTestId('recipe-card-open').first().click();
    await expect(recipeDetailsDialog(page)).toBeVisible({ timeout: 5000 });
  });

  test('main grid hero image loads', async ({ page }) => {
    const firstOpen = recipeCardOpenInMainGrid(page).first();
    await firstOpen.scrollIntoViewIfNeeded();
    const img = firstOpen.locator('img').first();
    await expect(img).toBeVisible();
    await expect
      .poll(
        async () => img.evaluate((el: HTMLImageElement) => (el.complete && el.naturalWidth > 0 ? el.naturalWidth : 0)),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
  });

  test('main grid photos are visible (not stuck at opacity 0)', async ({ page }) => {
    const firstOpen = recipeCardOpenInMainGrid(page).first();
    await firstOpen.scrollIntoViewIfNeeded();
    const img = firstOpen.locator('img').first();
    await expect(img).toBeVisible();
    await expect
      .poll(
        async () =>
          img.evaluate((el: HTMLImageElement) => {
            if (!el.complete || el.naturalWidth <= 0) return 0;
            return parseFloat(window.getComputedStyle(el).opacity);
          }),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0.9);
  });

  test('favorite toggle on grid card does not open modal', async ({ page }) => {
    const article = page.getByTestId('recipe-card-grid').locator('article').first();
    const title = await article.getByTestId('recipe-card-open').locator('img').first().getAttribute('alt');
    expect(title).toBeTruthy();
    await article.getByRole('button', { name: `Add ${title} to favorites` }).click();
    await expect(recipeDetailsDialog(page)).not.toBeVisible();
    await expect(article.getByRole('button', { name: `Remove ${title} from favorites` })).toBeVisible();
    await article.getByRole('button', { name: `Remove ${title} from favorites` }).click();
    await expect(article.getByRole('button', { name: `Add ${title} to favorites` })).toBeVisible();
  });
});
