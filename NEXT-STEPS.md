# Recommended Next Steps

_Last updated: 2026-07-04 (batch 15 — next-steps automation)_

## Recently shipped (July 2026 — batch 15)

### Next-steps automation — ✅ shipped

- **`npm run next-steps`** — ops verify, notify/Sentry audit, contributor dry-run, smoke:prod
- **`npm run next-steps -- --apply`** — also applies notify secrets (and Sentry DSN if in `.env.local`)
- **`npm run configure:sentry`** — audit + optional `--apply` for `VITE_SENTRY_DSN`
- **`configure:notify --apply`** — auto-set matching `NOTIFY_SECRET` + `VITE_NOTIFY_SECRET` on Vercel
- **E2E** — gallery upload→approve flow, recipe card photo visibility (opacity), returning login

### Recipe card photos — ✅ shipped (batch 15)

- Cached images no longer stuck at `opacity-0`
- Grid cards show actual photos (not category-only fallback for handwritten scans)

## Recently shipped (June 2026 — batch 14)

### Recipe page UX — ✅ shipped

- **Prev/next recipe navigation** — desktop chevrons + mobile Previous/Next row
- **Cook tab** — step checkboxes, progress bar, step-by-step CTA, auto-scroll to instructions
- **Mobile jump links** — Jump to ingredients / Jump to steps (Read + Cook modes)
- **Ingredient & step checkoffs** — clear buttons; session persistence per recipe
- **Contributor browse** — tap byline to filter Recipes by contributor
- **Total time** — prep + cook combined in header meta when parseable
- **Tab keyboard nav** — arrow keys on Read/Cook/Share tabs

## Ops status

- [x] Firestore rules (gallery create + moderation)
- [x] **Firebase Storage** — enabled; rules deploy via `npm run verify:storage`
- [x] **Vercel `VITE_GALLERY_UPLOADS_ENABLED=true`** — set; smoke confirms upload bundle
- [x] **Gallery upload E2E** — upload → pending → admin approve → public (`e2e/gallery-flow.spec.ts`)
- [ ] **Live upload test on production** — manual once against Firebase-backed prod (not local-only E2E)
- [ ] **Firestore contributor migration** — needs `FIREBASE_SERVICE_ACCOUNT` in `.env.local`
- [x] **Push notify secrets** — applied via `npm run configure:notify -- --apply` (redeploy to activate)
- [ ] **Sentry** — add DSN to `.env.local`, then `npm run configure:sentry -- --apply`
- [ ] **FCM (optional)** — messaging sender ID, app ID, VAPID key
- [ ] **App Check (optional)** — `VITE_FIREBASE_APP_CHECK_SITE_KEY`
- [ ] **Lighthouse review** — `npm run next-steps -- --lighthouse` or CI artifact

Run `npm run next-steps` after Vercel or Firebase console changes.

### Ops scripts

| Script | Purpose |
|--------|---------|
| `npm run next-steps` | Full checklist (verify, audits, smoke) |
| `npm run next-steps -- --apply` | Above + apply notify (+ Sentry if DSN in env) |
| `npm run verify:ops` | Vercel env audit + Storage check |
| `npm run configure:notify` | Audit/generate/apply notify secrets |
| `npm run configure:sentry` | Audit/apply Sentry DSN |
| `npm run normalize:contributors:dry-run` | Preview Firestore name merges |
| `npm run smoke:prod` | Post-deploy health + gallery bundle smoke |

## Explicitly deferred

- Real OAuth for guests
- Gamification, multi-tenant, full offline-first sync
