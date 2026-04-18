const STORAGE_KEY = 'schafer_trivia_streaks';

export interface StoredStreak {
    current: number;
    best: number;
    lastDate: string; // YYYY-MM-DD
}

export interface StreakInfo {
    current: number;
    best: number;
    lastDate: string | null;
}

type StreakStore = Record<string, StoredStreak>;

function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const dt = new Date(y, m - 1, d);
    if (
        dt.getFullYear() !== y ||
        dt.getMonth() !== m - 1 ||
        dt.getDate() !== d
    ) {
        return null;
    }
    return dt;
}

function daysBetween(earlier: Date, later: Date): number {
    const MS = 24 * 60 * 60 * 1000;
    const a = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate()).getTime();
    const b = new Date(later.getFullYear(), later.getMonth(), later.getDate()).getTime();
    return Math.round((b - a) / MS);
}

function normalizeKey(playerName: string): string {
    return playerName.trim().toLowerCase();
}

function readStore(): StreakStore {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const out: StreakStore = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (!value || typeof value !== 'object') continue;
            const v = value as Record<string, unknown>;
            const current = typeof v.current === 'number' ? v.current : NaN;
            const best = typeof v.best === 'number' ? v.best : NaN;
            const lastDate = typeof v.lastDate === 'string' ? v.lastDate : '';
            if (
                Number.isFinite(current) &&
                Number.isFinite(best) &&
                lastDate &&
                parseDate(lastDate)
            ) {
                out[key] = { current, best, lastDate };
            }
        }
        return out;
    } catch {
        return {};
    }
}

function writeStore(store: StreakStore): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
        /* ignore quota / unavailable storage */
    }
}

export function getStreak(playerName: string, today: Date = new Date()): StreakInfo {
    const store = readStore();
    const key = normalizeKey(playerName);
    const entry = store[key];
    if (!entry) {
        return { current: 0, best: 0, lastDate: null };
    }
    const last = parseDate(entry.lastDate);
    if (!last) {
        return { current: 0, best: entry.best, lastDate: null };
    }
    const diff = daysBetween(last, today);
    if (diff > 1) {
        // Streak broken (more than one day since last completion).
        return { current: 0, best: entry.best, lastDate: entry.lastDate };
    }
    // diff <= 1 (same day or yesterday) — current still standing,
    // and diff < 0 (clock skew) we also treat as current intact.
    return { current: entry.current, best: entry.best, lastDate: entry.lastDate };
}

export function recordQuizCompletion(
    playerName: string,
    today: Date = new Date(),
): StoredStreak {
    const store = readStore();
    const key = normalizeKey(playerName);
    const todayStr = formatDate(today);
    const entry = store[key];

    let next: StoredStreak;
    if (!entry) {
        next = { current: 1, best: 1, lastDate: todayStr };
    } else {
        const last = parseDate(entry.lastDate);
        const diff = last ? daysBetween(last, today) : Number.POSITIVE_INFINITY;
        if (diff === 0) {
            // Same day — no change to counts; lastDate stays today.
            next = { current: entry.current, best: entry.best, lastDate: todayStr };
        } else if (diff === 1) {
            const current = entry.current + 1;
            next = {
                current,
                best: Math.max(entry.best, current),
                lastDate: todayStr,
            };
        } else {
            // Gap of 2+ days, or invalid stored date — restart streak.
            next = {
                current: 1,
                best: Math.max(entry.best, 1),
                lastDate: todayStr,
            };
        }
    }

    store[key] = next;
    writeStore(store);
    return next;
}
