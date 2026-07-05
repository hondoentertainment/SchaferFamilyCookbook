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
| Button styles | 11+ ad-hoc | shipped primitive; adoption pending |

Remaining design work:

1. **Mechanical brand sweep** — replace `#2D4635` in the remaining 28 files
   with `var(--color-brand)`. The pattern is proven; just hasn't been
   applied everywhere.
2. **Button adoption** — replace inline button `className` strings across
   the app with `<Button variant="…">`.
3. **EmptyState adoption** — same, for the ad-hoc empty states in
   `CollectionsView`, `GroceryListView`, `MealPlanView`, `ActivityFeed`,
   `AlphabeticalIndex`.
4. **Icon system** — choose one (all custom SVG, or emoji-only for
   sentiment) and unify.
5. **Type scale** — name the 172 occurrences of
   `text-[10px] font-black uppercase tracking-widest` (the "label" style)
   into a `font-size: { label: [...] }` Tailwind extension so it stops
   being copy-pasted.

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
4. **Responsive image pipeline** (M). All `<img>` tags already have
   `loading="lazy" decoding="async" sizes=...`, but there's no
   `srcset` — the build only produces one variant. Add 480w / 800w /
   1200w plus AVIF.
5. **Grid virtualization** (M). Use `react-window` once the recipe
   archive grows past ~200 entries; current grid renders all cards.
6. **Extend offline queue** (M). Currently only recipe additions are
   queued; favorites, ratings, grocery, meal plan mutations should be
   too, with a pending-sync indicator.

## What this PR actually changed

```
chore(types): enable strict TypeScript, ban any in production code
perf+ui: shrink PWA precache 18x, add ui primitives, brand tokens
content: extract cook times from instructions, curate featured set
refactor(App): extract recipe image components into RecipeImages module
```

736 unit tests pass · lint clean · type-check clean · build succeeds
· bundle-size budget pass · PWA precache 18× smaller.
