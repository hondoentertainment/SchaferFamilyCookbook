# Recommended Next Steps

_Last updated: 2026-06-26_

## Recently shipped (June 2026)

### Navigation & Home IA — ✅ shipped

- Six-tab bottom nav: **Home**, **Recipes**, **A–Z**, **Family**, **Groceries**, **Me**
- `HomeView` dashboard: greeting, stats, tonight's meal plan, recipe of the week, seasonal picks, favorites/recent shelves, trivia teaser
- `SectionSubNav` for Recipes/Collections, Family hub sub-tabs, Groceries/Meal Plan, Profile/Privacy/Help
- Playwright coverage: `e2e/navigation.spec.ts`, `e2e/home.spec.ts`

### Meal Plan polish — ✅ shipped

- Copy week / copy day actions with duplicate skipping
- Fuzzy picker search by title, ingredient, or contributor
- Grocery de-dupe toasts (`Added N items · M duplicates skipped`)

### Family Story CMS polish — ✅ shipped

- Live preview toggle in Admin
- Autosave draft to localStorage with restore/discard banner
- Optional section templates when the editor is empty

### Accessibility & polish — ✅ shipped

- A–Z sticky section headers (`AlphabeticalIndex`)
- Gallery video fullscreen lightbox (`GalleryLightbox`)
- Profile `aria-live` announcements on save
- Recipe modal **Back to Home** breadcrumb when opened from Home tab
- Cook Mode read-aloud + offline recipe image cache
- Grocery list share/copy; fuzzy recipe search

## What to do next

1. **Release verification** — run `npm run ci`, `npm run test:rules`, `npm run test:e2e:desktop`, and `npm run smoke:prod` before family rollout. Trigger **Lighthouse CI** workflow (or `npm run lighthouse:ci`) and archive scores.
2. **Monitor production** — confirm `VITE_SENTRY_DSN` on Vercel; skim errors after nav rollout.
3. **Content ops** — `npm run images:verify` for any missing recipe images; `firebase deploy --only firestore:indexes` when trivia indexes change.

## Explicitly deferred

- **Real auth (OAuth/email)** — only if cross-device identity for non-custodian users becomes a real need.
- **Full offline recipe text cache** — Cook Mode image cache + PWA runtime caching cover the common case.
- **Gamification** (trivia streaks, contribution badges) — backlog.
- **Multi-tenant / site forks** — strategic, not near-term.
