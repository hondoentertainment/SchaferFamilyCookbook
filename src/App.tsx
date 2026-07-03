import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { UserProfile, Recipe, GalleryItem, Trivia, DBStats, ContributorProfile } from './types';
import { useUI } from './context/UIContext';
import { shouldToastImageError } from './utils/imageErrorToast';
import { RecipeImage, RecipeImageFallback } from './components/RecipeImage';
import { isValidRecipeImageUrl, isCookbookCoverImage, isHandwrittenRecipeCard } from './utils/recipeImage';
import { FirebaseError } from 'firebase/app';
import { CloudArchive } from './services/db';
import {
    subscribeFirebaseCustodian,
    signInCustodianWithGoogle,
    signOutFirebaseCustodian,
    type CustodianAuthState,
} from './services/firebaseCustodianAuth';
import { Header } from './components/Header';
import { PageHeader } from './components/PageHeader';
import { GalleryUploadPanel } from './components/GalleryUploadPanel';
import { OfflineBanner } from './components/OfflineBanner';
import { PLACEHOLDER_AVATAR } from './constants';
import { getAverageRating, getRatingCount, isFamilyApproved } from './utils/ratings';
import { STORAGE_KEYS, SESSION_KEYS } from './constants/storage';
import { addActivity } from './utils/activityFeed';
const RecipeModal = lazy(() => import('./components/RecipeModal').then(m => ({ default: m.RecipeModal })));
const CookModeView = lazy(() => import('./components/CookModeView').then(m => ({ default: m.CookModeView })));
import { BottomNav } from './components/BottomNav';
import { getFavoriteIds, toggleFavorite } from './utils/favorites';
import { useUserPrefsSync, type UserPrefsSyncStatus } from './services/useUserPrefsSync';
import { refreshFamilyPrefs } from './services/familyPrefs';
import { useOfflineRecipeIds } from './hooks/useOfflineRecipeIds';
import { recordRecipeView, getRecentRecipeIds, getRecentlyViewedEntries } from './utils/recentlyViewed';
import { useFocusTrap } from './utils/focusTrap';
import { avatarOnError } from './utils/avatarFallback';
import { hapticLight, hapticSuccess } from './utils/haptics';
import { trackEvent } from './services/analytics';
import { listenForForegroundMessages } from './services/pushNotifications';
import { queueUpload } from './services/offlineUploadQueue';
import { useOfflineUploadQueue } from './hooks/useOfflineUploadQueue';
import { isSuperAdmin, siteConfig } from './config/site';
import { mergeContributorsForDisplay } from './utils/mergeContributorsForDisplay';
import { contributorAvatarUrlForName } from './utils/contributorAvatar';
import { fuzzyMatch } from './utils/fuzzySearch';
import { LoginScreen } from './components/LoginScreen';
import {
    historyForContributor,
    recipesForContributor,
    resolveLoginAffiliation,
    totalContributorContent,
} from './utils/loginMatch';
import { mergeWithDefaultRecipes } from './utils/mergeDefaultRecipes';
import { validateGalleryFile } from './utils/galleryUpload';
import {
    checkGalleryUploadRateLimit,
    recordGalleryUpload,
} from './utils/galleryUploadRateLimit';
import {
    countPendingForContributor,
    countPendingModeration,
    filterGalleryByContributor,
    filterGalleryForViewer,
    isGalleryItemPending,
} from './utils/galleryModeration';
import { addSentryBreadcrumb } from './monitoring/sentry';
import { cacheRecipeOffline, cacheRecipesOffline, getOfflineRecipe } from './utils/recipeOfflineCache';
import {
    CATEGORY_META,
    RECIPE_CATEGORIES,
    getContributorOptions,
    getTagLabel,
    getTagOptions,
    normalizeContributorName,
    contributorMatchKey,
    normalizeRecipes,
} from './constants/taxonomy';

const AddRecipeModal = lazy(() => import('./components/AddRecipeModal').then(m => ({ default: m.AddRecipeModal })));
const HomeView = lazy(() => import('./components/HomeView').then(m => ({ default: m.HomeView })));
const AlphabeticalIndex = lazy(() => import('./components/AlphabeticalIndex').then(m => ({ default: m.AlphabeticalIndex })));
const ContributorsView = lazy(() => import('./components/ContributorsView').then(m => ({ default: m.ContributorsView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const HistoryView = lazy(() => import('./components/HistoryView').then(m => ({ default: m.HistoryView })));
const TriviaView = lazy(() => import('./components/TriviaView').then(m => ({ default: m.TriviaView })));
const PrivacyView = lazy(() => import('./components/PrivacyView').then(m => ({ default: m.PrivacyView })));
const OnboardingWalkthrough = lazy(() => import('./components/OnboardingWalkthrough').then(m => ({ default: m.OnboardingWalkthrough })));
const ContributorSpotlight = lazy(() => import('./components/ContributorSpotlight').then(m => ({ default: m.ContributorSpotlight })));
const GroceryListView = lazy(() => import('./components/GroceryListView').then(m => ({ default: m.GroceryListView })));
const CollectionsView = lazy(() => import('./components/CollectionsView').then(m => ({ default: m.CollectionsView })));
const MealPlanView = lazy(() => import('./components/MealPlanView').then(m => ({ default: m.MealPlanView })));
const InstallPrompt = lazy(() => import('./components/InstallPrompt').then(m => ({ default: m.InstallPrompt })));
const HelpView = lazy(() => import('./components/HelpView').then(m => ({ default: m.HelpView })));
const FeaturedStrip = lazy(() => import('./components/FeaturedStrip').then(m => ({ default: m.FeaturedStrip })));
const CookbookPrintView = lazy(() => import('./components/CookbookPrintView').then(m => ({ default: m.CookbookPrintView })));
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { SectionSubNav } from './components/SectionSubNav';
import { FamilySubNavHint } from './components/FamilySubNavHint';
import { shouldShowGalleryUploadUnavailableBanner } from './utils/galleryUploadAvailability';
import { resolveArchivePhone } from './utils/textToGallery';
import {
    FAMILY_SECONDARY_NAV,
    getFamilyNavDetail,
    getSecondaryNavForTab,
} from './config/navConfig';

const TabFallback = () => (
    <div className="flex items-center justify-center min-h-[50vh] text-stone-500">
        <span className="animate-pulse font-serif italic motion-reduce:animate-none">Loading…</span>
    </div>
);

const SECONDARY_NAV_ARIA: Record<string, string> = {
    family: 'Family hub navigation',
    cook: 'Cooking tools navigation',
    recipes: 'Recipe browsing navigation',
    me: 'Account navigation',
};

function secondaryNavAriaLabel(items: typeof FAMILY_SECONDARY_NAV): string {
    if (items === FAMILY_SECONDARY_NAV) return SECONDARY_NAV_ARIA.family;
    if (items.some((i) => i.id === 'Grocery List')) return SECONDARY_NAV_ARIA.cook;
    if (items.some((i) => i.id === 'Recipes')) return SECONDARY_NAV_ARIA.recipes;
    return SECONDARY_NAV_ARIA.me;
}

const RecipeGridSkeleton: React.FC = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6">
        {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-[2rem] bg-stone-200 animate-pulse" />
        ))}
    </div>
);

const ContributorsSkeleton: React.FC = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
        {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[3rem] p-10 border border-stone-100">
                <div className="w-28 h-28 rounded-full bg-stone-200 animate-pulse mx-auto mb-8" />
                <div className="h-8 bg-stone-200 rounded animate-pulse w-3/4 mx-auto mb-4" />
                <div className="h-4 bg-stone-100 rounded animate-pulse w-1/2 mx-auto" />
                <div className="h-10 bg-stone-100 rounded-full mt-6 animate-pulse" />
            </div>
        ))}
    </div>
);

const GallerySkeleton: React.FC = () => (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
        {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="break-inside-avoid bg-white p-4 rounded-[2rem] border border-stone-100 shadow-md">
                <div className="w-full aspect-video rounded-2xl mb-4 bg-stone-200 animate-pulse" />
                <div className="h-5 bg-stone-200 rounded animate-pulse w-3/4 mb-4" />
                <div className="flex justify-between items-center">
                    <div className="w-4 h-4 rounded-full bg-stone-200 animate-pulse" />
                    <div className="h-3 bg-stone-100 rounded animate-pulse w-24" />
                </div>
            </div>
        ))}
    </div>
);

const IndexSkeleton: React.FC = () => (
    <div className="max-w-5xl mx-auto py-12 px-6 flex flex-col md:flex-row gap-16">
        <div className="md:hidden -mx-6 mb-4">
            <div className="flex gap-2">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-stone-200 animate-pulse" />
                ))}
            </div>
        </div>
        <div className="hidden md:block w-20 shrink-0">
            <div className="flex flex-col gap-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="w-11 h-11 rounded-full bg-stone-200 animate-pulse" />
                ))}
            </div>
        </div>
        <div className="flex-1 space-y-12">
            <div className="h-10 bg-stone-200 rounded w-48 animate-pulse" />
            <div className="space-y-8">
                {[1, 2, 3].map((_, i) => (
                    <div key={i} className="space-y-4">
                        <div className="h-12 bg-stone-100 rounded w-16" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {Array.from({ length: 6 }).map((_, j) => (
                                <div key={j} className="h-20 bg-stone-100 rounded-[2rem] animate-pulse" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const HistorySkeleton: React.FC = () => (
    <div className="max-w-6xl mx-auto py-12 md:py-20 px-4 md:px-6 flex flex-col lg:flex-row gap-12 lg:gap-16">
        <nav className="lg:w-56 shrink-0 space-y-2">
            <div className="h-3 bg-stone-200 rounded w-24 mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-stone-100 rounded-xl animate-pulse" />
            ))}
            <div className="h-12 bg-stone-100 rounded-xl mt-6 w-full animate-pulse" />
        </nav>
        <article className="flex-1 space-y-12">
            <div className="h-24 bg-stone-200 rounded w-3/4 animate-pulse" />
            <div className="space-y-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-4 bg-stone-100 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                ))}
            </div>
            <div className="bg-white rounded-[3rem] p-8 md:p-16 border border-stone-100 space-y-6">
                <div className="h-8 bg-stone-200 rounded w-2/3 animate-pulse" />
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-4 bg-stone-100 rounded animate-pulse" style={{ width: `${65 + i * 5}%` }} />
                    ))}
                </div>
            </div>
        </article>
    </div>
);

const ProfileSkeleton: React.FC = () => (
    <div className="max-w-6xl mx-auto py-8 md:py-12 px-4 md:px-6 space-y-12 md:space-y-16">
        <section className="bg-white rounded-[3rem] md:rounded-[4rem] p-6 md:p-16 border border-stone-100">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-full bg-stone-200 animate-pulse" />
                <div className="flex-1 space-y-6 w-full">
                    <div className="h-16 bg-stone-100 rounded-3xl animate-pulse" />
                    <div className="h-12 bg-stone-200 rounded-full w-32 animate-pulse" />
                </div>
            </div>
        </section>
        <div className="grid lg:grid-cols-2 gap-12">
            <section className="space-y-6">
                <div className="h-8 bg-stone-200 rounded w-48 animate-pulse" />
                <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex gap-4 p-4 bg-stone-50 rounded-[2rem] border border-stone-100">
                            <div className="w-16 h-16 rounded-2xl bg-stone-200 animate-pulse shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-5 bg-stone-200 rounded w-3/4 animate-pulse" />
                                <div className="h-3 bg-stone-100 rounded w-1/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
            <section className="space-y-6">
                <div className="h-8 bg-stone-200 rounded w-48 animate-pulse" />
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-4 p-4 bg-stone-50/50 rounded-2xl border border-stone-100">
                            <div className="w-8 h-8 rounded-full bg-stone-200 animate-pulse shrink-0" />
                            <div className="flex-1 space-y-1">
                                <div className="h-4 bg-stone-100 rounded w-full animate-pulse" />
                                <div className="h-3 bg-stone-100 rounded w-20" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    </div>
);

const GalleryImage: React.FC<{ url: string; caption: string; onClick?: () => void }> = ({ url, caption, onClick }) => {
    const [broken, setBroken] = useState(false);
    if (!url || broken) {
        return (
            <div className="w-full aspect-video rounded-2xl mb-4 bg-gradient-to-br from-stone-100 to-stone-200 flex flex-col items-center justify-center gap-2 text-stone-600 border border-stone-200">
                <span className="text-sm font-bold uppercase tracking-widest opacity-80">Photo</span>
                <span className="text-[10px] font-medium uppercase tracking-wider">{url ? 'Preview unavailable' : 'No image'}</span>
            </div>
        );
    }
    const imgEl = (
        <img
            src={url}
            width={800}
            height={600}
            className={`w-full rounded-2xl mb-4 object-cover max-h-[32rem] ${onClick ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''}`}
            alt={caption || 'Gallery photo'}
            onError={() => setBroken(true)}
            loading="lazy"
            decoding="async"
        />
    );
    if (onClick) {
        return (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                className="w-full text-left rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                aria-label={`View full size: ${caption || 'Gallery photo'}`}
            >
                {imgEl}
            </button>
        );
    }
    return <div>{imgEl}</div>;
};

const GalleryDeleteConfirmDialog: React.FC<{ item: GalleryItem; onClose: () => void; onConfirm: () => void | Promise<void> }> = ({ item, onClose, onConfirm }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const cancelRef = React.useRef<HTMLButtonElement>(null);

    useFocusTrap(true, containerRef);
    useEffect(() => {
        cancelRef.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-delete-title"
            aria-describedby="gallery-delete-desc"
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        >
            <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                aria-label="Close remove from gallery confirmation"
                onClick={onClose}
            />
            <div
                ref={containerRef}
                className="relative bg-white dark:bg-[var(--card-bg)] rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 fade-in duration-200"
            >
                <h3 id="gallery-delete-title" className="text-xl font-serif italic text-[#2D4635] dark:text-emerald-300 mb-2">Remove from gallery?</h3>
                <p id="gallery-delete-desc" className="text-stone-500 dark:text-stone-400 mb-6">
                    &quot;{item.caption}&quot; will be permanently removed. This cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onClose}
                        className="min-h-11 min-w-11 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest text-stone-600 hover:bg-stone-50 transition-colors touch-manipulation"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => { hapticLight(); onConfirm(); }}
                        className="min-h-11 min-w-11 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest text-white bg-red-500 hover:bg-red-600 transition-colors touch-manipulation"
                    >
                        Remove
                    </button>
                </div>
            </div>
        </div>
    );
};

