/**
 * Sitewide cookbook search: recipes, people, grocery items, gallery, and stories.
 *
 * Ranking is field-aware so an exact dish title beats a fuzzy ingredient hit.
 * Matching still uses the existing typo-tolerant `fuzzyMatch` helper.
 */

import type { ContributorProfile, GalleryItem, Recipe } from '../types';
import type { FamilyStorySearchEntry } from '../data/familyStorySearch';
import type { GroceryItem } from './groceryList';
import { fuzzyMatch, normalizeText } from './fuzzySearch';

export type SearchHitKind = 'recipe' | 'person' | 'grocery' | 'gallery' | 'story';

export type SearchMatchField =
    | 'title'
    | 'ingredient'
    | 'contributor'
    | 'category'
    | 'notes'
    | 'tag'
    | 'caption'
    | 'story'
    | 'grocery';

export interface SearchHit {
    id: string;
    kind: SearchHitKind;
    title: string;
    subtitle: string;
    score: number;
    matchField: SearchMatchField;
    recipeId?: string;
    groceryItemId?: string;
    galleryId?: string;
    storySectionId?: string;
    contributorName?: string;
}

export interface SiteSearchInput {
    query: string;
    recipes: Recipe[];
    contributors: ContributorProfile[];
    gallery: GalleryItem[];
    groceryItems: GroceryItem[];
    stories: FamilyStorySearchEntry[];
    /** Optional family notes keyed by recipe id */
    notesByRecipeId?: Record<string, string>;
}

export interface SiteSearchResult {
    hits: SearchHit[];
    recipeHits: SearchHit[];
}

const KIND_LABEL: Record<SearchHitKind, string> = {
    recipe: 'Recipe',
    person: 'Person',
    grocery: 'Grocery',
    gallery: 'Gallery',
    story: 'Story',
};

export function searchKindLabel(kind: SearchHitKind): string {
    return KIND_LABEL[kind];
}

interface FieldScore {
    score: number;
    matchField: SearchMatchField;
}

function compareNormalized(field: string, query: string): {
    exact: boolean;
    prefix: boolean;
    contains: boolean;
    fuzzy: boolean;
} {
    const hay = normalizeText(field);
    const q = normalizeText(query);
    if (!q) {
        return { exact: true, prefix: true, contains: true, fuzzy: true };
    }
    if (!hay) {
        return { exact: false, prefix: false, contains: false, fuzzy: false };
    }
    return {
        exact: hay === q,
        prefix: hay.startsWith(q),
        contains: hay.includes(q),
        fuzzy: fuzzyMatch(hay, q),
    };
}

function scoreField(
    field: string | undefined | null,
    query: string,
    matchField: SearchMatchField,
    weights: { exact: number; prefix: number; contains: number; fuzzy: number },
): FieldScore | null {
    if (!field) return null;
    const match = compareNormalized(field, query);
    if (match.exact) return { score: weights.exact, matchField };
    if (match.prefix) return { score: weights.prefix, matchField };
    if (match.contains) return { score: weights.contains, matchField };
    if (match.fuzzy) return { score: weights.fuzzy, matchField };
    return null;
}

function bestScore(candidates: Array<FieldScore | null>): FieldScore | null {
    let best: FieldScore | null = null;
    for (const candidate of candidates) {
        if (!candidate) continue;
        if (!best || candidate.score > best.score) best = candidate;
    }
    return best;
}

function recipeHit(
    recipe: Recipe,
    query: string,
    notesByRecipeId?: Record<string, string>,
): SearchHit | null {
    const familyNotes = notesByRecipeId?.[recipe.id] ?? '';
    const tags = (recipe.tags ?? []).join(' ');
    const extras = [recipe.occasions?.join(' '), recipe.season].filter(Boolean).join(' ');
    const scored = bestScore([
        scoreField(recipe.title, query, 'title', { exact: 100, prefix: 92, contains: 84, fuzzy: 72 }),
        scoreField(recipe.contributor, query, 'contributor', { exact: 68, prefix: 60, contains: 54, fuzzy: 48 }),
        scoreField(recipe.category, query, 'category', { exact: 62, prefix: 54, contains: 50, fuzzy: 40 }),
        scoreField(tags, query, 'tag', { exact: 58, prefix: 52, contains: 48, fuzzy: 36 }),
        scoreField(extras, query, 'tag', { exact: 56, prefix: 50, contains: 46, fuzzy: 34 }),
        scoreField(recipe.ingredients.join(' '), query, 'ingredient', { exact: 52, prefix: 48, contains: 46, fuzzy: 32 }),
        scoreField(recipe.notes, query, 'notes', { exact: 44, prefix: 40, contains: 36, fuzzy: 24 }),
        scoreField(familyNotes, query, 'notes', { exact: 42, prefix: 38, contains: 34, fuzzy: 22 }),
        scoreField(recipe.instructions.join(' '), query, 'notes', { exact: 38, prefix: 34, contains: 30, fuzzy: 20 }),
    ]);
    if (!scored) return null;
    const matchHint =
        scored.matchField === 'ingredient'
            ? 'Ingredient match'
            : scored.matchField === 'contributor'
                ? `By ${recipe.contributor}`
                : scored.matchField === 'category'
                    ? recipe.category
                    : scored.matchField === 'notes'
                        ? 'Notes & story'
                        : scored.matchField === 'tag'
                            ? 'Tag or season'
                            : recipe.category;
    return {
        id: `recipe:${recipe.id}`,
        kind: 'recipe',
        title: recipe.title,
        subtitle: `${matchHint} · ${recipe.contributor}`,
        score: scored.score,
        matchField: scored.matchField,
        recipeId: recipe.id,
        contributorName: recipe.contributor,
    };
}

