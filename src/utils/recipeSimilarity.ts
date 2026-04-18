import { Recipe } from '../types';

const MIN_WORD_LENGTH = 4;

/** Tokenize a string into lowercase words >= MIN_WORD_LENGTH chars. */
const tokenize = (input: string): string[] =>
    input
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= MIN_WORD_LENGTH);

/** Build a Set of normalized ingredient word tokens for a recipe. */
const ingredientWordSet = (recipe: Recipe): Set<string> => {
    const set = new Set<string>();
    for (const ing of recipe.ingredients ?? []) {
        for (const token of tokenize(ing)) {
            set.add(token);
        }
    }
    return set;
};

/** Compare titles case-insensitively for stable secondary ordering. */
const compareByTitle = (a: Recipe, b: Recipe): number =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

/**
 * Compute a similarity score for `candidate` relative to `current`.
 *  +3 same category
 *  +2 same contributor
 *  +1 if any ingredient word (>= 4 chars, case-insensitive) overlaps
 */
export const scoreRecipe = (current: Recipe, candidate: Recipe): number => {
    let score = 0;
    if (candidate.category === current.category) score += 3;
    if (candidate.contributor === current.contributor) score += 2;

    const currentWords = ingredientWordSet(current);
    if (currentWords.size > 0) {
        const candidateWords = ingredientWordSet(candidate);
        for (const word of candidateWords) {
            if (currentWords.has(word)) {
                score += 1;
                break;
            }
        }
    }
    return score;
};

/**
 * Returns up to `limit` related recipes, excluding the current one.
 * Sorted by descending score, ties broken by ascending title.
 * If fewer than `limit` candidates score > 0, the remainder is topped up
 * with the next recipes (sorted by title) for deterministic variety.
 */
export const getRelatedRecipes = (
    current: Recipe,
    all: Recipe[],
    limit = 3,
): Recipe[] => {
    if (!current || !Array.isArray(all) || limit <= 0) return [];

    const candidates = all.filter((r) => r && r.id !== current.id);

    const scored = candidates
        .map((recipe) => ({ recipe, score: scoreRecipe(current, recipe) }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return compareByTitle(a.recipe, b.recipe);
        });

    const positives = scored.filter((s) => s.score > 0).map((s) => s.recipe);

    if (positives.length >= limit) return positives.slice(0, limit);

    const chosenIds = new Set(positives.map((r) => r.id));
    const fillers = candidates
        .filter((r) => !chosenIds.has(r.id))
        .sort(compareByTitle);

    const result = [...positives];
    for (const filler of fillers) {
        if (result.length >= limit) break;
        if (!chosenIds.has(filler.id)) {
            result.push(filler);
            chosenIds.add(filler.id);
        }
    }

    return result.slice(0, limit);
};
