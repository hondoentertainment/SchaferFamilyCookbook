# Recommended Next Steps

_Last updated: 2026-07-17 (batch 18 — next-steps close-out)_

## Finalize (recommended before family launch)

```bash
npm run finalize                    # CI coverage + ops audit + smoke
npm run finalize -- --pull-env      # also vercel env pull before audits
npm run finalize -- --apply         # push .env.local vars to Vercel
npm run finalize -- --deploy        # Vercel production deploy
npm run finalize -- --all           # pull-env + apply + migrate dry-run + deploy + lighthouse
npm run finalize -- --migrate --yes # live contributor migration (needs FIREBASE_SERVICE_ACCOUNT)
```

## Shipped (July 2026 — batch 18)

### Next-steps close-out — ✅ shipped

- **Critical npm audit** — `websocket-driver` bumped; CI critical gate clear
- **PR #66 merged** — scan-a-recipe-card photo import + `useUserPrefsSync` test suite
- **Firestore + Storage rules deployed** to `schafer-cookbook` (`notes` / `displayName` live)
- **Help** — tips for print cookbook, step timers, family notes; custodian rules verify step
- **Smoke** — launch feature bundle markers (print, timers, Family Notes)
- **E2E** — printable cookbook overlay + Cook-tab step timer

### Batch 17 (prior)

- **`npm run finalize`**, Lighthouse Firestore URL blocks, gallery approve notify tests

## Shipped (July 2026 — PR #64, merged 2026-07-07)

Deployed to Vercel prod + GitHub Pages (smoke green on merge).

### Shared family ratings & notes

- **Family-wide aggregate** via `userPrefs` + `familyPrefs:v1`
- **Notes + displayName sync** with tombstones
- **Firestore rules deploy** — ✅ live (2026-07-17)

### Printable heirloom cookbook / Cook tab

- Print overlay, step timers, wake lock, scaled-servings indicator

## Ops status

- [x] Firestore rules + Firebase Storage (incl. `notes` / `displayName`)
- [x] Gallery uploads enabled on Vercel
- [x] Gallery upload E2E (local provider)
- [x] Push notify secrets on Vercel
- [x] `/api/notify` smoke check (401 without secret)
- [x] `/api/gemini` and `/api/webhook` routes load on Vercel
- [x] Critical dependency audit clear
- [x] Scan recipe card photo import (PR #66)
- [ ] **Sentry** — `VITE_SENTRY_DSN` in `.env.local` → `npm run configure:sentry -- --apply`
- [ ] **FCM** — sender ID, app ID, VAPID in `.env.local` → `npm run configure:fcm -- --apply`
- [ ] **App Check** — site key in `.env.local` → `npm run configure:app-check -- --apply`
- [ ] **Firestore contributor migration** — paste `FIREBASE_SERVICE_ACCOUNT` JSON into `.env.local` (Vercel pull omits encrypted values) → `npm run finalize -- --migrate --yes`
- [ ] **Live prod gallery upload** — manual once (Firebase-backed, not local E2E)
- [ ] **Text-to-gallery** — `TWILIO_ACCOUNT_SID` + `VITE_ARCHIVE_PHONE`
- [ ] **Lighthouse** — `npm run finalize -- --lighthouse` or monthly GitHub Actions job

### Ops scripts

| Script | Purpose |
|--------|---------|
| `npm run finalize` | Pre-launch: CI coverage + ops + smoke + walkthrough |
| `npm run productionize` | Full production readiness pass |
| `npm run next-steps` | Lighter checklist (verify, audits, smoke) |
| `npm run deploy:firebase-rules` | Deploy Firestore + Storage rules |
| `npm run configure:sentry` | Sentry DSN audit/apply |
| `npm run configure:fcm` | FCM client vars audit/apply |
| `npm run configure:app-check` | App Check site key audit/apply |
| `npm run configure:notify` | Notify secrets audit/apply |
| `npm run configure:text-to-gallery` | Twilio + archive phone audit |
| `npm run smoke:prod` | Post-deploy health checks |

## Explicitly deferred

- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
