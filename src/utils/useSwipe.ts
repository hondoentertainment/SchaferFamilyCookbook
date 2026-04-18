import React from 'react';

/**
 * Swipe-gesture hook for touch devices.
 *
 * Returns a set of touch handlers you can spread onto the element whose swipes
 * you want to observe. Fires `onSwipeLeft` / `onSwipeRight` when the user
 * performs a horizontal drag that exceeds `threshold` pixels and whose
 * horizontal magnitude is greater than its vertical magnitude (so we don't
 * steal vertical scroll gestures).
 *
 * Swipes that begin on an interactive element (input/textarea/button/select)
 * are ignored so they don't interfere with typing, pressing, or picking.
 */
export interface UseSwipeOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    /** Minimum horizontal distance in px to count as a swipe. Default 50. */
    threshold?: number;
}

export interface UseSwipeHandlers {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
}

const INTERACTIVE_SELECTOR = 'input, textarea, button, select, a[href], [contenteditable="true"]';

function isInteractive(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) return false;
    return !!target.closest(INTERACTIVE_SELECTOR);
}

export function useSwipe({
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
}: UseSwipeOptions): UseSwipeHandlers {
    const startX = React.useRef<number>(0);
    const startY = React.useRef<number>(0);
    const active = React.useRef<boolean>(false);

    const onTouchStart = React.useCallback((e: React.TouchEvent) => {
        if (isInteractive(e.target)) {
            active.current = false;
            return;
        }
        const touch = e.touches[0];
        if (!touch) return;
        startX.current = touch.clientX;
        startY.current = touch.clientY;
        active.current = true;
    }, []);

    const onTouchMove = React.useCallback((_e: React.TouchEvent) => {
        // Intentionally no-op; we read the final position in touchend.
        // Exposed so consumers can spread `onTouchMove` if desired.
    }, []);

    const onTouchEnd = React.useCallback(
        (e: React.TouchEvent) => {
            if (!active.current) return;
            active.current = false;
            const touch = e.changedTouches[0];
            if (!touch) return;
            const deltaX = touch.clientX - startX.current;
            const deltaY = touch.clientY - startY.current;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            // Must be primarily horizontal and exceed threshold.
            if (absX < threshold) return;
            if (absX <= absY) return;
            if (deltaX < 0) onSwipeLeft?.();
            else onSwipeRight?.();
        },
        [onSwipeLeft, onSwipeRight, threshold]
    );

    return { onTouchStart, onTouchMove, onTouchEnd };
}
