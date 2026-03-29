/**
 * Route ↔ Tab mapping utilities used by the router and navigation components.
 */

/** Map from tab name to URL path */
export const TAB_TO_PATH: Record<string, string> = {
    Recipes: '/',
    Index: '/index',
    Gallery: '/gallery',
    Trivia: '/trivia',
    'Family Story': '/history',
    Contributors: '/contributors',
    Privacy: '/privacy',
    Profile: '/profile',
    Admin: '/admin',
};

/** Map from URL path to tab name */
export const PATH_TO_TAB: Record<string, string> = Object.fromEntries(
    Object.entries(TAB_TO_PATH).map(([tab, path]) => [path, tab]),
);

/** Derive the active tab name from a pathname. Falls back to 'Recipes'. */
export function tabFromPath(pathname: string): string {
    // Check for recipe deep link: /recipes/:id
    if (pathname.startsWith('/recipes/')) return 'Recipes';
    return PATH_TO_TAB[pathname] ?? 'Recipes';
}

/** Get the path for a given tab name. Falls back to '/'. */
export function pathFromTab(tab: string): string {
    return TAB_TO_PATH[tab] ?? '/';
}
