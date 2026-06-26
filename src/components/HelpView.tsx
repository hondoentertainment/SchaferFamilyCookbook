import React from 'react';
import { KEYBOARD_SHORTCUT_ROWS } from '../constants/keyboardShortcuts';
import { siteConfig } from '../config/site';
import { hapticLight } from '../utils/haptics';
import { PageHeader } from './PageHeader';
import { CollapsiblePanel } from './CollapsiblePanel';

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
            className="view-shell view-stack animate-in fade-in slide-in-from-bottom-8 duration-500 motion-reduce:animate-none"
        >
            <PageHeader
                id="help-page-heading"
                titleLevel={1}
                eyebrow={siteConfig.siteName}
                title="Help & shortcuts"
                description="Quick answers for navigating the cookbook and sharing recipes with family."
            />

            <CollapsiblePanel id="help-shortcuts" title="Keyboard shortcuts" defaultOpen>
                <ul className="space-y-2">
                    {KEYBOARD_SHORTCUT_ROWS.map((row) => (
                        <li key={row.keys} className="flex gap-3 rounded-2xl border border-stone-100 px-3 py-2.5 dark:border-[var(--border-color)]">
                            <kbd className="shrink-0 rounded-lg bg-stone-100 px-2 py-1 font-mono text-xs font-bold text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                                {row.keys}
                            </kbd>
                            <span className="text-sm text-stone-700 dark:text-stone-300">{row.description}</span>
                        </li>
                    ))}
                </ul>
            </CollapsiblePanel>

            <CollapsiblePanel id="help-tips" title="Tips" defaultOpen>
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
                        <strong className="font-bold">Cook mode</strong> keeps your screen awake and works offline for steps and ingredients.
                    </li>
                    <li>
                        <strong className="font-bold">Collections</strong> under Groceries let you group recipes — start from a template or build your own shelf.
                    </li>
                    <li>Copy or share your grocery list from the list header when you head to the store.</li>
                    <li>Offline? Your edits may queue until you reconnect; check the banner at the top when something is pending.</li>
                </ul>
                <button
                    type="button"
                    onClick={replayTour}
                    className="mt-4 inline-flex min-h-11 items-center rounded-full border border-[#E8DCCB] bg-white px-6 py-3 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 transition-colors"
                >
                    Replay the welcome tour
                </button>
            </CollapsiblePanel>

            <CollapsiblePanel id="help-privacy" title="Privacy & data">
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
            </CollapsiblePanel>
        </main>
    );
};
