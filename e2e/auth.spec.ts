import { test, expect } from '@playwright/test';
import { confirmCookbookLogin, openLoginNameEntry, waitForHomeMainHeading } from './fixtures';

test.describe('Login', () => {
  test('shows login chooser when not authenticated', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByRole('heading', { name: /who's cooking/i })).toBeVisible();
    await expect(page.getByTestId('login-intent-returning')).toBeVisible();
    await expect(page.getByTestId('login-intent-new')).toBeVisible();
    await expect(page.getByTestId('login-browse-guest')).toBeVisible();
  });

  test('accepts name and enters the archive', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('schafer_onboarding_done', 'true');
    });
    await page.reload();

    await openLoginNameEntry(page, 'new');
    await page.getByPlaceholder(/your name/i).fill('Grandma Joan');
    await page.getByRole('button', { name: /^continue/i }).click();
    await confirmCookbookLogin(page);

    await waitForHomeMainHeading(page);
    await expect(page.getByRole('button', { name: 'Recipes', exact: true }).first()).toBeVisible();
  });

  test('returning member can sign back in', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('schafer_onboarding_done', 'true');
    });
    await page.reload();

    await openLoginNameEntry(page, 'new');
    await page.getByPlaceholder(/your name/i).fill('Robin');
    await page.getByRole('button', { name: /^continue/i }).click();
    await confirmCookbookLogin(page);
    await waitForHomeMainHeading(page);

    await page.evaluate(() => localStorage.removeItem('schafer_user'));
    await page.reload();

    await expect(page.getByRole('heading', { name: /who's cooking/i })).toBeVisible();
    await openLoginNameEntry(page, 'returning');
    // Prefer the contributor chip when present; returning CTA may be "Continue as Robin".
    const robinChip = page.getByRole('button', { name: /Sign in as Robin/i });
    if (await robinChip.isVisible().catch(() => false)) {
      await robinChip.click();
    } else {
      await page.getByPlaceholder(/your name/i).fill('Robin');
      await page.getByRole('button', { name: /^continue/i }).click();
    }
    await confirmCookbookLogin(page);
    await waitForHomeMainHeading(page);
  });

  test('guest browse opens recipes without persisting login', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByTestId('login-browse-guest').click();
    await expect(page.getByTestId('guest-sign-in-banner')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Recipes', exact: true }).first().click();
    await expect(page.getByRole('textbox', { name: /Search recipes, ingredients/i })).toBeVisible();

    const storedUser = await page.evaluate(() => localStorage.getItem('schafer_user'));
    expect(storedUser).toBeNull();
  });

  test('need access link is present', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await openLoginNameEntry(page, 'new');
    await expect(page.getByRole('link', { name: /Email an admin/i })).toBeVisible();
  });
});
