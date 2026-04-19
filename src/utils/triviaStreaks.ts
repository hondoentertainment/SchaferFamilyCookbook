/**
 * Trivia streak tracking - counts consecutive days a user completes a quiz.
 *
 * Persistence: localStorage under `triviaStreak:v1`.
 * State shape: { currentStreak, longestStreak, lastCompletedDate }
 *
 * Day comparison uses local YYYY-MM-DD strings so behavior is timezone-stable
 * relative to the user's clock and easy to test with `vi.useFakeTimers()`.
 */

const STORAGE_KEY = 'triviaStreak:v1';

export interface TriviaStreakState {
    currentStreak: number;
    longestStreak: number;
    /** ISO date string `YYYY-MM-DD` of the most recent quiz completion, or null. */
    lastCompletedDate: string | null;
}

const EMPTY_STATE: TriviaStreakState = {
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
};

function isYmd(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function readState(): TriviaStreakState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...EMPTY_STATE };
        const parsed = JSON.parse(raw) as Partial<TriviaStreakState>;
        const current = typeof parsed.currentStreak === 'number' && parsed.currentStreak >= 0 ? parsed.currentStreak : 0;
        const longest = typeof parsed.longestStreak === 'number' && parsed.longestStreak >= 0 ? parsed.longestStreak : 0;
        const last = isYmd(parsed.lastCompletedDate) ? parsed.lastCompletedDate : null;
        return {
            currentStreak: current,
            longestStreak: Math.max(longest, current),
            lastCompletedDate: last,
        };
    } catch {
        return { ...EMPTY_STATE };
    }
}

function writeState(state: TriviaStreakState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore quota / access errors - streak is best-effort.
    }
}

/** Format a Date as local-tz `YYYY-MM-DD`. */
export function toYmd(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Add `days` (can be negative) to a `YYYY-MM-DD` string and return a new YMD. */
function addDays(ymd: string, days: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return toYmd(dt);
}

/**
 * Record a quiz completion using the current local date.
 * - Same day as last completion: no change.
 * - Day immediately after last completion: streak += 1.
 * - Otherwise (gap > 1 day or first completion): streak resets to 1.
 * `longestStreak` is updated on every increase.
 */
export function recordCompletion(now: Date = new Date()): TriviaStreakState {
    const today = toYmd(now);
    const prev = readState();

    if (prev.lastCompletedDate === today) {
        return prev;
    }

    let nextStreak: number;
    if (prev.lastCompletedDate && addDays(prev.lastCompletedDate, 1) === today) {
        nextStreak = prev.currentStreak + 1;
    } else {
        nextStreak = 1;
    }

    const next: TriviaStreakState = {
        currentStreak: nextStreak,
        longestStreak: Math.max(prev.longestStreak, nextStreak),
        lastCompletedDate: today,
    };
    writeState(next);
    return next;
}

/** Read the persisted streak state. */
export function getStreak(): { current: number; longest: number; lastCompletedDate: string | null } {
    const s = readState();
    return {
        current: s.currentStreak,
        longest: s.longestStreak,
        lastCompletedDate: s.lastCompletedDate,
    };
}

/**
 * True if the user completed a quiz today or yesterday (still within the
 * one-day grace window before the streak would reset).
 */
export function isStreakActive(now: Date = new Date()): boolean {
    const s = readState();
    if (!s.lastCompletedDate || s.currentStreak <= 0) return false;
    const today = toYmd(now);
    const yesterday = addDays(today, -1);
    return s.lastCompletedDate === today || s.lastCompletedDate === yesterday;
}

/** Internal: clear persisted state. Exported for tests. */
export function _resetStreakForTests(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
