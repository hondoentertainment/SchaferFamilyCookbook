import { STORAGE_KEYS } from '../constants/storage';

const MAX_RECENT = 8;

function readRaw(): string[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.recentSearches);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    } catch {
        return [];
    }
}

function writeRaw(items: string[]): void {
    try {
        localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(items.slice(0, MAX_RECENT)));
    } catch {
        /* quota / private mode */
    }
}

/** Most-recent first, de-duplicated, trimmed. */
export function getRecentSearches(): string[] {
    return readRaw();
}

/** Remember a query. Empty strings are ignored. Moves an existing query to the front. */
export function rememberRecentSearch(query: string): string[] {
    const trimmed = query.trim();
    if (!trimmed) return readRaw();
    const next = [trimmed, ...readRaw().filter((item) => item.toLowerCase() !== trimmed.toLowerCase())];
    writeRaw(next);
    return next.slice(0, MAX_RECENT);
}

export function removeRecentSearch(query: string): string[] {
    const next = readRaw().filter((item) => item.toLowerCase() !== query.trim().toLowerCase());
    writeRaw(next);
    return next;
}

export function clearRecentSearches(): string[] {
    writeRaw([]);
    return [];
}
