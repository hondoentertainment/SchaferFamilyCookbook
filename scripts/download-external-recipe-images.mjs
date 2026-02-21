#!/usr/bin/env node
/**
 * Fallback: Download external recipe images (e.g. Pollinations) to local.
 * Use when Gemini Imagen quota is exceeded but you want every recipe to have a local image.
 *
 * - Filters recipes that do NOT have /recipe-images/ path.
 * - Downloads image from URL, saves to public/recipe-images/<id>.jpg.
 * - Updates recipe.image to /recipe-images/<id>.jpg.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const recipesPath = resolve(__dirname, '../src/data/recipes.json');
const outputDir = resolve(__dirname, '../public/recipe-images');

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));
const toProcess = recipes.filter(r => !(r.image && String(r.image).startsWith('/recipe-images/')));
const skipped = recipes.length - toProcess.length;

let downloaded = 0;
let failed = 0;

console.log(`\nDownloading external images: ${toProcess.length} to process, ${skipped} already local.\n`);

(async () => {
for (let i = 0; i < toProcess.length; i++) {
    const recipe = toProcess[i];
    const url = recipe.image;
    const imageFile = `${recipe.id}.jpg`;
    const imagePath = resolve(outputDir, imageFile);

    process.stdout.write(`[${String(i + 1).padStart(2)}/${toProcess.length}] ${recipe.title.padEnd(45).substring(0, 45)} `);

    if (!url || !url.startsWith('http')) {
        console.log('SKIP (no valid URL)');
        failed++;
        continue;
    }

    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            writeFileSync(imagePath, buf);
            recipe.image = `/recipe-images/${imageFile}`;
            downloaded++;
            console.log('OK');
            ok = true;
        } catch (e) {
            if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            else {
                console.log(`FAIL: ${(e?.message || e)?.substring(0, 50)}`);
                failed++;
            }
        }
    }
}

writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');

console.log(`\n${'='.repeat(60)}`);
console.log(`SUMMARY: Downloaded ${downloaded}, Failed ${failed}, Skipped ${skipped}`);
console.log(`Updated: src/data/recipes.json`);
})();
