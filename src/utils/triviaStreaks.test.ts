import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    recordCompletion,
    getStreak,
    isStreakActive,
    toYmd,
    _resetStreakForTests,
} from './triviaStreaks';

const STORAGE_KEY = 'triviaStreak:v1';

describe('triviaStreaks', () => {
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
            length: 0,
            key: () => null,
        });
        _resetStreakForTests();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    function setNow(iso: string): Date {
        const d = new Date(iso);
        vi.setSystemTime(d);
        return d;
    }

    describe('getStreak', () => {
        it('returns zeroed state when nothing is stored', () => {
            const s = getStreak();
            expect(s.current).toBe(0);
            expect(s.longest).toBe(0);
            expect(s.lastCompletedDate).toBeNull();
        });

        it('recovers gracefully from corrupt storage data', () => {
            localStorage.setItem(STORAGE_KEY, 'not-json');
            const s = getStreak();
            expect(s.current).toBe(0);
            expect(s.longest).toBe(0);
            expect(s.lastCompletedDate).toBeNull();
        });
    });

    describe('recordCompletion', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it('starts a new streak at 1 on first completion', () => {
            setNow('2026-04-19T10:00:00');
            const next = recordCompletion();
            expect(next.currentStreak).toBe(1);
            expect(next.longestStreak).toBe(1);
            expect(next.lastCompletedDate).toBe('2026-04-19');
        });

        it('does not change streak when called twice on the same day', () => {
            setNow('2026-04-19T08:00:00');
            recordCompletion();
            setNow('2026-04-19T22:00:00');
            const second = recordCompletion();
            expect(second.currentStreak).toBe(1);
            expect(second.longestStreak).toBe(1);
            expect(second.lastCompletedDate).toBe('2026-04-19');
        });

        it('increments streak on a consecutive day', () => {
            setNow('2026-04-19T10:00:00');
            recordCompletion();
            setNow('2026-04-20T10:00:00');
            const next = recordCompletion();
            expect(next.currentStreak).toBe(2);
            expect(next.longestStreak).toBe(2);
            expect(next.lastCompletedDate).toBe('2026-04-20');
        });

        it('keeps incrementing across multiple consecutive days', () => {
            setNow('2026-04-19T10:00:00');
            recordCompletion();
            setNow('2026-04-20T10:00:00');
            recordCompletion();
            setNow('2026-04-21T10:00:00');
            const third = recordCompletion();
            expect(third.currentStreak).toBe(3);
            expect(third.longestStreak).toBe(3);
        });

        it('resets to 1 when a day is missed', () => {
            setNow('2026-04-19T10:00:00');
            recordCompletion();
            setNow('2026-04-20T10:00:00');
            recordCompletion(); // streak = 2
            setNow('2026-04-22T10:00:00'); // skipped 04-21
            const reset = recordCompletion();
            expect(reset.currentStreak).toBe(1);
            expect(reset.longestStreak).toBe(2);
            expect(reset.lastCompletedDate).toBe('2026-04-22');
        });

        it('preserves longestStreak when current streak resets', () => {
            setNow('2026-04-01T10:00:00');
            recordCompletion();
            setNow('2026-04-02T10:00:00');
            recordCompletion();
            setNow('2026-04-03T10:00:00');
            recordCompletion(); // longest = 3
            setNow('2026-04-10T10:00:00');
            recordCompletion(); // reset to 1
            const s = getStreak();
            expect(s.current).toBe(1);
            expect(s.longest).toBe(3);
        });

        it('updates longestStreak when current streak grows past previous best', () => {
            setNow('2026-04-19T10:00:00');
            recordCompletion();
            setNow('2026-04-20T10:00:00');
            recordCompletion();
            const after2 = getStreak();
            expect(after2.longest).toBe(2);

            setNow('2026-04-21T10:00:00');
            recordCompletion();
            const after3 = getStreak();
            expect(after3.current).toBe(3);
            expect(after3.longest).toBe(3);
        });

        it('handles month boundary correctly', () => {
            setNow('2026-04-30T10:00:00');
            recordCompletion();
            setNow('2026-05-01T10:00:00');
            const next = recordCompletion();
            expect(next.currentStreak).toBe(2);
            expect(next.lastCompletedDate).toBe('2026-05-01');
        });
    });

    describe('isStreakActive', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it('returns false with no completions', () => {
            setNow('2026-04-19T10:00:00');
            expect(isStreakActive()).toBe(false);
        });

        it('returns true when last completion is today', () => {
            setNow('2026-04-19T10:00:00');
            recordCompletion();
            expect(isStreakActive()).toBe(true);
        });

        it('returns true when last completion was yesterday', () => {
            setNow('2026-04-19T10:00:00');
            recordCompletion();
            setNow('2026-04-20T10:00:00');
            expect(isStreakActive()).toBe(true);
        });

        it('returns false when last completion was 2+ days ago', () => {
            setNow('2026-04-19T10:00:00');
            recordCompletion();
            setNow('2026-04-21T10:00:00');
            expect(isStreakActive()).toBe(false);
        });
    });

    describe('toYmd', () => {
        it('formats a Date as YYYY-MM-DD using local components', () => {
            const d = new Date(2026, 3, 5); // April 5, 2026 local
            expect(toYmd(d)).toBe('2026-04-05');
        });

        it('zero-pads months and days', () => {
            const d = new Date(2026, 0, 1);
            expect(toYmd(d)).toBe('2026-01-01');
        });
    });
});
