import { useEffect, useRef } from 'react';

/**
 * Hold a screen wake lock while `active` is true; released on cleanup or
 * when `active` flips false. The browser auto-releases the sentinel whenever
 * the page is hidden (tab switch, app backgrounded), so the lock is
 * re-requested when the page becomes visible again. Browsers without the
 * Wake Lock API (or a denied request) invoke `onUnavailable` once per
 * activation so callers can let the user know the screen may still sleep.
 */
export function useWakeLock(active: boolean, onUnavailable?: () => void) {
    const onUnavailableRef = useRef(onUnavailable);
    onUnavailableRef.current = onUnavailable;

    useEffect(() => {
        if (!active) return;
        let wakeLock: WakeLockSentinel | null = null;
        let cancelled = false;
        let notifiedUnavailable = false;
        const requestWakeLock = async () => {
            try {
                if (navigator.wakeLock) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    if (cancelled) wakeLock.release?.();
                }
            } catch {
                if (!notifiedUnavailable) {
                    notifiedUnavailable = true;
                    onUnavailableRef.current?.();
                }
            }
        };
        // Hidden pages auto-release the sentinel; reacquire on return.
        const onVisibilityChange = () => {
            if (!cancelled && document.visibilityState === 'visible') {
                requestWakeLock();
            }
        };
        requestWakeLock();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            wakeLock?.release?.();
        };
    }, [active]);
}
