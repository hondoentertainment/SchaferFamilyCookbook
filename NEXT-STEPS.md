# Recommended Next Steps

_Last updated: 2026-06-19_

## Status of the previous recommendation

The three priority tracks below were assessed against the live codebase. P1 and
P2 are now implemented on this branch; P3 turned out to be already done.

### P1 — Vercel API surface — ✅ shipped

- `/api/ping` upgraded from a bare `ok` string to a JSON diagnostics route that
  reports whether the bundled recipe seed loaded (`recipeSeedCount`). This is the
  exact surface that broke repeatedly during Vercel bundling work.
- In-process handler tests added: `api/ping.test.ts`, `api/share.test.ts`, and
  `api/recipes.seed.test.ts` (the seed-sync regression guard). They run in
  `npm run test:run`, so CI now exercises the serverless handlers.
- `scripts/smoke-prod.mjs` now also hits `/api/ping` and asserts the deployed
  function loaded its seed.

### P2 — Meal Plan — ✅ shipped

- `src/utils/mealPlan.ts` — localStorage-backed weekly plan with date helpers,
  add/remove, and range queries. Fully unit-tested.
- `src/components/MealPlanView.tsx` — seven-day week view with week navigation,
  a per-day recipe picker, and "Add this week to Grocery List" which reuses the
  existing grocery flow.
- Recipe modal overflow menu gained an "Add to meal plan" day picker.
- Reachable from the Grocery List view; nav highlighting wired through Header
  and BottomNav. One Playwright spec added (`e2e/meal-plan.spec.ts`).

### P3 — Discoverability & accessibility — ✅ already implemented

A code review found these were already in place, so no change was needed:

- **Ingredient search** — recipe search already matches ingredient text.
- **Admin form labels** — all Admin inputs already have `htmlFor`/`id`.
- **A–Z scroll spy** — `AlphabeticalIndex` already uses an `IntersectionObserver`
  with `aria-current`.
- **`aria-current` on the active tab** — already set in Header and BottomNav.

The `AUDIT-*.md` files predate this work and are stale on these points.

## Status of the current recommendation

The next three implementation recommendations are now covered on this branch:

- **Meal Plan cloud sync** — `userPrefs` now includes optional `mealPlan` entries, with merge/fetch/write coverage and Firestore rules allowing the constrained shape.
- **Featured recipes** — already shipped before this pass; Admin curation and `FeaturedStrip` are covered by component and E2E tests.
- **Family Story CMS** — Admin can save custom story sections, and the public Family Story view now renders saved sections with the built-in narrative as fallback.

## What to do next

1. **Verification baseline** — run `npm run ci`, focused Playwright for Meal Plan/Profile/Admin, Firestore rules tests, and Lighthouse CI before release.
2. **Meal Plan polish** — add copy-week/copy-day actions, ingredient/contributor search in the picker, and clearer grocery de-dupe summaries.
3. **Family Story editor polish** — add preview, autosave draft, and optional section templates once custodians use the CMS.

## Explicitly deferred

- **Real auth (OAuth/email)** — only worth it if cross-device identity for
  non-custodian users becomes a real need.
- **Explicit offline recipe cache for Cook Mode** — PWA runtime caching already
  covers the common case.
