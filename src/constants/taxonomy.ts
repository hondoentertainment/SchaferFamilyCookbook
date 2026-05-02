export const RECIPE_CATEGORIES = [
    'Breakfast',
    'Main',
    'Dessert',
    'Side',
    'Appetizer',
    'Bread',
    'Dip/Sauce',
    'Snack',
] as const;

export type RecipeCategory = typeof RECIPE_CATEGORIES[number];

export const CATEGORY_META: Record<RecipeCategory | 'Generic', { label: string; icon: string; browsePriority: number }> = {
    Breakfast: { label: 'Breakfast', icon: 'Breakfast', browsePriority: 3 },
    Main: { label: 'Main', icon: 'Main', browsePriority: 1 },
    Dessert: { label: 'Dessert', icon: 'Dessert', browsePriority: 2 },
    Side: { label: 'Side', icon: 'Side', browsePriority: 4 },
    Appetizer: { label: 'Appetizer', icon: 'Appetizer', browsePriority: 6 },
    Bread: { label: 'Bread', icon: 'Bread', browsePriority: 5 },
    'Dip/Sauce': { label: 'Dip/Sauce', icon: 'Dip/Sauce', browsePriority: 7 },
    Snack: { label: 'Snack', icon: 'Snack', browsePriority: 8 },
    Generic: { label: 'Recipe', icon: 'Recipe', browsePriority: 99 },
};

export const CONTRIBUTOR_ALIASES: Record<string, string> = {
    'dawn schafer tessmer': 'Dawn (Schafer) Tessmer',
    'dawn (schafer) tessmer': 'Dawn (Schafer) Tessmer',
    dawn: 'Dawn (Schafer) Tessmer',
    'jana schafer': 'Jana',
    'robin henderson': 'Robin',
};

export const CONTRIBUTOR_LABELS_AS_TAGS = new Set([
    'family favorite',
    'heritage recipe',
    'regional specialty',
]);

export const TAG_LABELS: Record<string, string> = {
    baking: 'Baking',
    breakfast: 'Breakfast',
    chocolate: 'Chocolate',
    dessert: 'Dessert',
    holiday: 'Holiday',
    'family-favorite': 'Family favorite',
    heritage: 'Heritage',
    regional: 'Regional',
    quick: 'Quick',
    weeknight: 'Weeknight',
    seasonal: 'Seasonal',
};

const CATEGORY_ALIASES: Record<string, RecipeCategory> = {
    breakfast: 'Breakfast',
    brunch: 'Breakfast',
    main: 'Main',
    entree: 'Main',
    entrée: 'Main',
    dinner: 'Main',
    dessert: 'Dessert',
    sweets: 'Dessert',
    side: 'Side',
    sides: 'Side',
    appetizer: 'Appetizer',
    appetiser: 'Appetizer',
    bread: 'Bread',
    dip: 'Dip/Sauce',
    sauce: 'Dip/Sauce',
    'dip/sauce': 'Dip/Sauce',
    snack: 'Snack',
};

