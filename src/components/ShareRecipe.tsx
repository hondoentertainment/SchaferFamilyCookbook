import React from 'react';
import { hapticLight } from '../utils/haptics';
import { useUI } from '../context/UIContext';
import type { Recipe } from '../types';
import { trackEvent } from '../services/analytics';
import { buildFamilyInviteBody, buildFamilyInviteSubject, getRecipeShareUrl } from '../utils/shareRecipe';

interface ShareRecipeProps {
  recipe: Recipe;
  /** Featured stacks a primary copy-link action for share-focused layouts */
  variant?: 'inline' | 'featured';
}

const secondaryBtn =
  'flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 rounded-full text-xs font-bold uppercase tracking-widest text-stone-700 dark:text-stone-300 transition-colors min-h-11 border border-transparent focus-visible:ring-2 focus-visible:ring-[#2D4635] motion-reduce:transition-none';

export const ShareRecipe: React.FC<ShareRecipeProps> = ({ recipe, variant = 'inline' }) => {
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

  const primaryClass =
    'w-full flex items-center justify-center gap-2 min-h-12 px-5 py-3.5 bg-[#2D4635] hover:bg-[#24382b] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-md transition-colors focus-visible:ring-2 focus-visible:ring-[#2D4635] focus-visible:ring-offset-2 motion-reduce:transition-none';

  if (variant === 'featured') {
    return (
      <div className="space-y-4" data-testid="share-recipe-featured">
        <p className="text-sm text-stone-600 dark:text-stone-400 font-serif italic leading-relaxed">
          Best for family group chats: copy the clean link first, then open text or mail with a prefilled invite.
        </p>
        <button
          type="button"
          onClick={handleCopyLink}
          data-testid="share-copy-link"
          data-share-url={shareUrl}
          className={primaryClass}
          aria-label="Copy share link"
        >
          <span aria-hidden>🔗</span>
          Copy share link
        </button>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" onClick={handleTextFamily} className={secondaryBtn} aria-label="Text recipe invite to family">
            <span aria-hidden>💬</span>
            Text family
          </button>
          <button type="button" onClick={handleEmailFamily} className={secondaryBtn} aria-label="Email recipe invite to family">
            <span aria-hidden>✉️</span>
            Email family
          </button>
          <button type="button" onClick={handleShare} className={secondaryBtn} aria-label="Share via system share sheet">
            <span aria-hidden>📤</span>
            Share sheet
          </button>
          <button type="button" onClick={handleCopyText} className={secondaryBtn} aria-label="Copy recipe as text">
            <span aria-hidden>📋</span>
            Copy full recipe
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap" data-testid="share-recipe-inline">
      <button
        type="button"
        onClick={handleCopyLink}
        data-testid="share-copy-link"
        data-share-url={shareUrl}
        className="flex items-center gap-2 px-4 py-2.5 bg-[#2D4635] hover:bg-[#24382b] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-sm transition-colors min-h-11 motion-reduce:transition-none"
        aria-label="Copy share link"
      >
        <span aria-hidden>🔗</span>
        Copy link
      </button>
      <button type="button" onClick={handleShare} className={secondaryBtn} aria-label="Share via system share sheet">
        <span aria-hidden>📤</span>
        Share
      </button>
      <button type="button" onClick={handleCopyText} className={secondaryBtn} aria-label="Copy recipe as text">
        <span aria-hidden>📋</span>
        Copy
      </button>
      <button type="button" onClick={handleTextFamily} className={secondaryBtn} aria-label="Text recipe invite to family">
        <span aria-hidden>💬</span>
        Text family
      </button>
      <button type="button" onClick={handleEmailFamily} className={secondaryBtn} aria-label="Email recipe invite to family">
        <span aria-hidden>✉️</span>
        Email family
      </button>
    </div>
  );
};
