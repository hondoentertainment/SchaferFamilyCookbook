const SESSION_KEY = 'schafer_recipe_cook_session';

export interface RecipeCookSession {
    ingredients: number[];
    steps: number[];
}

type SessionStore = Record<string, RecipeCookSession>;

function readStore(): SessionStore {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as SessionStore;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeStore(store: SessionStore): void {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(store));
    } catch {
        /* quota / private mode */
    }
}

export function loadRecipeCookSession(recipeId: string): RecipeCookSession {
    const entry = readStore()[recipeId];
    return {
        ingredients: Array.isArray(entry?.ingredients) ? entry.ingredients : [],
        steps: Array.isArray(entry?.steps) ? entry.steps : [],
    };
}

export function saveRecipeCookSession(
    recipeId: string,
    session: Pick<RecipeCookSession, 'ingredients' | 'steps'>,
): void {
    const store = readStore();
    store[recipeId] = {
        ingredients: [...session.ingredients],
        steps: [...session.steps],
    };
    writeStore(store);
}

/** Parse a duration label like "15 min" or "1 hr 30 min" into total minutes. */
export function parseDurationMinutes(label: string | undefined | null): number | null {
    if (!label?.trim()) return null;
    const text = label.trim().toLowerCase();
    const hourMatch = /(\d+)\s*(?:hours?|hrs?|h\b)/i.exec(text);
    const minMatch = /(\d+)\s*(?:minutes?|mins?|m\b)/i.exec(text);
    const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
    const mins = minMatch ? parseInt(minMatch[1], 10) : 0;
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
    const total = hours * 60 + mins;
    return total > 0 ? total : null;
}

export function formatTotalDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}
