#!/usr/bin/env node
/**
 * Generate unique Pollinations AI image URLs for all recipes in recipes.json.
 * Uses shared/recipeImagePrompts.mjs and shared/recipePrompts.mjs.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildPollinationsPrompt } from '../shared/recipeImagePrompts.mjs';
import { getRecipePrompt } from '../shared/recipePrompts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const recipesPath = resolve(__dirname, '../src/data/recipes.json');

const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));

let updated = 0;
for (const recipe of recipes) {
    const prompt = getRecipePrompt(recipe.title);
    if (!prompt) {
        console.log(`  SKIP: No prompt mapped for "${recipe.title}"`);
        continue;
    }

    const seed = Math.abs(hashCode(recipe.id));
    const encodedPrompt = encodeURIComponent(buildPollinationsPrompt(prompt));
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=800&height=600&nologo=true`;

    recipe.image = url;
    updated++;
    console.log(`  [${updated}/${recipes.length}] ${recipe.title}`);
}

writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');
console.log(`\nDone! Updated ${updated}/${recipes.length} recipes with unique AI image URLs.`);

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash;
}
