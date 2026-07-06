/** Re-export for Vercel serverless bundling (api/ cannot import ../shared at runtime). */
export {
    buildLLMPromptText,
    normalizeDescription,
    buildRecipeImagePrompt,
    extractGeneratedImage,
    TEXT_MODEL,
    RECIPE_IMAGE_MODEL,
} from '../../shared/recipeImagePrompts.mjs';
