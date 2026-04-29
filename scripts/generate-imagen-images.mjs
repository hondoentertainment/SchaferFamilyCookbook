#!/usr/bin/env node
/**
 * Generate Nano Banana recipe images with quota-safe controls.
 *
 * Highlights:
 * - Resumable state file (safe to stop/restart)
 * - Missing-only mode by default (avoids unnecessary image spend)
 * - Per-run limits, delay, and retry/backoff
 * - Stops early on hard quota exhaustion and preserves progress
 *
 * Usage examples:
 *   node scripts/generate-imagen-images.mjs
 *   node scripts/generate-imagen-images.mjs --limit 20
 *   node scripts/generate-imagen-images.mjs --missing-only --limit 15
 *   node scripts/generate-imagen-images.mjs --force-all --limit 25
 *   node scripts/generate-imagen-images.mjs --no-resume --reset-state
 */
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  buildLLMPromptText,
  normalizeDescription,
  buildRecipeImagePrompt,
  buildPollinationsImageUrl,
  extractGeneratedImage,
  getImageExtension,
  TEXT_MODEL,
  RECIPE_IMAGE_MODEL,
} from '../shared/recipeImagePrompts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const recipesPath = resolve(__dirname, '../src/data/recipes.json');
const outputDir = resolve(__dirname, '../public/recipe-images');
const defaultStateFile = resolve(__dirname, '../.cache/imagen-generation-state.json');

function parseArgs(argv) {
  const args = {
    limit: Number.POSITIVE_INFINITY,
    delayMs: 3000,
    retryDelayMs: 12000,
    maxRetries: 2,
    startIndex: 0,
    missingOnly: true,
    forceAll: false,
    dryRun: false,
    resume: true,
    resetState: false,
    stateFile: defaultStateFile,
    help: false,
    provider: 'auto',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--missing-only') args.missingOnly = true;
    else if (arg === '--force-all') args.forceAll = true;
    else if (arg === '--no-resume') args.resume = false;
    else if (arg === '--resume') args.resume = true;
    else if (arg === '--reset-state') args.resetState = true;
    else if (arg === '--provider' && next) { args.provider = String(next).toLowerCase(); i++; }
    else if (arg === '--limit' && next) { args.limit = Math.max(0, Number(next)); i++; }
    else if (arg === '--delay-ms' && next) { args.delayMs = Math.max(0, Number(next)); i++; }
    else if (arg === '--retry-delay-ms' && next) { args.retryDelayMs = Math.max(0, Number(next)); i++; }
    else if (arg === '--max-retries' && next) { args.maxRetries = Math.max(0, Number(next)); i++; }
    else if (arg === '--start-index' && next) { args.startIndex = Math.max(0, Number(next)); i++; }
    else if (arg === '--state-file' && next) { args.stateFile = resolve(process.cwd(), next); i++; }
  }

  if (args.forceAll) args.missingOnly = false;
  if (!['auto', 'gemini', 'pollinations'].includes(args.provider)) {
    throw new Error(`Unsupported provider "${args.provider}". Use auto, gemini, or pollinations.`);
  }
  return args;
}

function printHelp() {
  console.log(`
Generate Nano Banana images with quota-safe batching.

Flags:
  --limit <n>            Max recipes to process this run (default: unlimited)
  --missing-only         Process only recipes missing high-quality local images (default)
  --force-all            Re-generate all recipes, even if already nano-banana
  --delay-ms <n>         Delay between recipes in milliseconds (default: 3000)
  --max-retries <n>      Retry count for transient errors (default: 2)
  --retry-delay-ms <n>   Base retry delay in milliseconds (default: 12000)
  --start-index <n>      Start from recipe index in recipes.json (default: 0)
  --state-file <path>    Override resumable state file path
  --no-resume            Ignore existing state successes for this run
  --reset-state          Clear state file before running
  --dry-run              Show target recipes without calling the API
  --provider <name>      auto (default), gemini, or pollinations
  --help                 Show this help
`);
}

