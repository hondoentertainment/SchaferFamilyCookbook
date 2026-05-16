# Recommended Next Steps

_Assessment date: 2026-05-16_

## Where the project stands

The Schafer Family Cookbook is a mature React 19 + Vite PWA with strong
fundamentals:

- **~106 source modules**, **39 unit/integration test files**, **15 Playwright
  E2E specs** (Chromium + Firefox).
- **CI covers**: image-seed verification, critical dependency audit, lint,
  type-check, unit tests, build, E2E behind Firebase emulators, and Firestore
  rules tests. Lighthouse CI, prod smoke, and recipe backups run as separate
  workflows.
- Every item in `FEATURE-PLAN-NEXT-2-WEEKS.md` and the "baseline" tier of
  `FEATURE-ROADMAP.md` is shipped: haptics, grocery list, profile
  favorites/recent, Collections, cloud trivia leaderboard, Vercel OG/share,
  admin export.

There is no outstanding broken work — the branch is even with `main` and the
working tree is clean. So "next steps" is about deliberate forward progress,
not cleanup.

## Priority 1 — Lock in the Vercel API surface (stability)

The last ~8 commits were all firefighting serverless bundling of the recipe
seed (`fix(api): ...`, `fix(vercel): ...`). It is now stable: `recipes.json`
is inlined into `api/recipes.seed.generated.ts` via the `postinstall` sync
script, and a `/api/ping` diagnostics route was added. Before building new
features, close this chapter so it cannot regress:

1. Add an API smoke check to CI (or extend `scripts/smoke-prod.mjs`) that hits
   `/api/ping`, `/api/og`, and `/api/share` against a deployment and asserts
   200 + expected content type. CI currently builds the client but never
   exercises a deployed serverless function.
2. Add a unit test asserting `recipes.seed.generated.ts` stays in sync with
   `src/data/recipes.json` (count + ids), so a stale seed fails CI instead of
   shipping silently.

_Effort: S. Removes the most recent source of production churn._

## Priority 2 — Ship one user-facing feature: Meal Plan

`FEATURE-ROADMAP.md` lists Collections as shipped and Meal Plan as the next
unbuilt feature (no `src/**/*meal*` or `*plan*` files exist). It is the highest
user value of the remaining roadmap and composes cleanly with what exists:

- Simple week view; add recipes to a day from the recipe modal.
- Local persistence first (mirror `collections.ts` / `grocery` patterns),
  optional `userPrefs` cloud sync later.
- "Generate grocery list from this week" — reuses the existing grocery flow and
  makes the feature immediately sticky.
- Add `MealPlanView.tsx` + `mealPlan.ts` util with unit tests, plus one E2E
  spec, matching the established pattern.

_Effort: M. Pick this over Family Story CMS — CMS is L effort for narrower
payoff._

## Priority 3 — Discoverability & accessibility polish

Smaller wins from the open audit items, batchable in a day or two:

- **Search by ingredient** (`FEATURE-ROADMAP.md`, M): extend recipe search to
  match ingredient text — high value, low risk.
- **Admin form labels** (`AUDIT-FEATURE-RATING.md`): add `htmlFor`/`id` to the
  remaining Admin inputs (category, prep/cook/calories, ingredients,
  instructions, gallery caption) and `aria-label` to icon-only buttons.
- **A–Z scroll spy** (`AUDIT-FEATURE-RATING.md`): mirror the Family Story TOC —
  set `aria-current` on the letter section in view.
- **`aria-current="page"`** on the active header tab.

_Effort: S each._

## Suggested sequence

1. **Week 1** — P1 API smoke + seed-sync test; start Meal Plan data layer.
2. **Weeks 2–3** — Meal Plan UI, grocery integration, unit + E2E tests.
3. **Week 4** — P3 polish batch (ingredient search, Admin labels, A–Z scroll
   spy, `aria-current`).

## Explicitly deferred

- **Family Story CMS** — large effort, lower reach than Meal Plan.
- **Real auth (OAuth/email)** — only worth it if cross-device identity for
  non-custodian users becomes a real need.
- **Explicit offline recipe cache for Cook Mode** — PWA runtime caching already
  covers the common case; revisit only if users report offline gaps.
