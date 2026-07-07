import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Recipe } from '../types';
import { buildRecipeSchema } from '../utils/recipeSchema';
import { siteConfig } from '../config/site';
import { useUI } from '../context/UIContext';
import { shouldToastImageError } from '../utils/imageErrorToast';
import { useFocusTrap } from '../utils/focusTrap';
import { scaleIngredients } from '../utils/scaleIngredients';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { getStepMinutes, formatTimer } from '../utils/stepDuration';
import { useWakeLock } from '../hooks/useWakeLock';
import { contributorAvatarUrlForName } from '../utils/contributorAvatar';
import { avatarOnError } from '../utils/avatarFallback';
import { isValidRecipeImageUrl } from '../utils/recipeImage';
import { RecipeImage } from './RecipeImage';
import { StarRating } from './StarRating';
import { RecipeNotes } from './RecipeNotes';
import { ShareRecipe } from './ShareRecipe';
import { ViewActionBar } from './ViewActionBar';
import { getAverageRating, getRatingCount, getUserRating, setRating, isFamilyApproved } from '../utils/ratings';
import { getAllCollections, addToCollection } from '../utils/collections';
import { addToMealPlan, getMealPlan, toDateKey, addDays } from '../utils/mealPlan';
import { addActivity } from '../utils/activityFeed';
import { addItems as addGroceryItems, getItems as getGroceryItems } from '../utils/groceryList';
import { trackEvent } from '../services/analytics';
import { CATEGORY_META, getTagLabel } from '../constants/taxonomy';
import { getRememberedServings, setRememberedServings } from '../utils/recipeServingsMemory';
import { FAMILY_PREFS_UPDATED_EVENT } from '../utils/familyPrefsCache';
import {
    loadRecipeCookSession,
    saveRecipeCookSession,
    parseDurationMinutes,
    formatTotalDuration,
} from '../utils/recipeCookSession';
import { CollapsiblePanel } from './CollapsiblePanel';

const DETAIL_MODES = ['read', 'cook', 'share'] as const;
type DetailMode = (typeof DETAIL_MODES)[number];

interface RecipeModalProps {
    recipe: Recipe;
    onClose: () => void;
    /** Ordered list for prev/next navigation; when provided, prev/next buttons are shown */
    recipeList?: Recipe[];
    onNavigate?: (recipe: Recipe) => void;
    isFavorite?: (id: string) => boolean;
    onToggleFavorite?: (id: string) => void;
    onStartCook?: () => void;
    /** Navigate to grocery list (e.g. from toast action after adding ingredients) */
    onOpenGroceryList?: (recipeTitle: string) => void;
    /** Optional breadcrumb context (e.g. "Recipes", "A–Z") when opened from deep link or other section */
    breadcrumbContext?: string;
    /** Current user name for ratings/notes */
    currentUserName?: string;
    /** Close modal and browse recipes filtered to this contributor */
    onBrowseContributor?: (contributor: string) => void;
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

