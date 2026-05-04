import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Minimal recipe fields needed by OG/share routes */
export type RecipeSeedLike = {
    id: string;
    title: string;
    contributor: string;
    image?: string;
    category?: string;
};

let cached: RecipeSeedLike[] | null = null;

function resolveRecipesJsonPath(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        path.join(process.cwd(), 'src/data/recipes.json'),
        path.join(here, '../src/data/recipes.json'),
        path.join(here, '../../src/data/recipes.json'),
    ];
    for (const p of candidates) {
        if (existsSync(p)) return p;
    }
    throw new Error(`recipes.json not found (cwd=${process.cwd()}); tried: ${candidates.join('; ')}`);
}

/**
 * Load bundled seed recipes from disk (API routes avoid `import … with { type: 'json' }`,
 * which can fail under some Vercel Node bundles). Pair with `includeFiles` in vercel.json.
 */
export function loadRecipesSeed(): RecipeSeedLike[] {
    if (cached) return cached;
    const filePath = resolveRecipesJsonPath();
    const raw = readFileSync(filePath, 'utf8');
    cached = JSON.parse(raw) as RecipeSeedLike[];
    return cached;
}
