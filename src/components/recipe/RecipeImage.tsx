import React, { useRef } from 'react';
import { Recipe } from '../../types';
import { useFocusTrap } from '../../utils/focusTrap';
import { hapticLight } from '../../utils/haptics';

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

interface RecipeImageProps {
    recipe: Recipe;
    imageLoading: boolean;
    onImageLoad: () => void;
    imageBroken: boolean;
    onImageError: () => void;
    isAIGenerated: boolean;
    hasValidImage: boolean;
    lightboxOpen: boolean;
    onLightboxOpen: () => void;
    onLightboxClose: () => void;
}

export const RecipeImage: React.FC<RecipeImageProps> = ({
    recipe,
    imageLoading,
    onImageLoad,
    imageBroken,
    onImageError,
    isAIGenerated,
    hasValidImage,
    lightboxOpen,
    onLightboxOpen,
    onLightboxClose,
}) => {
    const lightboxCloseRef = useRef<HTMLButtonElement>(null);
    const lightboxRef = useRef<HTMLDivElement>(null);

    useFocusTrap(lightboxOpen, lightboxRef);

    return (
        <>
            {lightboxOpen && (
                <div
                    ref={lightboxRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Enlarged recipe image"
                    className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300 cursor-zoom-out pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
                    onClick={() => onLightboxClose()}
                >
                    <button
                        ref={lightboxCloseRef}
                        onClick={() => { hapticLight(); onLightboxClose(); }}
                        className="absolute top-[max(1.5rem,env(safe-area-inset-top))] right-[max(1.5rem,env(safe-area-inset-right))] w-12 h-12 min-w-11 min-h-11 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-2xl transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                        aria-label="Close enlarged image"
                        title="Close"
                    >
                        ✕
                    </button>
                    <img
                        src={recipe.image}
                        width={800}
                        height={600}
                        className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-105 duration-500"
                        alt={recipe.title}
                    />
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-xs uppercase tracking-widest">
                        Click anywhere to close
                    </div>
                </div>
            )}

            <div
                className={`w-full md:w-1/2 h-64 md:min-h-[400px] md:aspect-[4/3] relative cursor-zoom-in group ${hasValidImage ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2' : ''}`}
                onClick={() => hasValidImage && onLightboxOpen()}
                onKeyDown={(e) => {
                    if (hasValidImage && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onLightboxOpen();
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
                            onLoad={onImageLoad}
                            onError={onImageError}
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
        </>
    );
};
