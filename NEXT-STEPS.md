# Recommended Next Steps

_Last updated: 2026-06-26 (batch 3)_

## Recently shipped (June 2026 — batch 3)

### Production cloud bootstrap — ✅ shipped

- Production builds with `VITE_FIREBASE_*` in `.env.production` auto-seed `schafer_firebase_config` + `schafer_active_provider=firebase` on first visit
- Family grocery / favorites / collections / meal-plan sync works without manual Admin wiring

### CI & quality — ✅ shipped

- `npm audit fix` clears critical vulnerabilities (vitest/vite/ws)
- Lighthouse CI writes `.lighthouseci` artifacts for monthly review
- `e2e/grocery-sync.spec.ts` validates Firestore emulator hydration (CI e2e job)
- `npm run verify:vercel-env` audits required Vercel env var names

## Completed earlier (batch 2)

- Grocery cloud sync, collections → grocery bulk-add, Firestore rules deployed
- Deployed to GitHub + Vercel production (`c4620ce`)

## What to do next

1. **Sentry** — create a Sentry project, add `VITE_SENTRY_DSN` on Vercel (Production), redeploy. Optional: `VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=0.1`
2. **Firebase push (optional)** — add `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_FCM_VAPID_KEY` on Vercel if you want background notifications
3. **Remove misnamed Vercel var** — delete the env entry named `AIzaSyD67h…` (raw key as name); use `VITE_FIREBASE_API_KEY` instead
4. **Lighthouse review** — download artifact from the next **Lighthouse CI** run; tune `lighthouserc.cjs` if scores drift

## Explicitly deferred

- Real OAuth/email auth for guests
- Full offline recipe text cache
- Gamification (trivia streaks, badges)
- Multi-tenant / site forks
