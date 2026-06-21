import { test, expect } from '@playwright/test';
import { loginAs, loginAsAdmin } from './fixtures';

/**
 * Family Story CMS coverage:
 * - Render path: custom sections saved to the local provider replace the
 *   built-in static story on the public Family Story tab.
 * - Authoring path: an admin can insert + save sections from the Story subtab
 *   and see them surface on the public tab (local provider round-trip;
 *   Firestore persistence is covered by the rules tests in CI).
 */

const goToFamilyStory = async (page: import('@playwright/test').Page) => {
  // The "Family" tab (#tab-Gallery) opens the family hub; exact match avoids the
  // many recipe-card labels that contain the substring "Family".
  await page.getByRole('button', { name: 'Family', exact: true }).click();
  await page
    .locator('section[aria-label="Family hub navigation"]')
    .getByRole('button', { name: /Story/i })
    .click();
  await expect(page.getByRole('heading', { name: /Family Food History/i })).toBeVisible({ timeout: 5000 });
};

test.describe('Family Story CMS', () => {
  test('public tab renders CMS sections and hides the static fallback', async ({ page }) => {
    await loginAs(page, 'Alice');

    // Seed custom story content the way the local provider persists it.
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_story_content',
        JSON.stringify([
          { id: 's_a', heading: 'A New Chapter', body: 'The family story, retold for the archive.', order: 0 },
          { id: 's_b', heading: 'Kitchens We Loved', body: 'Every gathering started around the stove.', order: 1 },
        ]),
      );
    });

    await goToFamilyStory(page);

    // Custom headings render...
    await expect(page.getByRole('heading', { name: 'A New Chapter' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kitchens We Loved' })).toBeVisible();
    // ...and the static fallback section is no longer present.
    await expect(page.getByRole('heading', { name: 'The Oehler Family' })).toHaveCount(0);

    // The table of contents reflects the custom sections.
    await expect(page.getByRole('button', { name: /Jump to A New Chapter/i })).toBeVisible();
  });

  test('public tab shows the built-in story when no CMS content exists', async ({ page }) => {
    await loginAs(page, 'Alice');
    await page.evaluate(() => localStorage.removeItem('schafer_story_content'));

    await goToFamilyStory(page);

    await expect(page.getByRole('heading', { name: 'The Oehler Family' })).toBeVisible();
  });

  test('admin can author story sections that surface on the public tab', async ({ page }) => {
    await loginAsAdmin(page);

    // Open Admin Tools → Family Story subtab.
    await page.locator('[data-testid="nav-profile"]').click();
    await page.getByRole('button', { name: /Open Admin Tools/i }).waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('button', { name: /Open Admin Tools/i }).click();
    await page.getByRole('tab', { name: /Family Story/i }).click();

    // Insert the starter scaffold.
    await page.getByTestId('story-insert-starter').click();

    // Preview mode renders the working sections read-only.
    await page.getByTestId('story-preview-toggle').click();
    await expect(page.getByTestId('story-preview').getByRole('heading', { name: 'Our Beginnings' })).toBeVisible({ timeout: 5000 });

    // Back to edit mode to commit (the Save button lives in the editor).
    await page.getByTestId('story-edit-toggle').click();
    await page.getByRole('button', { name: /Save Story Content/i }).click();
    await expect(page.getByText(/Family Story saved/i)).toBeVisible({ timeout: 5000 });

    // The saved sections appear on the public Family Story tab.
    await goToFamilyStory(page);
    await expect(page.getByRole('heading', { name: 'Our Beginnings' })).toBeVisible();
  });
});