const GalleryLightbox: React.FC<{ item: GalleryItem; onClose: () => void }> = ({ item, onClose }) => {
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        closeRef.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    useFocusTrap(true, containerRef);

    const isVideo = item.type === 'video';

    return (
        <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={isVideo ? 'Fullscreen gallery video' : 'Enlarged gallery image'}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        >
            <div
                role="presentation"
                className="absolute inset-0 cursor-zoom-out bg-black/95 backdrop-blur-lg motion-reduce:backdrop-blur-none"
                onClick={onClose}
            />
            <button
                ref={closeRef}
                onClick={() => { hapticLight(); onClose(); }}
                className="absolute top-[max(1.5rem,env(safe-area-inset-top))] right-[max(1.5rem,env(safe-area-inset-right))] w-12 h-12 min-w-11 min-h-11 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-2xl transition-colors z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white touch-manipulation"
                aria-label="Close"
            >
                ✕
            </button>
            {isVideo ? (
                <video
                    src={item.url}
                    controls
                    autoPlay
                    playsInline
                    className="relative max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500"
                    title={item.caption || 'Family video'}
                    aria-label={`Video: ${item.caption || 'Family memory'}`}
                >
                    <track kind="captions" srcLang="en" label="English" />
                </video>
            ) : (
                <img
                    src={item.url}
                    width={800}
                    height={600}
                    loading="lazy"
                    decoding="async"
                    className="relative max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500 pointer-events-none"
                    alt={item.caption || 'Gallery photo'}
                />
            )}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs uppercase tracking-widest text-center">
                {item.caption}
                <br />
                <span className="text-[10px]">Click anywhere or press Escape to close</span>
            </div>
        </div>
    );
};

import { HistoryEntry } from './types';
import { TRIVIA_SEED } from './data/trivia_seed';
import defaultRecipes from './data/recipes.json';

const OfflineRecipeBadge: React.FC<{ position?: 'left' | 'right' }> = ({ position = 'right' }) => (
    <span
        className={`absolute top-2 z-10 inline-flex items-center gap-1 rounded-full bg-[#2D4635]/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm ${
            position === 'left' ? 'left-2' : 'right-2'
        }`}
        title="Saved for offline cook mode"
    >
        <span aria-hidden>📥</span>
        <span>Offline</span>
    </span>
);

const RecipeCardImage: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
    const { toast } = useUI();
    return (
        <RecipeImage
            recipe={recipe}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 380px"
            imgClassName={isCookbookCoverImage(recipe) ? '' : 'group-hover:scale-110'}
            preferCategoryFallback={isHandwrittenRecipeCard(recipe)}
            fallbackLabel={isHandwrittenRecipeCard(recipe) ? 'Recipe card' : undefined}
            onError={() => {
                if (shouldToastImageError(recipe.id)) {
                    toast("Some recipe images couldn't load. Check your connection and refresh.", 'info');
                }
            }}
        />
    );
};

const HeroRecipeImage: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
    const [broken, setBroken] = useState(false);
    if (!isValidRecipeImageUrl(recipe.image) || broken) {
        return <RecipeImageFallback category={recipe.category} compact label="Hero image unavailable" />;
    }

    if (isCookbookCoverImage(recipe)) {
        return (
            <>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_25%,rgba(160,82,45,0.35),transparent_34%),radial-gradient(circle_at_20%_75%,rgba(16,185,129,0.18),transparent_36%)]" />
                <img
                    src={recipe.image}
                    alt=""
                    className="absolute right-8 top-1/2 hidden h-[78%] w-auto max-w-[42%] -translate-y-1/2 rounded-[1.25rem] object-contain opacity-35 shadow-2xl lg:block"
                    aria-hidden="true"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    onError={() => setBroken(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#1a2a20]/98 via-[#1a2a20]/86 to-[#1a2a20]/62" />
            </>
        );
    }

    return (
        <>
            <img
                src={recipe.image}
                alt=""
                className="w-full h-full object-cover opacity-25"
                aria-hidden="true"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={() => setBroken(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2D4635] via-[#2D4635]/90 to-[#2D4635]/58" />
        </>
    );
};

interface BrowseShelf {
    id: string;
    label: string;
    detail: string;
    recipes: Recipe[];
    action?: () => void;
}

const getRecipeTimeLabel = (recipe: Recipe) => {
    if (recipe.prepTime && recipe.cookTime) return `${recipe.prepTime} prep · ${recipe.cookTime} cook`;
    return recipe.cookTime || recipe.prepTime || '';
};

const parseTimeMinutes = (value?: string): number => {
    if (!value) return 0;
    let s = value.trim().toLowerCase();
    s = s
        .replace(/½/g, '.5')
        .replace(/¼/g, '.25')
        .replace(/¾/g, '.75')
        .replace(/⅓/g, '.33')
        .replace(/⅔/g, '.67');

    const numericRangeMinutes = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
    if (numericRangeMinutes) {
        return Math.round(Math.max(Number(numericRangeMinutes[1]), Number(numericRangeMinutes[2])));
    }

    let minutes = 0;
    const combinedHoursRange = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
    if (combinedHoursRange) {
        return Math.round(Math.max(Number(combinedHoursRange[1]), Number(combinedHoursRange[2])) * 60);
    }

    const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
    const minuteMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);

    const bareRange = (!hourMatch && !minuteMatch
        ? s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)(?!\s*(?:m|min|h|hr|hour))/i)
        : null);
    if (bareRange && !combinedHoursRange && !numericRangeMinutes) {
        return Math.round(Math.max(Number(bareRange[1]), Number(bareRange[2])));
    }

    if (hourMatch) minutes += Number(hourMatch[1]) * 60;
    if (minuteMatch) minutes += Number(minuteMatch[1]);

    if (!hourMatch && !minuteMatch) {
        const firstNumber = s.match(/(\d+(?:\.\d+)?)/);
        if (firstNumber) minutes += Number(firstNumber[1]);
    }
    return Number.isFinite(minutes) ? Math.round(minutes) : 0;
};

const getRecipeEffortLabel = (recipe: Recipe): string => {
    const tags = (recipe.tags ?? []).map((tag) => tag.toLowerCase());
    if (tags.some((tag) => tag.includes('make-ahead') || tag.includes('make ahead'))) return 'Make ahead';
    const totalMinutes = parseTimeMinutes(recipe.prepTime) + parseTimeMinutes(recipe.cookTime);
    if (totalMinutes > 0) {
        if (totalMinutes <= 30) return 'Easy';
        if (totalMinutes <= 75) return 'Weeknight';
        if (totalMinutes <= 150) return 'Weekend';
        return 'Family project';
    }
    if (recipe.ingredients.length <= 6 && recipe.instructions.length <= 4) return 'Easy';
    if (recipe.instructions.length >= 8) return 'Weekend';
    return 'Family classic';
};

const getRecipeCardMicrocopy = (recipe: Recipe, ratingCount: number, isFavorite: boolean, wasViewed: boolean): string => {
    if (isFavorite) return 'Saved to your family table';
    if (wasViewed) return 'Recently viewed - pick up where you left off';
    if (ratingCount >= 5) return `Loved by ${ratingCount} family cooks`;
    if (recipe.collections?.[0]) return `From the ${recipe.collections[0]} collection`;
    if (recipe.tags?.[0]) return `${getTagLabel(recipe.tags[0])} favorite`;
    return `From ${recipe.contributor.split(' ')[0]}'s recipe box`;
};

const getRecipeCardAriaLabel = (
    recipe: Recipe,
    rating: number,
    ratingCount: number,
    effortLabel: string,
    isFavorite: boolean,
    wasViewed: boolean,
    isOffline = false,
) => {
    const parts = [`Open recipe: ${recipe.title}`, `from ${recipe.contributor}`, recipe.category, effortLabel];
    const time = getRecipeTimeLabel(recipe);
    if (time) parts.push(time);
    if (rating > 0) parts.push(`rated ${rating.toFixed(1)} out of 5 from ${ratingCount} ratings`);
    if (isFavorite) parts.push('saved to favorites');
    if (wasViewed) parts.push('recently viewed');
    if (isOffline) parts.push('available offline');
    return parts.join(', ');
};

const RecipeShelfCard: React.FC<{
    recipe: Recipe;
    onSelect: (recipe: Recipe) => void;
    isFavorite: boolean;
    onToggleFavorite: (id: string) => void;
    wasViewed?: boolean;
    isOffline?: boolean;
}> = ({ recipe, onSelect, isFavorite, onToggleFavorite, wasViewed = false, isOffline = false }) => {
    const rating = getAverageRating(recipe.id);
    const ratingCount = getRatingCount(recipe.id);
    const effortLabel = getRecipeEffortLabel(recipe);
    return (
        <article className="recipe-card-surface group relative flex h-full w-60 shrink-0 flex-col overflow-hidden rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-xl focus-within:ring-2 focus-within:ring-[#A0522D] focus-within:ring-offset-2 focus-within:ring-offset-[#FDFBF7] dark:border-stone-800 dark:focus-within:ring-offset-stone-950">
            <button
                type="button"
                onClick={() => onSelect(recipe)}
                data-testid="recipe-card-open"
                data-recipe-id={recipe.id}
                className="flex h-full w-full flex-col text-left"
                aria-label={getRecipeCardAriaLabel(recipe, rating, ratingCount, effortLabel, isFavorite, wasViewed, isOffline)}
            >
                <div className="relative aspect-[16/10] overflow-hidden bg-stone-100 dark:bg-stone-800">
                    <RecipeCardImage recipe={recipe} />
                    {isOffline && <OfflineRecipeBadge position="left" />}
                </div>
                <div className="flex min-h-0 flex-1 flex-col space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-[#A0522D]">{recipe.category}</p>
                        <span className="rounded-full bg-[#FDF6EC] px-2 py-1 text-xs font-semibold text-[#2D4635] dark:bg-stone-800 dark:text-emerald-100">
                            {effortLabel}
                        </span>
                    </div>
                    <h3 className="line-clamp-2 min-h-[2.75rem] font-serif text-lg italic leading-tight text-[#2D4635] dark:text-emerald-100">{recipe.title}</h3>
                    <p className="line-clamp-1 text-xs text-stone-500 dark:text-stone-400">
                        {getRecipeCardMicrocopy(recipe, ratingCount, isFavorite, wasViewed)}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <span className="truncate font-serif italic">By {recipe.contributor}</span>
                        {rating > 0 && <span className="shrink-0 font-semibold text-amber-600">★ {rating.toFixed(1)}</span>}
                    </div>
                    <span className="btn btn-secondary btn-body mt-auto w-full pointer-events-none">
                        View recipe →
                    </span>
                </div>
            </button>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onToggleFavorite(recipe.id);
                }}
                className={`absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition-transform active:scale-95 ${
                    isFavorite ? 'bg-white/95 text-red-500 shadow-md' : 'bg-black/35 text-white hover:bg-white/95 hover:text-red-500'
                }`}
                aria-label={isFavorite ? `Remove ${recipe.title} from favorites` : `Add ${recipe.title} to favorites`}
            >
                <span aria-hidden="true">{isFavorite ? '♥' : '♡'}</span>
            </button>
        </article>
    );
};

