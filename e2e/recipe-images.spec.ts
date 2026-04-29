import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const recipes = JSON.parse(readFileSync(resolve(process.cwd(), 'src/data/recipes.json'), 'utf8'));

test.describe('Recipe images', () => {
  test('recipe dataset uses unique image sources', async () => {
    const imageUrls = recipes.map((recipe: { image: string }) => recipe.image);
    const imageSources = recipes.map((recipe: { imageSource?: string }) => recipe.imageSource);
    expect(new Set(imageUrls).size).toBe(recipes.length);
    expect(imageSources.every(Boolean)).toBeTruthy();
    expect(imageUrls.every((imageUrl: string) => imageUrl.includes('image.pollinations.ai/prompt/'))).toBeTruthy();
  });
});