function loadApiKey() {
  let apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    try {
      const envLocal = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
      const match = envLocal.match(/GEMINI_API_KEY=(.+)/);
      if (match) apiKey = match[1].trim();
    } catch {
      // Ignore missing .env.local and fall through to explicit error.
    }
  }
  return apiKey;
}

function isRateLimitedError(message = '') {
  const lower = message.toLowerCase();
  return lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests');
}

function isHardQuotaError(message = '') {
  const lower = message.toLowerCase();
  return lower.includes('quota') || lower.includes('resource exhausted') || lower.includes('exceeded your current quota');
}

function isRetryableError(message = '') {
  const lower = message.toLowerCase();
  return isRateLimitedError(lower) || lower.includes('timeout') || lower.includes('network') || lower.includes('fetch');
}

function truncate(text, max = 65) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function loadState(stateFile) {
  if (!existsSync(stateFile)) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      cursor: 0,
      totals: { attempted: 0, success: 0, failed: 0, skipped: 0 },
      entries: {},
      stoppedForQuota: false,
    };
  }
  try {
    return JSON.parse(readFileSync(stateFile, 'utf-8'));
  } catch {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      cursor: 0,
      totals: { attempted: 0, success: 0, failed: 0, skipped: 0 },
      entries: {},
      stoppedForQuota: false,
    };
  }
}

function persistState(stateFile, state) {
  mkdirSync(dirname(stateFile), { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function recipeHasFreshLocalImage(recipe) {
  if (!['nano-banana', 'pollinations'].includes(recipe.imageSource || '')) return false;
  const image = recipe.image || '';
  if (!image.startsWith('/recipe-images/')) return false;
  const imageFile = image.replace('/recipe-images/', '');
  const imagePath = resolve(outputDir, imageFile);
  return existsSync(imagePath);
}

function recipeNeedsGeneration(recipe) {
  const image = recipe.image || '';
  if (!image) return true;
  if (image.includes('pollinations.ai')) return true;
  if (image.includes('source.unsplash.com')) return true;
  if (image.includes('images.unsplash.com')) return true;
  if (image.includes('fallback-gradient')) return true;
  return !recipeHasFreshLocalImage(recipe);
}

async function buildPrompt(ai, recipe) {
  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: 'user', parts: [{ text: buildLLMPromptText(recipe) }] }],
  });
  return normalizeDescription(response.text, recipe);
}

async function generateImage(ai, description) {
  const response = await ai.models.generateContent({
    model: RECIPE_IMAGE_MODEL,
    contents: [{ role: 'user', parts: [{ text: buildRecipeImagePrompt(description) }] }],
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: '4:3',
        imageSize: '1K',
      },
    },
  });
  const generatedImage = extractGeneratedImage(response);
  if (!generatedImage?.imageBase64) throw new Error('Image generation failed');
  return generatedImage;
}

async function downloadPollinationsImage(recipe) {
  const imageUrl = buildPollinationsImageUrl(recipe);
  const response = await fetch(imageUrl, {
    headers: { 'User-Agent': 'SchaferCookbook/1.0' },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`Pollinations HTTP ${response.status}`);
  const mimeType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const imageBuffer = Buffer.from(await response.arrayBuffer());
  if (imageBuffer.length < 1000) {
    throw new Error(`Pollinations image too small (${imageBuffer.length} bytes)`);
  }
  return { imageBuffer, mimeType, imageSource: 'pollinations' };
}

async function generateWithRetry(ai, recipe, args) {
  let attempt = 0;
  const maxAttempts = args.maxRetries + 1;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const description = await buildPrompt(ai, recipe);
      const generatedImage = await generateImage(ai, description);
      return generatedImage;
    } catch (error) {
      const message = error?.message || String(error);
      if (isHardQuotaError(message)) {
        const quotaErr = new Error(message);
        quotaErr.code = 'HARD_QUOTA';
        throw quotaErr;
      }
      if (!isRetryableError(message) || attempt >= maxAttempts) {
        throw error;
      }
      const waitMs = args.retryDelayMs * attempt;
      console.log(`  ↳ transient error, retrying in ${Math.round(waitMs / 1000)}s...`);
      await sleep(waitMs);
    }
  }
}

