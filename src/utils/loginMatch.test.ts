import { describe, it, expect } from 'vitest';
import {
    resolveLoginAffiliation,
    findLoginNameSuggestions,
    recipesForContributor,
    formatAffiliationSummary,
} from './loginMatch';
import type { ContributorProfile, Recipe } from '../types';

const contributors: ContributorProfile[] = [
    { id: '1', name: 'Wren', avatar: '/wren.png', role: 'user' },
    { id: '2', name: 'Dawn', avatar: '/dawn.png', role: 'user' },
    { id: '3', name: 'Joan', avatar: '/joan.png', role: 'user' },
];

const recipes: Recipe[] = [
    {
        id: 'r1',
        title: 'Pie',
        contributor: 'Wren',
        category: 'Dessert',
        ingredients: [],
        instructions: [],
        image: '',
    },
    {
        id: 'r2',
        title: 'Bread',
        contributor: 'Wren Feyereisen',
        category: 'Bread',
        ingredients: [],
        instructions: [],
        image: '',
    },
    {
        id: 'r3',
        title: 'Soup',
        contributor: 'Joan',
        category: 'Main',
        ingredients: [],
        instructions: [],
        image: '',
    },
];

describe('loginMatch', () => {
    it('resolves alias names to canonical contributor', () => {
        const affiliation = resolveLoginAffiliation('wren feyereisen', contributors, recipes, [], []);
        expect(affiliation.canonicalName).toBe('Wren');
        expect(affiliation.matchType).toBe('alias');
        expect(affiliation.recipeCount).toBe(2);
    });

    it('matches exact contributor names', () => {
        const affiliation = resolveLoginAffiliation('Joan', contributors, recipes, [], []);
        expect(affiliation.matchType).toBe('exact');
        expect(affiliation.recipeCount).toBe(1);
    });

    it('returns none for unknown names with no archive presence', () => {
        const affiliation = resolveLoginAffiliation('New Person', contributors, recipes, [], []);
        expect(affiliation.matchType).toBe('none');
        expect(affiliation.canonicalName).toBe('New Person');
    });

    it('suggests contributors by partial first name', () => {
        const suggestions = findLoginNameSuggestions('wre', contributors, recipes, [], []);
        expect(suggestions[0]?.name).toBe('Wren');
    });

    it('aggregates recipes across aliases', () => {
        expect(recipesForContributor('Wren', recipes)).toHaveLength(2);
    });

    it('formats affiliation summary', () => {
        expect(formatAffiliationSummary({ recipeCount: 2, galleryCount: 1, triviaCount: 0 })).toBe(
            '2 recipes · 1 photo'
        );
    });
});
