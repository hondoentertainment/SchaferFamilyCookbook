import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Cook Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');

    // Open the first recipe modal
    await page.getByRole('button', { name: /View recipe:/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
  });

  test('opens cook mode from recipe modal', async ({ page }) => {
    await page.getByRole('button', { name: /Start Cook/i }).click();

    await expect(page.getByRole('application', { name: /Cook mode/i })).toBeVisible({ timeout: 3000 });
  });

  test('shows ingredients on the first step', async ({ page }) => {
    await page.getByRole('button', { name: /Start Cook/i }).click();
    const cookMode = page.getByRole('application', { name: /Cook mode/i });
    await expect(cookMode).toBeVisible();

    // Step 0 shows the Ingredients heading
    await expect(cookMode.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
    // Header shows "Step 1 of N"
    await expect(cookMode.getByText(/Step 1 of \d+/)).toBeVisible();
  });

  test('navigates forward through steps with Next button', async ({ page }) => {
    await page.getByRole('button', { name: /Start Cook/i }).click();
    const cookMode = page.getByRole('application', { name: /Cook mode/i });
    await expect(cookMode).toBeVisible();

    // On step 1 (ingredients)
    await expect(cookMode.getByRole('heading', { name: 'Ingredients' })).toBeVisible();

    // Click Next to go to step 2
    await page.getByRole('button', { name: /Next step/i }).click();
    await expect(cookMode.getByText(/Step 2 of \d+/)).toBeVisible();
    // Ingredients heading should no longer be visible
    await expect(cookMode.getByRole('heading', { name: 'Ingredients' })).not.toBeVisible();
  });

  test('navigates back with Prev button', async ({ page }) => {
    await page.getByRole('button', { name: /Start Cook/i }).click();
    const cookMode = page.getByRole('application', { name: /Cook mode/i });
    await expect(cookMode).toBeVisible();

    // Go forward first
    await page.getByRole('button', { name: /Next step/i }).click();
    await expect(cookMode.getByText(/Step 2 of \d+/)).toBeVisible();

    // Go back
    await page.getByRole('button', { name: /Previous step/i }).click();
    await expect(cookMode.getByText(/Step 1 of \d+/)).toBeVisible();
    await expect(cookMode.getByRole('heading', { name: 'Ingredients' })).toBeVisible();
  });

  test('closes cook mode with the close button', async ({ page }) => {
    await page.getByRole('button', { name: /Start Cook/i }).click();
    const cookMode = page.getByRole('application', { name: /Cook mode/i });
    await expect(cookMode).toBeVisible();

    await page.getByRole('button', { name: /Exit cook mode/i }).click();
    await expect(cookMode).not.toBeVisible({ timeout: 2000 });
  });

  test('step counter shows correct values', async ({ page }) => {
    await page.getByRole('button', { name: /Start Cook/i }).click();
    const cookMode = page.getByRole('application', { name: /Cook mode/i });
    await expect(cookMode).toBeVisible();

    // The bottom nav shows "1 / N" format
    await expect(cookMode.getByText(/1\s*\/\s*\d+/)).toBeVisible();

    // Navigate forward and verify counter updates
    await page.getByRole('button', { name: /Next step/i }).click();
    await expect(cookMode.getByText(/2\s*\/\s*\d+/)).toBeVisible();
  });

  test('Prev is disabled on first step', async ({ page }) => {
    await page.getByRole('button', { name: /Start Cook/i }).click();
    await expect(page.getByRole('application', { name: /Cook mode/i })).toBeVisible();

    await expect(page.getByRole('button', { name: /Previous step/i })).toBeDisabled();
  });

  test('Next is disabled on last step', async ({ page }) => {
    await page.getByRole('button', { name: /Start Cook/i }).click();
    await expect(page.getByRole('application', { name: /Cook mode/i })).toBeVisible();

    // Navigate to the last step by clicking Next until disabled
    const nextButton = page.getByRole('button', { name: /Next step|Last step/i });
    for (let i = 0; i < 50; i++) {
      const isDisabled = await nextButton.isDisabled();
      if (isDisabled) break;
      await nextButton.click();
    }

    // The button on the last step has aria-label "Last step" and should be disabled
    await expect(page.getByRole('button', { name: /Last step/i })).toBeDisabled();
  });
});