function parseRecipeHash(hash: string): { id: string; openCook: boolean } | null {
    const m = hash.match(/^#recipe\/(.+)$/);
    if (!m) return null;
    let path = m[1];
    const openCook = /\/cook\/?$/i.test(path);
    if (openCook) path = path.replace(/\/cook\/?$/i, '');
    try {
        return { id: decodeURIComponent(path), openCook };
    } catch {
        return null;
    }
}

const CLOUD_ERROR_MSG = "Couldn't save. Check your connection and try again.";

const App: React.FC = () => {
    const { toast } = useUI();
    const offlineRecipeIds = useOfflineRecipeIds();
    const [tab, setTab] = useState('Home');
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [gallery, setGallery] = useState<GalleryItem[]>([]);
    const [trivia, setTrivia] = useState<Trivia[]>([]);
    const [contributors, setContributors] = useState<ContributorProfile[]>([]);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [selectedGalleryItem, setSelectedGalleryItem] = useState<GalleryItem | null>(null);
    const [galleryDeleteConfirm, setGalleryDeleteConfirm] = useState<GalleryItem | null>(null);
    const [highlightGalleryId, setHighlightGalleryId] = useState<string | null>(null);
    const galleryItemRefs = useRef<Map<string, HTMLElement>>(new Map());
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
        const s = localStorage.getItem('schafer_user');
        if (!s) return null;
        try {
            const u = JSON.parse(s);
            if (isSuperAdmin(u.name) || isSuperAdmin(u.email)) {
                u.role = 'admin';
            } else if (!u.role) {
                u.role = (u.name.toLowerCase() === 'admin' ? 'admin' : 'user');
            }
            localStorage.setItem('schafer_user', JSON.stringify(u));
            return u;
        } catch {
            return null;
        }
    });

    const handleLogout = () => {
        void signOutFirebaseCustodian();
        localStorage.removeItem('schafer_user');
        try {
            sessionStorage.removeItem(SESSION_KEYS.guestBrowse);
        } catch {
            /* ignore */
        }
        setIsGuestBrowse(false);
        setCurrentUser(null);
        setTab('Home');
    };

    const [dbStats, setDbStats] = useState<DBStats>({
        recipeCount: 0, galleryCount: 0, triviaCount: 0,
        isCloudActive: CloudArchive.getProvider() !== 'local',
        activeProvider: CloudArchive.getProvider()
    });

    const [archivePhone, setArchivePhone] = useState(() => resolveArchivePhone(localStorage.getItem('schafer_archive_phone')));

    const [custodianAuth, setCustodianAuth] = useState<CustodianAuthState>({ user: null, isAdmin: false });

    const [isGuestBrowse, setIsGuestBrowse] = useState(() => {
        try {
            return sessionStorage.getItem(SESSION_KEYS.guestBrowse) === '1';
        } catch {
            return false;
        }
    });
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [contributor, setContributor] = useState('All');
    const [selectedTag, setSelectedTag] = useState('');
    const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'category' | 'contributor' | 'recent'>('title-asc');
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [galleryContributorFilter, setGalleryContributorFilter] = useState<string>('All');

    const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => getFavoriteIds());
    const [prefsHydrationVersion, setPrefsHydrationVersion] = useState(0);
    const [prefsSyncStatus, setPrefsSyncStatus] = useState<UserPrefsSyncStatus>(() =>
        CloudArchive.getProvider() === 'firebase' ? 'syncing' : 'local',
    );

    useUserPrefsSync(currentUser?.name, {
        onHydrated: () => {
            setFavoriteIds(getFavoriteIds());
            setPrefsHydrationVersion((version) => version + 1);
        },
        onSyncStatus: setPrefsSyncStatus,
    });

    // Fetch the family-wide ratings/notes aggregate on login so social proof
    // (averages, Family Approved, notes) reflects the whole family, not just
    // this device. Readers listen for FAMILY_PREFS_UPDATED_EVENT.
    useEffect(() => {
        if (!currentUser?.name) return;
        void refreshFamilyPrefs();
    }, [currentUser?.name]);

    const [cookModeRecipe, setCookModeRecipe] = useState<Recipe | null>(null);
    const [cookModeFromOfflineCache, setCookModeFromOfflineCache] = useState(false);
    const [groceryHighlightTitle, setGroceryHighlightTitle] = useState<string | null>(null);

    const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
    const [showCookbookPrint, setShowCookbookPrint] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [spotlightContributor, setSpotlightContributor] = useState<ContributorProfile | null>(null);
    const [galleryUploadBannerDismissed, setGalleryUploadBannerDismissed] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEYS.galleryUploadBannerDismissed) === '1';
        } catch {
            return false;
        }
    });
    const [familySubNavHintDismissed, setFamilySubNavHintDismissed] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEYS.familySubNavHintDismissed) === '1';
        } catch {
            return false;
        }
    });
    const recipeSearchRef = useRef<HTMLInputElement>(null);

    const handleSetTab = useCallback((newTab: string) => {
        setTab(newTab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handleBrowseAllRecipes = useCallback(() => {
        try {
            sessionStorage.setItem(SESSION_KEYS.focusRecipeSearch, '1');
        } catch {
            /* sessionStorage unavailable */
        }
        handleSetTab('Recipes');
    }, [handleSetTab]);

    const handleCookModeClose = useCallback(() => {
        setCookModeRecipe(null);
        setCookModeFromOfflineCache(false);
        const { hash } = window.location;
        if (!hash.startsWith('#recipe/')) return;
        if (selectedRecipe) {
            window.history.replaceState(null, '', `#recipe/${encodeURIComponent(selectedRecipe.id)}`);
            return;
        }
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }, [selectedRecipe]);

    const openGroceryFromRecipe = useCallback((recipeTitle: string) => {
        setGroceryHighlightTitle(recipeTitle);
        setSelectedRecipe(null);
        if (window.location.hash.match(/^#recipe\//)) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        setTab('Grocery List');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const clearGroceryHighlight = useCallback(() => setGroceryHighlightTitle(null), []);

    const defaultRecipeIds = useMemo(
        () => new Set(normalizeRecipes(defaultRecipes as Recipe[]).map(r => r.id)),
        []
    );

    const contributorsForDisplay = useMemo(
        () => mergeContributorsForDisplay(contributors, recipes, gallery, trivia),
        [contributors, recipes, gallery, trivia]
    );

    const displayGallery = useMemo(() => {
        const visible = filterGalleryForViewer(gallery, currentUser?.name);
        return filterGalleryByContributor(visible, galleryContributorFilter);
    }, [gallery, currentUser?.name, galleryContributorFilter]);

    const galleryContributorOptions = useMemo(() => {
        const names = new Set<string>();
        filterGalleryForViewer(gallery, currentUser?.name)
            .filter((item) => !isGalleryItemPending(item))
            .forEach((item) => names.add(normalizeContributorName(item.contributor)));
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [gallery, currentUser?.name]);

    const myModerationPendingCount = useMemo(
        () => (currentUser ? countPendingForContributor(gallery, currentUser.name) : 0),
        [gallery, currentUser]
    );

    useEffect(() => {
        if (!currentUser) return;
        const matched = contributorsForDisplay.find(c => c.name.toLowerCase() === currentUser.name.toLowerCase());
        const nextPicture = matched?.avatar ?? (currentUser.picture ? null : contributorAvatarUrlForName(currentUser.name));
        const roleProfile = contributors.find(c => c.name.toLowerCase() === currentUser.name.toLowerCase());
        const nextRole = roleProfile?.role;
        if (!nextPicture && !nextRole) return;

        const shouldUpdatePicture = !!nextPicture && nextPicture !== currentUser.picture;
        const shouldUpdateRole = !!nextRole && nextRole !== currentUser.role;
        if (!shouldUpdatePicture && !shouldUpdateRole) return;

        const updatedUser = {
            ...currentUser,
            ...(shouldUpdatePicture ? { picture: nextPicture } : {}),
            ...(shouldUpdateRole ? { role: nextRole } : {}),
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('schafer_user', JSON.stringify(updatedUser));
    }, [contributors, contributorsForDisplay, currentUser]);

    const refreshLocalState = async () => {
        const provider = CloudArchive.getProvider();
        if (provider === 'local') {
            try {
                const [r, t, g, c, h] = await Promise.all([
                    CloudArchive.getRecipes(),
                    CloudArchive.getTrivia(),
                    CloudArchive.getGallery(),
                    CloudArchive.getContributors(),
                    CloudArchive.getHistory()
                ]);
                setRecipes(mergeWithDefaultRecipes(normalizeRecipes(r)));
                setTrivia(t);
                setGallery(g);
                setContributors(c);
                setHistory(h);
            } catch {
                toast(CLOUD_ERROR_MSG, 'error');
            }
        }
    };

    // Sync Listeners
    useEffect(() => {
        const provider = CloudArchive.getProvider();
        if (provider !== 'firebase' || !CloudArchive.getFirebase()) {
            refreshLocalState().then(() => { setIsDataLoading(false); setIsInitialLoad(false); });
            // Auto-seed trivia only when the local archive is pristine (empty).
            // Topping up missing ids on every boot would resurrect questions an
            // admin deliberately deleted (and stomp E2E test seeds).
            if (provider === 'local') {
                CloudArchive.getTrivia()
                    .then(current => {
                        if (current.length > 0) return;
                        return Promise.all(TRIVIA_SEED.map(t => CloudArchive.upsertTrivia(t as Trivia)))
                            .then(refreshLocalState);
                    })
                    .catch(() => toast(CLOUD_ERROR_MSG, 'error'));
            }
            return;
        }

        const unsubR = CloudArchive.subscribeRecipes(r => {
            setRecipes(mergeWithDefaultRecipes(normalizeRecipes(r)));
            setIsDataLoading(false);
            setIsInitialLoad(false);
        });
        const unsubT = CloudArchive.subscribeTrivia(setTrivia);
        const unsubG = CloudArchive.subscribeGallery(setGallery);
        const unsubC = CloudArchive.subscribeContributors(setContributors);
        const unsubH = CloudArchive.subscribeHistory(setHistory);
        const unsubPhone = CloudArchive.subscribeArchivePhone(setArchivePhone);

        void CloudArchive.getTrivia()
            .then((current) => {
                const existingIds = new Set(current.map((t) => t.id));
                const missing = TRIVIA_SEED.filter((t) => !existingIds.has(t.id));
                if (missing.length === 0) return;
                return Promise.all(missing.map((t) => CloudArchive.upsertTrivia(t as Trivia)));
            })
            .catch(() => { /* non-fatal — live subscription still applies */ });

        return () => { unsubR(); unsubT(); unsubG(); unsubC(); unsubH(); unsubPhone(); };
    }, []);

    useEffect(() => {
        if (CloudArchive.getProvider() !== 'firebase') {
            setCustodianAuth({ user: null, isAdmin: false });
            return;
        }
        return subscribeFirebaseCustodian(setCustodianAuth);
    }, [dbStats.activeProvider, dbStats.isCloudActive]);

    // Deep-link handling: open recipe from #recipe/{id} or #recipe/{id}/cook
    useEffect(() => {
        const applyHash = async () => {
            const parsed = parseRecipeHash(window.location.hash);
            if (!parsed) return;
            let recipe = recipes.find((r) => r.id === parsed.id) ?? null;
            let fromOfflineCache = false;
            if (!recipe) {
                recipe = await getOfflineRecipe(parsed.id);
                fromOfflineCache = !!recipe;
            }
            if (!recipe) return;
            void cacheRecipeOffline(recipe);
            recordRecipeView(recipe.id, recipe.title);
            setTab('Recipes');
            setCookModeFromOfflineCache(fromOfflineCache);
            if (parsed.openCook) {
                setSelectedRecipe(null);
                setCookModeRecipe(recipe);
                trackEvent('cook_mode_started', { recipeId: recipe.id, source: 'deep_link' });
            } else {
                setSelectedRecipe(recipe);
            }
        };
        if (recipes.length === 0) return;
        void applyHash();
        const onHashChange = () => { void applyHash(); };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [recipes, currentUser]);

    useEffect(() => {
        if (recipes.length === 0) return;
        void cacheRecipesOffline(recipes);
    }, [recipes]);

    useEffect(() => {
        if (tab !== 'Recipes') return;
        try {
            if (!sessionStorage.getItem(SESSION_KEYS.focusRecipeSearch)) return;
            sessionStorage.removeItem(SESSION_KEYS.focusRecipeSearch);
        } catch {
            return;
        }
        requestAnimationFrame(() => {
            recipeSearchRef.current?.focus();
            recipeSearchRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }, [tab]);

    useEffect(() => {
        setDbStats(prev => ({
            ...prev,
            recipeCount: recipes.length,
            triviaCount: trivia.length,
            galleryCount: gallery.length,
            galleryPendingCount: countPendingModeration(gallery),
        }));
    }, [recipes, trivia, gallery]);

    useEffect(() => {
        if (!currentUser || currentUser.role !== 'admin') return;
        if (dbStats.galleryPendingCount <= 0) return;
        try {
            if (sessionStorage.getItem(SESSION_KEYS.adminPendingGalleryToastShown)) return;
            sessionStorage.setItem(SESSION_KEYS.adminPendingGalleryToastShown, '1');
        } catch {
            return;
        }
        const count = dbStats.galleryPendingCount;
        toast(
            `${count} gallery photo${count !== 1 ? 's' : ''} awaiting your approval — open Family → Gallery to review.`,
            'info',
        );
    }, [currentUser, dbStats.galleryPendingCount, toast]);

    useEffect(() => {
        if (tab !== 'Recipes') setShowMobileFilters(false);
    }, [tab]);

    // Cross-component navigation: ProfileView (and others) can dispatch a
    // 'schafer:navigate' CustomEvent with { detail: tabId } to switch tabs
    // without prop drilling.
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<string>).detail;
            if (typeof detail === 'string' && detail.length > 0) {
                handleSetTab(detail);
            }
        };
        window.addEventListener('schafer:navigate', handler);
        return () => window.removeEventListener('schafer:navigate', handler);
    }, []);

    useEffect(() => {
        const handler = () => setShowOnboarding(true);
        window.addEventListener('schafer:replay-onboarding', handler);
        return () => window.removeEventListener('schafer:replay-onboarding', handler);
    }, []);

    // Listen for foreground FCM messages and show a toast when a new recipe
    // notification arrives.  The listener is set up once on mount and cleaned
    // up automatically when the component unmounts.
    useEffect(() => {
        const unsubscribe = listenForForegroundMessages((title) => {
            toast(`New recipe added: ${title}`, 'success');
        });
        return unsubscribe;
    }, []);

    const highlightGalleryItem = useCallback((id: string) => {
        setHighlightGalleryId(id);
        window.setTimeout(() => setHighlightGalleryId(null), 4000);
    }, []);

    useEffect(() => {
        if (!highlightGalleryId || tab !== 'Gallery') return;
        const el = galleryItemRefs.current.get(highlightGalleryId);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlightGalleryId, tab, gallery.length]);

    const handleGalleryUploadsProcessed = useCallback(
        async (uploadedIds: string[]) => {
            await refreshLocalState();
            const lastId = uploadedIds[uploadedIds.length - 1];
            if (lastId) highlightGalleryItem(lastId);
        },
        [refreshLocalState, highlightGalleryItem]
    );

    const { pendingUploadCount, refreshPendingCount } = useOfflineUploadQueue(tab, gallery.length, {
        onUploadsProcessed: handleGalleryUploadsProcessed,
        onToast: toast,
    });

    const uploadGalleryMemory = useCallback(
        async (g: GalleryItem, f?: File): Promise<'uploaded' | 'submitted' | 'queued'> => {
            if (!f) return 'uploaded';
            const validation = validateGalleryFile(f);
            if (validation.ok === false) {
                toast(validation.message, 'error');
                throw new Error(validation.message);
            }
            const rate = checkGalleryUploadRateLimit(g.contributor);
            if (rate.allowed === false) {
                const msg = `Upload limit reached. Try again in about ${rate.retryAfterMinutes} minute(s).`;
                toast(msg, 'error');
                throw new Error(msg);
            }
            const isAdminUpload = currentUser?.role === 'admin';
            const item: GalleryItem = {
                ...g,
                status: isAdminUpload ? 'approved' : (g.status ?? 'pending'),
            };
            if (!navigator.onLine) {
                await queueUpload(f, item.caption, item.contributor);
                await refreshPendingCount();
                toast("You're offline. Photo saved to upload queue.", 'info');
                addSentryBreadcrumb('gallery_upload_queued', { contributor: item.contributor });
                return 'queued';
            }
            try {
                const url = await CloudArchive.uploadFile(f, 'gallery');
                await CloudArchive.upsertGalleryItem({ ...item, url: url || '' });
                recordGalleryUpload(item.contributor);
                trackEvent('gallery_upload', {
                    contributor: item.contributor,
                    type: item.type,
                    offline: false,
                    status: item.status,
                });
                addSentryBreadcrumb('gallery_upload_success', { id: item.id, type: item.type, status: item.status });
                await refreshLocalState();
                highlightGalleryItem(item.id);
                return item.status === 'pending' ? 'submitted' : 'uploaded';
            } catch {
                addSentryBreadcrumb('gallery_upload_failed', { id: item.id });
                toast(CLOUD_ERROR_MSG, 'error');
                throw new Error(CLOUD_ERROR_MSG);
            }
        },
        [refreshLocalState, refreshPendingCount, toast, highlightGalleryItem, currentUser?.role]
    );

    const finalizeLogin = useCallback(
        (rawName: string) => {
            const trimmed = rawName.trim();
            if (!trimmed) return;

            const affiliation = resolveLoginAffiliation(
                trimmed,
                contributorsForDisplay,
                recipes,
                gallery,
                trivia
            );
            const displayName = affiliation.canonicalName || trimmed;
            const existing = affiliation.profile
                ?? contributors.find((c) => c.name.toLowerCase() === displayName.toLowerCase());
            const isSuper = isSuperAdmin(trimmed) || isSuperAdmin(displayName);
            const email = isSuper && trimmed.includes('@') ? trimmed : existing?.email;
            const u: UserProfile = {
                id: existing?.id || 'u' + Date.now(),
                name: displayName,
                picture: existing?.avatar ?? contributorAvatarUrlForName(displayName),
                role: isSuper ? 'admin' : existing?.role || (displayName.toLowerCase() === 'admin' ? 'admin' : 'user'),
                email,
            };
            localStorage.setItem('schafer_user', JSON.stringify(u));
            try {
                sessionStorage.removeItem(SESSION_KEYS.guestBrowse);
            } catch {
                /* ignore */
            }
            setIsGuestBrowse(false);
            setCurrentUser(u);
            setTab('Home');
            window.scrollTo({ top: 0, behavior: 'auto' });
            if (!localStorage.getItem(STORAGE_KEYS.onboardingDone)) {
                let defer = false;
                try {
                    defer = !!sessionStorage.getItem(SESSION_KEYS.onboardingDefer);
                } catch {
                    /* sessionStorage blocked */
                }
                if (!defer) setShowOnboarding(true);
            }
            const archiveLinked = totalContributorContent(affiliation);
            if (archiveLinked > 0) {
                try {
                    if (!sessionStorage.getItem(SESSION_KEYS.affiliationWelcomeShown)) {
                        sessionStorage.setItem(SESSION_KEYS.affiliationWelcomeShown, '1');
                        const recipeCount = affiliation.recipeCount;
                        if (recipeCount > 0) {
                            toast(
                                `Welcome back, ${displayName.split(' ')[0]}! ${recipeCount} recipe${recipeCount !== 1 ? 's' : ''} in the archive — open Profile → My recipes to see yours.`,
                                'success'
                            );
                        } else {
                            toast(`Welcome back, ${displayName.split(' ')[0]}! Your family contributions are linked to this name.`, 'success');
                        }
                    }
                } catch {
                    /* sessionStorage blocked */
                }
            }
        },
        [contributors, contributorsForDisplay, recipes, gallery, trivia, toast]
    );

    const enterGuestBrowse = useCallback(() => {
        const guest: UserProfile = {
            id: 'guest-' + Date.now(),
            name: 'Guest',
            picture: PLACEHOLDER_AVATAR,
            role: 'user',
        };
        try {
            sessionStorage.setItem(SESSION_KEYS.guestBrowse, '1');
        } catch {
            /* ignore */
        }
        setIsGuestBrowse(true);
        setCurrentUser(guest);
        setTab('Recipes');
        window.scrollTo({ top: 0, behavior: 'auto' });
        toast('Browsing as guest — sign in with your name to save favorites and link your recipes.', 'info');
    }, [toast]);

    useEffect(() => {
        if (!currentUser) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
            const el = e.target as HTMLElement | null;
            if (!el) return;
            if (el.isContentEditable || el.closest('[contenteditable="true"]')) return;
            const tag = el.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            e.preventDefault();
            setShortcutsOpen(true);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [currentUser]);

    const getAvatar = (name: string) => {
        const normalized = normalizeContributorName(name);
        const c = contributorsForDisplay.find(
            p => p.name === normalized || p.name.toLowerCase() === normalized.toLowerCase()
        );
        return c?.avatar || contributorAvatarUrlForName(normalized);
    };

    const allTags = useMemo(() => getTagOptions(recipes), [recipes]);
    const contributorOptions = useMemo(() => getContributorOptions(recipes), [recipes]);

    const filteredRecipes = useMemo(() => {
        const q = search.trim();
        return recipes.filter(r => {
            // Fuzzy match (typo + word-order tolerant) across the recipe's
            // searchable text: title, ingredients, instructions, notes, author.
            const matchS = !q || fuzzyMatch(
                [
                    r.title,
                    r.ingredients.join(' '),
                    r.instructions.join(' '),
                    r.notes ?? '',
                    r.contributor,
                ].join(' \n '),
                q,
            );
            const matchC = category === 'All' || r.category === category;
            const matchA = contributor === 'All' || normalizeContributorName(r.contributor) === contributor;
            const matchT = !selectedTag || (r.tags?.includes(selectedTag) ?? false);
            return matchS && matchC && matchA && matchT;
        });
    }, [recipes, search, category, contributor, selectedTag]);

    const recentIds = useMemo(() => getRecentRecipeIds(), [recipes, selectedRecipe]);
    const activeFilterCount = [category !== 'All', contributor !== 'All', !!selectedTag, sortBy !== 'title-asc'].filter(Boolean).length;
    const isBrowsingFiltered = Boolean(search.trim()) || activeFilterCount > 0;
    const wasBrowsingFilteredRef = useRef(false);

    useEffect(() => {
        if (tab === 'Recipes' && isBrowsingFiltered && !wasBrowsingFilteredRef.current) {
            requestAnimationFrame(() => {
                document.getElementById('recipe-card-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        wasBrowsingFilteredRef.current = isBrowsingFiltered;
    }, [tab, isBrowsingFiltered]);

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

    const recentlyViewedRecipes = useMemo(() => {
        return getRecentlyViewedEntries()
            .map((entry) => recipes.find((recipe) => recipe.id === entry.id))
            .filter((recipe): recipe is Recipe => !!recipe);
    }, [recipes, selectedRecipe]);

    const favoriteRecipes = useMemo(
        () => recipes.filter((recipe) => favoriteIds.has(recipe.id)),
        [recipes, favoriteIds]
    );

    const browseShelves = useMemo<BrowseShelf[]>(() => {
        const byRating = (recipe: Recipe) => getAverageRating(recipe.id);
        const familyFavorites = recipes
            .filter((recipe) => isFamilyApproved(recipe.id) || recipe.tags?.includes('family-favorite') || recipe.collections?.includes('Family favorites'))
            .sort((a, b) => byRating(b) - byRating(a) || a.title.localeCompare(b.title))
            .slice(0, 8);
        const weeknight = recipes
            .filter((recipe) => recipe.tags?.includes('quick') || recipe.collections?.includes('Weeknight friendly') || /\b(15|20|25|30)\b/.test(`${recipe.prepTime ?? ''} ${recipe.cookTime ?? ''}`))
            .slice(0, 8);
        const seasonal = recipes
            .filter((recipe) => recipe.season === 'Spring' || recipe.season === 'Summer')
            .slice(0, 8);
        const desserts = recipes
            .filter((recipe) => recipe.category === 'Dessert')
            .slice(0, 8);
        return [
            { id: 'family', label: 'Family favorites', detail: 'Most loved and saved', recipes: familyFavorites },
            { id: 'weeknight', label: 'Weeknight friendly', detail: 'Faster recipes for real evenings', recipes: weeknight },
            { id: 'seasonal', label: 'Fresh right now', detail: 'Seasonal ideas', recipes: seasonal },
            { id: 'desserts', label: 'Sweet finish', detail: 'Desserts and baking', recipes: desserts, action: () => setCategory('Dessert') },
        ].filter((shelf) => shelf.recipes.length > 0);
    }, [recipes]);

    const localGeneratedImageCount = useMemo(
        () => recipes.filter((recipe) => recipe.imageSource === 'local-generated').length,
        [recipes]
    );

    const quickCategoryCounts = useMemo(() => {
        return RECIPE_CATEGORIES
            .slice()
            .sort((a, b) => CATEGORY_META[a].browsePriority - CATEGORY_META[b].browsePriority)
            .map((name) => ({ name, count: recipes.filter((recipe) => recipe.category === name).length }))
            .filter((item) => item.count > 0)
            .slice(0, 6);
    }, [recipes]);

    const resetBrowse = () => {
        setSearch('');
        setSelectedTag('');
        setContributor('All');
        setCategory('All');
        setSortBy('title-asc');
        handleSetTab('Recipes');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const secondaryNavItems = getSecondaryNavForTab(tab);
    const galleryUploadsUnavailable =
        shouldShowGalleryUploadUnavailableBanner(CloudArchive.getProvider()) && !galleryUploadBannerDismissed;
    const secondarySubNav = secondaryNavItems ? (
        <>
            {secondaryNavItems === FAMILY_SECONDARY_NAV && !familySubNavHintDismissed && (
                <FamilySubNavHint onDismiss={() => setFamilySubNavHintDismissed(true)} />
            )}
            <SectionSubNav
            ariaLabel={secondaryNavAriaLabel(secondaryNavItems)}
            items={secondaryNavItems}
            activeTab={tab}
            onSelect={handleSetTab}
            getDetail={
                secondaryNavItems === FAMILY_SECONDARY_NAV
                    ? (id) =>
                          getFamilyNavDetail(id, {
                              gallery: gallery.length,
                              trivia: trivia.length,
                              contributors: contributorsForDisplay.length,
                          })
                    : undefined
            }
            />
        </>
    ) : null;

    const handleSelectRecipe = (recipe: Recipe) => {
        recordRecipeView(recipe.id, recipe.title);
        void cacheRecipeOffline(recipe);
        setSelectedRecipe(recipe);
        trackEvent('recipe_viewed', { recipeId: recipe.id, title: recipe.title });
        window.history.replaceState(null, '', `#recipe/${encodeURIComponent(recipe.id)}`);
    };

    const handleStartCookFromHome = (recipe: Recipe) => {
        recordRecipeView(recipe.id, recipe.title);
        void cacheRecipeOffline(recipe);
        setCookModeFromOfflineCache(false);
        setSelectedRecipe(null);
        setCookModeRecipe(recipe);
        trackEvent('cook_mode_started', { recipeId: recipe.id, source: 'home' });
    };

    const handleSelectContributorFromHome = (name: string) => {
        setContributor(normalizeContributorName(name));
        setCategory('All');
        setSearch('');
        setSelectedTag('');
        handleSetTab('Recipes');
    };

    const handleBrowseContributorFromRecipe = (name: string) => {
        setSelectedRecipe(null);
        if (window.location.hash.match(/^#recipe\//)) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        handleSelectContributorFromHome(name);
    };

    const handleRecipeClose = () => {
        setSelectedRecipe(null);
        if (window.location.hash.match(/^#recipe\//)) {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    };

    const recipeListForModal = useMemo(() => {
        if (!selectedRecipe) return [];
        if (tab === 'Recipes') return sortedRecipes;
        if (tab === 'Index') return [...recipes].sort((a, b) => a.title.localeCompare(b.title));
        return [...recipes].sort((a, b) => a.title.localeCompare(b.title));
    }, [tab, selectedRecipe, sortedRecipes, recipes]);

    const handleNavigateToRecipe = (recipe: Recipe) => {
        setSelectedRecipe(recipe);
        window.history.replaceState(null, '', `#recipe/${encodeURIComponent(recipe.id)}`);
    };

    const handleToggleFavorite = (id: string) => {
        const wasFav = favoriteIds.has(id);
        const next = toggleFavorite(id);
        setFavoriteIds(next);
        if (next.has(id) && !wasFav) hapticSuccess();
        else hapticLight();
        const name = recipes.find(r => r.id === id)?.title ?? 'Recipe';
        toast(next.has(id) ? `Added "${name}" to favorites` : `Removed "${name}" from favorites`, next.has(id) ? 'success' : 'info');
        if (next.has(id) && currentUser) {
            addActivity('favorite_added', currentUser.name, `favorited "${name}"`);
        }
    };

    const clearRecipeFilters = () => {
        setSearch('');
        setCategory('All');
        setContributor('All');
        setSelectedTag('');
        setSortBy('title-asc');
    };

    if (!currentUser) {
        return (
            <LoginScreen
                contributors={contributorsForDisplay}
                recipes={recipes}
                gallery={gallery}
                trivia={trivia}
                recipeCount={dbStats.recipeCount}
                onLogin={finalizeLogin}
                onBrowseGuest={enterGuestBrowse}
            />
        );
    }

    const guestSignInBanner = isGuestBrowse ? (
        <div
            role="status"
            data-testid="guest-sign-in-banner"
            className="sticky top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-40 border-b border-[#A0522D]/20 bg-[#FFF8EC] px-4 py-3 text-sm text-[#2D4635] dark:border-stone-700 dark:bg-stone-900 dark:text-emerald-100"
        >
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                <p>
                    Browsing as guest — sign in with your family name to save favorites and connect with your recipes.
                </p>
                <button
                    type="button"
                    onClick={() => {
                        try {
                            sessionStorage.removeItem(SESSION_KEYS.guestBrowse);
                        } catch {
                            /* ignore */
                        }
                        setIsGuestBrowse(false);
                        setCurrentUser(null);
                    }}
                    className="min-h-10 shrink-0 rounded-full bg-[#2D4635] px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white"
                >
                    Sign in
                </button>
            </div>
        </div>
    ) : null;

    // Gallery View
    if (tab === 'Gallery') {
        return (
            <div className="cookbook-paper min-h-screen bg-[#FDFBF7] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
                <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-[#2D4635] focus:rounded-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-[#2D4635]">
                    Skip to main content
                </a>
                <OfflineBanner />
                <Header activeTab={tab} setTab={handleSetTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />
                {guestSignInBanner}
                {secondarySubNav}
                <main id="main-content" className="view-shell-wide view-stack max-w-7xl mx-auto" role="main" aria-label="Family Gallery" tabIndex={-1}>
                    <PageHeader
                        id="gallery-heading"
                        title="Family Gallery"
                        description="Captured moments across the generations."
                    />
                    {myModerationPendingCount > 0 && (
                        <p className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold -mt-2" role="status" aria-live="polite">
                            <span aria-hidden="true">⏳</span>
                            {myModerationPendingCount} photo{myModerationPendingCount !== 1 ? 's' : ''} awaiting custodian approval
                        </p>
                    )}
                    {pendingUploadCount > 0 && (
                        <p className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold -mt-2" role="status" aria-live="polite">
                            <span aria-hidden="true">📤</span>
                            {pendingUploadCount} photo{pendingUploadCount !== 1 ? 's' : ''} queued for upload when online
                        </p>
                    )}
                    {galleryUploadsUnavailable && (
                        <div
                            role="status"
                            data-testid="gallery-upload-unavailable-banner"
                            className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                        >
                            <p>
                                Photo uploads are temporarily unavailable while family cloud storage is being set up.
                                You can still browse memories and text the archive number if enabled.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    try {
                                        localStorage.setItem(STORAGE_KEYS.galleryUploadBannerDismissed, '1');
                                    } catch {
                                        /* ignore */
                                    }
                                    setGalleryUploadBannerDismissed(true);
                                }}
                                className="min-h-10 shrink-0 rounded-full border border-amber-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-800 hover:bg-amber-100/80"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}
                    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                        <GalleryUploadPanel
                            contributorName={currentUser.name}
                            disabled={galleryUploadsUnavailable}
                            onUpload={async (item, file) => {
                                const result = await uploadGalleryMemory(item, file);
                                if (result === 'uploaded') {
                                    toast('Memory added to the gallery', 'success');
                                } else if (result === 'submitted') {
                                    toast('Photo submitted — a custodian will approve it soon.', 'success');
                                }
                            }}
                        />
                        {archivePhone ? (
                            <div className="bg-emerald-50 rounded-[2rem] p-6 border border-emerald-100 flex items-center gap-6 animate-in slide-in-from-right-8 duration-700" role="region" aria-label="Text-to-gallery instructions">
                                <span className="text-3xl" aria-hidden="true">📱</span>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 leading-none mb-1">{siteConfig.galleryCopy.textPromptTitle}</h4>
                                    <p className="text-sm text-emerald-700 font-serif italic">
                                        {siteConfig.galleryCopy.textPromptHint}{' '}
                                        <a
                                            href={`sms:${archivePhone.replace(/\s/g, '')}`}
                                            className="font-bold not-italic underline decoration-emerald-600/50 hover:decoration-emerald-700 underline-offset-2 hover:text-emerald-800 transition-colors"
                                            aria-label={`Text photos or videos to ${archivePhone}`}
                                        >
                                            {archivePhone}
                                        </a>
                                    </p>
                                    <p className="text-[10px] text-emerald-600/80 mt-1">Tap the number to open your messaging app</p>
                                    <button
                                        type="button"
                                        data-testid="gallery-copy-archive-phone"
                                        onClick={async () => {
                                            try {
                                                await navigator.clipboard.writeText(archivePhone);
                                                toast('Number copied', 'success');
                                            } catch {
                                                toast('Could not copy — long-press the number instead', 'info');
                                            }
                                        }}
                                        className="mt-3 min-h-10 rounded-full border border-emerald-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-800 hover:bg-emerald-100/80 transition-colors"
                                    >
                                        Copy number
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-stone-50 dark:bg-[var(--bg-tertiary)] rounded-[2rem] p-6 border border-stone-100 dark:border-stone-800 flex items-center gap-6" role="region" aria-label="Alternative ways to add photos">
                                <span className="text-2xl" aria-hidden="true">📱</span>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500 leading-none mb-1">Prefer texting?</h4>
                                    <p className="text-sm text-stone-500 font-serif italic">{siteConfig.galleryCopy.noPhoneHint}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {isDataLoading ? (
                        <GallerySkeleton />
                    ) : displayGallery.length === 0 ? (
                        <div className="py-24 text-center space-y-8 animate-in fade-in duration-500" role="status">
                            <div className="w-32 h-32 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-5xl border-2 border-dashed border-stone-200">🖼️</div>
                            <div className="space-y-3">
                                <h3 className="text-2xl font-serif italic text-[#2D4635]">The gallery awaits your memories</h3>
                                <p className="text-stone-500 font-serif italic max-w-md mx-auto">Upload a photo above, text the archive number if enabled, or ask a family custodian for help.</p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleSetTab('Contributors')}
                                    className="min-h-11 rounded-full bg-[#2D4635] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white"
                                >
                                    Meet contributors
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetTab('Family Story')}
                                    className="min-h-11 rounded-full border border-stone-200 bg-white px-6 py-3 text-[10px] font-black uppercase tracking-widest text-stone-600"
                                >
                                    Read the story
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {galleryContributorFilter !== 'All' && (
                                <div
                                    className="sticky top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8DCCB] bg-[#FFF8EC]/95 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/90"
                                    data-testid="gallery-contributor-filter-chip"
                                    role="status"
                                >
                                    <span className="text-sm font-serif italic text-stone-700 dark:text-stone-200">
                                        Showing <span className="font-bold not-italic text-[#A0522D]">{galleryContributorFilter}</span>&apos;s photos
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setGalleryContributorFilter('All')}
                                        className="min-h-10 rounded-full border border-stone-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                            {galleryContributorOptions.length > 0 && (
                                <div className="flex flex-wrap items-center gap-3">
                                    <label htmlFor="gallery-contributor-filter" className="sr-only">
                                        Filter gallery by contributor
                                    </label>
                                    <select
                                        id="gallery-contributor-filter"
                                        data-testid="gallery-contributor-filter"
                                        aria-label="Filter gallery by contributor"
                                        className="min-h-11 cursor-pointer rounded-full border border-[#E8DCCB] bg-white/90 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
                                        value={galleryContributorFilter}
                                        onChange={(e) => setGalleryContributorFilter(e.target.value)}
                                    >
                                        <option value="All">All contributors</option>
                                        {galleryContributorOptions.map((c) => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8" role="list">
                                {displayGallery.map(item => (
                                    <article
                                        key={item.id}
                                        ref={(el) => {
                                            if (el) galleryItemRefs.current.set(item.id, el);
                                            else galleryItemRefs.current.delete(item.id);
                                        }}
                                        data-testid={`gallery-item-${item.id}`}
                                        className={`break-inside-avoid bg-white dark:bg-[var(--card-bg)] p-4 rounded-[2rem] border border-stone-100 dark:border-stone-800 shadow-md group hover:shadow-2xl transition-all focus-within:shadow-2xl ${
                                            highlightGalleryId === item.id
                                                ? 'ring-2 ring-[#A0522D] ring-offset-2 ring-offset-[#FDFBF7] dark:ring-offset-[var(--bg-primary)]'
                                                : ''
                                        }`}
                                        role="listitem"
                                    >
                                        {item.type === 'video' ? (
                                            <div className="relative mb-4">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedGalleryItem(item)}
                                                className="w-full text-left rounded-2xl overflow-hidden mb-0 bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-white relative"
                                                aria-label={`View full size: ${item.caption || 'Family video'}`}
                                                onFocus={e => {
                                                    const vid = e.currentTarget.querySelector('video');
                                                    if (vid) vid.play();
                                                }}
                                                onBlur={e => {
                                                    const vid = e.currentTarget.querySelector('video');
                                                    if (vid) vid.pause();
                                                }}
                                                onMouseOver={e => {
                                                    const vid = e.currentTarget.querySelector('video');
                                                    if (vid) vid.play();
                                                }}
                                                onMouseOut={e => {
                                                    const vid = e.currentTarget.querySelector('video');
                                                    if (vid) vid.pause();
                                                }}
                                            >
                                                <video
                                                    src={item.url}
                                                    className="w-full pointer-events-none"
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                    title={item.caption || 'Family video'}
                                                    aria-label={item.caption || 'Family video'}
                                                    onTouchStart={e => {
                                                        const el = e.target as HTMLVideoElement;
                                                        if (el.paused) el.play();
                                                        else el.pause();
                                                    }}
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-100 md:opacity-0 md:hover:opacity-100 focus-within:opacity-100 transition-opacity bg-black/30 pointer-events-none">
                                                    <span className="bg-white/90 text-stone-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest">▶ Fullscreen</span>
                                                </div>
                                                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 text-white text-[10px] font-black uppercase tracking-widest pointer-events-none">
                                                    Video
                                                </div>
                                            </button>
                                            {isGalleryItemPending(item) && (
                                                <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-sky-600/95 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                                                    Pending review
                                                </span>
                                            )}
                                            </div>
                                        ) : (
                                            <div className="relative mb-4">
                                            <GalleryImage
                                                url={item.url}
                                                caption={item.caption}
                                                onClick={() => setSelectedGalleryItem(item)}
                                            />
                                            {isGalleryItemPending(item) && (
                                                <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-sky-600/95 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                                                    Pending review
                                                </span>
                                            )}
                                            </div>
                                        )}
                                        <p className="font-serif italic text-stone-800 dark:text-stone-200 text-lg px-2 line-clamp-3">{item.caption}</p>
                                        {isGalleryItemPending(item) && (
                                            <p className="px-2 mt-1 text-[10px] font-black uppercase tracking-widest text-sky-700 dark:text-sky-300">
                                                {contributorMatchKey(item.contributor) === contributorMatchKey(currentUser?.name) ? 'Your upload · Pending review' : 'Awaiting approval'}
                                            </p>
                                        )}
                                        {item.created_at && (
                                            <time
                                                dateTime={item.created_at}
                                                className="block px-2 mt-1 text-[10px] uppercase tracking-widest text-stone-600 dark:text-stone-300"
                                            >
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </time>
                                        )}
                                        <div className="flex justify-between items-center mt-4 px-2">
                                            <div className="flex items-center gap-2">
                                                <img src={getAvatar(normalizeContributorName(item.contributor))} className="w-4 h-4 rounded-full object-cover" alt={normalizeContributorName(item.contributor)} onError={avatarOnError} />
                                                <span className="text-[9px] uppercase tracking-widest text-[#A0522D]">Added by {normalizeContributorName(item.contributor)}</span>
                                            </div>
                                            {currentUser?.role === 'admin' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setGalleryDeleteConfirm(item); }}
                                                    className="w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center text-stone-300 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] rounded-full transition-opacity"
                                                    aria-label={`Remove "${item.caption}" from gallery`}
                                                    title="Remove from gallery"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>

                            {/* Gallery Lightbox (images and videos) */}
                            {selectedGalleryItem && (
                                <GalleryLightbox
                                    item={selectedGalleryItem}
                                    onClose={() => setSelectedGalleryItem(null)}
                                />
                            )}

                            {/* Gallery delete confirmation */}
                            {galleryDeleteConfirm && (
                                <GalleryDeleteConfirmDialog
                                    item={galleryDeleteConfirm}
                                    onClose={() => setGalleryDeleteConfirm(null)}
                                    onConfirm={async () => {
                                        const id = galleryDeleteConfirm.id;
                                        setGalleryDeleteConfirm(null);
                                        try {
                                            await CloudArchive.deleteGalleryItem(id);
                                            await refreshLocalState();
                                        } catch {
                                            toast(CLOUD_ERROR_MSG, 'error');
                                        }
                                    }}
                                />
                            )}
                        </>
                    )}
                </main>
                {selectedRecipe && (
                    <Suspense fallback={<div className="fixed inset-0 z-[100] bg-stone-900/60 flex items-center justify-center" aria-label="Loading recipe"><span className="animate-pulse text-white">Loading…</span></div>}>
                        <RecipeModal
                            recipe={selectedRecipe}
                            onClose={handleRecipeClose}
                            recipeList={recipeListForModal}
                            onNavigate={handleNavigateToRecipe}
                            isFavorite={(id) => favoriteIds.has(id)}
                            onToggleFavorite={handleToggleFavorite}
                            onStartCook={() => {
                                setCookModeFromOfflineCache(false);
                                setCookModeRecipe(selectedRecipe);
                                trackEvent('cook_mode_started', { recipeId: selectedRecipe.id });
                                window.history.replaceState(null, '', `#recipe/${encodeURIComponent(selectedRecipe.id)}/cook`);
                            }}
                            onOpenGroceryList={openGroceryFromRecipe}
                            breadcrumbContext="Family"
                            currentUserName={currentUser?.name}
                            onBrowseContributor={handleBrowseContributorFromRecipe}
                        />
                    </Suspense>
                )}
                {cookModeRecipe && (
                    <Suspense fallback={<div className="fixed inset-0 z-[150] bg-[#2D4635] flex items-center justify-center" aria-label="Loading cook mode"><span className="animate-pulse text-white">Loading…</span></div>}>
                        <CookModeView
                            recipe={cookModeRecipe}
                            servedFromOfflineCache={cookModeFromOfflineCache}
                            onClose={handleCookModeClose}
                        />
                    </Suspense>
                )}
                <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
                <BottomNav activeTab={tab} setTab={handleSetTab} currentUser={currentUser} />
                <Suspense fallback={null}><InstallPrompt /></Suspense>
            </div>
        );
    }

    // Trivia View
    if (tab === 'Trivia') {
        return (
            <div className="cookbook-paper min-h-screen bg-[#FDFBF7] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
                <a href="#main-content-trivia" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-[#2D4635] focus:rounded-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-[#2D4635]">
                    Skip to main content
                </a>
                <OfflineBanner />
                <Header activeTab={tab} setTab={handleSetTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />
                {guestSignInBanner}
                {secondarySubNav}
                <div id="main-content-trivia" tabIndex={-1} role="main" aria-label="Family trivia">
                <Suspense fallback={<TabFallback />}>
                    <TriviaView
                        trivia={trivia}
                        currentUser={currentUser}
                        isDataLoading={isDataLoading}
                        onAddTrivia={async (t) => {
                            try {
                                await CloudArchive.upsertTrivia(t);
                                await refreshLocalState();
                            } catch {
                                toast(CLOUD_ERROR_MSG, 'error');
                            }
                        }}
                        onDeleteTrivia={async (id) => {
                            try {
                                await CloudArchive.deleteTrivia(id);
                                await refreshLocalState();
                            } catch {
                                toast(CLOUD_ERROR_MSG, 'error');
                            }
                        }}
                    />
                </Suspense>
                </div>
                {selectedRecipe && (
                    <Suspense fallback={<div className="fixed inset-0 z-[100] bg-stone-900/60 flex items-center justify-center" aria-label="Loading recipe"><span className="animate-pulse text-white">Loading…</span></div>}>
                        <RecipeModal
                            recipe={selectedRecipe}
                            onClose={handleRecipeClose}
                            recipeList={recipeListForModal}
                            onNavigate={handleNavigateToRecipe}
                            isFavorite={(id) => favoriteIds.has(id)}
                            onToggleFavorite={handleToggleFavorite}
                            onStartCook={() => {
                                setCookModeFromOfflineCache(false);
                                setCookModeRecipe(selectedRecipe);
                                trackEvent('cook_mode_started', { recipeId: selectedRecipe.id });
                                window.history.replaceState(null, '', `#recipe/${encodeURIComponent(selectedRecipe.id)}/cook`);
                            }}
                            onOpenGroceryList={openGroceryFromRecipe}
                            breadcrumbContext="Family"
                            currentUserName={currentUser?.name}
                            onBrowseContributor={handleBrowseContributorFromRecipe}
                        />
                    </Suspense>
                )}
                {cookModeRecipe && (
                    <Suspense fallback={<div className="fixed inset-0 z-[150] bg-[#2D4635] flex items-center justify-center" aria-label="Loading cook mode"><span className="animate-pulse text-white">Loading…</span></div>}>
                        <CookModeView
                            recipe={cookModeRecipe}
                            servedFromOfflineCache={cookModeFromOfflineCache}
                            onClose={handleCookModeClose}
                        />
                    </Suspense>
                )}
                <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
                <BottomNav activeTab={tab} setTab={handleSetTab} currentUser={currentUser} />
                <Suspense fallback={null}><InstallPrompt /></Suspense>
            </div>
        );
    }

    return (
        <div className="cookbook-paper min-h-screen bg-[#FDFBF7] text-stone-800 selection:bg-[#A0522D] selection:text-white pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-[#2D4635] focus:rounded-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-[#2D4635]">
                Skip to main content
            </a>
            <OfflineBanner />
            <Header activeTab={tab} setTab={handleSetTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />
            {guestSignInBanner}
            {secondarySubNav}

            {isInitialLoad && (
                <div className="max-w-[1600px] mx-auto px-6 py-8 md:py-12 space-y-10" aria-label="Loading content" role="status">
                    {/* Header placeholder */}
                    <div className="rounded-[3rem] bg-stone-200 animate-pulse h-48 md:h-64" />
                    {/* Recipe card grid skeleton */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="space-y-3">
                                <div className="aspect-[3/4] rounded-[2rem] bg-stone-200 animate-pulse" />
                                <div className="h-4 bg-stone-200 rounded animate-pulse w-3/4" />
                                <div className="h-3 bg-stone-200 rounded animate-pulse w-1/2" />
                            </div>
                        ))}
                    </div>
                    <span className="sr-only">Loading recipes and content...</span>
                </div>
            )}

            <div id="main-content" tabIndex={-1} aria-live="polite" className={isInitialLoad ? 'hidden' : undefined}>
            {showAddRecipeModal && currentUser?.role === 'admin' && (
                <Suspense fallback={null}>
                    <AddRecipeModal
                        onAddRecipe={async (r, f) => {
                            try {
                                const url = f ? await CloudArchive.uploadFile(f, 'recipes') : r.image;
                                await CloudArchive.upsertRecipe({ ...r, image: url || r.image }, currentUser!.name);
                                await refreshLocalState();
                                setShowAddRecipeModal(false);
                            } catch {
                                toast(CLOUD_ERROR_MSG, 'error');
                            }
                        }}
                        onClose={() => setShowAddRecipeModal(false)}
                        contributors={contributorsForDisplay}
                        currentUser={currentUser}
                    />
                </Suspense>
            )}

            {selectedRecipe && (
                <Suspense fallback={<div className="fixed inset-0 z-[100] bg-stone-900/60 flex items-center justify-center" aria-label="Loading recipe"><span className="animate-pulse text-white">Loading…</span></div>}>
                    <RecipeModal
                        recipe={selectedRecipe}
                        onClose={handleRecipeClose}
                        recipeList={recipeListForModal}
                        onNavigate={handleNavigateToRecipe}
                        isFavorite={(id) => favoriteIds.has(id)}
                        onToggleFavorite={handleToggleFavorite}
                        onStartCook={() => {
                            setCookModeFromOfflineCache(false);
                            setCookModeRecipe(selectedRecipe);
                            trackEvent('cook_mode_started', { recipeId: selectedRecipe.id });
                            window.history.replaceState(null, '', `#recipe/${encodeURIComponent(selectedRecipe.id)}/cook`);
                        }}
                        onOpenGroceryList={openGroceryFromRecipe}
                        breadcrumbContext={{ Home: 'Home', Recipes: 'Recipes', Index: 'A–Z', Gallery: 'Gallery', Trivia: 'Trivia', 'Family Story': 'Family Story', Contributors: 'Contributors', Profile: 'Profile', Privacy: 'Privacy', Help: 'Help', 'Grocery List': 'Groceries', Collections: 'Collections', 'Meal Plan': 'Meal Plan' }[tab] ?? 'Recipes'}
                        currentUserName={currentUser?.name}
                        onBrowseContributor={handleBrowseContributorFromRecipe}
                    />
                </Suspense>
            )}

            {cookModeRecipe && (
                <Suspense fallback={<div className="fixed inset-0 z-[150] bg-[#2D4635] flex items-center justify-center" aria-label="Loading cook mode"><span className="animate-pulse text-white">Loading…</span></div>}>
                    <CookModeView
                        recipe={cookModeRecipe}
                        servedFromOfflineCache={cookModeFromOfflineCache}
                        onClose={handleCookModeClose}
                    />
                </Suspense>
            )}

            {showCookbookPrint && (
                <Suspense fallback={null}>
                    <CookbookPrintView recipes={recipes} onClose={() => setShowCookbookPrint(false)} />
                </Suspense>
            )}

            {tab === 'Home' && (
                <Suspense fallback={<TabFallback />}>
                    <HomeView
                        currentUser={currentUser}
                        recipes={recipes}
                        favoriteRecipes={favoriteRecipes}
                        recentlyViewedRecipes={recentlyViewedRecipes}
                        contributors={contributorsForDisplay}
                        onSelectRecipe={(r) => handleSelectRecipe(r)}
                        onStartCook={handleStartCookFromHome}
                        onSetTab={handleSetTab}
                        onBrowseAllRecipes={handleBrowseAllRecipes}
                        onSelectCategory={(c) => { setCategory(c); handleSetTab('Recipes'); }}
                        onSelectContributor={handleSelectContributorFromHome}
                        onOpenMealPlan={() => handleSetTab('Meal Plan')}
                        isFavorite={(id) => favoriteIds.has(id)}
                        onToggleFavorite={handleToggleFavorite}
                        triviaQuestionCount={trivia.length}
                        mealPlanSyncVersion={prefsHydrationVersion}
                    />
                </Suspense>
            )}

            {tab === 'Recipes' && (
                <main aria-label="Recipes" className="relative z-10 mx-auto max-w-[1400px] view-stack view-shell-wide">
                    {contributor !== 'All' && (
                        <section
                            aria-label={`Recipes by ${contributor}`}
                            className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-[2rem] border border-[#E8DCCB] bg-white/90 dark:bg-stone-900/80 px-5 py-4 shadow-sm"
                        >
                            <img
                                src={getAvatar(contributor)}
                                alt=""
                                onError={avatarOnError}
                                className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-stone-700 shadow shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <h2 className="font-serif text-xl italic text-[#2D4635] dark:text-emerald-100 truncate">
                                    From {contributor}&apos;s kitchen
                                </h2>
                                <p className="text-sm text-stone-500 dark:text-stone-400">
                                    {sortedRecipes.length} {sortedRecipes.length === 1 ? 'recipe' : 'recipes'} in the archive
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handleSetTab('Contributors')}
                                    className="min-h-11 rounded-full border border-[#E8DCCB] px-4 py-2 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:text-stone-300"
                                >
                                    Meet contributors
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setContributor('All')}
                                    className="min-h-11 rounded-full px-4 py-2 text-sm font-semibold text-[#A0522D] hover:bg-[#A0522D]/10"
                                >
                                    Clear filter
                                </button>
                            </div>
                        </section>
                    )}
                    {isBrowsingFiltered ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                            <p className="text-sm text-stone-600 dark:text-stone-400">
                                {sortedRecipes.length} {sortedRecipes.length === 1 ? 'recipe' : 'recipes'} found
                                {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active` : ''}
                            </p>
                            <button
                                type="button"
                                onClick={clearRecipeFilters}
                                className="text-sm font-semibold text-[#A0522D] hover:underline"
                            >
                                Clear all
                            </button>
                        </div>
                    ) : (
                        <>
                            <section className="md:hidden rounded-2xl bg-[#2D4635] text-white px-5 py-4 shadow-sm">
                                <h1 className="font-serif text-xl italic leading-snug">Find something worth cooking tonight.</h1>
                                <button
                                    type="button"
                                    onClick={() => { handleSetTab('Home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-100/85 underline-offset-2 hover:underline"
                                >
                                    ← Back to home
                                </button>
                                <button
                                    type="button"
                                    data-testid="open-cookbook-print-mobile"
                                    onClick={() => {
                                        hapticLight();
                                        trackEvent('cookbook_print_opened', { recipeCount: recipes.length });
                                        setShowCookbookPrint(true);
                                    }}
                                    className="mt-2 ml-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-100/85 underline-offset-2 hover:underline"
                                >
                                    🖨 Print cookbook
                                </button>
                            </section>

                            <section className="relative hidden overflow-hidden rounded-[2.75rem] bg-[#2D4635] text-white shadow-[0_20px_60px_rgba(45,70,53,0.18)] md:block">
                                {(() => {
                                    const featured = sortedRecipes.find(r => r.image && isValidRecipeImageUrl(r.image));
                                    return featured ? (
                                        <div className="absolute inset-0 opacity-90">
                                            <HeroRecipeImage recipe={featured} />
                                            <div className="absolute inset-0 bg-gradient-to-r from-[#1a2a20]/95 via-[#1a2a20]/75 to-[#1a2a20]/30" />
                                        </div>
                                    ) : null;
                                })()}
                                <div className="relative z-10 p-8 lg:p-10">
                                    <div className="max-w-3xl space-y-5">
                                        <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-emerald-100/80">
                                            <span className="inline-block h-px w-8 bg-emerald-100/40" aria-hidden />
                                            The Schafer Cookbook
                                        </p>
                                        <h1 className="font-serif text-4xl italic leading-[1.03] md:text-6xl">
                                            Find something worth cooking tonight.
                                        </h1>
                                        <p className="max-w-xl font-serif text-lg italic leading-relaxed text-emerald-50/85">
                                            Search {dbStats.recipeCount} family recipes by dish, ingredient, person, season, or occasion.
                                        </p>
                                        <button
                                            type="button"
                                            data-testid="open-cookbook-print"
                                            onClick={() => {
                                                hapticLight();
                                                trackEvent('cookbook_print_opened', { recipeCount: recipes.length });
                                                setShowCookbookPrint(true);
                                            }}
                                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-100/40 px-5 py-2 text-xs font-black uppercase tracking-widest text-emerald-50 transition-colors hover:bg-white/10"
                                        >
                                            <span aria-hidden>🖨</span> Print the family cookbook
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {recipes.some(r => r.featured === true) && (
                                <Suspense fallback={null}>
                                    <FeaturedStrip recipes={recipes} onSelect={handleSelectRecipe} />
                                </Suspense>
                            )}

                            <section aria-label="Quick browse" className="-mx-1 px-1">
                                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                                    <button
                                        type="button"
                                        onClick={resetBrowse}
                                        className="min-h-11 shrink-0 rounded-full bg-[#2D4635] px-5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                                    >
                                        All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { resetBrowse(); setCategory('Main'); }}
                                        className="min-h-11 shrink-0 rounded-full border border-[#E8DCCB] bg-white/80 px-5 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                                    >
                                        Main dishes
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { resetBrowse(); setCategory('Dessert'); }}
                                        className="min-h-11 shrink-0 rounded-full border border-[#E8DCCB] bg-white/80 px-5 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                                    >
                                        Desserts
                                    </button>
                                    <span className="mx-1 h-6 w-px bg-stone-200 dark:bg-stone-700 shrink-0" aria-hidden />
                                    {quickCategoryCounts.map(({ name, count }) => (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => { resetBrowse(); setCategory(name); }}
                                            className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                                                category === name
                                                    ? 'bg-[#2D4635] text-white border-[#2D4635] shadow-sm'
                                                    : 'border-[#E8DCCB] bg-white/80 text-stone-700 hover:bg-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300'
                                            }`}
                                        >
                                            {name} · {count}
                                        </button>
                                    ))}
                                </div>
                                {currentUser?.role === 'admin' && localGeneratedImageCount > 0 && (
                                    <p className="mt-2 text-xs text-stone-600 dark:text-stone-300">
                                        {localGeneratedImageCount} of {recipes.length} cards use the cookbook fallback.{' '}
                                        <code className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 font-mono text-xs">npm run images:batch</code> upgrades them with Imagen.
                                    </p>
                                )}
                            </section>
                        </>
                    )}

                    <div className="sticky top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-30 -mx-1 space-y-2 rounded-[1.5rem] border border-[#E8DCCB]/75 bg-[#FFF8EC]/88 px-2 py-1.5 shadow-[0_10px_30px_rgba(45,70,53,0.08)] backdrop-blur-xl md:top-20 md:space-y-3 md:rounded-[2rem] md:px-3 md:py-2 dark:border-stone-800 dark:bg-stone-950/80">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:gap-3">
                            <div className="relative flex-1 min-w-0">
                                <label htmlFor="recipe-search" className="sr-only">Search recipes, ingredients, or instructions</label>
                                <span className="absolute left-4 top-1/2 hidden -translate-y-1/2 text-sm text-stone-600 dark:text-stone-300 md:block" aria-hidden="true">Search</span>
                                <input
                                    ref={recipeSearchRef}
                                    id="recipe-search"
                                    type="text"
                                    inputMode="search"
                                    placeholder="Search recipes, ingredients…"
                                    aria-label="Search recipes, ingredients, or instructions"
                                    className="min-h-12 w-full rounded-2xl border border-[#E8DCCB] bg-white/95 py-3 pl-4 pr-11 text-base text-stone-900 shadow-inner outline-none transition-all placeholder:text-stone-500 focus:border-[#A0522D] md:pl-16 md:pr-10 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-400"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        aria-label="Clear search"
                                        className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-stone-100 text-sm text-stone-700 hover:bg-stone-200"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            <div className="flex shrink-0 gap-2 md:hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowMobileFilters(v => !v)}
                                    className={`min-h-11 min-w-11 rounded-full border px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${
                                        showMobileFilters || activeFilterCount > 0
                                            ? 'bg-[#2D4635] text-white border-[#2D4635]'
                                            : 'border-[#E8DCCB] bg-white/90 text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300'
                                    }`}
                                    aria-expanded={showMobileFilters}
                                    aria-controls="mobile-recipe-filters"
                                >
                                    Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
                                </button>
                                {currentUser?.role === 'admin' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAddRecipeModal(true)}
                                        aria-label="Add a new recipe"
                                        className="min-h-11 min-w-11 rounded-full bg-[#A0522D] px-4 text-base font-bold text-white shadow transition-colors hover:bg-[#7A3F22]"
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                            <div className="hidden md:flex gap-2">
                                <label htmlFor="recipe-category" className="sr-only">Filter by category</label>
                                <select id="recipe-category" aria-label="Filter by category" className="min-h-11 cursor-pointer rounded-full border border-[#E8DCCB] bg-white/90 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800" value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="All">All categories</option>
                                    {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <label htmlFor="recipe-contributor" className="sr-only">Filter by contributor</label>
                                <select id="recipe-contributor" aria-label="Filter by contributor" className="min-h-11 cursor-pointer rounded-full border border-[#E8DCCB] bg-white/90 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800" value={contributor} onChange={e => setContributor(e.target.value)}>
                                    <option value="All">All contributors</option>
                                    {contributorOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {allTags.length > 0 && (
                                    <>
                                        <label htmlFor="recipe-tag" className="sr-only">Filter by tag</label>
                                        <select id="recipe-tag" aria-label="Filter by tag" className="min-h-11 cursor-pointer rounded-full border border-[#E8DCCB] bg-white/90 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
                                            <option value="">All tags</option>
                                            {allTags.map(t => <option key={t} value={t}>{getTagLabel(t)}</option>)}
                                        </select>
                                    </>
                                )}
                                <label htmlFor="recipe-sort" className="sr-only">Sort recipes</label>
                                <select id="recipe-sort" aria-label="Sort recipes" className="min-h-11 cursor-pointer rounded-full border border-[#E8DCCB] bg-white/90 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
                                    <option value="title-asc">A–Z</option>
                                    <option value="title-desc">Z–A</option>
                                    <option value="category">Category</option>
                                    <option value="contributor">Contributor</option>
                                    <option value="recent">Recently viewed</option>
                                </select>
                                {currentUser?.role === 'admin' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAddRecipeModal(true)}
                                        className="min-h-11 whitespace-nowrap rounded-full bg-[#A0522D] px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-[#7A3F22]"
                                    >
                                        + New recipe
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 px-2 text-xs text-stone-500 dark:text-stone-400 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <span className="min-w-0">
                                {sortedRecipes.length} {sortedRecipes.length === 1 ? 'recipe' : 'recipes'}
                                {activeFilterCount > 0
                                    ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
                                    : !isBrowsingFiltered ? <span className="hidden sm:inline"> · tap a card to view, or start cooking from the card</span> : ''}
                            </span>
                            {activeFilterCount > 0 && (
                                <button type="button" onClick={clearRecipeFilters} className="shrink-0 text-[#A0522D] hover:underline font-semibold">Reset filters</button>
                            )}
                        </div>

                        {isBrowsingFiltered && (
                            <div className="flex flex-wrap gap-2 px-1 scroll-strip" aria-label="Active filters">
                                {search.trim() && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="inline-flex max-w-[calc(100vw-2.5rem)] min-h-11 items-center gap-1.5 truncate rounded-full border border-[#E8DCCB] bg-white/90 px-3 py-2 text-xs font-semibold text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                                    >
                                        “{search.trim()}” <span aria-hidden>×</span>
                                    </button>
                                )}
                                {category !== 'All' && (
                                    <button
                                        type="button"
                                        onClick={() => setCategory('All')}
                                        className="inline-flex max-w-[calc(100vw-2.5rem)] min-h-11 items-center gap-1.5 truncate rounded-full border border-[#E8DCCB] bg-white/90 px-3 py-2 text-xs font-semibold text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                                    >
                                        {category} <span aria-hidden>×</span>
                                    </button>
                                )}
                                {contributor !== 'All' && (
                                    <button
                                        type="button"
                                        onClick={() => setContributor('All')}
                                        className="inline-flex max-w-[calc(100vw-2.5rem)] min-h-11 items-center gap-1.5 truncate rounded-full border border-[#E8DCCB] bg-white/90 px-3 py-2 text-xs font-semibold text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                                    >
                                        {contributor} <span aria-hidden>×</span>
                                    </button>
                                )}
                                {selectedTag && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTag('')}
                                        className="inline-flex max-w-[calc(100vw-2.5rem)] min-h-11 items-center gap-1.5 truncate rounded-full border border-[#E8DCCB] bg-white/90 px-3 py-2 text-xs font-semibold text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                                    >
                                        {getTagLabel(selectedTag)} <span aria-hidden>×</span>
                                    </button>
                                )}
                                {sortBy !== 'title-asc' && (
                                    <button
                                        type="button"
                                        onClick={() => setSortBy('title-asc')}
                                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#E8DCCB] bg-white/90 px-3 py-2 text-xs font-semibold text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                                    >
                                        {sortBy === 'title-desc' ? 'Z–A' : sortBy === 'category' ? 'Category' : sortBy === 'contributor' ? 'Contributor' : 'Recent'} <span aria-hidden>×</span>
                                    </button>
                                )}
                            </div>
                        )}

                        <div
                            id="mobile-recipe-filters"
                            className={`${showMobileFilters ? 'block' : 'hidden'} space-y-3 rounded-[2rem] border border-[#E8DCCB] bg-white/92 p-4 shadow-sm backdrop-blur-md md:hidden dark:border-stone-700 dark:bg-[var(--bg-secondary)]/90`}
                        >
                            <div className="grid grid-cols-1 gap-3">
                                <select aria-label="Filter by category" className="rounded-2xl border border-[#E8DCCB] bg-stone-50 px-5 py-4 text-base font-bold text-stone-700 outline-none dark:border-stone-700 dark:bg-[var(--input-bg)] dark:text-stone-200" value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="All">All Categories</option>
                                    {RECIPE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select aria-label="Filter by contributor" className="rounded-2xl border border-[#E8DCCB] bg-stone-50 px-5 py-4 text-base font-bold text-stone-700 outline-none dark:border-stone-700 dark:bg-[var(--input-bg)] dark:text-stone-200" value={contributor} onChange={e => setContributor(e.target.value)}>
                                    <option value="All">All Contributors</option>
                                    {contributorOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {allTags.length > 0 && (
                                    <select aria-label="Filter by tag" className="rounded-2xl border border-[#E8DCCB] bg-stone-50 px-5 py-4 text-base font-bold text-stone-700 outline-none dark:border-stone-700 dark:bg-[var(--input-bg)] dark:text-stone-200" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
                                        <option value="">All Tags</option>
                                        {allTags.map(t => <option key={t} value={t}>{getTagLabel(t)}</option>)}
                                    </select>
                                )}
                                <select aria-label="Sort recipes" className="rounded-2xl border border-[#E8DCCB] bg-stone-50 px-5 py-4 text-base font-bold text-stone-700 outline-none dark:border-stone-700 dark:bg-[var(--input-bg)] dark:text-stone-200" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
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
                                    className="rounded-full border border-[#E8DCCB] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-stone-700 dark:border-stone-700 dark:text-stone-200"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    {!isBrowsingFiltered && !isDataLoading && recipes.length > 0 && browseShelves.length > 0 && (
                        <div id="quick-access-recipes" className="scroll-mt-40 space-y-5">
                            {browseShelves.map((shelf) => (
                                <section key={shelf.id} aria-label={shelf.label} className="space-y-3">
                                    <div className="flex items-end justify-between gap-3">
                                        <div>
                                            <h2 className="font-serif text-2xl italic leading-none text-[#2D4635] dark:text-emerald-100">{shelf.label}</h2>
                                            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{shelf.detail}</p>
                                        </div>
                                        {shelf.action && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                        setSearch('');
                                                        setSelectedTag('');
                                                        setContributor('All');
                                                        setCategory('All');
                                                        setSortBy('title-asc');
                                                        shelf.action?.();
                                                        handleSetTab('Recipes');
                                                        setTimeout(() => document.getElementById('quick-access-recipes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
                                                }}
                                                className="hidden min-h-10 items-center rounded-full border border-[#E8DCCB] bg-white/80 px-4 text-[10px] font-black uppercase tracking-widest text-stone-700 hover:bg-white sm:inline-flex dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                                            >
                                                View all
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                                        {shelf.recipes.map((recipe) => (
                                            <RecipeShelfCard
                                                key={`${shelf.id}-${recipe.id}`}
                                                recipe={recipe}
                                                onSelect={handleSelectRecipe}
                                                isFavorite={favoriteIds.has(recipe.id)}
                                                onToggleFavorite={handleToggleFavorite}
                                                wasViewed={recentIds.includes(recipe.id)}
                                                isOffline={offlineRecipeIds.has(recipe.id)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}

                    {isDataLoading ? (
                        <RecipeGridSkeleton />
                    ) : (
                        <div className="grid grid-cols-1 items-stretch min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6 scroll-mt-36" data-testid="recipe-card-grid" id="recipe-card-grid">
                            {sortedRecipes.map(recipe => {
                                const isFav = favoriteIds.has(recipe.id);
                                const rating = getAverageRating(recipe.id);
                                const ratingCount = getRatingCount(recipe.id);
                                const contribAvatar = getAvatar(recipe.contributor);
                                const effortLabel = getRecipeEffortLabel(recipe);
                                const wasViewed = recentIds.includes(recipe.id);
                                const isOffline = offlineRecipeIds.has(recipe.id);
                                const microcopy = getRecipeCardMicrocopy(recipe, ratingCount, isFav, wasViewed);
                                const timeLabel = getRecipeTimeLabel(recipe);
                                const normalizedContributor = normalizeContributorName(recipe.contributor);
                                return (
                                    <article
                                        key={recipe.id}
                                        className="recipe-card-surface group relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-within:ring-2 focus-within:ring-[#A0522D] focus-within:ring-offset-2 focus-within:ring-offset-[#FDFBF7] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-stone-800 dark:focus-within:ring-offset-stone-950"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleSelectRecipe(recipe)}
                                            aria-label={getRecipeCardAriaLabel(recipe, rating, ratingCount, effortLabel, isFav, wasViewed, isOffline)}
                                            data-testid="recipe-card-open"
                                            data-recipe-id={recipe.id}
                                            className="block w-full text-left"
                                        >
                                            <div className="relative aspect-[4/3] overflow-hidden bg-stone-100 dark:bg-stone-800">
                                                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]">
                                                    <RecipeCardImage recipe={recipe} />
                                                </div>
                                                {isOffline && <OfflineRecipeBadge />}
                                                {timeLabel && (
                                                    <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-md px-2.5 py-1 text-xs font-semibold text-white">
                                                        <span aria-hidden>⏱</span>
                                                        <span>{timeLabel}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </button>

                                        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                                            <div className="flex min-w-0 items-center justify-between gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearch('');
                                                        setSelectedTag('');
                                                        setContributor('All');
                                                        setCategory(recipe.category);
                                                        hapticLight();
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="min-h-8 truncate rounded-full bg-[#FDF6EC] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#A0522D] transition-colors hover:bg-[#F3E4D2] focus-visible:ring-2 focus-visible:ring-[#A0522D] dark:bg-stone-800 dark:text-amber-300"
                                                    aria-label={`Filter recipes by ${recipe.category}`}
                                                >
                                                    {recipe.category}
                                                </button>
                                                <span className="shrink-0 rounded-full border border-stone-200 bg-white/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#2D4635] dark:border-stone-700 dark:bg-stone-900 dark:text-emerald-100">
                                                    {effortLabel}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleSelectRecipe(recipe)}
                                                aria-label={getRecipeCardAriaLabel(recipe, rating, ratingCount, effortLabel, isFav, wasViewed, isOffline)}
                                                className="mt-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A0522D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF7] rounded-2xl dark:focus-visible:ring-offset-stone-950"
                                            >
                                                <h3 className="text-base sm:text-lg md:text-xl font-serif italic leading-snug text-[#2D4635] dark:text-emerald-100 line-clamp-2 min-h-[2.75rem] sm:min-h-[3rem] md:min-h-[3.25rem]">
                                                    {recipe.title}
                                                </h3>
                                                <p className="mt-1 hidden line-clamp-2 min-h-[2rem] text-[11px] leading-snug text-stone-500 dark:text-stone-400 sm:block">
                                                    {microcopy}
                                                </p>
                                            </button>

                                            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearch('');
                                                        setSelectedTag('');
                                                        setCategory('All');
                                                        setContributor(normalizedContributor);
                                                        hapticLight();
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="flex min-h-9 min-w-0 items-center gap-1.5 rounded-full pr-2 text-left transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-[#A0522D] dark:hover:bg-stone-800"
                                                    aria-label={`Filter recipes by contributor ${recipe.contributor}`}
                                                >
                                                    <img
                                                        src={contribAvatar}
                                                        alt=""
                                                        aria-hidden
                                                        onError={avatarOnError}
                                                        className="w-6 h-6 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                                                    />
                                                    <span className="truncate font-serif italic">{recipe.contributor}</span>
                                                </button>
                                                {rating > 0 && (
                                                    <span className="flex items-center gap-0.5 text-amber-600 font-semibold shrink-0" aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${ratingCount} ratings`}>
                                                        ★ {rating.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        recordRecipeView(recipe.id, recipe.title);
                                                        setCookModeFromOfflineCache(false);
                                                        setCookModeRecipe(recipe);
                                                        hapticLight();
                                                        trackEvent('cook_mode_started', { recipeId: recipe.id, source: 'recipe_card' });
                                                    }}
                                                    className="btn btn-primary btn-body w-full"
                                                    aria-label={`Start cooking ${recipe.title}`}
                                                >
                                                    <span className="sm:hidden">Cook</span>
                                                    <span className="hidden sm:inline">Start Cooking</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectRecipe(recipe)}
                                                    className="btn btn-secondary btn-body w-full"
                                                    aria-label={`View recipe details for ${recipe.title}`}
                                                >
                                                    <span className="sm:hidden">View</span>
                                                    <span className="hidden sm:inline">View Recipe</span>
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(recipe.id); }}
                                            className={`absolute top-2 left-2 z-20 flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-full backdrop-blur transition-all hover:scale-110 active:scale-95 ${
                                                isFav ? 'bg-white/95 text-red-500 shadow-md ring-2 ring-red-100' : 'bg-black/30 text-white hover:bg-white/95 hover:text-red-500'
                                            }`}
                                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                            aria-label={isFav ? `Remove ${recipe.title} from favorites` : `Add ${recipe.title} to favorites`}
                                        >
                                            <span className="text-lg leading-none">{isFav ? '♥' : '♡'}</span>
                                        </button>
                                        {currentUser?.role === 'admin' && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingRecipe(recipe);
                                                    handleSetTab('Profile');
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="absolute top-2 right-2 z-20 flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-full bg-white/95 text-[#A0522D] shadow-md backdrop-blur transition-transform hover:scale-110 active:scale-95"
                                                title="Edit with AI"
                                                aria-label={`Edit ${recipe.title} with AI`}
                                            >
                                                ✨
                                            </button>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}

                    {!isDataLoading && filteredRecipes.length === 0 && (
                        <div className="py-20 text-center space-y-6">
                            <span className="text-5xl" aria-hidden="true">🍂</span>
                            <div className="mx-auto max-w-xl space-y-2 rounded-[2rem] border border-[#E8DCCB] bg-white/75 p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900/75">
                                <p className="font-serif text-2xl italic text-[#2D4635] dark:text-emerald-100">
                                    {recipes.length === 0
                                        ? 'The recipe archive is ready for its first card.'
                                        : 'No recipes match your search or filters.'}
                                </p>
                                <p className="mx-auto max-w-md text-sm text-stone-700 dark:text-stone-300">
                                    {recipes.length === 0
                                        ? (currentUser?.role === 'admin' ? 'Add the first family recipe, then the archive will generate the browsing experience around it.' : 'Ask an administrator to add the first family recipe.')
                                        : 'Try clearing filters, browsing by category, or searching a family member, ingredient, or dish name.'}
                                </p>
                                {recipes.length > 0 ? (
                                    <div className="flex flex-wrap justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={clearRecipeFilters}
                                            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2D4635] px-6 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-[#1B2C22]"
                                        >
                                            Clear filters
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { clearRecipeFilters(); setCategory('Main'); }}
                                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#E8DCCB] bg-white px-6 py-3 text-sm font-black uppercase tracking-widest text-stone-700 transition-colors hover:bg-stone-50"
                                        >
                                            Browse mains
                                        </button>
                                    </div>
                                ) : currentUser?.role === 'admin' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAddRecipeModal(true)}
                                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2D4635] px-6 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-[#1B2C22]"
                                    >
                                        Add New Recipe
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            )}

            {tab === 'Index' && (
                <Suspense fallback={<IndexSkeleton />}>
                    <AlphabeticalIndex recipes={recipes} onSelect={handleSelectRecipe} onGoToRecipes={() => { handleSetTab('Recipes'); window.scrollTo(0, 0); }} />
                </Suspense>
            )}

            {tab === 'Family Story' && (
                <Suspense fallback={<HistorySkeleton />}>
                    <HistoryView />
                </Suspense>
            )}

            {tab === 'Contributors' && (
                <Suspense fallback={<TabFallback />}>
                    {isDataLoading ? (
                        <div className="max-w-7xl mx-auto py-12 px-6">
                            <h2 className="text-4xl font-serif italic text-[#2D4635] mb-12">The Contributors</h2>
                            <ContributorsSkeleton />
                        </div>
                    ) : (
                        <ContributorsView
                            recipes={recipes}
                            gallery={gallery}
                            trivia={trivia}
                            contributors={contributorsForDisplay}
                            onSelectContributor={(c) => { setContributor(c); setTab('Recipes'); window.scrollTo(0, 0); }}
                            onViewGallery={(c) => { setGalleryContributorFilter(c); handleSetTab('Gallery'); window.scrollTo(0, 0); }}
                            onGoToRecipes={() => { handleSetTab('Recipes'); window.scrollTo(0, 0); }}
                        />
                    )}
                </Suspense>
            )}

            {tab === 'Privacy' && (
                <Suspense fallback={<TabFallback />}>
                    <PrivacyView />
                </Suspense>
            )}

            {tab === 'Help' && (
                <Suspense fallback={<TabFallback />}>
                    <HelpView />
                </Suspense>
            )}

            {tab === 'Grocery List' && (
                <Suspense fallback={<TabFallback />}>
                    <section id="main-content-grocery" aria-label="Grocery list" tabIndex={-1}>
                        <GroceryListView
                            onBrowseRecipes={() => handleSetTab('Recipes')}
                            onOpenCollections={() => handleSetTab('Collections')}
                            onOpenMealPlan={() => handleSetTab('Meal Plan')}
                            highlightRecipeTitle={groceryHighlightTitle}
                            onHighlightConsumed={clearGroceryHighlight}
                        />
                    </section>
                </Suspense>
            )}

            {tab === 'Collections' && currentUser && (
                <Suspense fallback={<TabFallback />}>
                    <section className="view-shell" aria-label="Recipe collections" tabIndex={-1}>
                        <CollectionsView
                            recipes={recipes}
                            currentUserName={currentUser.name}
                            onViewRecipe={(recipe) => handleSelectRecipe(recipe)}
                            onOpenGroceryList={() => handleSetTab('Grocery List')}
                        />
                    </section>
                </Suspense>
            )}

            {tab === 'Meal Plan' && currentUser && (
                <Suspense fallback={<TabFallback />}>
                    <section id="main-content-meal-plan" aria-label="Meal plan" tabIndex={-1}>
                        <MealPlanView
                            recipes={recipes}
                            onViewRecipe={(recipe) => handleSelectRecipe(recipe)}
                            onBrowseRecipes={() => handleSetTab('Recipes')}
                            onOpenGroceryList={() => handleSetTab('Grocery List')}
                            syncVersion={prefsHydrationVersion}
                        />
                    </section>
                </Suspense>
            )}

            {tab === 'Profile' && currentUser && (
                <Suspense fallback={<ProfileSkeleton />}>
                    <ProfileView
                        currentUser={currentUser}
                        prefsSyncStatus={prefsSyncStatus}
                        userRecipes={recipesForContributor(currentUser.name, recipes).filter(
                            (r) => !defaultRecipeIds.has(r.id)
                        )}
                        userHistory={historyForContributor(currentUser.name, history)}
                        favoriteRecipes={recipes.filter(r => favoriteIds.has(r.id))}
                        recentRecipes={getRecentlyViewedEntries()
                            .map(e => recipes.find(r => r.id === e.id))
                            .filter((r): r is Recipe => !!r)}
                        allRecipes={recipes}
                        onViewRecipe={(r) => handleSelectRecipe(r)}
                        onUpdateProfile={async (name, avatar) => {
                            const existing = contributors.find(c => c.name.toLowerCase() === currentUser.name.toLowerCase());
                            const profileToUpdate = {
                                id: existing?.id || currentUser.id,
                                name,
                                avatar,
                                role: currentUser.role,
                                email: currentUser.email
                            };
                            try {
                                await CloudArchive.upsertContributor(profileToUpdate);
                                // Local sync
                                const updatedUser = { ...currentUser, name, picture: avatar };
                                setCurrentUser(updatedUser);
                                localStorage.setItem('schafer_user', JSON.stringify(updatedUser));
                                await refreshLocalState();
                            } catch (e) {
                                if (e instanceof FirebaseError && e.code === 'permission-denied') {
                                    throw new Error(
                                        'The shared family directory is managed by custodians. Sign in with Google under Profile → Admin tools (if you are one), or ask a custodian to update your profile.'
                                    );
                                }
                                throw new Error(CLOUD_ERROR_MSG);
                            }
                        }}
                        onEditRecipe={(recipe) => {
                            setEditingRecipe(recipe);
                            handleSetTab('Profile');
                        }}
                        contributors={contributorsForDisplay}
                        adminSectionProps={currentUser.role === 'admin' ? {
                            editingRecipe,
                            clearEditing: () => setEditingRecipe(null),
                            recipes,
                            trivia,
                            contributors: contributorsForDisplay,
                            dbStats: { ...dbStats, archivePhone },
                            gallery,
                            onDeleteGalleryItem: async (id) => {
                                try {
                                    await CloudArchive.deleteGalleryItem(id);
                                    setGallery(prev => prev.filter(g => g.id !== id));
                                    await refreshLocalState();
                                } catch {
                                    toast(CLOUD_ERROR_MSG, 'error');
                                    throw new Error(CLOUD_ERROR_MSG);
                                }
                            },
                            onUpdateGalleryItem: async (id, patch) => {
                                try {
                                    await CloudArchive.updateGalleryItem(id, patch);
                                    setGallery(prev => prev.map(g => {
                                        if (g.id !== id) return g;
                                        const next: GalleryItem = { ...g };
                                        if (typeof patch.caption === 'string') next.caption = patch.caption;
                                        if (patch.date instanceof Date && !isNaN(patch.date.getTime())) {
                                            next.created_at = patch.date.toISOString();
                                        }
                                        if (patch.status === 'pending' || patch.status === 'approved') {
                                            next.status = patch.status;
                                        }
                                        return next;
                                    }));
                                    await refreshLocalState();
                                } catch {
                                    toast(CLOUD_ERROR_MSG, 'error');
                                    throw new Error(CLOUD_ERROR_MSG);
                                }
                            },
                            onAddRecipe: async (r, f) => {
                                try {
                                    const url = f ? await CloudArchive.uploadFile(f, 'recipes') : r.image;
                                    await CloudArchive.upsertRecipe({ ...r, image: url || r.image }, currentUser.name);
                                    await refreshLocalState();
                                } catch {
                                    toast(CLOUD_ERROR_MSG, 'error');
                                }
                            },
                            onAddGallery: uploadGalleryMemory,
                            onAddTrivia: async (t) => {
                                try {
                                    await CloudArchive.upsertTrivia(t);
                                    await refreshLocalState();
                                } catch {
                                    toast(CLOUD_ERROR_MSG, 'error');
                                }
                            },
                            onDeleteTrivia: async (id) => {
                                try {
                                    await CloudArchive.deleteTrivia(id);
                                    await refreshLocalState();
                                } catch {
                                    toast(CLOUD_ERROR_MSG, 'error');
                                }
                            },
                            onDeleteRecipe: async (id) => {
                                try {
                                    await CloudArchive.deleteRecipe(id);
                                    await refreshLocalState();
                                } catch {
                                    toast(CLOUD_ERROR_MSG, 'error');
                                }
                            },
                            onUpdateContributor: async (p) => {
                                try {
                                    await CloudArchive.upsertContributor(p);
                                    if (currentUser && p.name.toLowerCase() === currentUser.name.toLowerCase()) {
                                        const updatedUser = { ...currentUser, name: p.name, picture: p.avatar, role: p.role };
                                        setCurrentUser(updatedUser);
                                        localStorage.setItem('schafer_user', JSON.stringify(updatedUser));
                                    }
                                    await refreshLocalState();
                                } catch {
                                    toast(CLOUD_ERROR_MSG, 'error');
                                }
                            },
                            onUpdateArchivePhone: async (p) => {
                                try {
                                    await CloudArchive.setArchivePhone(p);
                                    setArchivePhone(p);
                                } catch {
                                    toast(CLOUD_ERROR_MSG, 'error');
                                }
                            },
                            onEditRecipe: setEditingRecipe,
                            defaultRecipeIds: Array.from(defaultRecipeIds),
                            ...(CloudArchive.getProvider() === 'firebase'
                                ? {
                                      firebaseCustodian: {
                                          canWrite: custodianAuth.isAdmin,
                                          email: custodianAuth.user?.email ?? null,
                                          onGoogleSignIn: signInCustodianWithGoogle,
                                          onSignOut: signOutFirebaseCustodian,
                                      },
                                  }
                                : {}),
                        } : undefined}
                    />
                </Suspense>
            )}
            {/* Onboarding Walkthrough */}
            {showOnboarding && (
                <Suspense fallback={null}>
                    <OnboardingWalkthrough onComplete={() => setShowOnboarding(false)} />
                </Suspense>
            )}

            {/* Contributor Spotlight */}
            {spotlightContributor && (
                <Suspense fallback={null}>
                    <ContributorSpotlight
                        contributor={spotlightContributor}
                        recipes={recipes}
                        onViewRecipe={(r) => {
                            setSpotlightContributor(null);
                            handleSelectRecipe(r);
                        }}
                        onClose={() => setSpotlightContributor(null)}
                    />
                </Suspense>
            )}

            <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
            <BottomNav activeTab={tab} setTab={handleSetTab} currentUser={currentUser} />
            <Suspense fallback={null}><InstallPrompt /></Suspense>
            </div>
        </div>
    );
};

export default App;
