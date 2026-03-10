import { test, expect } from '@playwright/test';

const loginAndOpenTrivia = async (
  page: import('@playwright/test').Page,
  triviaSeed?: Array<{
    id: string;
    question: string;
    options: string[];
    answer: string;
    contributor: string;
    created_at: string;
  }>
) => {
  await page.goto('/');
  await page.evaluate((seed) => {
    localStorage.clear();
    if (seed) {
      localStorage.setItem('schafer_db_trivia', JSON.stringify(seed));
    }
  }, triviaSeed);
  await page.reload();

  await page.getByPlaceholder(/e\.g\. Grandma Joan/i).fill('Alice');
  await page.getByRole('button', { name: /Enter The Archive/i }).click();
  await page.getByPlaceholder(/Search by title/i).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: 'Trivia' }).click();
};

test.describe('Trivia', () => {
  test('shows trivia view (start screen or empty state)', async ({ page }) => {
    await loginAndOpenTrivia(page);

    await expect(
      page.getByRole('heading', { name: /Family Heritage Quiz|The Quiz Archive is Empty/i }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('shows start screen and begins quiz when trivia exists', async ({ page }) => {
    await loginAndOpenTrivia(page, [
      {
        id: 't1',
        question: 'What is the capital of France?',
        options: ['London', 'Paris', 'Berlin', 'Madrid'],
        answer: 'Paris',
        contributor: 'Admin',
        created_at: new Date().toISOString(),
      },
    ]);

    await expect(page.getByRole('heading', { name: /Family Heritage Quiz/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Begin The Challenge/i })).toBeVisible();

    await page.getByRole('button', { name: /Begin The Challenge/i }).click();

    await expect(page.getByRole('heading', { name: 'What is the capital of France?' })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('group', { name: /Answer options/i })).toBeVisible();
  });

  test('selects answer and advances to next question', async ({ page }) => {
    await loginAndOpenTrivia(page, [
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
    ]);

    await page.getByRole('button', { name: /Begin The Challenge/i }).click();
    await page.getByRole('button', { name: /B: B/ }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Q2?')).toBeVisible({ timeout: 5000 });
  });

  test('shows results at end of quiz', async ({ page }) => {
    await loginAndOpenTrivia(page, [
      {
        id: 't1',
        question: 'Single Q?',
        options: ['Yes', 'No', 'Maybe', 'N/A'],
        answer: 'Yes',
        contributor: 'Admin',
        created_at: new Date().toISOString(),
      },
    ]);

    await page.getByRole('button', { name: /Begin The Challenge/i }).click();
    await page.getByRole('button', { name: /A: Yes/ }).click();

    await expect(page.getByRole('heading', { name: /Legacy Challenge Complete/i })).toBeVisible({ timeout: 5000 });
  });

  test('keyboard 1-4 selects option', async ({ page }) => {
    await loginAndOpenTrivia(page, [
      {
        id: 't1',
        question: 'Keyboard test?',
        options: ['First', 'Second', 'Third', 'Fourth'],
        answer: 'Third',
        contributor: 'Admin',
        created_at: new Date().toISOString(),
      },
    ]);

    await page.getByRole('button', { name: /Begin The Challenge/i }).click();
    await page.keyboard.press('3');

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: /C: Third .*Correct answer/i })).toBeVisible();
  });
});
