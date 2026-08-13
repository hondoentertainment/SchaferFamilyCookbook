import React from 'react';
import type { Recipe } from '../types';
import { getFeaturedRecipes } from '../utils/featured';
import { RecipeImage } from './RecipeImage';

interface FeaturedStripProps {
    recipes: readonly Recipe[];
    onSelect: (recipe: Recipe) => void;
}

export const FeaturedStrip: React.FC<FeaturedStripProps> = ({ recipes, onSelect }) => {
    const featured = getFeaturedRecipes(recipes);
    if (featured.length === 0) return null;

    return (
        <section
            aria-label="Featured recipes"
            data-testid="featured-strip"
            className="-mx-1 px-1"
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                        <span aria-hidden="true">★</span>
                        Featured
                    </span>
                    <span className="font-serif text-sm italic text-stone-600 dark:text-stone-400">
                        Hand-picked by the family
                    </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                    {featured.length} {featured.length === 1 ? 'pick' : 'picks'}
                </span>
            </div>

            <ul
                className="flex gap-3 overflow-x-auto pb-2 no-scrollbar scroll-smooth snap-x snap-mandatory"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {featured.map(recipe => (
                    <li key={recipe.id} className="snap-start shrink-0">
                        <button
                            type="button"
                            onClick={() => onSelect(recipe)}
                            data-testid="featured-strip-card"
                            aria-label={`Open featured recipe: ${recipe.title}`}
                            className="group relative flex w-[72vw] max-w-[280px] min-w-[220px] flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white text-left shadow-sm transition-all min-h-[44px] hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:ring-offset-2 dark:border-stone-700 dark:bg-stone-900"
                        >
                            <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                                <RecipeImage recipe={recipe} imgClassName="group-hover:scale-105" compact />
                                <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-md backdrop-blur-sm">
                                    <span aria-hidden="true">★</span>
                                    Featured
                                </span>
                            </div>
                            <div className="flex flex-col gap-1 p-4">
                                <span className="line-clamp-2 font-serif text-base font-bold leading-tight text-[var(--color-brand)] dark:text-emerald-100">
                                    {recipe.title}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                                    {recipe.contributor ? `By ${recipe.contributor}` : recipe.category}
                                </span>
                            </div>
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default FeaturedStrip;
