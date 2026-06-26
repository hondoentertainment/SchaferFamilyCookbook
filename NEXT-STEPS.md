# Recommended Next Steps

_Last updated: 2026-06-26 (batch 4)_

## Recently shipped (June 2026 — batch 4)

### UX consistency & scroll reduction — ✅ shipped

- Shared **`PageHeader`**, **`CollapsiblePanel`**, and **`view-shell`** layout utilities
- **Meal Plan** accordion days (today expanded by default)
- **Grocery List** collapses checked items; **Profile** activity tabs + collapsible family feed
- **Help** & **Privacy** use collapsible sections; tighter spacing on Home & Contributors

### Vercel env hygiene — ✅ shipped

- Removed misnamed env var (`AIzaSy…` used as the variable name)
- `npm run verify:vercel-env` now fails on misnamed keys and lists optional push vars

## Recently shipped (batch 3)

- Production Firebase bootstrap from `VITE_FIREBASE_*` in `.env.production`
- CI audit fix, Lighthouse CI artifacts, grocery-sync E2E, Vercel env verify script

## What to do next (manual — needs external consoles)

1. **Sentry** — [Create a Sentry project](https://sentry.io) → copy DSN → add on Vercel Production:
   - `VITE_SENTRY_DSN`
   - Optional: `VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=0.1`
   - Redeploy production (`vercel --prod` or push to `main`)
2. **Firebase push (optional)** — Firebase Console → add on Vercel Production:
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FCM_VAPID_KEY`
   - See `docs/FIREBASE_PUSH_NOTIFICATIONS.md`
3. **Lighthouse review** — download artifact from the next **Lighthouse CI** GitHub Action run; tune `lighthouserc.cjs` if scores drift

## Explicitly deferred

- Real OAuth/email auth for guests
- Full offline recipe text cache
- Gamification (trivia streaks, badges)
- Multi-tenant / site forks
