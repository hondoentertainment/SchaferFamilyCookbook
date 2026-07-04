import { test, expect } from '@playwright/test';
import { loginAs, seedLocalOnlyMode } from './fixtures';

test.describe('UX batch (June 2026)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('mobile bottom nav shows five tabs without A–Z', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recipes', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Family', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toBeVisible();
    await expect(page.getByTestId('bottom-nav-profile')).toBeVisible();
    await expect(page.getByTestId('bottom-nav-index')).toHaveCount(0);
  });

  test('A–Z lives under Recipes sub-nav on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Recipes', exact: true }).first().click();
    const az = page.getByRole('region', { name: 'Recipe browsing navigation' }).getByRole('button', { name: 'A–Z', exact: true });
    await expect(az).toBeVisible();
    await az.click();
    await expect(page.getByRole('heading', { name: /Archival Index/i })).toBeVisible({ timeout: 10000 });
  });

  test('family sub-nav hint can be dismissed', async ({ page }) => {
    await page.getByRole('button', { name: 'Family', exact: true }).click();
    const hint = page.getByTestId('family-subnav-hint');
    await expect(hint).toBeVisible();
    await hint.getByRole('button', { name: 'Got it' }).click();
    await expect(hint).not.toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Family', exact: true }).click();
    await expect(hint).not.toBeVisible();
  });

  test('gallery contributor filter chip merges alias names', async ({ page }) => {
    await seedLocalOnlyMode(page);
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_gallery',
        JSON.stringify([
          {
            id: 'g-wren-a',
            type: 'image',
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            caption: 'Wren picnic',
            contributor: 'Wren',
            created_at: new Date().toISOString(),
          },
          {
            id: 'g-wren-b',
            type: 'image',
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            caption: 'Wren lake',
            contributor: 'Wren Feyereisen',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Family', exact: true }).click();
    await page.getByTestId('gallery-contributor-filter').selectOption('Wren');
    await expect(page.getByTestId('gallery-contributor-filter-chip')).toBeVisible();
    await expect(page.getByText('Wren picnic')).toBeVisible();
    await expect(page.getByText('Wren lake')).toBeVisible();
  });
});
