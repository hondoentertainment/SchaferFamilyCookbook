#!/usr/bin/env node
/**
 * Editorial recipe image generator.
 *
 * Produces a typography-first cookbook-cover style image per recipe. Used as a
 * deterministic fallback when Imagen / Nano Banana quota is exhausted or no
 * GEMINI_API_KEY is configured.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const recipesPath = resolve(root, 'src/data/recipes.json');
const outputDir = resolve(root, 'public/recipe-images');

const CATEGORY_THEMES = {
    Breakfast:   { bg: '#B45309', accent: '#FEF3C7', glyph: '☀', label: 'AT THE TABLE' },
    Main:        { bg: '#2D4635', accent: '#F4E2D1', glyph: '✦', label: 'THE MAIN COURSE' },
    Dessert:     { bg: '#9D174D', accent: '#FCE7F3', glyph: '❀', label: 'A SWEET FINISH' },
    Side:        { bg: '#3F6212', accent: '#ECFCCB', glyph: '✿', label: 'ON THE SIDE' },
    Appetizer:   { bg: '#9A3412', accent: '#FFEDD5', glyph: '✧', label: 'TO BEGIN' },
    Bread:       { bg: '#78350F', accent: '#FEF3C7', glyph: '✺', label: 'FROM THE OVEN' },
    'Dip/Sauce': { bg: '#0E7490', accent: '#CFFAFE', glyph: '◆', label: 'TO POUR & DIP' },
    Snack:       { bg: '#5B21B6', accent: '#F3E8FF', glyph: '◉', label: 'IN BETWEEN' },
};

// Warm tints for the contributor avatar pill. Selected to read well against
// every category background while staying tonally separate from the accent ink.
const CONTRIBUTOR_ACCENTS = [
    '#E8C8A0',
    '#F0D8B8',
    '#D8C4A8',
    '#E0B098',
    '#C8B098',
    '#F0C8B0',
    '#D0B898',
    '#E8D0B0',
];

function parseArgs(argv) {
    const args = { forceAll: false, fallbackOnly: true, dryRun: false, cleanOldGenerated: false };
    for (const arg of argv) {
        if (arg === '--force-all') args.forceAll = true;
        if (arg === '--fallback-only') args.fallbackOnly = true;
        if (arg === '--dry-run') args.dryRun = true;
        if (arg === '--clean-old-generated') args.cleanOldGenerated = true;
    }
    return args;
}

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function wrapWords(text, maxChars, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
        if (lines.length === maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);
    return lines;
}

function darken(hex, amount) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `#${[r, g, b]
        .map((x) => Math.max(0, Math.floor(x * (1 - amount))).toString(16).padStart(2, '0'))
        .join('')}`;
}

function seedFromString(str) {
    let h = 0;
    for (const ch of String(str || '')) h = (h * 31 + ch.charCodeAt(0)) % 9999;
    return h;
}

function getTheme(category) {
    return CATEGORY_THEMES[category] || CATEGORY_THEMES.Main;
}

function getInitials(name) {
    const cleaned = String(name || '').replace(/[()]/g, ' ').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const letters = parts
        .map((part) => {
            const match = part.match(/[A-Za-z]/);
            return match ? match[0].toUpperCase() : '';
        })
        .filter(Boolean);
    if (letters.length === 0) return '?';
    if (letters.length === 1) return letters[0];
    return letters[0] + letters[letters.length - 1];
}

// theme is accepted so callers can pass it for future palette-biasing, but the
// warm-tint palette already complements every category background, so we hash
// only on the contributor name for stable per-person avatar colors.
function accentForContributor(name, theme) { // eslint-disable-line no-unused-vars
    const seed = seedFromString(String(name || '').toLowerCase());
    return CONTRIBUTOR_ACCENTS[seed % CONTRIBUTOR_ACCENTS.length];
}

function pickTitleSize(lineCount) {
    if (lineCount <= 1) return 150;
    if (lineCount === 2) return 122;
    if (lineCount === 3) return 88;
    return 64;
}

function buildSvg(recipe) {
    const theme = getTheme(recipe.category);
    const maxChars = 16;
    let titleLines = wrapWords(recipe.title, maxChars, 4);
    if (titleLines.length === 0) titleLines = [recipe.title || 'Untitled'];
    const titleSize = pickTitleSize(titleLines.length);
    const lineHeight = titleSize * 0.96;
    // Bottom-anchor the title so the last baseline always sits just above the
    // rule, but never push the first cap-top into the category label band.
    // This keeps wide visual breathing room below the avatar/glyph stack for
    // short titles while letting longer wraps lean on the lower frame.
    const capHeight = titleSize * 0.73;
    const titleBaselineLast = 670;
    const minBlockTop = 432 + capHeight; // category baseline (420) + ~12px buffer + cap height
    const blockTop = Math.max(titleBaselineLast - (titleLines.length - 1) * lineHeight, minBlockTop);
    const contributorName = recipe.contributor || 'Schafer Family';
    const contributor = contributorName.toUpperCase();
    const initials = getInitials(contributorName);
    const avatarFill = accentForContributor(contributorName, theme);
    const categoryLabel = theme.label;
    const seed = seedFromString(recipe.id || recipe.title);
    const bgGradEnd = darken(theme.bg, 0.32);
    const ink = theme.accent;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.bg}"/>
      <stop offset="1" stop-color="${bgGradEnd}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="80%">
      <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.35"/>
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.08 0"/>
    </filter>
  </defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <rect width="1200" height="900" filter="url(#grain)"/>
  <rect width="1200" height="900" fill="url(#vignette)"/>
  <rect x="68" y="68" width="1064" height="764" fill="none" stroke="${ink}" stroke-opacity="0.28" stroke-width="2"/>
  <text x="120" y="138" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="40" fill="${ink}" fill-opacity="0.7">S</text>
  <text x="1080" y="138" font-family="Arial, sans-serif" font-size="16" letter-spacing="4" font-weight="700" fill="${ink}" fill-opacity="0.5" text-anchor="end">SCHAFER COOKBOOK</text>
  <g>
    <circle cx="600" cy="340" r="30" fill="${avatarFill}" stroke="${ink}" stroke-opacity="0.55" stroke-width="2"/>
    <text x="600" y="351" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="28" fill="${theme.bg}" text-anchor="middle">${escapeXml(initials)}</text>
  </g>
  <text x="600" y="420" font-family="Arial, sans-serif" font-size="20" letter-spacing="9" font-weight="700" fill="${ink}" fill-opacity="0.78" text-anchor="middle">${escapeXml(categoryLabel)}</text>
  <text x="600" y="478" font-family="Georgia, 'Times New Roman', serif" font-size="56" fill="${ink}" fill-opacity="0.45" text-anchor="middle">${theme.glyph}</text>
  <g font-family="Georgia, 'Times New Roman', serif" fill="${ink}" font-style="italic" font-weight="700" text-anchor="middle">
    ${titleLines
        .map((line, i) => `<text x="600" y="${blockTop + i * lineHeight}" font-size="${titleSize}">${escapeXml(line)}</text>`)
        .join('\n    ')}
  </g>
  <line x1="500" y1="730" x2="700" y2="730" stroke="${ink}" stroke-opacity="0.45" stroke-width="1"/>
  <text x="600" y="772" font-family="Arial, sans-serif" font-size="20" letter-spacing="6" font-weight="700" fill="${ink}" fill-opacity="0.78" text-anchor="middle">FROM ${escapeXml(contributor)}</text>
</svg>`;
}

async function writeFallbackImage(recipe) {
    const imageFile = `${recipe.id}.webp`;
    const imagePath = resolve(outputDir, imageFile);
    const svg = buildSvg(recipe);
    await sharp(Buffer.from(svg))
        .resize(1200, 900, { fit: 'cover' })
        .webp({ quality: 86 })
        .toFile(imagePath);
    return `/recipe-images/${imageFile}`;
}

const args = parseArgs(process.argv.slice(2));
const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));
mkdirSync(outputDir, { recursive: true });

let updated = 0;
const targets = recipes.filter((recipe) => {
    const image = String(recipe.image || '');
    const localPath = image.startsWith('/recipe-images/') ? resolve(root, 'public', image.replace(/^\//, '')) : '';
    const hasValidLocal = localPath && existsSync(localPath);
    return args.forceAll || !hasValidLocal || !recipe.imageSource || recipe.imageSource === 'pollinations';
});

console.log('\nEditorial recipe image rebuild');
console.log('='.repeat(60));
console.log(`Recipes total:    ${recipes.length}`);
console.log(`Targets:          ${targets.length}`);
console.log(`Force all:        ${args.forceAll ? 'yes' : 'no'}`);
console.log(`Dry run:          ${args.dryRun ? 'yes' : 'no'}`);
console.log('='.repeat(60));

if (args.dryRun) {
    targets.forEach((recipe, index) => console.log(`${String(index + 1).padStart(2)}. ${recipe.title}`));
    process.exit(0);
}

if (args.cleanOldGenerated) {
    for (const recipe of recipes) {
        for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
            const oldPath = resolve(outputDir, `${recipe.id}.${ext}`);
            if (existsSync(oldPath)) rmSync(oldPath);
        }
    }
}

for (const recipe of targets) {
    const image = await writeFallbackImage(recipe);
    recipe.image = image;
    recipe.imageSource = 'local-generated';
    updated += 1;
    console.log(`OK ${recipe.title} -> ${image}`);
}

writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');
console.log(`\nUpdated ${updated} recipes.`);
