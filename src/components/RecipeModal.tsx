import React, { useState, useEffect, useRef } from 'react';
import { Recipe } from '../types';
import { CATEGORY_IMAGES } from '../constants';

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
}

export const RecipeModal: React.FC<RecipeModalProps> = ({ recipe, onClose }) => {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const lightboxCloseRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        closeButtonRef.current?.focus();
    }, []);

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
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    if (!recipe) return null;

    return (
        <>
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

            <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8" role="dialog" aria-modal="true" aria-label="Recipe details">
                <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
                <div className="bg-[#FDFBF7] w-full md:max-w-5xl h-full md:h-auto md:max-h-[90vh] md:rounded-[3rem] overflow-hidden shadow-2xl relative animate-in fade-in slide-in-from-bottom-10 md:zoom-in-95 duration-500 flex flex-col md:flex-row">
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10 flex gap-2">
                        <button ref={closeButtonRef} onClick={onClose} className="w-12 h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110" aria-label="Close recipe">
                            <span className="text-xl font-light">✕</span>
                        </button>
                    </div>

                    <div
                        className="w-full md:w-1/2 h-64 md:h-auto relative cursor-zoom-in group"
                        onClick={() => recipe.image && setLightboxOpen(true)}
                    >
                        {recipe.image ? (
                            <img src={recipe.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={recipe.title} />
                        ) : (
                            <div className="w-full h-full relative overflow-hidden">
                                {/* Category-specific background image */}
                                <img
                                    src={CATEGORY_IMAGES[recipe.category] || CATEGORY_IMAGES.Generic}
                                    className="w-full h-full object-cover opacity-40"
                                    alt={recipe.category}
                                />
                                {/* Overlay gradient */}
                                <div className="absolute inset-0 bg-gradient-to-br from-[#2D4635]/80 via-[#2D4635]/60 to-[#A0522D]/70" />

                                {/* Centered content */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 p-8">
                                    <span className="text-6xl mb-4 drop-shadow-lg">
                                        {CATEGORY_ICONS[recipe.category] || '🍽️'}
                                    </span>
                                    <span className="text-sm font-serif italic opacity-80">{recipe.category}</span>
                                    <div className="mt-6 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                                        <span className="text-[9px] font-black uppercase tracking-widest">📷 Heritage Photo Coming Soon</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent md:hidden" />

                        {/* Interactive Overlay - only show if image exists */}
                        {recipe.image && (
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center gap-2">
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-stone-800 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg pointer-events-none">
                                    🔍 Enlarge
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 space-y-8 pb-12">
                        {/* Header Section */}
                        <div className="space-y-3">
                            <span className="inline-block text-[10px] font-black uppercase text-[#A0522D] tracking-widest bg-[#A0522D]/10 px-3 py-1 rounded-full">{recipe.category}</span>
                            <h2 className="text-3xl md:text-4xl font-serif italic text-[#2D4635] leading-tight">{recipe.title}</h2>
                            <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase text-stone-400 tracking-widest pt-2">
                                <span className="flex items-center gap-1.5">
                                    <span className="text-[#A0522D]">👤</span>
                                    <span>By {recipe.contributor}</span>
                                </span>
                                {(recipe.prepTime || recipe.cookTime || recipe.calories) && (
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
                        <div className="space-y-4 bg-white/50 p-6 rounded-2xl border border-stone-200/50">
                            <h3 className="text-xl font-serif italic text-[#2D4635] flex items-center gap-2">
                                <span className="text-2xl">🥘</span>
                                <span>Ingredients</span>
                            </h3>
                            <ul className="space-y-3 pl-2">
                                {recipe.ingredients.map((ing, i) => (
                                    <li key={i} className="text-sm md:text-base text-stone-700 flex items-start gap-3 leading-relaxed group hover:text-[#2D4635] transition-colors">
                                        <span className="text-[#A0522D] mt-2 w-2 h-2 rounded-full bg-[#A0522D]/30 shrink-0 group-hover:bg-[#A0522D] transition-colors" />
                                        <span className="flex-1">{ing}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Instructions Section */}
                        <div className="space-y-5">
                            <h3 className="text-xl font-serif italic text-[#2D4635] flex items-center gap-2 pb-2 border-b border-stone-200">
                                <span className="text-2xl">📝</span>
                                <span>Instructions</span>
                            </h3>
                            <div className="space-y-6">
                                {recipe.instructions.map((step, i) => (
                                    <div key={i} className="flex gap-4 group hover:bg-white/50 p-4 rounded-xl transition-all -ml-4">
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
                            <div className="bg-gradient-to-br from-[#2D4635]/5 to-[#A0522D]/5 p-6 md:p-8 rounded-3xl border border-[#2D4635]/10 shadow-inner">
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
                </div>
            </div>
        </>
    );
};

