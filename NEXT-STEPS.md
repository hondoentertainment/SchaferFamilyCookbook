# Recommended Next Steps

_Last updated: 2026-06-26 (batch 6)_

## Recently shipped (June 2026 — batch 6)

### Ops, reliability & clarity — ✅ shipped

- **Sentry test hook** — Help → Troubleshooting → “Send Sentry test event” (when `VITE_SENTRY_DSN` is set)
- **Guest prefs clarity** — Profile notice when family cloud is not connected (local-only sync)
- **Offline cook v2** — Cook Mode banner when using IndexedDB saved copy or offline
- **Help** — Cook Mode Listen/TTS tips; troubleshooting section
- **Lighthouse CI** — desktop + mobile preset runs in `lighthouserc.cjs`
- **Vercel env script** — hints for Sentry source-map build vars when DSN is present
- **Trivia** — two Family Story–linked questions (`t26`, `t27`)

### Batch 5 (prior)

- Gallery/Trivia/Recipes/History shells; Home shelf tabs; meal-plan sticky footer; recipe modal mobile collapse; offline IDB cache; E2E `ux-collapsible.spec.ts`

## What to do next (manual — needs external consoles)

1. **Sentry DSN** — add `VITE_SENTRY_DSN` on Vercel Production, then use Help → Troubleshooting to verify
2. **Sentry source maps** — add `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` on Vercel (build env)
3. **Firebase push (optional)** — `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FCM_VAPID_KEY`
4. **Lighthouse review** — download the next CI artifact (now includes mobile + desktop)
5. **Recipe images** — `npm run images:batch` for fallback cards

## Explicitly deferred

- Real OAuth/email auth for guests
- Gamification (trivia streaks, badges)
- Multi-tenant / site forks
- Family Story CMS publish workflow (preview already exists in Admin)
