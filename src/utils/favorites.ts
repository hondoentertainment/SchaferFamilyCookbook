const STORAGE_KEY = 'schafer_favorites';

export function getFavoriteIds(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw) as string[];
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        return new Set();
    }
}

export function setFavoriteIds(ids: Set<string>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

/** Toggle favorite state; returns the new Set of favorite ids. */
export function toggleFavorite(id: string): Set<string> {
    const ids = getFavoriteIds();
    if (ids.has(id)) {
        ids.delete(id);
    } else {
        ids.add(id);
    }
    setFavoriteIds(ids);
    return new Set(ids);
}

export function isFavorite(id: string): boolean {
    return getFavoriteIds().has(id);
}
