import { test, expect } from '@playwright/test';
import { loginAsWithFirebaseEmulator, seedFirebaseEmulatorConfig } from './fixtures';

const useEmulator = process.env.VITE_FIREBASE_USE_EMULATOR === 'true';

test.describe('Grocery cloud sync (Firestore emulator)', () => {
  test.skip(!useEmulator, 'Requires VITE_FIREBASE_USE_EMULATOR=true (CI e2e job)');

  test('hydrates grocery list from remote after login on a second device', async ({ browser }) => {
    const uniqueItem = `Sync test ${Date.now()}`;

    const deviceA = await browser.newContext();
    const pageA = await deviceA.newPage();
    await loginAsWithFirebaseEmulator(pageA, 'GrocerySyncUser');

    await pageA.getByRole('button', { name: /^Groceries$/i }).click();
    await pageA.getByLabel(/Add an item to your grocery list/i).fill(uniqueItem);
    await pageA.getByRole('button', { name: /^Add$/i }).click();
    await expect(pageA.getByText(uniqueItem)).toBeVisible();

    // Debounced remote write (750ms) + emulator round-trip buffer
    await pageA.waitForTimeout(2500);

    const deviceB = await browser.newContext();
    const pageB = await deviceB.newPage();
    await pageB.goto('/');
    await pageB.evaluate(() => localStorage.clear());
    await seedFirebaseEmulatorConfig(pageB);
    await pageB.evaluate(() => localStorage.setItem('schafer_onboarding_done', 'true'));
    await pageB.reload();

    await pageB.getByPlaceholder(/your name/i).fill('GrocerySyncUser');
    await pageB.getByRole('button', { name: /^continue$/i }).click();

    await pageB.getByRole('button', { name: /^Groceries$/i }).click({ timeout: 15000 });
    await expect(pageB.getByText(uniqueItem)).toBeVisible({ timeout: 15000 });

    await deviceA.close();
    await deviceB.close();
  });
});
