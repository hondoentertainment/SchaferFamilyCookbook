# Recommended Next Steps

_Last updated: 2026-07-19 (batch 21 — Recipe of the Week weekly push)_

## Shipped (July 2026 — batch 21)

### Recipe of the Week push — ✅ built, dormant until FCM VAPID key

- **`/api/recipe-of-the-week`** — Vercel Cron (Sun 15:00 UTC, see `vercel.json` `crons`) picks the same deterministic ISO-week recipe HomeView features and fans it out to all `fcm_tokens` (chunked at 500/multicast)
- Auth: `Authorization: Bearer $CRON_SECRET` (Vercel Cron) or `x-notify-secret` for manual runs; `?dryRun=1&date=YYYY-MM-DD` previews a week's pick without sending
- Pick logic unified in `shared/recipeOfTheWeek.mjs` (HomeView + cron use one implementation)
- `firebase-messaging-sw.js` — notification click now deep-links to the recipe share page
- **To activate**: set `CRON_SECRET` on Vercel + apply `VITE_FCM_VAPID_KEY` (`configure:fcm -- --apply`)

## Finalize (recommended before family launch)

```bash
npm run bootstrap:credentials
npm run configure:firebase-web -- --apply   # SDK config → Vercel (done)
npm run custodian:runbook                   # ops + smoke + printed walkthrough
npm run finalize -- --apply --deploy       # after adding remaining secrets to .env.local
```

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

- [x] Firestore rules + Firebase Storage (incl. `notes` / `displayName`)
- [x] Gallery uploads + E2E
- [x] Notify secrets + `/api/notify` route
- [x] Firebase web client vars on Vercel (incl. FCM sender ID + app ID)
- [x] Lighthouse CI runnable (headless)
- [ ] **`VITE_FCM_VAPID_KEY`** — Firebase Console → Cloud Messaging → Web Push certificates → `configure:fcm -- --apply`
- [ ] **`CRON_SECRET`** — any long random string on Vercel (activates weekly Recipe of the Week push)
- [ ] **Sentry** — `VITE_SENTRY_DSN` → `configure:sentry -- --apply`
- [ ] **App Check** — reCAPTCHA v3 site key → `configure:app-check -- --apply`
- [ ] **Contributor migration** — paste `FIREBASE_SERVICE_ACCOUNT` JSON into `.env.local` → `finalize --migrate --yes`
- [ ] **Live prod gallery upload** — `custodian:runbook` walkthrough (human)
- [ ] **Text-to-gallery** — `TWILIO_ACCOUNT_SID` + `VITE_ARCHIVE_PHONE`

## Explicitly deferred

- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
