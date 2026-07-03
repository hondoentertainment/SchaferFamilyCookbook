import { test, expect } from '@playwright/test';
import { confirmCookbookLogin, openLoginNameEntry, waitForHomeMainHeading } from './fixtures';

test.describe('Onboarding walkthrough', () => {
  test('shows chapter 1 after first login when tour not completed', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    await openLoginNameEntry(page, 'new');
    await page.getByPlaceholder(/your name/i).fill('OnboardingTester');
    await page.getByRole('button', { name: /^continue$/i }).click();
    await confirmCookbookLogin(page);

    await expect(page.getByText(/Chapter 1 of \d+/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Your home dashboard/i })).toBeVisible();
  });

  test('Resume later hides tour for the rest of the browser session', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    await openLoginNameEntry(page, 'new');
    await page.getByPlaceholder(/your name/i).fill('DeferTester');
    await page.getByRole('button', { name: /^continue$/i }).click();
    await confirmCookbookLogin(page);

    await expect(page.getByText(/Chapter 1 of \d+/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Resume later/i }).click();
    await waitForHomeMainHeading(page);

    await page.evaluate(() => localStorage.removeItem('schafer_user'));
    await page.reload();

    await openLoginNameEntry(page, 'new');
    await page.getByPlaceholder(/your name/i).fill('DeferTester');
    await page.getByRole('button', { name: /^continue$/i }).click();
    await confirmCookbookLogin(page);

    await expect(page.getByText(/Chapter 1 of \d+/i)).toHaveCount(0);
    await waitForHomeMainHeading(page);
  });

  test('Skip tour marks onboarding done', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    await openLoginNameEntry(page, 'new');
    await page.getByPlaceholder(/your name/i).fill('SkipTester');
    await page.getByRole('button', { name: /^continue$/i }).click();
    await confirmCookbookLogin(page);

    await expect(page.getByRole('button', { name: /Skip tour/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Skip tour/i }).click();
    await waitForHomeMainHeading(page);

    await page.evaluate(() => localStorage.removeItem('schafer_user'));
    await page.reload();

    await openLoginNameEntry(page, 'new');
    await page.getByPlaceholder(/your name/i).fill('SkipTester');
    await page.getByRole('button', { name: /^continue$/i }).click();
    await confirmCookbookLogin(page);

    await expect(page.getByText(/Chapter 1 of \d+/i)).toHaveCount(0);
    await waitForHomeMainHeading(page);
  });
});
