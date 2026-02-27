import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Recipe } from '../types';
import { buildRecipeSchema } from '../utils/recipeSchema';
import { siteConfig } from '../config/site';
import { useUI } from '../context/UIContext';
import { shouldToastImageError } from '../utils/imageErrorToast';
import { useFocusTrap } from '../utils/focusTrap';
import { scaleIngredients } from '../utils/scaleIngredients';
import { addFromRecipe } from '../utils/groceryList';

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
}

const SCROLL_THRESHOLD = 200;

export const RecipeModal: React.FC<RecipeModalProps> = ({
    recipe,
    onClose,
    recipeList = [],
    onNavigate,
    isFavorite,
    onToggleFavorite,
    onStartCook,
}) => {
    const { toast } = useUI();
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [showScrollToTop, setShowScrollToTop] = useState(false);
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
    const modalRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [imageBroken, setImageBroken] = useState(false);
    const hasValidImage =
        !!recipe?.image &&
        !imageBroken &&
        (recipe.image.startsWith('/recipe-images/') || recipe.image.startsWith('http://') || recipe.image.startsWith('https://'));
    const isAIGenerated =
        recipe?.imageSource === 'imagen' ||
        (recipe?.imageSource == null && !!recipe?.image?.includes?.('pollinations.ai'));

    useFocusTrap(true, modalRef);

    useEffect(() => {
        closeButtonRef.current?.focus();
    }, []);

    // Esc: close lightbox first when open, otherwise close modal
    useEffect(() => {
        if (!lightboxOpen) return;
        lightboxCloseRef.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightboxOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [lightboxOpen]);

    useEffect(() => {
        if (lightboxOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [lightboxOpen, onClose]);

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
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }, [recipe?.id, recipe?.servings]);

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

    const handleShare = async () => {
        const doCopy = async () => {
            try {
                await navigator.clipboard.writeText(shareUrl);
                toast(`Link copied! Share to open "${recipe.title}" in ${siteConfig.siteName}`, 'success');
            } catch {
                toast('Could not copy link', 'error');
            }
        };
        if (navigator.share) {
            try {
                await navigator.share({
                    title: recipe.title,
                    text: `${recipe.title} from ${siteConfig.siteName}`,
                    url: shareUrl,
                });
                toast('Recipe shared', 'success');
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

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(buildRecipeSchema(recipe)) }}
            />
            {lightboxOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Enlarged recipe image"
                    className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300 cursor-zoom-out"
                    onClick={() => setLightboxOpen(false)}
                >
                    <button
                        ref={lightboxCloseRef}
                        onClick={() => setLightboxOpen(false)}
                        className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-2xl transition-colors"
                        aria-label="Close enlarged image"
                    >
                        ✕
                    </button>
                    <img
                        src={recipe.image}
                        className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500"
                        alt={recipe.title}
                    />
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs uppercase tracking-widest">
                        Click anywhere to close
                    </div>
                </div>
            )}

            <div ref={modalRef} className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8" role="dialog" aria-modal="true" aria-labelledby="recipe-modal-title" aria-label="Recipe details">
                <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
                <div className="print-recipe-content bg-[#FDFBF7] w-full md:max-w-5xl h-full md:h-auto md:max-h-[90vh] md:rounded-[3rem] overflow-hidden shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 md:zoom-in-95 duration-500 flex flex-col md:flex-row">
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10 flex gap-2 print:hidden">
                        {onToggleFavorite && isFavorite && (
                            <button
                                onClick={() => onToggleFavorite(recipe.id)}
                                className={`w-12 h-12 min-w-[3rem] min-h-[3rem] backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 ${
                                    isFavorite(recipe.id)
                                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                        : 'bg-white/95 text-stone-400 hover:text-stone-900 hover:bg-white'
                                }`}
                                aria-label={isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                                title={isFavorite(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <span className="text-xl">{isFavorite(recipe.id) ? '❤️' : '🤍'}</span>
                            </button>
                        )}
                        {prevRecipe && onNavigate && (
                            <button
                                onClick={() => onNavigate(prevRecipe)}
                                className="w-12 h-12 min-w-[3rem] min-h-[3rem] bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110"
                                aria-label={`Previous: ${prevRecipe.title}`}
                                title="Previous recipe"
                            >
                                <span className="text-xl">‹</span>
                            </button>
                        )}
                        {nextRecipe && onNavigate && (
                            <button
                                onClick={() => onNavigate(nextRecipe)}
                                className="w-12 h-12 min-w-[3rem] min-h-[3rem] bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110"
                                aria-label={`Next: ${nextRecipe.title}`}
                                title="Next recipe"
                            >
                                <span className="text-xl">›</span>
                            </button>
                        )}
                        <button onClick={handleShare} className="w-12 h-12 min-w-[3rem] min-h-[3rem] bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110" aria-label="Share recipe" title="Share">
                            <span className="text-xl">⎘</span>
                        </button>
                        {!hasWebShare && (
                            <a
                                href={emailRecipeUrl}
                                className="w-12 h-12 min-w-[3rem] min-h-[3rem] bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110 no-underline"
                                aria-label="Email recipe"
                                title="Email recipe"
                            >
                                <span className="text-xl">✉</span>
                            </a>
                        )}
                        <button onClick={handlePrint} className="w-12 h-12 min-w-[3rem] min-h-[3rem] bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110" aria-label="Print recipe" title="Print">
                            <span className="text-xl">🖨</span>
                        </button>
                        {onStartCook && (
                            <button
                                onClick={onStartCook}
                                className="w-12 h-12 min-w-[3rem] min-h-[3rem] bg-[#2D4635] text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 hover:bg-[#2D4635]/90"
                                aria-label="Start cook mode"
                                title="Cook mode"
                            >
                                <span className="text-xl">👨‍🍳</span>
                            </button>
                        )}
                        <button ref={closeButtonRef} onClick={onClose} className="w-12 h-12 min-w-[3rem] min-h-[3rem] bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110" aria-label="Close recipe" title="Close">
                            <span className="text-xl font-light">✕</span>
                        </button>
                    </div>

                    <div
                        className={`w-full md:w-1/2 h-64 md:h-auto relative cursor-zoom-in group ${hasValidImage ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2' : ''}`}
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
                                <img
                                    src={recipe.image}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    alt={recipe.title}
                                    loading="lazy"
                                    onError={() => {
                                        setImageBroken(true);
                                        if (shouldToastImageError(recipe.id)) {
                                            toast('Image failed to load', 'info');
                                        }
                                    }}
                                />
                                {isAIGenerated && (
                                    <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/50 text-white text-[9px] font-bold uppercase tracking-wider" title="AI-generated from recipe ingredients">✨ AI</span>
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
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent md:hidden" />

                        {/* Interactive Overlay - only show if image exists */}
                        {hasValidImage && (
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center gap-2">
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-stone-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg pointer-events-none">
                                    🔍 Enlarge
                                </span>
                            </div>
                        )}
                    </div>

                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 space-y-8 pb-12"
                    >
                        {/* Header Section */}
                        <div className="space-y-3">
                            <span className="inline-block text-[10px] font-black uppercase text-[#A0522D] tracking-widest bg-[#A0522D]/10 px-3 py-1 rounded-full">{recipe.category}</span>
                            <h2 id="recipe-modal-title" className="text-3xl md:text-4xl font-serif italic text-[#2D4635] leading-tight">{recipe.title}</h2>
                            <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase text-stone-400 tracking-widest pt-2">
                                <span className="flex items-center gap-1.5">
                                    <span className="text-[#A0522D]">👤</span>
                                    <span>By {recipe.contributor}</span>
                                </span>
                                {(recipe.prepTime || recipe.cookTime || recipe.calories || recipe.servings) && (
                                    <>
                                        {recipe.prepTime && (
                                            <span className="flex items-center gap-1.5 text-[#A0522D]">
                                                <span>⏱️</span>
                                                <span>Prep: {recipe.prepTime}</span>
                                            </span>
                                        )}
                                        {recipe.cookTime && (
                                            <span className="flex items-center gap-1.5 text-[#A0522D]">
                                                <span>🔥</span>
                                                <span>Cook: {recipe.cookTime}</span>
                                            </span>
                                        )}
                                        {recipe.servings !== undefined && recipe.servings !== null && (
                                            <span className="flex items-center gap-1.5 text-[#A0522D]">
                                                <span>🥣</span>
                                                <span>Servings: {typeof recipe.servings === 'number' ? recipe.servings : recipe.servings}</span>
                                            </span>
                                        )}
                                        {recipe.calories && (
                                            <span className="flex items-center gap-1.5 text-[#A0522D]">
                                                <span>📊</span>
                                                <span>~{recipe.calories} kcal</span>
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Ingredients Section */}
                        <div className="print-simplify space-y-4 bg-white/50 p-6 rounded-2xl border border-stone-200/50">
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
                                                className="px-3 py-2 rounded-full border border-stone-200 bg-white text-stone-700 font-medium focus:ring-2 focus:ring-[#2D4635]/20"
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
                                        onClick={() => {
                                            const added = addFromRecipe(displayedIngredients, recipe.id, recipe.title);
                                            toast(added > 0 ? `${added} item${added === 1 ? '' : 's'} added to grocery list` : 'All ingredients already in list', added > 0 ? 'success' : 'info');
                                        }}
                                        className="print:hidden shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#2D4635] hover:text-[#A0522D] hover:bg-white/80 rounded-full border border-stone-200 transition-colors"
                                        aria-label="Add ingredients to grocery list"
                                    >
                                        🛒 Add to grocery list
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const text = displayedIngredients.join('\n');
                                            try {
                                                await navigator.clipboard.writeText(text);
                                                toast('Ingredients copied to clipboard', 'success');
                                            } catch {
                                                toast('Could not copy ingredients', 'error');
                                            }
                                        }}
                                        className="print:hidden shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#2D4635] hover:text-[#A0522D] hover:bg-white/80 rounded-full border border-stone-200 transition-colors"
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
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-stone-200">
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
                                                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-[#2D4635] hover:text-white text-stone-600 text-xs font-bold transition-colors"
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
                                    <div key={i} id={`recipe-step-${i}`} className="flex gap-4 group hover:bg-white/50 p-4 rounded-xl transition-all -ml-4 scroll-mt-24">
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
                            <div className="print-simplify bg-gradient-to-br from-[#2D4635]/5 to-[#A0522D]/5 p-6 md:p-8 rounded-3xl border border-[#2D4635]/10 shadow-inner">
                                <div className="flex items-start gap-3 mb-3">
                                    <span className="text-2xl">💭</span>
                                    <span className="font-serif text-lg italic text-[#2D4635]">Heirloom Notes</span>
                                </div>
                                <p className="italic text-stone-600 text-sm md:text-base leading-relaxed pl-9">
                                    {recipe.notes}
                                </p>
                            </div>
                        )}
                    </div>
                    {showScrollToTop && (
                        <button
                            type="button"
                            onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 bg-[#2D4635] text-white text-sm font-medium rounded-full shadow-lg hover:bg-[#2D4635]/90 transition-colors print:hidden"
                            aria-label="Scroll to top"
                        >
                            ↑ Scroll to top
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

