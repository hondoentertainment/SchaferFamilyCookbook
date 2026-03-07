import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hapticSuccess, hapticError, hapticLight } from './haptics';

describe('Vibration API (Haptics)', () => {
    let originalVibrate: any;
    let matchMediaMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // Save original if it exists
        originalVibrate = navigator.vibrate;

        // Mock navigator.vibrate
        navigator.vibrate = vi.fn();

        // Mock window.matchMedia
        matchMediaMock = vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: matchMediaMock
        });
    });

    afterEach(() => {
        // Restore
        navigator.vibrate = originalVibrate;
        vi.restoreAllMocks();
    });

    describe('hapticSuccess', () => {
        it('should vibrate with 100ms when supported', () => {
            hapticSuccess();
            expect(navigator.vibrate).toHaveBeenCalledWith(100);
        });

        it('should not vibrate if prefers-reduced-motion is true', () => {
            matchMediaMock.mockImplementation(() => ({ matches: true }));
            hapticSuccess();
            expect(navigator.vibrate).not.toHaveBeenCalled();
        });
    });

    describe('hapticError', () => {
        it('should vibrate with error pattern [50, 50, 50]', () => {
            hapticError();
            expect(navigator.vibrate).toHaveBeenCalledWith([50, 50, 50]);
        });

        it('should not vibrate if prefers-reduced-motion is true', () => {
            matchMediaMock.mockImplementation(() => ({ matches: true }));
            hapticError();
            expect(navigator.vibrate).not.toHaveBeenCalled();
        });
    });

    describe('hapticLight', () => {
        it('should vibrate with 50ms', () => {
            hapticLight();
            expect(navigator.vibrate).toHaveBeenCalledWith(50);
        });

        it('should not vibrate if prefers-reduced-motion is true', () => {
            matchMediaMock.mockImplementation(() => ({ matches: true }));
            hapticLight();
            expect(navigator.vibrate).not.toHaveBeenCalled();
        });
    });

    describe('Safety checks', () => {
        it('should gracefully no-op if navigator.vibrate is undefined', () => {
            Object.defineProperty(navigator, 'vibrate', {
                writable: true,
                value: undefined
            });
            expect(() => hapticSuccess()).not.toThrow();
        });
    });
});
