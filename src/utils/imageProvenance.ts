import { CATEGORY_IMAGES } from '../constants';
import type { Recipe } from '../types';

export type RecipeImageStatus = 'approved-actual' | 'generated-fallback' | 'pending-review' | 'default-placeholder' | 'missing';

export interface RecipeImageStatusInfo {
  status: RecipeImageStatus;
  label: string;
  description: string;
  tone: 'green' | 'amber' | 'blue' | 'stone' | 'red';
  needsCreatorActual: boolean;
}

const categoryImageValues = new Set(Object.values(CATEGORY_IMAGES));

export function hasCreatorActualPhoto(recipe: Pick<Recipe, 'imageSource' | 'generatedImageFallback' | 'imageApprovalStatus'>): boolean {
  return recipe.imageSource === 'upload' && recipe.generatedImageFallback !== true && recipe.imageApprovalStatus !== 'pending-review';
}

export function getRecipeImageStatus(recipe: Pick<Recipe, 'image' | 'imageSource' | 'generatedImageFallback' | 'imageApprovalStatus'>): RecipeImageStatusInfo {
  if (!recipe.image?.trim()) {
    return {
      status: 'missing',
      label: 'Missing image',
      description: 'No image is currently saved for this recipe.',
      tone: 'red',
      needsCreatorActual: true,
    };
  }

  if (recipe.imageApprovalStatus === 'pending-review') {
    return {
      status: 'pending-review',
      label: 'Actual pending review',
      description: 'A creator-supplied actual photo has been uploaded and needs custodian approval.',
      tone: 'blue',
      needsCreatorActual: false,
    };
  }

  if (hasCreatorActualPhoto(recipe)) {
    return {
      status: 'approved-actual',
      label: 'Approved actual',
      description: 'This recipe uses a creator- or family-supplied actual photo.',
      tone: 'green',
      needsCreatorActual: false,
    };
  }

  if (recipe.generatedImageFallback === true || recipe.imageSource === 'nano-banana' || recipe.imageSource === 'local-generated') {
    return {
      status: 'generated-fallback',
      label: 'Generated fallback',
      description: 'This is a realistic temporary generated photo until the creator provides an actual image.',
      tone: 'amber',
      needsCreatorActual: true,
    };
  }

  if (categoryImageValues.has(recipe.image)) {
    return {
      status: 'default-placeholder',
      label: 'Default placeholder',
      description: 'This recipe is using a category placeholder rather than a recipe-specific photo.',
      tone: 'stone',
      needsCreatorActual: true,
    };
  }

  return {
    status: 'default-placeholder',
    label: 'Unverified image',
    description: 'This image exists but has no recorded creator approval metadata.',
    tone: 'stone',
    needsCreatorActual: true,
  };
}

export function summarizeRecipeImageStatuses(recipes: Recipe[]) {
  const summary: Record<RecipeImageStatus, number> = {
    'approved-actual': 0,
    'generated-fallback': 0,
    'pending-review': 0,
    'default-placeholder': 0,
    missing: 0,
  };

  recipes.forEach((recipe) => {
    summary[getRecipeImageStatus(recipe).status] += 1;
  });

  const total = recipes.length;
  const needsCreatorActual = recipes.filter((recipe) => getRecipeImageStatus(recipe).needsCreatorActual).length;
  return {
    ...summary,
    total,
    needsCreatorActual,
    actualCoveragePercent: total > 0 ? Math.round((summary['approved-actual'] / total) * 100) : 0,
  };
}

export function markRecipeImageAsApprovedActual(recipe: Recipe, uploadedBy?: string | null): Recipe {
  const timestamp = new Date().toISOString();
  return {
    ...recipe,
    imageSource: 'upload',
    generatedImageFallback: false,
    actualImageUploadedAt: recipe.actualImageUploadedAt ?? timestamp,
    actualImageUploadedBy: recipe.actualImageUploadedBy ?? uploadedBy ?? recipe.contributor ?? 'Family',
    imageApprovalStatus: 'approved',
    imageApprovedAt: timestamp,
    imageApprovedBy: uploadedBy ?? 'Custodian',
  };
}