async function downloadPollinationsWithRetry(recipe, args) {
  let attempt = 0;
  const maxAttempts = args.maxRetries + 1;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await downloadPollinationsImage(recipe);
    } catch (error) {
      const message = error?.message || String(error);
      if (!isRetryableError(message) || attempt >= maxAttempts) {
        throw error;
      }
      const waitMs = args.retryDelayMs * attempt;
      console.log(`  -> Pollinations transient error, retrying in ${Math.round(waitMs / 1000)}s...`);
      await sleep(waitMs);
    }
  }
}

function removePriorRecipeFileVariants(recipeId, nextImagePath) {
  for (const oldExtension of ['png', 'jpg', 'webp']) {
    const oldPath = resolve(outputDir, `${recipeId}.${oldExtension}`);
    if (oldPath !== nextImagePath && existsSync(oldPath)) rmSync(oldPath);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));

if (args.resetState && existsSync(args.stateFile)) rmSync(args.stateFile);
const state = loadState(args.stateFile);
if (!state.entries) state.entries = {};
if (!state.totals) state.totals = { attempted: 0, success: 0, failed: 0, skipped: 0 };

const candidates = recipes
  .map((recipe, index) => ({ recipe, index }))
  .filter(({ recipe, index }) => {
    if (index < args.startIndex) return false;
    if (!args.forceAll && args.missingOnly && !recipeNeedsGeneration(recipe)) return false;
    if (args.resume && state.entries?.[recipe.id]?.status === 'success') return false;
    return true;
  });

const selected = Number.isFinite(args.limit) ? candidates.slice(0, args.limit) : candidates;

console.log('\nQuota-safe image generation run');
console.log('='.repeat(60));
console.log(`Recipes total:         ${recipes.length}`);
console.log(`Candidates:            ${candidates.length}`);
console.log(`Will process now:      ${selected.length}`);
console.log(`Missing-only mode:     ${args.missingOnly ? 'yes' : 'no'}`);
console.log(`Resume prior success:  ${args.resume ? 'yes' : 'no'}`);
console.log(`Provider mode:         ${args.provider}`);
console.log(`Delay between items:   ${args.delayMs}ms`);
console.log(`Retry policy:          ${args.maxRetries} retries, base ${args.retryDelayMs}ms`);
console.log(`State file:            ${args.stateFile}`);
console.log('='.repeat(60));

