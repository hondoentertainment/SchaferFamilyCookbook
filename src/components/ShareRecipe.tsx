import React from 'react';
import { hapticLight } from '../utils/haptics';
import { useUI } from '../context/UIContext';
import type { Recipe } from '../types';
import { trackEvent } from '../services/analytics';
import { buildFamilyInviteBody, buildFamilyInviteSubject, getRecipeShareUrl } from '../utils/shareRecipe';

interface ShareRecipeProps {
  recipe: Recipe;
}

export const ShareRecipe: React.FC<ShareRecipeProps> = ({ recipe }) => {
  const { toast } = useUI();
  const shareBase = import.meta.env.VITE_SHARE_BASE;
  const shareUrl = getRecipeShareUrl(recipe.id, shareBase);

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
    lines.push('', shareUrl, '-- From the Schafer Family Cookbook');
    return lines.join('\n');
  };

  const handleCopyText = async () => {
    hapticLight();
    try {
      await navigator.clipboard.writeText(formatRecipeText());
      toast('Recipe copied to clipboard!', 'success');
      trackEvent('recipe_shared', { recipeId: recipe.id });
    } catch {
      toast('Could not copy. Try selecting and copying manually.', 'error');
    }
  };

  const handleCopyLink = async () => {
    hapticLight();
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast('Link copied to clipboard!', 'success');
      trackEvent('recipe_shared', { recipeId: recipe.id });
    } catch {
      toast('Could not copy link.', 'error');
    }
  };

  const handleShare = async () => {
    hapticLight();
    const text = formatRecipeText();
    const shareData = {
      title: recipe.title,
      text,
      url: shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        trackEvent('recipe_shared', { recipeId: recipe.id });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          toast('Share failed', 'error');
        }
      }
    } else {
      handleCopyText();
    }
  };

  const handleTextFamily = () => {
    hapticLight();
    const body = encodeURIComponent(buildFamilyInviteBody(recipe, shareUrl));
    window.open(`sms:?body=${body}`, '_blank');
    trackEvent('recipe_shared_family_sms', { recipeId: recipe.id });
  };

  const handleEmailFamily = () => {
    hapticLight();
    const subject = encodeURIComponent(buildFamilyInviteSubject(recipe));
    const body = encodeURIComponent(buildFamilyInviteBody(recipe, shareUrl));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    trackEvent('recipe_shared_family_email', { recipeId: recipe.id });
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 rounded-full text-xs font-bold uppercase tracking-widest text-stone-600 dark:text-stone-400 transition-colors min-h-11"
        aria-label="Share via system share sheet"
      >
        <span aria-hidden>📤</span>
        Share
      </button>
      <button
        type="button"
        onClick={handleCopyLink}
        data-testid="share-copy-link"
        data-share-url={shareUrl}
        className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 rounded-full text-xs font-bold uppercase tracking-widest text-stone-600 dark:text-stone-400 transition-colors min-h-11"
        aria-label="Copy share link"
      >
        <span aria-hidden>🔗</span>
        Copy link
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
        onClick={handleTextFamily}
        className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 rounded-full text-xs font-bold uppercase tracking-widest text-stone-600 dark:text-stone-400 transition-colors min-h-11"
        aria-label="Text recipe invite to family"
      >
        <span aria-hidden>💬</span>
        Text family
      </button>
      <button
        type="button"
        onClick={handleEmailFamily}
        className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 rounded-full text-xs font-bold uppercase tracking-widest text-stone-600 dark:text-stone-400 transition-colors min-h-11"
        aria-label="Email recipe invite to family"
      >
        <span aria-hidden>✉️</span>
        Email family
      </button>
    </div>
  );
};
