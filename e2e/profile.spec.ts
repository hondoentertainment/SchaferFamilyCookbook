import { test, expect } from '@playwright/test';
import { loginAs, openFirstRecipeCardInMainGrid } from './fixtures';

function recipeDetailsDialog(page: import('@playwright/test').Page) {
  return page.locator('[role="dialog"][aria-label="Recipe details"]');
}

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

    // Shared recipes now live behind the "My recipes" shelf tab in Activity.
    await page.getByRole('tab', { name: /My recipes/i }).click();
    await expect(page.locator('[aria-label="My shared recipes"]')).toBeVisible({ timeout: 3000 });
  });

  test('shows favorited recipe in My Favorites after favoriting from browse', async ({ page }) => {
    const article = page.getByTestId('recipe-card-grid').locator('article').first();
    const title = await article.getByTestId('recipe-card-open').locator('img').first().getAttribute('alt');
    expect(title).toBeTruthy();

    await article.getByRole('button', { name: `Add ${title} to favorites` }).click();
    await expect(article.getByRole('button', { name: `Remove ${title} from favorites` })).toBeVisible();

    await page.getByTestId('nav-profile').click();

    const favoritesSection = page.locator('[aria-label="My favorites"]');
    await expect(favoritesSection.getByText(title!, { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('shows recipe in Recently Viewed after viewing from browse', async ({ page }) => {
    await openFirstRecipeCardInMainGrid(page);
    await expect(recipeDetailsDialog(page)).toBeVisible({ timeout: 5000 });

    const title = await recipeDetailsDialog(page).getByRole('heading', { level: 2 }).first().textContent();
    expect(title?.trim()).toBeTruthy();

    await recipeDetailsDialog(page).getByRole('button', { name: /Close recipe/i }).click();
    await expect(recipeDetailsDialog(page)).not.toBeVisible({ timeout: 3000 });

    await page.getByTestId('nav-profile').click();

    // Recently viewed lives behind the "Recent" shelf tab in Activity.
    await page.getByRole('tab', { name: /^Recent\b/ }).click();
    const recentSection = page.locator('[aria-label="Recently viewed"]');
    await expect(recentSection.getByText(title!.trim(), { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('creates a collection from Profile Preferences and shows it', async ({ page }) => {
    await page.getByTestId('nav-profile').click();

    const newCollectionBtn = page.getByRole('button', { name: /\+ New Collection/i });
    await newCollectionBtn.scrollIntoViewIfNeeded();
    await newCollectionBtn.click();

    await page.getByPlaceholder(/Collection name/i).fill('Holiday Baking');
    await page.getByRole('button', { name: /^Create$/i }).click();

    await expect(page.getByText('Holiday Baking')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Collections \(1\)/)).toBeVisible();
  });
});
