import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadRecipesSeed } from './loadRecipesSeed.js';
import { getClientIp, OG_IMAGE_RATE_LIMIT, slidingWindowAllow } from './lib/rateLimit.js';

/**
 * OG share-card image.
 *
 * GET /api/og?recipeId=<id>  →  image/png (1200x630)
 *
 * Rendering strategy:
 *   - Background is the app's parchment palette (#FDFBF7 / stone-50).
 *   - Title, contributor and branding text are composited as SVG (vector text)
 *     which uses common system serif / sans families. This avoids shipping
 *     a bundled .ttf file — OG crawlers only see the rasterized PNG, so
 *     sharp's librsvg fallback fonts are acceptable here.
 *   - The recipe thumbnail is loaded from disk (public/recipe-images/…) when
 *     the recipe.image is a site-relative path, or fetched otherwise. On any
 *     failure we fall back to a neutral wordmark-only composition.
 */

type RecipeLike = {
    id: string;
    title: string;
    contributor: string;
    image?: string;
    category?: string;
};

const recipes = (() => {
    try {
        return loadRecipesSeed() as RecipeLike[];
    } catch (err) {
        console.error('[api/og] Failed to load recipe seed:', err);
        return [] as RecipeLike[];
    }
})();

const WIDTH = 1200;
const HEIGHT = 630;
// Brand palette derived from index.html / tailwind usage.
const BG = '#FDFBF7'; // parchment
const FG = '#2D4635'; // forest green
const ACCENT = '#A0522D'; // sienna

function escapeXml(s: string): string {
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
                return '&apos;';
            default:
                return c;
        }
    });
}

/** Break a title into at most `maxLines` lines without exceeding `maxChars` per line. */
function wrapTitle(title: string, maxChars = 22, maxLines = 3): string[] {
    const words = title.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
        const candidate = current ? `${current} ${w}` : w;
        if (candidate.length > maxChars && current) {
            lines.push(current);
            current = w;
            if (lines.length === maxLines - 1) break;
        } else {
            current = candidate;
        }
    }
    if (current) lines.push(current);
    if (lines.length > maxLines) {
        const head = lines.slice(0, maxLines);
        head[maxLines - 1] = `${head[maxLines - 1].replace(/\s+\S*$/, '')}…`;
        return head;
    }
    return lines;
}

function buildOverlaySvg(recipe: RecipeLike, hasImage: boolean): string {
    const textHalfWidth = hasImage ? 640 : WIDTH - 80;
    const titleLines = wrapTitle(recipe.title, hasImage ? 18 : 26, 3);
    const titleFontSize = titleLines.length >= 3 ? 64 : 76;
    const titleLineHeight = titleFontSize + 8;
    const titleStartY = 220;

    const titleTspans = titleLines
        .map(
            (line, i) =>
                `<tspan x="80" y="${titleStartY + i * titleLineHeight}">${escapeXml(line)}</tspan>`
        )
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>
  <rect x="0" y="0" width="${WIDTH}" height="8" fill="${FG}"/>
  <rect x="0" y="${HEIGHT - 8}" width="${WIDTH}" height="8" fill="${ACCENT}"/>

  <text x="80" y="110"
        font-family="'Lato', 'Helvetica Neue', Arial, sans-serif"
        font-size="24" font-weight="700" letter-spacing="6"
        fill="${ACCENT}" text-transform="uppercase">
    SCHAFER FAMILY COOKBOOK
  </text>

  <text
        font-family="'Playfair Display', 'Georgia', 'Times New Roman', serif"
        font-size="${titleFontSize}" font-weight="700" font-style="italic"
        fill="${FG}"
        textLength="${Math.min(textHalfWidth, 640)}" lengthAdjust="spacingAndGlyphs">
    ${titleTspans}
  </text>

  <text x="80" y="${HEIGHT - 110}"
        font-family="'Lato', 'Helvetica Neue', Arial, sans-serif"
        font-size="28" font-weight="400" fill="#6b5b4c">
    by ${escapeXml(recipe.contributor || 'the family')}
  </text>

  <text x="80" y="${HEIGHT - 60}"
        font-family="'Lato', 'Helvetica Neue', Arial, sans-serif"
        font-size="20" font-weight="700" letter-spacing="4"
        fill="${FG}">
    ${escapeXml((recipe.category || 'RECIPE').toUpperCase())}
  </text>
</svg>`;
}

async function loadRecipeImage(recipe: RecipeLike): Promise<Buffer | null> {
    if (!recipe.image) return null;
    try {
        if (recipe.image.startsWith('http://') || recipe.image.startsWith('https://')) {
            const resp = await fetch(recipe.image);
            if (!resp.ok) return null;
            const ab = await resp.arrayBuffer();
            return Buffer.from(ab);
        }
        // Site-relative path, e.g. /recipe-images/xyz.jpg
        const rel = recipe.image.replace(/^\/+/, '');
        const diskPath = path.join(process.cwd(), 'public', rel);
        return await fs.readFile(diskPath);
    } catch {
        return null;
    }
}

export async function renderOgPng(recipe: RecipeLike): Promise<Buffer> {
    const imgBuf = await loadRecipeImage(recipe);
    const hasImage = !!imgBuf;
    const overlaySvg = Buffer.from(buildOverlaySvg(recipe, hasImage));

    const base = sharp({
        create: {
            width: WIDTH,
            height: HEIGHT,
            channels: 3,
            background: BG,
        },
    });

    const composites: sharp.OverlayOptions[] = [];

    if (imgBuf) {
        try {
            const resized = await sharp(imgBuf)
                .resize(480, HEIGHT - 40, { fit: 'cover', position: 'centre' })
                .toBuffer();
            composites.push({
                input: resized,
                top: 20,
                left: WIDTH - 500,
            });
        } catch {
            // Image decode failed — continue without it.
        }
    }

    composites.push({ input: overlaySvg, top: 0, left: 0 });

    return base.composite(composites).png({ compressionLevel: 9 }).toBuffer();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const ipKey = `og-png:${getClientIp(req)}`;
    if (
        !slidingWindowAllow(
            ipKey,
            OG_IMAGE_RATE_LIMIT.max,
            OG_IMAGE_RATE_LIMIT.windowMs
        )
    ) {
        res.status(429).json({ error: 'Too many requests' });
        return;
    }

    const raw = req.query?.recipeId;
    const recipeId = Array.isArray(raw) ? raw[0] : raw;
    if (!recipeId || typeof recipeId !== 'string') {
        res.status(400).json({ error: 'Missing recipeId' });
        return;
    }

    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) {
        res.status(404).json({ error: 'Recipe not found' });
        return;
    }

    try {
        const png = await renderOgPng(recipe);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        res.status(200).send(png);
    } catch (err) {
        console.error('og handler error', err);
        res.status(500).json({ error: 'Failed to render OG image' });
    }
}
