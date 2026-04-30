import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { UserProfile, Recipe, GalleryItem, Trivia, DBStats, ContributorProfile } from './types';
import { useUI } from './context/UIContext';
import { shouldToastImageError } from './utils/imageErrorToast';
import { FirebaseError } from 'firebase/app';
import { CloudArchive } from './services/db';
import {
    subscribeFirebaseCustodian,
    signInCustodianWithGoogle,
    signOutFirebaseCustodian,
    type CustodianAuthState,
} from './services/firebaseCustodianAuth';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { PLACEHOLDER_AVATAR } from './constants';
import { getAverageRating, getRatingCount, isFamilyApproved } from './utils/ratings';
import { STORAGE_KEYS } from './constants/storage';
import { addActivity } from './utils/activityFeed';
const RecipeModal = lazy(() => import('./components/RecipeModal').then(m => ({ default: m.RecipeModal })));
const CookModeView = lazy(() => import('./components/CookModeView').then(m => ({ default: m.CookModeView })));
import { BottomNav } from './components/BottomNav';
import { getFavoriteIds, toggleFavorite } from './utils/favorites';
import { useUserPrefsSync } from './services/useUserPrefsSync';
import { recordRecipeView, getRecentRecipeIds, getRecentlyViewedEntries } from './utils/recentlyViewed';
import { useFocusTrap } from './utils/focusTrap';
import { avatarOnError } from './utils/avatarFallback';
import { hapticLight } from './utils/haptics';
import { trackEvent } from './services/analytics';
import { listenForForegroundMessages } from './services/pushNotifications';
import { queueUpload } from './services/offlineUploadQueue';
import { useOfflineUploadQueue } from './hooks/useOfflineUploadQueue';
import { isSuperAdmin } from './config/site';
import { mergeContributorsForDisplay } from './utils/mergeContributorsForDisplay';
import { contributorAvatarUrlForName } from './utils/contributorAvatar';

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
const InstallPrompt = lazy(() => import('./components/InstallPrompt').then(m => ({ default: m.InstallPrompt })));

const TabFallback = () => (
    <div className="flex items-center justify-center min-h-[50vh] text-stone-500">
        <span className="animate-pulse font-serif italic motion-reduce:animate-none">Loading…</span>
    </div>
);

interface FamilyHubProps {
    activeTab: string;
    onSelect: (tabId: string) => void;
    galleryCount: number;
    triviaCount: number;
    contributorCount: number;
}

