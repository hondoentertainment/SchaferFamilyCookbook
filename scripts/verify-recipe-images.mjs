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
const provenanceCounts = {
  approvedActual: 0,
  generatedFallback: 0,
  pendingReview: 0,
  needsActual: 0,
  missing: 0,
};

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

  if (recipe.generatedImageFallback === true || recipe.imageSource === 'nano-banana' || recipe.imageSource === 'local-generated') {
    provenanceCounts.generatedFallback += 1;
    if (recipe.imageApprovalStatus && recipe.imageApprovalStatus !== 'generated-fallback') {
      failures.push(`${recipe.title}: generated fallback has inconsistent imageApprovalStatus (${recipe.imageApprovalStatus})`);
    }
    if (!recipe.generatedImagePrompt?.trim()) {
      warnings.push(`${recipe.title}: generated fallback is missing generatedImagePrompt provenance`);
    }
  } else if (recipe.imageSource === 'upload') {
    if (recipe.imageApprovalStatus === 'pending-review') {
      provenanceCounts.pendingReview += 1;
    } else {
      provenanceCounts.approvedActual += 1;
      if (recipe.generatedImageFallback === true) {
        failures.push(`${recipe.title}: uploaded actual is still marked generatedImageFallback`);
      }
      if (recipe.imageApprovalStatus && recipe.imageApprovalStatus !== 'approved') {
        failures.push(`${recipe.title}: uploaded actual has unsupported imageApprovalStatus (${recipe.imageApprovalStatus})`);
      }
      if (!recipe.actualImageUploadedAt && !recipe.imageApprovedAt) {
        warnings.push(`${recipe.title}: uploaded actual lacks upload/approval timestamp provenance`);
      }
    }
  } else if (!image) {
    provenanceCounts.missing += 1;
  } else {
    provenanceCounts.needsActual += 1;
    if (recipe.imageApprovalStatus && recipe.imageApprovalStatus !== 'needs-actual') {
      warnings.push(`${recipe.title}: unverified image has unexpected imageApprovalStatus (${recipe.imageApprovalStatus})`);
    }
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
    recipe.generatedImageFallback === true ? 'true' : 'false',
    recipe.imageApprovalStatus || '',
    recipe.actualImageUploadedAt || '',
    recipe.imageApprovedAt || '',
    usageCount,
    exists,
    width,
    height,
    sizeBytes,
    aspectRatio,
  ]);
}

const csvLines = [
  ['id', 'title', 'category', 'image', 'imageSource', 'generatedImageFallback', 'imageApprovalStatus', 'actualImageUploadedAt', 'imageApprovedAt', 'usageCount', 'exists', 'width', 'height', 'sizeBytes', 'aspectRatio'].join(','),
  ...rows.map((row) => row.map(csvEscape).join(',')),
];
writeFileSync(auditCsvPath, csvLines.join('\n') + '\n');

console.log('\nRecipe image audit');
console.log('='.repeat(60));
console.log(`Recipes checked: ${recipes.length}`);
console.log(`Unique image paths: ${usageCounts.size}`);
console.log(`Approved actual photos: ${provenanceCounts.approvedActual}`);
console.log(`Generated fallbacks awaiting actuals: ${provenanceCounts.generatedFallback}`);
console.log(`Pending review photos: ${provenanceCounts.pendingReview}`);
console.log(`Needs actual/default placeholders: ${provenanceCounts.needsActual}`);
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
