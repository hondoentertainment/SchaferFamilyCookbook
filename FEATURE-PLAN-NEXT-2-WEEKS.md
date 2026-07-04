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
| **Meal plan MVP + cloud sync** — week view, modal picker, grocery generation, `userPrefs.mealPlan` | **Shipped** |
| **Ingredient search** — browse search matches recipe ingredient text | **Shipped** |
| **Family Story CMS render path** — saved Admin sections drive the public Family Story view | **Shipped** |

---

## Next 2 weeks

### 1. Meal plan polish

- Add copy-week/copy-day actions
- Improve picker search with ingredient/contributor matching
- Clarify grocery-list de-dupe summaries after generating a week

### 2. Family Story CMS polish

- Add preview before saving
- Add autosave draft in localStorage
- Add optional starter section templates for custodians

### 3. Search polish

- Add fuzzy matching for title, contributor, and ingredient typo tolerance
- Improve empty-state copy based on whether the query matched ingredients, categories, or contributors

### 4. Lighthouse baseline

- Run **`npm run lighthouse:ci`** against production (or preview) URL
- Store artifact / scores in CI workflow output; note regressions in `ENHANCEMENTS.md`
- Target: no new a11y violations; LCP and CLS within green on mobile

---

## Suggested order of work

| Week | Focus | Deliverables |
|------|--------|--------------|
| **1** | Meal plan + Story CMS polish | Copy actions, preview/draft UX, focused tests |
| **2** | Search polish + Lighthouse | Fuzzy search helper, baseline CI run |

---

## File checklist (likely touched)

- `src/components/MealPlanView.tsx`, routing in `App.tsx`
- `src/utils/mealPlan.ts`, `src/services/userPrefsSync.ts`, `firebase/firestore.rules`
- `src/components/HistoryView.tsx`, `src/components/AdminView.tsx`, `src/services/db.ts`
- `.github/workflows/` Lighthouse job notes, `TESTING.md`, `FEATURE-ROADMAP.md`
