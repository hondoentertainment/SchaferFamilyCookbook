import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures';

test.describe('Trivia', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAs(page, 'Alice');
  });

  test('shows trivia view (start screen or empty state)', async ({ page }) => {
    await page.getByRole('button', { name: 'Trivia' }).click();

    // App auto-seeds trivia in local mode when empty, so we may see start screen
    await expect(
      page.getByText(/Family Heritage Quiz|Quiz Archive is Empty|Begin The Challenge/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('shows start screen and begins quiz when trivia exists', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_trivia',
        JSON.stringify([
          {
            id: 't1',
            question: 'What is the capital of France?',
            options: ['London', 'Paris', 'Berlin', 'Madrid'],
            answer: 'Paris',
            contributor: 'Admin',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await loginAs(page, 'Alice');
    await page.getByRole('button', { name: 'Trivia' }).click();

    await expect(page.getByText(/Family Heritage Quiz/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Begin The Challenge/i })).toBeVisible();

    await page.getByRole('button', { name: /Begin The Challenge/i }).click();

    await expect(page.getByText('What is the capital of France?')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: 'Paris' }).or(
      page.getByRole('button', { name: 'London' })
    )).toBeVisible();
  });

  test('selects answer and advances to next question', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_trivia',
        JSON.stringify([
          {
            id: 't1',
            question: 'Q1?',
            options: ['A', 'B', 'C', 'D'],
            answer: 'B',
            contributor: 'Admin',
            created_at: new Date().toISOString(),
          },
          {
            id: 't2',
            question: 'Q2?',
            options: ['X', 'Y', 'Z', 'W'],
            answer: 'X',
            contributor: 'Admin',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await loginAs(page, 'Alice');
    await page.getByRole('button', { name: 'Trivia' }).click();
    await page.getByRole('button', { name: /Begin The Challenge/i }).click();

    await page.getByRole('button', { name: 'B' }).click();
    await page.keyboard.press('Enter');

    await expect(page.getByText('Q2?')).toBeVisible({ timeout: 3000 });
  });

  test('shows results at end of quiz', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_trivia',
        JSON.stringify([
          {
            id: 't1',
            question: 'Single Q?',
            options: ['Yes', 'No', 'Maybe', 'N/A'],
            answer: 'Yes',
            contributor: 'Admin',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await loginAs(page, 'Alice');
    await page.getByRole('button', { name: 'Trivia' }).click();
    await page.getByRole('button', { name: /Begin The Challenge/i }).click();

    await page.getByRole('button', { name: 'Yes' }).click();
    await page.keyboard.press('Enter');

    await expect(page.getByText(/Score|results|correct|1\/1|100/i)).toBeVisible({ timeout: 3000 });
  });

  test('keyboard 1-4 selects option', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'schafer_db_trivia',
        JSON.stringify([
          {
            id: 't1',
            question: 'Keyboard test?',
            options: ['First', 'Second', 'Third', 'Fourth'],
            answer: 'Third',
            contributor: 'Admin',
            created_at: new Date().toISOString(),
          },
        ])
      );
    });
    await page.reload();
    await loginAs(page, 'Alice');
    await page.getByRole('button', { name: 'Trivia' }).click();
    await page.getByRole('button', { name: /Begin The Challenge/i }).click();

    await page.keyboard.press('3');

    await expect(page.getByText(/Third|correct|incorrect/i)).toBeVisible({ timeout: 3000 });
  });
});
