import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadRecipesSeed } from './loadRecipesSeed';

/**
 * Serverless diagnostics route. Confirms the function booted AND that the
 * bundled recipe seed (api/recipes.seed.generated.ts) loaded — the exact
 * surface that broke repeatedly during Vercel bundling work.
 *
 * GET /api/ping → 200 JSON when the seed has recipes, 500 when it is empty.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
    let recipeSeedCount = 0;
    let seedOk = false;
    try {
        recipeSeedCount = loadRecipesSeed().length;
        seedOk = recipeSeedCount > 0;
    } catch {
        seedOk = false;
    }

    res.status(seedOk ? 200 : 500)
        .setHeader('Content-Type', 'application/json')
        .setHeader('Cache-Control', 'no-store')
        .send(
            JSON.stringify({
                status: seedOk ? 'ok' : 'degraded',
                recipeSeedCount,
                time: new Date().toISOString(),
            }),
        );
}
