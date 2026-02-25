const STORAGE_KEY = 'schafer_recently_viewed';
const MAX_ENTRIES = 20;

export interface RecentlyViewedEntry {
    id: string;
    title: string;
    viewedAt: number;
}

function loadEntries(): RecentlyViewedEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw) as RecentlyViewedEntry[];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function saveEntries(entries: RecentlyViewedEntry[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

/** Record a recipe view. Call when opening a recipe. */
export function recordRecipeView(id: string, title: string): void {
    const entries = loadEntries();
    const filtered = entries.filter((e) => e.id !== id);
    filtered.unshift({ id, title, viewedAt: Date.now() });
    saveEntries(filtered);
}

/** Get recently viewed recipe IDs in order (most recent first). */
export function getRecentRecipeIds(): string[] {
    return loadEntries().map((e) => e.id);
}

/** Get recently viewed entries (id, title) for display. */
export function getRecentlyViewedEntries(): RecentlyViewedEntry[] {
    return loadEntries();
}
