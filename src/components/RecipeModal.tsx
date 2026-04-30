import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Recipe } from '../types';
import { buildRecipeSchema } from '../utils/recipeSchema';
import { siteConfig } from '../config/site';
import { useUI } from '../context/UIContext';
import { shouldToastImageError } from '../utils/imageErrorToast';
import { useFocusTrap } from '../utils/focusTrap';
import { scaleIngredients } from '../utils/scaleIngredients';
import { hapticLight } from '../utils/haptics';
import { contributorAvatarUrlForName } from '../utils/contributorAvatar';
import { avatarOnError } from '../utils/avatarFallback';
import { StarRating } from './StarRating';
import { RecipeNotes } from './RecipeNotes';
import { ShareRecipe } from './ShareRecipe';
import { getAverageRating, getRatingCount, getUserRating, setRating, isFamilyApproved } from '../utils/ratings';
import { getAllCollections, addToCollection } from '../utils/collections';
import { addActivity } from '../utils/activityFeed';
import { addItems as addGroceryItems, getItems as getGroceryItems } from '../utils/groceryList';
import { trackEvent } from '../services/analytics';

const CATEGORY_ICONS: Record<string, string> = {
    Breakfast: '🥞',
    Main: '🍖',
    Dessert: '🍰',
    Side: '🥗',
    Appetizer: '🧀',
    Bread: '🍞',
    'Dip/Sauce': '🫕',
    Snack: '🍿',
    Generic: '🍽️'
};

interface RecipeModalProps {
    recipe: Recipe;
    onClose: () => void;
    /** Ordered list for prev/next navigation; when provided, prev/next buttons are shown */
    recipeList?: Recipe[];
    onNavigate?: (recipe: Recipe) => void;
    isFavorite?: (id: string) => boolean;
    onToggleFavorite?: (id: string) => void;
    onStartCook?: () => void;
    /** Optional breadcrumb context (e.g. "Recipes", "A–Z") when opened from deep link or other section */
    breadcrumbContext?: string;
    /** Current user name for ratings/notes */
    currentUserName?: string;
}

const RatingSection: React.FC<{
    recipeId: string;
    recipeTitle: string;
    currentUserName: string;
    onChange?: () => void;
}> = ({ recipeId, recipeTitle, currentUserName, onChange }) => {
    const [avg, setAvg] = useState(() => getAverageRating(recipeId));
    const [count, setCount] = useState(() => getRatingCount(recipeId));
    const [userRating, setUserRating] = useState(() => getUserRating(recipeId, currentUserName));

    const handleRate = (stars: number) => {
        setRating(recipeId, currentUserName, stars);
        setAvg(getAverageRating(recipeId));
        setCount(getRatingCount(recipeId));
        setUserRating(stars);
        addActivity('recipe_rated', currentUserName, `rated "${recipeTitle}" ${stars} stars`);
        onChange?.();
    };

    return (
        <div className="space-y-3 print:hidden">
            <div className="space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Rate This Recipe</h4>
                <StarRating rating={userRating || avg} onRate={currentUserName ? handleRate : undefined} readOnly={!currentUserName} showCount={count} />
            </div>
            {count > 0 && (
                <p className="text-xs text-stone-400">{avg.toFixed(1)} avg from {count} rating{count !== 1 ? 's' : ''}</p>
            )}
        </div>
    );
};

