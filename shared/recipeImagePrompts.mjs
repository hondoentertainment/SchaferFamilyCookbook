/**
 * Canonical recipe image prompt rules.
 * Used by: AdminView (single + bulk), api/gemini.ts, scripts/generate-imagen-images.mjs
 * Ensures images match recipe content and avoid hallucination.
 */

export const TEXT_MODEL = 'gemini-2.0-flash';
export const RECIPE_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
export const DEFAULT_IMAGE_MIME_TYPE = 'image/png';

export const RECIPE_IMAGE_RULES = {
  /** LLM instruction: strict anti-hallucination. */
  LLM_SYSTEM:
    `You are describing the finished dish for a food photographer. Be ACCURATE. Use ONLY the recipe data below. Do NOT add parsley, herbs, garnish, side dishes, utensils, or any ingredient not listed unless the recipe explicitly calls for them.`,
  /** Nano Banana suffix: strongly constrain the generated scene. */
  NANO_BANANA_SUFFIX:
    `Show only the finished recipe as a realistic plated dish. No invented garnish or extra ingredients. No text overlay, no hands, no people. Warm natural lighting, appetizing styling, rustic kitchen table, shallow depth of field.`,
  /** Pollinations-style suffix (for hand-curated prompts). */
  POLLINATIONS_ACCURACY: `accurately depicting only this dish with no invented garnish`,
};

/** Minimum length for LLM output; shorter triggers deterministic fallback. */
export const MIN_DESCRIPTION_LENGTH = 10;

/**
 * Build deterministic prompt from recipe data only (no LLM).
 * Fallback when LLM returns empty or unreliable.
 */
export function buildDeterministicPrompt(recipe) {
  const topIngredients = (recipe.ingredients || []).slice(0, 8).join(', ');
  return `the finished dish "${recipe.title}", featuring ${topIngredients || 'the main ingredients'}, plated as cooked`;
}

/**
 * Build full LLM prompt text for recipe image description.
 * @param {object} recipe - { title, category, ingredients?, instructions? }
 * @returns {string} Text to send to Gemini
 */
export function buildLLMPromptText(recipe) {
  const topIngredients = (recipe.ingredients || []).slice(0, 8).join(', ');
  const instructionHint = (recipe.instructions || [])[0]?.slice(0, 80) || '';
  return `${RECIPE_IMAGE_RULES.LLM_SYSTEM}

Recipe title: "${recipe.title}"
Category: ${recipe.category}
Key ingredients (use only these): ${topIngredients}
${instructionHint ? `First step (hint for plating/form): ${instructionHint}` : ''}

Write a 15-25 word visual description: what the dish actually looks like when cooked and plated. Colors, textures, plating. Return ONLY the description, no quotes. Do not invent any ingredients.`;
}

/**
 * Validate and optionally fallback: returns description or deterministic prompt.
 */
export function normalizeDescription(raw, recipe) {
  const cleaned = (raw || '').trim().replace(/['"\\n]/g, '');
  if (!cleaned || cleaned.length < MIN_DESCRIPTION_LENGTH) {
    return buildDeterministicPrompt(recipe);
  }
  return cleaned;
}

/**
 * Build final Nano Banana prompt from description.
 */
export function buildRecipeImagePrompt(description) {
  return `Professional food photography: ${description}. ${RECIPE_IMAGE_RULES.NANO_BANANA_SUFFIX}`;
}

/**
 * Extract the first generated image payload from Gemini image responses.
 */
export function extractGeneratedImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inlineData = part?.inlineData;
    if (inlineData?.data) {
      return {
        imageBase64: inlineData.data,
        mimeType: inlineData.mimeType || DEFAULT_IMAGE_MIME_TYPE,
      };
    }
  }
  return null;
}

/**
 * Convert MIME type to a file extension for saved recipe images.
 */
export function getImageExtension(mimeType = DEFAULT_IMAGE_MIME_TYPE) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

/**
 * Build Pollinations prompt from hand-curated dish description.
 */
export function buildPollinationsPrompt(dishDescription) {
  return `Professional food photography of ${dishDescription}, ${RECIPE_IMAGE_RULES.POLLINATIONS_ACCURACY}. Warm lighting, appetizing, top-down angle, rustic kitchen background`;
}
