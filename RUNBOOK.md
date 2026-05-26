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

## Troubleshooting (quick)

| Symptom | First checks |
|---------|----------------|
| **`/api/og` or `/api/share` returns 500** | See **API seed loading** below — start with **`GET /api/ping`** (expect **200**, body **`ok`**, **`Content-Type: text/plain`**). |
| **`/api/ping` is 200 but OG/share is 500** | Almost always the recipe seed bundle — same checks as **API seed loading**. |
| **Background push never fires** | `dist/firebase-messaging-sw.js` should contain injected JSON (not `null`); all six `VITE_FIREBASE_*` vars set at build time. See `docs/FIREBASE_PUSH_NOTIFICATIONS.md`. |
| **Firestore writes fail for custodian** | Google sign-in + `admin: true` custom claim; rules deployed; token refreshed after claim grant. |

## When something breaks

| Area | What to check |
|------|----------------|
| **AI / Magic Import** | `GEMINI_API_KEY` on Vercel; `/api/gemini` logs; rate limits (`GEMINI_RATE_LIMIT_*`). |
| **OG / social cards** | `GET /api/og?recipeId=`; recipe image paths and `sharp` on the function; **`api/og` duration**. If 500 with seed errors → **Troubleshooting** table above. |
| **Twilio MMS archive** | `TWILIO_*`, `FIREBASE_SERVICE_ACCOUNT`; webhook URL and **Twilio** delivery errors; **`POST /api/webhook`** rate limit. |
| **Push (`/api/notify`)** | `NOTIFY_SECRET`, `FIREBASE_SERVICE_ACCOUNT`; FCM errors in function logs. |
| **Firestore** | Rules tests (`npm run test:rules`); Console → Rules / Indexes; client `schafer_firebase_config`. |

## Troubleshooting: API seed loading

**Symptom:** `/api/og?recipeId=…` or `/share/recipe/…` (rewrites to `/api/share?id=…`) returns **HTTP 500** in production, often with a function log line referencing missing seed data or a failed `require`/`fs.readFile` for `src/data/recipes.json`. `scripts/smoke-prod.mjs` will flag this as a failed check.

**Checklist:**

1. **`GET /api/ping`** — expect **200**, body **`ok`**, **`Content-Type: text/plain`**. If ping fails, the Vercel function runtime or deploy is broken before you debug seed data.
2. **`api/recipes.seed.generated.ts`** — file must exist in the deployed commit (generated from `src/data/recipes.json`).
3. **Local verification** — `npm run test:run` runs `scripts/sync-recipes-for-api.mjs` first and includes **`api/loadRecipesSeed.test.ts`**; both must pass before shipping recipe JSON changes.
4. **Build hook** — **`postinstall`** in `package.json` runs **`node scripts/sync-recipes-for-api.mjs`** so Vercel regenerates the seed during install; confirm the build log shows no errors from that step.

## Vercel API recipe seed loading (background)

**Root cause:** The Vercel serverless bundler does not always trace files referenced by relative `fs` paths or dynamic imports outside the `api/` folder, so `src/data/recipes.json` was not included with the function. The api routes ran fine locally but threw at cold start in production.

**Current fix (commits `6db959d` … `7e99a26`, late May 2026):**

1. `scripts/sync-recipes-for-api.mjs` regenerates **`api/recipes.seed.generated.ts`** from `src/data/recipes.json`, emitting only **slim fields** needed by OG/share (`id`, `title`, `contributor`, `image`, `category`). This keeps the serverless bundle small (~10 KB vs full recipe payloads).
2. The generated module exports the seed via `JSON.parse(JSON.stringify(raw))` so backslashes / special chars in prose cannot break emitted JS.
2. `api/loadRecipesSeed.ts` imports that generated module and exposes `loadRecipesSeed()`.
3. `api/og.ts` and `api/share.ts` consume `loadRecipesSeed()` instead of reading `src/data/recipes.json` from disk.
4. The sync script is wired into `postinstall` (so Vercel runs it during build install) **and** into `test:run` so unit tests see the same seed.
5. `api/recipes.seed.generated.ts` is committed to the repo so the function bundle is deterministic even if `postinstall` is skipped.

**Verification after a deploy:**

```
curl -i https://schafer-family-cookbook.vercel.app/api/ping         # expect 200 "ok"
curl -i 'https://schafer-family-cookbook.vercel.app/api/og?recipeId=749d8765'  # expect 200 image/png
curl -i https://schafer-family-cookbook.vercel.app/share/recipe/749d8765       # expect 200 text/html with og:image
npm run smoke:prod                                                  # exit 0 only when all smoke checks pass (ping, OG, share, both hosts)
```

`api/ping.ts` is a tiny diagnostic route; if `/api/ping` is 200 but `/api/og` or `/share/recipe/<id>` is 500, the seed bundle is the most likely culprit — check that **`api/recipes.seed.generated.ts` exists in the deployed commit** and that the `postinstall` step ran without errors in the Vercel build log.

**If the seed needs a refresh:**

```
node scripts/sync-recipes-for-api.mjs
git add api/recipes.seed.generated.ts
git commit -m "chore(api): refresh recipe seed for Vercel functions"
```

## Data backup

- **Seed archive:** `npm run backup:recipes` writes `backups/recipes-<timestamp>.json`. GitHub **Backup recipes JSON** workflow runs weekly (artifact retention 90 days).
- **Cloud data:** Export Firestore / Storage via **Firebase Console** or `gcloud` with a service account — not covered by the seed backup script.

## Maintenance scripts

- **Contributor merge (Node):** `FIREBASE_WEB_CONFIG='{"apiKey":"…","projectId":"…",…}' node scripts/merge-contributors-node.mjs "From Name" "To Name"` — use the same web config JSON as Firebase Console (no secrets committed in repo).
- **Browser console merge:** `scripts/merge-contributors.js` reads **`localStorage.schafer_firebase_config`** after connecting Firebase in the app.

## Quality gates (CI)

- **Quality gates (CI):** Lint, types, **`test:coverage`** with thresholds, build, **`images:verify`**, **`test:bundle-size`**. E2E (Chromium + Firefox) and Firestore rules run in parallel follow-up jobs. Smoke production (`/api/ping`, share, OG) after push to `main`.
- **Lighthouse:** run **Lighthouse CI** workflow manually from GitHub Actions when you want a fresh Core Web Vitals / a11y snapshot (artifacts under `.lighthouseci`), or locally: `npm run lighthouse:ci` (override URL with `LHCI_URL=https://…/`).

## PWA / offline

The app registers a service worker via **`vite-plugin-pwa`** (`vite.config.ts`). After deploy, verify installability and offline behavior on a real device; third-party avatar/CDN assets may still require network.

## Security hygiene

- Do not commit service account JSON or **Gemini** / **Twilio** secrets; use Vercel env / GitHub **secrets** only.
- When adding scripts, analytics, or new API hosts, update **`Content-Security-Policy`** in **`vercel.json`**.
