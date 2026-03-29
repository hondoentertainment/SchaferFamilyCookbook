import React, { useState, useMemo } from 'react';
import { Recipe, UserProfile } from '../types';
import { useUI } from '../context/UIContext';
import { shouldToastImageError } from '../utils/imageErrorToast';
import { avatarOnError } from '../utils/avatarFallback';
import { hapticLight } from '../utils/haptics';
import { getRecentRecipeIds, getRecentlyViewedEntries } from '../utils/recentlyViewed';

/* ---------- helpers ---------- */

const isValidImageUrl = (url: string) =>
    !!url && (url.startsWith('/recipe-images/') || url.startsWith('http://') || url.startsWith('https://'));

const RecipeCardImage: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
    const [broken, setBroken] = useState(false);
    const { toast } = useUI();
    const hasValidImage = isValidImageUrl(recipe.image) && !broken;

    const handleImageError = () => {
        setBroken(true);
        if (shouldToastImageError(recipe.id)) {
            toast("Some recipe images couldn't load. Check your connection and refresh.", 'info');
        }
    };

    if (hasValidImage) {
        return (
            <img
                src={recipe.image}
                width={800}
                height={600}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
                alt={recipe.title}
                onError={handleImageError}
            />
        );
    }

    return (
        <>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-200 to-stone-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2D4635]/80 to-transparent" />
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg z-10">
                <span className="text-xs">📝</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-stone-500">Recipe coming</span>
            </div>
        </>
    );
};

const RecipeGridSkeleton: React.FC = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-[2rem] bg-stone-200 animate-pulse" />
        ))}
    </div>
);

/* ---------- RecipeGrid ---------- */

interface RecipeGridProps {
    recipes: Recipe[];
    currentUser: UserProfile;
    onOpenRecipe: (recipe: Recipe) => void;
    isFavorite: (id: string) => boolean;
    onToggleFavorite: (id: string) => void;
    isDataLoading?: boolean;
    /** Resolve contributor avatar URL from a name */
    getAvatar: (name: string) => string;
    /** Number of recipes in the DB (for the hero banner count) */
    recipeCount: number;
    /** Show add recipe button (admin only) */
    onShowAddRecipe?: () => void;
    /** Navigate to profile tab for editing a recipe with AI */
    onEditRecipeAdmin?: (recipe: Recipe) => void;
}

