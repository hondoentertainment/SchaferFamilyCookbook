# Recommended Next Steps

_Last updated: 2026-06-26 (batch 7)_

## Recently shipped (June 2026 — batch 7)

### Offline, sync clarity & story publish — ✅ shipped

- **Offline v3** — “Offline” badge on recipe cards after IndexedDB cache; Help tip updated
- **Prefs sync status** — Profile banners for syncing, synced, and error when Firebase is connected
- **Family Story publish** — Admin draft vs published workflow; “Publish to family” + revert to published
- **Trivia** — five more Family Story questions (`t28`–`t32`); Firebase auto-merges missing seed questions
- **Help** — Custodian ops checklist (Sentry, env audit, Lighthouse, images, push)
- **Tests** — `storySections.test.ts`

### Batch 6 (prior)

- Sentry test hook, offline cook banner, Lighthouse mobile+desktop, guest local-only notice

## What to do next (manual — needs external consoles)

1. **Sentry DSN** — add `VITE_SENTRY_DSN` on Vercel Production, then Help → Troubleshooting → test event
2. **Sentry source maps** — `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` on Vercel (build env)
3. **Firebase push (optional)** — `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FCM_VAPID_KEY`
4. **Lighthouse review** — download the next CI artifact (mobile + desktop)
5. **Recipe images** — `npm run images:batch` for fallback cards (`GEMINI_API_KEY` required)

Run `npm run verify:vercel-env` after any Vercel env change. See Help → **Custodian ops checklist** in the app.

## Explicitly deferred

- Real OAuth/email auth for guests
- Gamification (trivia streaks, badges)
- Multi-tenant / site forks
- Full offline-first sync layer (badges + IDB cache only)
