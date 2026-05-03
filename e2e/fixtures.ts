import { test as base } from '@playwright/test';

/** Visible on Home after login (time-of-day greeting includes "Late night" variants). */
const HOME_H1_TEXT_RE = /Good (morning|afternoon|evening)|Late night/i;

/**
 * After submitting the typed-name login form, confirm the in-app name dialog.
 * Waits for either the Home masthead (returning users) or the first onboarding chapter (first visit).
 */
export async function confirmCookbookLogin(page: import('@playwright/test').Page): Promise<void> {
  const openCookbook = page.getByRole('button', { name: /Yes, open the cookbook/i });
  await openCookbook.waitFor({ state: 'visible', timeout: 15000 });
  await openCookbook.click();
  await Promise.race([
    page
      .locator('#main-content-home')
      .getByRole('heading', { level: 1 })
      .filter({ hasText: HOME_H1_TEXT_RE })
      .waitFor({ state: 'visible', timeout: 15000 }),
    page.getByText(/Chapter 1 of \d+/i).waitFor({ state: 'visible', timeout: 15000 }),
  ]);
}

/** Wait for the Home masthead h1 (stable vs getByRole on split text nodes). */
export async function waitForHomeMainHeading(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('#main-content-home').getByRole('heading', { level: 1 }).filter({ hasText: HOME_H1_TEXT_RE }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
}

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

  await page.getByPlaceholder(/your name/i).fill(name);
  await page.keyboard.press('Enter');

  await confirmCookbookLogin(page);
  await waitForHomeMainHeading(page);

  await page.getByRole('button', { name: /^Recipes$/, exact: true }).first().click();
  await page
    .getByRole('textbox', { name: /Search recipes, ingredients/i })
    .waitFor({ state: 'visible', timeout: 15000 });

  // Safety net: if onboarding somehow appears, dismiss it.
  const skipBtn = page.getByRole('button', { name: /Skip Tour/i });
  if (await skipBtn.isVisible().catch(() => false)) {
    await skipBtn.click();
  }
}

/** Main Recipes grid recipe openers — excludes horizontal shelf cards. */
export function recipeCardOpenInMainGrid(page: import('@playwright/test').Page) {
  return page.getByTestId('recipe-card-grid').getByTestId('recipe-card-open');
}

export async function openFirstRecipeCardInMainGrid(page: import('@playwright/test').Page) {
  await recipeCardOpenInMainGrid(page).first().click();
}

/** Opens a visible grid card hero by exact image alt (recipe title). */
export async function openRecipeCardInMainGridByTitle(
  page: import('@playwright/test').Page,
  title: string,
) {
  await recipeCardOpenInMainGrid(page)
    .filter({ has: page.getByAltText(title, { exact: true }) })
    .first()
    .click();
}

/** Opens a visible grid card when the recipe title substring appears in alt text */
export async function openRecipeCardInMainGridMatchingAlt(
  page: import('@playwright/test').Page,
  partialTitle: RegExp,
) {
  await recipeCardOpenInMainGrid(page)
    .filter({ has: page.getByAltText(partialTitle) })
    .first()
    .click();
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
