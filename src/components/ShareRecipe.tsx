import React from 'react';
import { hapticLight } from '../utils/haptics';
import { useUI } from '../context/UIContext';
import type { Recipe } from '../types';

interface ShareRecipeProps {
  recipe: Recipe;
}

export const ShareRecipe: React.FC<ShareRecipeProps> = ({ recipe }) => {
  const { toast } = useUI();

  const formatRecipeText = (): string => {
    const lines = [
      `${recipe.title}`,
      `By: ${recipe.contributor}`,
      '',
      `Category: ${recipe.category}`,
    ];
    if (recipe.prepTime) lines.push(`Prep: ${recipe.prepTime}`);
    if (recipe.cookTime) lines.push(`Cook: ${recipe.cookTime}`);
    if (recipe.servings) lines.push(`Servings: ${recipe.servings}`);
    lines.push('', 'INGREDIENTS:', ...recipe.ingredients.map((i) => `- ${i}`));
    lines.push('', 'INSTRUCTIONS:', ...recipe.instructions.map((s, i) => `${i + 1}. ${s}`));
    if (recipe.notes) lines.push('', `Notes: ${recipe.notes}`);
    lines.push('', '-- From the Schafer Family Cookbook');
    return lines.join('\n');
  };

  const handleCopyText = async () => {
    hapticLight();
    try {
      await navigator.clipboard.writeText(formatRecipeText());
      toast('Recipe copied to clipboard!', 'success');
    } catch {
      toast('Could not copy. Try selecting and copying manually.', 'error');
    }
  };

  const handleShare = async () => {
    hapticLight();
    const text = formatRecipeText();
    const shareData = {
      title: recipe.title,
      text: text,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          toast('Share failed', 'error');
        }
      }
    } else {
      handleCopyText();
    }
  };

  const handleTextMessage = () => {
    hapticLight();
    const text = encodeURIComponent(
      `Check out this recipe!\n\n${recipe.title}\nBy ${recipe.contributor}\n\nIngredients:\n${recipe.ingredients.join('\n')}\n\nFrom the Schafer Family Cookbook`
    );
    window.open(`sms:?body=${text}`, '_blank');
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 rounded-full text-xs font-bold uppercase tracking-widest text-stone-600 dark:text-stone-400 transition-colors min-h-11"
        aria-label="Share via system share"
      >
        <span aria-hidden>📤</span>
        Share
      </button>
      <button
        type="button"
        onClick={handleCopyText}
        className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 rounded-full text-xs font-bold uppercase tracking-widest text-stone-600 dark:text-stone-400 transition-colors min-h-11"
        aria-label="Copy recipe as text"
      >
        <span aria-hidden>📋</span>
        Copy
      </button>
      <button
        type="button"
        onClick={handleTextMessage}
        className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 rounded-full text-xs font-bold uppercase tracking-widest text-stone-600 dark:text-stone-400 transition-colors min-h-11"
        aria-label="Text recipe to someone"
      >
        <span aria-hidden>💬</span>
        Text
      </button>
    </div>
  );
};
