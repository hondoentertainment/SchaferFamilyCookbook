# Recommended Next Steps

_Last updated: 2026-05-17_

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

## What to do next

1. **Meal Plan cloud sync** — the plan is local-only. Mirror the optional
   `userPrefs` Firestore sync used by favorites so a plan follows a user across
   devices. _Effort: M._
2. **Featured recipes** — admin-curated highlights on the Recipes tab. _Effort: S._
3. **Family Story CMS** — make the static narrative editable in Admin. _Effort: L._

## Explicitly deferred

- **Real auth (OAuth/email)** — only worth it if cross-device identity for
  non-custodian users becomes a real need.
- **Explicit offline recipe cache for Cook Mode** — PWA runtime caching already
  covers the common case.
