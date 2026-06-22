export interface PrimaryNavTab {
    id: string;
    label: string;
    title: string;
    group: string[];
}

export const PRIMARY_NAV_TABS: PrimaryNavTab[] = [
    { id: 'Home', label: 'Home', title: 'Your personalized cookbook home', group: ['Home'] },
    { id: 'Recipes', label: 'Recipes', title: 'Search recipes and browse collections', group: ['Recipes', 'Collections'] },
    { id: 'Index', label: 'A–Z', title: 'Alphabetical recipe index (A–Z)', group: ['Index'] },
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
];

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
