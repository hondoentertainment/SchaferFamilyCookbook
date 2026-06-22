import React from 'react';
import { KEYBOARD_SHORTCUT_ROWS } from '../constants/keyboardShortcuts';
import { siteConfig } from '../config/site';
import { hapticLight } from '../utils/haptics';

export const HelpView: React.FC = () => {
    const openPrivacy = () => {
        hapticLight();
        window.dispatchEvent(new CustomEvent('schafer:navigate', { detail: 'Privacy' }));
    };

    const replayTour = () => {
        hapticLight();
        window.dispatchEvent(new CustomEvent('schafer:replay-onboarding'));
    };

    return (
        <main
            id="main-content-help"
            tabIndex={-1}
            role="main"
            aria-label="Help and shortcuts"
            className="mx-auto max-w-3xl px-4 py-10 md:py-14 md:px-6 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-500 motion-reduce:animate-none"
        >
            <header className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#7A3F22] dark:text-orange-200">{siteConfig.siteName}</p>
                <h1 className="font-serif text-4xl italic text-[#2D4635] dark:text-emerald-100">Help &amp; shortcuts</h1>
                <p className="font-serif text-lg italic text-stone-600 dark:text-stone-400 leading-relaxed">
                    Quick answers for navigating the cookbook and sharing recipes with family.
                </p>
            </header>

            <section aria-labelledby="help-shortcuts-heading" className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
                <h2 id="help-shortcuts-heading" className="text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 mb-4">
                    Keyboard
                </h2>
                <ul className="space-y-3">
                    {KEYBOARD_SHORTCUT_ROWS.map((row) => (
                        <li key={row.keys} className="flex gap-4 rounded-2xl border border-stone-100 px-4 py-3 dark:border-[var(--border-color)]">
                            <kbd className="shrink-0 rounded-lg bg-stone-100 px-2 py-1 font-mono text-xs font-bold text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                                {row.keys}
                            </kbd>
                            <span className="text-sm text-stone-700 dark:text-stone-300">{row.description}</span>
                        </li>
                    ))}
                </ul>
            </section>

            <section aria-labelledby="help-tips-heading" className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-[var(--border-color)] dark:bg-[var(--card-bg)] space-y-4">
                <h2 id="help-tips-heading" className="text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400">
                    Tips
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-sm text-stone-700 dark:text-stone-300">
                    <li>
                        <strong className="font-bold">Home</strong> picks up favorites, tonight&apos;s meal plan, and seasonal ideas. Use <strong className="font-bold">Recipes</strong> to search the full archive.
                    </li>
                    <li>
                        The pill bar under the header switches sub-sections — e.g. Groceries → Meal Plan or Collections without losing your place.
                    </li>
                    <li>
                        Use the <strong className="font-bold">Read / Cook / Share</strong> modes at the top of a recipe to focus on story, cooking, or sending a link.
                    </li>
                    <li>
                        <strong className="font-bold">Cook mode</strong> keeps your screen awake and works offline for steps and ingredients. Save the recipe image before you lose signal if you want the photo too.
                    </li>
                    <li>
                        <strong className="font-bold">Collections</strong> under Groceries let you group recipes — start from a template or build your own shelf.
                    </li>
                    <li>
                        Copy or share your grocery list from the list header when you head to the store.
                    </li>
                    <li>Offline? Your edits may queue until you reconnect; check the banner at the top when something is pending.</li>
                </ul>
                <button
                    type="button"
                    onClick={replayTour}
                    className="inline-flex min-h-11 items-center rounded-full border border-[#E8DCCB] bg-white px-6 py-3 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 transition-colors"
                >
                    Replay the welcome tour
                </button>
            </section>

            <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-[var(--border-color)] dark:bg-[var(--card-bg)]">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-500 dark:text-stone-400 mb-3">
                    Privacy &amp; data
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-4 font-serif italic leading-relaxed">
                    See what stays on your device versus the family cloud in Privacy &amp; Data.
                </p>
                <button
                    type="button"
                    onClick={openPrivacy}
                    className="inline-flex min-h-11 items-center rounded-full bg-[#2D4635] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-md hover:bg-[#24382b] transition-colors focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 motion-reduce:transition-none"
                >
                    Open Privacy &amp; Data →
                </button>
            </section>
        </main>
    );
};
