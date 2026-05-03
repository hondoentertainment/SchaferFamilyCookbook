# Operations runbook (Schafer Family Cookbook)

Short reference for keeping the production app healthy. The codebase also documents env vars and rate limits in `README.md`.

## Deploy and URLs

- **Primary app:** Vercel (`scripts/smoke-prod.mjs` lists the production URL). After each push to `main`, CI runs tests and **Smoke production** hits live URLs when the full CI workflow succeeds.
- **Optional static host:** GitHub Pages may mirror the app; treat **one** deployment as canonical for share links and SEO (`siteConfig.baseUrl` in `src/config/site.ts`).

## Error monitoring (Sentry)

1. Set **`VITE_SENTRY_DSN`** on Vercel for production builds.
2. Optional: **`VITE_SENTRY_TRACES_SAMPLE_RATE`** (0–1, default `0.05`), **`VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`** (e.g. `0.1` to capture replay on errors — enables Session Replay integration).
3. Optional source maps: **`SENTRY_ORG`**, **`SENTRY_PROJECT`**, **`SENTRY_AUTH_TOKEN`** at build time (`README.md`).
4. **CSP:** `vercel.json` includes `connect-src … https://*.sentry.io` so the browser can report events.

## Serverless limits (Vercel)

`vercel.json` sets **`maxDuration`** / **memory** for heavier routes (`api/gemini.ts`, `api/og.ts`, etc.). **Hobby** plans cap execution time (often 10s); upgrade to **Pro** if Gemini or OG composition times out under load.

## When something breaks

| Area | What to check |
|------|----------------|
| **AI / Magic Import** | `GEMINI_API_KEY` on Vercel; `/api/gemini` logs; rate limits (`GEMINI_RATE_LIMIT_*`). |
| **OG / social cards** | `GET /api/og?recipeId=`; recipe image paths and `sharp` on the function; **`api/og` duration**. |
| **Twilio MMS archive** | `TWILIO_*`, `FIREBASE_SERVICE_ACCOUNT`; webhook URL and **Twilio** delivery errors; **`POST /api/webhook`** rate limit. |
| **Push (`/api/notify`)** | `NOTIFY_SECRET`, `FIREBASE_SERVICE_ACCOUNT`; FCM errors in function logs. |
| **Firestore** | Rules tests (`npm run test:rules`); Console → Rules / Indexes; client `schafer_firebase_config`. |

## Data backup

- **Seed archive:** `npm run backup:recipes` writes `backups/recipes-<timestamp>.json`. GitHub **Backup recipes JSON** workflow runs weekly (artifact retention 90 days).
- **Cloud data:** Export Firestore / Storage via **Firebase Console** or `gcloud` with a service account — not covered by the seed backup script.

## Maintenance scripts

- **Contributor merge (Node):** `FIREBASE_WEB_CONFIG='{"apiKey":"…","projectId":"…",…}' node scripts/merge-contributors-node.mjs "From Name" "To Name"` — use the same web config JSON as Firebase Console (no secrets committed in repo).
- **Browser console merge:** `scripts/merge-contributors.js` reads **`localStorage.schafer_firebase_config`** after connecting Firebase in the app.

## Quality gates (CI)

- **Lint, types, unit tests, build, bundled recipe images** (`npm run images:verify`).
- **E2E:** Chromium and Firefox against Firestore + Storage emulators.
- **Firestore rules:** emulator test suite.
- **Lighthouse:** run **Lighthouse CI** workflow manually from GitHub Actions when you want a fresh Core Web Vitals / a11y snapshot (artifacts under `.lighthouseci`).

## PWA / offline

The app registers a service worker via **`vite-plugin-pwa`** (`vite.config.ts`). After deploy, verify installability and offline behavior on a real device; third-party avatar/CDN assets may still require network.

## Security hygiene

- Do not commit service account JSON or **Gemini** / **Twilio** secrets; use Vercel env / GitHub **secrets** only.
- When adding scripts, analytics, or new API hosts, update **`Content-Security-Policy`** in **`vercel.json`**.
