# Recommended Next Steps

_Last updated: 2026-06-26 (batch 2 — executed)_

## Recently shipped (June 2026 — batch 2)

### Grocery cloud sync — ✅ shipped

- `userPrefs.groceryList` mirrors the local grocery list across devices (same opt-in model as favorites, collections, and meal plan)
- Merge strategy unions by item id, de-dupes recipeId + text, and preserves checked state
- Firestore rules updated; unit + rules tests added

### Collections → Grocery — ✅ shipped

- Expanded collections can **Add to grocery list** for all recipes in the shelf at once
- Reuses meal-plan de-dupe toasts and optional “View list” action

### Ops & quality — ✅ shipped

- Lighthouse CI workflow runs on a monthly schedule (1st of month) plus manual dispatch
- Home E2E, profile save announcements, and Home breadcrumb (batch 1)

## Completed this session

1. **Firestore rules deployed** — `firebase deploy --only firestore:rules --project schafer-cookbook` (grocery sync allowed in production)
2. **Verification** — `npm run test:run` (771 tests), onboarding E2E (3/3 Chromium), `npm run images:verify` (67/67), `npm run smoke:prod` (all green)
3. **Lighthouse workflow** — scheduled runs now fall back to the production URL when `inputs.url` is unset

## What to do next

1. **Production monitoring** — `VITE_SENTRY_DSN` is **not** set on Vercel yet. Add it under Project → Settings → Environment Variables (Production), then redeploy. Skim Sentry after grocery sync is live.
2. **Lighthouse baseline** — trigger the **Lighthouse CI** workflow in GitHub Actions (or wait for the 1st-of-month schedule) and tune `lighthouserc.cjs` thresholds if scores drift
3. **Content ops (optional)** — all 67 recipes have generated fallback images; run `npm run images:batch` only if you want to refresh Imagen assets

## Explicitly deferred

- **Real auth (OAuth/email)** — only if cross-device identity for non-custodian users becomes a real need
- **Full offline recipe text cache** — Cook Mode image cache + PWA runtime caching cover the common case
- **Gamification** (trivia streaks, contribution badges) — backlog
- **Multi-tenant / site forks** — strategic, not near-term
