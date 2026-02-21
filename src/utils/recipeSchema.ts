import { Recipe } from '../types';
import { siteConfig } from '../config/site';

/**
 * Build Schema.org Recipe structured data for SEO and rich results.
 * https://schema.org/Recipe
 */
export function buildRecipeSchema(recipe: Recipe): Record<string, unknown> {
  const imageUrl = recipe.image?.startsWith('/')
    ? `${siteConfig.baseUrl}${recipe.image}`
    : recipe.image;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    description: recipe.notes || `${recipe.title} from ${recipe.contributor}`,
    author: {
      '@type': 'Person',
      name: recipe.contributor,
    },
    recipeCategory: recipe.category,
  };

  if (imageUrl) {
    schema.image = imageUrl;
  }

  if (recipe.ingredients?.length) {
    schema.recipeIngredient = recipe.ingredients;
  }

  if (recipe.instructions?.length) {
    schema.recipeInstructions = recipe.instructions.map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text,
    }));
  }

  if (recipe.prepTime) {
    schema.prepTime = `PT${parseDurationToISO(recipe.prepTime)}`;
  }
  if (recipe.cookTime) {
    schema.cookTime = `PT${parseDurationToISO(recipe.cookTime)}`;
  }
  if (recipe.calories) {
    schema.nutrition = {
      '@type': 'NutritionInformation',
      calories: `${recipe.calories} calories`,
    };
  }
  if (recipe.servings !== undefined && recipe.servings !== null) {
    schema.recipeYield =
      typeof recipe.servings === 'number'
        ? `${recipe.servings} servings`
        : String(recipe.servings);
  }

  return schema;
}

/** Parse "30 min", "1 hr", "45 minutes" etc. to ISO 8601 duration minutes */
function parseDurationToISO(input: string): string {
  const s = input.toLowerCase().replace(/\s/g, '');
  const hourMatch = s.match(/(\d+)\s*h(?:ou?rs?)?/);
  const minMatch = s.match(/(\d+)\s*m(?:in(?:utes?)?)?/);
  let totalMins = 0;
  if (hourMatch) totalMins += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) totalMins += parseInt(minMatch[1], 10);
  if (!hourMatch && !minMatch) {
    const num = parseInt(input.replace(/\D/g, ''), 10);
    if (!isNaN(num)) totalMins = num;
  }
  return totalMins ? `${totalMins}M` : '30M';
}
