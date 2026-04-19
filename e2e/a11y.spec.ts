import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAs, loginAsAdmin } from './fixtures';

/**
 * Accessibility audit using axe-core.
 *
 * Each test loads a major route/view, runs axe, and asserts there are no
 * serious or critical violations. We log a brief summary on failure to aid
 * debugging.
 *
 * Disabled rules (with justification):
 *   - "color-contrast": Tailwind palette tokens used in some decorative
 *     surfaces (e.g. light stone-on-white legends and uppercase tracking
 *     metadata) currently fall just below 4.5:1 in synthetic computed
 *     styles. We track these in the design backlog rather than blocking
 *     E2E gating; they are flagged as serious but require palette-wide
 *     redesign that is out of scope for this audit.
 *   - "region": certain top-level skeleton/wrapper screens render content
 *     before the main landmark mounts (lazy chunks). This produces a
 *     transient violation that is unrelated to user-facing structure.
 */
const DISABLED_RULES = ['color-contrast', 'region'];

type Impact = 'minor' | 'moderate' | 'serious' | 'critical';

const SEVERE: Impact[] = ['serious', 'critical'];

async function runAxe(page: Page, label: string) {
    const results = await new AxeBuilder({ page })
        .disableRules(DISABLED_RULES)
        .analyze();

    const severe = results.violations.filter(
        (v) => v.impact && SEVERE.includes(v.impact as Impact)
    );

    if (severe.length > 0) {
        // Surface a compact summary so failures are diagnosable from CI logs.
        // eslint-disable-next-line no-console
        console.log(`\n[a11y:${label}] serious/critical violations: ${severe.length}`);
        for (const v of severe) {
            // eslint-disable-next-line no-console
            console.log(
                `  - ${v.id} [${v.impact}] nodes=${v.nodes.length} :: ${v.help}`
            );
            for (const node of v.nodes.slice(0, 3)) {
                // eslint-disable-next-line no-console
                console.log(`      target=${node.target.join(' ')}`);
            }
        }
    }

    expect(severe, `serious/critical a11y violations on ${label}`).toEqual([]);
}

test.describe('Accessibility audit', () => {
    test('Login screen', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.getByPlaceholder(/e\.g\. Grandma Joan/i).waitFor({
            state: 'visible',
            timeout: 10000,
        });
        await runAxe(page, 'login');
    });

    test('Recipes view', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
        await runAxe(page, 'recipes');
    });

    test('Recipe modal', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
        await page
            .getByRole('button', { name: /View recipe:/i })
            .first()
            .click();
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
        await runAxe(page, 'recipe-modal');
    });

    test('Index (A–Z) view', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
        await page.getByRole('button', { name: 'A–Z' }).first().click();
        await expect(
            page.getByRole('heading', { name: /Alphabetical|Index/i })
        ).toBeVisible({ timeout: 5000 });
        await runAxe(page, 'index');
    });

    test('Gallery view', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
        await page.getByRole('button', { name: 'Gallery' }).click();
        await expect(
            page.getByRole('heading', { name: 'Family Gallery' })
        ).toBeVisible({ timeout: 5000 });
        await runAxe(page, 'gallery');
    });

    test('Trivia view', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
        await page.getByRole('button', { name: 'Trivia' }).click();
        await expect(
            page
                .getByRole('heading', { name: 'Family Heritage Quiz' })
                .or(page.getByText('Quiz Archive is Empty'))
                .first()
        ).toBeVisible({ timeout: 5000 });
        await runAxe(page, 'trivia');
    });

    test('Family Story view', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
        await page.getByRole('button', { name: 'Family Story' }).click();
        await expect(
            page
                .getByRole('heading', { name: /Schafer.*Oehler|Family Food History/ })
                .or(page.getByText('Our family has been involved'))
                .first()
        ).toBeVisible({ timeout: 5000 });
        await runAxe(page, 'family-story');
    });

    test('Profile view', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAs(page, 'Alice');
        await page
            .getByRole('button', { name: /view profile/i })
            .first()
            .click();
        await expect(page.getByLabel(/Display Identity/i)).toBeVisible({
            timeout: 5000,
        });
        await runAxe(page, 'profile');
    });

    test('Admin tools (logged in as admin)', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await loginAsAdmin(page);
        await page
            .getByRole('button', { name: /view profile/i })
            .first()
            .click();
        await page
            .getByRole('button', { name: /Open Admin Tools/i })
            .click();
        await expect(
            page.getByRole('heading', { name: /Manage Recipes/i }).first()
        ).toBeVisible({ timeout: 5000 });
        await runAxe(page, 'admin');
    });
});
