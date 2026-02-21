#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';

const ROOT = process.cwd();
const recipesPath = resolve(ROOT, 'src/data/recipes.json');
const imagesDir = resolve(ROOT, 'public/recipe-images');

const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));

function md5(buf) {
  return createHash('md5').update(buf).digest('hex');
}

function toTags(recipe) {
  const titleWords = String(recipe.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !['the', 'and', 'for', 'with', 'from', 'best', 'easy'].includes(w))
    .slice(0, 3);

  const cat = String(recipe.category || '')
    .toLowerCase()
    .replace('/', ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  const ingredient = Array.isArray(recipe.ingredients) && recipe.ingredients.length
    ? String(recipe.ingredients[0]).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2)
    : [];

  const tags = [...new Set([...titleWords, ...cat, ...ingredient])].slice(0, 5);
  return tags.length ? tags.join(',') : 'food';
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
  const tags = toTags(recipe);
  const url = `https://loremflickr.com/1200/900/${encodeURIComponent(tags)}`;
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
