import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Route-based navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('shows all main nav tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Recipes' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'A–Z' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gallery' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trivia' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Family Story' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Contributors' })).toBeVisible();
    await expect(page.getByRole('button', { name: /view profile/i }).first()).toBeVisible();
  });

  test('defaults to / with Recipes content', async ({ page }) => {
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/Preserving the/)).toBeVisible();
    await expect(page.getByPlaceholder(/Search by title/)).toBeVisible();
  });

  test('navigates to /index (A-Z Index)', async ({ page }) => {
    await page.goto('/index');
    await expect(page).toHaveURL('/index');
    await expect(page.getByRole('heading', { name: /Alphabetical|Index/i })).toBeVisible({ timeout: 5000 });
  });

  test('navigates to /gallery', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page).toHaveURL('/gallery');
    await expect(page.getByRole('heading', { name: 'Family Gallery' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Want to add photos?' }).or(
        page.getByRole('heading', { name: 'The gallery awaits your memories' })
      ).first()
    ).toBeVisible();
  });

  test('navigates to /trivia', async ({ page }) => {
    await page.goto('/trivia');
    await expect(page).toHaveURL('/trivia');
    await expect(
      page.getByRole('heading', { name: 'Family Heritage Quiz' }).or(
        page.getByText('Quiz Archive is Empty')
      ).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('navigates to /history (Family Story)', async ({ page }) => {
    await page.goto('/history');
    await expect(page).toHaveURL('/history');
    await expect(
      page.getByRole('heading', { name: /Schafer.*Oehler|Family Food History/ }).or(
        page.getByText('Our family has been involved')
      ).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('navigates to /contributors', async ({ page }) => {
    await page.goto('/contributors');
    await expect(page).toHaveURL('/contributors');
    await expect(page.getByRole('heading', { name: 'The Contributors' })).toBeVisible({ timeout: 5000 });
  });

  test('Contributors page loads and shows expected content', async ({ page }) => {
    await page.goto('/contributors');
    await expect(page.getByRole('heading', { name: 'The Contributors' })).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByPlaceholder('Search contributors…').or(page.getByRole('button', { name: 'Browse recipes' }))
    ).toBeVisible({ timeout: 3000 });
  });

  test('navigates to /profile', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');
    await expect(page.getByLabel(/Display Identity/i)).toBeVisible({ timeout: 5000 });
  });

  test('can log out', async ({ page }) => {
    await page.getByRole('button', { name: /Log out/i }).click();
    await expect(page.getByRole('heading', { name: /Welcome to the Family Table/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByLabel(/Legacy Contributor Name/i)).toBeVisible();
  });

  test('logo link returns to Recipes at /', async ({ page }) => {
    await page.goto('/gallery');
    await page.getByRole('button', { name: /Go to Recipes/i }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByPlaceholder(/Search by title/)).toBeVisible();
  });

  test('clicking nav tab updates URL', async ({ page }) => {
    await page.getByRole('button', { name: 'Gallery' }).click();
    await expect(page).toHaveURL('/gallery');

    await page.getByRole('button', { name: 'Trivia' }).click();
    await expect(page).toHaveURL('/trivia');

    await page.getByRole('button', { name: 'Recipes' }).first().click();
    await expect(page).toHaveURL('/');
  });

  test('browser back/forward navigates between routes', async ({ page }) => {
    // Start at Recipes (/)
    await expect(page).toHaveURL('/');

    // Navigate to Gallery
    await page.goto('/gallery');
    await expect(page).toHaveURL('/gallery');
    await expect(page.getByRole('heading', { name: 'Family Gallery' })).toBeVisible();

    // Navigate to Trivia
    await page.goto('/trivia');
    await expect(page).toHaveURL('/trivia');
    await expect(
      page.getByRole('heading', { name: /Family Heritage Quiz/i }).or(
        page.getByText('Quiz Archive is Empty')
      ).first()
    ).toBeVisible({ timeout: 5000 });

    // Go back to Gallery
    await page.goBack();
    await expect(page).toHaveURL('/gallery');
    await expect(page.getByRole('heading', { name: 'Family Gallery' })).toBeVisible({ timeout: 5000 });

    // Go back to Recipes
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByPlaceholder(/Search by title/)).toBeVisible({ timeout: 5000 });

    // Go forward to Gallery
    await page.goForward();
    await expect(page).toHaveURL('/gallery');
    await expect(page.getByRole('heading', { name: 'Family Gallery' })).toBeVisible({ timeout: 5000 });
  });

  test('deep link to /recipes/:id opens recipe directly', async ({ page }) => {
    const recipeId = 'imported_9mrpvyxve';
    await page.goto('/recipes/' + encodeURIComponent(recipeId));

    await expect(page).toHaveURL('/recipes/' + recipeId);
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Festive Apple Dip' })).toBeVisible();
  });

  test('direct URL navigation preserves state after reload', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByRole('heading', { name: 'Family Gallery' })).toBeVisible({ timeout: 5000 });

    // Reload the page and verify we stay on /gallery
    await page.reload();
    await expect(page).toHaveURL('/gallery');
    await expect(page.getByRole('heading', { name: 'Family Gallery' })).toBeVisible({ timeout: 5000 });
  });
});
