#!/usr/bin/env node
/**
 * Generate unique Pollinations AI image URLs for all recipes in recipes.json.
 * Uses shared/recipeImagePrompts.mjs and shared/recipePrompts.mjs.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildPollinationsImageUrl } from '../shared/recipeImagePrompts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const recipesPath = resolve(__dirname, '../src/data/recipes.json');

const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));

let updated = 0;
for (const recipe of recipes) {
    recipe.image = buildPollinationsImageUrl(recipe);
    recipe.imageSource = 'pollinations';
    updated++;
    console.log(`  [${updated}/${recipes.length}] ${recipe.title}`);
}

writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');
console.log(`\nDone! Updated ${updated}/${recipes.length} recipes with unique AI image URLs.`);
