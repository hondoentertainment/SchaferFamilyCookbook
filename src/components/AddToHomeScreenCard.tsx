import React from 'react';
import { getInstallInstructions, isIosDevice, isStandaloneDisplay } from '../utils/pwaInstall';

/** Persistent, non-nagging Home Screen path on Me / Help. Hidden in standalone PWA. */
export const AddToHomeScreenCard: React.FC<{ className?: string }> = ({ className = '' }) => {
    if (typeof window !== 'undefined' && isStandaloneDisplay(window)) return null;

    const isIos = typeof navigator !== 'undefined' && isIosDevice(navigator.userAgent);
    const copy = getInstallInstructions(isIos);

    return (
        <aside
            data-testid="add-to-home-screen-card"
            className={`rounded-3xl border border-[#E8DCCB] bg-[#FFF8EC] p-5 dark:border-stone-700 dark:bg-stone-900/60 ${className}`}
        >
            <p className="label text-[#7A3F22] dark:text-orange-200/90">Home Screen</p>
            <h3 className="mt-1 font-serif italic text-xl text-[var(--color-brand)] dark:text-emerald-200">{copy.title}</h3>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 font-serif italic leading-relaxed">{copy.body}</p>
        </aside>
    );
};
