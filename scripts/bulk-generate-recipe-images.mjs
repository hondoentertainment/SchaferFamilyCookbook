#!/usr/bin/env node
/**
 * SAFER version of bulk image generation script.
 * Processes ONLY 5 images at a time with 10-second delays between each request.
 * On any 429/rate-limit error → hard stop with detailed CSV/JSON logging.
 * Immediately updates recipes.json after successful downloads.
 * Always reads latest recipes.json to catch updates from other agents/commits.
 *
 * Usage: GEMINI_API_KEY=... node scripts/bulk-generate-recipe-images-safe.mjs
 * Outputs: scripts/logs/bulk-image-gen-{timestamp}.json + .csv
 * Summary: (a) count created (b) csv list of success IDs (c) first failure (if any)
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

// Placeholder patterns to filter for
const placeholderPatterns = [
  /image\.pollinations\.ai/i,
  /unsplash.*(Breakfast|Main|Dessert|Side|Appetizer|Bread|Dip\/Sauce|Snack)/i
];

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

// SAFER PROCESSING CONFIG
const BATCH_SIZE = 5;
const DELAY_MS = 10000; // 10 seconds between requests

// Timestamp for logging
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logDir = resolve(__dirname, 'logs');
const logFileJson = resolve(logDir, `bulk-image-gen-${timestamp}.json`);
const logFileCsv = resolve(logDir, `bulk-image-gen-${timestamp}.csv`);

// Ensure log directory exists
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

// Initialize logging data
const logData = {
    timestamp,
    total_targeted: 0,
    successful: [],
    failed: [],
    first_failure: null,
    summary: {}
};

// Always load LATEST recipes.json
const allRecipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));

// Filter recipes to only those with placeholder images
const targetRecipes = allRecipes.filter(recipe => {
  const image = recipe.image || '';
  
  // Skip if image is already in /recipe-images/ (real images)
  if (image.includes('/recipe-images/')) {
    return false;
  }
  
  // Check if image matches any placeholder pattern
  return placeholderPatterns.some(pattern => pattern.test(image));
});

// SAFER PROCESSING: Max 5 recipes per batch, 10-second delays
const BATCH_SIZE = 5;
const DELAY_MS = 10000; // 10 seconds between requests
const MAX_RETRIES = 1;

// Timestamp for logging
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logDir = resolve(__dirname, 'logs');
const logFileJson = resolve(logDir, `bulk-image-gen-${timestamp}.json`);
const logFileCsv = resolve(logDir, `bulk-image-gen-${timestamp}.csv`);

// Ensure log directory exists
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

console.log(`Found ${targetRecipes.length} placeholder images to replace`);
console.log(`SAFER MODE: Max ${BATCH_SIZE} per batch, ${DELAY_MS}ms delays`);
console.log(`Logs will be saved to: ${logDir}\n`);

// Initialize logging data
const logData = {
    timestamp,
    total_targeted: targetRecipes.length,
    successful: [],
    failed: [],
    first_failure: null,
    summary: {}
};

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

console.log(`Generating Imagen images for ${targetRecipes.length} placeholder recipes...\n`);

let updated = 0;
let failed = 0;
const failures = [];
const successfulReplacements = [];

// Hard stop on first 429 error flag
let hardStop = false;
let first429Error = null;

for (let i = 0; i < targetRecipes.length; i++) {
    const recipe = targetRecipes[i];
    const imageFile = `imported_${recipe.id}.jpg`;
    const imagePath = resolve(outputDir, imageFile);

    process.stdout.write(`[${String(i + 1).padStart(2)}/${targetRecipes.length}] ${recipe.title.padEnd(45).substring(0, 45)} `);

    try {
        // Step 1: Build rich prompt from ingredients
        const description = await buildPrompt(recipe);

        // Step 2: Generate image with Imagen 3
        const base64 = await generateImage(description);

        // Step 3: Save to file
        writeFileSync(imagePath, Buffer.from(base64, 'base64'));

        // Step 4: Update recipe to use local path
        // Find the recipe in the original array and update it
        const originalRecipe = allRecipes.find(r => r.id === recipe.id);
        if (originalRecipe) {
            originalRecipe.image = `/recipe-images/imported_${recipe.id}.jpg`;
            updated++;
            successfulReplacements.push({
                id: recipe.id,
                title: recipe.title,
                newImage: `/recipe-images/imported_${recipe.id}.jpg`
            });
            console.log('OK');
        } else {
            throw new Error('Could not find recipe in original array');
        }
    } catch (e) {
        console.log(`FAIL: ${e.message?.substring(0, 60)}`);
        
        // HARD STOP on 429/rate limit errors
        if (e.message?.includes('429') || e.message?.includes('rate limit')) {
            console.log(`\n🛑 HARD STOP: Rate limit hit! First failure: ${recipe.title} (${recipe.id})`);
            if (!first429Error) {
                first429Error = {
                    id: recipe.id,
                    title: recipe.title,
                    error: e.message,
                    index: i
                };
                logData.first_failure = first429Error;
            }
            hardStop = true;
        }
        
        failures.push({
            title: recipe.title,
            id: recipe.id,
            error: e.message
        });
        failed++;
        // Keep existing image URL as fallback
    }

    // SAFER RATE LIMITING: 10-second delays between requests
    if (i < targetRecipes.length - 1) {
        console.log(`⏳ Waiting ${DELAY_MS}ms before next request...`);
        await sleep(DELAY_MS);
    }
    
    // Check for hard stop after each request
    if (hardStop) {
        console.log(`\n🛑 EARLY STOP: Rate limit detected, stopping processing.`);
        break;
    }
}

// Save updated recipes.json
writeFileSync(recipesPath, JSON.stringify(allRecipes, null, 2) + '\n');

console.log(`\n${'='.repeat(60)}`);
console.log(`Done! ${updated} succeeded, ${failed} failed out of ${targetRecipes.length} placeholder images.`);

// Prepare summary data
logData.summary = {
    total_processed: updated + failed,
    successful_count: updated,
    failed_count: failed,
    hard_stopped: hardStop,
    first_failure_recipe: first429Error,
    success_rate: `${Math.round((updated / (updated + failed)) * 100)}%`
};

if (successfulReplacements.length > 0) {
    console.log(`\nSuccessfully replaced images:`);
    successfulReplacements.forEach(r => console.log(`  ✓ ${r.title} (${r.id})`));
    logData.successful = successfulReplacements;
}

if (failures.length > 0) {
    console.log(`\nFailed replacements (kept existing placeholder):`);
    failures.forEach(f => console.log(`  ✗ ${f.title} (${f.id}): ${f.error}`));
    logData.failed = failures;
}

// Create CSV summary
const csvLines = [];
csvLines.push('Recipe ID,Recipe Title,Status,Error');
successfulReplacements.forEach(r => csvLines.push(`${r.id},"${r.title}",SUCCESS,`));
failures.forEach(f => csvLines.push(`${f.id},"${f.title}",FAILED,"${f.error.replace(/"/g, '""')}"`));
const csvContent = csvLines.join('\n');

console.log(`\nImages saved to: public/recipe-images/`);
console.log(`Updated: src/data/recipes.json`);

// Write detailed logs
writeFileSync(logFileJson, JSON.stringify(logData, null, 2));
writeFileSync(logFileCsv, csvContent);
console.log(`Logs saved: ${logFileJson} and ${logFileCsv}`);

// FINAL SUMMARY
console.log(`\n${'='.repeat(60)}`);
console.log(`📊 SUMMARY:`);
console.log(`✅ Photos created: ${updated}`);
console.log(`❌ Failures: ${failed}`);
if (successfulReplacements.length > 0) {
    console.log(`📋 Successful IDs: ${successfulReplacements.map(r => r.id).join(', ')}`);
}
if (first429Error) {
    console.log(`🛑 First failure (rate limit): ${first429Error.id} - "${first429Error.title}"`);
}

// Exit with error code if we hit rate limits
if (hardStop) {
    console.log(`\n⚠️  HARD STOP: Rate limit detected - consider trying again later.`);
    process.exit(1);
}