import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Recipe } from '../types';
import { buildRecipeSchema } from '../utils/recipeSchema';
import { siteConfig } from '../config/site';
import { useUI } from '../context/UIContext';
import { shouldToastImageError } from '../utils/imageErrorToast';
import { useFocusTrap } from '../utils/focusTrap';
import { scaleIngredients } from '../utils/scaleIngredients';
import { RecipeImage } from './recipe/RecipeImage';
import { IngredientsSection } from './recipe/IngredientsSection';
import { InstructionsSection } from './recipe/InstructionsSection';
import { RecipeActions } from './recipe/RecipeActions';

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
    breadcrumbContext = 'Recipes',
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
    const modalRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
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
        (recipe?.imageSource == null && !!recipe?.image?.includes?.('pollinations.ai'));

    useFocusTrap(true, modalRef);

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
        setImageLoading(true);
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }, [recipe?.id, recipe?.servings]);

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

    if (!recipe) return null;

    const shareUrl = `${siteConfig.baseUrl}/#recipe/${recipe.id}`;

    const handleShare = async () => {
        const shareTitle = `Open in ${siteConfig.siteName}: ${recipe.title}`;
        const doCopy = async () => {
            try {
                await navigator.clipboard.writeText(shareUrl);
                toast(`Link copied! ${shareTitle}`, 'success');
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

            <RecipeImage
                recipe={recipe}
                imageLoading={imageLoading}
                onImageLoad={() => setImageLoading(false)}
                imageBroken={imageBroken}
                onImageError={() => {
                    setImageLoading(false);
                    setImageBroken(true);
                    if (shouldToastImageError(recipe.id)) {
                        toast('Some recipe images couldn\'t be loaded', 'info');
                    }
                }}
                isAIGenerated={isAIGenerated}
                hasValidImage={hasValidImage}
                lightboxOpen={lightboxOpen}
                onLightboxOpen={() => setLightboxOpen(true)}
                onLightboxClose={() => setLightboxOpen(false)}
            />

            <div ref={modalRef} className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]" role="dialog" aria-modal="true" aria-labelledby="recipe-modal-title" aria-label="Recipe details">
                <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
                <div className="print-recipe-content bg-[#FDFBF7] w-full md:max-w-5xl h-full md:h-auto md:max-h-[90vh] md:rounded-[3rem] overflow-hidden shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 md:zoom-in-95 duration-500 flex flex-col md:flex-row">
                    <button
                        onClick={onClose}
                        className="absolute top-2 left-2 z-10 md:hidden px-4 py-2 bg-white/95 backdrop-blur-sm rounded-full shadow-xl text-[10px] font-black uppercase tracking-widest text-stone-600"
                        aria-label={`Back to ${breadcrumbContext}`}
                    >
                        ← {breadcrumbContext}
                    </button>

                    <RecipeActions
                        recipe={recipe}
                        isFavorite={isFavorite}
                        onToggleFavorite={onToggleFavorite}
                        onStartCook={onStartCook}
                        onPrint={handlePrint}
                        onShare={handleShare}
                        prevRecipe={prevRecipe}
                        nextRecipe={nextRecipe}
                        onNavigate={onNavigate}
                        closeButtonRef={closeButtonRef}
                        onClose={onClose}
                    />

                    <RecipeImage
                        recipe={recipe}
                        imageLoading={imageLoading}
                        onImageLoad={() => setImageLoading(false)}
                        imageBroken={imageBroken}
                        onImageError={() => {
                            setImageLoading(false);
                            setImageBroken(true);
                            if (shouldToastImageError(recipe.id)) {
                                toast('Some recipe images couldn\'t be loaded', 'info');
                            }
                        }}
                        isAIGenerated={isAIGenerated}
                        hasValidImage={hasValidImage}
                        lightboxOpen={lightboxOpen}
                        onLightboxOpen={() => setLightboxOpen(true)}
                        onLightboxClose={() => setLightboxOpen(false)}
                    />

                    <div
                        ref={scrollContainerRef}
                        className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 md:p-12 space-y-8 pb-12"
                    >
                        {/* Header Section */}
                        <div className="space-y-3">
                            <nav aria-label="Breadcrumb" className="text-[10px] text-stone-400 tracking-widest">
                                <span>{breadcrumbContext}</span>
                                <span aria-hidden className="mx-1.5">›</span>
                                <span className="text-stone-600 font-medium">{recipe.title}</span>
                            </nav>
                            <span className="inline-block text-[10px] font-black uppercase text-[#A0522D] tracking-widest bg-[#A0522D]/10 px-3 py-1 rounded-full">{recipe.category}</span>
                            <h2 id="recipe-modal-title" className="text-3xl md:text-4xl font-serif italic text-[#2D4635] leading-tight">{recipe.title}</h2>
                            <div className="flex flex-wrap gap-3 text-xs md:text-[10px] font-black uppercase text-stone-400 tracking-widest pt-2">
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

                        <IngredientsSection
                            ingredients={displayedIngredients}
                            baseServings={baseServings}
                            scaleTo={scaleTo}
                            onScaleChange={setScaleTo}
                            scaleFlash={scaleFlash}
                        />

                        <InstructionsSection
                            instructions={recipe.instructions}
                            onStartCook={onStartCook}
                        />

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
