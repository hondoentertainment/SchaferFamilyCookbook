import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipe } from './useSwipe';
import type React from 'react';

/**
 * Build a synthetic React.TouchEvent-shaped object sufficient for the hook.
 * The hook only reads `touches[0].clientX/Y`, `changedTouches[0].clientX/Y`,
 * and `target`.
 */
function makeTouchEvent(
    kind: 'start' | 'end',
    x: number,
    y: number,
    target: EventTarget | null = document.createElement('div')
): React.TouchEvent {
    const touch = { clientX: x, clientY: y } as Touch;
    const base = {
        target,
        touches: kind === 'start' ? [touch] : [],
        changedTouches: kind === 'end' ? [touch] : [],
    };
    return base as unknown as React.TouchEvent;
}

describe('useSwipe', () => {
    it('fires onSwipeLeft when horizontal delta is strongly negative', () => {
        const onSwipeLeft = vi.fn();
        const onSwipeRight = vi.fn();
        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 })
        );

        act(() => {
            result.current.onTouchStart(makeTouchEvent('start', 200, 100));
            result.current.onTouchEnd(makeTouchEvent('end', 100, 105));
        });

        expect(onSwipeLeft).toHaveBeenCalledTimes(1);
        expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('fires onSwipeRight when horizontal delta is strongly positive', () => {
        const onSwipeLeft = vi.fn();
        const onSwipeRight = vi.fn();
        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 })
        );

        act(() => {
            result.current.onTouchStart(makeTouchEvent('start', 100, 100));
            result.current.onTouchEnd(makeTouchEvent('end', 220, 95));
        });

        expect(onSwipeRight).toHaveBeenCalledTimes(1);
        expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it('ignores swipes below the threshold', () => {
        const onSwipeLeft = vi.fn();
        const onSwipeRight = vi.fn();
        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 })
        );

        act(() => {
            result.current.onTouchStart(makeTouchEvent('start', 100, 100));
            result.current.onTouchEnd(makeTouchEvent('end', 130, 100));
        });

        expect(onSwipeLeft).not.toHaveBeenCalled();
        expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('ignores predominantly vertical swipes (scroll gesture)', () => {
        const onSwipeLeft = vi.fn();
        const onSwipeRight = vi.fn();
        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 })
        );

        act(() => {
            result.current.onTouchStart(makeTouchEvent('start', 100, 100));
            result.current.onTouchEnd(makeTouchEvent('end', 160, 300));
        });

        expect(onSwipeLeft).not.toHaveBeenCalled();
        expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('ignores swipes that begin on interactive elements', () => {
        const onSwipeLeft = vi.fn();
        const onSwipeRight = vi.fn();
        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 })
        );

        const button = document.createElement('button');
        act(() => {
            result.current.onTouchStart(makeTouchEvent('start', 200, 100, button));
            result.current.onTouchEnd(makeTouchEvent('end', 80, 100));
        });

        expect(onSwipeLeft).not.toHaveBeenCalled();
        expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('honors a custom threshold', () => {
        const onSwipeLeft = vi.fn();
        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft, threshold: 10 })
        );

        act(() => {
            result.current.onTouchStart(makeTouchEvent('start', 50, 50));
            result.current.onTouchEnd(makeTouchEvent('end', 30, 50));
        });

        expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });
});
