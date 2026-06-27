# Recommended Next Steps

_Last updated: 2026-06-26 (ops pass after batch 9)_

## Recently shipped (June 2026 — batch 9)

### Community gallery uploads — ✅ shipped

- **Gallery upload panel** — family members upload photos/videos from the Gallery tab
- **Firebase Firestore rules** — append-only community create; **deployed** to `schafer-cookbook`
- **Offline queue** — sync on reconnect + scroll/highlight new items
- **Guardrails** — rate limit, analytics, Sentry breadcrumbs, E2E tests
- **Ops tooling** — `npm run deploy:firebase-rules`, extended `smoke:prod` gallery bundle check

### Ops completed (2026-06-26)

- [x] **Git push** — batch 9 on `origin/main` (Vercel auto-deploy)
- [x] **Firestore rules deploy** — community gallery create rules live
- [x] **`npm run verify:vercel-env`** — required vars present; `VITE_SENTRY_DSN` still missing
- [ ] **Storage rules deploy** — blocked: Firebase Storage not enabled on project (enable in console, then `npm run deploy:firebase-rules`)

## What to do next (manual — needs external consoles)

1. **Enable Firebase Storage** — [Firebase Console → Storage → Get started](https://console.firebase.google.com/project/schafer-cookbook/storage), then `npm run deploy:firebase-rules` (required for production photo file uploads)
2. **Production smoke test** — Gallery tab → upload as a family member (not custodian) after Storage is live; or `npm run smoke:prod`
3. **Sentry DSN** — add `VITE_SENTRY_DSN` on Vercel Production, then Help → Troubleshooting → test event
4. **Sentry source maps** — `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` on Vercel (build env)
5. **Firebase push (optional)** — `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FCM_VAPID_KEY`
6. **Lighthouse review** — download the next CI artifact (mobile + desktop)
7. **Recipe images** — `npm run images:batch` for fallback cards (`GEMINI_API_KEY` required locally or on Vercel)

Run `npm run verify:vercel-env` after any Vercel env change. See Help → **Custodian ops checklist**.

## Explicitly deferred

- Gallery moderation queue (pending → approved)
- Real OAuth/email auth for guests
- Gamification (trivia streaks, badges)
- Multi-tenant / site forks
- Full offline-first sync layer
- Firebase App Check (optional hardening for open gallery writes)
