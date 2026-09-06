# Recommended Next Steps

_Last updated: 2026-09-06 (audit — code complete; remaining items are Kyle secrets / human walkthrough)_

## Audit (2026-09-06)

Product items from FEATURE-ROADMAP “Immediate Next Steps” and FEATURE-PLAN-NEXT-2-WEEKS (meal plan polish, Story CMS polish, fuzzy search, Lighthouse CI workflow) are **already shipped in code**. Prod is live at https://schafer-family-cookbook.vercel.app (`GET /api/ping` → 200 `ok`).

What was still *unchecked* in this file (2026-07-19) is **not unfinished app work**. It is ops secrets and one live walkthrough that only Kyle can finish. This pass:

- Added `npm run configure:cron` so `CRON_SECRET` has the same generate/apply path as notify
- Wired cron / Sentry / FCM / App Check / Twilio into `next-steps`, `finalize`, `bootstrap:credentials`, and `verify:vercel-env`
- Documented Lighthouse CI (monthly + `gh workflow run "Lighthouse CI"`)
- Superseded Dependabot **#131** (testing group) — that PR failed `npm ci` because it jumped **vitest 4 → 5** while leaving `@vitest/coverage-v8@4` / `@vitest/ui@4` (ERESOLVE). Safe patches (`@testing-library/user-event`, `happy-dom`) are in this branch; vitest 5 and **#130** (`@vercel/node` 10 → 12) stay out

## Shipped (July 2026 — batch 21)

### Recipe of the Week push — ✅ built, dormant until Kyle sets secrets

- **`/api/recipe-of-the-week`** — Vercel Cron (Sun 15:00 UTC, see `vercel.json` `crons`) picks the same deterministic ISO-week recipe HomeView features and fans it out to all `fcm_tokens` (chunked at 500/multicast)
- Auth: `Authorization: Bearer $CRON_SECRET` (Vercel Cron) or `x-notify-secret` for manual runs; `?dryRun=1&date=YYYY-MM-DD` previews a week's pick without sending
- Pick logic unified in `shared/recipeOfTheWeek.mjs` (HomeView + cron use one implementation)
- `firebase-messaging-sw.js` — notification click now deep-links to the recipe share page
- **To activate**: `npm run configure:cron -- --apply` + `npm run configure:fcm -- --apply` (needs `VITE_FCM_VAPID_KEY`)

## Finalize (recommended before family launch)

```bash
npm run bootstrap:credentials
npm run configure:firebase-web -- --apply   # SDK config → Vercel (done)
npm run configure:cron -- --apply           # generates CRON_SECRET if missing; sets Vercel only
npm run custodian:runbook                   # ops + smoke + printed walkthrough
npm run finalize -- --apply --deploy       # after adding remaining secrets to .env.local
```

`npm run next-steps` re-audits ops + optional secrets and prints the Kyle checklist. `--apply` pushes any values already in `.env.local`. `--lighthouse` runs a local LHCI pass.

## Shipped (July 2026 — batch 20)

### Firebase web client config — ✅ applied to Vercel

- Created Firebase WEB app **Schafer Family Cookbook**
- Applied to Vercel Production: `VITE_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`
- **`npm run configure:firebase-web`** — re-fetch sdkconfig + optional `--apply`
- Auth E2E fix — returning login matches `Continue as …` CTA / name chips
- Custodian runbook — Windows `Program Files` path fix; credential checklist is informational

### Batch 19 (prior)

- `bootstrap:credentials`, `custodian:runbook`, smoke Pages retries, Lighthouse headless Chrome

## Ops status

### Code / platform (done)

- [x] Firestore rules + Firebase Storage (incl. `notes` / `displayName`)
- [x] Gallery uploads + E2E
- [x] Notify secrets + `/api/notify` route
- [x] Firebase web client vars on Vercel (incl. FCM sender ID + app ID)
- [x] Recipe of the Week cron **route + schedule** (`/api/recipe-of-the-week`, `vercel.json` `crons`)
- [x] `configure:cron` / `configure:fcm` / `configure:sentry` / `configure:app-check` apply paths
- [x] Lighthouse CI runnable (headless Chrome, monthly schedule + workflow_dispatch)

### Still needs Kyle (secrets / human — do not invent values in git)

- [ ] **`VITE_FCM_VAPID_KEY`** — Firebase Console → Cloud Messaging → Web Push certificates → paste into `.env.local` → `npm run configure:fcm -- --apply`
- [ ] **`CRON_SECRET`** — `npm run configure:cron -- --apply` (generates a random string and sets Vercel production; activates weekly Recipe of the Week *auth*; FCM still needed to deliver)
- [ ] **Sentry** — create a React project DSN → `.env.local` `VITE_SENTRY_DSN` → `npm run configure:sentry -- --apply`
- [ ] **App Check** — Firebase Console → App Check → reCAPTCHA v3 site key → `npm run configure:app-check -- --apply`
- [ ] **Contributor migration** — paste `FIREBASE_SERVICE_ACCOUNT` JSON into `.env.local` → `npm run finalize -- --migrate --yes`
- [ ] **Live prod gallery upload** — `npm run custodian:runbook` then family upload → approve on production
- [ ] **Text-to-gallery** — `TWILIO_ACCOUNT_SID` + `VITE_ARCHIVE_PHONE` (and `TWILIO_AUTH_TOKEN` on Vercel) → `npm run configure:text-to-gallery`

## Explicitly deferred

- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
- Vitest 5 / `@vercel/node` 12 major upgrades (Dependabot #130 / #131) — leave until a dedicated migration
