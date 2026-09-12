import React, { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '../constants/storage';
import {
    getInstallInstructions,
    hasViewedRecipes,
    isIosDevice,
    isStandaloneDisplay,
    persistInstallDismissed,
    readInstallDismissed,
    shouldShowInstallHint,
} from '../utils/pwaInstall';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const INSTALL_BANNER_OFFSET_CLASS =
    'fixed bottom-[var(--app-bottom-nav-clearance)] left-0 right-0 z-50 md:bottom-4 md:left-auto md:right-4 md:max-w-sm';

export const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);
    const [isIos] = useState(() => (typeof navigator !== 'undefined' ? isIosDevice(navigator.userAgent) : false));

    const evaluate = useCallback(
        (nativePrompt: BeforeInstallPromptEvent | null) => {
            if (typeof window === 'undefined') return;
            if (isStandaloneDisplay(window) || readInstallDismissed()) {
                setVisible(false);
                return;
            }
            const recentlyViewed = localStorage.getItem(STORAGE_KEYS.recentlyViewed);
            const onboardingDone = localStorage.getItem(STORAGE_KEYS.onboardingDone) === 'true';
            const show = shouldShowInstallHint({
                standalone: false,
                dismissed: false,
                isIos,
                hasNativePrompt: !!nativePrompt,
                hasViewedRecipe: hasViewedRecipes(recentlyViewed),
                onboardingDone,
            });
            setVisible(show);
        },
        [isIos],
    );

    useEffect(() => {
        if (isStandaloneDisplay() || readInstallDismissed()) return;

        evaluate(deferredPrompt);

        const handler = (e: Event) => {
            e.preventDefault();
            const prompt = e as BeforeInstallPromptEvent;
            setDeferredPrompt(prompt);
            evaluate(prompt);
        };

        const onStorage = () => evaluate(deferredPrompt);
        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('storage', onStorage);
        };
    }, [evaluate, deferredPrompt]);

    useEffect(() => {
        if (!visible && !readInstallDismissed() && !isStandaloneDisplay()) {
            const interval = setInterval(() => evaluate(deferredPrompt), 2000);
            return () => clearInterval(interval);
        }
        return undefined;
    }, [visible, deferredPrompt, evaluate]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setVisible(false);
            setDeferredPrompt(null);
            persistInstallDismissed();
        }
    };

    const handleDismiss = () => {
        persistInstallDismissed();
        setVisible(false);
        setDeferredPrompt(null);
    };

    if (!visible) return null;

    const copy = getInstallInstructions(isIos);
    const canNativeInstall = !!deferredPrompt && !isIos;

    return (
        <div
            role="status"
            aria-label="Add to Home Screen"
            data-testid="install-prompt"
            className={INSTALL_BANNER_OFFSET_CLASS}
        >
            <div className="mx-3 md:mx-0 rounded-[1.5rem] bg-[var(--color-brand)] text-white shadow-2xl px-5 py-4 flex items-center gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="flex-1 space-y-1">
                    <p className="text-sm font-serif italic leading-snug">{copy.title}</p>
                    <p className="text-xs text-white/85 leading-snug">{copy.body}</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                    {canNativeInstall && (
                        <button
                            type="button"
                            onClick={handleInstall}
                            data-testid="install-prompt-install"
                            className="px-4 py-2 rounded-full bg-white text-[var(--color-brand)] label hover:bg-stone-100 transition-colors min-h-11 whitespace-nowrap"
                        >
                            Install
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleDismiss}
                        data-testid="install-prompt-dismiss"
                        className="px-4 py-2 rounded-full border border-white/30 text-white/90 label hover:bg-white/10 transition-colors min-h-11 whitespace-nowrap"
                    >
                        {canNativeInstall ? 'Not now' : 'Got it'}
                    </button>
                </div>
            </div>
        </div>
    );
};
