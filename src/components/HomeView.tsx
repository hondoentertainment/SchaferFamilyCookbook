import React, { useMemo, useState } from 'react';
import { Recipe, ContributorProfile, UserProfile } from '../types';
import { getAverageRating, getRatingCount, isFamilyApproved } from '../utils/ratings';
import { getActivityFeed, formatTimeAgo, getActivityIcon } from '../utils/activityFeed';
import { contributorAvatarUrlForName } from '../utils/contributorAvatar';
import { avatarOnError } from '../utils/avatarFallback';
import { hapticLight } from '../utils/haptics';
import { getEntriesForDate, toDateKey } from '../utils/mealPlan';
import { RecipeImage } from './RecipeImage';
import { CollapsiblePanel } from './CollapsiblePanel';

interface HomeViewProps {
    currentUser: UserProfile;
    recipes: Recipe[];
    favoriteRecipes: Recipe[];
    recentlyViewedRecipes: Recipe[];
    contributors: ContributorProfile[];
    onSelectRecipe: (recipe: Recipe) => void;
    onStartCook: (recipe: Recipe) => void;
    onSetTab: (tab: string) => void;
    /** Opens Recipes and focuses the search field */
    onBrowseAllRecipes?: () => void;
    onSelectCategory: (category: string) => void;
    onSelectContributor: (contributor: string) => void;
    onOpenMealPlan: () => void;
    isFavorite: (id: string) => boolean;
    onToggleFavorite: (id: string) => void;
    /** When > 0, shows a shortcut card to the Family Heritage Quiz */
    triviaQuestionCount?: number;
    /** Bumps when meal plan prefs sync so tonight's plan refreshes */
    mealPlanSyncVersion?: number;
}

const SEASON_TAGS_BY_MONTH: Record<number, { label: string; keywords: string[]; emoji: string }> = {
    0: { label: 'Cozy January', keywords: ['soup', 'stew', 'chili', 'roast', 'braise', 'bread'], emoji: '❄️' },
    1: { label: 'February warmth', keywords: ['chocolate', 'soup', 'stew', 'pasta', 'bread'], emoji: '🍫' },
    2: { label: 'Early spring', keywords: ['lemon', 'asparagus', 'pea', 'herb', 'fresh'], emoji: '🌷' },
    3: { label: 'Easter & spring', keywords: ['ham', 'egg', 'lamb', 'carrot', 'asparagus', 'spring'], emoji: '🐣' },
    4: { label: 'May freshness', keywords: ['strawberry', 'rhubarb', 'salad', 'lemon', 'spring'], emoji: '🌿' },
    5: { label: 'Summer grilling', keywords: ['grill', 'bbq', 'burger', 'corn', 'tomato', 'berry'], emoji: '🔥' },
    6: { label: 'Peak summer', keywords: ['tomato', 'corn', 'berry', 'grill', 'salad', 'ice cream'], emoji: '☀️' },
    7: { label: 'Garden harvest', keywords: ['zucchini', 'tomato', 'corn', 'peach', 'basil'], emoji: '🍅' },
    8: { label: 'Back to school', keywords: ['apple', 'pumpkin', 'soup', 'casserole', 'bread'], emoji: '🍎' },
    9: { label: 'October harvest', keywords: ['pumpkin', 'apple', 'squash', 'cinnamon', 'caramel', 'soup'], emoji: '🎃' },
    10: { label: 'Thanksgiving', keywords: ['turkey', 'stuffing', 'cranberry', 'sweet potato', 'pie', 'pumpkin'], emoji: '🦃' },
    11: { label: 'Holiday baking', keywords: ['cookie', 'cake', 'gingerbread', 'peppermint', 'eggnog', 'pie', 'roast'], emoji: '🎄' },
};

