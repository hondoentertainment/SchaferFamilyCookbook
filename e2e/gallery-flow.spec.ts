import { test, expect } from '@playwright/test';
import { goToAdminTools, loginAs, loginAsAdmin, seedLocalOnlyMode } from './fixtures';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function switchToAdminKyle(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem(
      'schafer_user',
      JSON.stringify({ name: 'Kyle', role: 'admin', email: 'hondo4185@gmail.com' }),
    );
    localStorage.setItem('schafer_onboarding_done', 'true');
  });
  await page.reload();
  await seedLocalOnlyMode(page);
  await page.reload();
}

test.describe('Gallery upload → approve flow', () => {
  test('family upload pending then custodian approve shows public memory', async ({ page }) => {
    const caption = 'E2E approve flow';

    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
    await seedLocalOnlyMode(page);
    await page.reload();

    await page.getByRole('button', { name: 'Family', exact: true }).click();
    await page.getByTestId('gallery-upload-file').setInputFiles({
      name: 'family-moment.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await page.getByTestId('gallery-upload-caption').fill(caption);
    await page.getByTestId('gallery-upload-submit').click();

    await expect(page.getByText(caption)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Your upload · Pending review')).toBeVisible();

    const galleryId = await page.evaluate((cap) => {
      const raw = localStorage.getItem('schafer_db_gallery');
      const items = JSON.parse(raw || '[]') as { id: string; caption?: string }[];
      return items.find((item) => item.caption === cap)?.id ?? null;
    }, caption);
    expect(galleryId).toBeTruthy();

    await switchToAdminKyle(page);
    await goToAdminTools(page);
    await page.getByRole('tab', { name: /Gallery/i }).click();
    await page.getByTestId(`gallery-approve-${galleryId}`).click();
    await expect(page.getByText(/Memory approved/i)).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Family', exact: true }).click();
    await expect(page.getByText(caption)).toBeVisible();
    await expect(page.getByText('Your upload · Pending review')).not.toBeVisible();
    await expect(page.getByText(/Added by Alice/i)).toBeVisible();
  });

  test('admin quick path: seeded pending → approve', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await loginAsAdmin(page);
    await seedLocalOnlyMode(page);
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_gallery',
        JSON.stringify([
          {
            id: 'g-flow-seed',
            type: 'image',
            url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            caption: 'E2E approve flow seed',
            contributor: 'Alice',
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ]),
      );
    });
    await page.reload();

    await goToAdminTools(page);
    await page.getByRole('tab', { name: /Gallery/i }).click();
    await page.getByTestId('gallery-approve-g-flow-seed').click();
    await expect(page.getByText(/Memory approved/i)).toBeVisible({ timeout: 5000 });
  });
});
