import { contributorMatchKey, normalizeContributorName } from '../constants/taxonomy';
import type { ContributorProfile, GalleryItem, HistoryEntry, Recipe, Trivia } from '../types';
import { fuzzyMatch, levenshtein, normalizeText } from './fuzzySearch';

export interface ContributorContentCounts {
    recipeCount: number;
    galleryCount: number;
    triviaCount: number;
}

export interface ContributorAffiliation extends ContributorContentCounts {
    canonicalName: string;
    profile: ContributorProfile | null;
    matchType: 'exact' | 'alias' | 'fuzzy' | 'none';
}

export interface LoginNameSuggestion extends ContributorContentCounts {
    name: string;
    avatar?: string;
}

export function countContributorContent(
    name: string,
    recipes: Recipe[],
    gallery: GalleryItem[],
    trivia: Trivia[]
): ContributorContentCounts {
    const key = contributorMatchKey(name);
    return {
        recipeCount: recipes.filter((r) => contributorMatchKey(r.contributor) === key).length,
        galleryCount: gallery.filter((g) => contributorMatchKey(g.contributor) === key).length,
        triviaCount: trivia.filter((t) => contributorMatchKey(t.contributor) === key).length,
    };
}

export function totalContributorContent(counts: ContributorContentCounts): number {
    return counts.recipeCount + counts.galleryCount + counts.triviaCount;
}

/** Resolve a typed login name to the canonical contributor and archive stats. */
export function resolveLoginAffiliation(
    rawName: string,
    contributors: ContributorProfile[],
    recipes: Recipe[],
    gallery: GalleryItem[],
    trivia: Trivia[]
): ContributorAffiliation {
    const trimmed = rawName.trim();
    if (!trimmed) {
        return {
            canonicalName: '',
            profile: null,
            recipeCount: 0,
            galleryCount: 0,
            triviaCount: 0,
            matchType: 'none',
        };
    }

    const canonical = normalizeContributorName(trimmed);
    const inputKey = contributorMatchKey(trimmed);
    const profile = contributors.find((c) => contributorMatchKey(c.name) === inputKey) ?? null;
    const resolvedName = profile?.name ?? canonical;
    const counts = countContributorContent(resolvedName, recipes, gallery, trivia);
    const hasArchivePresence = totalContributorContent(counts) > 0 || !!profile;

    let matchType: ContributorAffiliation['matchType'] = 'none';
    if (hasArchivePresence) {
        if (normalizeText(trimmed) === normalizeText(resolvedName)) {
            matchType = 'exact';
        } else {
            matchType = 'alias';
        }
    }

    return {
        canonicalName: resolvedName,
        profile,
        ...counts,
        matchType,
    };
}

export function findLoginNameSuggestions(
    query: string,
    contributors: ContributorProfile[],
    recipes: Recipe[],
    gallery: GalleryItem[],
    trivia: Trivia[],
    limit = 5
): LoginNameSuggestion[] {
    const q = normalizeText(query);
    if (!q || q.length < 2) return [];

    return contributors
        .map((c) => {
            const normalized = normalizeText(c.name);
            const counts = countContributorContent(c.name, recipes, gallery, trivia);
            const contentBoost = Math.min(totalContributorContent(counts), 12);
            let score = 0;

            if (normalized === q) score = 100;
            else if (normalized.startsWith(q)) score = 82;
            else if (normalized.split(' ').some((part) => part.startsWith(q))) score = 72;
            else if (normalized.includes(q)) score = 58;
            else if (fuzzyMatch(c.name, query)) score = 42;
            else {
                const first = normalized.split(' ')[0] ?? '';
                const dist = levenshtein(q, first, 2);
                if (dist <= 2) score = 28 - dist * 8;
            }

            score += contentBoost;
            return { name: c.name, avatar: c.avatar, ...counts, score };
        })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || b.recipeCount - a.recipeCount || a.name.localeCompare(b.name))
        .slice(0, limit)
        .map(({ score: _score, ...rest }) => rest);
}

export function recipesForContributor(name: string, recipes: Recipe[]): Recipe[] {
    const key = contributorMatchKey(name);
    return recipes.filter((r) => contributorMatchKey(r.contributor) === key);
}

export function historyForContributor(name: string, history: HistoryEntry[]): HistoryEntry[] {
    const key = contributorMatchKey(name);
    return history.filter((h) => contributorMatchKey(h.contributor) === key);
}

export function formatAffiliationSummary(counts: ContributorContentCounts): string | null {
    const parts: string[] = [];
    if (counts.recipeCount) {
        parts.push(`${counts.recipeCount} recipe${counts.recipeCount !== 1 ? 's' : ''}`);
    }
    if (counts.galleryCount) {
        parts.push(`${counts.galleryCount} photo${counts.galleryCount !== 1 ? 's' : ''}`);
    }
    if (counts.triviaCount) {
        parts.push(`${counts.triviaCount} trivia`);
    }
    return parts.length ? parts.join(' · ') : null;
}
