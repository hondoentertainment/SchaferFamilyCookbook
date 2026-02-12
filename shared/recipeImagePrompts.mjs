/**
 * Canonical recipe image prompt rules.
 * Used by: AdminView (single + bulk), scripts/generate-imagen-images.mjs
 * Ensures images match recipe content and avoid hallucination.
 */

export const RECIPE_IMAGE_RULES = {
  /** LLM instruction: strict anti-hallucination. */
  LLM_SYSTEM:
    `You are describing the finished dish for a food photographer. Be ACCURATE. Use ONLY the recipe data below. Do NOT add parsley, herbs, garnish, or any ingredient not listed.`,
  /** Imagen prompt suffix: no invented elements. */
  IMAGEN_SUFFIX:
    `Accurately depict only this dish—no invented garnish or extra ingredients. Warm natural lighting, appetizing, rustic table, shallow depth of field.`,
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
 * Build final Imagen prompt from description.
 */
export function buildImagenPrompt(description) {
  return `Professional food photography: ${description}. ${RECIPE_IMAGE_RULES.IMAGEN_SUFFIX}`;
}

/**
 * Build Pollinations prompt from hand-curated dish description.
 */
export function buildPollinationsPrompt(dishDescription) {
  return `Professional food photography of ${dishDescription}, ${RECIPE_IMAGE_RULES.POLLINATIONS_ACCURACY}. Warm lighting, appetizing, top-down angle, rustic kitchen background`;
}