const FamilyHub: React.FC<FamilyHubProps> = ({ activeTab, onSelect, galleryCount, triviaCount, contributorCount }) => {
    const items = [
        { id: 'Gallery', label: 'Gallery', detail: `${galleryCount} memories`, icon: '📷' },
        { id: 'Trivia', label: 'Trivia', detail: `${triviaCount} questions`, icon: '🎲' },
        { id: 'Family Story', label: 'Story', detail: 'Read the archive', icon: '📖' },
        { id: 'Contributors', label: 'People', detail: `${contributorCount} contributors`, icon: '👥' },
    ];
    return (
        <section
            aria-label="Family hub navigation"
            className="max-w-[1400px] mx-auto px-3 md:px-6 pt-3 md:pt-6 pb-1"
        >
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                {items.map((item) => {
                    const active = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => { onSelect(item.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            aria-current={active ? 'page' : undefined}
                            className={`min-h-11 shrink-0 flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all active:scale-[0.98] ${
                                active
                                    ? 'bg-[#2D4635] text-white shadow-sm'
                                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700'
                            }`}
                        >
                            <span aria-hidden className="text-base leading-none">{item.icon}</span>
                            <span>{item.label}</span>
                            <span className={`hidden sm:inline text-[10px] font-medium normal-case tracking-normal ${active ? 'text-emerald-100/80' : 'text-stone-400'}`}>· {item.detail}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

const RecipeGridSkeleton: React.FC = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
            <div className="w-full aspect-video rounded-2xl mb-4 bg-gradient-to-br from-stone-100 to-stone-200 flex flex-col items-center justify-center gap-2 text-stone-400 border border-stone-200">
                <span className="text-4xl opacity-60">📷</span>
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
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
            onClick={onClose}
        >
            <div
                ref={containerRef}
                className="bg-white dark:bg-[var(--card-bg)] rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 fade-in duration-200"
                onClick={(e) => e.stopPropagation()}
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
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300 cursor-zoom-out pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
            onClick={onClose}
        >
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
                    className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500"
                    onClick={(e) => e.stopPropagation()}
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
                    className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500 pointer-events-none"
                    alt={item.caption || 'Gallery photo'}
                    onClick={(e) => e.stopPropagation()}
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

const isValidImageUrl = (url: string) =>
    !!url && (url.startsWith('/recipe-images/') || url.startsWith('http://') || url.startsWith('https://'));

const CATEGORY_ICONS: Record<string, string> = {
    Breakfast: '🥞',
    Main: '🍲',
    Dessert: '🍰',
    Side: '🥗',
    Appetizer: '🧀',
    Bread: '🍞',
    'Dip/Sauce': '🫕',
    Snack: '🍿',
    Generic: '🍽️'
};

const RecipeImageFallback: React.FC<{ category: Recipe['category']; label?: string; compact?: boolean }> = ({ category, label = 'Image unavailable', compact = false }) => (
    <div className="absolute inset-0 overflow-hidden bg-[#2D4635]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(244,164,96,0.35),transparent_32%),radial-gradient(circle_at_75%_80%,rgba(16,185,129,0.22),transparent_36%)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D4635]/95 via-[#2D4635]/78 to-[#A0522D]/82" />
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(135deg,#fff_0_1px,transparent_1px_18px)]" aria-hidden="true" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
            <span className={`${compact ? 'text-3xl' : 'text-5xl md:text-6xl'} mb-3 drop-shadow-lg`} aria-hidden="true">
                {CATEGORY_ICONS[category] || CATEGORY_ICONS.Generic}
            </span>
            <span className="font-serif italic text-sm md:text-base text-white/85">{category}</span>
            {!compact && (
                <span className="mt-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white/80 backdrop-blur-sm">
                    {label}
                </span>
            )}
        </div>
    </div>
);

const RecipeCardImage: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
    const [broken, setBroken] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const { toast } = useUI();
    const hasValidImage = isValidImageUrl(recipe.image) && !broken;
    const imageSourceLabel = recipe.imageSource === 'nano-banana'
        ? 'Designed with Imagen'
        : recipe.imageSource === 'pollinations'
            ? 'Generated from recipe'
            : recipe.imageSource === 'upload'
                ? 'Family photo'
                : recipe.imageSource === 'local-generated'
                    ? 'Recipe-specific image'
                    : null;

    const handleImageError = () => {
        setBroken(true);
        if (shouldToastImageError(recipe.id)) {
            toast("Some recipe images couldn't load. Check your connection and refresh.", 'info');
        }
    };

    if (hasValidImage) {
        return (
            <>
                {!loaded && (
                    <div className="absolute inset-0 bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300 animate-pulse" />
                )}
                <img
                    src={recipe.image}
                    width={800}
                    height={600}
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                    loading="lazy"
                    decoding="async"
                    alt={recipe.title}
                    onLoad={() => setLoaded(true)}
                    onError={handleImageError}
                />
                {imageSourceLabel && (
                    <span className="absolute top-4 right-4 z-10 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-white/85 shadow-lg backdrop-blur-md">
                        {imageSourceLabel}
                    </span>
                )}
            </>
        );
    }

    return (
        <RecipeImageFallback category={recipe.category} label="Image unavailable" />
    );
};

const HeroRecipeImage: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
    const [broken, setBroken] = useState(false);
    if (!isValidImageUrl(recipe.image) || broken) {
        return <RecipeImageFallback category={recipe.category} compact label="Hero image unavailable" />;
    }

    return (
        <>
            <img
                src={recipe.image}
                alt=""
                className="w-full h-full object-cover opacity-25"
                aria-hidden="true"
                loading="eager"
                decoding="async"
                onError={() => setBroken(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2D4635] via-[#2D4635]/90 to-[#2D4635]/58" />
        </>
    );
};

const RECIPE_HASH_REGEX = /^#recipe\/(.+)$/;

const CLOUD_ERROR_MSG = "Couldn't save. Check your connection and try again.";

const App: React.FC = () => {
    const { toast } = useUI();
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
        setCurrentUser(null);
        setTab('Home');
    };

    const [dbStats, setDbStats] = useState<DBStats>({
        recipeCount: 0, galleryCount: 0, triviaCount: 0,
        isCloudActive: CloudArchive.getProvider() !== 'local',
        activeProvider: CloudArchive.getProvider()
    });

    const [archivePhone, setArchivePhone] = useState(() => localStorage.getItem('schafer_archive_phone') || '');

    const [custodianAuth, setCustodianAuth] = useState<CustodianAuthState>({ user: null, isAdmin: false });

    const [loginName, setLoginName] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [contributor, setContributor] = useState('All');
    const [selectedTag, setSelectedTag] = useState('');
    const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'category' | 'contributor' | 'recent'>('title-asc');
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => getFavoriteIds());

    // Cloud-sync favorites + ratings under the user's identity slug. On login
    // we merge remote into local (favorites union; remote-wins ratings) and
    // refresh React state. Subsequent local changes debounce-write up to
    // Firestore. Silently no-ops for guests or when cloud is unavailable.
    useUserPrefsSync(currentUser?.name, {
        onHydrated: () => setFavoriteIds(getFavoriteIds()),
    });

    const [cookModeRecipe, setCookModeRecipe] = useState<Recipe | null>(null);
    const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [spotlightContributor, setSpotlightContributor] = useState<ContributorProfile | null>(null);

    const handleSetTab = (newTab: string) => {
        setTab(newTab);
    };

    const defaultRecipeIds = useMemo(
        () => new Set((defaultRecipes as Recipe[]).map(r => r.id)),
        []
    );

    const contributorsForDisplay = useMemo(
        () => mergeContributorsForDisplay(contributors, recipes, gallery, trivia),
        [contributors, recipes, gallery, trivia]
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
                setRecipes(r);
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
            // Auto-seed trivia if empty in local mode
            if (provider === 'local') {
                CloudArchive.getTrivia()
                    .then(current => {
                        if (current.length === 0) {
                            return Promise.all(TRIVIA_SEED.map(t => CloudArchive.upsertTrivia(t as any)))
                                .then(refreshLocalState);
                        }
                    })
                    .catch(() => toast(CLOUD_ERROR_MSG, 'error'));
            }
            return;
        }

        const unsubR = CloudArchive.subscribeRecipes(r => {
            setRecipes(r);
            setIsDataLoading(false);
            setIsInitialLoad(false);
        });
        const unsubT = CloudArchive.subscribeTrivia(setTrivia);
        const unsubG = CloudArchive.subscribeGallery(setGallery);
        const unsubC = CloudArchive.subscribeContributors(setContributors);
        const unsubH = CloudArchive.subscribeHistory(setHistory);
        const unsubPhone = CloudArchive.subscribeArchivePhone(setArchivePhone);
        return () => { unsubR(); unsubT(); unsubG(); unsubC(); unsubH(); unsubPhone(); };
    }, []);

    useEffect(() => {
        if (CloudArchive.getProvider() !== 'firebase') {
            setCustodianAuth({ user: null, isAdmin: false });
            return;
        }
        return subscribeFirebaseCustodian(setCustodianAuth);
    }, [dbStats.activeProvider, dbStats.isCloudActive]);

    // Deep-link handling: open recipe from #recipe/{id}
    useEffect(() => {
        const applyHash = () => {
            const match = window.location.hash.match(RECIPE_HASH_REGEX);
            if (match) {
                const id = decodeURIComponent(match[1]);
                const recipe = recipes.find(r => r.id === id);
                if (recipe) {
                    recordRecipeView(recipe.id, recipe.title);
                    setTab('Recipes');
                    setSelectedRecipe(recipe);
                }
            }
        };
        applyHash();
        window.addEventListener('hashchange', applyHash);
        return () => window.removeEventListener('hashchange', applyHash);
    }, [recipes]);

    useEffect(() => {
        setDbStats(prev => ({ ...prev, recipeCount: recipes.length, triviaCount: trivia.length, galleryCount: gallery.length }));
    }, [recipes, trivia, gallery]);

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
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };
        window.addEventListener('schafer:navigate', handler);
        return () => window.removeEventListener('schafer:navigate', handler);
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

    const { pendingUploadCount, refreshPendingCount } = useOfflineUploadQueue(tab, gallery.length, {
        onUploadsProcessed: refreshLocalState,
        onToast: toast,
    });

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginName.trim() || isLoggingIn) return;

        setIsLoggingIn(true);

        const name = loginName.trim();
        const existing = contributors.find(c => c.name.toLowerCase() === name.toLowerCase());
        const isSuper = isSuperAdmin(name);
        const email = isSuper && name.includes('@') ? name : existing?.email;

        const u: UserProfile = {
            id: existing?.id || 'u' + Date.now(),
            name: existing?.name || name,
            picture: existing?.avatar ?? contributorAvatarUrlForName(name),
            role: isSuper ? 'admin' : ((existing?.role as any) || (name.toLowerCase() === 'admin' ? 'admin' : 'user')),
            email: email
        };
        localStorage.setItem('schafer_user', JSON.stringify(u));
        setCurrentUser(u);
        setIsLoggingIn(false);
        // Show onboarding for first-time users
        if (!localStorage.getItem(STORAGE_KEYS.onboardingDone)) {
            setShowOnboarding(true);
        }
    };

    const getAvatar = (name: string) => {
        const c = contributorsForDisplay.find(
            p => p.name === name || p.name.toLowerCase() === name.toLowerCase()
        );
        return c?.avatar || contributorAvatarUrlForName(name);
    };

    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        recipes.forEach(r => r.tags?.forEach(t => tagSet.add(t)));
        return Array.from(tagSet).sort();
    }, [recipes]);

    const filteredRecipes = useMemo(() => {
        return recipes.filter(r => {
            const q = search.toLowerCase();
            const matchS = !q ||
                r.title.toLowerCase().includes(q) ||
                r.ingredients.some(ing => ing.toLowerCase().includes(q)) ||
                r.instructions.some(step => step.toLowerCase().includes(q)) ||
                (r.notes?.toLowerCase().includes(q) ?? false) ||
                r.contributor.toLowerCase().includes(q);
            const matchC = category === 'All' || r.category === category;
            const matchA = contributor === 'All' || r.contributor === contributor;
            const matchT = !selectedTag || (r.tags?.includes(selectedTag) ?? false);
            return matchS && matchC && matchA && matchT;
        });
    }, [recipes, search, category, contributor, selectedTag]);

    const recentIds = useMemo(() => getRecentRecipeIds(), [recipes, selectedRecipe]);
    const matchedContributor = useMemo(
        () => contributors.find(c => c.name.toLowerCase() === loginName.trim().toLowerCase()) ?? null,
        [contributors, loginName]
    );
    const loginPreviewAvatar = useMemo(() => {
        const n = loginName.trim();
        if (!n) return PLACEHOLDER_AVATAR;
        return (
            contributorsForDisplay.find(c => c.name.toLowerCase() === n.toLowerCase())?.avatar
            ?? contributorAvatarUrlForName(n)
        );
    }, [contributorsForDisplay, loginName]);
    const activeFilterCount = [category !== 'All', contributor !== 'All', !!selectedTag, sortBy !== 'title-asc'].filter(Boolean).length;

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

    const localGeneratedImageCount = useMemo(
        () => recipes.filter((recipe) => recipe.imageSource === 'local-generated').length,
        [recipes]
    );

    const quickCategoryCounts = useMemo(() => {
        const wanted = ['Main', 'Dessert', 'Breakfast', 'Dip/Sauce'] as const;
        return wanted
            .map((name) => ({ name, count: recipes.filter((recipe) => recipe.category === name).length }))
            .filter((item) => item.count > 0);
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

    const handleSelectRecipe = (recipe: Recipe) => {
        recordRecipeView(recipe.id, recipe.title);
        setSelectedRecipe(recipe);
        trackEvent('recipe_viewed', { recipeId: recipe.id, title: recipe.title });
        window.history.replaceState(null, '', `#recipe/${encodeURIComponent(recipe.id)}`);
    };

    const handleRecipeClose = () => {
        setSelectedRecipe(null);
        if (window.location.hash.match(RECIPE_HASH_REGEX)) {
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
        const next = toggleFavorite(id);
        setFavoriteIds(next);
        hapticLight();
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
        const quickFamily = contributorsForDisplay.slice(0, 6);
        const submitLogin = (name: string) => {
            const trimmed = name.trim();
            if (!trimmed) return;
            const existing = contributors.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
            const isSuper = isSuperAdmin(trimmed);
            const email = isSuper && trimmed.includes('@') ? trimmed : existing?.email;
            const u: UserProfile = {
                id: existing?.id || 'u' + Date.now(),
                name: existing?.name || trimmed,
                picture: existing?.avatar ?? contributorAvatarUrlForName(trimmed),
                role: isSuper ? 'admin' : ((existing?.role as any) || (trimmed.toLowerCase() === 'admin' ? 'admin' : 'user')),
                email,
            };
            localStorage.setItem('schafer_user', JSON.stringify(u));
            setCurrentUser(u);
            if (!localStorage.getItem(STORAGE_KEYS.onboardingDone)) {
                setShowOnboarding(true);
            }
        };
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] dark:bg-stone-950 p-4 sm:p-6">
                <a href="#main-content-login" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-[#2D4635] focus:rounded-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-[#2D4635]">
                    Skip to main content
                </a>
                <div
                    id="main-content-login"
                    className="bg-white dark:bg-stone-900 rounded-3xl md:rounded-[2rem] p-6 sm:p-8 md:p-10 w-full max-w-md shadow-2xl border border-stone-100 dark:border-stone-800 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
                    tabIndex={-1}
                >
                    <div className="text-center space-y-2 mb-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#A0522D]">The Schafer Cookbook</p>
                        <h1 className="text-2xl md:text-3xl font-serif italic text-[#2D4635] dark:text-emerald-100">Who's cooking?</h1>
                    </div>

                    {quickFamily.length > 0 && (
                        <div className="mb-6">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 text-center">Tap your name</p>
                            <div className="grid grid-cols-3 gap-3">
                                {quickFamily.map((c) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => submitLogin(c.name)}
                                        className="group flex flex-col items-center gap-2 rounded-2xl p-2 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors min-h-16 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635]"
                                        aria-label={`Sign in as ${c.name}`}
                                    >
                                        <img
                                            src={c.avatar || contributorAvatarUrlForName(c.name)}
                                            alt=""
                                            onError={avatarOnError}
                                            className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-stone-700 shadow-md group-hover:scale-105 transition-transform"
                                        />
                                        <span className="text-xs font-medium text-stone-600 dark:text-stone-300 truncate max-w-full">{c.name.split(' ')[0]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="relative my-4 flex items-center" aria-hidden>
                        <span className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
                        <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">Or type a name</span>
                        <span className="flex-1 h-px bg-stone-200 dark:bg-stone-700" />
                    </div>

                    <form onSubmit={handleLoginSubmit} className="space-y-3">
                        <label htmlFor="login-name" className="sr-only">Your name</label>
                        <div className="relative">
                            <input
                                id="login-name"
                                type="text"
                                placeholder="Your name"
                                autoComplete="name"
                                disabled={isLoggingIn}
                                aria-busy={isLoggingIn}
                                className="w-full pl-14 pr-4 py-4 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-full text-base outline-none focus:ring-2 focus:ring-[#2D4635]/30 focus:bg-white dark:focus:bg-stone-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                value={loginName}
                                onChange={e => setLoginName(e.target.value)}
                            />
                            <img
                                src={loginPreviewAvatar}
                                alt=""
                                onError={avatarOnError}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full object-cover border border-stone-200 dark:border-stone-700"
                                aria-hidden
                            />
                        </div>
                        {loginName.trim() && matchedContributor && (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 text-center font-serif italic">
                                Welcome back, {matchedContributor.name.split(' ')[0]}.
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={isLoggingIn || !loginName.trim()}
                            aria-busy={isLoggingIn}
                            className="w-full min-h-12 py-3.5 bg-[#2D4635] text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-[#2D4635]/95 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoggingIn ? 'Opening…' : 'Continue'}
                        </button>
                        <p className="text-stone-400 text-[11px] text-center pt-2">
                            <a href="mailto:?subject=Schafer%20Family%20Cookbook%20Access%20Request" className="underline hover:text-[#2D4635] focus:outline-none focus:ring-1 focus:ring-[#2D4635] rounded">Need access? Email an admin.</a>
                        </p>
                    </form>
                </div>
            </div>
        );
    }

    // Gallery View
    if (tab === 'Gallery') {
        return (
            <div className="min-h-screen bg-[#FDFBF7] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
                <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-[#2D4635] focus:rounded-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-[#2D4635]">
                    Skip to main content
                </a>
                <OfflineBanner />
                <Header activeTab={tab} setTab={handleSetTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />
                <FamilyHub activeTab={tab} onSelect={handleSetTab} galleryCount={gallery.length} triviaCount={trivia.length} contributorCount={contributorsForDisplay.length} />
                <main id="main-content" className="max-w-7xl mx-auto py-6 md:py-10 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] md:pl-[max(1.5rem,env(safe-area-inset-left,0px))] md:pr-[max(1.5rem,env(safe-area-inset-right,0px))]" role="main" aria-label="Family Gallery" tabIndex={-1}>
                    <section className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 gap-6">
                        <div>
                            <h2 className="text-4xl font-serif italic text-[#2D4635]">Family Gallery</h2>
                            <p className="text-stone-500 font-serif italic mt-2">Captured moments across the generations.</p>
                            {pendingUploadCount > 0 && (
                                <p className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold" role="status" aria-live="polite">
                                    <span aria-hidden="true">📤</span>
                                    {pendingUploadCount} photo{pendingUploadCount !== 1 ? 's' : ''} queued for upload when online
                                </p>
                            )}
                        </div>
                        {archivePhone ? (
                            <div className="bg-emerald-50 rounded-[2rem] p-6 border border-emerald-100 flex items-center gap-6 animate-in slide-in-from-right-8 duration-700" role="region" aria-label="Text-to-archive instructions">
                                <span className="text-3xl" aria-hidden="true">📱</span>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 leading-none mb-1">Text your memories</h4>
                                    <p className="text-sm text-emerald-700 font-serif italic">
                                        Photo/Video to:{' '}
                                        <a
                                            href={`sms:${archivePhone.replace(/\s/g, '')}`}
                                            className="font-bold not-italic underline decoration-emerald-600/50 hover:decoration-emerald-700 underline-offset-2 hover:text-emerald-800 transition-colors"
                                            aria-label={`Text photos or videos to ${archivePhone}`}
                                        >
                                            {archivePhone}
                                        </a>
                                    </p>
                                    <p className="text-[10px] text-emerald-600/80 mt-1">Tap the number to open your messaging app</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-stone-50 dark:bg-[var(--bg-tertiary)] rounded-[2rem] p-6 border border-stone-100 dark:border-stone-800 flex items-center gap-6 max-w-md" role="region" aria-label="How to add photos">
                                <span className="text-2xl" aria-hidden="true">📷</span>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500 leading-none mb-1">Want to add photos?</h4>
                                    <p className="text-sm text-stone-500 font-serif italic">Admins can enable text-to-archive in Profile → Admin Tools → Gallery. Or ask an administrator to add your memories.</p>
                                </div>
                            </div>
                        )}
                    </section>

                    {isDataLoading ? (
                        <GallerySkeleton />
                    ) : gallery.length === 0 ? (
                        <div className="py-24 text-center space-y-8 animate-in fade-in duration-500" role="status">
                            <div className="w-32 h-32 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-5xl border-2 border-dashed border-stone-200">🖼️</div>
                            <div className="space-y-3">
                                <h3 className="text-2xl font-serif italic text-[#2D4635]">The gallery awaits your memories</h3>
                                <p className="text-stone-500 font-serif italic max-w-md mx-auto">Be the first to add a photo or video. Text to the archive number once admins enable it, or ask a family custodian to add your moments.</p>
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
                            <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8" role="list">
                                {gallery.map(item => (
                                    <article key={item.id} className="break-inside-avoid bg-white dark:bg-[var(--card-bg)] p-4 rounded-[2rem] border border-stone-100 dark:border-stone-800 shadow-md group hover:shadow-2xl transition-all focus-within:shadow-2xl" role="listitem">
                                        {item.type === 'video' ? (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedGalleryItem(item)}
                                                className="w-full text-left rounded-2xl overflow-hidden mb-4 bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 focus-visible:ring-offset-white relative"
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
                                        ) : (
                                            <GalleryImage
                                                url={item.url}
                                                caption={item.caption}
                                                onClick={() => setSelectedGalleryItem(item)}
                                            />
                                        )}
                                        <p className="font-serif italic text-stone-800 dark:text-stone-200 text-lg px-2 line-clamp-3">{item.caption}</p>
                                        {item.created_at && (
                                            <time
                                                dateTime={item.created_at}
                                                className="block px-2 mt-1 text-[10px] uppercase tracking-widest text-stone-400"
                                            >
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </time>
                                        )}
                                        <div className="flex justify-between items-center mt-4 px-2">
                                            <div className="flex items-center gap-2">
                                                <img src={getAvatar(item.contributor)} className="w-4 h-4 rounded-full object-cover" alt={item.contributor} onError={avatarOnError} />
                                                <span className="text-[9px] uppercase tracking-widest text-[#A0522D]">Added by {item.contributor}</span>
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
                            onStartCook={() => { setCookModeRecipe(selectedRecipe); trackEvent('cook_mode_started', { recipeId: selectedRecipe.id }); }}
                            breadcrumbContext="Family"
                            currentUserName={currentUser?.name}
                        />
                    </Suspense>
                )}
                {cookModeRecipe && (
                    <Suspense fallback={<div className="fixed inset-0 z-[150] bg-[#2D4635] flex items-center justify-center" aria-label="Loading cook mode"><span className="animate-pulse text-white">Loading…</span></div>}>
                        <CookModeView
                            recipe={cookModeRecipe}
                            onClose={() => setCookModeRecipe(null)}
                        />
                    </Suspense>
                )}
                <BottomNav activeTab={tab} setTab={handleSetTab} currentUser={currentUser} />
                <Suspense fallback={null}><InstallPrompt /></Suspense>
            </div>
        );
    }

    // Trivia View
    if (tab === 'Trivia') {
        return (
            <div className="min-h-screen bg-[#FDFBF7] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
                <a href="#main-content-trivia" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-[#2D4635] focus:rounded-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-[#2D4635]">
                    Skip to main content
                </a>
                <OfflineBanner />
                <Header activeTab={tab} setTab={handleSetTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />
                <FamilyHub activeTab={tab} onSelect={handleSetTab} galleryCount={gallery.length} triviaCount={trivia.length} contributorCount={contributorsForDisplay.length} />
                <div id="main-content-trivia" tabIndex={-1} role="main" aria-label="Family trivia">
                <Suspense fallback={<TabFallback />}>
                    <TriviaView
                        trivia={trivia}
                        currentUser={currentUser as any}
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
                            onStartCook={() => { setCookModeRecipe(selectedRecipe); trackEvent('cook_mode_started', { recipeId: selectedRecipe.id }); }}
                            breadcrumbContext="Family"
                            currentUserName={currentUser?.name}
                        />
                    </Suspense>
                )}
                {cookModeRecipe && (
                    <Suspense fallback={<div className="fixed inset-0 z-[150] bg-[#2D4635] flex items-center justify-center" aria-label="Loading cook mode"><span className="animate-pulse text-white">Loading…</span></div>}>
                        <CookModeView
                            recipe={cookModeRecipe}
                            onClose={() => setCookModeRecipe(null)}
                        />
                    </Suspense>
                )}
                <BottomNav activeTab={tab} setTab={handleSetTab} currentUser={currentUser} />
                <Suspense fallback={null}><InstallPrompt /></Suspense>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-stone-800 selection:bg-[#A0522D] selection:text-white pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-white focus:text-[#2D4635] focus:rounded-lg focus:font-bold focus:outline-none focus:ring-2 focus:ring-[#2D4635]">
                Skip to main content
            </a>
            <OfflineBanner />
            <Header activeTab={tab} setTab={handleSetTab} currentUser={currentUser} dbStats={dbStats} onLogout={handleLogout} />

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
                        onStartCook={() => { setCookModeRecipe(selectedRecipe); trackEvent('cook_mode_started', { recipeId: selectedRecipe.id }); }}
                        breadcrumbContext={{ Recipes: 'Recipes', Index: 'A–Z', Gallery: 'Gallery', Trivia: 'Trivia', 'Family Story': 'Family Story', Contributors: 'Contributors', Profile: 'Profile', Privacy: 'Privacy', 'Grocery List': 'Grocery List', Collections: 'Collections' }[tab] ?? 'Recipes'}
                        currentUserName={currentUser?.name}
                    />
                </Suspense>
            )}

            {cookModeRecipe && (
                <Suspense fallback={<div className="fixed inset-0 z-[150] bg-[#2D4635] flex items-center justify-center" aria-label="Loading cook mode"><span className="animate-pulse text-white">Loading…</span></div>}>
                    <CookModeView
                        recipe={cookModeRecipe}
                        onClose={() => setCookModeRecipe(null)}
                    />
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
                        onSetTab={(t) => { handleSetTab(t); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        onSelectCategory={(c) => { setCategory(c); }}
                        isFavorite={(id) => favoriteIds.has(id)}
                        onToggleFavorite={handleToggleFavorite}
                    />
                </Suspense>
            )}

            {tab === 'Recipes' && (
                <main className="max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] md:pl-[max(1.5rem,env(safe-area-inset-left,0px))] md:pr-[max(1.5rem,env(safe-area-inset-right,0px))] py-5 md:py-10 space-y-6 md:space-y-10">
                    {/* Editorial masthead — compact on mobile, full editorial on desktop */}
                    <section className="relative rounded-2xl md:rounded-[2.5rem] overflow-hidden bg-[#2D4635] text-white shadow-md md:shadow-xl">
                        {(() => {
                            const featured = sortedRecipes.find(r => r.image && isValidImageUrl(r.image));
                            return featured ? (
                                <div className="hidden md:block absolute inset-0 opacity-90">
                                    <HeroRecipeImage recipe={featured} />
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#1a2a20]/95 via-[#1a2a20]/75 to-[#1a2a20]/30" />
                                </div>
                            ) : null;
                        })()}
                        <div className="relative z-10 p-5 sm:p-6 md:p-14 lg:p-16">
                            <div className="max-w-2xl space-y-2 md:space-y-5">
                                <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-100/80">
                                    <span className="inline-block h-px w-8 bg-emerald-100/40" aria-hidden />
                                    The Schafer Cookbook
                                </p>
                                <h1 className="text-2xl sm:text-3xl md:text-6xl font-serif italic leading-[1.05] md:leading-[0.95]">
                                    A family table, written down.
                                </h1>
                                <p className="text-emerald-50/80 text-sm md:text-base font-serif italic max-w-md">
                                    {dbStats.recipeCount} recipes from the people who taught us how to cook.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => { handleSetTab('Home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                    className="md:hidden mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-100/80 underline-offset-2 hover:underline"
                                >
                                    ← Back to home
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Compact guided browse strip */}
                    <section aria-label="Quick browse" className="-mx-1 px-1">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                            <button
                                type="button"
                                onClick={resetBrowse}
                                className="min-h-10 shrink-0 rounded-full bg-[#2D4635] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-sm active:scale-[0.98]"
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    resetBrowse();
                                    setSortBy('recent');
                                    setTimeout(() => document.getElementById('quick-access-recipes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
                                }}
                                className="min-h-10 shrink-0 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                            >
                                Recent {recentlyViewedRecipes.length ? `· ${recentlyViewedRecipes.length}` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    resetBrowse();
                                    if (favoriteRecipes.length > 0) {
                                        setTimeout(() => document.getElementById('quick-access-recipes')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
                                    } else {
                                        toast('Tap the heart on recipes you want to cook again.', 'info');
                                    }
                                }}
                                className="min-h-10 shrink-0 rounded-full border border-red-100 bg-red-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                            >
                                Favorites {favoriteRecipes.length ? `· ${favoriteRecipes.length}` : ''}
                            </button>
                            <span className="mx-1 h-6 w-px bg-stone-200 dark:bg-stone-700 shrink-0" aria-hidden />
                            {quickCategoryCounts.map(({ name, count }) => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => { resetBrowse(); setCategory(name); }}
                                    className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                                        category === name
                                            ? 'bg-[#2D4635] text-white border-[#2D4635]'
                                            : 'border-stone-200 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300'
                                    }`}
                                >
                                    {name} · {count}
                                </button>
                            ))}
                        </div>
                        {currentUser?.role === 'admin' && localGeneratedImageCount > 0 && (
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                {localGeneratedImageCount} of {recipes.length} cards use the cookbook fallback. <code className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 normal-case font-mono text-[10px]">npm run images:batch</code> upgrades them with Imagen.
                            </p>
                        )}
                    </section>

                    <div className="sticky top-14 md:top-20 z-30 -mx-1 space-y-3 bg-[#FDFBF7]/85 dark:bg-stone-950/80 backdrop-blur-md py-2 px-1 rounded-2xl">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="relative flex-1">
                                <label htmlFor="recipe-search" className="sr-only">Search recipes, ingredients, or instructions</label>
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-sm" aria-hidden="true">🔍</span>
                                <input
                                    id="recipe-search"
                                    type="text"
                                    inputMode="search"
                                    placeholder="Search recipes, ingredients, contributors…"
                                    aria-label="Search recipes, ingredients, or instructions"
                                    className="w-full pl-11 pr-10 py-3 md:py-3.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-full shadow-sm outline-none focus:ring-2 focus:ring-[#2D4635]/30 transition-all text-base dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        aria-label="Clear search"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 text-xs"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            <div className="flex md:hidden gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowMobileFilters(v => !v)}
                                    className={`min-h-11 min-w-11 px-3 py-3 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-colors ${
                                        showMobileFilters || activeFilterCount > 0
                                            ? 'bg-[#2D4635] text-white border-[#2D4635]'
                                            : 'bg-white text-stone-600 border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700'
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
                                        className="min-h-11 min-w-11 px-4 bg-[#A0522D] text-white rounded-full text-base font-bold shadow hover:bg-[#A0522D]/90 transition-colors"
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                            <div className="hidden md:flex gap-2">
                                <label htmlFor="recipe-category" className="sr-only">Filter by category</label>
                                <select id="recipe-category" aria-label="Filter by category" className="px-4 py-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-full text-sm font-medium text-stone-700 dark:text-stone-200 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800 min-h-11" value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="All">All categories</option>
                                    {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <label htmlFor="recipe-contributor" className="sr-only">Filter by contributor</label>
                                <select id="recipe-contributor" aria-label="Filter by contributor" className="px-4 py-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-full text-sm font-medium text-stone-700 dark:text-stone-200 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800 min-h-11" value={contributor} onChange={e => setContributor(e.target.value)}>
                                    <option value="All">All contributors</option>
                                    {Array.from(new Set(recipes.map(r => r.contributor))).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {allTags.length > 0 && (
                                    <>
                                        <label htmlFor="recipe-tag" className="sr-only">Filter by tag</label>
                                        <select id="recipe-tag" aria-label="Filter by tag" className="px-4 py-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-full text-sm font-medium text-stone-700 dark:text-stone-200 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800 min-h-11" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
                                            <option value="">All tags</option>
                                            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </>
                                )}
                                <label htmlFor="recipe-sort" className="sr-only">Sort recipes</label>
                                <select id="recipe-sort" aria-label="Sort recipes" className="px-4 py-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-full text-sm font-medium text-stone-700 dark:text-stone-200 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800 min-h-11" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
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
                                        className="px-5 py-3 bg-[#A0522D] text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-sm hover:bg-[#A0522D]/90 transition-colors min-h-11 whitespace-nowrap"
                                    >
                                        + New recipe
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="hidden md:flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 px-2">
                            <span>{sortedRecipes.length} {sortedRecipes.length === 1 ? 'recipe' : 'recipes'}{activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'}` : ''}</span>
                            {activeFilterCount > 0 && (
                                <button type="button" onClick={clearRecipeFilters} className="text-[#A0522D] hover:underline">Reset filters</button>
                            )}
                        </div>

                        <div
                            id="mobile-recipe-filters"
                            className={`${showMobileFilters ? 'block' : 'hidden'} md:hidden bg-white/90 dark:bg-[var(--bg-secondary)]/90 backdrop-blur-md border border-stone-200 dark:border-stone-700 rounded-[2rem] p-4 shadow-sm space-y-3`}
                        >
                            <div className="grid grid-cols-1 gap-3">
                                <select aria-label="Filter by category" className="px-5 py-4 bg-stone-50 dark:bg-[var(--input-bg)] border border-stone-200 dark:border-stone-700 rounded-2xl text-base font-bold text-stone-600 dark:text-stone-200 outline-none" value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="All">All Categories</option>
                                    {['Breakfast', 'Main', 'Dessert', 'Side', 'Appetizer', 'Bread', 'Dip/Sauce', 'Snack'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select aria-label="Filter by contributor" className="px-5 py-4 bg-stone-50 dark:bg-[var(--input-bg)] border border-stone-200 dark:border-stone-700 rounded-2xl text-base font-bold text-stone-600 dark:text-stone-200 outline-none" value={contributor} onChange={e => setContributor(e.target.value)}>
                                    <option value="All">All Contributors</option>
                                    {Array.from(new Set(recipes.map(r => r.contributor))).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {allTags.length > 0 && (
                                    <select aria-label="Filter by tag" className="px-5 py-4 bg-stone-50 dark:bg-[var(--input-bg)] border border-stone-200 dark:border-stone-700 rounded-2xl text-base font-bold text-stone-600 dark:text-stone-200 outline-none" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
                                        <option value="">All Tags</option>
                                        {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                )}
                                <select aria-label="Sort recipes" className="px-5 py-4 bg-stone-50 dark:bg-[var(--input-bg)] border border-stone-200 dark:border-stone-700 rounded-2xl text-base font-bold text-stone-600 dark:text-stone-200 outline-none" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
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
                            <div id="quick-access-recipes" className="scroll-mt-40 space-y-6">
                                {favRecipes.length > 0 && (
                                    <section aria-label="Favorite recipes">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-3">❤️ Favorites</h3>
                                        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                                            {favRecipes.map((r) => (
                                                <button
                                                    key={r.id}
                                                    type="button"
                                                    onClick={() => handleSelectRecipe(r)}
                                                    className="flex-shrink-0 w-32 md:w-40 group text-left"
                                                    aria-label={`View recipe: ${r.title}`}
                                                >
                                                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-stone-200 shadow-md group-hover:shadow-xl transition-all">
                                                        <RecipeCardImage recipe={r} />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                                                    </div>
                                                    <p className="mt-2 text-sm font-serif italic text-stone-700 dark:text-stone-300 truncate group-hover:text-[#2D4635] dark:group-hover:text-emerald-300">{r.title}</p>
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
                                                    onClick={() => handleSelectRecipe(r)}
                                                    className="flex-shrink-0 w-32 md:w-40 group text-left"
                                                    aria-label={`View recipe: ${r.title}`}
                                                >
                                                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-stone-200 shadow-md group-hover:shadow-xl transition-all">
                                                        <RecipeCardImage recipe={r} />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                                                    </div>
                                                    <p className="mt-2 text-sm font-serif italic text-stone-700 dark:text-stone-300 truncate group-hover:text-[#2D4635] dark:group-hover:text-emerald-300">{r.title}</p>
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
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
                            {sortedRecipes.map(recipe => {
                                const isFav = favoriteIds.has(recipe.id);
                                const rating = getAverageRating(recipe.id);
                                const ratingCount = getRatingCount(recipe.id);
                                const approved = isFamilyApproved(recipe.id);
                                const contribAvatar = getAvatar(recipe.contributor);
                                return (
                                    <article
                                        key={recipe.id}
                                        className="group relative flex flex-col rounded-2xl md:rounded-[1.5rem] overflow-hidden bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-[#2D4635] focus-within:ring-offset-2 focus-within:ring-offset-[#FDFBF7] dark:focus-within:ring-offset-stone-950"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleSelectRecipe(recipe)}
                                            aria-label={`Open recipe: ${recipe.title}`}
                                            className="flex flex-col text-left w-full h-full"
                                        >
                                            <div className="relative aspect-[4/5] overflow-hidden bg-stone-100 dark:bg-stone-800">
                                                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]">
                                                    <RecipeCardImage recipe={recipe} />
                                                </div>
                                                {recipe.cookTime && (
                                                    <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white">
                                                        <span aria-hidden>⏱</span>
                                                        <span>{recipe.cookTime}</span>
                                                    </span>
                                                )}
                                                {approved && (
                                                    <span className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-amber-50/95 backdrop-blur px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 shadow-sm">
                                                        ★ Approved
                                                    </span>
                                                )}
                                            </div>
                                            <span aria-hidden className="block h-0.5 bg-[#A0522D]/85" />
                                            <div className="flex-1 p-3 sm:p-4 space-y-2">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A0522D]/85">{recipe.category}</p>
                                                <h3 className="text-base sm:text-lg md:text-xl font-serif italic leading-snug text-[#2D4635] dark:text-emerald-100 line-clamp-2">
                                                    {recipe.title}
                                                </h3>
                                                <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-stone-500 dark:text-stone-400">
                                                    <span className="flex items-center gap-1.5 min-w-0">
                                                        <img
                                                            src={contribAvatar}
                                                            alt=""
                                                            aria-hidden
                                                            onError={avatarOnError}
                                                            className="w-5 h-5 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                                                        />
                                                        <span className="truncate font-serif italic">{recipe.contributor}</span>
                                                    </span>
                                                    {rating > 0 && (
                                                        <span className="flex items-center gap-0.5 text-amber-600 font-semibold shrink-0" aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${ratingCount} ratings`}>
                                                            ★ {rating.toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                                {ratingCount >= 3 && (
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                                        🍴 Cooked by {ratingCount} family
                                                    </p>
                                                )}
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(recipe.id); }}
                                            className={`absolute top-2 left-2 z-20 flex h-11 w-11 min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-full backdrop-blur transition-transform hover:scale-110 active:scale-95 ${
                                                isFav ? 'bg-white/95 text-red-500 shadow-md' : 'bg-black/30 text-white hover:bg-white/95 hover:text-red-500'
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
                            <div className="space-y-2">
                                <p className="font-serif italic text-stone-600 text-xl">
                                    {recipes.length === 0
                                        ? 'The recipe archive is ready for its first card.'
                                        : 'No recipes match that path yet.'}
                                </p>
                                <p className="text-stone-500 text-sm max-w-md mx-auto">
                                    {recipes.length === 0
                                        ? (currentUser?.role === 'admin' ? 'Add the first family recipe, then the archive will generate the browsing experience around it.' : 'Ask an administrator to add the first family recipe.')
                                        : 'Try clearing filters, browsing by category, or searching a family member, ingredient, or dish name.'}
                                </p>
                                {recipes.length > 0 ? (
                                    <div className="flex flex-wrap justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={clearRecipeFilters}
                                            className="inline-flex min-h-11 items-center gap-2 px-6 py-3 bg-[#2D4635] text-white text-sm font-bold uppercase tracking-widest rounded-full hover:bg-[#2D4635]/90 transition-colors"
                                        >
                                            Clear filters
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { clearRecipeFilters(); setCategory('Main'); }}
                                            className="inline-flex min-h-11 items-center gap-2 px-6 py-3 bg-white border border-stone-200 text-stone-600 text-sm font-bold uppercase tracking-widest rounded-full hover:bg-stone-50 transition-colors"
                                        >
                                            Browse mains
                                        </button>
                                    </div>
                                ) : currentUser?.role === 'admin' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAddRecipeModal(true)}
                                        className="inline-flex min-h-11 items-center gap-2 px-6 py-3 bg-[#2D4635] text-white text-sm font-bold uppercase tracking-widest rounded-full hover:bg-[#2D4635]/90 transition-colors"
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

            {(tab === 'Family Story' || tab === 'Contributors') && (
                <FamilyHub activeTab={tab} onSelect={handleSetTab} galleryCount={gallery.length} triviaCount={trivia.length} contributorCount={contributorsForDisplay.length} />
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
                        <ContributorsView recipes={recipes} gallery={gallery} trivia={trivia} contributors={contributorsForDisplay} onSelectContributor={(c) => { setContributor(c); setTab('Recipes'); window.scrollTo(0, 0); }} onGoToRecipes={() => { handleSetTab('Recipes'); window.scrollTo(0, 0); }} />
                    )}
                </Suspense>
            )}

            {tab === 'Privacy' && (
                <Suspense fallback={<TabFallback />}>
                    <PrivacyView />
                </Suspense>
            )}

            {tab === 'Grocery List' && (
                <Suspense fallback={<TabFallback />}>
                    <main id="main-content-grocery" role="main" aria-label="Grocery list" tabIndex={-1}>
                        <GroceryListView
                            onBrowseRecipes={() => { handleSetTab('Recipes'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            onOpenCollections={() => { handleSetTab('Collections'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        />
                    </main>
                </Suspense>
            )}

            {tab === 'Collections' && currentUser && (
                <Suspense fallback={<TabFallback />}>
                    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12" role="main" aria-label="Recipe collections" tabIndex={-1}>
                        <h2 className="text-3xl md:text-4xl font-serif italic text-[#2D4635] mb-8">Collections</h2>
                        <CollectionsView
                            recipes={recipes}
                            currentUserName={currentUser.name}
                            onViewRecipe={(recipe) => handleSelectRecipe(recipe)}
                        />
                    </main>
                </Suspense>
            )}

            {tab === 'Profile' && currentUser && (
                <Suspense fallback={<ProfileSkeleton />}>
                    <ProfileView
                        currentUser={currentUser}
                        userRecipes={recipes.filter(r => r.contributor === currentUser.name && !defaultRecipeIds.has(r.id))}
                        userHistory={history.filter(h => h.contributor === currentUser.name)}
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
                            onAddGallery: async (g, f) => {
                                // If offline and there's a file, queue it for later upload.
                                if (!navigator.onLine && f) {
                                    await queueUpload(f, g.caption, g.contributor);
                                    await refreshPendingCount();
                                    toast("You're offline. Photo saved to upload queue.", 'info');
                                    return;
                                }
                                try {
                                    const url = f ? await CloudArchive.uploadFile(f, 'gallery') : '';
                                    await CloudArchive.upsertGalleryItem({ ...g, url: url || '' });
                                    await refreshLocalState();
                                } catch {
                                    toast(CLOUD_ERROR_MSG, 'error');
                                }
                            },
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

            <BottomNav activeTab={tab} setTab={handleSetTab} currentUser={currentUser} />
            <Suspense fallback={null}><InstallPrompt /></Suspense>
            </div>
        </div>
    );
};

export default App;
