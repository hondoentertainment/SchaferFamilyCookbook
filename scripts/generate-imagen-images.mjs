#!/usr/bin/env node
/**
 * Generate Nano Banana recipe images for all recipes using their ingredients.
 * Uses shared/recipeImagePrompts.mjs for canonical anti-hallucination rules.
 * Saves images to public/recipe-images/ and updates recipes.json.
 *
 * Usage: GEMINI_API_KEY=... node scripts/generate-imagen-images.mjs
 *   or:  node scripts/generate-imagen-images.mjs  (reads from .env.local)
 */
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    buildLLMPromptText,
    normalizeDescription,
    buildRecipeImagePrompt,
    extractGeneratedImage,
    getImageExtension,
    TEXT_MODEL,
    RECIPE_IMAGE_MODEL,
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

function isQuotaError(message = '') {
    const lower = message.toLowerCase();
    return lower.includes('429') || lower.includes('quota') || lower.includes('rate limit');
}

async function buildPrompt(recipe) {
    const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: buildLLMPromptText(recipe) }] }]
    });
    return normalizeDescription(response.text, recipe);
}

async function generateImage(description) {
    const response = await ai.models.generateContent({
        model: RECIPE_IMAGE_MODEL,
        contents: [{ role: 'user', parts: [{ text: buildRecipeImagePrompt(description) }] }],
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: {
                aspectRatio: '4:3',
                imageSize: '1K'
            }
        }
    });
    const generatedImage = extractGeneratedImage(response);
    if (!generatedImage?.imageBase64) throw new Error('Image generation failed');
    return generatedImage;
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

console.log(`\nGenerating Nano Banana images for ${recipes.length} recipes...\n`);

let updated = 0;
let failed = 0;
const failures = [];
let stoppedForQuota = false;

for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];

    process.stdout.write(`[${String(i + 1).padStart(2)}/${recipes.length}] ${recipe.title.padEnd(45).substring(0, 45)} `);

    try {
        // Step 1: Build rich prompt from ingredients
        const description = await buildPrompt(recipe);

        // Step 2: Generate image with Nano Banana
        const { imageBase64, mimeType } = await generateImage(description);
        const extension = getImageExtension(mimeType);
        const imageFile = `${recipe.id}.${extension}`;
        const imagePath = resolve(outputDir, imageFile);

        // Remove older local variants so the dataset points at a single fresh asset.
        for (const oldExtension of ['png', 'jpg', 'webp']) {
            const oldPath = resolve(outputDir, `${recipe.id}.${oldExtension}`);
            if (oldPath !== imagePath && existsSync(oldPath)) rmSync(oldPath);
        }

        // Step 3: Save to file
        writeFileSync(imagePath, Buffer.from(imageBase64, 'base64'));

        // Step 4: Update recipe to use local path
        recipe.image = `/recipe-images/${imageFile}`;
        recipe.imageSource = 'nano-banana';
        updated++;
        console.log('OK');
    } catch (e) {
        const message = e?.message || String(e);
        console.log(`FAIL: ${message.substring(0, 60)}`);
        failures.push(recipe.title);
        failed++;
        // Keep existing image URL as fallback
        if (isQuotaError(message)) {
            stoppedForQuota = true;
            console.log('\nStopping early because the Nano Banana quota is exhausted.');
            break;
        }
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
if (stoppedForQuota) {
    console.log('\nBatch stopped early because the current Gemini image quota is exhausted.');
}
console.log(`\nImages saved to: public/recipe-images/`);
console.log(`Updated: src/data/recipes.json`);
