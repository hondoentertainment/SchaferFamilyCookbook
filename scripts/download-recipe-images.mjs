#!/usr/bin/env node
/**
 * Download all recipe images from their current URLs and save them locally.
 * Updates recipes.json to reference the local static files.
 * This makes images load instantly (bundled in the build) with no external API dependency.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const recipesPath = resolve(__dirname, '../src/data/recipes.json');
const outputDir = resolve(__dirname, '../public/recipe-images');

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));

async function downloadImage(url, filepath) {
    const response = await fetch(url, {
        headers: { 'User-Agent': 'SchaferCookbook/1.0' },
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1000) throw new Error(`Image too small (${buffer.length} bytes)`);
    writeFileSync(filepath, buffer);
    return buffer.length;
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

console.log(`\nDownloading images for ${recipes.length} recipes...\n`);

let updated = 0;
let failed = 0;
let totalBytes = 0;
const failures = [];

for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    const imageFile = `${recipe.id}.jpg`;
    const imagePath = resolve(outputDir, imageFile);

    // Skip if already downloaded
    if (recipe.image.startsWith('/recipe-images/') && existsSync(imagePath)) {
        process.stdout.write(`[${String(i + 1).padStart(2)}/${recipes.length}] ${recipe.title.padEnd(45).substring(0, 45)} SKIP (exists)\n`);
        updated++;
        continue;
    }

    process.stdout.write(`[${String(i + 1).padStart(2)}/${recipes.length}] ${recipe.title.padEnd(45).substring(0, 45)} `);

    try {
        const bytes = await downloadImage(recipe.image, imagePath);
        totalBytes += bytes;
        recipe.image = `/recipe-images/${imageFile}`;
        updated++;
        console.log(`OK (${Math.round(bytes / 1024)} KB)`);
    } catch (e) {
        console.log(`FAIL: ${e.message}`);
        failures.push(recipe.title);
        failed++;
    }

    // Small delay to be polite to the API
    if (i < recipes.length - 1) {
        await sleep(1500);
    }
}

// Save updated recipes.json
writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');

console.log(`\n${'='.repeat(60)}`);
console.log(`Done! ${updated} succeeded, ${failed} failed.`);
console.log(`Total downloaded: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
if (failures.length > 0) {
    console.log(`\nFailed recipes (kept existing URL):`);
    failures.forEach(t => console.log(`  - ${t}`));
}
console.log(`\nImages: public/recipe-images/`);
console.log(`Updated: src/data/recipes.json\n`);
