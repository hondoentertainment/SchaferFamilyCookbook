#!/usr/bin/env node
/**
 * Generate Imagen 3 images for all recipes using their ingredients.
 * Uses shared/recipeImagePrompts.mjs for canonical anti-hallucination rules.
 * Saves images to public/recipe-images/ and updates recipes.json.
 *
 * Usage: GEMINI_API_KEY=... node scripts/generate-imagen-images.mjs
 *   or:  node scripts/generate-imagen-images.mjs  (reads from .env.local)
 */
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    buildLLMPromptText,
    normalizeDescription,
    buildImagenPrompt,
} from '../shared/recipeImagePrompts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const recipesPath = resolve(__dirname, '../src/data/recipes.json');
const outputDir = resolve(__dirname, '../public/recipe-images');

// Load API key from env or .env.local
let API_KEY = process.env.GEMINI_API_KEY || '';
if (!API_KEY) {
    try {
        const envLocal = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
        const match = envLocal.match(/GEMINI_API_KEY=(.+)/);
        if (match) API_KEY = match[1].trim();
    } catch {}
}
if (!API_KEY) {
    console.error('ERROR: No GEMINI_API_KEY found. Set it in .env.local or as an environment variable.');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Ensure output directory exists
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));

async function buildPrompt(recipe) {
    const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: buildLLMPromptText(recipe) }] }]
    });
    return normalizeDescription(response.text, recipe);
}

async function generateImage(description) {
    const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: buildImagenPrompt(description),
        config: { numberOfImages: 1 }
    });
    return response.generatedImages[0].image.imageBytes;
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

console.log(`\nGenerating Imagen images for ${recipes.length} recipes...\n`);

let updated = 0;
let failed = 0;
const failures = [];

for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    const imageFile = `${recipe.id}.jpg`;
    const imagePath = resolve(outputDir, imageFile);

    process.stdout.write(`[${String(i + 1).padStart(2)}/${recipes.length}] ${recipe.title.padEnd(45).substring(0, 45)} `);

    try {
        // Step 1: Build rich prompt from ingredients
        const description = await buildPrompt(recipe);

        // Step 2: Generate image with Imagen 3
        const base64 = await generateImage(description);

        // Step 3: Save to file
        writeFileSync(imagePath, Buffer.from(base64, 'base64'));

        // Step 4: Update recipe to use local path
        recipe.image = `/recipe-images/${imageFile}`;
        updated++;
        console.log('OK');
    } catch (e) {
        console.log(`FAIL: ${e.message?.substring(0, 60)}`);
        failures.push(recipe.title);
        failed++;
        // Keep existing image URL as fallback
    }

    // Rate limit: wait between requests to avoid throttling
    if (i < recipes.length - 1) {
        await sleep(3000);
    }
}

// Save updated recipes.json
writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');

console.log(`\n${'='.repeat(60)}`);
console.log(`Done! ${updated} succeeded, ${failed} failed out of ${recipes.length} total.`);
if (failures.length > 0) {
    console.log(`\nFailed recipes (kept existing image):`);
    failures.forEach(t => console.log(`  - ${t}`));
}
console.log(`\nImages saved to: public/recipe-images/`);
console.log(`Updated: src/data/recipes.json`);
