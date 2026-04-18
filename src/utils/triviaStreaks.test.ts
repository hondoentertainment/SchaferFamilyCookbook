import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getStreak, recordQuizCompletion } from './triviaStreaks';

const STORAGE_KEY = 'schafer_trivia_streaks';

function d(year: number, month: number, day: number): Date {
    // month is 1-indexed for readability
    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

describe('triviaStreaks utility', () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
            setItem: (key: string, value: string) => {
                store.set(key, value);
            },
            removeItem: (key: string) => {
                store.delete(key);
            },
            clear: () => store.clear(),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('getStreak', () => {
        it('returns zeros and null lastDate when no entry exists', () => {
            const result = getStreak('Alice');
            expect(result).toEqual({ current: 0, best: 0, lastDate: null });
        });

        it('returns 0 current after a missed day, but preserves best', () => {
            recordQuizCompletion('Alice', d(2026, 4, 10));
            recordQuizCompletion('Alice', d(2026, 4, 11));
            // Two days later — the streak should be considered broken.
            const result = getStreak('Alice', d(2026, 4, 13));
            expect(result.current).toBe(0);
            expect(result.best).toBe(2);
            expect(result.lastDate).toBe('2026-04-11');
        });

        it('keeps current intact when checked the day after last completion', () => {
            recordQuizCompletion('Bob', d(2026, 4, 10));
            recordQuizCompletion('Bob', d(2026, 4, 11));
            const result = getStreak('Bob', d(2026, 4, 12));
            expect(result.current).toBe(2);
            expect(result.best).toBe(2);
        });

        it('recovers gracefully from corrupt storage data', () => {
            localStorage.setItem(STORAGE_KEY, 'not-json{{');
            const result = getStreak('Alice');
            expect(result).toEqual({ current: 0, best: 0, lastDate: null });
        });

        it('recovers from malformed entry shapes', () => {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ alice: { current: 'oops', best: 4, lastDate: 'x' } }),
            );
            const result = getStreak('Alice');
            expect(result).toEqual({ current: 0, best: 0, lastDate: null });
        });
    });

    describe('recordQuizCompletion', () => {
        it('creates a streak of 1 on first completion', () => {
            const result = recordQuizCompletion('Alice', d(2026, 4, 18));
            expect(result).toEqual({ current: 1, best: 1, lastDate: '2026-04-18' });
        });

        it('does not double-count completions on the same day', () => {
            recordQuizCompletion('Alice', d(2026, 4, 18));
            const result = recordQuizCompletion('Alice', d(2026, 4, 18));
            expect(result.current).toBe(1);
            expect(result.best).toBe(1);
            expect(result.lastDate).toBe('2026-04-18');
        });

        it('increments the streak on consecutive days', () => {
            recordQuizCompletion('Alice', d(2026, 4, 16));
            recordQuizCompletion('Alice', d(2026, 4, 17));
            const result = recordQuizCompletion('Alice', d(2026, 4, 18));
            expect(result).toEqual({ current: 3, best: 3, lastDate: '2026-04-18' });
        });

        it('resets a broken streak but preserves best', () => {
            recordQuizCompletion('Alice', d(2026, 4, 10));
            recordQuizCompletion('Alice', d(2026, 4, 11));
            recordQuizCompletion('Alice', d(2026, 4, 12)); // best = 3
            // Skip a day.
            const result = recordQuizCompletion('Alice', d(2026, 4, 14));
            expect(result.current).toBe(1);
            expect(result.best).toBe(3);
            expect(result.lastDate).toBe('2026-04-14');
        });

        it('keeps player streaks isolated by name', () => {
            recordQuizCompletion('Alice', d(2026, 4, 17));
            recordQuizCompletion('Alice', d(2026, 4, 18));
            recordQuizCompletion('Bob', d(2026, 4, 18));
            expect(getStreak('Alice', d(2026, 4, 18))).toMatchObject({ current: 2, best: 2 });
            expect(getStreak('Bob', d(2026, 4, 18))).toMatchObject({ current: 1, best: 1 });
        });

        it('treats player names case-insensitively', () => {
            recordQuizCompletion('Alice', d(2026, 4, 17));
            const result = recordQuizCompletion('alice', d(2026, 4, 18));
            expect(result.current).toBe(2);
            expect(getStreak('ALICE', d(2026, 4, 18))).toMatchObject({ current: 2, best: 2 });
        });

        it('starts a fresh streak when prior storage is corrupt', () => {
            localStorage.setItem(STORAGE_KEY, '\u0000not-json');
            const result = recordQuizCompletion('Alice', d(2026, 4, 18));
            expect(result).toEqual({ current: 1, best: 1, lastDate: '2026-04-18' });
        });
    });
});
