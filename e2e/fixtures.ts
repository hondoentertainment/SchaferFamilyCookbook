import { test as base } from '@playwright/test';

/** Visible on Home after login (time-of-day greeting includes "Late night" variants). */
const HOME_H1_TEXT_RE = /Good (morning|afternoon|evening)|Late night/i;

/**
 * Choose a login path on the welcome screen and wait for the name field.
 */
export async function openLoginNameEntry(
  page: import('@playwright/test').Page,
  intent: 'new' | 'returning' = 'new',
): Promise<void> {
  const testId = intent === 'returning' ? 'login-intent-returning' : 'login-intent-new';
  await page.getByTestId(testId).click();
  await page.getByPlaceholder(/your name/i).waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * After submitting the login form, wait for Home or the first onboarding chapter.
 */
export async function confirmCookbookLogin(page: import('@playwright/test').Page): Promise<void> {
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

/** Force local-only data layer so gallery/recipe E2E use localStorage (preview builds may bootstrap Firebase from env). */
export async function seedLocalOnlyMode(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('schafer_active_provider', 'local');
    localStorage.setItem('schafer_firebase_config', '{"e2e":"local-only"}');
  });
}

/** Seed Firebase emulator config so cloud sync E2E can run against Firestore emulator. */
export async function seedFirebaseEmulatorConfig(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('schafer_active_provider', 'firebase');
    localStorage.setItem(
      'schafer_firebase_config',
      JSON.stringify({ apiKey: 'demo-key', projectId: 'demo-schafer' }),
    );
  });
}

/** Login with Firebase emulator + onboarding skipped (for cloud-sync specs). */
export async function loginAsWithFirebaseEmulator(
  page: import('@playwright/test').Page,
  name: string,
): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await seedFirebaseEmulatorConfig(page);
  await page.evaluate(() => localStorage.setItem('schafer_onboarding_done', 'true'));
  await page.reload();

  await openLoginNameEntry(page, 'new');
  await page.getByPlaceholder(/your name/i).fill(name);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await confirmCookbookLogin(page);
  await waitForHomeMainHeading(page);
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
  // Hermetic local mode: production builds bootstrap Firebase from env, which
  // (a) ignores localStorage seeds the specs rely on and (b) leaks state
  // between tests through shared emulator docs (e.g. userPrefs). Cloud-sync
  // behavior is covered explicitly by loginAsWithFirebaseEmulator specs.
  await seedLocalOnlyMode(page);
  await page.reload();

  await openLoginNameEntry(page, 'new');
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

/**
 * Log in and remain on the Home tab (does not navigate to Recipes).
 */
export async function loginAsHome(
  page: import('@playwright/test').Page,
  name: string
): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    localStorage.setItem('schafer_onboarding_done', 'true');
  });
  // Hermetic local mode (see loginAs).
  await seedLocalOnlyMode(page);
  await page.reload();

  await openLoginNameEntry(page, 'new');
  await page.getByPlaceholder(/your name/i).fill(name);
  await page.keyboard.press('Enter');

  await confirmCookbookLogin(page);
  await waitForHomeMainHeading(page);

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

/** Profile → Admin Tools (custodian UI). Expands the admin collapsible if needed. */
export async function goToAdminTools(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('[data-testid="nav-profile"]').click();
  // Generous timeout: right after a reload the app may still be loading data
  // (slow network / emulator warm-up) before the admin entry renders.
  await page.getByRole('button', { name: /Open Admin Tools/i }).waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('button', { name: /Open Admin Tools/i }).click();

  const adminPanel = page.getByRole('button', { name: /Admin — archive control room/i });
  await adminPanel.waitFor({ state: 'visible', timeout: 5000 });
  if ((await adminPanel.getAttribute('aria-expanded')) === 'false') {
    await adminPanel.click();
  }
  await page.getByRole('heading', { name: /Manage Recipes/i }).first().waitFor({ state: 'visible', timeout: 15000 });
}

/** Log out from Profile (returns to welcome screen). */
export async function logoutFromProfile(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('[data-testid="nav-profile"]').click();
  await page.getByRole('button', { name: /Log out/i }).click();
  await page.getByRole('heading', { name: /who's cooking/i }).waitFor({ state: 'visible', timeout: 10000 });
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
