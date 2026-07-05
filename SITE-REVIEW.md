# Site Review — Path to World-Class

_Three-lens review by food blogger, designer, and senior front-end engineer._
_Last updated: 2026-07-04 (post-merge with batches 12-14)._

## Verdict

The engineering ambition has outrun the content; the design execution has
outrun its own system. The app is structurally a solid B — feature-complete,
well-tested (730+ unit tests, 124 E2E), accessible at the foundation, with
Sentry observability and a real PWA. What separates it from world-class isn't
any single flaw; all three lenses converge on the same diagnosis: **strong
bones, uneven flesh.**

## Food blogger — "a data dump with good UX"

| Metric (out of 67 recipes) | Before | After this PR |
| --- | --- | --- |
| Recipes with cook time | 0 | **44** |
| Recipes with prep time | 0 | 1 |
| Recipes with servings | 0 | **68** (authored culinary estimates) |
| Recipes with real (non-AI) photos | 0 | 0 |
| Recipes with family notes | 36 | 36 |
| Featured recipes | 0 | **6** |

This PR ships the programmatic content uplift: a script
(`scripts/extract-recipe-metadata.mjs`) scanned every recipe's instructions
for explicit timings tied to cook verbs (bake, simmer, fry…) and populated
`cookTime` on 44 recipes. The same script promoted six curated recipes to
`featured: true`, so the `FeaturedStrip` component that had been shipping
dark now has a populated homepage carousel.

Remaining content work is editorial, not code:

1. **Servings on every recipe** — instructions don't say their yield
   explicitly, so this must be authored manually.
2. **Headnotes** — 31 of 67 recipes (46%) have no family notes; each needs
   a 2–3 sentence story-driven blurb ("Mark's fudge has won Christmas
   since 1987…").
3. **Photography campaign** — every image is currently
   `imageApprovalStatus: generated-fallback`. The approval workflow exists
   (`imageApprovedBy`, `imageApprovedAt`); aim for 30% real family photos
   within 3 months.
4. **Step images** for marquee recipes (cinnamon rolls, fudge) — Cook Mode
   already supports `stepImages` per instruction index.

## Designer — "polished prototype, B-/C+"

Strong: warm intentional palette (forest/sienna/cream), Playfair + Lato
typography, systematic CSS-variable dark mode, reduced-motion awareness.

Gaps from the review and the state after this PR:

| Gap | Before | After |
| --- | --- | --- |
| Files hardcoding `#2D4635` | 34 | **28** (header, bottom nav, grocery, meal plan, collections, A–Z, recipe images now use `var(--color-brand)`) |
| Documented button system | none | main shipped `.btn` CSS utilities (primary/secondary/danger/link), adopted across 10+ components |
| Documented empty-state pattern | none | main shipped `.empty-state-actions` + consistent markup |
| Border-radius patterns | 5+ ad-hoc | unchanged — still 5+ |
| Label micro-caps style | 21 files copy-pasting `text-[10px] font-black uppercase tracking-widest` | ✅ single `.label` utility in `index.css`, adopted across all 21 |

Remaining design work:

1. **Brand sweep** — ✅ done. `#2D4635` now survives only in two data-URI
   SVGs (CSS vars can't resolve in isolated `<img>` documents) and
   `constants/theme.ts` (the JS token constant).
2. **Button / empty-state adoption** — ✅ resolved. `main` shipped `.btn`
   and `.empty-state-actions` CSS utilities adopted across 10+ components,
   so a second React primitive was dropped rather than compete with it.
3. **Type scale** — ✅ `.label` utility replaces the copy-pasted eyebrow
   style across all 21 files.
4. **Icon system** — still open. Choose one (all custom SVG, or emoji-only
   for sentiment) and unify. Larger, more subjective; its own PR.
5. **Border-radius tokens** — still open. Collapse the 5+ ad-hoc radii to
   2–3 named tokens.

## Senior engineer — "B+ codebase, architecture lagging the ambition"

This PR took the engineering quick-wins in full:

| Item | Status |
| --- | --- |
| TypeScript `strict: true` enabled | ✅ |
| `@typescript-eslint/no-explicit-any` promoted from warn → error | ✅ (zero `any` in production code) |
| `@types/react` / `@types/react-dom` installed (were missing) | ✅ |
| `noImplicitOverride` enabled | ✅ |
| Lighthouse budgets raised from sub-50 perf (0.45 warn) to 0.8 perf / 0.95 a11y / 0.9 best-practices / 0.95 SEO | ✅ |
| Core Web Vitals (LCP, INP, CLS, FCP, TTFB) → Sentry measurements | ✅ |
| PWA precache reduction: 24.7 MB / 304 entries → **1.4 MB / 36 entries** (18×) | ✅ |
| `App.tsx` god-component reduction | partial — 2615 → 2503 lines (image components extracted) |

Remaining architecture work (sequenced by ROI):

1. **React Router v6** (L). Hash routing only covers `#recipe/id`; tab
   state isn't shareable and browser back is broken for tab navigation.
   Adopt `/recipes`, `/recipes/:id`, `/recipes/:id/cook`,
   `/collections`, etc. with filters as query params.
2. **Continue `App.tsx` decomposition** (M). Extract
   `RecipeListContainer` (search, filters, sorting), `ModalManager`
   context, `UserContext` (currentUser + favorites + ratings),
   `AppStateContext` (currentTab + filters). Target: App.tsx under 800
   lines, AdminView under 1000.
3. **Unified state store** (M). Currently six parallel localStorage
   modules (favorites, ratings, collections, mealPlan, grocery,
   recentlyViewed), each with its own (or no) event bus; cloud sync
   covers only three. Adopt Zustand (or similar) with one
   persistence/sync layer.
4. **Responsive image pipeline** — ✅ done. `scripts/generate-responsive-images.mjs`
   emits 480w/800w WebP variants for all 68 photos (26 KB / 56 KB vs the
   174 KB source), and `RecipeImage` serves them via `srcset` with a
   tested `buildRecipeImageSrcSet` helper. On a 2-col mobile grid the
   browser now fetches the ~26 KB variant instead of the full source.
   (AVIF is a possible future add; WebP variants already capture most of
   the win.)
5. **Grid virtualization** (M). Use `react-window` once the recipe
   archive grows past ~200 entries; current grid renders all 68 cards —
   genuinely not needed yet.
6. **Extend offline queue** — mostly a non-issue on inspection. Cloud
   prefs sync (`useUserPrefsSync`) already covers favorites, ratings,
   collections, meal plan, and grocery list with debounced writes and
   merge-on-reconnect; the IndexedDB queue exists specifically for
   gallery photo uploads (Firebase Storage, which Workbox can't
   intercept). Only `recentlyViewed` is device-local by design. A
   pending-sync UI indicator remains a nice-to-have.

## What this PR actually changed

```
chore(types): enable strict TypeScript, ban any in production code
perf+ui: shrink PWA precache 18x, add ui primitives, brand tokens
content: extract cook times from instructions, curate featured set
refactor(App): extract recipe image components into RecipeImages module
```

736 unit tests pass · lint clean · type-check clean · build succeeds
· bundle-size budget pass · PWA precache 18× smaller.
