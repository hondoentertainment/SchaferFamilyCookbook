# Feature Plan: Next 2 Weeks

**Scope:** Meal planning MVP, discovery polish, performance baseline  
**Duration:** ~2 weeks (starting late May 2026)  
**Includes:** Unit, rules, and E2E tests for each shipped slice

---

## Completed (late May 2026)

| Item | Status |
|------|--------|
| **Mobile vibration / haptics** — Cook Mode and key interactions | **Shipped** |
| **E2E fixes** — Playwright on dedicated preview port; admin and browse flows stabilized | **Shipped** |
| **Profile favorites & recently viewed** — sections on Profile tab with local + cloud sync | **Shipped** |
| **Collections in Profile** — user lists surfaced under Me | **Shipped** |
| **Recipe modal collection picker** — add/remove recipes from lists in modal | **Shipped** |
| **Accessibility batch** — ProfileView save announcement, RecipeModal breadcrumb, ESLint `no-autofocus`, TriviaView score breakdown semantics | **Shipped** |
| **Featured recipes** — admin curation + `FeaturedStrip` on Recipes tab | **Shipped** (prior sprint) |
| **FCM service worker build-time config** — `@inject-firebase-config` + `scripts/sync-firebase-sw-config.mjs` | **Shipped** (prior sprint) |
| **API recipe seed for Vercel** — `api/recipes.seed.generated.ts`, `postinstall` sync, smoke `/api/ping` | **Shipped** |
| **Collections cloud sync** — extend `userPrefs` to mirror custom lists across devices | **Shipped** |

---

## Next 2 weeks

### 1. Meal plan MVP

- Simple week view (7 days × 1 slot per day or breakfast/lunch/dinner columns — pick smallest viable)
- Persist in `localStorage`; optional `userPrefs` cloud sync (same pattern as collections)
- Add recipe from modal or browse (“Add to meal plan”)
- Unit tests for persistence helpers; optional E2E happy path

### 2. Featured recipes admin strip (polish)

- Featured toggle already in Admin; verify strip ordering, empty state, and mobile layout
- E2E: admin toggles featured → strip visible on Recipes tab
- Document custodian workflow in `RUNBOOK.md` or Admin help copy if missing

### 3. Ingredient search

- Extend browse search to match ingredient strings (case-insensitive, tokenized)
- Fuzzy or substring match on `recipe.ingredients[]`
- Unit tests for search helper; update empty-state copy when no ingredient matches

### 4. Lighthouse baseline

- Run **`npm run lighthouse:ci`** against production (or preview) URL
- Store artifact / scores in CI workflow output; note regressions in `ENHANCEMENTS.md`
- Target: no new a11y violations; LCP and CLS within green on mobile

---

## Suggested order of work

| Week | Focus | Deliverables |
|------|--------|--------------|
| **1** | Meal plan MVP + ingredient search | Week view UI, local persistence, search helper + tests |
| **2** | Featured strip polish + Lighthouse | Admin E2E assertion, baseline CI run |

---

## File checklist (likely touched)

- `src/components/MealPlanView.tsx` (new), routing in `App.tsx`
- `src/utils/mealPlan.ts` (new), `src/utils/search.ts` or browse filter in `App.tsx`
- `src/components/FeaturedStrip.tsx`, `src/components/AdminView.tsx`, `e2e/admin.spec.ts`
- `.github/workflows/` Lighthouse job notes, `TESTING.md`, `FEATURE-ROADMAP.md`
- `src/services/userPrefsSync.ts` — reference for meal-plan cloud sync if added later
