# Recommended Next Steps

_Last updated: 2026-06-26 (batch 12 — UX polish, contributor names, gallery ops)_

## Recently shipped (June 2026 — batch 12)

### UX polish — ✅ shipped

- **Gallery filter chip** — sticky “Showing X’s photos · Clear” when filtered
- **Upload-unavailable banner** — until `VITE_GALLERY_UPLOADS_ENABLED=true`
- **Recipe card CTA hierarchy** — Start Cooking primary; View secondary
- **Admin pending toast** — once per session when gallery items await approval
- **Mobile 5-tab nav** — A–Z under Recipes sub-nav
- **Family sub-nav hint** — dismissible first-visit banner
- **Handwritten-card grid fallback** — category art in grid; full card in modal
- **Profile sync copy** — plain-language cloud sync message

### Contributor normalization — ✅ shipped

- **Canonical names** — Dawn, Harriet, Wren (merged aliases)
- **Gallery filter dedupe** — one entry per contributor in dropdown
- **Firestore migration script** — `npm run normalize:contributors:dry-run` then `npm run normalize:contributors`

### Gallery approve push — ✅ shipped (when FCM configured)

- **Targeted notify** — `/api/notify` accepts `userName`; admin approve triggers push to uploader
- Requires `NOTIFY_SECRET`, `VITE_NOTIFY_SECRET`, and FCM tokens in `fcm_tokens`

### Batch 11 (prior)

- Gallery decline, contributor filter, pending admin badge, ops scripts

## Ops status

- [x] Firestore rules (gallery create + moderation)
- [x] **Firebase Storage** — enabled; rules deploy via `npm run verify:storage`
- [ ] **Vercel `VITE_GALLERY_UPLOADS_ENABLED=true`** — enables upload panel in production (set + redeploy)
- [ ] **Live upload test** — family upload → pending → custodian approve → public (+ optional push)
- [ ] **Firestore contributor migration** — `npm run normalize:contributors` with `FIREBASE_WEB_CONFIG`
- [ ] **Sentry** — `VITE_SENTRY_DSN` on Vercel (+ optional source-map vars)
- [ ] **Push notify secrets** — `NOTIFY_SECRET` + `VITE_NOTIFY_SECRET` (same value)
- [ ] **App Check (optional)** — `VITE_FIREBASE_APP_CHECK_SITE_KEY`
- [ ] **FCM (optional)** — `VITE_FCM_VAPID_KEY`, messaging sender ID, app ID
- [ ] **Lighthouse review** — CI artifact in `.lighthouseci/` (2 runs per preset)

Run `npm run verify:ops` after Vercel or Firebase console changes.

## Explicitly deferred

- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
