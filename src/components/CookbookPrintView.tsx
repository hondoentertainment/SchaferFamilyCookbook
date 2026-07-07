import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Recipe } from '../types';
import { siteConfig } from '../config/site';
import { CATEGORY_META } from '../constants/taxonomy';
import { useFocusTrap } from '../utils/focusTrap';
import { hapticLight } from '../utils/haptics';

interface CookbookPrintViewProps {
    recipes: Recipe[];
    onClose: () => void;
}

/** Group recipes by category, in taxonomy order, alphabetical within a chapter. */
function groupByCategory(recipes: Recipe[]): Array<{ category: string; recipes: Recipe[] }> {
    const known = Object.keys(CATEGORY_META).filter((c) => c !== 'Generic');
    const byCategory = new Map<string, Recipe[]>();
    for (const recipe of recipes) {
        const list = byCategory.get(recipe.category) ?? [];
        list.push(recipe);
        byCategory.set(recipe.category, list);
    }
    const ordered = [
        ...known.filter((c) => byCategory.has(c)),
        ...[...byCategory.keys()].filter((c) => !known.includes(c)).sort(),
    ];
    return ordered.map((category) => ({
        category,
        recipes: [...(byCategory.get(category) ?? [])].sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

/**
 * The whole archive as a printable heirloom cookbook: cover, table of
 * contents, and one chapter per category. Users print (or save as PDF) with
 * the browser dialog — print CSS in index.css shows only this document.
 */
export const CookbookPrintView: React.FC<CookbookPrintViewProps> = ({ recipes, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useFocusTrap(true, containerRef);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    // Print CSS keys off this class to hide the app and keep the cookbook in
    // normal flow (absolute/fixed boxes don't fragment across printed pages).
    useEffect(() => {
        document.body.classList.add('cookbook-print-open');
        return () => document.body.classList.remove('cookbook-print-open');
    }, []);

    const chapters = useMemo(() => groupByCategory(recipes), [recipes]);
    const contributorCount = useMemo(
        () => new Set(recipes.map((r) => r.contributor.trim()).filter(Boolean)).size,
        [recipes]
    );
    const year = new Date().getFullYear();

    return createPortal(
        <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Printable family cookbook"
            className="cookbook-print-overlay fixed inset-0 z-[150] bg-stone-900/70 backdrop-blur-sm overflow-y-auto"
        >
            <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#2D4635] text-white px-4 py-3 shadow-lg">
                <p className="text-sm font-serif italic truncate">
                    Print preview — the whole cookbook ({recipes.length} recipes)
                </p>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        data-testid="cookbook-print-button"
                        onClick={() => {
                            hapticLight();
                            window.print();
                        }}
                        className="min-h-11 px-5 py-2 rounded-full bg-white text-[#2D4635] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-colors"
                    >
                        Print / Save as PDF
                    </button>
                    <button
                        type="button"
                        data-testid="cookbook-close-button"
                        onClick={onClose}
                        aria-label="Close cookbook preview"
                        className="min-h-11 min-w-11 px-3 rounded-full border border-white/40 text-white hover:bg-white/10 transition-colors"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="print-cookbook-content mx-auto my-6 print:my-0 w-full max-w-3xl bg-white text-stone-900 shadow-2xl print:shadow-none rounded-lg print:rounded-none">
                {/* Cover */}
                <section className="px-10 py-24 text-center space-y-6 border-b border-stone-200">
                    {siteConfig.tagline && (
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#A0522D]">
                            {siteConfig.tagline}
                        </p>
                    )}
                    <h1 className="font-serif italic text-5xl leading-tight text-[#2D4635]">
                        {siteConfig.siteName}
                    </h1>
                    <p className="font-serif italic text-lg text-stone-600 max-w-md mx-auto">
                        {recipes.length} recipes from {contributorCount} family cook
                        {contributorCount === 1 ? '' : 's'}, gathered with love.
                    </p>
                    <p className="text-xs uppercase tracking-widest text-stone-400">Printed {year}</p>
                </section>

                {/* Table of contents */}
                <section aria-label="Table of contents" className="px-10 py-10 border-b border-stone-200 print-page-break">
                    <h2 className="font-serif italic text-3xl text-[#2D4635] mb-6">Table of Contents</h2>
                    <div className="space-y-6">
                        {chapters.map(({ category, recipes: chapterRecipes }) => (
                            <div key={category}>
                                <h3 className="text-xs font-black uppercase tracking-widest text-[#A0522D] mb-2">
                                    {CATEGORY_META[category]?.icon ? `${CATEGORY_META[category]!.icon} ` : ''}
                                    {category}
                                </h3>
                                <ul className="space-y-1">
                                    {chapterRecipes.map((r) => (
                                        <li key={r.id} className="flex items-baseline gap-2 text-sm">
                                            <span className="font-serif italic">{r.title}</span>
                                            <span className="flex-1 border-b border-dotted border-stone-300" aria-hidden />
                                            <span className="text-stone-500">{r.contributor}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Chapters */}
                {chapters.map(({ category, recipes: chapterRecipes }) => (
                    <section key={category} aria-label={`${category} chapter`} className="print-page-break">
                        <div className="px-10 pt-16 pb-8 text-center border-b border-stone-100">
                            <p className="text-4xl mb-3" aria-hidden>
                                {CATEGORY_META[category]?.icon || CATEGORY_META.Generic.icon}
                            </p>
                            <h2 className="font-serif italic text-4xl text-[#2D4635]">{category}</h2>
                        </div>
                        {chapterRecipes.map((recipe) => (
                            <article key={recipe.id} className="px-10 py-8 border-b border-stone-100 print-avoid-break">
                                <h3 className="font-serif italic text-2xl text-[#2D4635]">{recipe.title}</h3>
                                <p className="text-sm text-stone-500 mt-1">
                                    By {recipe.contributor}
                                    {[
                                        recipe.prepTime && `Prep ${recipe.prepTime}`,
                                        recipe.cookTime && `Cook ${recipe.cookTime}`,
                                        recipe.servings != null && `Serves ${recipe.servings}`,
                                    ]
                                        .filter(Boolean)
                                        .map((part) => ` · ${part}`)
                                        .join('')}
                                </p>
                                <div className="grid grid-cols-[minmax(10rem,14rem)_1fr] gap-6 mt-4 max-md:grid-cols-1">
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0522D] mb-2">
                                            Ingredients
                                        </h4>
                                        <ul className="space-y-1 text-sm leading-relaxed list-disc pl-4">
                                            {recipe.ingredients.map((ing, i) => (
                                                <li key={i}>{ing}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#A0522D] mb-2">
                                            Instructions
                                        </h4>
                                        <ol className="space-y-2 text-sm leading-relaxed list-decimal pl-4">
                                            {recipe.instructions.map((step, i) => (
                                                <li key={i}>{step}</li>
                                            ))}
                                        </ol>
                                    </div>
                                </div>
                                {recipe.notes && (
                                    <p className="mt-4 font-serif italic text-sm text-stone-600 border-l-2 border-[#A0522D]/40 pl-3">
                                        {recipe.notes}
                                    </p>
                                )}
                            </article>
                        ))}
                    </section>
                ))}

                <footer className="px-10 py-12 text-center text-xs uppercase tracking-widest text-stone-400">
                    {siteConfig.siteName} · {year}
                </footer>
            </div>
        </div>,
        document.body
    );
};
