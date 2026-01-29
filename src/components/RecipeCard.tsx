import React, { memo } from 'react';
import { Recipe } from '../types';

interface RecipeCardProps {
    recipe: Recipe;
    onClick: (recipe: Recipe) => void;
    avatarUrl: string;
}

export const RecipeCard = memo<RecipeCardProps>(({ recipe, onClick, avatarUrl }) => {
    return (
        <div
            onClick={() => onClick(recipe)}
            className="group cursor-pointer relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-stone-200 shadow-md hover:shadow-2xl transition-all duration-500"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    onClick(recipe);
                }
            }}
        >
            {/* Image or Fallback Gradient */}
            {recipe.image ? (
                <img
                    src={recipe.image}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                    alt={recipe.title}
                    onError={(e) => {
                        // Fallback if image fails
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement?.classList.add('fallback-gradient');
                    }}
                />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#2D4635] to-[#A0522D] opacity-80" />
            )}

            <div className="absolute inset-0 bg-gradient-to-br from-[#2D4635]/20 to-[#A0522D]/20 group-[.fallback-gradient]:from-[#2D4635] group-[.fallback-gradient]:to-[#A0522D]" />

            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-6 flex flex-col justify-end">
                <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                    <div className="flex justify-between items-center mb-2 opacity-80">
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-200">{recipe.category}</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-serif italic text-white leading-none mb-1 shadow-black drop-shadow-md">{recipe.title}</h3>
                    <p className="text-[10px] text-stone-300 uppercase tracking-widest mt-2 opacity-0 group-hover:opacity-100 transition-opacity delay-100 flex items-center gap-1">
                        By <img src={avatarUrl} className="w-4 h-4 rounded-full inline-block" alt="" /> {recipe.contributor}
                    </p>
                </div>
            </div>
        </div>
    );
});

RecipeCard.displayName = 'RecipeCard';
