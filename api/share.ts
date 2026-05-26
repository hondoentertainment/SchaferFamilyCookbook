import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadRecipesSeed } from './loadRecipesSeed.js';
import { getClientIp, SHARE_PAGE_RATE_LIMIT, slidingWindowAllow } from './lib/rateLimit.js';

/**
 * Share landing page.
 *
 * GET /api/share?id=<recipeId>  →  minimal HTML document whose <head> contains
 * Open Graph + Twitter Card tags pointing at /api/og?recipeId=<id>, plus a
 * <meta http-equiv="refresh"> that sends human visitors to the SPA hash route
 * `/#recipe/<id>`.
 *
 * OG/crawlers (iMessage, Slack, WhatsApp, Discord, Twitter) don't run JS, so
 * we need a real HTML document whose meta tags reference the image. Once a
 * crawler has scraped the tags, the meta-refresh takes the human user to the
 * normal SPA view.
 *
 * Wired up via `vercel.json` rewrite `/share/recipe/:id` → `/api/share?id=:id`.
 */

type RecipeLike = {
    id: string;
    title: string;
    contributor: string;
    image?: string;
    category?: string;
};

const recipes = loadRecipesSeed();

function escapeHtml(s: string): string {
    return s.replace(/[<>&"']/g, (c) => {
        switch (c) {
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '&':
                return '&amp;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
            default:
                return c;
        }
    });
}

function originFromReq(req: VercelRequest): string {
    const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined) || 'https';
    const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
    if (!host) return '';
    return `${forwardedProto}://${host}`;
}

export function renderShareHtml(recipe: RecipeLike, origin: string): string {
    const title = `${recipe.title} — Schafer Family Cookbook`;
    const description = `A family recipe contributed by ${recipe.contributor}.`;
    const shareCanonicalUrl = `${origin}/share/recipe/${encodeURIComponent(recipe.id)}`;
    const ogImage = `${origin}/api/og?recipeId=${encodeURIComponent(recipe.id)}`;
    const appUrl = `${origin}/#recipe/${encodeURIComponent(recipe.id)}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(recipe.title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${escapeHtml(shareCanonicalUrl)}">
<meta property="og:site_name" content="Schafer Family Cookbook">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(recipe.title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(appUrl)}">
<link rel="canonical" href="${escapeHtml(shareCanonicalUrl)}">
</head>
<body>
<p>Redirecting to <a href="${escapeHtml(appUrl)}">${escapeHtml(recipe.title)}</a>…</p>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const ipKey = `share-html:${getClientIp(req)}`;
    if (
        !slidingWindowAllow(
            ipKey,
            SHARE_PAGE_RATE_LIMIT.max,
            SHARE_PAGE_RATE_LIMIT.windowMs
        )
    ) {
        res.status(429).setHeader('Retry-After', '60').send('Too many requests');
        return;
    }

    const raw = req.query?.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id || typeof id !== 'string') {
        res.status(400).send('Missing id');
        return;
    }

    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) {
        res.status(404).send('Recipe not found');
        return;
    }

    const origin = originFromReq(req);
    const html = renderShareHtml(recipe, origin);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    res.status(200).send(html);
}
