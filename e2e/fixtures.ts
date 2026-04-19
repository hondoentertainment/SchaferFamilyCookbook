import { test as base } from '@playwright/test';

/**
 * Helper to log in and land on the main app (Recipes tab).
 * Clears storage first to ensure a clean state, then marks the
 * OnboardingWalkthrough as already completed so it doesn't block
 * subsequent interactions with the app.
 */
export async function loginAs(
  page: import('@playwright/test').Page,
  name: string
): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  // Pre-seed onboarding flag so the OnboardingWalkthrough modal does not
  // appear on first login during E2E runs. The modal is a full-screen
  // overlay that blocks pointer events, breaking most specs.
  await page.evaluate(() => {
    localStorage.setItem('schafer_onboarding_done', 'true');
  });
  await page.reload();

  await page.getByPlaceholder(/e\.g\. Grandma Joan/i).fill(name);
  await page.getByRole('button', { name: /Enter The Archive/i }).click();

  // Wait for recipes to load (indicates we're past login).
  // The search input's placeholder was renamed from "Search by title..."
  // to "Search recipes, ingredients..."; match via aria-label for stability.
  await page
    .getByRole('textbox', { name: /Search recipes, ingredients/i })
    .waitFor({ state: 'visible', timeout: 15000 });

  // Safety net: if onboarding somehow appears, dismiss it.
  const skipBtn = page.getByRole('button', { name: /Skip Tour/i });
  if (await skipBtn.isVisible().catch(() => false)) {
    await skipBtn.click();
  }
}

/**
 * Helper to log in as admin (Kyle or hondo4185@gmail.com gets admin role)
 */
export async function loginAsAdmin(
  page: import('@playwright/test').Page
): Promise<void> {
  await loginAs(page, 'Kyle');
}

/**
 * Extended test with logged-in admin
 */
export const test = base.extend<{ adminPage: import('@playwright/test').Page }>({
  adminPage: async ({ page }, use) => {
    await loginAsAdmin(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
