import type { ContributorProfile, GalleryItem, Recipe, Trivia } from '../types';
import { contributorAvatarUrlForName } from './contributorAvatar';

const keyFor = (n: string) => n.trim().toLowerCase();

function seedIdForName(name: string): string {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `seed-${slug || 'unknown'}`;
}

/**
 * Merges Firestore (or local) contributor rows with names that appear in recipes,
 * gallery, or trivia so list UIs always have an avatar URL per name.
 */
export function mergeContributorsForDisplay(
    fromDb: ContributorProfile[],
    recipes: Recipe[],
    gallery: GalleryItem[],
    trivia: Trivia[]
): ContributorProfile[] {
    const byKey = new Map<string, ContributorProfile>();
    for (const c of fromDb) {
        const k = keyFor(c.name);
        if (k) byKey.set(k, c);
    }

    const ensure = (raw: string) => {
        const name = raw?.trim();
        if (!name) return;
        const k = keyFor(name);
        if (byKey.has(k)) return;
        byKey.set(k, {
            id: seedIdForName(name),
            name,
            role: 'user',
            avatar: contributorAvatarUrlForName(name),
        });
    };

    recipes.forEach((r) => ensure(r.contributor));
    gallery.forEach((g) => ensure(g.contributor));
    trivia.forEach((t) => ensure(t.contributor));

    return Array.from(byKey.values());
}