if (args.dryRun) {
  console.log('\nDry run targets:');
  selected.forEach(({ recipe, index }, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [${index}] ${recipe.title}`);
  });
  process.exit(0);
}

const apiKey = loadApiKey();
if (args.provider === 'gemini' && !apiKey) {
  console.error('ERROR: No GEMINI_API_KEY found. Set it in .env.local or as an environment variable, or use --provider auto/pollinations.');
  process.exit(1);
}
if (args.provider === 'auto' && !apiKey) {
  console.log('\nNo GEMINI_API_KEY found. Falling back to Pollinations for this run.');
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

let runSuccess = 0;
let runFailed = 0;
let runSkipped = 0;
let geminiQuotaFallbackTriggered = false;
let geminiUnavailableForRun = args.provider === 'pollinations' || !ai;
const failures = [];

for (let i = 0; i < selected.length; i++) {
  const { recipe, index } = selected[i];
  process.stdout.write(`[${String(i + 1).padStart(2)}/${selected.length}] [${index}] ${truncate(recipe.title, 45).padEnd(45)} `);

  try {
    let imageSource = 'pollinations';
    let mimeType = 'image/jpeg';
    let imageBuffer = null;

    if (args.provider === 'pollinations') {
      const pollinationsImage = await downloadPollinationsWithRetry(recipe, args);
      imageSource = pollinationsImage.imageSource;
      mimeType = pollinationsImage.mimeType;
      imageBuffer = pollinationsImage.imageBuffer;
    } else if (args.provider === 'gemini') {
      const geminiImage = await generateWithRetry(ai, recipe, args);
      imageSource = 'nano-banana';
      mimeType = geminiImage.mimeType;
      imageBuffer = Buffer.from(geminiImage.imageBase64, 'base64');
    } else if (!geminiUnavailableForRun) {
      try {
        const geminiImage = await generateWithRetry(ai, recipe, args);
        imageSource = 'nano-banana';
        mimeType = geminiImage.mimeType;
        imageBuffer = Buffer.from(geminiImage.imageBase64, 'base64');
      } catch (error) {
        const message = error?.message || String(error);
        if (error?.code === 'HARD_QUOTA') {
          geminiUnavailableForRun = true;
          geminiQuotaFallbackTriggered = true;
          state.stoppedForQuota = true;
          console.log(`FALLBACK: ${truncate(message, 80)}`);
          process.stdout.write(`  -> switching remaining recipes to Pollinations\n`);
        } else {
          console.log(`FALLBACK: ${truncate(message, 80)}`);
        }
        const pollinationsImage = await downloadPollinationsWithRetry(recipe, args);
        imageSource = pollinationsImage.imageSource;
        mimeType = pollinationsImage.mimeType;
        imageBuffer = pollinationsImage.imageBuffer;
      }
    } else {
      const pollinationsImage = await downloadPollinationsWithRetry(recipe, args);
      imageSource = pollinationsImage.imageSource;
      mimeType = pollinationsImage.mimeType;
      imageBuffer = pollinationsImage.imageBuffer;
    }

    const extension = getImageExtension(mimeType);
    const imageFile = `${recipe.id}.${extension}`;
    const imagePath = resolve(outputDir, imageFile);

    removePriorRecipeFileVariants(recipe.id, imagePath);
    writeFileSync(imagePath, imageBuffer);
    recipe.image = `/recipe-images/${imageFile}`;
    recipe.imageSource = imageSource;

    state.entries[recipe.id] = {
      status: 'success',
      title: recipe.title,
      image: recipe.image,
      imageSource,
      updatedAt: new Date().toISOString(),
    };
    runSuccess += 1;
    state.totals.success += 1;
    console.log(`OK (${imageSource})`);
  } catch (error) {
    const message = error?.message || String(error);
    runFailed += 1;
    failures.push({ title: recipe.title, message });
    state.entries[recipe.id] = {
      status: 'failed',
      title: recipe.title,
      error: message,
      updatedAt: new Date().toISOString(),
    };
    state.totals.failed += 1;
    console.log(`FAIL: ${truncate(message, 70)}`);
  }

  state.cursor = index + 1;
  state.totals.attempted += 1;
  persistState(args.stateFile, state);
  writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');

  if (i < selected.length - 1) await sleep(args.delayMs);
}

// Mark skipped count for transparency when limit truncates target list.
if (candidates.length > selected.length) {
  runSkipped = candidates.length - selected.length;
  state.totals.skipped += runSkipped;
}
persistState(args.stateFile, state);
writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');

console.log(`\n${'='.repeat(60)}`);
console.log(`Run complete: ${runSuccess} succeeded, ${runFailed} failed, ${runSkipped} deferred.`);
if (failures.length > 0) {
  console.log('\nFailures from this run:');
  failures.forEach((f) => console.log(`  - ${f.title}: ${truncate(f.message, 120)}`));
}
if (geminiQuotaFallbackTriggered) {
  console.log('\nGemini quota exhaustion was detected. Remaining recipes were generated with Pollinations.');
}
console.log('\nResumable strategy:');
console.log(`  1) Re-run with the same provider mode when needed`);
console.log(`  2) Progress is preserved in: ${args.stateFile}`);
console.log(`\nImages saved to: public/recipe-images/`);
console.log(`Updated dataset: src/data/recipes.json`);
