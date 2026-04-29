# Recipe Image Generation Strategy (Quota-Safe)

This project now supports **resumable, quota-safe recipe image generation** with an automatic Pollinations fallback.

## Goals

- Update all recipe images with recipe-specific AI output.
- Avoid quota spikes and full-run failures.
- Resume exactly where a prior run stopped.
- Keep image creation working even when Gemini quota is unavailable.

## Recommended Workflow

1. **Preview first (no API calls):**
   - `npm run images:dry-run`
2. **Process a safe batch:**
   - `npm run images:batch`
3. **Repeat later (same command) until complete.**
   - The script stores progress in `.cache/imagen-generation-state.json`.
4. **Audit the results:**
   - `npm run images:verify`

## Why This Avoids Limits

- Default mode is **missing-only** (skips recipes that already have valid local or Pollinations-backed images).
- Batches are capped (`--limit 20` by default via npm script).
- Requests are spaced with delay and transient errors are retried with backoff.
- In `auto` mode, Gemini quota exhaustion falls back to Pollinations instead of failing the run.

## Useful Commands

- Dry run target list:
  - `node scripts/generate-imagen-images.mjs --dry-run --missing-only`
- Standard batch:
  - `node scripts/generate-imagen-images.mjs --missing-only --limit 20`
- Pollinations-only repair run:
  - `node scripts/generate-imagen-images.mjs --missing-only --provider pollinations --limit 20`
- Slower, safer run:
  - `node scripts/generate-imagen-images.mjs --missing-only --limit 15 --delay-ms 6000`
- Force regenerate all recipes:
  - `node scripts/generate-imagen-images.mjs --force-all --limit 20`
- Reset run state and start over:
  - `node scripts/generate-imagen-images.mjs --reset-state --no-resume --missing-only --limit 20`
- Rebuild the full recipe catalog with unique Pollinations URLs:
  - `node scripts/generate-recipe-images.mjs`
- Localize any remote recipe image URLs:
  - `node scripts/download-recipe-images.mjs`

## Suggested Cadence

If quota is tight, run:

- `--limit 10` to `--limit 20` per batch
- 2 to 4 batches per day (based on observed quota behavior)

Increase slowly only after repeated successful runs.

## Output and Data Integrity

- `src/data/recipes.json` is updated incrementally.
- Local image runs save files to `public/recipe-images/`.
- Pollinations catalog rebuilds keep unique remote URLs plus `imageSource` metadata.
- Existing image remains untouched for failed recipes.

## Admin UI Behavior

Bulk generation in the Admin panel now:

- Uses the `/api/gemini` proxy for primary generation
- Falls back to Pollinations when Gemini is unavailable
- Keeps already-generated images
- Preserves `imageSource` metadata when staged images are approved
