import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const recipes = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/recipes.json'), 'utf8'));

test.describe('Recipe images', () => {
  test('all recipe image assets are reachable and served as images', async ({ request }) => {
    for (const recipe of recipes) {
      const response = await request.get(recipe.image);
      expect(response.ok(), `${recipe.title} should return 200 for ${recipe.image}`).toBeTruthy();
      expect(response.headers()['content-type'] || '').toContain('image/');
    }
  });
});