/** Inline collection picker used inside the overflow menu. */
const OverflowCollectionPicker: React.FC<{ recipeId: string; onAdded?: () => void }> = ({ recipeId, onAdded }) => {
    const { toast } = useUI();
    const [collections, setCollections] = useState(() => getAllCollections());
    const [open, setOpen] = useState(false);

    const inCount = collections.filter((c) => c.recipeIds.includes(recipeId)).length;

    const handleToggle = () => {
        const latest = getAllCollections();
        setCollections(latest);
        if (latest.length === 0) {
            toast('Create a collection first in the Collections tab', 'info');
            return;
        }
        setOpen((v) => !v);
    };

    const handleAdd = (colId: string, colName: string) => {
        addToCollection(colId, recipeId);
        setCollections(getAllCollections());
        toast(`Added to "${colName}"`, 'success');
        setOpen(false);
        onAdded?.();
    };

    return (
        <div className="px-1">
            <button
                type="button"
                role="menuitem"
                onClick={handleToggle}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)] transition-colors min-h-11"
            >
                <span aria-hidden className="text-lg w-5 text-center">📚</span>
                <span className="flex-1 text-left">
                    {inCount > 0 ? `In ${inCount} collection${inCount !== 1 ? 's' : ''}` : 'Save to collection'}
                </span>
                <span aria-hidden className="text-stone-400">{open ? '▾' : '▸'}</span>
            </button>
            {open && (
                <div className="mt-1 ml-8 mr-1 mb-1 max-h-48 overflow-y-auto space-y-0.5 border-l border-stone-200 dark:border-[var(--border-color)] pl-2">
                    {collections.map((col) => {
                        const alreadyIn = col.recipeIds.includes(recipeId);
                        return (
                            <button
                                key={col.id}
                                type="button"
                                onClick={() => !alreadyIn && handleAdd(col.id, col.name)}
                                disabled={alreadyIn}
                                className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center gap-2 transition-colors ${
                                    alreadyIn ? 'text-stone-400 cursor-default' : 'hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)] text-stone-700 dark:text-stone-300'
                                }`}
                            >
                                <span>{col.icon}</span>
                                <span className="flex-1 truncate">{col.name}</span>
                                {alreadyIn && <span className="text-[10px] text-emerald-500">Added</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const SCROLL_THRESHOLD = 200;

export const RecipeModal: React.FC<RecipeModalProps> = ({
    recipe,
    onClose,
    recipeList = [],
    onNavigate,
    isFavorite,
    onToggleFavorite,
    onStartCook,
    breadcrumbContext = 'Recipes',
    currentUserName = '',
}) => {
    const { toast } = useUI();
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxImageBroken, setLightboxImageBroken] = useState(false);
    const [showScrollToTop, setShowScrollToTop] = useState(false);
    const [overflowOpen, setOverflowOpen] = useState(false);
    const [ratingsVersion, setRatingsVersion] = useState(0);
    const baseServings = recipe ? (typeof recipe.servings === 'number' ? recipe.servings : 4) : 4;
    const [scaleTo, setScaleTo] = useState(baseServings);
    const scaleFactor = baseServings > 0 ? scaleTo / baseServings : 1;
    const displayedIngredients = useMemo(
        () => (recipe ? scaleIngredients(recipe.ingredients, scaleFactor) : []),
        [recipe, scaleFactor]
    );

    const navIndex = recipe ? recipeList.findIndex((r) => r.id === recipe.id) : -1;
    const prevRecipe = navIndex > 0 ? recipeList[navIndex - 1] : null;
    const nextRecipe = navIndex >= 0 && navIndex < recipeList.length - 1 ? recipeList[navIndex + 1] : null;

    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const lightboxCloseRef = useRef<HTMLButtonElement>(null);
    const lightboxRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const overflowMenuRef = useRef<HTMLDivElement>(null);
    const overflowButtonRef = useRef<HTMLButtonElement>(null);
    const [imageBroken, setImageBroken] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [scaleFlash, setScaleFlash] = useState(false);
    const scaleInitRef = useRef(true);
    const hasValidImage =
        !!recipe?.image &&
        !imageBroken &&
        (recipe.image.startsWith('/recipe-images/') || recipe.image.startsWith('http://') || recipe.image.startsWith('https://'));
    const isAIGenerated =
        recipe?.imageSource === 'nano-banana' ||
        recipe?.imageSource === 'local-generated' ||
        (recipe?.imageSource == null && !!recipe?.image?.includes?.('pollinations.ai'));
    const imageSourceLabel = recipe?.imageSource === 'upload'
        ? 'Family photo'
        : recipe?.imageSource === 'nano-banana'
            ? 'Designed with Imagen'
            : recipe?.imageSource === 'local-generated'
                ? 'Recipe-specific image'
                : isAIGenerated
                    ? 'Generated from recipe'
                    : null;

    useFocusTrap(true, modalRef);
    useFocusTrap(lightboxOpen, lightboxRef);

    useEffect(() => {
        closeButtonRef.current?.focus();
    }, []);

    // Esc: close lightbox first when open, otherwise close modal
    useEffect(() => {
        if (!lightboxOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightboxOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [lightboxOpen]);

    useEffect(() => {
        if (lightboxOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (overflowOpen) {
                    setOverflowOpen(false);
                    return;
                }
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [lightboxOpen, overflowOpen, onClose]);

    // Outside-click for overflow popover
    useEffect(() => {
        if (!overflowOpen) return;
        const handlePointer = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (
                overflowMenuRef.current?.contains(target) ||
                overflowButtonRef.current?.contains(target)
            ) {
                return;
            }
            setOverflowOpen(false);
        };
        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('touchstart', handlePointer);
        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('touchstart', handlePointer);
        };
    }, [overflowOpen]);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const onScroll = () => setShowScrollToTop(el.scrollTop > SCROLL_THRESHOLD);
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    // Sync scale and scroll when recipe changes
    useEffect(() => {
        if (!recipe) return;
        const base = typeof recipe.servings === 'number' ? recipe.servings : 4;
        setScaleTo(base);
        setImageBroken(false);
        setImageLoading(true);
        setLightboxImageBroken(false);
        setOverflowOpen(false);
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }, [recipe?.id, recipe?.servings]);

    useEffect(() => {
        if (lightboxOpen) setLightboxImageBroken(false);
    }, [lightboxOpen]);

    // Flash ingredients when scale changes (skip initial mount)
    useEffect(() => {
        if (scaleInitRef.current) {
            scaleInitRef.current = false;
            return;
        }
        setScaleFlash(true);
        const timer = setTimeout(() => setScaleFlash(false), 300);
        return () => clearTimeout(timer);
    }, [scaleTo]);

    // Reset init ref when recipe changes so first scale sync doesn't flash
    useEffect(() => {
        scaleInitRef.current = true;
    }, [recipe?.id]);

    // Arrow keys: prev/next recipe
    useEffect(() => {
        if (!onNavigate || lightboxOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && prevRecipe) {
                e.preventDefault();
                onNavigate(prevRecipe);
            } else if (e.key === 'ArrowRight' && nextRecipe) {
                e.preventDefault();
                onNavigate(nextRecipe);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [lightboxOpen, onNavigate, prevRecipe, nextRecipe]);

    // Header social-proof + byline meta — recomputed when ratings change inline.
    // ratingsVersion is intentionally a dependency so the header refreshes after
    // the user rates within the modal; values themselves come from localStorage.
    const headerAvg = useMemo(
        () => (recipe ? getAverageRating(recipe.id) : 0),
        [recipe, ratingsVersion]
    );
    const headerCount = useMemo(
        () => (recipe ? getRatingCount(recipe.id) : 0),
        [recipe, ratingsVersion]
    );
    const headerApproved = useMemo(
        () => (recipe ? isFamilyApproved(recipe.id) : false),
        [recipe, ratingsVersion]
    );

    if (!recipe) return null;

    const shareUrl = `${siteConfig.baseUrl}/#recipe/${recipe.id}`;
    const hasWebShare = typeof navigator !== 'undefined' && navigator.share;

    const buildEmailBody = () => {
        const lines: string[] = [
            recipe.title,
            `From ${siteConfig.siteName}`,
            `By ${recipe.contributor}`,
            '',
            recipe.category,
            ...(recipe.prepTime || recipe.cookTime || recipe.servings
                ? [
                      [recipe.prepTime && `Prep: ${recipe.prepTime}`, recipe.cookTime && `Cook: ${recipe.cookTime}`, recipe.servings != null && `Servings: ${recipe.servings}`]
                          .filter(Boolean)
                          .join(' | '),
                      '',
                  ]
                : []),
            'INGREDIENTS',
            ...recipe.ingredients.map((i) => `• ${i}`),
            '',
            'INSTRUCTIONS',
            ...recipe.instructions.map((s, i) => `${i + 1}. ${s}`),
        ];
        if (recipe.notes) lines.push('', 'NOTES', recipe.notes);
        lines.push('', `View online: ${shareUrl}`);
        return lines.join('\n');
    };

    const emailRecipeUrl = `mailto:?subject=${encodeURIComponent(`${recipe.title} from ${siteConfig.siteName}`)}&body=${encodeURIComponent(buildEmailBody())}`;

    const shareTitle = `Open in ${siteConfig.siteName}: ${recipe.title}`;
    const shareAriaLabel = `Share recipe: ${shareTitle}`;
    const handleShare = async () => {
        const doCopy = async () => {
            try {
                await navigator.clipboard.writeText(shareUrl);
                toast(`Link copied! ${shareTitle}`, 'success');
                trackEvent('recipe_shared', { recipeId: recipe.id });
            } catch {
                toast("Couldn't copy link. Check clipboard permissions and try again.", 'error');
            }
        };
        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: `${recipe.title} — ${siteConfig.siteName}`,
                    url: shareUrl,
                });
                toast('Recipe shared', 'success');
                trackEvent('recipe_shared', { recipeId: recipe.id });
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    await doCopy();
                }
            }
        } else {
            await doCopy();
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleAddToGroceryList = () => {
        const rows = displayedIngredients
            .map((text) => ({
                text,
                recipeId: recipe.id,
                recipeTitle: recipe.title,
            }))
            .filter((r) => r.text.trim().length > 0);
        if (rows.length === 0) {
            toast('No ingredients to add', 'info');
            return;
        }
        const prevCount = getGroceryItems().length;
        const next = addGroceryItems(rows);
        const added = Math.max(0, next.length - prevCount);
        hapticLight();
        if (added === 0) {
            toast('All ingredients are already on your Grocery List', 'info');
        } else {
            toast(`Added ${added} item${added === 1 ? '' : 's'} to Grocery List`, 'success');
        }
    };

    // Build the byline meta line (rating · prep · cook · servings · calories)
    const metaParts: React.ReactNode[] = [];
    if (headerAvg > 0) {
        metaParts.push(
            <span key="rating" aria-label={`${headerAvg.toFixed(1)} average rating from ${headerCount} ${headerCount === 1 ? 'rating' : 'ratings'}`}>
                <span className="text-amber-500" aria-hidden>★</span> {headerAvg.toFixed(1)} ({headerCount})
            </span>
        );
    }
    if (recipe.prepTime) metaParts.push(<span key="prep">Prep: {recipe.prepTime}</span>);
    if (recipe.cookTime) metaParts.push(<span key="cook">Cook: {recipe.cookTime}</span>);
    if (recipe.servings !== undefined && recipe.servings !== null) {
        metaParts.push(<span key="serv">Servings: {recipe.servings}</span>);
    }
    if (recipe.calories) metaParts.push(<span key="cal">~{recipe.calories} kcal</span>);

    const overflowItemClass =
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)] transition-colors min-h-11';

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(buildRecipeSchema(recipe)) }}
            />
            {lightboxOpen && (
                <div
                    ref={lightboxRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Enlarged recipe image"
                    className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300 cursor-zoom-out pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
                    onClick={() => setLightboxOpen(false)}
                >
                    <button
                        ref={lightboxCloseRef}
                        onClick={() => { hapticLight(); setLightboxOpen(false); }}
                        className="absolute top-[max(1.5rem,env(safe-area-inset-top))] right-[max(1.5rem,env(safe-area-inset-right))] w-12 h-12 min-w-11 min-h-11 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-2xl transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                        aria-label="Close enlarged image"
                        title="Close"
                    >
                        ✕
                    </button>
                    {lightboxImageBroken ? (
                        <div
                            className="max-w-full max-h-[90vh] w-full max-w-3xl aspect-[4/3] rounded-2xl border border-white/15 bg-white/5 flex flex-col items-center justify-center text-white px-8 shadow-2xl"
                            role="img"
                            aria-label={`Image unavailable for ${recipe.title}`}
                        >
                            <span className="text-5xl mb-4" aria-hidden="true">
                                {CATEGORY_ICONS[recipe.category] || CATEGORY_ICONS.Generic}
                            </span>
                            <p className="font-serif italic text-lg text-center">Preview unavailable</p>
                            <p className="text-white/50 text-xs mt-3 text-center max-w-sm">
                                This photo could not be loaded. Close and try again, or check your connection.
                            </p>
                        </div>
                    ) : (
                        <img
                            src={recipe.image}
                            width={800}
                            height={600}
                            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500"
                            alt={recipe.title}
                            decoding="async"
                            onError={() => setLightboxImageBroken(true)}
                        />
                    )}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs uppercase tracking-widest">
                        Click anywhere to close
                    </div>
                </div>
            )}

            <div ref={modalRef} className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]" role="dialog" aria-modal="true" aria-labelledby="recipe-modal-title" aria-label="Recipe details">
                <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
                <div className="print-recipe-content bg-[#FDFBF7] dark:bg-[var(--bg-secondary)] w-full md:max-w-5xl h-full md:h-auto md:max-h-[90vh] md:rounded-[3rem] overflow-hidden shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 md:zoom-in-95 duration-500 flex flex-col md:flex-row">
                    {/* Mobile-only "back to context" pill (top-left) */}
                    <button
                        onClick={onClose}
                        className="absolute top-2 left-2 z-20 md:hidden px-4 py-2 bg-white/95 dark:bg-[var(--card-bg)]/95 backdrop-blur-sm rounded-full shadow-xl text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300 print:hidden"
                        aria-label={`Back to ${breadcrumbContext}`}
                    >
                        ← {breadcrumbContext}
                    </button>

                    {/* Close button — top-right of the entire modal */}
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="absolute top-2 right-2 md:top-3 md:right-3 z-30 w-11 h-11 min-w-11 min-h-11 bg-white/95 dark:bg-[var(--card-bg)]/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white dark:hover:bg-[var(--card-bg)] transition-all hover:scale-110 motion-reduce:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 print:hidden"
                        aria-label="Close recipe"
                        title="Close"
                    >
                        <span className="text-xl font-light">✕</span>
                    </button>

                    {/* Image panel */}
                    <div
                        className={`w-full md:w-1/2 h-64 md:min-h-[400px] md:aspect-[4/3] relative cursor-zoom-in group ${hasValidImage ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2' : ''}`}
                        onClick={() => hasValidImage && setLightboxOpen(true)}
                        onKeyDown={(e) => {
                            if (hasValidImage && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                setLightboxOpen(true);
                            }
                        }}
                        role={hasValidImage ? 'button' : undefined}
                        tabIndex={hasValidImage ? 0 : undefined}
                        aria-label={hasValidImage ? 'Enlarge recipe image' : undefined}
                    >
                        {hasValidImage ? (
                            <>
                                {imageLoading && (
                                    <div className="absolute inset-0 animate-pulse bg-stone-200" />
                                )}
                                <img
                                    src={recipe.image}
                                    width={800}
                                    height={600}
                                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                                    alt={recipe.title}
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={() => setImageLoading(false)}
                                    onError={() => {
                                        setImageLoading(false);
                                        setImageBroken(true);
                                        if (shouldToastImageError(recipe.id)) {
                                            toast('Some recipe images couldn\'t be loaded', 'info');
                                        }
                                    }}
                                />
                                {imageSourceLabel && (
                                    <span className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full border border-white/20 bg-black/45 text-white text-[9px] font-black uppercase tracking-widest shadow-lg backdrop-blur-md" title={imageSourceLabel}>
                                        {imageSourceLabel}
                                    </span>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-stone-200 to-stone-300" />
                                <div className="absolute inset-0 bg-gradient-to-br from-[#2D4635]/80 via-[#2D4635]/60 to-[#A0522D]/70" />

                                {/* Centered content */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 p-8">
                                    <span className="text-6xl mb-4 drop-shadow-lg">
                                        {CATEGORY_ICONS[recipe.category] || '🍽️'}
                                    </span>
                                    <span className="text-sm font-serif italic opacity-80">{recipe.category}</span>
                                    <div className="mt-6 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                                        <span className="text-[9px] font-black uppercase tracking-widest">📝 Recipe Coming</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent md:hidden pointer-events-none" />

                        {/* Favorite heart toggle — top-right of image, offset on mobile so it doesn't collide with close button */}
                        {onToggleFavorite && isFavorite && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleFavorite(recipe.id); }}
                                className={`absolute z-20 top-2 right-14 md:top-3 md:right-3 w-11 h-11 min-w-11 min-h-11 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 motion-reduce:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 print:hidden ${
                                    isFavorite(recipe.id)
                                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                        : 'bg-white/95 dark:bg-[var(--card-bg)]/95 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white dark:hover:bg-[var(--card-bg)]'
                                }`}
                                aria-label={isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                                title={isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <span className="text-xl">{isFavorite(recipe.id) ? '❤️' : '🤍'}</span>
                            </button>
                        )}

                        {/* Hover hint - only show if image exists */}
                        {hasValidImage && (
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center gap-2 pointer-events-none">
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-stone-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                                    🔍 Enlarge
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Right panel: scroll content + sticky bottom action bar */}
                    <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
                        {/* Desktop prev chevron — left edge of content area */}
                        {prevRecipe && onNavigate && (
                            <button
                                onClick={() => onNavigate(prevRecipe)}
                                className="hidden md:flex absolute top-1/2 left-2 -translate-y-1/2 z-10 w-11 h-11 min-w-11 min-h-11 items-center justify-center bg-white/95 dark:bg-[var(--card-bg)]/95 backdrop-blur-sm rounded-full shadow-lg text-stone-500 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white dark:hover:bg-[var(--card-bg)] transition-all hover:scale-110 motion-reduce:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 print:hidden"
                                aria-label={`Previous: ${prevRecipe.title}`}
                                title="Previous recipe (←)"
                            >
                                <span className="text-xl">‹</span>
                            </button>
                        )}
                        {/* Desktop next chevron — right edge of content area */}
                        {nextRecipe && onNavigate && (
                            <button
                                onClick={() => onNavigate(nextRecipe)}
                                className="hidden md:flex absolute top-1/2 right-2 -translate-y-1/2 z-10 w-11 h-11 min-w-11 min-h-11 items-center justify-center bg-white/95 dark:bg-[var(--card-bg)]/95 backdrop-blur-sm rounded-full shadow-lg text-stone-500 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white dark:hover:bg-[var(--card-bg)] transition-all hover:scale-110 motion-reduce:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 print:hidden"
                                aria-label={`Next: ${nextRecipe.title}`}
                                title="Next recipe (→)"
                            >
                                <span className="text-xl">›</span>
                            </button>
                        )}

                        <div
                            ref={scrollContainerRef}
                            className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 md:p-12 pt-12 md:pt-12 space-y-8 pb-28"
                        >
                            {/* Header Section */}
                            <div className="space-y-3">
                                <nav aria-label="Breadcrumb" className="text-[10px] text-stone-400 tracking-widest">
                                    <span>{breadcrumbContext}</span>
                                    <span aria-hidden className="mx-1.5">›</span>
                                    <span className="text-stone-600 font-medium">{recipe.title}</span>
                                </nav>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-block text-[10px] font-black uppercase text-[#A0522D] tracking-widest bg-[#A0522D]/10 px-3 py-1 rounded-full">{recipe.category}</span>
                                    {headerApproved && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200 dark:border-amber-800">
                                            ⭐ Family Approved
                                        </span>
                                    )}
                                </div>
                                <h2 id="recipe-modal-title" className="text-3xl md:text-4xl font-serif italic text-[#2D4635] leading-tight">{recipe.title}</h2>
                                {recipe.tags && recipe.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5" aria-label="Recipe tags">
                                        {recipe.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="inline-block text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Contributor byline — avatar + italic name + meta line */}
                                <div className="flex items-center gap-3 pt-2">
                                    <img
                                        src={contributorAvatarUrlForName(recipe.contributor)}
                                        onError={avatarOnError}
                                        alt=""
                                        width={36}
                                        height={36}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-9 h-9 rounded-full bg-stone-100 dark:bg-[var(--bg-tertiary)] border border-stone-200 dark:border-[var(--border-color)] shrink-0 object-cover"
                                    />
                                    <div className="min-w-0 space-y-0.5">
                                        <p className="font-serif italic text-[#2D4635] dark:text-emerald-300 text-base leading-tight truncate">
                                            By {recipe.contributor}
                                        </p>
                                        {metaParts.length > 0 && (
                                            <p className="text-[11px] text-stone-500 dark:text-stone-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight">
                                                {metaParts.map((part, i) => (
                                                    <React.Fragment key={i}>
                                                        {i > 0 && <span aria-hidden className="text-stone-300 dark:text-stone-600">·</span>}
                                                        {part}
                                                    </React.Fragment>
                                                ))}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Family-favorite social-proof pill */}
                                {headerCount >= 3 && (
                                    <div>
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">
                                            🍴 Cooked by {headerCount} family member{headerCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Ingredients Section */}
                            <div className={`print-simplify space-y-4 bg-white/50 dark:bg-[var(--card-bg)]/50 p-6 rounded-2xl border border-stone-200/50 dark:border-[var(--border-color)] transition-all duration-300${scaleFlash ? ' ring-2 ring-[#A0522D]/30' : ''}`}>
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <h3 className="text-xl font-serif italic text-[#2D4635] flex items-center gap-2">
                                        <span className="text-2xl">🥘</span>
                                        <span>Ingredients</span>
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {baseServings > 0 && (
                                            <label className="flex items-center gap-2 text-sm">
                                                <span className="text-stone-500 font-medium">Scale to:</span>
                                                <select
                                                    value={scaleTo}
                                                    onChange={(e) => setScaleTo(parseInt(e.target.value, 10))}
                                                    className="px-3 py-2 rounded-full border border-stone-200 dark:border-[var(--border-color)] bg-white dark:bg-[var(--input-bg)] text-stone-700 dark:text-stone-200 font-medium focus:ring-2 focus:ring-[#2D4635]/20"
                                                    aria-label="Scale ingredients by serving size"
                                                >
                                                    {[...new Set([1, 2, 4, 6, 8, 10, 12, baseServings])]
                                                        .sort((a, b) => a - b)
                                                        .map((n) => (
                                                            <option key={n} value={n}>
                                                                {n} serving{n !== 1 ? 's' : ''}
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>
                                        )}
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const text = displayedIngredients.join('\n');
                                                try {
                                                    await navigator.clipboard.writeText(text);
                                                    toast('Ingredients copied to clipboard', 'success');
                                                } catch {
                                                    toast("Couldn't copy ingredients. Check clipboard permissions and try again.", 'error');
                                                }
                                            }}
                                            className="print:hidden shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#2D4635] dark:text-emerald-300 hover:text-[#A0522D] hover:bg-white/80 dark:hover:bg-[var(--bg-tertiary)] rounded-full border border-stone-200 dark:border-[var(--border-color)] transition-colors"
                                            aria-label="Copy ingredients to clipboard"
                                        >
                                            Copy ingredients
                                        </button>
                                    </div>
                                </div>
                                <ul className="space-y-3 pl-2">
                                    {displayedIngredients.map((ing, i) => (
                                        <li key={i} className="text-sm md:text-base text-stone-700 flex items-start gap-3 leading-relaxed group hover:text-[#2D4635] transition-colors">
                                            <span className="text-[#A0522D] mt-2 w-2 h-2 rounded-full bg-[#A0522D]/30 shrink-0 group-hover:bg-[#A0522D] transition-colors" />
                                            <span className="flex-1">{ing}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Instructions Section */}
                            <div className="space-y-5" id="recipe-instructions">
                                <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-[var(--border-color)]">
                                    <h3 className="text-xl font-serif italic text-[#2D4635] flex items-center gap-2">
                                        <span className="text-2xl">📝</span>
                                        <span>Instructions</span>
                                    </h3>
                                    {recipe.instructions.length >= 5 && (
                                        <div className="flex flex-wrap gap-2 print:hidden">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 self-center">Jump to:</span>
                                            {recipe.instructions.map((_, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => {
                                                        const el = document.getElementById(`recipe-step-${i}`);
                                                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }}
                                                    className="w-8 h-8 rounded-full bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-[#2D4635] hover:text-white text-stone-600 dark:text-stone-300 text-xs font-bold transition-colors"
                                                    aria-label={`Go to step ${i + 1}`}
                                                >
                                                    {i + 1}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-6">
                                    {recipe.instructions.map((step, i) => (
                                        <div key={i} id={`recipe-step-${i}`} className="flex gap-4 group hover:bg-white/50 dark:hover:bg-[var(--card-bg)]/50 p-4 rounded-xl transition-all -ml-4 scroll-mt-24">
                                            <span className="text-3xl font-serif italic text-[#A0522D]/30 group-hover:text-[#A0522D]/50 shrink-0 tabular-nums transition-colors leading-none pt-1">
                                                {(i + 1).toString().padStart(2, '0')}
                                            </span>
                                            <p className="text-sm md:text-base text-stone-700 leading-relaxed flex-1 group-hover:text-[#2D4635] transition-colors">
                                                {step}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Notes Section */}
                            {recipe.notes && (
                                <div className="print-simplify bg-gradient-to-br from-[#2D4635]/5 to-[#A0522D]/5 dark:from-[#2D4635]/20 dark:to-[#A0522D]/20 p-6 md:p-8 rounded-3xl border border-[#2D4635]/10 dark:border-[#2D4635]/30 shadow-inner">
                                    <div className="flex items-start gap-3 mb-3">
                                        <span className="text-2xl">💭</span>
                                        <span className="font-serif text-lg italic text-[#2D4635]">Heirloom Notes</span>
                                    </div>
                                    <p className="italic text-stone-600 text-sm md:text-base leading-relaxed pl-9">
                                        {recipe.notes}
                                    </p>
                                </div>
                            )}

                            {/* Rating */}
                            <RatingSection
                                recipeId={recipe.id}
                                recipeTitle={recipe.title}
                                currentUserName={currentUserName}
                                onChange={() => setRatingsVersion((v) => v + 1)}
                            />

                            {/* Share Options */}
                            <div className="space-y-2 print:hidden">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Share This Recipe</h4>
                                <ShareRecipe recipe={recipe} />
                            </div>

                            {/* Family Notes */}
                            {currentUserName && (
                                <div className="print:hidden">
                                    <RecipeNotes recipeId={recipe.id} recipeTitle={recipe.title} currentUserName={currentUserName} />
                                </div>
                            )}
                        </div>

                        {showScrollToTop && (
                            <button
                                type="button"
                                onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                                className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 bg-[#2D4635] text-white text-sm font-medium rounded-full shadow-lg hover:bg-[#2D4635]/90 transition-colors print:hidden"
                                aria-label="Scroll to top"
                            >
                                ↑ Scroll to top
                            </button>
                        )}

                        {/* Sticky bottom action bar */}
                        <div
                            className="relative shrink-0 border-t border-stone-200 dark:border-[var(--border-color)] bg-[#FDFBF7]/95 dark:bg-[var(--bg-secondary)]/95 backdrop-blur-md px-4 py-3 print:hidden flex items-center gap-2"
                            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
                        >
                            {onStartCook ? (
                                <button
                                    type="button"
                                    onClick={() => { hapticLight(); onStartCook(); }}
                                    data-testid="recipe-modal-start-cook"
                                    aria-label="Start cooking"
                                    className="flex-1 basis-1/2 min-h-12 px-4 py-3 bg-[#2D4635] hover:bg-[#2D4635]/90 text-white rounded-full font-medium text-sm md:text-base flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.02] motion-reduce:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2"
                                >
                                    <span aria-hidden className="text-lg">👨‍🍳</span>
                                    <span>Start cooking</span>
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={handleAddToGroceryList}
                                data-testid="recipe-modal-add-to-grocery"
                                aria-label="Add ingredients to grocery list"
                                className={`${onStartCook ? 'shrink-0' : 'flex-1'} min-h-12 px-4 py-3 bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 rounded-full font-medium text-sm flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2`}
                                title="Add to Grocery List"
                            >
                                <span aria-hidden className="text-base">🛒</span>
                                <span className="whitespace-nowrap">+ Grocery</span>
                            </button>
                            <div className="relative shrink-0">
                                <button
                                    ref={overflowButtonRef}
                                    type="button"
                                    onClick={() => setOverflowOpen((v) => !v)}
                                    aria-haspopup="menu"
                                    aria-expanded={overflowOpen}
                                    aria-label="More actions"
                                    className="w-11 h-11 min-w-11 min-h-11 flex items-center justify-center bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2"
                                    title="More actions"
                                >
                                    <span className="text-xl leading-none">⋯</span>
                                </button>
                                {overflowOpen && (
                                    <div
                                        ref={overflowMenuRef}
                                        role="menu"
                                        aria-label="More recipe actions"
                                        className="absolute bottom-full mb-2 right-0 bg-white dark:bg-[var(--card-bg)] rounded-2xl border border-stone-200 dark:border-[var(--border-color)] shadow-2xl py-2 min-w-[15rem] z-30 animate-fade-slide-in"
                                    >
                                        <div className="px-1">
                                            <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => { setOverflowOpen(false); handleShare(); }}
                                                className={overflowItemClass}
                                                aria-label={shareAriaLabel}
                                                title={shareTitle}
                                            >
                                                <span aria-hidden className="text-lg w-5 text-center">⎘</span>
                                                <span className="flex-1 text-left">Share recipe</span>
                                            </button>
                                            {!hasWebShare && (
                                                <a
                                                    href={emailRecipeUrl}
                                                    role="menuitem"
                                                    onClick={() => setOverflowOpen(false)}
                                                    className={`${overflowItemClass} no-underline`}
                                                    aria-label="Email recipe"
                                                >
                                                    <span aria-hidden className="text-lg w-5 text-center">✉</span>
                                                    <span className="flex-1 text-left">Email recipe</span>
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => { setOverflowOpen(false); handlePrint(); }}
                                                className={overflowItemClass}
                                                aria-label="Print recipe"
                                            >
                                                <span aria-hidden className="text-lg w-5 text-center">🖨</span>
                                                <span className="flex-1 text-left">Print recipe</span>
                                            </button>
                                        </div>
                                        <div className="my-1 border-t border-stone-100 dark:border-[var(--border-color)]" />
                                        <OverflowCollectionPicker recipeId={recipe.id} onAdded={() => setOverflowOpen(false)} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
