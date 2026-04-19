import React, { useEffect, useState } from 'react';
import { Recipe } from '../types';
import { getFeaturedIds } from '../services/featured';

interface FeaturedRecipesProps {
    recipes: Recipe[];
    onSelect: (recipe: Recipe) => void;
}

const isValidImageUrl = (url?: string) =>
    !!url && (url.startsWith('/recipe-images/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/'));

/**
 * Featured Recipes carousel.
 *
 * Reads curated recipe IDs (admin-managed) and surfaces matching recipes as a
 * horizontal scroll strip at the top of the Recipes tab. Renders nothing when
 * no featured IDs are configured or none of them resolve to a known recipe.
 */
export const FeaturedRecipes: React.FC<FeaturedRecipesProps> = ({ recipes, onSelect }) => {
    const [ids, setIds] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getFeaturedIds().then(fetched => {
            if (cancelled) return;
            setIds(fetched);
            setLoaded(true);
        }).catch(() => {
            if (cancelled) return;
            setLoaded(true);
        });
        return () => { cancelled = true; };
    }, []);

    if (!loaded) return null;

    const byId = new Map(recipes.map(r => [r.id, r]));
    const featured: Recipe[] = ids
        .map(id => byId.get(id))
        .filter((r): r is Recipe => !!r);

    if (featured.length === 0) return null;

    return (
        <section
            aria-label="Featured recipes"
            data-testid="featured-recipes"
            className="space-y-3"
        >
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#A0522D] dark:text-amber-300">
                    ⭐ Featured
                </span>
                <div className="h-px bg-stone-200 dark:bg-stone-700 flex-1" />
            </div>
            <div
                className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar scroll-smooth"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {featured.map(recipe => {
                    const hasImage = isValidImageUrl(recipe.image);
                    return (
                        <button
                            key={recipe.id}
                            type="button"
                            onClick={() => onSelect(recipe)}
                            className="snap-start flex-shrink-0 w-48 md:w-56 group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF7] dark:focus-visible:ring-offset-stone-900 rounded-[1.75rem]"
                            aria-label={`View featured recipe: ${recipe.title}`}
                        >
                            <div className="relative aspect-[4/5] rounded-[1.75rem] overflow-hidden bg-stone-200 dark:bg-stone-700 shadow-md group-hover:shadow-xl transition-all">
                                {hasImage ? (
                                    <img
                                        src={recipe.image}
                                        alt={recipe.title}
                                        width={400}
                                        height={500}
                                        loading="lazy"
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="absolute inset-0 bg-gradient-to-br from-[#2D4635] to-[#A0522D]" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute top-3 left-3">
                                    <span className="inline-block px-2.5 py-1 rounded-full bg-amber-400/90 text-stone-900 text-[9px] font-black uppercase tracking-widest shadow">
                                        ⭐ Featured
                                    </span>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 p-4">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-200/90">{recipe.category}</span>
                                    <h3 className="text-lg md:text-xl font-serif italic text-white leading-tight drop-shadow-md mt-1 line-clamp-2">
                                        {recipe.title}
                                    </h3>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

export default FeaturedRecipes;
