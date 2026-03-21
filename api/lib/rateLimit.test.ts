import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { slidingWindowAllow, getClientIp } from './rateLimit';

describe('slidingWindowAllow', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows requests under the limit', () => {
        expect(slidingWindowAllow('a', 3, 1000)).toBe(true);
        expect(slidingWindowAllow('a', 3, 1000)).toBe(true);
        expect(slidingWindowAllow('a', 3, 1000)).toBe(true);
    });

    it('blocks when limit exceeded in window', () => {
        expect(slidingWindowAllow('b', 2, 1000)).toBe(true);
        expect(slidingWindowAllow('b', 2, 1000)).toBe(true);
        expect(slidingWindowAllow('b', 2, 1000)).toBe(false);
    });

    it('resets after window passes', () => {
        expect(slidingWindowAllow('c', 1, 500)).toBe(true);
        expect(slidingWindowAllow('c', 1, 500)).toBe(false);
        vi.advanceTimersByTime(501);
        expect(slidingWindowAllow('c', 1, 500)).toBe(true);
    });

    it('uses separate keys', () => {
        expect(slidingWindowAllow('ip1', 1, 1000)).toBe(true);
        expect(slidingWindowAllow('ip2', 1, 1000)).toBe(true);
    });
});

describe('getClientIp', () => {
    it('parses x-forwarded-for', () => {
        expect(
            getClientIp({
                headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
                socket: {},
            })
        ).toBe('203.0.113.1');
    });

    it('falls back to socket remoteAddress', () => {
        expect(
            getClientIp({
                headers: {},
                socket: { remoteAddress: '::1' },
            })
        ).toBe('::1');
    });
});
