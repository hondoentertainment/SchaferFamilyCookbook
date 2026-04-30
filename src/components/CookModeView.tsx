import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Recipe } from '../types';
import { scaleIngredients } from '../utils/scaleIngredients';
import { useFocusTrap } from '../utils/focusTrap';
import { useSwipe } from '../utils/useSwipe';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { useUI } from '../context/UIContext';
import { addActivity } from '../utils/activityFeed';
import { trackEvent } from '../services/analytics';
import { subscribeToPushNotifications } from '../services/pushNotifications';
import { STORAGE_KEYS } from '../constants/storage';

const SWIPE_HINT_KEY = 'cookMode.swipeHintSeen';
const NOTIFY_NUDGE_DISMISSED_KEY = 'cook-notify-nudge-dismissed-v1';

interface CookModeViewProps {
    recipe: Recipe;
    onClose: () => void;
}

/** Read the logged-in user's display name from localStorage. */
function getCurrentUserName(): string {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.user);
        if (!raw) return 'Someone';
        const parsed = JSON.parse(raw) as { name?: string };
        return parsed?.name?.trim() || 'Someone';
    } catch {
        return 'Someone';
    }
}

/** Detect mobile UA so we know whether the `sms:` URL scheme is likely to open. */
function isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}

async function cacheRecipeImage(imageUrl: string): Promise<'saved' | 'already' | 'unsupported'> {
    if (!('caches' in window)) return 'unsupported';
    const cache = await caches.open('recipe-images-cache');
    const existing = await cache.match(imageUrl);
    if (!existing && imageUrl) {
        await cache.add(imageUrl);
        return 'saved';
    }
    return 'already';
}

