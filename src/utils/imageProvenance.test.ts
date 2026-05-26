import { describe, expect, it, vi } from 'vitest';
import { CATEGORY_IMAGES } from '../constants';
import type { Recipe } from '../types';
import {
  getRecipeImageStatus,
  hasCreatorActualPhoto,
  markRecipeImageAsApprovedActual,
  summarizeRecipeImageStatuses,
} from './imageProvenance';

const baseRecipe: Recipe = {
  id: 'recipe-1',
  title: 'Test Recipe',
  category: 'Main',
  contributor: 'Family',
  ingredients: ['1 cup testing'],
  instructions: ['Run the test.'],
  image: '/recipe-images/test.webp',
};

describe('imageProvenance', () => {
  it('classifies generated images as temporary fallbacks that need creator actuals', () => {
    const status = getRecipeImageStatus({
      ...baseRecipe,
      imageSource: 'nano-banana',
      generatedImageFallback: true,
      imageApprovalStatus: 'generated-fallback',
    });

    expect(status.status).toBe('generated-fallback');
    expect(status.needsCreatorActual).toBe(true);
    expect(status.tone).toBe('amber');
  });

  it('classifies uploaded approved photos as creator actuals', () => {
    const recipe = {
      ...baseRecipe,
      imageSource: 'upload' as const,
      generatedImageFallback: false,
      imageApprovalStatus: 'approved' as const,
    };

    expect(hasCreatorActualPhoto(recipe)).toBe(true);
    expect(getRecipeImageStatus(recipe).status).toBe('approved-actual');
  });

  it('keeps pending uploads separate from approved actuals', () => {
    const status = getRecipeImageStatus({
      ...baseRecipe,
      imageSource: 'upload',
      generatedImageFallback: false,
      imageApprovalStatus: 'pending-review',
    });

    expect(status.status).toBe('pending-review');
    expect(status.needsCreatorActual).toBe(false);
  });

  it('identifies category placeholders and missing images as needing actuals', () => {
    expect(getRecipeImageStatus({ ...baseRecipe, image: CATEGORY_IMAGES.Main }).status).toBe('default-placeholder');
    expect(getRecipeImageStatus({ ...baseRecipe, image: '' }).status).toBe('missing');
    expect(getRecipeImageStatus({ ...baseRecipe, image: CATEGORY_IMAGES.Main }).needsCreatorActual).toBe(true);
    expect(getRecipeImageStatus({ ...baseRecipe, image: '' }).needsCreatorActual).toBe(true);
  });

  it('summarizes image status coverage for the admin dashboard', () => {
    const summary = summarizeRecipeImageStatuses([
      { ...baseRecipe, id: 'actual', imageSource: 'upload', generatedImageFallback: false, imageApprovalStatus: 'approved' },
      { ...baseRecipe, id: 'generated', imageSource: 'nano-banana', generatedImageFallback: true, imageApprovalStatus: 'generated-fallback' },
      { ...baseRecipe, id: 'pending', imageSource: 'upload', generatedImageFallback: false, imageApprovalStatus: 'pending-review' },
      { ...baseRecipe, id: 'missing', image: '' },
    ]);

    expect(summary['approved-actual']).toBe(1);
    expect(summary['generated-fallback']).toBe(1);
    expect(summary['pending-review']).toBe(1);
    expect(summary.missing).toBe(1);
    expect(summary.needsCreatorActual).toBe(2);
    expect(summary.actualCoveragePercent).toBe(25);
  });

  it('marks an uploaded replacement as an approved creator actual', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T12:00:00.000Z'));

    const approved = markRecipeImageAsApprovedActual(
      {
        ...baseRecipe,
        imageSource: 'nano-banana',
        generatedImageFallback: true,
        imageApprovalStatus: 'generated-fallback',
      },
      'Admin User',
    );

    expect(approved.imageSource).toBe('upload');
    expect(approved.generatedImageFallback).toBe(false);
    expect(approved.imageApprovalStatus).toBe('approved');
    expect(approved.actualImageUploadedAt).toBe('2026-05-25T12:00:00.000Z');
    expect(approved.actualImageUploadedBy).toBe('Admin User');
    expect(approved.imageApprovedAt).toBe('2026-05-25T12:00:00.000Z');
    expect(approved.imageApprovedBy).toBe('Admin User');

    vi.useRealTimers();
  });
});