function pickRecipeOfWeek(recipes: Recipe[]): Recipe | null {
    if (recipes.length === 0) return null;
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const weekOfYear = Math.floor((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const sorted = [...recipes].sort((a, b) => a.id.localeCompare(b.id));
    return sorted[weekOfYear % sorted.length] ?? sorted[0];
}

function findSeasonalRecipes(recipes: Recipe[], keywords: string[], limit = 6): Recipe[] {
    const matched = recipes.filter((r) => {
        const haystack = [
            r.title,
            r.category,
            ...(r.tags ?? []),
            ...(r.ingredients ?? []),
        ].join(' ').toLowerCase();
        return keywords.some((kw) => haystack.includes(kw));
    });
    return matched.slice(0, limit);
}

const RecipeMiniCard: React.FC<{
    recipe: Recipe;
    onClick: () => void;
    onStartCook?: () => void;
    isFavorite: boolean;
    onToggleFavorite: () => void;
}> = ({ recipe, onClick, onStartCook, isFavorite, onToggleFavorite }) => {
    const rating = getAverageRating(recipe.id);
    const ratingCount = getRatingCount(recipe.id);
    return (
        <article className="group relative w-44 shrink-0 sm:w-52">
            <div className="recipe-card-surface flex w-full flex-col overflow-hidden rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-xl dark:border-stone-800">
                <button
                    type="button"
                    onClick={onClick}
                    aria-label={`Open recipe: ${recipe.title}`}
                    className="relative block w-full text-left"
                >
                    <div className="relative aspect-[4/5] overflow-hidden bg-stone-100 dark:bg-stone-800">
                        <RecipeImage recipe={recipe} imgClassName="group-hover:scale-[1.04] motion-reduce:group-hover:scale-100" />
                    </div>
                    <div className="space-y-1.5 p-4 pb-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A0522D]/85">{recipe.category}</p>
                        <h3 className="text-sm font-serif italic text-[#2D4635] dark:text-emerald-100 line-clamp-2 leading-snug">{recipe.title}</h3>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                            By {recipe.contributor}
                            {rating > 0 && <span className="text-amber-600 ml-1">· ★ {rating.toFixed(1)}{ratingCount > 0 ? ` (${ratingCount})` : ''}</span>}
                        </p>
                    </div>
                </button>
                {onStartCook && (
                    <div className="border-t border-[#E8DCCB]/80 px-3 py-2.5 dark:border-stone-700">
                        <button
                            type="button"
                            onClick={() => { hapticLight(); onStartCook(); }}
                            className="min-h-11 w-full rounded-full bg-[#2D4635] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#1B2C22]"
                            aria-label={`Start cooking ${recipe.title}`}
                        >
                            Cook now
                        </button>
                    </div>
                )}
            </div>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                className={`absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur transition-transform hover:scale-110 active:scale-95 ${
                    isFavorite ? 'bg-white/95 text-red-500 shadow-md' : 'bg-black/35 text-white hover:bg-white/95 hover:text-red-500'
                }`}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-label={isFavorite ? `Remove ${recipe.title} from favorites` : `Add ${recipe.title} to favorites`}
            >
                <span className="text-base leading-none">{isFavorite ? '♥' : '♡'}</span>
            </button>
        </article>
    );
};

export const HomeView: React.FC<HomeViewProps> = ({
    currentUser,
    recipes,
    favoriteRecipes,
    recentlyViewedRecipes,
    contributors,
    onSelectRecipe,
    onStartCook,
    onSetTab,
    onBrowseAllRecipes,
    onSelectCategory,
    onSelectContributor,
    onOpenMealPlan,
    isFavorite,
    onToggleFavorite,
    triviaQuestionCount = 0,
    mealPlanSyncVersion = 0,
}) => {
    const month = new Date().getMonth();
    const season = SEASON_TAGS_BY_MONTH[month] ?? SEASON_TAGS_BY_MONTH[6];
    const recipeOfWeek = useMemo(() => pickRecipeOfWeek(recipes), [recipes]);
    const seasonalRecipes = useMemo(() => findSeasonalRecipes(recipes, season.keywords), [recipes, season]);
    const activityEvents = useMemo(() => getActivityFeed().slice(0, 6), [recipes, favoriteRecipes]);

    const tonightRecipes = useMemo(() => {
        void mealPlanSyncVersion;
        const todayKey = toDateKey(new Date());
        const entries = getEntriesForDate(todayKey);
        return entries
            .map((entry) => recipes.find((r) => r.id === entry.recipeId))
            .filter((recipe): recipe is Recipe => !!recipe);
    }, [recipes, mealPlanSyncVersion]);

    const greeting = (() => {
        const hr = new Date().getHours();
        if (hr < 5) return 'Late night, chef';
        if (hr < 12) return 'Good morning';
        if (hr < 17) return 'Good afternoon';
        if (hr < 22) return 'Good evening';
        return 'Late night';
    })();

    const recipeOfWeekRating = recipeOfWeek ? getAverageRating(recipeOfWeek.id) : 0;
    const recipeOfWeekRatingCount = recipeOfWeek ? getRatingCount(recipeOfWeek.id) : 0;
    const recipeOfWeekApproved = recipeOfWeek ? isFamilyApproved(recipeOfWeek.id) : false;

    const hasRecent = recentlyViewedRecipes.length > 0;
    const hasFavorites = favoriteRecipes.length > 0;
    const showRecipeShelf = hasRecent || hasFavorites;
    const [shelfTab, setShelfTab] = useState<'recent' | 'favorites'>(() =>
        hasRecent ? 'recent' : 'favorites',
    );
    const shelfRecipes =
        shelfTab === 'recent'
            ? recentlyViewedRecipes.slice(0, 10)
            : favoriteRecipes.slice(0, 10);

    const activeContributors = useMemo(() => {
        const counts = new Map<string, number>();
        recipes.forEach((r) => counts.set(r.contributor, (counts.get(r.contributor) ?? 0) + 1));
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count]) => {
                const profile = contributors.find((c) => c.name.toLowerCase() === name.toLowerCase());
                return {
                    name,
                    count,
                    avatar: profile?.avatar || contributorAvatarUrlForName(name),
                };
            });
    }, [recipes, contributors]);

    const openRecipes = onBrowseAllRecipes ?? (() => onSetTab('Recipes'));

    return (
        <main
            id="main-content-home"
            tabIndex={-1}
            role="main"
            aria-label="Home"
            className="relative z-10 mx-auto max-w-[1400px] view-stack px-4 py-4 sm:px-6 md:px-8 md:py-6"
        >
            {/* Greeting + quick actions */}
            <section className="heirloom-card overflow-hidden rounded-[2rem] border border-white/80 p-4 dark:border-stone-800 sm:p-6 md:rounded-[2.75rem] md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#7A3F22] dark:text-orange-200">
                            <span aria-hidden>{season.emoji}</span> {season.label}
                        </p>
                        <h1 className="font-serif text-4xl italic leading-[1.02] text-[#2D4635] dark:text-emerald-100 sm:text-5xl md:text-6xl">
                            {greeting}, <span className="text-[#A0522D]">{currentUser.name.split(' ')[0]}</span>.
                        </h1>
                        <p className="max-w-2xl font-serif text-lg italic leading-relaxed text-stone-700 dark:text-stone-300">
                            Heirloom recipes and notes from the family archive — pick up where you left off, or try something new tonight.
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center sm:min-w-72">
                        <div className="rounded-2xl border border-[#E8DCCB] bg-white/60 p-3 dark:border-stone-700 dark:bg-stone-900/60">
                            <p className="font-serif text-2xl italic text-[#2D4635] dark:text-emerald-100">{recipes.length}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">Recipes</p>
                        </div>
                        <div className="rounded-2xl border border-[#E8DCCB] bg-white/60 p-3 dark:border-stone-700 dark:bg-stone-900/60">
                            <p className="font-serif text-2xl italic text-[#2D4635] dark:text-emerald-100">{favoriteRecipes.length}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">Saved</p>
                        </div>
                        <div className="rounded-2xl border border-[#E8DCCB] bg-white/60 p-3 dark:border-stone-700 dark:bg-stone-900/60">
                            <p className="font-serif text-2xl italic text-[#2D4635] dark:text-emerald-100">{contributors.length}</p>
                            <p className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300">Cooks</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-6">
                    <button
                        type="button"
                        onClick={() => { hapticLight(); openRecipes(); }}
                        className="min-h-12 rounded-full bg-[#2D4635] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_26px_rgba(45,70,53,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[#1B2C22] active:scale-[0.98]"
                    >
                        Browse all recipes
                    </button>
                    <button
                        type="button"
                        onClick={() => { hapticLight(); onSetTab('Grocery List'); }}
                        className="min-h-12 rounded-full border border-[#E8DCCB] bg-white/75 px-6 py-3 text-sm font-semibold text-stone-700 transition-colors hover:bg-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                    >
                        Plan & shop
                    </button>
                    <button
                        type="button"
                        onClick={() => { hapticLight(); onSetTab('Gallery'); }}
                        className="min-h-12 rounded-full border border-[#E8DCCB] bg-white/75 px-6 py-3 text-sm font-semibold text-stone-700 transition-colors hover:bg-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                    >
                        Family hub
                    </button>
                </div>
            </section>

            {tonightRecipes.length > 0 && (
                <section aria-labelledby="tonight-heading" className="heirloom-card overflow-hidden rounded-[2rem] border border-white/80 p-5 dark:border-stone-800 sm:p-7">
                    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                        <div>
                            <h2 id="tonight-heading" className="font-serif text-lg italic text-stone-600 dark:text-stone-400">
                                <span aria-hidden>🍽 </span>Tonight&apos;s plan
                            </h2>
                            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                                {tonightRecipes.length} recipe{tonightRecipes.length !== 1 ? 's' : ''} on your meal plan for today
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => { hapticLight(); onOpenMealPlan(); }}
                            className="min-h-11 rounded-full px-3 py-2 text-sm font-semibold text-[#A0522D] hover:bg-[#A0522D]/10"
                        >
                            Full week →
                        </button>
                    </div>
                    <div className="flex flex-col gap-2">
                        {tonightRecipes.map((recipe) => (
                            <div
                                key={recipe.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8DCCB] bg-white/70 px-4 py-3 dark:border-stone-700 dark:bg-stone-900/60"
                            >
                                <button
                                    type="button"
                                    onClick={() => { hapticLight(); onSelectRecipe(recipe); }}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <p className="font-serif italic text-[#2D4635] dark:text-emerald-100 truncate">{recipe.title}</p>
                                    <p className="text-xs text-stone-500 dark:text-stone-400">{recipe.category} · By {recipe.contributor}</p>
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { hapticLight(); onSelectRecipe(recipe); }}
                                        className="min-h-11 rounded-full border border-[#E8DCCB] px-4 py-2 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:text-stone-300"
                                    >
                                        View
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { hapticLight(); onStartCook(recipe); }}
                                        className="min-h-11 rounded-full bg-[#2D4635] px-4 py-2 text-sm font-bold text-white"
                                    >
                                        Cook now
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {triviaQuestionCount > 0 && (
                <section
                    aria-labelledby="home-trivia-teaser-heading"
                    className="heirloom-card overflow-hidden rounded-[2rem] border border-white/80 p-5 dark:border-stone-800 sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                    <div className="space-y-1">
                        <h2 id="home-trivia-teaser-heading" className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                            Family Heritage Quiz
                        </h2>
                        <p className="font-serif text-lg italic text-[#2D4635] dark:text-emerald-100">
                            {triviaQuestionCount} question{triviaQuestionCount !== 1 ? 's' : ''} waiting — test what you know about the family.
                        </p>
                    </div>
                    <button
                        type="button"
                        data-testid="home-open-trivia"
                        onClick={() => { hapticLight(); onSetTab('Trivia'); }}
                        className="min-h-12 shrink-0 rounded-full bg-[#A0522D] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#8B4513] active:scale-[0.98] transition-all"
                    >
                        Play trivia
                    </button>
                </section>
            )}

            {/* Recipe of the week */}
            {recipeOfWeek && (
                <section aria-labelledby="recipe-of-week-heading" className="space-y-4">
                    <div className="flex items-baseline justify-between">
                        <h2 id="recipe-of-week-heading" className="font-serif text-lg italic text-stone-600 dark:text-stone-400">
                            <span aria-hidden>✦ </span>Recipe of the Week
                        </h2>
                        <button
                            type="button"
                            onClick={() => onSelectRecipe(recipeOfWeek)}
                            className="min-h-11 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#A0522D] hover:bg-[#A0522D]/10"
                            aria-label={`Open ${recipeOfWeek.title}`}
                        >
                            Open →
                        </button>
                    </div>
                    <article
                        className="recipe-card-surface group relative block w-full overflow-hidden rounded-[2rem] border text-left transition-all hover:-translate-y-1 hover:shadow-2xl dark:border-stone-800"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => onSelectRecipe(recipeOfWeek)}
                                aria-label={`Open recipe: ${recipeOfWeek.title}`}
                                className="relative aspect-[4/3] md:aspect-auto md:min-h-[18rem] overflow-hidden bg-stone-100 dark:bg-stone-800 text-left"
                            >
                                <RecipeImage recipe={recipeOfWeek} imgClassName="group-hover:scale-[1.03]" eager />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent md:hidden" aria-hidden />
                            </button>
                            <div className="p-6 md:p-10 flex flex-col justify-center space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A0522D]/85">{recipeOfWeek.category}</span>
                                    {recipeOfWeekApproved && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">★ Family Approved</span>
                                    )}
                                </div>
                                <h3 className="text-2xl md:text-3xl font-serif italic text-[#2D4635] dark:text-emerald-100 leading-tight">
                                    {recipeOfWeek.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
                                    <img
                                        src={contributorAvatarUrlForName(recipeOfWeek.contributor)}
                                        alt=""
                                        onError={avatarOnError}
                                        className="w-7 h-7 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                                    />
                                    <span className="font-serif italic min-w-0 truncate">By {recipeOfWeek.contributor}</span>
                                    {recipeOfWeekRating > 0 && (
                                        <span className="text-amber-600 font-semibold shrink-0">· ★ {recipeOfWeekRating.toFixed(1)} ({recipeOfWeekRatingCount})</span>
                                    )}
                                </div>
                                {recipeOfWeek.cookTime && (
                                    <p className="text-xs text-stone-500 dark:text-stone-400">⏱ Cook {recipeOfWeek.cookTime}{recipeOfWeek.servings ? ` · ${recipeOfWeek.servings} servings` : ''}</p>
                                )}
                                <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-3 pt-1">
                                    {recipeOfWeek.notes || `A weekly pick from ${recipeOfWeek.contributor}'s shelf — try it tonight.`}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); hapticLight(); onSelectRecipe(recipeOfWeek); }}
                                        className="min-h-11 rounded-full border border-[#E8DCCB] bg-white/80 px-5 py-2.5 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                                    >
                                        View recipe
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); hapticLight(); onStartCook(recipeOfWeek); }}
                                        className="min-h-11 rounded-full bg-[#2D4635] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#1B2C22]"
                                    >
                                        Cook now
                                    </button>
                                </div>
                            </div>
                        </div>
                    </article>
                </section>
            )}

            {/* Recently viewed / favorites shelf */}
            {showRecipeShelf && (
                <section aria-labelledby="recipe-shelf-heading" className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        {hasRecent && hasFavorites ? (
                            <div
                                role="tablist"
                                aria-label="Your recipes"
                                className="flex gap-1 rounded-full border border-stone-200 bg-white/80 p-1 dark:border-stone-700 dark:bg-stone-900/80"
                            >
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={shelfTab === 'recent'}
                                    id="recipe-shelf-heading"
                                    onClick={() => { hapticLight(); setShelfTab('recent'); }}
                                    className={`min-h-11 rounded-full px-4 py-2 text-sm font-serif italic transition-colors ${
                                        shelfTab === 'recent'
                                            ? 'bg-[#2D4635] text-white'
                                            : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                                    }`}
                                >
                                    Recently viewed
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={shelfTab === 'favorites'}
                                    onClick={() => { hapticLight(); setShelfTab('favorites'); }}
                                    className={`min-h-11 rounded-full px-4 py-2 text-sm font-serif italic transition-colors ${
                                        shelfTab === 'favorites'
                                            ? 'bg-[#2D4635] text-white'
                                            : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                                    }`}
                                >
                                    Favorites ({favoriteRecipes.length})
                                </button>
                            </div>
                        ) : (
                            <h2 id="recipe-shelf-heading" className="font-serif text-lg italic text-stone-600 dark:text-stone-400">
                                {hasRecent ? (
                                    <><span aria-hidden>👁 </span>Recently viewed</>
                                ) : (
                                    <><span aria-hidden>❤ </span>Your favorites</>
                                )}
                            </h2>
                        )}
                        <button
                            type="button"
                            onClick={() => { openRecipes(); }}
                            className="min-h-11 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#A0522D] hover:bg-[#A0522D]/10"
                        >
                            All recipes →
                        </button>
                    </div>
                    <div
                        role="tabpanel"
                        aria-labelledby="recipe-shelf-heading"
                        className="scroll-strip gap-3 -mx-1 px-1"
                    >
                        {shelfRecipes.map((r) => (
                            <RecipeMiniCard
                                key={r.id}
                                recipe={r}
                                onClick={() => onSelectRecipe(r)}
                                onStartCook={() => onStartCook(r)}
                                isFavorite={isFavorite(r.id)}
                                onToggleFavorite={() => onToggleFavorite(r.id)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* In season */}
            {seasonalRecipes.length > 0 && (
                <section aria-labelledby="season-heading" className="space-y-3">
                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                        <h2 id="season-heading" className="font-serif text-lg italic text-stone-600 dark:text-stone-400">
                            <span aria-hidden>{season.emoji} </span>In season this month
                        </h2>
                        <button
                            type="button"
                            onClick={() => { onSelectCategory('All'); onSetTab('Recipes'); }}
                            className="text-[10px] font-bold uppercase tracking-widest text-[#A0522D] hover:underline"
                        >
                            See all →
                        </button>
                    </div>
                    <div className="scroll-strip gap-3 -mx-1 px-1">
                        {seasonalRecipes.map((r) => (
                            <RecipeMiniCard
                                key={r.id}
                                recipe={r}
                                onClick={() => onSelectRecipe(r)}
                                onStartCook={() => onStartCook(r)}
                                isFavorite={isFavorite(r.id)}
                                onToggleFavorite={() => onToggleFavorite(r.id)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Family activity feed + active contributors */}
            <CollapsiblePanel
                id="home-community-panel"
                title="Family kitchen & prolific cooks"
                defaultOpen={false}
                className="rounded-[2rem]"
                panelClassName="pt-2"
            >
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                <div className="md:col-span-2 space-y-3">
                    <h2 className="font-serif text-lg italic text-stone-600 dark:text-stone-400">
                        <span aria-hidden>🏡 </span>Family kitchen, recently
                    </h2>
                    {activityEvents.length > 0 ? (
                        <ul className="rounded-2xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 divide-y divide-stone-100 dark:divide-stone-800">
                            {activityEvents.map((evt) => (
                                <li key={evt.id} className="flex items-start gap-3 px-4 py-3">
                                    <span aria-hidden className="text-lg shrink-0 mt-0.5">{getActivityIcon(evt.type)}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-stone-700 dark:text-stone-200">
                                            <span className="font-bold">{evt.userName}</span>{' '}
                                            <span className="text-stone-500 dark:text-stone-400">{evt.detail}</span>
                                        </p>
                                        <p className="text-[10px] uppercase tracking-widest text-stone-400 mt-0.5">{formatTimeAgo(evt.timestamp)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 bg-white/60 dark:bg-stone-900/60 px-5 py-8 text-center space-y-4">
                            <p className="text-stone-500 dark:text-stone-400 font-serif italic">
                                Nothing yet — favorite a recipe or rate one to get the family feed going.
                            </p>
                            <button
                                type="button"
                                onClick={() => { hapticLight(); openRecipes(); }}
                                className="min-h-11 rounded-full bg-[#2D4635] px-5 py-2 text-sm font-bold text-white"
                            >
                                Browse recipes
                            </button>
                        </div>
                    )}
                </div>
                <div className="space-y-3">
                    <h2 className="font-serif text-lg italic text-stone-600 dark:text-stone-400">
                        <span aria-hidden>👥 </span>Most prolific cooks
                    </h2>
                    <ul className="rounded-2xl border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 divide-y divide-stone-100 dark:divide-stone-800">
                        {activeContributors.map((c) => (
                            <li key={c.name}>
                                <button
                                    type="button"
                                onClick={() => { onSelectContributor(c.name); }}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                                aria-label={`Browse recipes by ${c.name}`}
                                >
                                    <img
                                        src={c.avatar}
                                        alt=""
                                        onError={avatarOnError}
                                        className="w-9 h-9 rounded-full object-cover border border-stone-200 dark:border-stone-700"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-serif italic text-stone-700 dark:text-stone-200 truncate">{c.name}</p>
                                        <p className="text-[10px] uppercase tracking-widest text-stone-400">{c.count} recipe{c.count !== 1 ? 's' : ''}</p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
            </CollapsiblePanel>
        </main>
    );
};
