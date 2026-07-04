# Recommended Next Steps

_Last updated: 2026-07-04 (batch 15 — ops run complete; PR #64 in review)_

## In review (July 2026 — PR #64)

### Shared family ratings & notes — code complete, needs rules deploy

- **Family-wide aggregate** — every client fetches all `userPrefs` docs (already world-readable by design) into a local cache (`familyPrefs:v1`); recipe averages, "Family Approved", "Cooked by N", and Family Notes now reflect the *whole family*, not just this device
- **Notes + displayName sync** — `userPrefs` docs now carry `notes` (RecipeNote list), `deletedNoteIds` tombstones, and `displayName`; merged on login like other prefs
- **⚠️ Owner action — deploy updated Firestore rules** (`firebase deploy --only firestore:rules`), ideally before or immediately after merge. Until the new rules are live, clients whose full write is rejected automatically retry with the legacy payload shape (favorites/ratings/collections/meal plan/grocery keep syncing; notes/displayName wait for the rules)

### Printable heirloom cookbook — shipped in PR

- **Print the family cookbook** button (Recipes hero, desktop + mobile) → cover, table of contents, category chapters, one-recipe-per-block print layout; browser print dialog does PDF export

### Recipe Cook tab (earlier commits on PR #64)

- **Step timers** — "Start N-min timer" chips on instruction cards with countdown + toast
- **Wake lock** — screen stays awake in Cook tab; re-acquired after tab switches
- **Scaled-servings indicator** — "Quantities scaled for N — original serves M" + Reset

### CI / e2e (PR #64 + issue #65)

- **trivia.spec repaired** (6/6), e2e sharded per browser, live line reporter
- **e2e advisory** (`continue-on-error` + 35-min `globalTimeout`) until the suite repair in **#65** lands

## Recently shipped (July 2026 — batch 15)

### Next-steps automation — ✅ shipped

- **`npm run next-steps`** — ops verify, notify/Sentry audit, contributor dry-run, smoke:prod
- **`npm run next-steps -- --apply`** — also applies notify secrets (and Sentry DSN if in `.env.local`)
- **`npm run configure:sentry`** — audit + optional `--apply` for `VITE_SENTRY_DSN`
- **`configure:notify --apply`** — auto-set matching `NOTIFY_SECRET` + `VITE_NOTIFY_SECRET` on Vercel
- **E2E** — gallery upload→approve flow (`e2e/gallery-flow.spec.ts`), recipe card photo visibility, returning login
- **E2E fix** — `goToAdminTools()` expands the Profile admin collapsible before interacting with subtabs

### Recipe card photos — ✅ shipped (batch 15)

- Cached images no longer stuck at `opacity-0`
- Grid cards show actual photos (not category-only fallback for handwritten scans)

## Recently shipped (June 2026 — batch 14)

### Recipe page UX — ✅ shipped

- **Prev/next recipe navigation** — desktop chevrons + mobile Previous/Next row
- **Cook tab** — step checkboxes, progress bar, step-by-step CTA, auto-scroll to instructions
- **Mobile jump links** — Jump to ingredients / Jump to steps (Read + Cook modes)
- **Ingredient & step checkoffs** — clear buttons; session persistence per recipe
- **Contributor browse** — tap byline to filter Recipes by contributor
- **Total time** — prep + cook combined in header meta when parseable
- **Tab keyboard nav** — arrow keys on Read/Cook/Share tabs

## Ops status

- [x] Firestore rules (gallery create + moderation)
- [x] **Firebase Storage** — enabled; rules deploy via `npm run verify:storage`
- [x] **Vercel `VITE_GALLERY_UPLOADS_ENABLED=true`** — set; smoke confirms upload bundle
- [x] **Gallery upload E2E** — upload → pending → admin approve → public (`e2e/gallery-flow.spec.ts`)
- [ ] **Live upload test on production** — manual once against Firebase-backed prod (not local-only E2E)
- [ ] **Firestore contributor migration** — paste `FIREBASE_SERVICE_ACCOUNT` JSON into `.env.local` (Vercel pull omits encrypted values)
- [x] **Push notify secrets** — applied via `npm run configure:notify -- --apply` (redeploy to activate)
- [ ] **Sentry** — add DSN to `.env.local`, then `npm run configure:sentry -- --apply`
- [ ] **FCM (optional)** — messaging sender ID, app ID, VAPID key
- [ ] **App Check (optional)** — `VITE_FIREBASE_APP_CHECK_SITE_KEY`
- [ ] **Lighthouse review** — `npm run next-steps -- --lighthouse` or CI artifact

Run `npm run next-steps` after Vercel or Firebase console changes.

### Ops scripts

| Script | Purpose |
|--------|---------|
| `npm run next-steps` | Full checklist (verify, audits, smoke) |
| `npm run next-steps -- --apply` | Above + apply notify (+ Sentry if DSN in env) |
| `npm run verify:ops` | Vercel env audit + Storage check |
| `npm run configure:notify` | Audit/generate/apply notify secrets |
| `npm run configure:sentry` | Audit/apply Sentry DSN |
| `npm run normalize:contributors:dry-run` | Preview Firestore name merges |
| `npm run smoke:prod` | Post-deploy health + gallery bundle smoke |

## Explicitly deferred

- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
