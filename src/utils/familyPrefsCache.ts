import type { RecipeNote } from '../types';

/**
 * Local cache of the family-wide prefs aggregate (every member's ratings and
 * recipe notes), fetched from the world-readable `userPrefs` collection by
 * `services/familyPrefs.ts`. Kept in a utils module with no Firebase imports
 * so the synchronous ratings/notes readers can merge it cheaply.
 */

export interface FamilyMemberPrefs {
    /** userPrefs doc id — the display-name slug (see deriveUserId). */
    userId: string;
    displayName?: string;
    ratings: Record<string, number>;
    notes: RecipeNote[];
}

export interface FamilyPrefsCache {
    /** ISO timestamp of the last successful fetch. */
    fetchedAt: string;
    members: FamilyMemberPrefs[];
}

export const FAMILY_PREFS_CACHE_KEY = 'familyPrefs:v1';

/** Window event dispatched whenever the cache is replaced with fresh data. */
export const FAMILY_PREFS_UPDATED_EVENT = 'family-prefs-updated';

export function getFamilyPrefsCache(): FamilyPrefsCache | null {
    try {
        const raw = localStorage.getItem(FAMILY_PREFS_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as FamilyPrefsCache;
        if (!parsed || !Array.isArray(parsed.members)) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function setFamilyPrefsCache(cache: FamilyPrefsCache): void {
    try {
        localStorage.setItem(FAMILY_PREFS_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // Quota/serialization failures are non-fatal; readers fall back to local data.
        return;
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(FAMILY_PREFS_UPDATED_EVENT));
    }
}

/** Best-effort display name from a doc slug: "grandma-joan" → "Grandma Joan". */
export function displayNameFromSlug(slug: string): string {
    return slug
        .split('-')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
