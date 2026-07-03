# Recommended Next Steps

_Last updated: 2026-07-03 (batch 14 deployed + ops)_

## Recently shipped (June 2026 — batch 14)

### Recipe page UX — ✅ shipped

- **Prev/next recipe navigation** — desktop chevrons + mobile Previous/Next row
- **Cook tab** — step checkboxes, progress bar, step-by-step CTA, auto-scroll to instructions
- **Mobile jump links** — Jump to ingredients / Jump to steps (Read + Cook modes)
- **Ingredient & step checkoffs** — clear buttons; session persistence per recipe
- **Contributor browse** — tap byline to filter Recipes by contributor
- **Total time** — prep + cook combined in header meta when parseable
- **Tab keyboard nav** — arrow keys on Read/Cook/Share tabs (does not conflict with recipe prev/next)

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
- [x] **Vercel `VITE_GALLERY_UPLOADS_ENABLED=true`** — set on Vercel; production redeployed 2026-07-03 (`npm run smoke:prod` confirms upload bundle)
- [ ] **Live upload test** — family upload → pending → custodian approve → public (+ optional push)
- [ ] **Firestore contributor migration** — `npm run normalize:contributors:dry-run` then live (needs `FIREBASE_SERVICE_ACCOUNT` locally — not in `vercel env pull`)
- [ ] **Sentry** — `VITE_SENTRY_DSN` on Vercel (+ optional source-map vars)
- [ ] **Push notify secrets** — `NOTIFY_SECRET` + `VITE_NOTIFY_SECRET` (`npm run configure:notify -- --generate`)
- [ ] **App Check (optional)** — `VITE_FIREBASE_APP_CHECK_SITE_KEY`
- [ ] **FCM (optional)** — `VITE_FCM_VAPID_KEY`, messaging sender ID, app ID
- [ ] **Lighthouse review** — CI artifact in `.lighthouseci/` (2 runs per preset)

Run `npm run verify:ops` after Vercel or Firebase console changes.

### Ops scripts (batch 14)

| Script | Purpose |
|--------|---------|
| `npm run verify:ops` | Vercel env audit + Storage check |
| `npm run verify:vercel-env` | Deep check incl. gallery uploads flag |
| `npm run fix:gallery-uploads-env` | Re-set `VITE_GALLERY_UPLOADS_ENABLED=true` on production |
| `npm run configure:notify` | Audit/generate notify + FCM secrets |
| `npm run normalize:contributors:dry-run` | Preview Firestore name merges (admin SDK) |
| `npm run smoke:prod` | Post-deploy health + gallery bundle smoke |

## Explicitly deferred

- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
