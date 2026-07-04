import { describe, it, expect } from 'vitest';
import {
    PRIMARY_NAV_TABS,
    FAMILY_SECONDARY_NAV,
    RECIPES_SECONDARY_NAV,
    BOTTOM_NAV_TABS,
    getSecondaryNavForTab,
    isNavGroupActive,
    getFamilyNavDetail,
} from './navConfig';

describe('navConfig', () => {
    it('marks grouped tabs as active for their primary nav item', () => {
        expect(isNavGroupActive('Trivia', 'Gallery')).toBe(true);
        expect(isNavGroupActive('Meal Plan', 'Grocery List')).toBe(true);
        expect(isNavGroupActive('Collections', 'Recipes')).toBe(true);
        expect(isNavGroupActive('Privacy', 'Profile')).toBe(true);
        expect(isNavGroupActive('Recipes', 'Gallery')).toBe(false);
    });

    it('returns secondary nav for grouped destinations', () => {
        expect(getSecondaryNavForTab('Trivia')).toBe(FAMILY_SECONDARY_NAV);
        expect(getSecondaryNavForTab('Meal Plan')?.some((i) => i.id === 'Meal Plan')).toBe(true);
        expect(getSecondaryNavForTab('Collections')?.some((i) => i.id === 'Collections')).toBe(true);
        expect(getSecondaryNavForTab('Index')?.some((i) => i.id === 'Index')).toBe(true);
        expect(getSecondaryNavForTab('Help')?.some((i) => i.id === 'Help')).toBe(true);
        expect(getSecondaryNavForTab('Home')).toBeNull();
    });

    it('keeps primary nav tabs in sync across header and bottom nav', () => {
        expect(PRIMARY_NAV_TABS).toHaveLength(6);
        expect(BOTTOM_NAV_TABS).toHaveLength(5);
        expect(BOTTOM_NAV_TABS.map((t) => t.id)).not.toContain('Index');
        expect(RECIPES_SECONDARY_NAV.some((i) => i.id === 'Index')).toBe(true);
        expect(PRIMARY_NAV_TABS.map((t) => t.id)).toEqual([
            'Home',
            'Recipes',
            'Index',
            'Gallery',
            'Grocery List',
            'Profile',
        ]);
    });

    it('formats family nav detail strings', () => {
        expect(getFamilyNavDetail('Gallery', { gallery: 4, trivia: 2, contributors: 3 })).toBe('4 memories');
        expect(getFamilyNavDetail('Contributors', { gallery: 4, trivia: 2, contributors: 3 })).toBe('3 contributors');
    });
});
