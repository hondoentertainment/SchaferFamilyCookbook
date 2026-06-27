import { test, expect } from '@playwright/test';
import { loginAs, seedLocalOnlyMode } from './fixtures';

test.describe('Gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
    await seedLocalOnlyMode(page);
    await page.reload();
    await page.getByRole('button', { name: 'Family', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  });

  test('shows empty state when no items', async ({ page }) => {
    await page.getByRole('button', { name: 'Family', exact: true }).click();

    await expect(page.getByRole('main', { name: /Family Gallery/i })).toBeVisible();
    await expect(page.getByText('The gallery awaits your memories')).toBeVisible();
    await expect(page.getByText(/upload a photo above/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Share a memory/i })).toBeVisible();
  });

  test('shows texting hint when no archive phone', async ({ page }) => {
    await page.getByRole('button', { name: 'Family', exact: true }).click();

    await expect(page.getByText(/Prefer texting\?/i)).toBeVisible();
    await expect(page.getByText(/upload directly on this page/i)).toBeVisible();
  });

  test('uploads a photo in local mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Family', exact: true }).click();
    await expect(page.getByTestId('gallery-upload-submit')).toBeDisabled();

    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    await page.getByTestId('gallery-upload-file').setInputFiles({
      name: 'family-moment.png',
      mimeType: 'image/png',
      buffer: Buffer.from(pngBase64, 'base64'),
    });
    await page.getByTestId('gallery-upload-caption').fill('E2E picnic');
    await page.getByTestId('gallery-upload-submit').click();

    await expect(page.getByText('E2E picnic')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Added by Alice/i)).toBeVisible();
  });

  test('shows archive phone when configured', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('schafer_archive_phone', '+15551234567'));
    await page.reload();
    await page.getByRole('button', { name: 'Family', exact: true }).click();

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
            // Tiny valid 1x1 PNG data URL so GalleryImage doesn't fall back
            // to the "Preview unavailable" div (which removes the button).
            url:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            caption: 'Summer picnic 2024',
            contributor: 'Alice',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Family', exact: true }).click();

    await expect(page.getByText('Summer picnic 2024')).toBeVisible();
    await expect(page.getByText(/Added by Alice/i)).toBeVisible();
  });

  test('opens lightbox when clicking image', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_gallery',
        JSON.stringify([
          {
            id: 'g2',
            type: 'image',
            // Tiny valid 1x1 PNG data URL so GalleryImage doesn't fall back
            // to the "Preview unavailable" div (which removes the button).
            url:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            caption: 'Beach day',
            contributor: 'Bob',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Family', exact: true }).click();
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
            // Tiny valid 1x1 PNG data URL so GalleryImage doesn't fall back
            // to the "Preview unavailable" div (which removes the button).
            url:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            caption: 'Escape test',
            contributor: 'Alice',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Family', exact: true }).click();
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
            // Tiny valid 1x1 PNG data URL so GalleryImage doesn't fall back
            // to the "Preview unavailable" div (which removes the button).
            url:
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            caption: 'Escape key test',
            contributor: 'Alice',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Family', exact: true }).click();
    await expect(page.getByText('Escape key test')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /View full size: Escape key test/i }).click();

    await expect(page.getByRole('dialog', { name: /Enlarged gallery image/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Enlarged gallery image/i })).not.toBeVisible({ timeout: 2000 });
  });

  test.describe('Clipboard (Chromium/WebKit)', () => {
    test.skip(({ browserName }) => browserName === 'firefox', 'Clipboard permissions API is not supported for Firefox in Playwright');

    test('copy archive phone copies to clipboard', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.evaluate(() => localStorage.setItem('schafer_archive_phone', '+15559876543'));
      await page.reload();
      await page.getByRole('button', { name: 'Family', exact: true }).click();
      await page.getByTestId('gallery-copy-archive-phone').click();
      await expect(page.getByText(/Number copied/i)).toBeVisible({ timeout: 3000 });
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      expect(clip).toBe('+15559876543');
    });
  });
});
