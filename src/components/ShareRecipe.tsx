import React from 'react';
import { hapticLight } from '../utils/haptics';
import { useUI } from '../context/UIContext';
import type { Recipe } from '../types';
import { trackEvent } from '../services/analytics';
import {
  buildFamilyMailtoHref,
  buildFamilySmsHref,
  getRecipeShareUrl,
} from '../utils/shareRecipe';

interface ShareRecipeProps {
  recipe: Recipe;
  /** Featured stacks a primary copy-link action for share-focused layouts */
  variant?: 'inline' | 'featured';
}

const secondaryBtn =
  'flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 dark:bg-[var(--bg-tertiary)] hover:bg-stone-200 dark:hover:bg-stone-600 rounded-full text-xs font-bold uppercase tracking-widest text-stone-700 dark:text-stone-300 transition-colors min-h-11 border border-transparent focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] motion-reduce:transition-none';

export const ShareRecipe: React.FC<ShareRecipeProps> = ({ recipe, variant = 'inline' }) => {
  const { toast } = useUI();
  const shareBase = import.meta.env.VITE_SHARE_BASE;
  const shareUrl = getRecipeShareUrl(recipe.id, shareBase);
  const smsHref = buildFamilySmsHref(recipe, shareUrl);
  const mailtoHref = buildFamilyMailtoHref(recipe, shareUrl);

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
    trackEvent('recipe_shared_family_sms', { recipeId: recipe.id });
  };

  const handleEmailFamily = () => {
    hapticLight();
    trackEvent('recipe_shared_family_email', { recipeId: recipe.id });
  };

  const primaryClass =
    'w-full flex items-center justify-center gap-2 min-h-12 px-5 py-3.5 bg-[var(--color-brand)] hover:bg-[#24382b] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-md transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 motion-reduce:transition-none';

  const familyInviteLinks = (
    <>
      <a
        href={smsHref}
        onClick={handleTextFamily}
        data-testid="share-text-family"
        className={`${secondaryBtn} no-underline`}
        aria-label="Text recipe invite to family"
      >
        <span aria-hidden>💬</span>
        Text family
      </a>
      <a
        href={mailtoHref}
        onClick={handleEmailFamily}
        data-testid="share-email-family"
        className={`${secondaryBtn} no-underline`}
        aria-label="Email recipe invite to family"
      >
        <span aria-hidden>✉️</span>
        Email family
      </a>
    </>
  );

  if (variant === 'featured') {
    return (
      <div className="space-y-5" data-testid="share-recipe-featured">
        <section aria-labelledby="send-to-family-heading" data-testid="send-to-family" className="space-y-3">
          <div className="space-y-1">
            <h4 id="send-to-family-heading" className="label text-stone-500">
              Send to family
            </h4>
            <p className="text-sm text-stone-600 dark:text-stone-400 font-serif italic leading-relaxed">
              A warm heirloom note with the recipe card — opens your text or mail app, ready to send.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{familyInviteLinks}</div>
        </section>
        <p className="text-sm text-stone-600 dark:text-stone-400 font-serif italic leading-relaxed">
          Or copy the clean link for a group chat. When this site is on Vercel, that link shows the family photo card.
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
        className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[#24382b] text-white rounded-full text-xs font-black uppercase tracking-widest shadow-sm transition-colors min-h-11 motion-reduce:transition-none"
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
      {familyInviteLinks}
    </div>
  );
};
