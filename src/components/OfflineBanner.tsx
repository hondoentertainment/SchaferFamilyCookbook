import React, { useState, useEffect, useCallback } from 'react';

/** Format a relative time string like "5 minutes ago" from a Date. */
function formatRelativeTime(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
}

interface OfflineBannerProps {
    /** Optional contextual message, e.g. "Showing cached recipes." */
    contextMessage?: string;
}

/**
 * Enhanced offline banner with retry button, last-sync time, slide animation,
 * and per-section contextual messaging.
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({ contextMessage }) => {
    const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
    const [visible, setVisible] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [relativeTime, setRelativeTime] = useState('');

    // Track last time we were online as "last sync"
    useEffect(() => {
        const handleOnline = () => {
            setLastSyncTime(new Date());
            setIsOffline(false);
        };
        const handleOffline = () => {
            setIsOffline(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Set initial last sync if currently online
        if (navigator.onLine) {
            setLastSyncTime(new Date());
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Animate in/out
    useEffect(() => {
        if (isOffline) {
            // Small delay so the CSS transition triggers after mount
            const timer = setTimeout(() => setVisible(true), 50);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [isOffline]);

    // Update relative time every 30 seconds
    useEffect(() => {
        if (!lastSyncTime) return;
        const update = () => setRelativeTime(formatRelativeTime(lastSyncTime));
        update();
        const interval = setInterval(update, 30_000);
        return () => clearInterval(interval);
    }, [lastSyncTime]);

    const handleRetry = useCallback(async () => {
        setRetrying(true);
        try {
            // Attempt a lightweight fetch to check connectivity
            await fetch('/favicon.ico', { cache: 'no-store', mode: 'no-cors' });
            // If we reach here, the network may be back
            if (navigator.onLine) {
                setLastSyncTime(new Date());
                setIsOffline(false);
            }
        } catch {
            // Still offline, keep banner visible
        } finally {
            setRetrying(false);
        }
    }, []);

    if (!isOffline && !visible) return null;

    const defaultMessage = contextMessage
        ? `You're offline. ${contextMessage}`
        : "You're offline. Showing cached recipes.";

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed top-0 left-0 right-0 z-[350] transition-transform duration-300 ease-in-out"
            style={{ transform: visible ? 'translateY(0)' : 'translateY(-100%)' }}
        >
            <div className="py-3 px-4 bg-amber-100/95 border-b border-amber-200 text-amber-900 text-sm font-bold shadow-md">
                <div className="flex items-center justify-center gap-3 flex-wrap">
                    <span className="uppercase tracking-widest">{defaultMessage}</span>

                    {lastSyncTime && relativeTime && (
                        <span className="text-amber-700 font-normal text-xs">
                            Last synced {relativeTime}
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={handleRetry}
                        disabled={retrying}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-amber-700 transition-colors disabled:opacity-50 min-h-[2.25rem]"
                    >
                        {retrying ? 'Checking…' : 'Retry connection'}
                    </button>
                </div>
            </div>
        </div>
    );
};
