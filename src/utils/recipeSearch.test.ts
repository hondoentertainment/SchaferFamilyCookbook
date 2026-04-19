import { describe, it, expect } from 'vitest';
import { searchRecipes, normalize } from './recipeSearch';
import type { Recipe } from '../types';

function makeRecipe(overrides: Partial<Recipe>): Recipe {
    return {
        id: overrides.id ?? 'id',
        title: overrides.title ?? 'Untitled',
        contributor: overrides.contributor ?? 'Anonymous',
        category: overrides.category ?? 'Main',
        ingredients: overrides.ingredients ?? [],
        instructions: overrides.instructions ?? [],
        notes: overrides.notes,
        image: overrides.image ?? '',
        ...overrides,
    };
}

describe('normalize', () => {
    it('lowercases, trims, collapses whitespace, strips punctuation', () => {
        expect(normalize("  Grandma's   Apple-Pie!!  ")).toBe('grandma s apple pie');
    });
    it('returns empty string for empty input', () => {
        expect(normalize('')).toBe('');
        expect(normalize('   ')).toBe('');
    });
});

describe('searchRecipes', () => {
    const apple = makeRecipe({
        id: '1',
        title: 'Apple Pie',
        contributor: 'Grandma',
        category: 'Dessert',
        ingredients: ['apples', 'sugar', 'cinnamon', 'butter'],
        notes: 'Best served warm with vanilla ice cream.',
    });
    const banana = makeRecipe({
        id: '2',
        title: 'Banana Bread',
        contributor: 'Alice',
        category: 'Bread',
        ingredients: ['bananas', 'flour', 'sugar', 'walnuts'],
        notes: 'A family favorite for breakfast.',
    });
    const chili = makeRecipe({
        id: '3',
        title: 'Three-Alarm Chili',
        contributor: 'Bob',
        category: 'Main',
        ingredients: ['ground beef', 'tomatoes', 'kidney beans', 'chili powder'],
        notes: 'Spicy! Adjust the chili powder to taste.',
    });
    const simple = makeRecipe({
        id: '4',
        title: 'Simple Sugar Cookies',
        contributor: 'Grandma',
        category: 'Dessert',
        ingredients: ['flour', 'sugar', 'butter', 'egg'],
    });

    const recipes = [apple, banana, chili, simple];

    it('matches by title', () => {
        const results = searchRecipes(recipes, 'apple');
        expect(results.map(r => r.id)).toEqual(['1']);
    });

    it('matches by ingredient', () => {
        const results = searchRecipes(recipes, 'walnuts');
        expect(results.map(r => r.id)).toEqual(['2']);
    });

    it('matches by contributor', () => {
        const results = searchRecipes(recipes, 'alice');
        expect(results.map(r => r.id)).toEqual(['2']);
    });

    it('matches by notes', () => {
        const results = searchRecipes(recipes, 'spicy');
        expect(results.map(r => r.id)).toEqual(['3']);
    });

    it('matches by category', () => {
        const results = searchRecipes(recipes, 'bread');
        // Banana Bread matches via title AND category; no other bread matches.
        expect(results.map(r => r.id)).toEqual(['2']);
    });

    it('requires ALL tokens to appear (AND across tokens)', () => {
        // "sugar grandma" should match apple pie (sugar in ingredients,
        // grandma in contributor) and simple sugar cookies (sugar in title
        // and ingredients, grandma in contributor). Banana has sugar but not
        // grandma, so it should be excluded.
        const results = searchRecipes(recipes, 'sugar grandma');
        const ids = results.map(r => r.id).sort();
        expect(ids).toEqual(['1', '4']);
    });

    it('token can match anywhere in any field', () => {
        // "beef tomatoes" appears in chili's ingredients (different entries)
        const results = searchRecipes(recipes, 'beef tomatoes');
        expect(results.map(r => r.id)).toEqual(['3']);
    });

    it('excludes recipes when any token is missing', () => {
        const results = searchRecipes(recipes, 'apple banana');
        expect(results).toEqual([]);
    });

    it('normalizes punctuation and whitespace in the query', () => {
        // "three-alarm!!" should still match "Three-Alarm Chili"
        const results = searchRecipes(recipes, '  three-alarm!!  ');
        expect(results.map(r => r.id)).toEqual(['3']);
    });

    it('normalizes punctuation in haystack fields', () => {
        // Query "three alarm" (no hyphen) matches "Three-Alarm" title.
        const results = searchRecipes(recipes, 'three alarm');
        expect(results.map(r => r.id)).toEqual(['3']);
    });

    it('returns all recipes for an empty query', () => {
        const results = searchRecipes(recipes, '');
        expect(results).toHaveLength(recipes.length);
    });

    it('returns all recipes for a whitespace-only query', () => {
        const results = searchRecipes(recipes, '    ');
        expect(results).toHaveLength(recipes.length);
    });

    it('sorts by score desc, tie-break by title asc', () => {
        // "sugar" appears:
        //   apple (ingredients only)           -> score 2
        //   banana (ingredients only)          -> score 2
        //   simple sugar cookies (title + ing) -> score 4+2 = 6
        // Top should be simple; then apple, banana tied -> alphabetical.
        const results = searchRecipes(recipes, 'sugar');
        expect(results.map(r => r.id)).toEqual(['4', '1', '2']);
    });

    it('weights title matches higher than notes matches', () => {
        const titleHit = makeRecipe({
            id: 'a',
            title: 'Chocolate Dream',
            ingredients: [],
            notes: '',
        });
        const notesHit = makeRecipe({
            id: 'b',
            title: 'Vanilla Cake',
            ingredients: [],
            notes: 'Pairs well with chocolate sauce.',
        });
        const results = searchRecipes([notesHit, titleHit], 'chocolate');
        expect(results.map(r => r.id)).toEqual(['a', 'b']);
    });

    it('returns empty array when nothing matches', () => {
        expect(searchRecipes(recipes, 'zzznotathing')).toEqual([]);
    });
});
