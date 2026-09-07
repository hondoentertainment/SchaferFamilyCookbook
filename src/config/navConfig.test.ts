import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    PRIMARY_NAV_TABS,
    FAMILY_SECONDARY_NAV,
    RECIPES_SECONDARY_NAV,
    BOTTOM_NAV_TABS,
    getSecondaryNavForTab,
    getSecondaryNavHub,
    isNavGroupActive,
    getFamilyNavDetail,
    getNavLocation,
    formatNavLocation,
    getTabPageLabel,
    navigateToTab,
    WAYFINDING_DESTINATIONS,
} from './navConfig';

describe('navConfig', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('marks grouped tabs as active for their primary nav item', () => {
        expect(isNavGroupActive('Trivia', 'Gallery')).toBe(true);
        expect(isNavGroupActive('Meal Plan', 'Grocery List')).toBe(true);
        expect(isNavGroupActive('Collections', 'Recipes')).toBe(true);
        expect(isNavGroupActive('Index', 'Recipes')).toBe(true);
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
        expect(PRIMARY_NAV_TABS).toHaveLength(5);
        expect(BOTTOM_NAV_TABS).toHaveLength(5);
        expect(BOTTOM_NAV_TABS.map((t) => t.id)).toEqual(PRIMARY_NAV_TABS.map((t) => t.id));
        expect(PRIMARY_NAV_TABS.map((t) => t.id)).not.toContain('Index');
        expect(RECIPES_SECONDARY_NAV.some((i) => i.id === 'Index')).toBe(true);
        expect(PRIMARY_NAV_TABS.map((t) => t.id)).toEqual([
            'Home',
            'Recipes',
            'Gallery',
            'Grocery List',
            'Profile',
        ]);
    });

    it('describes secondary nav hubs', () => {
        expect(getSecondaryNavHub(FAMILY_SECONDARY_NAV)?.label).toBe('Family');
        expect(getSecondaryNavHub(RECIPES_SECONDARY_NAV)?.hint).toMatch(/A–Z/);
        expect(getSecondaryNavHub(null)).toBeNull();
    });

    it('formats where-am-I labels for header wayfinding', () => {
        expect(formatNavLocation('Home')).toBe('Home');
        expect(formatNavLocation('Trivia')).toBe('Family · Trivia');
        expect(formatNavLocation('Index')).toBe('Recipes · A–Z');
        expect(formatNavLocation('Meal Plan')).toBe('Groceries · Meal Plan');
        expect(formatNavLocation('Help')).toBe('Me · Help');
        expect(getNavLocation('Collections')).toEqual({
            hubId: 'Recipes',
            hubLabel: 'Recipes',
            pageLabel: 'Collections',
        });
        expect(getTabPageLabel('Grocery List')).toBe('Groceries');
    });

    it('formats family nav detail strings', () => {
        expect(getFamilyNavDetail('Gallery', { gallery: 4, trivia: 2, contributors: 3 })).toBe('4 memories');
        expect(getFamilyNavDetail('Contributors', { gallery: 4, trivia: 2, contributors: 3 })).toBe('3 contributors');
    });

    it('dispatches a navigate event for in-app wayfinding', () => {
        const handler = vi.fn();
        window.addEventListener('schafer:navigate', handler as EventListener);
        navigateToTab('Recipes');
        expect(handler).toHaveBeenCalledTimes(1);
        expect((handler.mock.calls[0][0] as CustomEvent).detail).toBe('Recipes');
        window.removeEventListener('schafer:navigate', handler as EventListener);
    });

    it('lists the five family-facing wayfinding destinations', () => {
        expect(WAYFINDING_DESTINATIONS.map((d) => d.id)).toEqual([
            'Home',
            'Recipes',
            'Gallery',
            'Grocery List',
            'Profile',
        ]);
    });
});
