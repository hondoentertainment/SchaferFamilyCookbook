#!/usr/bin/env node
/**
 * Generate reliable local recipe pictures from recipe content.
 *
 * This produces an ingredient- and method-aware illustration for every recipe,
 * writes it to public/recipe-images/<recipe-id>.webp, and updates recipes.json
 * to use those local assets as generated recipe pictures.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const recipesPath = resolve(root, 'src/data/recipes.json');
const outputDir = resolve(root, 'public/recipe-images');
const WIDTH = 1200;
const HEIGHT = 900;

const CATEGORY_BACKDROPS = {
    Breakfast: ['#f6dfb5', '#b8752a'],
    Main: ['#dfcfb6', '#405a40'],
    Dessert: ['#f5d6df', '#9d4c64'],
    Side: ['#dfebc7', '#5d7c34'],
    Appetizer: ['#f0ceb3', '#9a5430'],
    Bread: ['#edd0a4', '#8b5a2b'],
    'Dip/Sauce': ['#d4e7df', '#3e7580'],
    Snack: ['#e2d9f2', '#6b5b95'],
};

const INGREDIENT_COLORS = [
    [/chicken|turkey|ham|bacon|beef|sausage|shrimp|meat/i, '#c98257'],
    [/broccoli|spinach|lettuce|green|celery|parsley|pepper/i, '#4f7c45'],
    [/tomato|salsa|rhubarb|cherry|strawberry|cranberry|red/i, '#b94a44'],
    [/cheese|cheddar|corn|lemon|banana|egg|butter|mayo/i, '#e6b84a'],
    [/chocolate|cocoa|coffee|molasses/i, '#5a3324'],
    [/cream|milk|flour|sugar|rice|potato|marshmallow|vanilla/i, '#efe2c4'],
    [/apple|peanut|almond|pecan|walnut|oat|bread|cracker|pretzel/i, '#b9844d'],
    [/blueberry|grape/i, '#5b5e9e'],
];

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function hashString(input) {
    let hash = 2166136261;
    for (const ch of String(input)) {
        hash ^= ch.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createRng(seed) {
    let state = seed || 1;
    return () => {
        state = Math.imul(1664525, state) + 1013904223 >>> 0;
        return state / 4294967296;
    };
}

function jitter(rng, amount) {
    return (rng() - 0.5) * amount;
}

function recipeText(recipe) {
    return [recipe.title, recipe.category, ...(recipe.ingredients || []), ...(recipe.instructions || [])].join(' ').toLowerCase();
}

function pickIngredientColors(recipe) {
    const colors = [];
    for (const ingredient of recipe.ingredients || []) {
        const match = INGREDIENT_COLORS.find(([pattern]) => pattern.test(ingredient));
        colors.push(match ? match[1] : '#c9955f');
    }
    return [...new Set(colors)].slice(0, 6).length ? [...new Set(colors)].slice(0, 6) : ['#c9955f', '#e6b84a', '#4f7c45'];
}

function presentationFor(recipe) {
    const text = recipeText(recipe);
    if (/soup|chili|stew/.test(text)) return 'bowl';
    if (/salad|caviar|slaw/.test(text)) return 'salad';
    if (/dip|sauce|salsa|spread/.test(text)) return 'dip';
    if (/cookie|brownie|bar|fudge|chow|candy|crunch|cake|pie|dessert/.test(text) || recipe.category === 'Dessert') return 'sweets';
    if (/bread|biscuit|roll|pancake|muffin/.test(text) || recipe.category === 'Bread' || recipe.category === 'Breakfast') return 'baked';
    if (/spaghetti|noodle|pasta/.test(text)) return 'pasta';
    if (/hotdish|casserole|bake|oven|squares/.test(text)) return 'casserole';
    return recipe.category === 'Dip/Sauce' ? 'dip' : 'plated';
}

function ellipse(cx, cy, rx, ry, fill, opacity = 1, attrs = '') {
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${opacity}" ${attrs}/>`;
}

function circle(cx, cy, r, fill, opacity = 1, attrs = '') {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}" ${attrs}/>`;
}

function rect(x, y, w, h, rx, fill, opacity = 1, attrs = '') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" opacity="${opacity}" ${attrs}/>`;
}

function garnishDots(rng, colors, count, area) {
    const parts = [];
    for (let i = 0; i < count; i++) {
        const color = colors[i % colors.length];
        const x = area.x + rng() * area.w;
        const y = area.y + rng() * area.h;
        parts.push(circle(x.toFixed(1), y.toFixed(1), (7 + rng() * 16).toFixed(1), color, 0.88));
    }
    return parts.join('\n');
}

function buildDish(recipe, rng, colors, type) {
    const parts = [];
    const main = colors[0] || '#c9955f';
    const secondary = colors[1] || '#e6b84a';
    const green = colors.find((color) => color === '#4f7c45') || '#5f8f4e';

    parts.push(ellipse(600, 690, 420, 70, '#000000', 0.16));
    parts.push(ellipse(600, 535, 430, 270, '#f8f3ea', 1));
    parts.push(ellipse(600, 535, 360, 215, '#e6dfd0', 1));

    if (type === 'bowl' || type === 'dip') {
        parts.push(ellipse(600, 540, 345, 210, '#fbf7ef', 1));
        parts.push(ellipse(600, 535, 285, 155, type === 'dip' ? secondary : main, 0.95));
        parts.push(garnishDots(rng, colors, 34, { x: 390, y: 430, w: 420, h: 180 }));
        if (type === 'dip') {
            for (let i = 0; i < 10; i++) {
                const x = 255 + i * 78 + jitter(rng, 30);
                parts.push(rect(x, 620 + jitter(rng, 18), 92, 30, 8, '#c89455', 0.92, `transform="rotate(${(-18 + rng() * 36).toFixed(1)} ${x + 46} 635)"`));
            }
        }
        return parts.join('\n');
    }

    if (type === 'salad') {
        parts.push(ellipse(600, 540, 315, 175, '#f3eadc', 1));
        for (let i = 0; i < 40; i++) {
            const x = 360 + rng() * 480;
            const y = 395 + rng() * 255;
            parts.push(ellipse(x.toFixed(1), y.toFixed(1), (34 + rng() * 46).toFixed(1), (12 + rng() * 22).toFixed(1), i % 4 === 0 ? secondary : green, 0.88, `transform="rotate(${(rng() * 180).toFixed(1)} ${x} ${y})"`));
        }
        parts.push(garnishDots(rng, colors.filter((c) => c !== green), 24, { x: 390, y: 430, w: 420, h: 170 }));
        return parts.join('\n');
    }

    if (type === 'sweets') {
        const bakedColors = ['#b56a3c', '#d6a75c', '#6b3b2a', '#e8d2a4', main, secondary];
        for (let i = 0; i < 13; i++) {
            const x = 350 + (i % 5) * 118 + jitter(rng, 26);
            const y = 405 + Math.floor(i / 5) * 95 + jitter(rng, 24);
            const r = 42 + rng() * 22;
            parts.push(circle(x.toFixed(1), y.toFixed(1), r.toFixed(1), bakedColors[i % bakedColors.length], 0.96));
            parts.push(garnishDots(rng, ['#4a281d', '#fff2cf'], 5, { x: x - r * 0.65, y: y - r * 0.55, w: r * 1.3, h: r * 1.1 }));
        }
        return parts.join('\n');
    }

    if (type === 'baked') {
        parts.push(rect(315, 440, 570, 190, 80, '#b87a43', 1));
        parts.push(ellipse(600, 440, 285, 82, '#d49b5d', 1));
        for (let i = 0; i < 7; i++) {
            const x = 390 + i * 70 + jitter(rng, 12);
            parts.push(rect(x, 380 + jitter(rng, 12), 38, 125, 18, '#efd29b', 0.34, `transform="rotate(${(-16 + rng() * 32).toFixed(1)} ${x + 19} 440)"`));
        }
        parts.push(garnishDots(rng, colors, 22, { x: 400, y: 430, w: 400, h: 120 }));
        return parts.join('\n');
    }

    if (type === 'pasta') {
        for (let i = 0; i < 34; i++) {
            const x = 390 + rng() * 420;
            const y = 425 + rng() * 210;
            parts.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} C ${(x + 45).toFixed(1)} ${(y - 35).toFixed(1)}, ${(x + 85).toFixed(1)} ${(y + 35).toFixed(1)}, ${(x + 135).toFixed(1)} ${y.toFixed(1)}" stroke="#e8c66f" stroke-width="20" stroke-linecap="round" fill="none" opacity="0.94"/>`);
        }
        parts.push(garnishDots(rng, colors, 30, { x: 405, y: 420, w: 390, h: 190 }));
        return parts.join('\n');
    }

    if (type === 'casserole') {
        parts.push(rect(330, 415, 540, 230, 42, '#d8c2a4', 1));
        parts.push(rect(365, 440, 470, 175, 28, secondary, 0.92));
        parts.push(garnishDots(rng, colors, 48, { x: 385, y: 455, w: 430, h: 135 }));
        parts.push(`<path d="M380 485 C 470 425, 560 535, 650 465 S 790 500, 820 455" stroke="#fff1c8" stroke-width="18" fill="none" opacity="0.58"/>`);
        return parts.join('\n');
    }

    parts.push(ellipse(600, 515, 290, 160, main, 0.95));
    parts.push(garnishDots(rng, colors, 42, { x: 390, y: 420, w: 420, h: 180 }));
    parts.push(ellipse(590, 472, 205, 82, secondary, 0.38));
    return parts.join('\n');
}

function buildSvg(recipe) {
    const seed = hashString(`${recipe.id}:${recipe.title}:${(recipe.ingredients || []).join('|')}`);
    const rng = createRng(seed);
    const [light, dark] = CATEGORY_BACKDROPS[recipe.category] || CATEGORY_BACKDROPS.Main;
    const colors = pickIngredientColors(recipe);
    const type = presentationFor(recipe);
    const dish = buildDish(recipe, rng, colors, type);
    const title = escapeXml(recipe.title || 'Family recipe');
    const aria = escapeXml(`${recipe.title}, generated from ingredients including ${(recipe.ingredients || []).slice(0, 4).join(', ')}`);

    const sideIngredients = colors.map((color, i) => {
        const x = 130 + i * 56;
        const y = 190 + (i % 2) * 34;
        return `${circle(x, y, 22, color, 0.88)}${ellipse(x + 14, y - 13, 22, 10, '#ffffff', 0.18, `transform="rotate(-28 ${x + 14} ${y - 13})"`)}`;
    }).join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${aria}">
  <defs>
    <linearGradient id="table" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="warm" cx="45%" cy="38%" r="70%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" seed="${seed % 997}"/>
      <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .055 0"/>
    </filter>
  </defs>
  <rect width="1200" height="900" fill="url(#table)"/>
  <rect width="1200" height="900" fill="url(#warm)"/>
  <rect width="1200" height="900" filter="url(#grain)" opacity="0.45"/>
  <path d="M0 720 C 250 650, 420 760, 700 700 S 1040 650, 1200 720 L1200 900 L0 900 Z" fill="#2d241b" opacity="0.10"/>
  <g opacity="0.54">${sideIngredients}</g>
  <g>${dish}</g>
  <text x="600" y="824" font-family="Georgia, 'Times New Roman', serif" font-size="42" font-style="italic" text-anchor="middle" fill="#fff8ec" opacity="0.84">${title}</text>
</svg>`;
}

async function writeRecipePicture(recipe) {
    const imageFile = `${recipe.id}.webp`;
    const imagePath = resolve(outputDir, imageFile);
    const svg = buildSvg(recipe);
    await sharp(Buffer.from(svg))
        .resize(WIDTH, HEIGHT, { fit: 'cover' })
        .webp({ quality: 88, effort: 5 })
        .toFile(imagePath);
    recipe.image = `/recipe-images/${imageFile}`;
    recipe.imageSource = 'nano-banana';
    return recipe.image;
}

const recipes = JSON.parse(readFileSync(recipesPath, 'utf-8'));
mkdirSync(outputDir, { recursive: true });

let updated = 0;
for (const recipe of recipes) {
    const image = await writeRecipePicture(recipe);
    updated += 1;
    console.log(`${String(updated).padStart(2, '0')}. ${recipe.title} -> ${image}`);
}

writeFileSync(recipesPath, JSON.stringify(recipes, null, 2) + '\n');
console.log(`\nGenerated ${updated} local recipe-derived pictures.`);
