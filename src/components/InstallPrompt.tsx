import React, { useEffect, useState, useCallback } from 'react';

/**
 * BeforeInstallPromptEvent — not yet in lib.dom.d.ts in many TS setups.
 * We define a minimal shape we actually use.
 */
interface BeforeInstallPromptEvent extends Event {
    readonly platforms?: string[];
    readonly userChoice?: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
    prompt: () => Promise<void>;
}

const VISIT_COUNT_KEY = 'pwa.visitCount';
const DISMISSED_AT_KEY = 'pwa.installDismissedAt';
const SUPPRESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const readIntLS = (key: string): number => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return 0;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : 0;
    } catch {
        return 0;
    }
};

const writeIntLS = (key: string, value: number) => {
    try {
        localStorage.setItem(key, String(value));
    } catch {
        // ignore (storage disabled / quota)
    }
};

const isStandalone = (): boolean => {
    try {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia('(display-mode: standalone)').matches;
    } catch {
        return false;
    }
};

const isSuppressed = (): boolean => {
    const dismissedAt = readIntLS(DISMISSED_AT_KEY);
    if (!dismissedAt) return false;
    return Date.now() - dismissedAt < SUPPRESSION_MS;
};

/**
 * "Add to Home Screen" install CTA shown on second+ visit.
 * Dismissible; suppressed for 30 days post-dismiss.
 */
export const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [visitCountReady, setVisitCountReady] = useState(false);
    const [visitCount, setVisitCount] = useState(0);
    const [dismissed, setDismissed] = useState(false);
    const [installed, setInstalled] = useState<boolean>(() => isStandalone());

    // Increment visit count on mount (once).
    useEffect(() => {
        const next = readIntLS(VISIT_COUNT_KEY) + 1;
        writeIntLS(VISIT_COUNT_KEY, next);
        setVisitCount(next);
        setVisitCountReady(true);
    }, []);

    // Capture beforeinstallprompt.
    useEffect(() => {
        const onBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        const onInstalled = () => {
            setInstalled(true);
            setDeferredPrompt(null);
        };
        window.addEventListener('beforeinstallprompt', onBeforeInstall);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstall);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return;
        try {
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice && choice.outcome === 'dismissed') {
                writeIntLS(DISMISSED_AT_KEY, Date.now());
                setDismissed(true);
            }
        } catch {
            // no-op: some browsers throw if prompt is called twice
        } finally {
            setDeferredPrompt(null);
        }
    }, [deferredPrompt]);

    const handleDismiss = useCallback(() => {
        writeIntLS(DISMISSED_AT_KEY, Date.now());
        setDismissed(true);
    }, []);

    if (!visitCountReady) return null;
    if (installed) return null;
    if (!deferredPrompt) return null;
    if (visitCount < 2) return null;
    if (dismissed) return null;
    if (isSuppressed()) return null;

    return (
        <div
            role="dialog"
            aria-labelledby="install-prompt-title"
            aria-describedby="install-prompt-desc"
            className="fixed left-1/2 -translate-x-1/2 z-[360] max-w-md w-[92vw] px-4 py-3 rounded-2xl shadow-lg border border-stone-200 bg-white/95 backdrop-blur-md text-stone-900 dark:bg-stone-900/95 dark:border-stone-700 dark:text-stone-100"
            style={{
                bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
            }}
        >
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p id="install-prompt-title" className="font-semibold text-sm">
                        Add to Home Screen
                    </p>
                    <p id="install-prompt-desc" className="text-xs text-stone-600 dark:text-stone-300">
                        Install the Cookbook for quick access and offline recipes.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleDismiss}
                        aria-label="Dismiss install prompt for 30 days"
                        className="px-3 py-1.5 rounded-full text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-300 dark:hover:text-white dark:hover:bg-stone-800 transition-colors"
                    >
                        Not now
                    </button>
                    <button
                        type="button"
                        onClick={handleInstall}
                        aria-label="Install Schafer Family Cookbook"
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#2D4635] text-white hover:bg-[#24382B] dark:bg-[#3F6A4E] dark:hover:bg-[#4E7E5D] transition-colors"
                    >
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
