import React, { useState, useEffect } from 'react';

/** Subtle banner shown when the user goes offline. Dismisses when back online. */
export const OfflineBanner: React.FC = () => {
    const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed top-0 left-0 right-0 z-[350] py-3 px-4 bg-amber-100/95 border-b border-amber-200 text-amber-900 text-center text-sm font-bold uppercase tracking-widest shadow-md"
        >
            You&apos;re offline. Some features may not work.
        </div>
    );
};
