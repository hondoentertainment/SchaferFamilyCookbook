import { readFileSync } from 'node:fs';
import path from 'node:path';

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
 * Load bundled seed recipes from disk (API routes avoid `import … with { type: 'json' }`,
 * which can fail under some Vercel Node bundles).
 */
export function loadRecipesSeed(): RecipeSeedLike[] {
    if (cached) return cached;
    const filePath = path.join(process.cwd(), 'src/data/recipes.json');
    const raw = readFileSync(filePath, 'utf8');
    cached = JSON.parse(raw) as RecipeSeedLike[];
    return cached;
}
