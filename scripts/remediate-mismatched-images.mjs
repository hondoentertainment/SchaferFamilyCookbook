#!/usr/bin/env node
/**
 * Remediate duplicate recipe images: replace with recipe-accurate Pollinations images.
 * Uses shared/recipeImagePrompts.mjs and shared/recipePrompts.mjs (no loremflickr).
 */
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';
import { buildPollinationsPrompt, buildDeterministicPrompt } from '../shared/recipeImagePrompts.mjs';
import { getRecipePrompt } from '../shared/recipePrompts.mjs';

const ROOT = process.cwd();
const recipesPath = resolve(ROOT, 'src/data/recipes.json');
const imagesDir = resolve(ROOT, 'public/recipe-images');

const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));

function md5(buf) {
  return createHash('md5').update(buf).digest('hex');
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

function buildPollinationsUrl(recipe) {
  const prompt = getRecipePrompt(recipe.title) || buildDeterministicPrompt(recipe);
  const fullPrompt = buildPollinationsPrompt(prompt);
  const seed = Math.abs(hashCode(recipe.id));
  const encoded = encodeURIComponent(fullPrompt);
  return `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=800&height=600&nologo=true`;
}

function getImageFile(recipe) {
  const image = String(recipe.image || '');
  if (!image.startsWith('/recipe-images/')) return null;
  return image.replace('/recipe-images/', '');
}

const hashToRecipes = new Map();
for (const recipe of recipes) {
  const file = getImageFile(recipe);
  if (!file) continue;
  const fullPath = resolve(imagesDir, file);
  try {
    const hash = md5(readFileSync(fullPath));
    if (!hashToRecipes.has(hash)) hashToRecipes.set(hash, []);
    hashToRecipes.get(hash).push({ recipe, file, fullPath });
  } catch {
    // ignore missing/bad files
  }
}

const duplicateGroups = [...hashToRecipes.entries()].filter(([, list]) => list.length >= 10);
if (!duplicateGroups.length) {
  console.log('No large duplicate image groups found.');
  process.exit(0);
}

const targets = duplicateGroups.flatMap(([, list]) => list);
console.log(`Found ${targets.length} recipes with duplicated image binaries to remediate.`);

let updated = 0;
let failed = 0;

for (let i = 0; i < targets.length; i++) {
  const { recipe, fullPath } = targets[i];
  const url = buildPollinationsUrl(recipe);
  process.stdout.write(`[${String(i + 1).padStart(2, ' ')}/${targets.length}] ${recipe.title.padEnd(42).slice(0, 42)} `);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(fullPath, buf);
    updated++;
    console.log('OK');
  } catch (err) {
    failed++;
    console.log(`FAIL (${err.message || 'error'})`);
  }
  await new Promise((r) => setTimeout(r, 500));
}

console.log(`\nRemediation complete: ${updated} updated, ${failed} failed.`);
