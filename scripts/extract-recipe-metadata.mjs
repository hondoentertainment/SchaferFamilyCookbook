#!/usr/bin/env node
/**
 * Programmatic first pass at the food-blogger review's content-sprint metadata
 * gaps. For every recipe in src/data/recipes.json that's missing prepTime,
 * cookTime, or servings, scan the instructions/notes text for time and yield
 * cues and populate the fields. Conservative: only writes when a clear cue
 * is found. Also selects up to six featured recipes.
 *
 * Run: node scripts/extract-recipe-metadata.mjs [--reset-times]
 *   --reset-times  Clear all prepTime/cookTime before extracting (use after
 *                  improving the extraction heuristics).
 *
 * Always re-runs the seed sync afterwards so the API recipe seed stays
 * consistent with the source.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../src/data/recipes.json', import.meta.url);
const SYNC_SCRIPT = fileURLToPath(new URL('./sync-recipes-for-api.mjs', import.meta.url));
const recipes = JSON.parse(readFileSync(SRC, 'utf8'));

const RESET_TIMES = process.argv.includes('--reset-times');

// Combined "1 hour 15 minutes" style takes priority over single-unit matches.
const COMBINED_TIME_REGEX =
    /(\d+)\s*(?:hr|hrs|hour|hours)\.?\s*(?:and\s*)?(\d+)\s*(?:min|mins|minute|minutes)\b/i;
const TIME_REGEX =
    /(\d+)\s*(?:-|to|–)\s*(\d+)?\s*(min|minute|minutes|hr|hrs|hour|hours)\b|\b(\d+)\s*(min|minute|minutes|hr|hrs|hour|hours)\b/i;

function parseToMinutes(match) {
    if (!match) return null;
    const num = Number(match[1] ?? match[4]);
    const unit = (match[3] ?? match[5] ?? '').toLowerCase();
    if (!Number.isFinite(num) || num <= 0) return null;
    if (unit.startsWith('hr') || unit.startsWith('hour')) return num * 60;
    return num;
}

function formatMinutes(min) {
    if (min == null) return null;
    if (min >= 60) {
        const hrs = Math.floor(min / 60);
        const rem = min % 60;
        // Whole units only — "1 hr 15 min", never "1.3 hr" (decimal hour
        // strings mis-parse in downstream duration parsers).
        return rem === 0 ? `${hrs} hr` : `${hrs} hr ${rem} min`;
    }
    return `${min} min`;
}

// Active cooking only. Passive time (chill, refrigerate, cool, rest, rise,
// freeze, marinate) is deliberately excluded — displaying "Chill 1 hour" as
// cookTime misrepresents no-cook recipes in the UI and recipe schema.
const COOK_VERBS = /\b(bake|roast|simmer|boil|cook|broil|fry|grill|saut[eé]|brown|braise|steam)\b/i;
const PASSIVE_VERBS = /\b(chill|refrigerate|cool|rest|rise|freeze|marinate|overnight)\b/i;
const PREP_VERBS = /\b(mix|combine|whisk|stir|chop|dice|mince|slice|peel|knead|roll|cream|blend)\b/i;

function pullTimes(instructions) {
    let cook = null;
    let prep = null;
    for (const step of instructions) {
        if (PASSIVE_VERBS.test(step)) continue;
        const combined = COMBINED_TIME_REGEX.exec(step);
        const mins = combined
            ? Number(combined[1]) * 60 + Number(combined[2])
            : parseToMinutes(TIME_REGEX.exec(step));
        if (!mins) continue;
        if (COOK_VERBS.test(step) && (cook == null || mins > cook)) cook = mins;
        else if (PREP_VERBS.test(step) && (prep == null || mins > prep)) prep = mins;
    }
    return { prep, cook };
}

const YIELD_REGEX =
    /\b(serves?|servings?|makes|yields?)\s*(?:about\s*)?(\d+(?:\s*(?:-|to|–)\s*\d+)?)\s*([A-Za-z]+)?/i;

function pullServings(recipe) {
    const haystack = [recipe.notes || '', ...(recipe.instructions || [])].join(' ');
    const m = YIELD_REGEX.exec(haystack);
    if (!m) return null;
    const number = m[2].replace(/\s+/g, '');
    const unit = (m[3] || '').toLowerCase();
    const verb = m[1].toLowerCase();
    if (verb.startsWith('serve')) return `Serves ${number}`;
    if (verb.startsWith('make')) {
        if (unit && !/^(cup|cups)$/i.test(unit)) return `Makes ${number} ${unit}`;
        return `Makes ${number}`;
    }
    if (verb.startsWith('yield')) return `Yields ${number}${unit ? ' ' + unit : ''}`;
    return `Serves ${number}`;
}

// Six featured recipes spanning the food-blogger reviewer's recommended
// variety: marquee dessert, breakfast, classic main, dip, soup, bar.
// Titles use the exact source-of-truth strings (curly apostrophes preserved).
const FEATURED_TITLES = new Set([
    'Cinnamon Rolls',
    'Mark’s Fudge',
    'Festive Apple Dip',
    'Raisin Cookies',
    'Wild Rice Hot Dish (Robin’s)',
    'Chicken Wild Rice Soup',
]);

let prepFilled = 0;
let cookFilled = 0;
let servingsFilled = 0;
let featuredFilled = 0;

for (const recipe of recipes) {
    if (RESET_TIMES) {
        delete recipe.prepTime;
        delete recipe.cookTime;
    }
    if (!recipe.prepTime || !recipe.cookTime) {
        const { prep, cook } = pullTimes(recipe.instructions || []);
        if (!recipe.prepTime && prep != null) {
            recipe.prepTime = formatMinutes(prep);
            prepFilled++;
        }
        if (!recipe.cookTime && cook != null) {
            recipe.cookTime = formatMinutes(cook);
            cookFilled++;
        }
    }
    if (!recipe.servings) {
        const s = pullServings(recipe);
        if (s) {
            recipe.servings = s;
            servingsFilled++;
        }
    }
    if (FEATURED_TITLES.has(recipe.title) && !recipe.featured) {
        recipe.featured = true;
        featuredFilled++;
    }
}

writeFileSync(SRC, JSON.stringify(recipes, null, 2) + '\n', 'utf8');
console.log(
    `[extract-recipe-metadata] prepTime+${prepFilled} cookTime+${cookFilled} servings+${servingsFilled} featured+${featuredFilled}`,
);

// Keep the bundled serverless seed in sync (path resolved relative to this
// script so the command works from any working directory).
execFileSync(process.execPath, [SYNC_SCRIPT], { stdio: 'inherit' });
