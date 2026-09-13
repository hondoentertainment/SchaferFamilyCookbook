import { describe, it, expect } from 'vitest';
import type { ContributorProfile, GalleryItem, Recipe } from '../types';
import type { GroceryItem } from './groceryList';
import { rankRecipeIds, searchCookbook, searchKindLabel } from './siteSearch';

const cinnamonRolls: Recipe = {
    id: 'cinnamon-rolls',
    title: 'Cinnamon Rolls',
    contributor: 'Harriet',
    category: 'Dessert',
    ingredients: ['flour', 'yeast', 'cinnamon', 'sugar'],
    instructions: ['Roll the dough', 'Bake'],
    notes: 'Christmas morning tradition',
    image: '',
};

const chickenSoup: Recipe = {
    id: 'chicken-soup',
    title: 'Grandma Chicken Soup',
    contributor: 'Julie',
    category: 'Main',
    ingredients: ['chicken', 'carrot', 'celery', 'cinnamon stick'],
    instructions: ['Simmer'],
    notes: 'Use the good stock',
    image: '',
};

const applePie: Recipe = {
    id: 'apple-pie',
    title: 'Apple Pie',
    contributor: 'Harriet',
    category: 'Dessert',
    ingredients: ['apples', 'sugar', 'butter'],
    instructions: ['Bake the pie'],
    image: '',
    tags: ['holiday'],
};

const harriet: ContributorProfile = {
    id: 'c-harriet',
    name: 'Harriet',
    avatar: '',
    role: 'user',
};

const julie: ContributorProfile = {
    id: 'c-julie',
    name: 'Julie',
    avatar: '',
    role: 'user',
};

const groceryFlour: GroceryItem = {
    id: 'g-flour',
    text: '2 cups flour',
    recipeTitle: 'Cinnamon Rolls',
    recipeId: 'cinnamon-rolls',
    checked: false,
    addedAt: 1,
};

const galleryHarvest: GalleryItem = {
    id: 'gal-1',
    type: 'image',
    url: '/photo.jpg',
    caption: 'Harvest supper at the farm',
    contributor: 'Julie',
};

const stories = [
    {
        id: 'oehler',
        heading: 'The Oehler Family',
        body: 'Oyster stew was a special Christmas meal in Harriet’s childhood.',
    },
];

function search(query: string) {
    return searchCookbook({
        query,
        recipes: [cinnamonRolls, chickenSoup, applePie],
        contributors: [harriet, julie],
        gallery: [galleryHarvest],
        groceryItems: [groceryFlour],
        stories,
        notesByRecipeId: { 'apple-pie': 'Add extra nutmeg for Thanksgiving' },
    });
}

describe('searchCookbook ranking', () => {
    it('ranks an exact title above a fuzzy ingredient match', () => {
        const { recipeHits } = search('cinnamon');
        expect(recipeHits.map((hit) => hit.recipeId)).toEqual(['cinnamon-rolls', 'chicken-soup']);
        expect(recipeHits[0].matchField).toBe('title');
        expect(recipeHits[0].score).toBeGreaterThan(recipeHits[1].score);
        expect(recipeHits[1].matchField).toBe('ingredient');
    });

    it('matches contributor, category, tags, notes, and family notes', () => {
        expect(search('harriet').recipeHits.map((hit) => hit.recipeId)).toEqual([
            'apple-pie',
            'cinnamon-rolls',
        ]);
        expect(search('soup').recipeHits[0].recipeId).toBe('chicken-soup');
        expect(search('holiday').recipeHits[0].recipeId).toBe('apple-pie');
        expect(search('christmas morning').recipeHits[0].recipeId).toBe('cinnamon-rolls');
        expect(search('nutmeg').recipeHits[0].recipeId).toBe('apple-pie');
    });

    it('includes people, grocery items, gallery captions, and stories', () => {
        const julieHits = search('julie').hits;
        expect(julieHits.some((hit) => hit.kind === 'person' && hit.contributorName === 'Julie')).toBe(true);

        const flour = search('flour').hits.find((hit) => hit.kind === 'grocery');
        expect(flour?.groceryItemId).toBe('g-flour');

        const harvest = search('harvest').hits.find((hit) => hit.kind === 'gallery');
        expect(harvest?.galleryId).toBe('gal-1');

        const oyster = search('oyster stew').hits.find((hit) => hit.kind === 'story');
        expect(oyster?.storySectionId).toBe('oehler');
    });

    it('returns nothing for an empty or unrelated query', () => {
        expect(search('   ').hits).toEqual([]);
        expect(search('lasagna').hits).toEqual([]);
    });

    it('tolerates a small title typo without beating an exact title', () => {
        const { recipeHits } = search('cinnamn');
        expect(recipeHits[0].recipeId).toBe('cinnamon-rolls');
        expect(search('Cinnamon Rolls').recipeHits[0].score).toBeGreaterThan(recipeHits[0].score);
    });
});

describe('rankRecipeIds', () => {
    it('returns ranked recipe ids for a query', () => {
        expect(rankRecipeIds([chickenSoup, cinnamonRolls], 'cinnamon')).toEqual([
            'cinnamon-rolls',
            'chicken-soup',
        ]);
    });

    it('returns all ids when the query is empty', () => {
        expect(rankRecipeIds([applePie, cinnamonRolls], '  ')).toEqual(['apple-pie', 'cinnamon-rolls']);
    });
});

describe('searchKindLabel', () => {
    it('labels each result kind', () => {
        expect(searchKindLabel('recipe')).toBe('Recipe');
        expect(searchKindLabel('person')).toBe('Person');
        expect(searchKindLabel('grocery')).toBe('Grocery');
        expect(searchKindLabel('gallery')).toBe('Gallery');
        expect(searchKindLabel('story')).toBe('Story');
    });
});