function personHit(person: ContributorProfile, query: string, recipeCount: number): SearchHit | null {
    const scored = scoreField(person.name, query, 'contributor', {
        exact: 88,
        prefix: 78,
        contains: 64,
        fuzzy: 50,
    });
    if (!scored) return null;
    return {
        id: `person:${person.id || person.name}`,
        kind: 'person',
        title: person.name,
        subtitle: recipeCount === 1 ? '1 recipe in the archive' : `${recipeCount} recipes in the archive`,
        score: scored.score,
        matchField: 'contributor',
        contributorName: person.name,
    };
}

function groceryHit(item: GroceryItem, query: string): SearchHit | null {
    const scored = bestScore([
        scoreField(item.text, query, 'grocery', { exact: 74, prefix: 62, contains: 52, fuzzy: 34 }),
        scoreField(item.recipeTitle, query, 'grocery', { exact: 48, prefix: 42, contains: 40, fuzzy: 28 }),
    ]);
    if (!scored) return null;
    return {
        id: `grocery:${item.id}`,
        kind: 'grocery',
        title: item.text,
        subtitle: item.recipeTitle ? `On the list · ${item.recipeTitle}` : 'On your grocery list',
        score: scored.score,
        matchField: 'grocery',
        groceryItemId: item.id,
        recipeId: item.recipeId,
    };
}

function galleryHit(item: GalleryItem, query: string): SearchHit | null {
    const scored = bestScore([
        scoreField(item.caption, query, 'caption', { exact: 66, prefix: 56, contains: 50, fuzzy: 36 }),
        scoreField(item.contributor, query, 'contributor', { exact: 46, prefix: 40, contains: 36, fuzzy: 28 }),
    ]);
    if (!scored) return null;
    return {
        id: `gallery:${item.id}`,
        kind: 'gallery',
        title: item.caption?.trim() || 'Family photo',
        subtitle: `Gallery · ${item.contributor}`,
        score: scored.score,
        matchField: scored.matchField === 'contributor' ? 'contributor' : 'caption',
        galleryId: item.id,
        contributorName: item.contributor,
    };
}

function storyHit(entry: FamilyStorySearchEntry, query: string): SearchHit | null {
    const scored = bestScore([
        scoreField(entry.heading, query, 'story', { exact: 70, prefix: 60, contains: 52, fuzzy: 40 }),
        scoreField(entry.body, query, 'story', { exact: 46, prefix: 40, contains: 38, fuzzy: 26 }),
    ]);
    if (!scored) return null;
    return {
        id: `story:${entry.id}`,
        kind: 'story',
        title: entry.heading,
        subtitle: 'Family Story',
        score: scored.score,
        matchField: 'story',
        storySectionId: entry.id,
    };
}

function sortHits(a: SearchHit, b: SearchHit): number {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
}

const MIXED_LIMIT = 16;

/**
 * Ranked sitewide search. `recipeHits` is the full ranked recipe list for the
 * Recipes grid; `hits` is the mixed dropdown (recipes + people + groceries +
 * gallery + stories).
 */
export function searchCookbook(input: SiteSearchInput): SiteSearchResult {
    const query = input.query.trim();
    if (!query) {
        return { hits: [], recipeHits: [] };
    }

    const recipeCountByName = new Map<string, number>();
    for (const recipe of input.recipes) {
        const key = normalizeText(recipe.contributor);
        recipeCountByName.set(key, (recipeCountByName.get(key) ?? 0) + 1);
    }

    const recipeHits = input.recipes
        .map((recipe) => recipeHit(recipe, query, input.notesByRecipeId))
        .filter((hit): hit is SearchHit => !!hit)
        .sort(sortHits);

    const peopleHits = input.contributors
        .map((person) => personHit(person, query, recipeCountByName.get(normalizeText(person.name)) ?? 0))
        .filter((hit): hit is SearchHit => !!hit);

    const groceryHits = input.groceryItems
        .map((item) => groceryHit(item, query))
        .filter((hit): hit is SearchHit => !!hit);

    const galleryHits = input.gallery
        .map((item) => galleryHit(item, query))
        .filter((hit): hit is SearchHit => !!hit);

    const storyHits = input.stories
        .map((entry) => storyHit(entry, query))
        .filter((hit): hit is SearchHit => !!hit);

    const mixed = [...recipeHits, ...peopleHits, ...groceryHits, ...galleryHits, ...storyHits].sort(sortHits);

    return {
        recipeHits,
        hits: mixed.slice(0, MIXED_LIMIT),
    };
}

/** Recipe ids that match the query, in ranked order. Empty query → all recipes unsorted. */
export function rankRecipeIds(recipes: Recipe[], query: string, notesByRecipeId?: Record<string, string>): string[] {
    const q = query.trim();
    if (!q) return recipes.map((recipe) => recipe.id);
    return searchCookbook({
        query: q,
        recipes,
        contributors: [],
        gallery: [],
        groceryItems: [],
        stories: [],
        notesByRecipeId,
    }).recipeHits.map((hit) => hit.recipeId!).filter(Boolean);
}
