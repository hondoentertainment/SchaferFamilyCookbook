# Recommended Next Steps

_Last updated: 2026-06-26 (batch 10 — gallery moderation)_

## Recently shipped (June 2026 — batch 10)

### Gallery moderation queue — ✅ shipped

- **Pending status** — community uploads create `status: 'pending'`; MMS/admin uploads stay `approved`
- **Public filter** — gallery grid shows approved items + viewer's own pending submissions
- **Admin approve** — pending queue + Approve buttons in Admin → Gallery
- **Rules** — Firestore community create requires `status: 'pending'`

### Batch 9 (prior)

- Community gallery upload panel, Firestore rules deployed, offline queue, rate limit, E2E

## Ops status

- [x] Firestore rules (gallery create + moderation) — redeploy after batch 10: `npm run deploy:firebase-rules`
- [ ] **Firebase Storage enable** — [Console → Storage](https://console.firebase.google.com/project/schafer-cookbook/storage) then `npm run deploy:firebase-rules`
- [ ] **Live upload test** — family member upload after Storage is enabled
- [ ] **Sentry** — `VITE_SENTRY_DSN` on Vercel (+ optional source-map vars)
- [ ] **Push (optional)** — FCM env vars
- [ ] **Lighthouse review** — next CI artifact
- [ ] **Recipe images** — `npm run images:batch` (`GEMINI_API_KEY`)

Run `npm run verify:vercel-env` after Vercel env changes.

## Explicitly deferred

- Firebase App Check
- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
