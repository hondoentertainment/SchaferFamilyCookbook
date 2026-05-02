import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const recipesPath = path.join(root, 'src', 'data', 'recipes.json');

const contributorAliases = new Map([
  ['dawn schafer tessmer', 'Dawn (Schafer) Tessmer'],
  ['dawn (schafer) tessmer', 'Dawn (Schafer) Tessmer'],
  ['dawn', 'Dawn (Schafer) Tessmer'],
  ['jana schafer', 'Jana'],
  ['robin henderson', 'Robin'],
]);

const contributorLabelsAsTags = new Map([
  ['family favorite', 'family-favorite'],
  ['heritage recipe', 'heritage'],
  ['regional specialty', 'regional'],
]);

const categoryAliases = new Map([
  ['breakfast', 'Breakfast'],
  ['brunch', 'Breakfast'],
  ['main', 'Main'],
  ['entree', 'Main'],
  ['entrée', 'Main'],
  ['dinner', 'Main'],
  ['dessert', 'Dessert'],
  ['side', 'Side'],
  ['sides', 'Side'],
  ['appetizer', 'Appetizer'],
  ['appetiser', 'Appetizer'],
  ['bread', 'Bread'],
  ['dip', 'Dip/Sauce'],
  ['sauce', 'Dip/Sauce'],
  ['dip/sauce', 'Dip/Sauce'],
  ['snack', 'Snack'],
]);

const normalizeKey = (value = '') => String(value).trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeTag = (value = '') =>
  normalizeKey(value)
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function normalizeCategory(value) {
  return categoryAliases.get(normalizeKey(value)) || 'Main';
}

function normalizeContributor(value) {
  const key = normalizeKey(value || 'Family');
  if (contributorLabelsAsTags.has(key)) return 'Family';
  return contributorAliases.get(key) || String(value || 'Family').trim();
}

function deriveTags(recipe) {
  const tags = new Set((recipe.tags || []).map(normalizeTag).filter(Boolean));
  const contributorTag = contributorLabelsAsTags.get(normalizeKey(recipe.contributor));
  if (contributorTag) tags.add(contributorTag);
  if (recipe.category === 'Dessert') tags.add('dessert');
  if (recipe.category === 'Breakfast') tags.add('breakfast');
  if (recipe.category === 'Bread') tags.add('baking');
  const combinedTime = `${recipe.prepTime || ''} ${recipe.cookTime || ''}`.toLowerCase();
  if (/\b(10|15|20|25|30)\b/.test(combinedTime)) tags.add('quick');
  return Array.from(tags).sort();
}

function deriveOccasions(recipe) {
  const tags = new Set(recipe.tags || []);
  const title = normalizeKey(recipe.title);
  const occasions = new Set();
  if (tags.has('holiday') || /christmas|thanksgiving|easter|festive|cranberry/.test(title)) occasions.add('Holiday');
  if (tags.has('family-favorite')) occasions.add('Family favorite');
  if (recipe.category === 'Dessert') occasions.add('Sweet finish');
  return Array.from(occasions).sort();
}

function deriveCollections(recipe) {
  const tags = new Set(recipe.tags || []);
  const collections = new Set();
  if (tags.has('family-favorite')) collections.add('Family favorites');
  if (tags.has('heritage')) collections.add('Heritage recipes');
  if (tags.has('quick')) collections.add('Weeknight friendly');
  if (recipe.category === 'Dessert') collections.add('Desserts');
  if (recipe.category === 'Main') collections.add('Main dishes');
  return Array.from(collections).sort();
}

function deriveSeason(recipe) {
  const haystack = `${recipe.title} ${(recipe.tags || []).join(' ')}`.toLowerCase();
  if (/rhubarb|strawberry|spring|asparagus/.test(haystack)) return 'Spring';
  if (/apple|pumpkin|cranberry|wild rice|hotdish/.test(haystack)) return 'Fall';
  if (/christmas|fudge|holiday|soup|chili/.test(haystack)) return 'Winter';
  if (/salad|dip|caviar|lemonade|berry/.test(haystack)) return 'Summer';
  return undefined;
}

function normalizeRecipe(recipe) {
  const normalized = {
    ...recipe,
    category: normalizeCategory(recipe.category),
    contributor: normalizeContributor(recipe.contributor),
  };
  normalized.tags = deriveTags(normalized);
  normalized.occasions = normalized.occasions?.length ? normalized.occasions : deriveOccasions(normalized);
  normalized.collections = normalized.collections?.length ? normalized.collections : deriveCollections(normalized);
  const season = normalized.season || deriveSeason(normalized);
  if (season) normalized.season = season;
  else delete normalized.season;
  return normalized;
}

const recipes = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));
const normalized = recipes.map(normalizeRecipe);
fs.writeFileSync(recipesPath, `${JSON.stringify(normalized, null, 2)}\n`);

const contributors = new Set(normalized.map((recipe) => recipe.contributor));
const tags = new Set(normalized.flatMap((recipe) => recipe.tags || []));

console.log(`Normalized ${normalized.length} recipes.`);
console.log(`Contributors: ${Array.from(contributors).sort().join(', ')}`);
console.log(`Tags: ${Array.from(tags).sort().join(', ')}`);
