import React from 'react';
import { Recipe } from '../../types';
import { siteConfig } from '../../config/site';
import { useUI } from '../../context/UIContext';

interface RecipeActionsProps {
    recipe: Recipe;
    isFavorite?: (id: string) => boolean;
    onToggleFavorite?: (id: string) => void;
    onStartCook?: () => void;
    onPrint: () => void;
    onShare: () => void;
    prevRecipe: Recipe | null;
    nextRecipe: Recipe | null;
    onNavigate?: (recipe: Recipe) => void;
    closeButtonRef: React.RefObject<HTMLButtonElement | null>;
    onClose: () => void;
}

export const RecipeActions: React.FC<RecipeActionsProps> = ({
    recipe,
    isFavorite,
    onToggleFavorite,
    onStartCook,
    onPrint,
    onShare,
    prevRecipe,
    nextRecipe,
    onNavigate,
    closeButtonRef,
    onClose,
}) => {
    const { toast } = useUI();
    const shareUrl = `${siteConfig.baseUrl}/#recipe/${recipe.id}`;
    const hasWebShare = typeof navigator !== 'undefined' && navigator.share;
    const shareTitle = `Open in ${siteConfig.siteName}: ${recipe.title}`;

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

    return (
        <div className="absolute top-2 right-2 md:top-6 md:right-6 z-10 flex flex-wrap justify-end gap-1.5 md:gap-2 max-w-[calc(100%-1rem)] print:hidden">
            {onToggleFavorite && isFavorite && (
                <button
                    onClick={() => onToggleFavorite(recipe.id)}
                    className={`w-10 h-10 md:w-12 md:h-12 min-w-11 min-h-11 md:min-w-12 md:min-h-12 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 ${
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
                    className="w-10 h-10 md:w-12 md:h-12 min-w-11 min-h-11 md:min-w-12 md:min-h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110"
                    aria-label={`Previous: ${prevRecipe.title}`}
                    title="Previous recipe"
                >
                    <span className="text-xl">‹</span>
                </button>
            )}
            {nextRecipe && onNavigate && (
                <button
                    onClick={() => onNavigate(nextRecipe)}
                    className="w-10 h-10 md:w-12 md:h-12 min-w-11 min-h-11 md:min-w-12 md:min-h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110"
                    aria-label={`Next: ${nextRecipe.title}`}
                    title="Next recipe"
                >
                    <span className="text-xl">›</span>
                </button>
            )}
            {(prevRecipe || nextRecipe) && onNavigate && (
                <span className="hidden md:flex items-center text-[10px] text-stone-400 tracking-wider font-medium select-none pointer-events-none" aria-hidden="true">
                    ← → to navigate
                </span>
            )}
            <button onClick={onShare} className="w-10 h-10 md:w-12 md:h-12 min-w-11 min-h-11 md:min-w-12 md:min-h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-colors hover:scale-110 motion-reduce:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2" aria-label={`Share recipe: ${shareTitle}`} title={shareTitle}>
                <span className="text-xl">⎘</span>
            </button>
            {!hasWebShare && (
                <a
                    href={emailRecipeUrl}
                    className="w-10 h-10 md:w-12 md:h-12 min-w-11 min-h-11 md:min-w-12 md:min-h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110 no-underline"
                    aria-label="Email recipe"
                    title="Email recipe"
                >
                    <span className="text-xl">✉</span>
                </a>
            )}
            <button onClick={onPrint} className="w-10 h-10 md:w-12 md:h-12 min-w-11 min-h-11 md:min-w-12 md:min-h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110" aria-label="Print recipe" title="Print">
                <span className="text-xl">🖨</span>
            </button>
            {onStartCook && (
                <button
                    onClick={onStartCook}
                    className="w-10 h-10 md:w-12 md:h-12 min-w-11 min-h-11 md:min-w-12 md:min-h-12 bg-[#2D4635] text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 hover:bg-[#2D4635]/90"
                    aria-label="Start Cook"
                    title="Start Cook"
                >
                    <span className="text-xl">👨‍🍳</span>
                </button>
            )}
            <button ref={closeButtonRef} onClick={onClose} className="w-10 h-10 md:w-12 md:h-12 min-w-11 min-h-11 md:min-w-12 md:min-h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-xl flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-white transition-all hover:scale-110" aria-label="Close recipe" title="Close">
                <span className="text-xl font-light">✕</span>
            </button>
        </div>
    );
};
