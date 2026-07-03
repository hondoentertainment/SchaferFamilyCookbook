import { useEffect, useRef } from 'react';

/**
 * Hold a screen wake lock while `active` is true; released on cleanup or
 * when `active` flips false. Browsers without the Wake Lock API (or a denied
 * request) invoke `onUnavailable` once per activation so callers can let the
 * user know the screen may still sleep.
 */
export function useWakeLock(active: boolean, onUnavailable?: () => void) {
    const onUnavailableRef = useRef(onUnavailable);
    onUnavailableRef.current = onUnavailable;

    useEffect(() => {
        if (!active) return;
        let wakeLock: WakeLockSentinel | null = null;
        let cancelled = false;
        const requestWakeLock = async () => {
            try {
                if (navigator.wakeLock) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    if (cancelled) wakeLock.release?.();
                }
            } catch {
                onUnavailableRef.current?.();
            }
        };
        requestWakeLock();
        return () => {
            cancelled = true;
            wakeLock?.release?.();
        };
    }, [active]);
}
