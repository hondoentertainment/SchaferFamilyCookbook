import type { Recipe } from '../types';

/**
 * Build the URL to share for a given recipe.
 *
 * When `VITE_SHARE_BASE` is set (Vercel deployment), we return
 * `${base}/share/recipe/<id>` which hits the serverless `/api/share` handler
 * that serves an HTML document with OG meta tags + a meta-refresh to the SPA.
 * Crawlers (iMessage, Slack, WhatsApp) see the card; humans get redirected.
 *
 * When `VITE_SHARE_BASE` is NOT set (GitHub Pages, static-only), we fall back
 * to the existing hash route on the current origin. OG previews won't work
 * there, but the link still opens the recipe.
 */
export function getRecipeShareUrl(
  recipeId: string,
  shareBase?: string,
  windowOrigin?: string
): string {
  if (shareBase) {
    const trimmed = shareBase.replace(/\/+$/, '');
    return `${trimmed}/share/recipe/${encodeURIComponent(recipeId)}`;
  }
  const origin = windowOrigin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/#recipe/${encodeURIComponent(recipeId)}`;
}

/** Warm, short invite for SMS / email — complements the detailed “Copy recipe” text. */
export function buildFamilyInviteBody(recipe: Recipe, shareUrl: string): string {
  const titleBlock = [recipe.title, recipe.contributor ? `From ${recipe.contributor}'s corner of the archive.` : '']
    .filter((s) => s.length > 0)
    .join('\n');
  const blocks = [
    `Thought you'd love this heirloom recipe from our family cookbook.`,
    titleBlock,
    shareUrl,
    'Tap the link for the full recipe card (ingredients, steps, and photos).',
    '— Schafer Family Cookbook',
  ];
  return blocks.join('\n\n');
}

export function buildFamilyInviteSubject(recipe: Recipe): string {
  return `${recipe.title} — Schafer Family Cookbook`;
}

/**
 * SMS compose URL. Android and modern browsers want `sms:?body=`.
 * Older iOS ignores `?` and needs `sms:&body=` — do not use `sms:?&body=`,
 * which Chrome treats as a relative path (`/sms?...`) when no handler exists.
 */
export function buildFamilySmsHref(
  recipe: Recipe,
  shareUrl: string,
  userAgent?: string
): string {
  const body = encodeURIComponent(buildFamilyInviteBody(recipe, shareUrl));
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  return isIOS ? `sms:&body=${body}` : `sms:?body=${body}`;
}

export function buildFamilyMailtoHref(recipe: Recipe, shareUrl: string): string {
  const subject = encodeURIComponent(buildFamilyInviteSubject(recipe));
  const body = encodeURIComponent(buildFamilyInviteBody(recipe, shareUrl));
  return `mailto:?subject=${subject}&body=${body}`;
}
