import React, { useState } from 'react';
import type { Recipe } from '../types';
import { useUI } from '../context/UIContext';
import { shouldToastImageError } from '../utils/imageErrorToast';
import { CATEGORY_META } from '../constants/taxonomy';

export const isValidImageUrl = (url: string): boolean =>
    !!url && (url.startsWith('/recipe-images/') || url.startsWith('http://') || url.startsWith('https://'));

export const isCookbookCoverImage = (recipe: Recipe): boolean =>
    recipe.imageSource === 'local-generated';

interface RecipeImageFallbackProps {
    category: Recipe['category'];
    label?: string;
    compact?: boolean;
}

export const RecipeImageFallback: React.FC<RecipeImageFallbackProps> = ({
    category,
    label = 'Image unavailable',
    compact = false,
}) => (
    <div className="absolute inset-0 overflow-hidden bg-[var(--color-brand)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(244,164,96,0.35),transparent_32%),radial-gradient(circle_at_75%_80%,rgba(16,185,129,0.22),transparent_36%)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand)]/95 via-[var(--color-brand)]/78 to-[#A0522D]/82" />
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

export const RecipeCardImage: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
    const [broken, setBroken] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const { toast } = useUI();
    const hasValidImage = isValidImageUrl(recipe.image) && !broken;
    const isCover = isCookbookCoverImage(recipe);
    const imageClassName = isCover
        ? `absolute inset-0 h-full w-full object-contain p-2.5 transition-opacity duration-500 sm:p-3 ${loaded ? 'opacity-100' : 'opacity-0'}`
        : `absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`;

    const handleImageError = () => {
        setBroken(true);
        if (shouldToastImageError(recipe.id)) {
            toast("Some recipe images couldn't load. Check your connection and refresh.", 'info');
        }
    };

    if (hasValidImage) {
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
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 380px"
                    className={imageClassName}
                    loading="lazy"
                    decoding="async"
                    alt={recipe.title}
                    onLoad={() => setLoaded(true)}
                    onError={handleImageError}
                />
            </>
        );
    }

    return <RecipeImageFallback category={recipe.category} label="Image unavailable" />;
};

export const HeroRecipeImage: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
    const [broken, setBroken] = useState(false);
    if (!isValidImageUrl(recipe.image) || broken) {
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
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-brand)] via-[var(--color-brand)]/90 to-[var(--color-brand)]/58" />
        </>
    );
};
