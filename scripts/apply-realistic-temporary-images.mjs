#!/usr/bin/env node
/**
 * Apply realistic temporary recipe photos.
 *
 * The committed assets in public/recipe-images/<recipe-id>.webp are temporary,
 * recipe-specific AI food photos. They remain the default fallback until a
 * creator uploads an actual photo, which is preserved because uploaded images
 * use imageSource: "upload".
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const recipesPath = resolve(root, 'src/data/recipes.json');
const manifestPath = resolve(root, 'scripts/realistic-recipe-image-prompts.json');
const sourceDir = resolve(root, 'tmp_realistic_images');
const outputDir = resolve(root, 'public/recipe-images');
const WIDTH = 1200;
const HEIGHT = 900;

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));
const manifestById = new Map(manifest.map((item) => [item.id, item]));

mkdirSync(outputDir, { recursive: true });

let applied = 0;
for (const recipe of recipes) {
  const promptInfo = manifestById.get(recipe.id);
  if (!promptInfo) {
    throw new Error(`No realistic image prompt manifest entry for recipe ${recipe.id} (${recipe.title})`);
  }

  const sourcePng = resolve(sourceDir, `${recipe.id}.png`);
  if (!existsSync(sourcePng)) {
    throw new Error(`Missing generated realistic PNG for recipe ${recipe.id} (${recipe.title}): ${sourcePng}`);
  }

  const imageFile = `${recipe.id}.webp`;
  const outputWebp = resolve(outputDir, imageFile);

  await sharp(sourcePng)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .webp({ quality: 86, effort: 5 })
    .toFile(outputWebp);

  recipe.image = `/recipe-images/${imageFile}`;
  recipe.imageSource = 'nano-banana';
  recipe.generatedImageFallback = true;
  recipe.generatedImagePrompt = promptInfo.prompt;
  applied += 1;
  console.log(`${String(applied).padStart(2, '0')}. ${recipe.title} -> ${recipe.image}`);
}

writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');
console.log(`\nApplied ${applied} realistic temporary recipe photos.`);
console.log('Creator-uploaded actual photos remain authoritative because imageSource: "upload" is preserved by normalization.');
