# Recommended Next Steps

_Last updated: 2026-07-14 (batch 17 — finalize launch; batch 15 merged + deployed)_

## Finalize (recommended before family launch)

```bash
npm run finalize                    # CI coverage + ops audit + smoke
npm run finalize -- --apply         # push .env.local vars to Vercel
npm run finalize -- --deploy        # Vercel production deploy
npm run finalize -- --all           # apply + migrate dry-run + deploy + lighthouse
npm run finalize -- --migrate --yes # live contributor migration (needs FIREBASE_SERVICE_ACCOUNT)
```

## Shipped (July 2026 — PR #64, merged 2026-07-07)

Deployed to Vercel prod + GitHub Pages (smoke 9/9 green on merge commit `0bff260`).

### Shared family ratings & notes

- **Family-wide aggregate** — every client fetches all `userPrefs` docs (already world-readable by design) into a local cache (`familyPrefs:v1`); recipe averages, "Family Approved", "Cooked by N", and Family Notes now reflect the *whole family*, not just this device
- **Notes + displayName sync** — `userPrefs` docs now carry `notes` (RecipeNote list), `deletedNoteIds` tombstones, and `displayName`; merged on login like other prefs
- **Firestore rules deploy** (`firebase deploy --only firestore:rules`) — ✅ closed. Until/unless the live rules match, clients whose full write is rejected automatically retry with the legacy payload shape, so sync degrades gracefully rather than breaking

### Printable heirloom cookbook

- **Print the family cookbook** button (Recipes hero, desktop + mobile) → cover, table of contents, category chapters, one-recipe-per-block print layout; browser print dialog does PDF export

### Recipe Cook tab (earlier commits on PR #64)

- **Step timers** — "Start N-min timer" chips on instruction cards with countdown + toast
- **Wake lock** — screen stays awake in Cook tab; re-acquired after tab switches
- **Scaled-servings indicator** — "Quantities scaled for N — original serves M" + Reset

### CI / e2e (PR #64 + issue #65)

- **trivia.spec repaired** (6/6), e2e sharded per browser, live line reporter
- **e2e suite repaired and blocking again** (#65 closed) — green on both browsers (~5 min each)

## Productionize (one command)

```bash
npm run productionize              # audit all + smoke
npm run productionize -- --apply   # push local env vars to Vercel (when set in .env.local)
npm run productionize -- --deploy  # redeploy Vercel production
npm run productionize -- --all     # apply + migrate dry-run + deploy + lighthouse
npm run productionize -- --migrate --yes   # live Firestore contributor migration (needs FIREBASE_SERVICE_ACCOUNT)
```

## Recently shipped (July 2026 — batch 17)

### Finalize launch tooling — ✅ shipped

- **`npm run finalize`** — CI coverage self-check, full ops audit, smoke, manual walkthrough prompts
- **Lighthouse** — block Firestore long-polling URLs to avoid CI/local timeouts
- **Tests** — `galleryApproveNotify`, `recipeImagePrompts` re-export coverage

### Batch 16 (prior)

- **`/api/notify`**, **`/api/webhook`**, **`/api/gemini`** were crashing on Vercel cold start (`FUNCTION_INVOCATION_FAILED`) due to ESM import paths without `.js` extensions and an out-of-tree `shared/` import for Gemini prompts.
- Fixed relative imports; added `api/lib/recipeImagePrompts.ts` re-export for serverless bundling.
- Production smoke: **9/9 passing** including `/api/notify` (401 without secret).

### Productionize tooling — ✅ shipped

- **`npm run productionize`** — full audit: ops, notify, Sentry, FCM, App Check, text-to-gallery, smoke
- **`configure:fcm`** / **`configure:app-check`** — audit + `--apply` to Vercel
- **Smoke** — `/api/notify` route check (405 GET / 401 POST without secret)
- **`scripts/lib/vercel-env.mjs`** — shared Vercel env apply helpers

### Batch 15 (prior)

- **`npm run next-steps`**, gallery E2E approve flow, recipe card photo fix, notify secrets

## Ops status

- [x] Firestore rules + Firebase Storage
- [x] Gallery uploads enabled on Vercel
- [x] Gallery upload E2E (local provider)
- [x] Push notify secrets on Vercel
- [x] `/api/notify` smoke check (401 without secret)
- [x] `/api/gemini` and `/api/webhook` routes load on Vercel
- [ ] **Sentry** — `VITE_SENTRY_DSN` in `.env.local` → `npm run configure:sentry -- --apply`
- [ ] **FCM** — sender ID, app ID, VAPID in `.env.local` → `npm run configure:fcm -- --apply`
- [ ] **App Check** — site key in `.env.local` → `npm run configure:app-check -- --apply`
- [ ] **Firestore contributor migration** — `FIREBASE_SERVICE_ACCOUNT` → `productionize --migrate --yes`
- [ ] **Live prod gallery upload** — manual once (Firebase-backed, not local E2E)
- [ ] **Lighthouse** — `npm run productionize -- --lighthouse`

### Ops scripts

| Script | Purpose |
|--------|---------|
| `npm run finalize` | Pre-launch: CI coverage + ops + smoke + walkthrough |
| `npm run productionize` | Full production readiness pass |
| `npm run next-steps` | Lighter checklist (verify, audits, smoke) |
| `npm run configure:sentry` | Sentry DSN audit/apply |
| `npm run configure:fcm` | FCM client vars audit/apply |
| `npm run configure:app-check` | App Check site key audit/apply |
| `npm run configure:notify` | Notify secrets audit/apply |
| `npm run configure:text-to-gallery` | Twilio + archive phone audit |
| `npm run smoke:prod` | Post-deploy health checks |

## Explicitly deferred

- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
