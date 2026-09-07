export interface PrimaryNavTab {
    id: string;
    label: string;
    title: string;
    group: string[];
}

export const PRIMARY_NAV_TABS: PrimaryNavTab[] = [
    { id: 'Home', label: 'Home', title: 'Your personalized cookbook home', group: ['Home'] },
    { id: 'Recipes', label: 'Recipes', title: 'Search recipes and browse collections', group: ['Recipes', 'Collections', 'Index'] },
    { id: 'Gallery', label: 'Family', title: 'Family photos, story, contributors, and trivia', group: ['Gallery', 'Trivia', 'Family Story', 'Contributors'] },
    { id: 'Grocery List', label: 'Groceries', title: 'Grocery list and meal planning from saved recipes', group: ['Grocery List', 'Meal Plan'] },
    { id: 'Profile', label: 'Me', title: 'Profile, preferences, admin tools, privacy, and help', group: ['Profile', 'Privacy', 'Help'] },
];

export function isNavGroupActive(activeTab: string, navId: string): boolean {
    const tab = PRIMARY_NAV_TABS.find((t) => t.id === navId);
    return tab ? tab.group.includes(activeTab) : activeTab === navId;
}

export interface SecondaryNavItem {
    id: string;
    label: string;
    icon?: string;
}

export const FAMILY_SECONDARY_NAV: SecondaryNavItem[] = [
    { id: 'Gallery', label: 'Gallery', icon: '📷' },
    { id: 'Trivia', label: 'Trivia', icon: '🎲' },
    { id: 'Family Story', label: 'Story', icon: '📖' },
    { id: 'Contributors', label: 'People', icon: '👥' },
];

export const COOK_SECONDARY_NAV: SecondaryNavItem[] = [
    { id: 'Grocery List', label: 'Grocery', icon: '🛒' },
    { id: 'Meal Plan', label: 'Meal Plan', icon: '📅' },
];

export const RECIPES_SECONDARY_NAV: SecondaryNavItem[] = [
    { id: 'Recipes', label: 'Browse', icon: '📖' },
    { id: 'Collections', label: 'Collections', icon: '📚' },
    { id: 'Index', label: 'A–Z', icon: '🔤' },
];

/** Mobile bottom nav matches the desktop header — A–Z lives under Recipes. */
export const BOTTOM_NAV_TABS: PrimaryNavTab[] = PRIMARY_NAV_TABS;

export const ME_SECONDARY_NAV: SecondaryNavItem[] = [
    { id: 'Profile', label: 'Profile', icon: '👤' },
    { id: 'Privacy', label: 'Privacy', icon: '🔒' },
    { id: 'Help', label: 'Help', icon: '❓' },
];

const SECONDARY_NAV_GROUPS: SecondaryNavItem[][] = [
    FAMILY_SECONDARY_NAV,
    COOK_SECONDARY_NAV,
    RECIPES_SECONDARY_NAV,
    ME_SECONDARY_NAV,
];

export function getSecondaryNavForTab(activeTab: string): SecondaryNavItem[] | null {
    return SECONDARY_NAV_GROUPS.find((group) => group.some((item) => item.id === activeTab)) ?? null;
}

export interface SecondaryNavHub {
    id: 'family' | 'cook' | 'recipes' | 'me';
    label: string;
    hint: string;
    ariaLabel: string;
}

export function getSecondaryNavHub(items: SecondaryNavItem[] | null): SecondaryNavHub | null {
    if (!items) return null;
    if (items === FAMILY_SECONDARY_NAV) {
        return { id: 'family', label: 'Family', hint: 'Photos, story, people, and trivia', ariaLabel: 'Family hub navigation' };
    }
    if (items === COOK_SECONDARY_NAV) {
        return { id: 'cook', label: 'Cook', hint: 'Grocery list and meal plan', ariaLabel: 'Cooking tools navigation' };
    }
    if (items === RECIPES_SECONDARY_NAV) {
        return { id: 'recipes', label: 'Browse', hint: 'Recipes, collections, and A–Z', ariaLabel: 'Recipe browsing navigation' };
    }
    if (items === ME_SECONDARY_NAV) {
        return { id: 'me', label: 'Me', hint: 'Profile, privacy, and help', ariaLabel: 'Account navigation' };
    }
    return null;
}

/** Short labels for breadcrumbs, mobile location chip, and page eyebrows. */
export const TAB_PAGE_LABELS: Record<string, string> = {
    Home: 'Home',
    Recipes: 'Recipes',
    Index: 'A–Z',
    Collections: 'Collections',
    Gallery: 'Gallery',
    Trivia: 'Trivia',
    'Family Story': 'Family Story',
    Contributors: 'Contributors',
    Profile: 'Profile',
    Privacy: 'Privacy',
    Help: 'Help',
    'Grocery List': 'Groceries',
    'Meal Plan': 'Meal Plan',
};

export function getTabPageLabel(tab: string): string {
    return TAB_PAGE_LABELS[tab] ?? tab;
}

export interface NavLocation {
    hubId: string;
    hubLabel: string;
    pageLabel: string;
}

export function getNavLocation(activeTab: string): NavLocation {
    const primary = PRIMARY_NAV_TABS.find((t) => t.group.includes(activeTab));
    const pageItem = getSecondaryNavForTab(activeTab)?.find((item) => item.id === activeTab);
    return {
        hubId: primary?.id ?? activeTab,
        hubLabel: primary?.label ?? getTabPageLabel(activeTab),
        pageLabel: pageItem?.label ?? getTabPageLabel(activeTab),
    };
}

export function formatNavLocation(activeTab: string): string {
    const { hubLabel, pageLabel } = getNavLocation(activeTab);
    return pageLabel === hubLabel ? hubLabel : `${hubLabel} · ${pageLabel}`;
}

export const WAYFINDING_DESTINATIONS = [
    { id: 'Home', label: 'Home', hint: 'Tonight, favorites, and seasonal ideas' },
    { id: 'Recipes', label: 'Recipes', hint: 'Search the family archive' },
    { id: 'Gallery', label: 'Family', hint: 'Photos, story, people, and trivia' },
    { id: 'Grocery List', label: 'Groceries', hint: 'Shop the list or plan the week' },
    { id: 'Profile', label: 'Me', hint: 'Your name, preferences, and help' },
] as const;

export function getFamilyNavDetail(
    id: string,
    counts: { gallery: number; trivia: number; contributors: number }
): string | undefined {
    switch (id) {
        case 'Gallery':
            return `${counts.gallery} memories`;
        case 'Trivia':
            return `${counts.trivia} questions`;
        case 'Family Story':
            return 'Read the archive';
        case 'Contributors':
            return `${counts.contributors} contributors`;
        default:
            return undefined;
    }
}

export function navigateToTab(tabId: string): void {
    window.dispatchEvent(new CustomEvent('schafer:navigate', { detail: tabId }));
}
