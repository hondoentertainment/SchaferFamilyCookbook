import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALL_DISMISSED_KEY = 'schafer_install_dismissed';
const RECENTLY_VIEWED_KEY = 'schafer_recently_viewed';

export const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Don't show if already running as a standalone PWA
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        // Don't show if permanently dismissed
        if (localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true') return;

        const handler = (e: Event) => {
            e.preventDefault();
            const prompt = e as BeforeInstallPromptEvent;
            setDeferredPrompt(prompt);

            // Only show the banner if the user has viewed at least one recipe
            const recentlyViewed = localStorage.getItem(RECENTLY_VIEWED_KEY);
            if (recentlyViewed && recentlyViewed.trim() !== '' && recentlyViewed !== '[]') {
                setVisible(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // Listen for recipe views that happen after the prompt fires
    useEffect(() => {
        if (!deferredPrompt || visible) return;
        if (localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true') return;

        const checkRecentlyViewed = () => {
            const recentlyViewed = localStorage.getItem(RECENTLY_VIEWED_KEY);
            if (recentlyViewed && recentlyViewed.trim() !== '' && recentlyViewed !== '[]') {
                setVisible(true);
            }
        };

        // Poll via storage events (cross-tab) and a one-time interval
        window.addEventListener('storage', checkRecentlyViewed);
        const interval = setInterval(checkRecentlyViewed, 2000);

        return () => {
            window.removeEventListener('storage', checkRecentlyViewed);
            clearInterval(interval);
        };
    }, [deferredPrompt, visible]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setVisible(false);
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
        setVisible(false);
        setDeferredPrompt(null);
    };

    if (!visible || !deferredPrompt) return null;

    return (
        <div
            role="banner"
            aria-label="Add to Home Screen"
            className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 md:bottom-4 md:left-auto md:right-4 md:max-w-sm"
        >
            <div className="mx-3 md:mx-0 rounded-[1.5rem] bg-[#2D4635] text-white shadow-2xl px-5 py-4 flex items-center gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <p className="flex-1 text-sm font-serif italic leading-snug">
                    Add the Schafer Cookbook to your home screen for the best experience
                </p>
                <div className="flex flex-col gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleInstall}
                        className="px-4 py-2 rounded-full bg-white text-[#2D4635] text-[10px] font-black uppercase tracking-widest hover:bg-stone-100 transition-colors min-h-[2.75rem] whitespace-nowrap"
                    >
                        Install
                    </button>
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="px-4 py-2 rounded-full border border-white/30 text-white/80 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors min-h-[2.75rem] whitespace-nowrap"
                    >
                        Not now
                    </button>
                </div>
            </div>
        </div>
    );
};
