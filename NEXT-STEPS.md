# Recommended Next Steps

_Last updated: 2026-06-26 (batch 9 — community gallery)_

## Recently shipped (June 2026 — batch 9)

### Community gallery uploads — ✅ shipped

- **Gallery upload panel** — family members upload photos/videos from the Gallery tab (caption, contributor attribution)
- **Firebase rules** — append-only community create on `gallery` (Firestore + Storage); admins retain edit/delete
- **Offline queue** — queued uploads sync when back online; new items scroll into view with highlight ring
- **Guardrails** — 20 uploads/hour per contributor (client), file type/size validation, `gallery_upload` analytics + Sentry breadcrumbs
- **Docs & tests** — Help custodian checklist, E2E upload spec, rules tests, unit tests

### Batch 8 (prior)

- Unified `.btn` system, `ViewActionBar`, `PageHeader` actions across Meal Plan, Grocery, Help, Home, Collections, Trivia, Contributors

### Batch 7 (prior)

- Offline v3 badges, prefs sync banners, Family Story publish, trivia t28–t32, Help custodian checklist

## What to do next (manual — needs external consoles)

1. **Deploy gallery rules** — `firebase deploy --only firestore:rules,storage:rules --project YOUR_PROJECT_ID` (required for production uploads)
2. **Production smoke test** — non-admin upload on Gallery tab after rules deploy
3. **Sentry DSN** — add `VITE_SENTRY_DSN` on Vercel Production, then Help → Troubleshooting → test event
4. **Sentry source maps** — `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` on Vercel (build env)
5. **Firebase push (optional)** — `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FCM_VAPID_KEY`
6. **Lighthouse review** — download the next CI artifact (mobile + desktop)
7. **Recipe images** — `npm run images:batch` for fallback cards (`GEMINI_API_KEY` required)

Run `npm run verify:vercel-env` after any Vercel env change. See Help → **Custodian ops checklist** in the app.

## Explicitly deferred

- Gallery moderation queue (pending → approved)
- Real OAuth/email auth for guests
- Gamification (trivia streaks, badges)
- Multi-tenant / site forks
- Full offline-first sync layer (badges + IDB cache only)
- Firebase App Check (optional hardening for open gallery writes)
