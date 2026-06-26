import { test, expect } from '@playwright/test';
import { loginAsHome, openFirstRecipeCardInMainGrid } from './fixtures';

function recipeDetailsDialog(page: import('@playwright/test').Page) {
  return page.locator('[role="dialog"][aria-label="Recipe details"]');
}

test.describe('Home dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAsHome(page, 'Alice');
  });

  test('shows greeting, stats, and quick actions', async ({ page }) => {
    await expect(page.locator('#main-content-home')).toBeVisible();
    await expect(
      page.locator('#main-content-home').getByRole('heading', { level: 1 }).filter({ hasText: /Good (morning|afternoon|evening)|Late night/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Browse all recipes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plan & shop' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Family hub' })).toBeVisible();
    await expect(page.getByText(/Recipes$/).first()).toBeVisible();
  });

  test('Browse all recipes shortcut opens Recipes tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Browse all recipes' }).click();
    await expect(page.getByRole('textbox', { name: /Search recipes, ingredients/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId('recipe-card-grid')).toBeVisible({ timeout: 10000 });
  });

  test('Plan & shop shortcut opens Grocery List', async ({ page }) => {
    await page.getByRole('button', { name: 'Plan & shop' }).click();
    await expect(page.getByRole('heading', { name: /Grocery List/i })).toBeVisible({ timeout: 5000 });
  });

  test('trivia teaser navigates to Trivia when questions exist', async ({ page }) => {
    const triviaCard = page.getByTestId('home-open-trivia');
    if (await triviaCard.isVisible().catch(() => false)) {
      await triviaCard.click();
      await expect(page.getByRole('heading', { name: /Family Heritage Quiz|Trivia/i }).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('recipe of the week opens modal with Home breadcrumb', async ({ page }) => {
    const openWeek = page.getByRole('button', { name: /Open recipe:/i }).first();
    if (!(await openWeek.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    const recipeLabel = await openWeek.getAttribute('aria-label');
    await openWeek.click();
    await expect(recipeDetailsDialog(page)).toBeVisible({ timeout: 5000 });
    await expect(recipeDetailsDialog(page).getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Home');
    if (recipeLabel) {
      await expect(recipeDetailsDialog(page)).toContainText(recipeLabel.replace(/^Open recipe:\s*/i, ''));
    }
  });
});

test.describe('Section sub-navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAsHome(page, 'Alice');
  });

  test('Recipes sub-nav switches to Collections', async ({ page }) => {
    await page.getByRole('button', { name: 'Browse all recipes' }).click();
    await expect(page.getByRole('region', { name: /Recipe browsing navigation/i })).toBeVisible();
    await page.getByRole('button', { name: 'Collections', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Collections/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('Family sub-nav switches between Gallery and Trivia', async ({ page }) => {
    await page.getByRole('button', { name: 'Family hub' }).click();
    await expect(page.getByRole('heading', { name: 'Family Gallery' })).toBeVisible();
    const familySubNav = page.getByRole('region', { name: /Family hub navigation/i });
    await familySubNav.getByRole('button', { name: /^Trivia\b/ }).click();
    await expect(page.getByRole('heading', { name: /Family Heritage Quiz|Trivia/i }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('Cook sub-nav switches between Grocery List and Meal Plan', async ({ page }) => {
    await page.getByRole('button', { name: 'Plan & shop' }).click();
    await expect(page.getByRole('heading', { name: /Grocery List/i })).toBeVisible();
    await page.getByRole('button', { name: 'Meal Plan', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Meal Plan/i }).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Home deep links', () => {
  test('hash recipe link opens modal while on Home', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAsHome(page, 'Alice');

    await page.getByRole('button', { name: 'Browse all recipes' }).click();
    await expect(page.getByTestId('recipe-card-grid')).toBeVisible({ timeout: 10000 });
    await openFirstRecipeCardInMainGrid(page);
    await expect(recipeDetailsDialog(page)).toBeVisible({ timeout: 5000 });

    const recipeId = await page.evaluate(() => {
      const m = window.location.hash.match(/^#recipe\/(.+)$/);
      if (!m) return null;
      return decodeURIComponent(m[1].replace(/\/cook\/?$/i, ''));
    });
    expect(recipeId).toBeTruthy();

    await recipeDetailsDialog(page).getByRole('button', { name: /Close recipe/i }).click();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page.locator('#main-content-home')).toBeVisible();

    // Opening from Home shows Home in the modal breadcrumb
    const openWeek = page.getByRole('button', { name: /Open recipe:/i }).first();
    if (await openWeek.isVisible().catch(() => false)) {
      await openWeek.click();
      await expect(recipeDetailsDialog(page).getByRole('navigation', { name: 'Breadcrumb' })).toContainText(
        'Home',
      );
      await recipeDetailsDialog(page).getByRole('button', { name: /Close recipe/i }).click();
    }

    await page.goto('/#recipe/' + encodeURIComponent(recipeId!));
    await page.reload();
    await expect(recipeDetailsDialog(page)).toBeVisible({ timeout: 10000 });
    // Hash deep links land on the Recipes tab context
    await expect(recipeDetailsDialog(page).getByRole('navigation', { name: 'Breadcrumb' })).toContainText(
      'Recipes',
    );
  });
});
