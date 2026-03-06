# Recipe Image Generation Strategy (Quota-Safe)

This project now supports **resumable, quota-safe image generation** for recipe photos.

## Goals

- Update all recipe images to high-quality Nano Banana output.
- Avoid quota spikes and full-run failures.
- Resume exactly where a prior run stopped.

## Recommended Workflow

1. **Preview first (no API calls):**
   - `npm run images:dry-run`
2. **Process a safe batch:**
   - `npm run images:batch`
3. **Repeat later (same command) until complete.**
   - The script stores progress in `.cache/imagen-generation-state.json`.

## Why This Avoids Limits

- Default mode is **missing-only** (skips recipes that already have valid Nano Banana local images).
- Batches are capped (`--limit 20` by default via npm script).
- Requests are spaced with delay and transient errors are retried with backoff.
- Hard quota exhaustion stops early while preserving all progress.

## Useful Commands

- Dry run target list:
  - `node scripts/generate-imagen-images.mjs --dry-run --missing-only`
- Standard batch:
  - `node scripts/generate-imagen-images.mjs --missing-only --limit 20`
- Slower, safer run:
  - `node scripts/generate-imagen-images.mjs --missing-only --limit 15 --delay-ms 6000`
- Force regenerate all recipes:
  - `node scripts/generate-imagen-images.mjs --force-all --limit 20`
- Reset run state and start over:
  - `node scripts/generate-imagen-images.mjs --reset-state --no-resume --missing-only --limit 20`

## Suggested Cadence

If quota is tight, run:

- `--limit 10` to `--limit 20` per batch
- 2 to 4 batches per day (based on observed quota behavior)

Increase slowly only after repeated successful runs.

## Output and Data Integrity

- Images are saved to `public/recipe-images/`.
- `src/data/recipes.json` is updated incrementally.
- Existing image remains untouched for failed recipes.

## Admin UI Behavior

Bulk generation in the Admin panel now:

- Detects quota exhaustion
- Stops early
- Keeps already-generated images
- Prompts you to resume later
