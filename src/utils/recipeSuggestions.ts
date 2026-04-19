import { Recipe } from '../types';

/**
 * Keywords associated with each recipe category. Used to score candidates by
 * how well their title matches a category's semantic neighbourhood — a mild
 * signal that helps surface thematically related recipes across categories.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    Breakfast: ['egg', 'pancake', 'waffle', 'oat', 'bacon', 'toast', 'muffin', 'cereal', 'granola', 'omelet', 'omelette', 'yogurt'],
    Main: ['chicken', 'beef', 'pork', 'fish', 'pasta', 'rice', 'stew', 'roast', 'casserole', 'steak', 'turkey', 'lasagna'],
    Dessert: ['cake', 'cookie', 'pie', 'brownie', 'ice cream', 'pudding', 'chocolate', 'vanilla', 'tart', 'frosting', 'sweet', 'sugar'],
    Side: ['salad', 'potato', 'rice', 'vegetable', 'beans', 'slaw', 'greens', 'corn', 'roasted'],
    Appetizer: ['dip', 'bite', 'cheese', 'crostini', 'bruschetta', 'skewer', 'wing', 'deviled', 'stuffed'],
    Bread: ['bread', 'roll', 'bun', 'loaf', 'biscuit', 'scone', 'dough', 'sourdough', 'cornbread'],
    'Dip/Sauce': ['dip', 'sauce', 'salsa', 'gravy', 'dressing', 'spread', 'chutney', 'aioli'],
    Snack: ['popcorn', 'chip', 'cracker', 'trail', 'nut', 'bar', 'mix', 'bite'],
};

/**
 * Compute a relevance score between the current recipe and a candidate.
 * Scoring formula:
 *   +3  same category
 *   +2  same contributor
 *   +1  per category-keyword overlap between candidate title and current
 *       recipe's category keywords (capped at 2, so max +2 from this bucket)
 */
export const scoreRecipe = (current: Recipe, candidate: Recipe): number => {
    let score = 0;
    if (candidate.category === current.category) score += 3;
    if (candidate.contributor === current.contributor) score += 2;

    const keywords = CATEGORY_KEYWORDS[current.category] ?? [];
    if (keywords.length > 0) {
        const title = candidate.title.toLowerCase();
        let overlap = 0;
        for (const kw of keywords) {
            if (title.includes(kw)) {
                overlap += 1;
                if (overlap >= 2) break;
            }
        }
        score += overlap;
    }

    return score;
};

/**
 * Return up to `limit` recipes from `all` that are most likely to interest
 * someone viewing `current`. Pure function; no React or DOM access. Excludes
 * `current` itself. Ties break alphabetically by title for determinism.
 */
export const getSuggestions = (current: Recipe, all: Recipe[], limit = 3): Recipe[] => {
    if (!current || !Array.isArray(all) || all.length === 0) return [];
    const candidates = all.filter((r) => r && r.id !== current.id);
    const scored = candidates.map((r) => ({ recipe: r, score: scoreRecipe(current, r) }));
    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.recipe.title.localeCompare(b.recipe.title);
    });
    return scored.slice(0, Math.max(0, limit)).map((s) => s.recipe);
};
