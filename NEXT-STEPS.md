# Recommended Next Steps

_Last updated: 2026-07-18 (batch 19 — credentials bootstrap + smoke hardening)_

## Finalize (recommended before family launch)

```bash
npm run bootstrap:credentials       # guided secret checklist
npm run custodian:runbook           # ops + smoke + printed walkthrough
npm run finalize                    # CI coverage + ops audit + smoke
npm run finalize -- --apply --deploy   # after filling .env.local
npm run finalize -- --migrate --yes    # needs FIREBASE_SERVICE_ACCOUNT in .env.local
```

## Shipped (July 2026 — batch 19)

### Launch tooling — ✅ shipped

- **`npm run bootstrap:credentials`** — validates local secrets + shows where to get each one
- **`npm run custodian:runbook`** — ops/smoke + family launch walkthrough checklist
- **Smoke hardening** — GitHub Pages image retries on 502/503; CI smoke waits 45s for Pages propagation
- **Lighthouse** — workflow dispatchable; Firestore URLs blocked in `lighthouserc.cjs`

### Batch 18 (prior)

- Critical npm audit clear, PR #66 photo import, Firestore rules for notes deployed, print/timer E2E

## Ops status

- [x] Firestore rules + Firebase Storage (incl. `notes` / `displayName`)
- [x] Gallery uploads enabled on Vercel
- [x] Gallery upload E2E (local provider)
- [x] Push notify secrets on Vercel
- [x] `/api/notify` / `/api/gemini` / `/api/webhook` routes load
- [x] Critical dependency audit clear
- [x] Scan recipe card photo import
- [x] GitHub Pages deploy + local smoke 10/10
- [ ] **Sentry** — `VITE_SENTRY_DSN` → `npm run configure:sentry -- --apply`
- [ ] **FCM** — sender ID, app ID, VAPID → `npm run configure:fcm -- --apply`
- [ ] **App Check** — site key → `npm run configure:app-check -- --apply`
- [ ] **Contributor migration** — paste `FIREBASE_SERVICE_ACCOUNT` JSON into `.env.local` → `npm run finalize -- --migrate --yes`
- [ ] **Live prod gallery upload** — manual once
- [ ] **Text-to-gallery** — `TWILIO_ACCOUNT_SID` + `VITE_ARCHIVE_PHONE`
- [ ] **Lighthouse review** — download artifact from Actions → Lighthouse CI

### Ops scripts

| Script | Purpose |
|--------|---------|
| `npm run bootstrap:credentials` | Guided secret checklist |
| `npm run custodian:runbook` | Checks + family launch walkthrough |
| `npm run finalize` | Full pre-launch automation |
| `npm run smoke:prod` | Post-deploy health checks |
| `npm run deploy:firebase-rules` | Deploy Firestore + Storage rules |

## Explicitly deferred

- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