    // Refresh aggregates when a new family-wide snapshot lands.
    useEffect(() => {
        const onFamilyUpdate = () => {
            setAvg(getAverageRating(recipeId));
            setCount(getRatingCount(recipeId));
        };
        window.addEventListener(FAMILY_PREFS_UPDATED_EVENT, onFamilyUpdate);
        return () => window.removeEventListener(FAMILY_PREFS_UPDATED_EVENT, onFamilyUpdate);
    }, [recipeId]);

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
                <p className="text-xs text-stone-600 dark:text-stone-300">{avg.toFixed(1)} avg from {count} rating{count !== 1 ? 's' : ''}</p>
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
                <span aria-hidden className="text-stone-600 dark:text-stone-300">{open ? '▾' : '▸'}</span>
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

/** Inline meal-plan day picker used inside the overflow menu. */
const OverflowMealPlanPicker: React.FC<{ recipeId: string; onAdded?: () => void }> = ({ recipeId, onAdded }) => {
    const { toast } = useUI();
    const [entries, setEntries] = useState(() => getMealPlan());
    const [open, setOpen] = useState(false);

    const days = useMemo(() => {
        const today = new Date();
        return Array.from({ length: 7 }, (_, i) => addDays(today, i));
    }, []);

    const plannedCount = entries.filter((e) => e.recipeId === recipeId).length;

    const dayLabel = (d: Date, i: number) =>
        i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long' });

    const handleAdd = (d: Date) => {
        addToMealPlan(toDateKey(d), recipeId);
        setEntries(getMealPlan());
        toast('Added to meal plan', 'success');
        setOpen(false);
        onAdded?.();
    };

    return (
        <div className="px-1">
            <button
                type="button"
                role="menuitem"
                onClick={() => {
                    setEntries(getMealPlan());
                    setOpen((v) => !v);
                }}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)] transition-colors min-h-11"
            >
                <span aria-hidden className="text-lg w-5 text-center">🗓️</span>
                <span className="flex-1 text-left">
                    {plannedCount > 0
                        ? `On ${plannedCount} planned day${plannedCount !== 1 ? 's' : ''}`
                        : 'Add to meal plan'}
                </span>
                <span aria-hidden className="text-stone-600 dark:text-stone-300">{open ? '▾' : '▸'}</span>
            </button>
            {open && (
                <div className="mt-1 ml-8 mr-1 mb-1 max-h-48 overflow-y-auto space-y-0.5 border-l border-stone-200 dark:border-[var(--border-color)] pl-2">
                    {days.map((d, i) => {
                        const already = entries.some(
                            (e) => e.date === toDateKey(d) && e.recipeId === recipeId,
                        );
                        return (
                            <button
                                key={toDateKey(d)}
                                type="button"
                                onClick={() => !already && handleAdd(d)}
                                disabled={already}
                                className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center gap-2 transition-colors ${
                                    already
                                        ? 'text-stone-400 cursor-default'
                                        : 'hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)] text-stone-700 dark:text-stone-300'
                                }`}
                            >
                                <span className="flex-1 truncate">{dayLabel(d, i)}</span>
                                <span className="text-[10px] text-stone-400">
                                    {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                                {already && <span className="text-[10px] text-emerald-500">Added</span>}
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
    onOpenGroceryList,
    breadcrumbContext = 'Recipes',
    currentUserName = '',
    onBrowseContributor,
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

    /** Same category when possible; otherwise any other recipes from the current list (browse context). */
    const suggestedRecipes = useMemo(() => {
        if (!recipe?.id || recipeList.length < 2) return [];
        const others = recipeList.filter((r) => r.id !== recipe.id);
        const sameCategory = others.filter((r) => r.category === recipe.category);
        const pool = sameCategory.length > 0 ? sameCategory : others;
        return [...pool].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 4);
    }, [recipe?.id, recipe?.category, recipeList]);

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
    const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(() => new Set());
    const [checkedSteps, setCheckedSteps] = useState<Set<number>>(() => new Set());
    const [mobileIngredientsOpen, setMobileIngredientsOpen] = useState(false);
    const scaleInitRef = useRef(true);
    const [detailMode, setDetailMode] = useState<DetailMode>('read');
    /** One kitchen timer at a time, tied to an instruction step (Cook tab). */
    const [activeTimer, setActiveTimer] = useState<{ step: number; remaining: number } | null>(null);
    const hasValidImage = !!recipe && isValidRecipeImageUrl(recipe.image) && !imageBroken;
    useFocusTrap(true, modalRef);
    useFocusTrap(lightboxOpen, lightboxRef);
    // Keep the screen on while the Cook tab is active, matching step-by-step cook mode.
    useWakeLock(detailMode === 'cook', () =>
        toast('Could not keep screen awake. Your device may lock during cooking.', 'info')
    );

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
        setScaleTo(getRememberedServings(recipe.id, base));
        setImageBroken(false);
        setImageLoading(true);
        setLightboxImageBroken(false);
        setOverflowOpen(false);
        const session = loadRecipeCookSession(recipe.id);
        setCheckedIngredients(new Set(session.ingredients));
        setCheckedSteps(new Set(session.steps));
        setMobileIngredientsOpen(false);
        setDetailMode('read');
        setActiveTimer(null);
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }, [recipe?.id, recipe?.servings]);

    // Tick the active step timer once per second; celebrate when it finishes.
    useEffect(() => {
        if (!activeTimer || activeTimer.remaining <= 0) return;
        const id = window.setInterval(() => {
            setActiveTimer((current) => {
                if (!current) return null;
                if (current.remaining <= 1) {
                    hapticSuccess();
                    toast(`Step ${current.step + 1} timer done`, 'success');
                    return null;
                }
                return { ...current, remaining: current.remaining - 1 };
            });
        }, 1000);
        return () => window.clearInterval(id);
    }, [activeTimer, toast]);

    useEffect(() => {
        if (!recipe?.id || scaleTo <= 0) return;
        setRememberedServings(recipe.id, scaleTo);
    }, [recipe?.id, scaleTo]);

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

    // Scroll to instructions when entering cook-focused view
    useEffect(() => {
        if (detailMode !== 'cook') return;
        const id = window.requestAnimationFrame(() => {
            document.getElementById('recipe-instructions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return () => window.cancelAnimationFrame(id);
    }, [detailMode, recipe?.id]);

    useEffect(() => {
        if (!recipe?.id) return;
        saveRecipeCookSession(recipe.id, {
            ingredients: [...checkedIngredients],
            steps: [...checkedSteps],
        });
    }, [recipe?.id, checkedIngredients, checkedSteps]);

    // Refresh header rating badges when a fresh family aggregate arrives.
    useEffect(() => {
        const onFamilyUpdate = () => setRatingsVersion((v) => v + 1);
        window.addEventListener(FAMILY_PREFS_UPDATED_EVENT, onFamilyUpdate);
        return () => window.removeEventListener(FAMILY_PREFS_UPDATED_EVENT, onFamilyUpdate);
    }, []);

    // Arrow keys: prev/next recipe (skip when tablist is focused)
    useEffect(() => {
        if (!onNavigate || lightboxOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.target as Element | null)?.closest('[role="tablist"][aria-label="Recipe view mode"]')) return;
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
            toast(`Added ${added} item${added === 1 ? '' : 's'} to Grocery List`, 'success', {
                action: onOpenGroceryList
                    ? {
                          label: 'View list',
                          onClick: () => onOpenGroceryList(recipe.title),
                      }
                    : undefined,
            });
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
    const prepMinutes = parseDurationMinutes(recipe.prepTime);
    const cookMinutes = parseDurationMinutes(recipe.cookTime);
    if (prepMinutes != null && cookMinutes != null) {
        metaParts.push(
            <span key="total">Total: {formatTotalDuration(prepMinutes + cookMinutes)}</span>
        );
    }

    const handleDetailTabKeyDown = (e: React.KeyboardEvent) => {
        const idx = DETAIL_MODES.indexOf(detailMode);
        if (idx < 0) return;
        if (e.key === 'ArrowRight' && idx < DETAIL_MODES.length - 1) {
            e.preventDefault();
            e.stopPropagation();
            setDetailMode(DETAIL_MODES[idx + 1]!);
        } else if (e.key === 'ArrowLeft' && idx > 0) {
            e.preventDefault();
            e.stopPropagation();
            setDetailMode(DETAIL_MODES[idx - 1]!);
        } else if (e.key === 'Home') {
            e.preventDefault();
            e.stopPropagation();
            setDetailMode('read');
        } else if (e.key === 'End') {
            e.preventDefault();
            e.stopPropagation();
            setDetailMode('share');
        }
    };

    const storyPreview = recipe.notes?.trim();
    const detailSummary = [recipe.prepTime && `Prep ${recipe.prepTime}`, recipe.cookTime && `Cook ${recipe.cookTime}`, recipe.servings != null && `Serves ${recipe.servings}`]
        .filter(Boolean)
        .join(' · ');
    const scaledServingOptions = baseServings > 0
        ? [...new Set([Math.max(1, Math.round(baseServings / 2)), baseServings, baseServings * 2, baseServings * 3, 1, 2, 4, 6, 8, 10, 12])]
            .filter((n) => n > 0)
            .sort((a, b) => a - b)
        : [];

    const toggleIngredient = (index: number) => {
        hapticLight();
        setCheckedIngredients((current) => {
            const next = new Set(current);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const startStepTimer = (stepIdx: number, minutes: number) => {
        hapticLight();
        setActiveTimer({ step: stepIdx, remaining: minutes * 60 });
    };

    const cancelStepTimer = () => {
        hapticLight();
        setActiveTimer(null);
    };

    const toggleStep = (index: number) => {
        hapticLight();
        setCheckedSteps((current) => {
            const next = new Set(current);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const jumpToIngredients = () => {
        hapticLight();
        setMobileIngredientsOpen(true);
        window.requestAnimationFrame(() => {
            document.getElementById('recipe-ingredients-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    const jumpToInstructions = () => {
        hapticLight();
        document.getElementById('recipe-instructions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const stepCount = recipe.instructions.length;
    const stepsDone = checkedSteps.size;
    const stepsProgressPct = stepCount > 0 ? Math.round((stepsDone / stepCount) * 100) : 0;

    const ingredientsPanelClass = `print-simplify lg:sticky lg:top-6 space-y-4 bg-white/85 dark:bg-[var(--card-bg)]/85 p-5 md:p-6 rounded-3xl border border-stone-200/80 dark:border-[var(--border-color)] shadow-sm transition-all duration-300${scaleFlash ? ' ring-2 ring-[#A0522D]/30' : ''}`;

    const ingredientsPanel = (
        <>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-2xl font-serif italic text-[#2D4635] dark:text-emerald-300 flex items-center gap-2">
                        <span>Ingredients</span>
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                        Check items off as you cook.
                    </p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300 whitespace-nowrap">
                    {checkedIngredients.size}/{displayedIngredients.length}
                </span>
            </div>
            {checkedIngredients.size > 0 && (
                <button
                    type="button"
                    onClick={() => {
                        hapticLight();
                        setCheckedIngredients(new Set());
                    }}
                    className="print:hidden text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-[#A0522D] transition-colors"
                    aria-label="Clear ingredient checkmarks"
                >
                    Clear checks
                </button>
            )}
            {baseServings > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 dark:bg-[var(--bg-tertiary)] p-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-stone-500 pl-2">Serves</span>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setScaleTo((n) => Math.max(1, n - 1))}
                            className="print:hidden w-9 h-9 rounded-full bg-white dark:bg-[var(--card-bg)] border border-stone-200 dark:border-[var(--border-color)] text-stone-700 dark:text-stone-200 font-bold"
                            aria-label="Decrease servings"
                        >
                            -
                        </button>
                        <select
                            value={scaleTo}
                            onChange={(e) => setScaleTo(parseInt(e.target.value, 10))}
                            className="px-3 py-2 rounded-full border border-stone-200 dark:border-[var(--border-color)] bg-white dark:bg-[var(--input-bg)] text-stone-700 dark:text-stone-200 font-medium focus:ring-2 focus:ring-[#2D4635]/20"
                            aria-label="Scale ingredients by serving size"
                        >
                            {scaledServingOptions.map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setScaleTo((n) => n + 1)}
                            className="print:hidden w-9 h-9 rounded-full bg-white dark:bg-[var(--card-bg)] border border-stone-200 dark:border-[var(--border-color)] text-stone-700 dark:text-stone-200 font-bold"
                            aria-label="Increase servings"
                        >
                            +
                        </button>
                    </div>
                </div>
            )}
            {baseServings > 0 && scaleTo !== baseServings && (
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#A0522D]/10 dark:bg-amber-900/20 px-3 py-2 text-xs text-[#A0522D] dark:text-amber-300">
                    <span>
                        Quantities scaled for {scaleTo} — original recipe serves {baseServings}.
                    </span>
                    <button
                        type="button"
                        data-testid="recipe-scale-reset"
                        onClick={() => {
                            hapticLight();
                            setScaleTo(baseServings);
                        }}
                        className="print:hidden shrink-0 px-3 py-1 min-h-8 rounded-full border border-[#A0522D]/40 font-bold uppercase tracking-widest hover:bg-[#A0522D] hover:text-white transition-colors"
                        aria-label={`Reset to original ${baseServings} servings`}
                    >
                        Reset
                    </button>
                </div>
            )}
            <span className="sr-only" aria-live="polite">
                {baseServings > 0 && scaleTo !== baseServings
                    ? `Ingredient quantities scaled to serve ${scaleTo}`
                    : ''}
            </span>
            <ul className="space-y-2">
                {displayedIngredients.map((ing, i) => {
                    const checked = checkedIngredients.has(i);
                    return (
                        <li key={`${ing}-${i}`}>
                            <label className={`flex items-start gap-3 rounded-2xl p-3 min-h-11 cursor-pointer transition-colors ${checked ? 'bg-emerald-50 dark:bg-emerald-900/30 text-stone-400 line-through' : 'hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)] text-stone-700 dark:text-stone-200'}`}>
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleIngredient(i)}
                                    className="mt-1 w-5 h-5 rounded border-stone-300 text-[#2D4635] focus:ring-[#2D4635]"
                                />
                                <span className="flex-1 text-sm md:text-base leading-relaxed">{ing}</span>
                            </label>
                        </li>
                    );
                })}
            </ul>
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
                className="print:hidden w-full px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#2D4635] dark:text-emerald-300 hover:text-[#A0522D] hover:bg-stone-50 dark:hover:bg-[var(--bg-tertiary)] rounded-full border border-stone-200 dark:border-[var(--border-color)] transition-colors"
                aria-label="Copy ingredients to clipboard"
            >
                Copy ingredients
            </button>
        </>
    );

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
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
                >
                    <div
                        role="presentation"
                        className="absolute inset-0 cursor-zoom-out bg-black/95 backdrop-blur-lg motion-reduce:backdrop-blur-none"
                        onClick={() => setLightboxOpen(false)}
                    />
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
                                {CATEGORY_META[recipe.category]?.icon || CATEGORY_META.Generic.icon}
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
                            className="relative max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500"
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
                {onNavigate && (prevRecipe || nextRecipe) && (
                    <div className="hidden md:flex absolute inset-y-0 left-0 right-0 z-[101] pointer-events-none items-center justify-between max-w-[calc(100%-2rem)] mx-auto px-0 md:max-w-[calc(48rem+8rem)] lg:max-w-[calc(72rem+8rem)]">
                        {prevRecipe ? (
                            <button
                                type="button"
                                data-testid="recipe-nav-previous"
                                onClick={() => { hapticLight(); onNavigate(prevRecipe); }}
                                className="pointer-events-auto ml-2 w-11 h-11 min-w-11 min-h-11 rounded-full bg-white/95 dark:bg-[var(--card-bg)]/95 shadow-xl flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-[#2D4635] hover:scale-105 transition-all print:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                aria-label={`Previous recipe: ${prevRecipe.title}`}
                                title={prevRecipe.title}
                            >
                                <span aria-hidden className="text-lg">←</span>
                            </button>
                        ) : (
                            <span className="w-11" aria-hidden />
                        )}
                        {nextRecipe ? (
                            <button
                                type="button"
                                data-testid="recipe-nav-next"
                                onClick={() => { hapticLight(); onNavigate(nextRecipe); }}
                                className="pointer-events-auto mr-2 w-11 h-11 min-w-11 min-h-11 rounded-full bg-white/95 dark:bg-[var(--card-bg)]/95 shadow-xl flex items-center justify-center text-stone-600 dark:text-stone-300 hover:text-[#2D4635] hover:scale-105 transition-all print:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                aria-label={`Next recipe: ${nextRecipe.title}`}
                                title={nextRecipe.title}
                            >
                                <span aria-hidden className="text-lg">→</span>
                            </button>
                        ) : (
                            <span className="w-11" aria-hidden />
                        )}
                    </div>
                )}
                <div className="print-recipe-content bg-[#FDFBF7] dark:bg-[var(--bg-secondary)] w-full md:max-w-6xl h-full md:h-auto md:max-h-[92vh] md:rounded-[3rem] overflow-hidden shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 md:zoom-in-95 duration-500 flex flex-col">
                    {/* Mobile-only "back to context" pill (top-left) */}
                    <button
                        onClick={onClose}
                        className="absolute top-2 left-2 z-20 md:hidden max-w-[42vw] truncate px-4 py-2 bg-white/95 dark:bg-[var(--card-bg)]/95 backdrop-blur-sm rounded-full shadow-xl text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300 print:hidden"
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

                    <div
                        ref={scrollContainerRef}
                        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-28"
                    >
                        <header className="grid md:grid-cols-[minmax(17rem,24rem)_1fr] bg-[#FDFBF7] dark:bg-[var(--bg-secondary)] border-b border-stone-200 dark:border-[var(--border-color)]">
                            {hasValidImage ? (
                                <button
                                    type="button"
                                    className="relative min-h-64 md:min-h-[25rem] cursor-zoom-in group overflow-hidden bg-stone-100 dark:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2"
                                    onClick={() => setLightboxOpen(true)}
                                    aria-label="Enlarge recipe image"
                                >
                                    {imageLoading && <div className="absolute inset-0 animate-pulse bg-stone-200" />}
                                    <img
                                        src={recipe.image}
                                        width={1200}
                                        height={720}
                                        className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
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
                                </button>
                            ) : (
                                <div className="relative min-h-64 md:min-h-[25rem] bg-[#2D4635]">
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 p-8">
                                        <span className="text-5xl mb-4 drop-shadow-lg" aria-hidden="true">
                                            {CATEGORY_META[recipe.category]?.icon || CATEGORY_META.Generic.icon}
                                        </span>
                                        <span className="text-sm font-serif italic opacity-80">{recipe.category}</span>
                                    </div>
                                </div>
                            )}

                            {onToggleFavorite && isFavorite && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(recipe.id); }}
                                    className={`absolute z-20 top-16 right-3 md:top-5 md:right-20 w-11 h-11 min-w-11 min-h-11 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 motion-reduce:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent print:hidden ${
                                        isFavorite(recipe.id)
                                            ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                            : 'bg-white/95 dark:bg-[var(--card-bg)]/95 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-white dark:hover:bg-[var(--card-bg)]'
                                    }`}
                                    aria-label={isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                                    title={isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                    <span className="text-xl" aria-hidden="true">{isFavorite(recipe.id) ? '♥' : '♡'}</span>
                                </button>
                            )}

                            <div className="flex min-h-0 flex-col justify-center px-6 pt-14 pb-6 md:p-8 lg:p-10">
                                <nav aria-label="Breadcrumb" className="text-[10px] text-stone-500 dark:text-stone-400 tracking-widest mb-4 print:hidden">
                                    <span>{breadcrumbContext}</span>
                                    <span aria-hidden className="mx-1.5">›</span>
                                    <span className="font-medium">{recipe.title}</span>
                                </nav>
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <span className="inline-block text-[10px] font-black uppercase text-[#A0522D] tracking-widest bg-[#A0522D]/10 px-3 py-1 rounded-full">{recipe.category}</span>
                                    {headerApproved && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50/95 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200">
                                            Family Approved
                                        </span>
                                    )}
                                    {headerCount >= 3 && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50/95 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200">
                                            Cooked by {headerCount}
                                        </span>
                                    )}
                                </div>
                                <h2 id="recipe-modal-title" className="text-3xl sm:text-4xl md:text-5xl font-serif italic leading-tight text-[#2D4635] dark:text-emerald-100 break-words">{recipe.title}</h2>
                                {detailSummary && (
                                    <p className="mt-3 text-base text-stone-600 dark:text-stone-300">{detailSummary}</p>
                                )}
                                <div className="flex items-center gap-3 pt-5">
                                    <img
                                        src={contributorAvatarUrlForName(recipe.contributor)}
                                        onError={avatarOnError}
                                        alt=""
                                        width={44}
                                        height={44}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-11 h-11 rounded-full bg-stone-100 border border-stone-200 dark:border-stone-700 shrink-0 object-cover"
                                    />
                                    <div className="min-w-0 space-y-0.5">
                                        {onBrowseContributor ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    hapticLight();
                                                    onBrowseContributor(recipe.contributor);
                                                }}
                                                data-testid="recipe-modal-browse-contributor"
                                                className="font-serif italic text-[#2D4635] dark:text-emerald-100 text-lg leading-tight truncate text-left hover:text-[#A0522D] dark:hover:text-emerald-200 transition-colors print:text-[#2D4635]"
                                                aria-label={`Browse recipes by ${recipe.contributor}`}
                                            >
                                                By {recipe.contributor}
                                            </button>
                                        ) : (
                                            <p className="font-serif italic text-[#2D4635] dark:text-emerald-100 text-lg leading-tight truncate">
                                                By {recipe.contributor}
                                            </p>
                                        )}
                                        {metaParts.length > 0 && (
                                            <p className="text-xs text-stone-500 dark:text-stone-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight">
                                                {metaParts.map((part, i) => (
                                                    <React.Fragment key={i}>
                                                        {i > 0 && <span aria-hidden className="text-stone-300">·</span>}
                                                        {part}
                                                    </React.Fragment>
                                                ))}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </header>

                        <div className="print:hidden px-5 pt-4 md:px-8 lg:px-10 flex justify-center sticky top-0 z-[5] bg-[#FDFBF7]/95 dark:bg-[var(--bg-secondary)]/95 backdrop-blur-sm pb-2">
                            <div
                                role="tablist"
                                aria-label="Recipe view mode"
                                tabIndex={-1}
                                onKeyDown={handleDetailTabKeyDown}
                                className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-stone-200 dark:border-[var(--border-color)] bg-white/90 dark:bg-[var(--card-bg)]/95 p-1 shadow-sm"
                            >
                                {(
                                    [
                                        { id: 'read' as const, label: 'Read' },
                                        { id: 'cook' as const, label: 'Cook' },
                                        { id: 'share' as const, label: 'Share' },
                                    ]
                                ).map(({ id, label }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        role="tab"
                                        aria-selected={detailMode === id}
                                        onClick={() => {
                                            hapticLight();
                                            setDetailMode(id);
                                        }}
                                        className={`min-h-10 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors motion-reduce:transition-none ${
                                            detailMode === id
                                                ? 'bg-[#2D4635] text-white shadow-sm'
                                                : 'text-stone-600 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-[var(--bg-tertiary)]'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {detailMode !== 'share' && (
                            <div className="print:hidden lg:hidden px-5 md:px-8 flex gap-2 justify-center sticky top-[3.25rem] z-[5] bg-[#FDFBF7]/95 dark:bg-[var(--bg-secondary)]/95 backdrop-blur-sm pb-2">
                                <button
                                    type="button"
                                    onClick={jumpToIngredients}
                                    aria-label="Jump to ingredients"
                                    className="min-h-10 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 dark:border-[var(--border-color)] bg-white/90 dark:bg-[var(--card-bg)] text-stone-600 dark:text-stone-300"
                                >
                                    Jump to ingredients
                                </button>
                                <button
                                    type="button"
                                    onClick={jumpToInstructions}
                                    aria-label="Jump to steps"
                                    className="min-h-10 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-stone-200 dark:border-[var(--border-color)] bg-white/90 dark:bg-[var(--card-bg)] text-stone-600 dark:text-stone-300"
                                >
                                    Jump to steps
                                </button>
                            </div>
                        )}

                        <main className="p-5 md:p-8 lg:p-10 space-y-8">
                            {detailMode === 'cook' && onStartCook && (
                                <section
                                    aria-label="Step-by-step cook mode"
                                    className="print:hidden rounded-3xl bg-gradient-to-br from-[#2D4635] to-[#3d5c48] text-white p-5 md:p-6 shadow-md"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex-1 space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100/80">Focused cooking</p>
                                            <h3 className="font-serif italic text-xl md:text-2xl">Open step-by-step cook mode</h3>
                                            <p className="text-sm text-emerald-50/90">
                                                Keeps your screen awake, supports timers, swipe navigation, and read-aloud.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { hapticLight(); onStartCook(); }}
                                            data-testid="recipe-cook-tab-start"
                                            className="shrink-0 min-h-11 px-6 py-3 rounded-full bg-white text-[#2D4635] text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-emerald-50 transition-colors"
                                        >
                                            Start step-by-step
                                        </button>
                                    </div>
                                </section>
                            )}

                            {detailMode === 'cook' && stepCount > 0 && (
                                <div className="print:hidden space-y-2" aria-live="polite">
                                    <div className="flex items-center justify-between gap-3 text-xs text-stone-600 dark:text-stone-300">
                                        <span className="font-bold uppercase tracking-widest">Cooking progress</span>
                                        <span>{stepsDone} of {stepCount} steps</span>
                                    </div>
                                    <div
                                        className="h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden"
                                        role="progressbar"
                                        aria-valuenow={stepsDone}
                                        aria-valuemin={0}
                                        aria-valuemax={stepCount}
                                        aria-label={`${stepsDone} of ${stepCount} steps completed`}
                                    >
                                        <div
                                            className="h-full bg-[#2D4635] dark:bg-emerald-500 transition-all duration-300 motion-reduce:transition-none"
                                            style={{ width: `${stepsProgressPct}%` }}
                                        />
                                    </div>
                                    {stepsDone > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                hapticLight();
                                                setCheckedSteps(new Set());
                                            }}
                                            className="text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-[#A0522D] transition-colors"
                                            aria-label="Clear step checkmarks"
                                        >
                                            Clear step checks
                                        </button>
                                    )}
                                    {stepsDone === stepCount && (
                                        <p className="text-sm font-serif italic text-[#2D4635] dark:text-emerald-300">
                                            All steps checked — nice work!
                                        </p>
                                    )}
                                </div>
                            )}

                            {detailMode === 'read' && storyPreview && (
                                <section className="print-simplify rounded-3xl bg-gradient-to-br from-[#2D4635]/5 to-[#A0522D]/10 dark:from-[#2D4635]/20 dark:to-[#A0522D]/20 border border-[#2D4635]/10 dark:border-[#2D4635]/30 p-6 md:p-8">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[#A0522D]">Heirloom Notes</p>
                                        <p className="font-serif italic text-lg md:text-xl leading-relaxed text-[#2D4635] dark:text-emerald-300">
                                            {storyPreview}
                                        </p>
                                        <p className="text-sm text-stone-600 dark:text-stone-300">
                                            From {recipe.contributor}'s kitchen notes.
                                        </p>
                                    </div>
                                </section>
                            )}

                            {detailMode === 'read' && recipe.tags && recipe.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 print:hidden" aria-label="Recipe tags">
                                    {recipe.tags.map(tag => (
                                        <span
                                            key={tag}
                                            className="inline-block text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full"
                                        >
                                            {getTagLabel(tag)}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {(detailMode === 'read' || detailMode === 'cook') && (
                            <section className="grid lg:grid-cols-[minmax(17rem,21rem)_1fr] gap-6 lg:gap-8 items-start">
                                {detailMode === 'read' && (
                                    <div id="recipe-ingredients-section" className="lg:hidden order-2">
                                        <CollapsiblePanel
                                            id="recipe-ingredients-mobile"
                                            title={`Ingredients (${displayedIngredients.length})`}
                                            defaultOpen={false}
                                            open={mobileIngredientsOpen}
                                            onOpenChange={setMobileIngredientsOpen}
                                            className="rounded-3xl border-stone-200/80 dark:border-[var(--border-color)]"
                                            panelClassName="pt-1"
                                        >
                                            <div className="space-y-4">{ingredientsPanel}</div>
                                        </CollapsiblePanel>
                                    </div>
                                )}
                                <aside className={`${detailMode === 'read' ? 'hidden lg:block ' : ''}${ingredientsPanelClass} order-2 lg:order-none`}>
                                    {ingredientsPanel}
                                </aside>

                                <div className="space-y-5 order-1 lg:order-none" id="recipe-instructions">
                                    <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[#FDFBF7]/95 dark:bg-[var(--bg-secondary)]/95 backdrop-blur-md print:static print:bg-transparent">
                                        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-stone-200 dark:border-[var(--border-color)]">
                                            <div>
                                                <h3 className="text-2xl font-serif italic text-[#2D4635] dark:text-emerald-300 flex items-center gap-2">
                                                    <span>Instructions</span>
                                                </h3>
                                                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">One action per card, with room to cook.</p>
                                            </div>
                                            {recipe.instructions.length >= 5 && (
                                                <div className="flex flex-wrap gap-2 print:hidden">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300 self-center">Jump to:</span>
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
                                    </div>
                                    <div className="space-y-4">
                                        {recipe.instructions.map((step, i) => {
                                            const stepImage = recipe.stepImages?.[i];
                                            const stepDone = checkedSteps.has(i);
                                            const stepMinutes = detailMode === 'cook' ? getStepMinutes(step) : null;
                                            const timerRunning = activeTimer?.step === i;
                                            return (
                                                <article
                                                    key={i}
                                                    id={`recipe-step-${i}`}
                                                    className={`scroll-mt-28 bg-white/80 dark:bg-[var(--card-bg)] border rounded-3xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow ${
                                                        stepDone && detailMode === 'cook'
                                                            ? 'border-emerald-200 dark:border-emerald-800/60 opacity-80'
                                                            : 'border-stone-200/80 dark:border-[var(--border-color)]'
                                                    }`}
                                                >
                                                    <div className="flex gap-4">
                                                        {detailMode === 'cook' ? (
                                                            <label className="shrink-0 pt-1 cursor-pointer print:hidden">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={stepDone}
                                                                    onChange={() => toggleStep(i)}
                                                                    className="sr-only peer"
                                                                    aria-label={`Mark step ${i + 1} complete`}
                                                                />
                                                                <span
                                                                    aria-hidden
                                                                    className={`flex w-10 h-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#2D4635] ${
                                                                        stepDone
                                                                            ? 'bg-[#2D4635] border-[#2D4635] text-white'
                                                                            : 'border-stone-300 dark:border-stone-600 text-stone-400'
                                                                    }`}
                                                                >
                                                                    {stepDone ? '✓' : (i + 1).toString()}
                                                                </span>
                                                            </label>
                                                        ) : (
                                                            <span className="text-4xl md:text-5xl font-serif italic text-[#A0522D]/35 shrink-0 tabular-nums leading-none pt-1">
                                                                {(i + 1).toString().padStart(2, '0')}
                                                            </span>
                                                        )}
                                                        <div className="flex-1 space-y-4">
                                                            <p className={`text-lg md:text-xl leading-relaxed ${
                                                                stepDone && detailMode === 'cook'
                                                                    ? 'text-stone-400 line-through dark:text-stone-500'
                                                                    : 'text-stone-800 dark:text-stone-100'
                                                            }`}>
                                                                {step}
                                                            </p>
                                                            {stepImage && (
                                                                <img
                                                                    src={stepImage}
                                                                    alt={`Step ${i + 1} for ${recipe.title}`}
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    className="w-full max-h-72 object-cover rounded-2xl border border-stone-200 dark:border-[var(--border-color)]"
                                                                />
                                                            )}
                                                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400 print:hidden">
                                                                <span className="px-3 py-1 rounded-full bg-stone-100 dark:bg-[var(--bg-tertiary)] font-bold uppercase tracking-widest">
                                                                    Step {i + 1} of {recipe.instructions.length}
                                                                </span>
                                                                {i === 0 && displayedIngredients.length > 0 && (
                                                                    <span className="px-3 py-1 rounded-full bg-[#A0522D]/10 text-[#A0522D] font-bold uppercase tracking-widest">
                                                                        Gather ingredients first
                                                                    </span>
                                                                )}
                                                                {stepMinutes != null && !timerRunning && (
                                                                    <button
                                                                        type="button"
                                                                        data-testid={`recipe-step-timer-start-${i}`}
                                                                        onClick={() => startStepTimer(i, stepMinutes)}
                                                                        className="px-3 py-1 min-h-8 rounded-full border border-[#2D4635]/30 dark:border-emerald-700 text-[#2D4635] dark:text-emerald-300 font-bold uppercase tracking-widest hover:bg-[#2D4635] hover:text-white transition-colors"
                                                                        aria-label={`Start ${stepMinutes} minute timer for step ${i + 1}`}
                                                                    >
                                                                        <span aria-hidden>⏱</span> Start {stepMinutes}-min timer
                                                                    </button>
                                                                )}
                                                                {timerRunning && activeTimer && (
                                                                    <span
                                                                        role="timer"
                                                                        data-testid={`recipe-step-timer-running-${i}`}
                                                                        aria-label={`Step ${i + 1} timer: ${formatTimer(activeTimer.remaining)} remaining`}
                                                                        className="inline-flex items-center gap-2 px-3 py-1 min-h-8 rounded-full bg-[#2D4635] text-white font-bold tabular-nums"
                                                                    >
                                                                        <span aria-hidden>⏱</span>
                                                                        {formatTimer(activeTimer.remaining)}
                                                                        <button
                                                                            type="button"
                                                                            onClick={cancelStepTimer}
                                                                            className="ml-1 -mr-1 w-6 h-6 rounded-full hover:bg-white/20 transition-colors"
                                                                            aria-label={`Cancel step ${i + 1} timer`}
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section>
                            )}

                            {detailMode === 'read' && suggestedRecipes.length > 0 && onNavigate && (
                                <CollapsiblePanel
                                    id="recipe-suggestions"
                                    title="You might also like"
                                    defaultOpen={false}
                                    className="print:hidden rounded-3xl border-stone-200 dark:border-[var(--border-color)]"
                                    panelClassName="pt-1"
                                >
                                    <ul className="flex gap-3 overflow-x-auto pb-1 no-scrollbar scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                                        {suggestedRecipes.map((r) => (
                                            <li key={r.id} className="shrink-0 w-40 sm:w-44">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        hapticLight();
                                                        trackEvent('recipe_suggestion_open', { recipeId: r.id, fromRecipeId: recipe.id });
                                                        onNavigate(r);
                                                    }}
                                                    className="block w-full text-left rounded-2xl border border-stone-200/90 dark:border-[var(--border-color)] overflow-hidden bg-white dark:bg-[var(--card-bg)] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.98] motion-reduce:transition-none"
                                                >
                                                    <div className="aspect-[4/3] bg-stone-100 dark:bg-stone-800 relative overflow-hidden">
                                                        <RecipeImage recipe={r} compact />
                                                    </div>
                                                    <div className="p-3 space-y-1">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#A0522D]/90 line-clamp-1">{r.category}</p>
                                                        <p className="text-sm font-serif italic text-[#2D4635] dark:text-emerald-100 line-clamp-2 leading-snug">{r.title}</p>
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </CollapsiblePanel>
                            )}

                            {detailMode === 'read' && hasValidImage && (
                                <section className="print:hidden rounded-3xl bg-white/60 dark:bg-[var(--card-bg)] border border-stone-200 dark:border-[var(--border-color)] p-5 md:p-6">
                                    <h3 className="font-serif italic text-xl text-[#2D4635] dark:text-emerald-300 mb-3">Photos</h3>
                                    <div className="grid sm:grid-cols-3 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setLightboxOpen(true)}
                                            className="sm:col-span-2 group relative overflow-hidden rounded-2xl border border-stone-200 dark:border-[var(--border-color)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635]"
                                            aria-label="Open recipe hero photo"
                                        >
                                            <img src={recipe.image} alt="" loading="lazy" decoding="async" className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                            <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-bold">Hero photo</span>
                                        </button>
                                        <div className="rounded-2xl border border-dashed border-stone-300 dark:border-[var(--border-color)] p-4 flex items-center justify-center text-center text-sm text-stone-500 dark:text-stone-400">
                                            Step photos can appear inside instruction cards when added.
                                        </div>
                                    </div>
                                </section>
                            )}

                            {detailMode === 'read' && (
                            <details className="print:hidden rounded-3xl border border-stone-200 dark:border-[var(--border-color)] bg-white/65 dark:bg-[var(--card-bg)] p-5 md:p-6">
                                <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-stone-600 dark:text-stone-300">
                                    Notes, ratings, and sharing
                                </summary>
                                <div className="mt-5 grid gap-6 md:grid-cols-2">
                                    <RatingSection
                                        recipeId={recipe.id}
                                        recipeTitle={recipe.title}
                                        currentUserName={currentUserName}
                                        onChange={() => setRatingsVersion((v) => v + 1)}
                                    />
                                    <div className="space-y-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-500">Share This Recipe</h4>
                                        <ShareRecipe recipe={recipe} />
                                    </div>
                                    {currentUserName && (
                                        <div className="md:col-span-2">
                                            <RecipeNotes recipeId={recipe.id} recipeTitle={recipe.title} currentUserName={currentUserName} />
                                        </div>
                                    )}
                                </div>
                            </details>
                            )}

                            {detailMode === 'share' && (
                                <section
                                    aria-label="Share recipe"
                                    className="print:hidden rounded-3xl border border-stone-200 dark:border-[var(--border-color)] bg-white/65 dark:bg-[var(--card-bg)] p-5 md:p-8 space-y-8"
                                >
                                    <div className="space-y-2">
                                        <h3 className="font-serif italic text-2xl text-[#2D4635] dark:text-emerald-300">Share with family</h3>
                                        <p className="text-sm text-stone-600 dark:text-stone-400">
                                            Copy the link or send an invite — ratings and personal notes stay below.
                                        </p>
                                    </div>
                                    <ShareRecipe recipe={recipe} variant="featured" />
                                    <RatingSection
                                        recipeId={recipe.id}
                                        recipeTitle={recipe.title}
                                        currentUserName={currentUserName}
                                        onChange={() => setRatingsVersion((v) => v + 1)}
                                    />
                                    {currentUserName && (
                                        <RecipeNotes recipeId={recipe.id} recipeTitle={recipe.title} currentUserName={currentUserName} />
                                    )}
                                </section>
                            )}
                        </main>
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

                    {onNavigate && (prevRecipe || nextRecipe) && (
                        <nav
                            aria-label="Browse recipes"
                            className="md:hidden print:hidden flex items-stretch gap-2 px-4 py-2 border-t border-stone-200 dark:border-[var(--border-color)] bg-[#FDFBF7] dark:bg-[var(--bg-secondary)]"
                        >
                            {prevRecipe ? (
                                <button
                                    type="button"
                                    data-testid="recipe-nav-previous-mobile"
                                    onClick={() => { hapticLight(); onNavigate(prevRecipe); }}
                                    className="flex-1 min-h-11 px-3 py-2 rounded-xl border border-stone-200 dark:border-[var(--border-color)] text-left text-xs text-stone-600 dark:text-stone-300 truncate"
                                    aria-label={`Previous recipe: ${prevRecipe.title}`}
                                >
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Previous</span>
                                    <span className="font-serif italic text-[#2D4635] dark:text-emerald-200 truncate">{prevRecipe.title}</span>
                                </button>
                            ) : (
                                <span className="flex-1" aria-hidden />
                            )}
                            {nextRecipe ? (
                                <button
                                    type="button"
                                    data-testid="recipe-nav-next-mobile"
                                    onClick={() => { hapticLight(); onNavigate(nextRecipe); }}
                                    className="flex-1 min-h-11 px-3 py-2 rounded-xl border border-stone-200 dark:border-[var(--border-color)] text-right text-xs text-stone-600 dark:text-stone-300 truncate"
                                    aria-label={`Next recipe: ${nextRecipe.title}`}
                                >
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Next</span>
                                    <span className="font-serif italic text-[#2D4635] dark:text-emerald-200 truncate">{nextRecipe.title}</span>
                                </button>
                            ) : null}
                        </nav>
                    )}

                    {/* Sticky bottom action bar */}
                    <ViewActionBar sticky={false} className="rounded-none border-x-0 border-b-0">
                            {onStartCook ? (
                                <button
                                    type="button"
                                    onClick={() => { hapticLight(); onStartCook(); }}
                                    data-testid="recipe-modal-start-cook"
                                    aria-label="Start cooking"
                                    className="btn btn-primary flex-1"
                                >
                                    Start cooking
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={handleAddToGroceryList}
                                data-testid="recipe-modal-add-to-grocery"
                                aria-label="Add ingredients to grocery list"
                                className={`btn btn-secondary ${onStartCook ? 'shrink-0' : 'flex-1'}`}
                                title="Add to Grocery List"
                            >
                                + Grocery
                            </button>
                            <div className="relative shrink-0">
                                <button
                                    ref={overflowButtonRef}
                                    type="button"
                                    onClick={() => setOverflowOpen((v) => !v)}
                                    aria-haspopup="menu"
                                    aria-expanded={overflowOpen}
                                    aria-label="More actions"
                                    className="btn btn-icon"
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
                                                <span className="flex-1 text-left">Print recipe</span>
                                            </button>
                                        </div>
                                        <div className="my-1 border-t border-stone-100 dark:border-[var(--border-color)]" />
                                        <OverflowCollectionPicker recipeId={recipe.id} onAdded={() => setOverflowOpen(false)} />
                                        <OverflowMealPlanPicker recipeId={recipe.id} onAdded={() => setOverflowOpen(false)} />
                                    </div>
                                )}
                            </div>
                    </ViewActionBar>
                </div>
            </div>
        </>
    );
};
