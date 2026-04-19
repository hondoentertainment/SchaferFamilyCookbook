import type { Recipe } from '../types';

/**
 * Fuzzy recipe search across multiple fields.
 *
 * Matching strategy:
 *   - Normalize both query and fields (lowercase, trim, collapse whitespace,
 *     strip punctuation).
 *   - Tokenize the query by whitespace.
 *   - Require ALL tokens to appear somewhere in the recipe (AND across tokens).
 *     Each token may match in any field.
 *   - Score per recipe = sum over tokens of the weights of each field the
 *     token matches in. Field weights:
 *       title       = 4
 *       ingredients = 2
 *       contributor = 2
 *       notes       = 1
 *       category    = 1
 *   - Empty / whitespace-only query returns the list unchanged (preserves
 *     the existing UX where no search = show all recipes).
 *   - Results sorted by score desc, then title asc.
 */

const PUNCT_REGEX = /[^\p{L}\p{N}\s]/gu;
const WS_REGEX = /\s+/g;

export function normalize(input: string): string {
    if (!input) return '';
    return input
        .toLowerCase()
        .replace(PUNCT_REGEX, ' ')
        .replace(WS_REGEX, ' ')
        .trim();
}

function tokenize(query: string): string[] {
    const n = normalize(query);
    if (!n) return [];
    return n.split(' ').filter(Boolean);
}

interface WeightedField {
    text: string;
    weight: number;
}

function buildFields(recipe: Recipe): WeightedField[] {
    const ingredients = Array.isArray(recipe.ingredients)
        ? recipe.ingredients.join(' ')
        : '';
    return [
        { text: normalize(recipe.title ?? ''), weight: 4 },
        { text: normalize(ingredients), weight: 2 },
        { text: normalize(recipe.contributor ?? ''), weight: 2 },
        { text: normalize(recipe.notes ?? ''), weight: 1 },
        { text: normalize(recipe.category ?? ''), weight: 1 },
    ];
}

/**
 * Score a single recipe against a set of query tokens. Returns 0 when any
 * token is missing from every field (AND semantics).
 */
function scoreRecipe(fields: WeightedField[], tokens: string[]): number {
    let total = 0;
    for (const token of tokens) {
        let tokenScore = 0;
        for (const field of fields) {
            if (field.text && field.text.includes(token)) {
                tokenScore += field.weight;
            }
        }
        if (tokenScore === 0) return 0; // AND: every token must match somewhere
        total += tokenScore;
    }
    return total;
}

export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) {
        // Empty / whitespace-only query: preserve existing UX of showing all.
        return recipes.slice();
    }

    const scored: Array<{ recipe: Recipe; score: number }> = [];
    for (const recipe of recipes) {
        const fields = buildFields(recipe);
        const score = scoreRecipe(fields, tokens);
        if (score > 0) {
            scored.push({ recipe, score });
        }
    }

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.recipe.title.localeCompare(b.recipe.title);
    });

    return scored.map(entry => entry.recipe);
}