export function normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeTag(value: string): string {
    return normalizeKey(value)
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function getTagLabel(tag: string): string {
    const normalized = normalizeTag(tag);
    return TAG_LABELS[normalized] ?? normalized.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeCategory(value?: string): RecipeCategory {
    if (!value) return 'Main';
    return CATEGORY_ALIASES[normalizeKey(value)] ?? 'Main';
}

export function normalizeContributorName(value?: string): string {
    const name = value?.trim() || 'Family';
    const key = normalizeKey(name);
    if (CONTRIBUTOR_LABELS_AS_TAGS.has(key)) return 'Family';
    return CONTRIBUTOR_ALIASES[key] ?? name;
}

export type RecipeFacetInput = {
    title: string;
    contributor: string;
    category: string;
    tags?: string[];
    cookTime?: string;
    prepTime?: string;
    occasions?: string[];
    collections?: string[];
    season?: string;
};

type NormalizableRecipe = RecipeFacetInput;

export function contributorFacetFromRecipe(recipe: Pick<RecipeFacetInput, 'contributor'>): string {
    return normalizeContributorName(recipe.contributor);
}

export function deriveRecipeTags(recipe: Pick<RecipeFacetInput, 'title' | 'category' | 'contributor' | 'tags' | 'cookTime' | 'prepTime'>): string[] {
    const tags = new Set<string>();
    recipe.tags?.forEach((tag) => {
        const normalized = normalizeTag(tag);
        if (normalized) tags.add(normalized);
    });

    const contributorKey = normalizeKey(recipe.contributor);
    if (CONTRIBUTOR_LABELS_AS_TAGS.has(contributorKey)) {
        if (contributorKey === 'family favorite') tags.add('family-favorite');
        if (contributorKey === 'heritage recipe') tags.add('heritage');
        if (contributorKey === 'regional specialty') tags.add('regional');
    }

    const category = normalizeCategory(recipe.category);
    if (category === 'Dessert') tags.add('dessert');
    if (category === 'Breakfast') tags.add('breakfast');
    if (category === 'Bread') tags.add('baking');

    const combinedTime = `${recipe.prepTime ?? ''} ${recipe.cookTime ?? ''}`.toLowerCase();
    if (/\b(10|15|20|25|30)\b/.test(combinedTime)) tags.add('quick');

    return Array.from(tags).sort();
}

export function deriveRecipeOccasions(recipe: Pick<RecipeFacetInput, 'tags' | 'title' | 'category'>): string[] {
    const tags = new Set((recipe.tags ?? []).map(normalizeTag));
    const title = normalizeKey(recipe.title);
    const occasions = new Set<string>();
    if (tags.has('holiday') || /christmas|thanksgiving|easter|festive|cranberry/.test(title)) occasions.add('Holiday');
    if (tags.has('family-favorite')) occasions.add('Family favorite');
    if (recipe.category === 'Dessert') occasions.add('Sweet finish');
    return Array.from(occasions).sort();
}

export function deriveRecipeCollections(recipe: Pick<RecipeFacetInput, 'tags' | 'category' | 'cookTime' | 'prepTime'>): string[] {
    const tags = new Set((recipe.tags ?? []).map(normalizeTag));
    const collections = new Set<string>();
    if (tags.has('family-favorite')) collections.add('Family favorites');
    if (tags.has('heritage')) collections.add('Heritage recipes');
    if (tags.has('quick')) collections.add('Weeknight friendly');
    if (recipe.category === 'Dessert') collections.add('Desserts');
    if (recipe.category === 'Main') collections.add('Main dishes');
    return Array.from(collections).sort();
}

export function deriveRecipeSeason(recipe: Pick<RecipeFacetInput, 'title' | 'tags' | 'category'>): string | undefined {
    const haystack = `${recipe.title} ${(recipe.tags ?? []).join(' ')}`.toLowerCase();
    if (/rhubarb|strawberry|spring|asparagus/.test(haystack)) return 'Spring';
    if (/apple|pumpkin|cranberry|wild rice|hotdish/.test(haystack)) return 'Fall';
    if (/christmas|fudge|holiday|soup|chili/.test(haystack)) return 'Winter';
    if (/salad|dip|caviar|lemonade|berry/.test(haystack)) return 'Summer';
    return undefined;
}

export function normalizeRecipe<T extends NormalizableRecipe>(recipe: T): T & {
    category: RecipeCategory;
    contributor: string;
    tags: string[];
    occasions: string[];
    collections: string[];
    season?: string;
} {
    const normalized = {
        ...recipe,
        category: normalizeCategory(recipe.category),
        contributor: normalizeContributorName(recipe.contributor),
    } as T & {
        category: RecipeCategory;
        contributor: string;
        tags: string[];
        occasions: string[];
        collections: string[];
        season?: string;
    };
    const tags = deriveRecipeTags(normalized);
    normalized.tags = tags;
    normalized.occasions = recipe.occasions?.length ? recipe.occasions : deriveRecipeOccasions({ ...normalized, tags });
    normalized.collections = recipe.collections?.length ? recipe.collections : deriveRecipeCollections({ ...normalized, tags });
    normalized.season = recipe.season ?? deriveRecipeSeason({ ...normalized, tags });
    return normalized;
}

export function normalizeRecipes<T extends NormalizableRecipe>(recipes: T[]): Array<T & {
    category: RecipeCategory;
    contributor: string;
    tags: string[];
    occasions: string[];
    collections: string[];
    season?: string;
}> {
    return recipes.map(normalizeRecipe);
}

export function getContributorOptions(recipes: Array<Pick<RecipeFacetInput, 'contributor'>>): string[] {
    return Array.from(new Set(recipes.map(contributorFacetFromRecipe)))
        .filter((name) => name !== 'Family')
        .sort((a, b) => a.localeCompare(b));
}

export function getTagOptions(recipes: Array<Pick<RecipeFacetInput, 'tags'>>): string[] {
    return Array.from(new Set(recipes.flatMap((recipe) => recipe.tags ?? []).map(normalizeTag)))
        .filter(Boolean)
        .sort((a, b) => getTagLabel(a).localeCompare(getTagLabel(b)));
}
