import { test as base } from '@playwright/test';

/**
 * Helper to log in and land on the main app (Recipes tab).
 * Clears storage first to ensure a clean state.
 */
export async function loginAs(
  page: import('@playwright/test').Page,
  name: string
): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder(/e\.g\. Grandma Joan/i).fill(name);
  await page.getByRole('button', { name: /Enter The Archive/i }).click();

  // Wait for recipes to load (indicates we're past login)
  await page.getByPlaceholder(/Search by title/i).waitFor({ state: 'visible', timeout: 15000 });
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
