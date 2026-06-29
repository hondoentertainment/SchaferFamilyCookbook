import React, { useState } from 'react';
import type { Recipe } from '../types';
import { CATEGORY_META } from '../constants/taxonomy';
import { isValidRecipeImageUrl, isCookbookCoverImage } from '../utils/recipeImage';

interface RecipeImageFallbackProps {
    category: Recipe['category'];
    label?: string;
    compact?: boolean;
}

/**
 * Canonical "no image / failed to load" placeholder. Shared by every recipe
 * card and hero so the broken state looks identical across the whole app.
 */
export const RecipeImageFallback: React.FC<RecipeImageFallbackProps> = ({
    category,
    label = 'Image unavailable',
    compact = false,
}) => (
    <div className="absolute inset-0 overflow-hidden bg-[#2D4635]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(244,164,96,0.35),transparent_32%),radial-gradient(circle_at_75%_80%,rgba(16,185,129,0.22),transparent_36%)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D4635]/95 via-[#2D4635]/78 to-[#A0522D]/82" />
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(135deg,#fff_0_1px,transparent_1px_18px)]" aria-hidden="true" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
            <span className={`${compact ? 'text-3xl' : 'text-5xl md:text-6xl'} mb-3 drop-shadow-lg`} aria-hidden="true">
                {CATEGORY_META[category]?.icon || CATEGORY_META.Generic.icon}
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

interface RecipeImageProps {
    recipe: Recipe;
    /** Extra classes applied to the <img> (e.g. hover transforms). */
    imgClassName?: string;
    /** Responsive `sizes` hint for the browser. */
    sizes?: string;
    /** Load eagerly with high fetch priority (above-the-fold cards/heroes). */
    eager?: boolean;
    /** Render the compact fallback (no label badge) when the image is missing. */
    compact?: boolean;
    /** Called once when the image fails to load (e.g. to surface a toast). */
    onError?: () => void;
    /** Override the fallback badge label. */
    fallbackLabel?: string;
    /** Show category art instead of the photo (e.g. handwritten card scans in grids). */
    preferCategoryFallback?: boolean;
}

/**
 * Single source of truth for rendering a recipe's photo inside a positioned
 * (relative) frame. The frame owns the aspect ratio + overflow; this component
 * fills it (`absolute inset-0`), handles the loading skeleton, fade-in,
 * cover-vs-contain matting, and the shared broken-state fallback.
 */
export const RecipeImage: React.FC<RecipeImageProps> = ({
    recipe,
    imgClassName = '',
    sizes,
    eager = false,
    compact = false,
    onError,
    fallbackLabel,
    preferCategoryFallback = false,
}) => {
    const [broken, setBroken] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const hasValidImage = isValidRecipeImageUrl(recipe.image) && !broken && !preferCategoryFallback;
    const isCover = isCookbookCoverImage(recipe);

    const handleError = () => {
        setBroken(true);
        onError?.();
    };

    if (!hasValidImage) {
        return <RecipeImageFallback category={recipe.category} compact={compact} label={fallbackLabel ?? (preferCategoryFallback ? 'Recipe card' : undefined)} />;
    }

    const fitClasses = isCover ? 'object-contain p-2.5 sm:p-3' : 'object-cover';

    return (
        <>
            <div className={isCover ? 'absolute inset-0 bg-[#203629]' : 'absolute inset-0 bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300'} />
            {!loaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-stone-200 via-stone-100 to-stone-300 animate-pulse" />
            )}
            {isCover && (
                <div className="pointer-events-none absolute inset-2 rounded-[1.35rem] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]" aria-hidden="true" />
            )}
            <img
                src={recipe.image}
                width={800}
                height={600}
                sizes={sizes}
                className={`absolute inset-0 h-full w-full transition-[opacity,transform] duration-500 ${fitClasses} ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={eager ? 'high' : undefined}
                decoding="async"
                alt={recipe.title}
                onLoad={() => setLoaded(true)}
                onError={handleError}
            />
        </>
    );
};

export default RecipeImage;
