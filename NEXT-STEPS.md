# Recommended Next Steps

_Last updated: 2026-06-26 (batch 11 — gallery moderation polish & ops)_

## Recently shipped (June 2026 — batch 11)

### Gallery moderation polish — ✅ shipped

- **Decline flow** — custodians can reject pending submissions (Admin → Gallery)
- **Contributor filter** — Gallery tab dropdown; Contributors → “View photos” deep-link
- **Pending badge** — Profile “Open Admin Tools” shows count awaiting approval
- **Ops scripts** — `npm run verify:storage`, `npm run verify:ops`
- **App Check (optional)** — wired when `VITE_FIREBASE_APP_CHECK_SITE_KEY` is set in production

### Batch 10 (prior)

- Pending status, public filter, admin approve, Firestore rules for `status: 'pending'`

### Batch 9 (prior)

- Community gallery upload panel, offline queue, rate limit, E2E

## Ops status

- [x] Firestore rules (gallery create + moderation)
- [ ] **Firebase Storage enable** — [Console → Storage](https://console.firebase.google.com/project/schafer-cookbook/storage) then `npm run deploy:firebase-rules`
- [ ] **Live upload test** — family upload → pending → custodian approve or decline → public
- [ ] **Sentry** — `VITE_SENTRY_DSN` on Vercel (+ optional source-map vars)
- [ ] **App Check (optional)** — register reCAPTCHA v3 in Firebase Console; set `VITE_FIREBASE_APP_CHECK_SITE_KEY`
- [ ] **Push (optional)** — FCM env vars
- [ ] **Lighthouse review** — next CI artifact
- [ ] **Recipe images** — `npm run images:batch` (`GEMINI_API_KEY`)

Run `npm run verify:ops` after Vercel or Firebase console changes.

## Explicitly deferred

- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
