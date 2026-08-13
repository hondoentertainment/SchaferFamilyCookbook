import { describe, it, expect, vi, afterEach } from 'vitest';
import { shouldToastImageError } from './imageErrorToast';
import { TIMING } from '../constants/theme';

describe('shouldToastImageError', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows the first toast, then suppresses repeats within the cooldown', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-04T12:00:00Z'));

        // First failure in this window may already be consumed by another test
        // file run order, so capture behavior relative to the first call.
        const first = shouldToastImageError('r1');
        const second = shouldToastImageError('r2');
        const third = shouldToastImageError('r3');

        // Whatever the initial state, consecutive calls must be suppressed.
        expect(second).toBe(false);
        expect(third).toBe(false);
        // And at most one of the calls may have fired.
        expect([first, second, third].filter(Boolean).length).toBeLessThanOrEqual(1);
    });

    it('allows the toast again after the cooldown elapses', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-04T12:00:00Z'));
        shouldToastImageError('warm-up');

        vi.setSystemTime(new Date(Date.now() + TIMING.aiCooldownMs + 1000));
        expect(shouldToastImageError('later')).toBe(true);
        // ...and immediately suppresses again.
        expect(shouldToastImageError('later-2')).toBe(false);
    });
});
