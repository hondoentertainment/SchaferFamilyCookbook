import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('shows empty state when no items', async ({ page }) => {
    await page.getByRole('button', { name: 'Gallery' }).click();

    await expect(page.getByRole('main', { name: /Family Gallery/i })).toBeVisible();
    await expect(page.getByText('The gallery awaits your memories')).toBeVisible();
    await expect(page.getByText(/Be the first to add a photo or video/i)).toBeVisible();
  });

  test('shows text-to-archive instructions when no archive phone', async ({ page }) => {
    await page.getByRole('button', { name: 'Gallery' }).click();

    await expect(page.getByText(/Want to add photos\?/i)).toBeVisible();
    await expect(page.getByText(/Admins can enable text-to-archive/i)).toBeVisible();
  });

  test('shows archive phone when configured', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
    await page.evaluate(() => localStorage.setItem('schafer_archive_phone', '+15551234567'));
    await page.reload();
    await page.getByRole('button', { name: 'Gallery' }).click();

    await expect(page.getByRole('heading', { name: 'Text your memories' })).toBeVisible();
    await expect(page.getByText(/\+15551234567/)).toBeVisible();
  });

  test('displays gallery items when data exists', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_gallery',
        JSON.stringify([
          {
            id: 'g1',
            type: 'image',
            url: 'https://via.placeholder.com/400x300',
            caption: 'Summer picnic 2024',
            contributor: 'Alice',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Gallery' }).click();

    await expect(page.getByText('Summer picnic 2024')).toBeVisible();
    await expect(page.getByText(/Added by Alice/i)).toBeVisible();
  });

  test('opens lightbox when clicking image', async ({ page }) => {
    await loginAs(page, 'Alice');
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_gallery',
        JSON.stringify([
          {
            id: 'g2',
            type: 'image',
            url: 'https://via.placeholder.com/400x300',
            caption: 'Beach day',
            contributor: 'Bob',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Gallery' }).click();
    await expect(page.getByText('Beach day')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /View full size: Beach day/i }).click();

    await expect(page.getByRole('dialog', { name: /Enlarged gallery image/i })).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Beach day')).toBeVisible();
  });

  test('closes lightbox on close button', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_gallery',
        JSON.stringify([
          {
            id: 'g3',
            type: 'image',
            url: 'https://via.placeholder.com/400x300',
            caption: 'Escape test',
            contributor: 'Alice',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Gallery' }).click();
    await expect(page.getByText('Escape test')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /View full size: Escape test/i }).click();

    await expect(page.getByRole('dialog', { name: /Enlarged gallery image/i })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: /Enlarged gallery image/i })).not.toBeVisible({ timeout: 2000 });
  });

  test('closes lightbox on Escape key', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_gallery',
        JSON.stringify([
          {
            id: 'g4',
            type: 'image',
            url: 'https://via.placeholder.com/400x300',
            caption: 'Escape key test',
            contributor: 'Alice',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Gallery' }).click();
    await expect(page.getByText('Escape key test')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /View full size: Escape key test/i }).click();

    await expect(page.getByRole('dialog', { name: /Enlarged gallery image/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Enlarged gallery image/i })).not.toBeVisible({ timeout: 2000 });
  });
});
