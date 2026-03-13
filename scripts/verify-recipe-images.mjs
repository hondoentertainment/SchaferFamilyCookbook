#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const recipesPath = resolve(root, 'src/data/recipes.json');
const auditCsvPath = resolve(root, 'images_audit.csv');

const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));
const usageCounts = new Map();
for (const recipe of recipes) {
  const image = String(recipe.image || '').trim();
  usageCounts.set(image, (usageCounts.get(image) || 0) + 1);
}

const failures = [];
const warnings = [];
const rows = [];

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

for (const recipe of recipes) {
  const image = String(recipe.image || '').trim();
  const isLocal = image.startsWith('/recipe-images/');
  const relativePath = isLocal ? image.replace(/^\//, '') : '';
  const diskPath = isLocal ? resolve(root, 'public', relativePath.replace(/^recipe-images\//, 'recipe-images/')) : '';
  const exists = isLocal && existsSync(diskPath);
  const usageCount = usageCounts.get(image) || 0;
  let width = '';
  let height = '';
  let sizeBytes = '';
  let aspectRatio = '';

  if (!image) {
    failures.push(`${recipe.title}: missing image path`);
  } else if (!isLocal) {
    failures.push(`${recipe.title}: image is not local (${image})`);
  } else if (!exists) {
    failures.push(`${recipe.title}: missing file ${image}`);
  }

  if (!recipe.imageSource) {
    failures.push(`${recipe.title}: missing imageSource metadata`);
  }

  if (usageCount > 1) {
    failures.push(`${recipe.title}: shared image path ${image} is reused ${usageCount} times`);
  }

  if (exists) {
    const metadata = await sharp(diskPath).metadata();
    const stats = await sharp(diskPath).stats();
    width = metadata.width ?? '';
    height = metadata.height ?? '';
    sizeBytes = metadata.size ?? '';
    aspectRatio = metadata.width && metadata.height ? (metadata.width / metadata.height).toFixed(3) : '';

    if ((metadata.width ?? 0) < 800 || (metadata.height ?? 0) < 600) {
      warnings.push(`${recipe.title}: low image dimensions ${metadata.width}x${metadata.height}`);
    }
    if ((metadata.size ?? 0) > 350_000) {
      warnings.push(`${recipe.title}: large image size ${metadata.size} bytes`);
    }
    if (stats.isOpaque === false) {
      warnings.push(`${recipe.title}: image has transparency; verify export format is intentional`);
    }
  }

  rows.push([
    recipe.id,
    recipe.title,
    recipe.category,
    image,
    recipe.imageSource || '',
    usageCount,
    exists,
    width,
    height,
    sizeBytes,
    aspectRatio,
  ]);
}

const csvLines = [
  ['id', 'title', 'category', 'image', 'imageSource', 'usageCount', 'exists', 'width', 'height', 'sizeBytes', 'aspectRatio'].join(','),
  ...rows.map((row) => row.map(csvEscape).join(',')),
];
writeFileSync(auditCsvPath, csvLines.join('\n') + '\n');

console.log('\nRecipe image audit');
console.log('='.repeat(60));
console.log(`Recipes checked: ${recipes.length}`);
console.log(`Unique image paths: ${usageCounts.size}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Failures: ${failures.length}`);
console.log(`Audit report: ${auditCsvPath}`);

if (warnings.length) {
  console.log('\nWarnings:');
  for (const warning of warnings.slice(0, 20)) console.log(`- ${warning}`);
  if (warnings.length > 20) console.log(`- ...and ${warnings.length - 20} more`);
}

if (failures.length) {
  console.log('\nFailures:');
  for (const failure of failures.slice(0, 30)) console.log(`- ${failure}`);
  if (failures.length > 30) console.log(`- ...and ${failures.length - 30} more`);
  process.exit(1);
}
