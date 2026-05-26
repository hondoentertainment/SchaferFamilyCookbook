import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const recipesPath = resolve('src/data/recipes.json');
const recipes = JSON.parse(readFileSync(recipesPath, 'utf8'));
let changed = 0;

const migrated = recipes.map((recipe) => {
  const next = { ...recipe };
  const source = String(next.imageSource || '').trim();
  const isGenerated = next.generatedImageFallback === true || source === 'nano-banana' || source === 'local-generated';
  const isCreatorUpload = source === 'upload';

  if (isGenerated) {
    if (next.generatedImageFallback !== true) {
      next.generatedImageFallback = true;
      changed += 1;
    }
    if (next.imageApprovalStatus !== 'generated-fallback') {
      next.imageApprovalStatus = 'generated-fallback';
      changed += 1;
    }
    delete next.actualImageUploadedAt;
    delete next.actualImageUploadedBy;
    delete next.imageApprovedAt;
    delete next.imageApprovedBy;
  } else if (isCreatorUpload) {
    if (next.generatedImageFallback !== false) {
      next.generatedImageFallback = false;
      changed += 1;
    }
    if (!next.imageApprovalStatus) {
      next.imageApprovalStatus = 'approved';
      changed += 1;
    }
  } else if (next.image && !next.imageApprovalStatus) {
    next.generatedImageFallback = false;
    next.imageApprovalStatus = 'needs-actual';
    changed += 1;
  }

  return next;
});

writeFileSync(recipesPath, `${JSON.stringify(migrated, null, 2)}\n`);
console.log(`Backfilled image provenance metadata changes: ${changed}`);