export const RecipeGrid: React.FC<RecipeGridProps> = ({
    recipes,
    currentUser,
    onOpenRecipe,
    isFavorite,
    onToggleFavorite,
    isDataLoading,
    getAvatar,
    recipeCount,
    onShowAddRecipe,
    onEditRecipeAdmin,
}) => {
    // Filters
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [contributor, setContributor] = useState('All');
    const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'category' | 'contributor' | 'recent'>('title-asc');
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    const filteredRecipes = useMemo(() => {
        return recipes.filter(r => {
            const matchS = r.title.toLowerCase().includes(search.toLowerCase());
            const matchC = category === 'All' || r.category === category;
            const matchA = contributor === 'All' || r.contributor === contributor;
            return matchS && matchC && matchA;
        });
    }, [recipes, search, category, contributor]);

    const recentIds = useMemo(() => getRecentRecipeIds(), [recipes]);
    const activeFilterCount = [category !== 'All', contributor !== 'All', sortBy !== 'title-asc'].filter(Boolean).length;

    const sortedRecipes = useMemo(() => {
        const list = [...filteredRecipes];
        switch (sortBy) {
            case 'title-desc':
                return list.sort((a, b) => b.title.localeCompare(a.title));
            case 'category':
                return list.sort((a, b) =>
                    a.category.localeCompare(b.category) || a.title.localeCompare(b.title)
                );
            case 'contributor':
                return list.sort((a, b) =>
                    a.contributor.localeCompare(b.contributor) || a.title.localeCompare(b.title)
                );
            case 'recent':
                return list.sort((a, b) => {
                    const ia = recentIds.indexOf(a.id);
                    const ib = recentIds.indexOf(b.id);
                    if (ia === -1 && ib === -1) return a.title.localeCompare(b.title);
                    if (ia === -1) return 1;
                    if (ib === -1) return -1;
                    return ia - ib;
                });
            default:
                return list.sort((a, b) => a.title.localeCompare(b.title));
        }
    }, [filteredRecipes, sortBy, recentIds]);

    const clearRecipeFilters = () => {
        setSearch('');
        setCategory('All');
        setContributor('All');
        setSortBy('title-asc');
    };

    const favoriteIds = useMemo(() => {
        const ids = new Set<string>();
        recipes.forEach(r => { if (isFavorite(r.id)) ids.add(r.id); });
        return ids;
    }, [recipes, isFavorite]);

    return (
        <main className="max-w-[1600px] mx-auto pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] py-8 md:py-12 space-y-12">
            {/* Hero Section */}
            <div className="relative rounded-[3rem] overflow-hidden bg-[#2D4635] text-white p-8 md:p-20 shadow-2xl">
                <div className="relative z-10 max-w-2xl space-y-6">
                    <span className="inline-block px-4 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-emerald-100">
                        Est. 2024 &bull; The Schafer Collection
                    </span>
                    <h1 className="text-5xl md:text-7xl font-serif italic leading-[0.9]">
                        Preserving the <span className="text-[#F4A460]">flavor</span> of our family history.
                    </h1>
                    <div className="flex gap-4 pt-4">
                        <div className="h-px bg-white/20 flex-1 my-auto" />
                        <p className="text-emerald-100/60 text-xs uppercase tracking-widest">
                            {recipeCount} Recipes Archived
                        </p>
                    </div>
                </div>
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#F4A460] rounded-full blur-[100px] opacity-20" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-400 rounded-full blur-[80px] opacity-10" />
            </div>

            <div className="sticky top-16 md:top-24 z-30 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                    <div className="relative flex-1">
                        <label htmlFor="recipe-search" className="sr-only">Search recipes by title</label>
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">🔍</span>
                        <input
                            id="recipe-search"
                            type="text"
                            placeholder="Search by title..."
                            aria-label="Search recipes by title"
                            className="w-full pl-14 pr-6 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none focus:ring-2 focus:ring-[#2D4635]/10 transition-all font-serif italic placeholder:text-stone-300 text-base"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex md:hidden gap-3">
                        <button
                            type="button"
                            onClick={() => setShowMobileFilters(v => !v)}
                            className={`flex-1 min-h-[2.75rem] px-5 py-4 rounded-full border text-[10px] font-black uppercase tracking-widest transition-colors ${
                                showMobileFilters || activeFilterCount > 0
                                    ? 'bg-[#2D4635] text-white border-[#2D4635]'
                                    : 'bg-white/80 text-stone-600 border-stone-200'
                            }`}
                            aria-expanded={showMobileFilters}
                            aria-controls="mobile-recipe-filters"
                        >
                            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                        </button>
                        {currentUser?.role === 'admin' && onShowAddRecipe && (
                            <button
                                type="button"
                                onClick={onShowAddRecipe}
                                className="min-h-[2.75rem] px-5 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-[#2D4635]/90 transition-colors whitespace-nowrap"
                            >
                                + Add
                            </button>
                        )}
                    </div>
                    <div className="hidden md:flex gap-6">
                        <label htmlFor="recipe-category" className="sr-only">Filter by category</label>
                        <select id="recipe-category" aria-label="Filter by category" className="px-8 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none text-base font-bold text-stone-600 cursor-pointer hover:bg-white min-h-[2.75rem]" value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="All">All Categories</option>
                            {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <label htmlFor="recipe-contributor" className="sr-only">Filter by contributor</label>
                        <select id="recipe-contributor" aria-label="Filter by contributor" className="px-8 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none text-base font-bold text-stone-600 cursor-pointer hover:bg-white min-h-[2.75rem]" value={contributor} onChange={e => setContributor(e.target.value)}>
                            <option value="All">All Contributors</option>
                            {Array.from(new Set(recipes.map(r => r.contributor))).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <label htmlFor="recipe-sort" className="sr-only">Sort recipes</label>
                        <select id="recipe-sort" aria-label="Sort recipes" className="px-8 py-4 bg-white/80 backdrop-blur border border-stone-200 rounded-full shadow-sm outline-none text-base font-bold text-stone-600 cursor-pointer hover:bg-white min-h-[2.75rem]" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                            <option value="title-asc">A–Z</option>
                            <option value="title-desc">Z–A</option>
                            <option value="category">Category</option>
                            <option value="contributor">Contributor</option>
                            <option value="recent">Recently viewed</option>
                        </select>
                        {currentUser?.role === 'admin' && onShowAddRecipe && (
                            <button
                                type="button"
                                onClick={onShowAddRecipe}
                                className="px-6 py-4 bg-[#2D4635] text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-[#2D4635]/90 transition-colors min-h-[2.75rem] whitespace-nowrap"
                            >
                                + Add New Recipe
                            </button>
                        )}
                    </div>
                </div>

                <div
                    id="mobile-recipe-filters"
                    className={`${showMobileFilters ? 'block' : 'hidden'} md:hidden bg-white/90 backdrop-blur-md border border-stone-200 rounded-[2rem] p-4 shadow-sm space-y-3`}
                >
                    <div className="grid grid-cols-1 gap-3">
                        <select aria-label="Filter by category" className="px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-base font-bold text-stone-600 outline-none" value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="All">All Categories</option>
                            {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select aria-label="Filter by contributor" className="px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-base font-bold text-stone-600 outline-none" value={contributor} onChange={e => setContributor(e.target.value)}>
                            <option value="All">All Contributors</option>
                            {Array.from(new Set(recipes.map(r => r.contributor))).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select aria-label="Sort recipes" className="px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl text-base font-bold text-stone-600 outline-none" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                            <option value="title-asc">A–Z</option>
                            <option value="title-desc">Z–A</option>
                            <option value="category">Category</option>
                            <option value="contributor">Contributor</option>
                            <option value="recent">Recently viewed</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                            {activeFilterCount > 0 ? `${activeFilterCount} filters active` : 'Browsing everything'}
                        </p>
                        <button
                            type="button"
                            onClick={clearRecipeFilters}
                            className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-stone-600 border border-stone-200"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick-access: Recently viewed & Favorites */}
            {!isDataLoading && recipes.length > 0 && (() => {
                const recentEntries = getRecentlyViewedEntries();
                const favRecipeIds = Array.from(favoriteIds);
                const recentRecipes = recentEntries
                    .map((e) => recipes.find((r) => r.id === e.id))
                    .filter((r): r is Recipe => !!r)
                    .slice(0, 8);
                const favRecipes = favRecipeIds
                    .map((id) => recipes.find((r) => r.id === id))
                    .filter((r): r is Recipe => !!r)
                    .slice(0, 8);
                const hasQuickAccess = recentRecipes.length > 0 || favRecipes.length > 0;
                if (!hasQuickAccess) return null;
                return (
                    <div className="space-y-6">
                        {favRecipes.length > 0 && (
                            <section aria-label="Favorite recipes">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-3">❤️ Favorites</h3>
                                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                                    {favRecipes.map((r) => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => onOpenRecipe(r)}
                                            className="flex-shrink-0 w-32 md:w-40 group text-left"
                                            aria-label={`View recipe: ${r.title}`}
                                        >
                                            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-stone-200 shadow-md group-hover:shadow-xl transition-all">
                                                <RecipeCardImage recipe={r} />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                                            </div>
                                            <p className="mt-2 text-sm font-serif italic text-stone-700 truncate group-hover:text-[#2D4635]">{r.title}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                        {recentRecipes.length > 0 && (
                            <section aria-label="Recently viewed recipes">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-3">👁 Recently viewed</h3>
                                <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                                    {recentRecipes.map((r) => (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => onOpenRecipe(r)}
                                            className="flex-shrink-0 w-32 md:w-40 group text-left"
                                            aria-label={`View recipe: ${r.title}`}
                                        >
                                            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-stone-200 shadow-md group-hover:shadow-xl transition-all">
                                                <RecipeCardImage recipe={r} />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                                            </div>
                                            <p className="mt-2 text-sm font-serif italic text-stone-700 truncate group-hover:text-[#2D4635]">{r.title}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                );
            })()}

            {isDataLoading ? (
                <RecipeGridSkeleton />
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {sortedRecipes.map(recipe => (
                        <div
                            key={recipe.id}
                            onClick={() => onOpenRecipe(recipe)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onOpenRecipe(recipe);
                                }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`View recipe: ${recipe.title}`}
                            className="group cursor-pointer relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-stone-200 shadow-md hover:shadow-2xl transition-all duration-500 focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF7]"
                        >
                            <RecipeCardImage recipe={recipe} />

                            <div className="absolute inset-0 bg-gradient-to-br from-[#2D4635]/20 to-[#A0522D]/20 group-[.fallback-gradient]:from-[#2D4635] group-[.fallback-gradient]:to-[#A0522D]" />

                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end">
                                <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                                    <div className="flex justify-between items-center mb-2 opacity-80">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-200">{recipe.category}</span>
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-serif italic text-white leading-none mb-1 shadow-black drop-shadow-md">{recipe.title}</h3>
                                    <p className="text-[10px] text-stone-300 uppercase tracking-widest mt-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity delay-100 flex items-center gap-1">
                                        By <img src={getAvatar(recipe.contributor)} className="w-4 h-4 rounded-full inline-block object-cover align-middle" alt={recipe.contributor} onError={avatarOnError} /> {recipe.contributor}
                                    </p>
                                </div>
                            </div>

                            {/* Favorite button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(recipe.id);
                                }}
                                className={`absolute top-4 left-4 w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-full backdrop-blur-sm flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shadow-lg hover:scale-110 z-20 ${
                                    isFavorite(recipe.id)
                                        ? 'bg-red-50/90 text-red-500'
                                        : 'bg-white/90 text-stone-400 hover:text-red-400'
                                }`}
                                title={isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                                aria-label={isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <span className="text-lg">{isFavorite(recipe.id) ? '❤️' : '🤍'}</span>
                            </button>
                            {/* Admin Quick-Action Button */}
                            {currentUser?.role === 'admin' && onEditRecipeAdmin && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditRecipeAdmin(recipe);
                                    }}
                                    className="absolute top-4 right-4 w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] rounded-full bg-white/90 backdrop-blur-sm text-[#A0522D] flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all shadow-lg hover:scale-110 hover:bg-white z-20"
                                    title="Edit with AI"
                                    aria-label={`Edit ${recipe.title} with AI`}
                                >
                                    ✨
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!isDataLoading && filteredRecipes.length === 0 && (
                <div className="py-20 text-center space-y-6">
                    <span className="text-5xl" aria-hidden="true">🍂</span>
                    <div className="space-y-2">
                        <p className="font-serif italic text-stone-600 text-lg">
                            {recipes.length === 0
                                ? 'No recipes found in the archive.'
                                : 'No recipes match your current filters.'}
                        </p>
                        <p className="text-stone-400 text-sm">
                            {recipes.length === 0
                                ? (currentUser?.role === 'admin' ? 'Use Add New Recipe to add recipes.' : 'Ask an administrator to add recipes.')
                                : 'Try a different search or filter.'}
                        </p>
                        {recipes.length > 0 ? (
                            <button
                                type="button"
                                onClick={clearRecipeFilters}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-[#2D4635] text-white text-sm font-bold uppercase tracking-widest rounded-full hover:bg-[#2D4635]/90 transition-colors"
                            >
                                Clear filters
                            </button>
                        ) : currentUser?.role === 'admin' && onShowAddRecipe && (
                            <button
                                type="button"
                                onClick={onShowAddRecipe}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-[#2D4635] text-white text-sm font-bold uppercase tracking-widest rounded-full hover:bg-[#2D4635]/90 transition-colors"
                            >
                                Add New Recipe
                            </button>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
};