export const CookModeView: React.FC<CookModeViewProps> = ({ recipe, onClose }) => {
    const { toast } = useUI();
    const [stepIndex, setStepIndex] = useState(0);
    const [scaleTo, setScaleTo] = useState(typeof recipe.servings === 'number' ? recipe.servings : 4);
    const [imageCached, setImageCached] = useState<boolean | null>(null); // null = unknown
    const [isOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
    const [isComplete, setIsComplete] = useState(false);
    const [showNotifyNudge, setShowNotifyNudge] = useState<boolean>(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return false;
        try {
            if (Notification.permission !== 'default') return false;
            return !localStorage.getItem(NOTIFY_NUDGE_DISMISSED_KEY);
        } catch {
            return false;
        }
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const completionLoggedRef = useRef(false);
    const [showSwipeHint, setShowSwipeHint] = useState<boolean>(() => {
        try {
            return typeof localStorage !== 'undefined' && !localStorage.getItem(SWIPE_HINT_KEY);
        } catch {
            return false;
        }
    });

    const hasImage = !!recipe.image;
    const baseServings = typeof recipe.servings === 'number' ? recipe.servings : 4;
    const scaleFactor = baseServings > 0 ? scaleTo / baseServings : 1;
    const ingredients = scaleIngredients(recipe.ingredients, scaleFactor);
    const steps = recipe.instructions || [];
    const totalSteps = 1 + steps.length;
    const currentStep = stepIndex === 0 ? null : steps[stepIndex - 1];
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === totalSteps - 1;

    const dismissSwipeHint = useCallback(() => {
        setShowSwipeHint(false);
        try {
            localStorage.setItem(SWIPE_HINT_KEY, '1');
        } catch {
            /* localStorage unavailable — ignore */
        }
    }, []);

    const goPrev = useCallback(() => {
        if (!isFirst) setStepIndex((i) => i - 1);
    }, [isFirst]);
    const goNext = useCallback(() => {
        if (!isLast) setStepIndex((i) => i + 1);
    }, [isLast]);

    const onSwipeNext = useCallback(() => {
        if (isLast) return;
        setStepIndex((i) => i + 1);
        hapticLight();
        dismissSwipeHint();
    }, [isLast, dismissSwipeHint]);
    const onSwipePrev = useCallback(() => {
        if (isFirst) return;
        setStepIndex((i) => i - 1);
        hapticLight();
        dismissSwipeHint();
    }, [isFirst, dismissSwipeHint]);

    const swipeHandlers = useSwipe({
        onSwipeLeft: onSwipeNext,
        onSwipeRight: onSwipePrev,
        threshold: 50,
    });

    useFocusTrap(true, containerRef);

    useEffect(() => {
        if (containerRef.current) containerRef.current.focus();
    }, [stepIndex]);

    // Wake lock: keep screen on during cook mode
    useEffect(() => {
        let wakeLock: { release: () => Promise<void> } | null = null;
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await (navigator as any).wakeLock.request('screen');
                }
            } catch {
                toast('Could not keep screen awake. Your device may lock during cooking.', 'info');
            }
        };
        requestWakeLock();
        return () => {
            wakeLock?.release?.();
        };
    }, [toast]);

    // On mount: check cache status and auto-cache the image
    useEffect(() => {
        if (!hasImage || !recipe.image) return;
        if (!('caches' in window)) {
            setImageCached(false);
            return;
        }
        const imageUrl = recipe.image;
        const run = async () => {
            try {
                const cache = await caches.open('recipe-images-cache');
                const existing = await cache.match(imageUrl);
                if (existing) {
                    setImageCached(true);
                } else {
                    // Auto-cache when Cook Mode opens
                    await cache.add(imageUrl);
                    setImageCached(true);
                }
            } catch {
                setImageCached(false);
            }
        };
        run();
    }, [hasImage, recipe.image]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (isComplete) return;
            if (e.key === 'ArrowLeft') goPrev();
            if (e.key === 'ArrowRight') goNext();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, goPrev, goNext, isComplete]);

    // Log "recipe_cooked" activity + analytics once when celebration first shows.
    useEffect(() => {
        if (!isComplete || completionLoggedRef.current) return;
        completionLoggedRef.current = true;
        try {
            addActivity('recipe_cooked', getCurrentUserName(), `cooked "${recipe.title}"`);
        } catch {
            /* activity feed is best-effort */
        }
        try {
            trackEvent('cook_completed', { recipeId: recipe.id });
        } catch {
            /* analytics is fire-and-forget */
        }
        hapticSuccess();
    }, [isComplete, recipe.id, recipe.title]);

    const handleFinishCook = useCallback(() => {
        hapticLight();
        setIsComplete(true);
    }, []);

    const thankYouMessage = `Just made your ${recipe.title} from the Schafer Cookbook — thank you! ❤️`;

    const handleShareThanks = useCallback(async () => {
        try {
            trackEvent('cook_share', { recipeId: recipe.id, contributor: recipe.contributor });
        } catch {
            /* ignore */
        }
        const smsUrl = `sms:?body=${encodeURIComponent(thankYouMessage)}`;
        const mobile = isMobileDevice();
        if (mobile) {
            try {
                window.location.href = smsUrl;
                return;
            } catch {
                /* fall through to clipboard */
            }
        }
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(thankYouMessage);
                toast('Thank-you note copied — paste it anywhere to share', 'success');
                return;
            }
        } catch {
            /* fall through */
        }
        toast('Could not open Messages — try copying the recipe link instead', 'info');
    }, [recipe.id, recipe.contributor, thankYouMessage, toast]);

    const handleEnableNotifications = useCallback(async () => {
        try {
            const ok = await subscribeToPushNotifications(getCurrentUserName());
            if (ok) {
                toast('Notifications on', 'success');
                setShowNotifyNudge(false);
                try {
                    trackEvent('cook_notify_enabled', { recipeId: recipe.id });
                } catch {
                    /* ignore */
                }
            } else {
                toast('Could not enable notifications', 'info');
            }
        } catch {
            toast('Could not enable notifications', 'error');
        }
    }, [recipe.id, toast]);

    const handleDismissNudge = useCallback(() => {
        setShowNotifyNudge(false);
        try {
            localStorage.setItem(NOTIFY_NUDGE_DISMISSED_KEY, '1');
        } catch {
            /* localStorage unavailable */
        }
    }, []);


    const handleSaveForOffline = async () => {
        if (!recipe.image) return;
        if (!('caches' in window)) {
            toast('Offline saving not supported on this browser', 'info');
            return;
        }
        try {
            const result = await cacheRecipeImage(recipe.image);
            if (result === 'saved') {
                setImageCached(true);
                toast('Recipe saved for offline use', 'success');
            } else if (result === 'already') {
                toast('Already saved', 'info');
            } else {
                toast('Offline saving not supported on this browser', 'info');
            }
        } catch {
            toast('Could not save recipe for offline use', 'error');
        }
    };

    const showOfflineImageWarning = hasImage && isOffline && imageCached === false;


    if (isComplete) {
        const longTitle = recipe.title.length > 30;
        const headline = longTitle ? "That's a wrap." : `You cooked ${recipe.title}!`;
        const totalTime = [recipe.prepTime, recipe.cookTime].filter(Boolean).join(' + ');
        const contributorLabel = recipe.contributor?.trim() || 'them';
        const buttonLabel = `Text ${contributorLabel} thanks`;

        return (
            <div
                ref={containerRef}
                tabIndex={0} // eslint-disable-line jsx-a11y/no-noninteractive-tabindex -- Celebration view keeps focus for keyboard escape
                role="application"
                className="fixed inset-0 z-[150] bg-gradient-to-b from-cream to-paper text-ink flex flex-col items-stretch overflow-y-auto focus:outline-none pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
                aria-label={`Cook mode complete: ${recipe.title}.`}
                data-testid="cook-complete-view"
            >
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:px-12 md:py-16">
                    <div className="max-w-xl w-full text-center space-y-8 animate-fade-slide-in motion-reduce:animate-none">
                        <div className="flex justify-center" aria-hidden="true">
                            <span className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[#F4A460]/25 text-5xl shadow-inner">
                                🎉
                            </span>
                        </div>

                        <h1 className="font-serif italic text-4xl md:text-5xl leading-tight text-brand-ink dark:text-white break-words">
                            {headline}
                        </h1>

                        <p className="text-sm md:text-base uppercase tracking-[0.25em] text-ink-soft">
                            Step {totalSteps} of {totalSteps}
                            {totalTime ? <span aria-hidden="true"> · {totalTime} total</span> : null}
                            {totalTime ? <span className="sr-only"> &mdash; total time {totalTime}</span> : null}
                        </p>

                        {recipe.contributor && (
                            <p className="text-base md:text-lg text-ink-soft">
                                Thanks to{' '}
                                <span className="font-semibold text-brand">{recipe.contributor}</span>{' '}
                                for the recipe.
                            </p>
                        )}

                        <div className="flex flex-col md:flex-row md:justify-center gap-3 md:gap-4 pt-2">
                            <button
                                type="button"
                                onClick={handleShareThanks}
                                data-testid="cook-complete-share"
                                aria-label={`Text ${contributorLabel} a thank-you message`}
                                className="min-h-[3rem] px-6 py-3 rounded-full bg-brand text-white font-bold text-sm uppercase tracking-widest shadow-md hover:bg-brand-soft active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-brand-soft focus:ring-offset-2 focus:ring-offset-cream touch-manipulation"
                            >
                                <span aria-hidden="true">💬 </span>
                                {buttonLabel}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Rate this recipe"
                                data-testid="cook-complete-rate"
                                className="min-h-[3rem] px-6 py-3 rounded-full bg-white text-brand border border-brand/20 font-bold text-sm uppercase tracking-widest shadow-sm hover:bg-cream active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 focus:ring-offset-cream touch-manipulation"
                            >
                                <span aria-hidden="true">★ </span>
                                Rate this recipe
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Done"
                                data-testid="cook-complete-done"
                                className="min-h-[3rem] px-6 py-3 rounded-full text-ink-soft font-semibold text-sm uppercase tracking-widest underline-offset-4 hover:underline hover:text-brand transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 focus:ring-offset-cream"
                            >
                                Done
                            </button>
                        </div>

                        {showNotifyNudge && (
                            <div
                                role="region"
                                aria-label="Enable notifications nudge"
                                data-testid="cook-complete-notify-nudge"
                                className="mt-8 mx-auto max-w-md rounded-2xl border border-brand/15 bg-white/70 backdrop-blur-sm p-5 text-left shadow-sm animate-fade-slide-in motion-reduce:animate-none"
                            >
                                <div className="flex items-start gap-3">
                                    <span aria-hidden="true" className="text-2xl mt-0.5">🔔</span>
                                    <div className="flex-1">
                                        <p className="font-serif italic text-lg text-brand-ink">
                                            Want a heads-up when new recipes drop?
                                        </p>
                                        <p className="text-sm text-ink-soft mt-1">
                                            Get a notification when family adds a new dish or photo.
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            <button
                                                type="button"
                                                onClick={handleEnableNotifications}
                                                data-testid="cook-complete-notify-yes"
                                                className="min-h-11 px-4 py-2 rounded-full bg-brand text-white text-xs font-bold uppercase tracking-widest hover:bg-brand-soft active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-brand-soft focus:ring-offset-2 focus:ring-offset-white touch-manipulation"
                                            >
                                                Yes, notify me
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleDismissNudge}
                                                data-testid="cook-complete-notify-dismiss"
                                                className="min-h-11 px-4 py-2 rounded-full bg-transparent text-ink-soft text-xs font-bold uppercase tracking-widest hover:text-brand hover:bg-cream transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 focus:ring-offset-white touch-manipulation"
                                            >
                                                Not now
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            tabIndex={0} // eslint-disable-line jsx-a11y/no-noninteractive-tabindex -- Cook mode needs focus for keyboard nav (arrow keys)
            role="application"
            className="fixed inset-0 z-[150] bg-[#2D4635] text-white flex flex-col items-stretch overflow-hidden focus:outline-none pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
            aria-label={`Cook mode: ${recipe.title}. Swipe left for next, right for previous.`}
        >
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-white/10 shrink-0">
                <button
                    onClick={onClose}
                    className="w-12 h-12 min-w-[3rem] min-h-[3rem] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    aria-label="Exit cook mode"
                >
                    ✕
                </button>
                <div className="flex-1 text-center min-w-0">
                    <h1 className="font-serif italic text-lg md:text-xl truncate">{recipe.title}</h1>
                    <p className="text-[10px] uppercase tracking-widest text-white/60">
                        Step {stepIndex + 1} of {totalSteps}
                    </p>
                </div>
                {hasImage ? (
                    <button
                        onClick={handleSaveForOffline}
                        className="w-12 h-12 min-w-[3rem] min-h-[3rem] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                        aria-label={imageCached ? 'Recipe image already saved for offline use' : 'Save recipe for offline use'}
                        title={imageCached ? 'Saved for offline' : 'Save for offline'}
                    >
                        {imageCached ? '✓' : '⬇'}
                    </button>
                ) : (
                    <div className="w-12" aria-hidden />
                )}
            </header>

            {showSwipeHint && (
                <div
                    className="shrink-0 bg-[#F4A460]/15 text-[#F4A460] text-xs text-center py-2 px-4 md:hidden flex items-center justify-center gap-3 border-b border-[#F4A460]/20"
                    role="status"
                    aria-live="polite"
                >
                    <span>Tip: Swipe left/right to navigate</span>
                    <button
                        type="button"
                        onClick={dismissSwipeHint}
                        className="text-[#F4A460]/80 hover:text-[#F4A460] underline text-xs"
                        aria-label="Dismiss swipe tip"
                    >
                        Got it
                    </button>
                </div>
            )}

            {/* Step 0: Ingredients */}
            {stepIndex === 0 ? (
                <div
                    className="flex-1 overflow-y-auto px-6 py-8 md:px-12 md:py-12"
                    {...swipeHandlers}
                >
                    <div className="max-w-2xl mx-auto space-y-6">
                        <h2 className="text-2xl md:text-3xl font-serif italic text-[#F4A460] mb-6">
                            Ingredients
                        </h2>

                        {/* Offline image warning */}
                        {showOfflineImageWarning && (
                            <div
                                role="note"
                                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-200 text-sm"
                            >
                                <span aria-hidden="true">⚠</span>
                                <span>Images may not load offline</span>
                            </div>
                        )}

                        {baseServings > 0 && (
                            <div className="mb-6">
                                <label htmlFor="cook-scale" className="text-sm text-white/80 mr-2">
                                    Servings:
                                </label>
                                <select
                                    id="cook-scale"
                                    value={scaleTo}
                                    onChange={(e) => setScaleTo(parseInt(e.target.value, 10))}
                                    className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white font-medium"
                                >
                                    {[1, 2, 4, 6, 8, 10, 12, baseServings]
                                        .filter((n, i, arr) => arr.indexOf(n) === i)
                                        .sort((a, b) => a - b)
                                        .map((n) => (
                                            <option key={n} value={n} className="text-stone-800">
                                                {n}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        )}
                        <ul className="space-y-3 text-lg md:text-xl leading-relaxed">
                            {ingredients.map((ing, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="text-[#F4A460]">•</span>
                                    <span>{ing}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="text-white/60 text-sm mt-8">Swipe or tap Next to begin cooking.</p>
                    </div>
                </div>
            ) : currentStep ? (
                <div
                    className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:px-12 touch-pan-y"
                    {...swipeHandlers}
                >
                    <div className="max-w-2xl w-full text-center">
                        <div className="mb-8 flex justify-center">
                            <span className="w-20 h-20 rounded-full bg-[#F4A460]/20 flex items-center justify-center text-4xl font-serif font-bold text-[#F4A460]">
                                {stepIndex}
                            </span>
                        </div>
                        <p className="text-xl md:text-3xl font-serif italic leading-relaxed">
                            {currentStep}
                        </p>
                        <p className="text-white/30 text-xs mt-6 md:hidden">← swipe →</p>
                    </div>
                </div>
            ) : null}

            {/* Bottom nav */}
            <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 md:px-12 md:py-6 border-t border-white/10 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
                <button
                    onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                    disabled={isFirst}
                    className={`min-h-[3.5rem] min-w-[3.5rem] px-6 rounded-full font-bold uppercase tracking-widest text-sm transition-all ${
                        isFirst
                            ? 'opacity-30 cursor-not-allowed'
                            : 'bg-white/20 hover:bg-white/30 active:scale-95'
                    }`}
                    aria-label="Previous step"
                >
                    ← Prev
                </button>
                <span className="text-white/60 text-xs uppercase tracking-widest">
                    {stepIndex + 1} / {totalSteps}
                </span>
                {isLast ? (
                    <button
                        onClick={handleFinishCook}
                        className="min-h-[3.5rem] min-w-[3.5rem] px-6 rounded-full font-bold uppercase tracking-widest text-sm transition-all bg-[#F4A460] text-[#2D4635] hover:bg-[#F4A460]/90 active:scale-95"
                        aria-label="Done cooking"
                        data-testid="cook-mode-finish"
                    >
                        Done ✓
                    </button>
                ) : (
                    <button
                        onClick={() => setStepIndex((i) => i + 1)}
                        className="min-h-[3.5rem] min-w-[3.5rem] px-6 rounded-full font-bold uppercase tracking-widest text-sm transition-all bg-[#F4A460] text-[#2D4635] hover:bg-[#F4A460]/90 active:scale-95"
                        aria-label="Next step"
                    >
                        Next →
                    </button>
                )}
            </div>
        </div>
    );
};
