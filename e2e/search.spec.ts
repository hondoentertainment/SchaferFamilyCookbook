import { test, expect } from '@playwright/test';
import { cookbookSearch, loginAs, loginAsHome } from './fixtures';

test.describe('Sitewide search', () => {
  test('Home search opens a recipe modal from a ranked hit', async ({ page }) => {
    await loginAsHome(page, 'Alice');
    const search = page.getByTestId('home-cookbook-search-input');
    await expect(search).toBeVisible();
    await search.fill('Cinnamon Rolls');
    const results = page.getByTestId('site-search-results');
    await expect(results).toBeVisible();
    await expect(results.getByRole('option').first()).toContainText('Cinnamon Rolls');
    await results.getByRole('option').first().click();
    await expect(page.locator('[role="dialog"][aria-label="Recipe details"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[role="dialog"][aria-label="Recipe details"]')).toContainText('Cinnamon Rolls');
    await expect(page).toHaveURL(/#recipe\//);
  });

  test('query stays when switching from Home to Recipes', async ({ page }) => {
    await loginAsHome(page, 'Alice');
    await page.getByTestId('home-cookbook-search-input').fill('Festive');
    await page.getByRole('button', { name: 'Recipes', exact: true }).first().click();
    await expect(cookbookSearch(page)).toHaveValue('Festive');
    await expect(page.getByTestId('recipe-card-grid')).toBeVisible();
    await expect(page.getByTestId('recipe-card-grid').getByAltText(/Festive/)).toBeVisible();
  });

  test('exact title ranks above an ingredient-only cinnamon match', async ({ page }) => {
    await loginAs(page, 'Alice');
    const search = cookbookSearch(page);
    await search.fill('cinnamon');
    const results = page.getByTestId('site-search-results');
    await expect(results.getByRole('option').first()).toContainText('Cinnamon Rolls');
    const firstCard = page.getByTestId('recipe-card-grid').getByTestId('recipe-card-open').first();
    await expect(firstCard.getByAltText(/Cinnamon Rolls/i)).toBeVisible();
  });

  test('empty state offers a clear next step', async ({ page }) => {
    await loginAs(page, 'Alice');
    await cookbookSearch(page).fill('xyznonexistent123');
    await expect(page.getByTestId('site-search-empty')).toBeVisible();
    await expect(page.getByTestId('site-search-empty')).toContainText(/dish name|ingredient|family member/i);
    await page.getByTestId('site-search-empty').getByRole('button', { name: 'Clear search' }).click();
    await expect(cookbookSearch(page)).toHaveValue('');
  });

  test('Family and Groceries expose the same search field', async ({ page }) => {
    await loginAsHome(page, 'Alice');
    await page.getByRole('button', { name: 'Family', exact: true }).click();
    await expect(page.getByTestId('gallery-cookbook-search-input')).toBeVisible();
    await page.getByTestId('gallery-cookbook-search-input').fill('oyster stew');
    await expect(page.getByTestId('site-search-results').getByRole('option').filter({ hasText: /Oehler|Family Story/i })).toBeVisible();

    await page.getByRole('button', { name: 'Groceries', exact: true }).click();
    await expect(page.getByTestId('grocery-cookbook-search-input')).toBeVisible();
    await expect(page.getByTestId('grocery-cookbook-search-input')).toHaveValue('oyster stew');
  });

  test('grocery hit deep-links to the matching list item', async ({ page }) => {
    await loginAsHome(page, 'Alice');
    await page.evaluate(() => {
      localStorage.setItem(
        'groceryList:v1',
        JSON.stringify([
          {
            id: 'g-e2e-flour',
            text: '2 cups flour',
            recipeTitle: 'Cinnamon Rolls',
            recipeId: 'cinnamon-rolls',
            checked: false,
            addedAt: Date.now(),
          },
        ]),
      );
    });
    await page.reload();
    await page.getByTestId('home-cookbook-search-input').fill('2 cups flour');
    await page.getByTestId('site-search-results').getByRole('option').filter({ hasText: /2 cups flour/ }).click();
    await expect(page.getByRole('heading', { name: /Grocery list/i })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#grocery-item-g-e2e-flour')).toBeVisible();
  });
});

test.describe('Search on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('search field is 16px with a search keyboard and stays above results', async ({ page }) => {
    await loginAsHome(page, 'Alice');
    const search = page.getByTestId('home-cookbook-search-input');
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute('inputmode', 'search');
    await expect(search).toHaveAttribute('enterkeyhint', 'search');
    const fontSize = await search.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);

    await search.tap();
    await search.fill('pie');
    const results = page.getByTestId('site-search-results');
    await expect(results).toBeVisible();
    const searchBottom = await search.evaluate((el) => el.getBoundingClientRect().bottom);
    const resultsTop = await results.evaluate((el) => el.getBoundingClientRect().top);
    expect(resultsTop).toBeGreaterThanOrEqual(searchBottom - 1);
  });
});
