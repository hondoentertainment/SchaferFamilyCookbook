// Filter recipes to identify placeholder images
import { readFileSync } from 'fs';

const recipes = JSON.parse(readFileSync('src/data/recipes.json', 'utf-8'));

// Define placeholder patterns to filter for
const placeholderPatterns = [
  /image\.pollinations\.ai/i,
  /unsplash.*(Breakfast|Main|Dessert|Side|Appetizer|Bread|Dip\/Sauce|Snack)/i
];

// Filter recipes that have placeholder images (not already in /recipe-images/)
const placeholderRecipes = recipes.filter(recipe => {
  const image = recipe.image || '';
  
  // Skip if image is already in /recipe-images/ (real images)
  if (image.includes('/recipe-images/')) {
    return false;
  }
  
  // Check if image matches any placeholder pattern
  return placeholderPatterns.some(pattern => pattern.test(image));
});

console.log(`Found ${placeholderRecipes.length} placeholder images that need replacement:`);
console.log('='.repeat(70));

placeholderRecipes.forEach((recipe, index) => {
  console.log(`${String(index + 1).padStart(2)}. ${recipe.id} - ${recipe.title}`);
  console.log(`    Current image: ${recipe.image}`);
  console.log(`    Category: ${recipe.category}`);
  console.log('');
});

console.log(`\nTotal recipes found: ${placeholderRecipes.length}`);

// Save the filtered list for the next step
const recipeIds = placeholderRecipes.map(recipe => recipe.id);
console.log(`\nRecipe IDs for bulk replacement: ${recipeIds.join(', ')}`);