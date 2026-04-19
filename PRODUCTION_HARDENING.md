# Production hardening report

Branch: `worktree-agent-a3af107e`
Date: 2026-04-19

This report documents the production-hardening pass covering dependency
vulnerabilities, HTTP security headers, Firestore rules, bundle budget, and
error-monitoring coverage. All changes ship behind tests and are non-breaking.

---

## 1. Dependency vulnerability scan

`npm audit --omit=dev` before:

- 9 low, 4 moderate, 19 high, 2 critical (production tree)

Auto-fixed (`npm audit fix`, no `--force`, lockfile delta +1139 / -949 lines):

| Package | Severity | Status |
| --- | --- | --- |
| `axios` | HIGH | fixed (DoS via `__proto__` in `mergeConfig`) |
| `fast-xml-parser` | CRITICAL | fixed (catastrophic backtracking ReDoS) |
| `protobufjs` | CRITICAL | fixed (prototype pollution) |
| `node-forge` | HIGH | fixed |
| `minimatch` | HIGH | fixed |
| `follow-redirects` | MODERATE | fixed |
| `brace-expansion` | MODERATE | fixed |
| `qs` | LOW | fixed |

After fix, `npm audit --omit=dev` reports **0 high / 0 critical / 0 moderate**.

### Deferred (would require `--force`)

8 LOW advisories all live under `firebase-admin@13.6.0` (Google Cloud
transitive deps: `@google-cloud/firestore`, `@google-cloud/storage`,
`google-gax`, `retry-request`, `teeny-request`, `http-proxy-agent`,
`@tootallnate/once`, `firebase-admin` itself). The "fix" npm offers is a
**downgrade** to `firebase-admin@10.3.0`, which is itself older than the
current advisories — clearly not a real remediation. Action: track
upstream `firebase-admin` releases for a v13 patch that bumps the
internal Google Cloud SDKs.

---

## 2. Security headers (`vercel.json`)

Added a single `headers` block matching all paths. Existing rewrites
preserved verbatim.

| Header | Value |
| --- | --- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `X-Frame-Options` | `DENY` (belt + braces vs `frame-ancestors`) |
| `Content-Security-Policy-Report-Only` | see below |

### CSP (REPORT-ONLY for now)

```
default-src 'self';
script-src  'self' 'unsafe-inline'
            https://www.googletagmanager.com
            https://www.google-analytics.com
            https://accounts.google.com
            https://apis.google.com;
connect-src 'self'
            https://firestore.googleapis.com
            https://*.firebaseio.com
            https://identitytoolkit.googleapis.com
            https://securetoken.googleapis.com
            https://firebasestorage.googleapis.com
            https://storage.googleapis.com
            https://www.google-analytics.com
            https://generativelanguage.googleapis.com
            https://o*.ingest.sentry.io
            https://accounts.google.com;
img-src     'self' data: blob:
            https://example.com
            https://images.unsplash.com
            https://image.pollinations.ai
            https://api.dicebear.com
            https://randomuser.me
            https://*.googleusercontent.com
            https://firebasestorage.googleapis.com
            https://storage.googleapis.com;
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src    'self' data: https://fonts.gstatic.com;
frame-src   'self' https://accounts.google.com;
frame-ancestors 'none';
base-uri    'self';
form-action 'self';
object-src  'none'
```

Notes on the allowlist (verified against `index.html` and `src/`):

