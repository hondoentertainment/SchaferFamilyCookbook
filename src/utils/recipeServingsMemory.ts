const STORAGE_KEY = 'schafer_recipe_servings';

function readMap(): Record<string, number> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object') return {};
        const out: Record<string, number> = {};
        for (const [id, value] of Object.entries(parsed)) {
            if (typeof value === 'number' && value > 0 && Number.isFinite(value)) {
                out[id] = value;
            }
        }
        return out;
    } catch {
        return {};
    }
}

export function getRememberedServings(recipeId: string, fallback: number): number {
    const value = readMap()[recipeId];
    return typeof value === 'number' && value > 0 ? value : fallback;
}

export function setRememberedServings(recipeId: string, servings: number): void {
    if (!recipeId || servings <= 0 || !Number.isFinite(servings)) return;
    try {
        const map = readMap();
        map[recipeId] = servings;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // ignore quota / disabled storage
    }
}
