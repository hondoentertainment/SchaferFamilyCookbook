import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Minimal recipe fields needed by OG/share routes */
export type RecipeSeedLike = {
    id: string;
    title: string;
    contributor: string;
    image?: string;
    category?: string;
};

let cached: RecipeSeedLike[] | null = null;

/**
 * Seed recipes synchronized from src/data/recipes.json at install/build time.
 * Loaded via readFileSync so Vercel bundles `recipes.bundle.json` next to the
 * compiled handler using vercel.json `functions.*.includeFiles` (JSON imports
 * were not reliably included in the serverless output).
 */
export function loadRecipesSeed(): RecipeSeedLike[] {
    if (cached) return cached;
    const bundlePath = join(__dirname, 'recipes.bundle.json');
    const raw = readFileSync(bundlePath, 'utf8');
    cached = JSON.parse(raw) as RecipeSeedLike[];
    return cached;
}