- `accounts.google.com` / `apis.google.com` — Google Sign-In (`gsi/client`, loaded from `index.html`).
- `identitytoolkit` / `securetoken` / `firebasestorage` / `storage.googleapis.com` — Firebase Auth + Firebase Storage runtime endpoints (the task's seed list omitted these; without them sign-in and uploads would be blocked when CSP is enforced).
- `image.pollinations.ai` — legacy generated images still referenced in seeded recipes.
- `*.googleusercontent.com` — Google profile photos returned by Sign-In.

### Permissions-Policy: microphone

The CookMode and forthcoming MealPlan voice-control features will need
`microphone=(self)`. **Left disabled this pass** so production isn't
opening up an attack surface that isn't shipping yet. When the voice
feature lands, change to `microphone=(self)` and add a feature-detection
guard in the component.

---

## 3. Firestore rules audit

File: `firebase/firestore.rules`. **No behavior change** this pass — only
inline audit comments documenting findings. All findings are LOW risk.

- All collections (`recipes`, `trivia`, `gallery`, `contributors`, `history`, `config`) are intentionally public-read; this is a family-archive site.
- All writes require Firebase Auth + custom claim `admin == true` via `isAdmin()`.
- No fall-through `match /{document=**}` — implicit deny is in effect.
- No size validation: a compromised admin token could write arbitrarily-large docs (recipes, gallery URLs, history entries). **Recommendation:** add `request.resource.data.keys().hasOnly([...])` plus per-array length caps (e.g., `ingredients.size() <= 200`).
- `gallery.url` is unconstrained — could be set to an arbitrary tracking pixel. **Recommendation:** restrict to `firebasestorage.googleapis.com` / `storage.googleapis.com` / `data:` URIs.
- `history` has no TTL or retention; could grow unbounded over years. **Recommendation:** scheduled function to prune entries > 1 year, or cap to N most recent.
- `config/settings` exposes `archivePhone` publicly — this is the public-facing Twilio inbound number, so OK; but flag any future secret added here.

---

## 4. Bundle / perf

Before:
- `index` main 434 KB raw / 118 KB gz
- `ProfileView` 78 KB raw / 18 KB gz (statically imported AdminView)
- `vendor-firebase` 381 KB raw / 95 KB gz

Win applied:
- `AdminView` made `React.lazy` inside `ProfileView`. Splits a 48.5 KB
  raw / 12 KB gz chunk that only loads for admin users.

After:
- `index` 434 KB / 118 KB gz (no change — main chunk is React + UI primitives)
- `ProfileView` 30 KB / 7.3 KB gz (was 78 / 18)
- `AdminView` 48.5 KB / 12 KB gz (new, lazy)
- `vendor-firebase` unchanged

See `BUNDLE_BUDGET.md` for the budget table and follow-up wins
(e.g., loading `firebase/storage` only on first upload). No
`firebase-admin` or large icon set is bundled in the client.

---

## 5. Sentry coverage

Confirmed:
- `src/monitoring/sentry.ts` initializes only in PROD when `VITE_SENTRY_DSN` is set.
- `src/components/ErrorBoundary.tsx` calls `captureException` for render errors.

Added:
- `src/services/db.ts` — `captureException` in two previously-silent catches:
  - `CloudArchive.getFirebase` (init failure now reports)
  - `CloudArchive.uploadFiles` (per-file upload failure now reports)

The task list also referenced `userPrefsSync.ts`, `leaderboard.ts`, and
`featured.ts`. None of those files exist on this worktree's branch
(`worktree-agent-a3af107e` based on `9904ea1`). Flagged as a follow-up
once those features merge.

---

## 6. Open follow-ups

1. **Switch CSP to enforce mode** — change `Content-Security-Policy-Report-Only` -> `Content-Security-Policy` after one week of clean reports in production. Confirm sign-in, image uploads, recipe-image generation, and Sentry beacons all still work.
2. **firebase-admin LOW advisories** — track v13.x patch from Google that bumps `@google-cloud/storage` / `firestore` / `google-gax`. Re-run `npm audit --omit=dev` weekly.
3. **Firestore rule recommendations** (size caps, gallery URL allowlist, history TTL) — separate PR; not behavior-changing today but worth doing before the archive grows.
4. **Permissions-Policy microphone** — relax to `(self)` when voice-driven CookMode/MealPlan ships.
5. **Sentry on remaining services** — when `userPrefsSync.ts`, `leaderboard.ts`, `featured.ts` land, add the same `captureException` instrumentation.
6. **`firebase/storage` lazy import** — load only on first upload to shave the firebase vendor chunk for read-only visitors.

---

## Changeset

- `chore(deps): npm audit fix (no --force)` — c36ddda
- `feat(security): add HSTS, CSP report-only, frame-ancestors, Sentry catches` — 4681799
- `chore(perf): bundle audit + budget; lazy-load AdminView` — d18a3f8
- `docs(security): production hardening report` — (this file)
