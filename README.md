# Schafer Family Cookbook

A digital archive for preserving and celebrating the Schafer family's culinary heritage. Built with React, Vite, Firebase, and Google Gemini.

## For Contributors

### Run Locally

**Prerequisites:** Node.js 18+. Optional: **Java 21+** on your PATH if you want to run **Firestore rules tests** locally (the emulator is a JVM process).

1. Install dependencies: `npm install`
2. Create `.env.local` with (no `.env.example` in repo):
   - `GEMINI_API_KEY` – for AI features (Magic Import, Imagen). **Note:** In production, the key is used server-side via `/api/gemini`; set `GEMINI_API_KEY` in Vercel environment variables.
   - `VITE_SENTRY_DSN` (optional) – enables Sentry in production builds only (`src/monitoring/sentry.ts`). Release/environment are taken from **`VERCEL_GIT_COMMIT_SHA` / `VERCEL_ENV`** on Vercel and **`GITHUB_SHA`** in GitHub Actions when present; override with **`VITE_SENTRY_RELEASE`** / **`VITE_SENTRY_ENVIRONMENT`** if needed. Optional tuning: **`VITE_SENTRY_TRACES_SAMPLE_RATE`** (0–1, default `0.05`) and **`VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`** (e.g. `0.1` — enables Session Replay on errors only).
   - **Uploading browser source maps to Sentry (optional):** set **`SENTRY_ORG`**, **`SENTRY_PROJECT`**, and a **`SENTRY_AUTH_TOKEN`** (build-only secret, not `VITE_`) in CI or Vercel. The production Vite build then emits **`hidden` sourcemaps** and the `@sentry/vite-plugin` upload step runs automatically.
   - **Push notifications (optional):** six **`VITE_FIREBASE_*`** vars plus **`VITE_FCM_VAPID_KEY`** — injected into `dist/firebase-messaging-sw.js` at build time. See **[docs/FIREBASE_PUSH_NOTIFICATIONS.md](docs/FIREBASE_PUSH_NOTIFICATIONS.md)**.
3. Run: `npm run dev`

### AI Features in Local Dev

Magic Import and Imagen (image generation) require the Gemini API. In local development:

- **Option A (recommended):** Deploy to Vercel and set `GEMINI_API_KEY` in the Vercel dashboard. AI features work against your deployed `/api/gemini` proxy.
- **Option B:** Run `vercel dev` instead of `npm run dev` so the `/api/gemini` serverless route runs locally. Add `GEMINI_API_KEY` to `.env.local`.
- **Option C:** Set `GEMINI_API_KEY` in `.env.local` and use `npm run dev`. This only works if your Vite setup proxies API requests; otherwise the client may hit a non-existent `/api/gemini` endpoint.

Without a valid key or working proxy, AI buttons will fail with network/API errors. Non-AI features (browse recipes, gallery, trivia) work without the key.

### Troubleshooting

| Symptom                                                              | Cause                                                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| AI buttons fail with network error                                   | No `GEMINI_API_KEY` or no working `/api/gemini` proxy (use `vercel dev` or deploy to Vercel)                            |
| `/api/og` or `/share/recipe/…` returns 500                         | Recipe seed bundle — see **`RUNBOOK.md`** (API seed loading). Start with **`GET /api/ping`** (expect **200**, body **`ok`**) |
| MMS webhook doesn't receive texts                                    | Needs `FIREBASE_SERVICE_ACCOUNT` and `TWILIO_AUTH_TOKEN` in Vercel env; webhook runs only on Vercel, not GitHub Pages   |
| Emulator or `firebase emulators:exec` fails (“Could not spawn java”) | Install a **JDK** (recommended 21+) on your PATH; required locally for **`npm run test:rules`** and Firestore emulation |

### Serverless API rate limits (Vercel)

Several routes throttle by client IP (`x-forwarded-for` first hop, then socket address). Limits are enforced per warmed serverless instance (`api/lib/rateLimit.ts`).

| Route                                                          | Requests / window                                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /api/ping`                                                | No rate limit (diagnostic; returns **`ok`**)                                                              |
| `POST /api/gemini`                                             | **45 / 60s** (disable with **`GEMINI_RATE_LIMIT_DISABLED=1`**; override max with **`GEMINI_RATE_LIMIT`**) |
| `GET` share landing **`/share/recipe/…`** and **`api/share`**  | **120 / 60s**                                                                                             |
| `GET /api/og`                                                  | **90 / 60s**                                                                                              |
| `POST /api/webhook` (Twilio MMS)                               | **80 / 60s** (**`429`** + **`Retry-After: 60`**)                                                          |
| **`POST /api/notify`** (after **`x-notify-secret`** validates) | **24 / 60s** (**`429`**)                                                                                  |

**`/api/notify`** multicasts Firebase Cloud Messaging notifications to tokens in Firestore (**`fcm_tokens`**). Set **`NOTIFY_SECRET`** in Vercel and send header **`x-notify-secret`** with that value plus JSON **`{ "title": "…", "body": "…" }`** (**`body`** optional). Requires **`FIREBASE_SERVICE_ACCOUNT`** (or **`GOOGLE_APPLICATION_CREDENTIALS`**) like the webhook handler.

### Tests and CI

**Local**

- **`npm run ci`** runs ESLint, TypeScript check, **Vitest with coverage thresholds** (`src/**`, `api/**`, `scripts/**` tests; excludes `firebase/**/*.rules.test.ts`), production build, and **bundle-size budget** gate (`scripts/check-bundle-size.mjs`). Does not run Playwright.
- **`npm run test:run`** syncs the API recipe seed (`postinstall` / `scripts/sync-recipes-for-api.mjs`) then runs Vitest once without coverage.
- **`npm run test:e2e`** builds the app, serves **`vite preview`** on port **4287** (`playwright.config.ts`), and runs **Chromium and Firefox** by default (same as CI). Use **`--project=chromium`** for a quicker local run. Set **`PLAYWRIGHT_BASE_URL`** to hit an existing server; set **`PW_REUSE_E2E_SERVER=1`** to reuse preview started by Playwright.

**Firestore rules suite**

- **`npm run test:rules`** uses **`vitest.rules.config.ts`** and **`firebase/firestore.rules.test.ts`**. Locally it must run **inside** the emulator (Firestore is a JVM process):

```bash
npx firebase-tools emulators:exec --only firestore --project demo-schafer "npm run test:rules"
```

**GitHub Actions (`.github/workflows/ci.yml`)**

| Job                   | When                                  | What runs                                                                                                   |
| --------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **`ci`**              | Every push / PR to `main` or `master` | `images:verify`, `npm audit` (critical), lint, type-check, **`test:coverage`**, build, **`test:bundle-size`** |
| **`e2e`**             | After **`ci`** succeeds               | Playwright **Chromium + Firefox** with Firestore + Storage emulators (**`demo-schafer`**)                   |
| **`firestore-rules`** | After **`ci`** succeeds               | Java 21, Firebase CLI **`emulators:exec`**, **`npm run test:rules`** against **`firebase/firestore.rules`** |

**Smoke production** (`.github/workflows/smoke-prod.yml`) fires when workflow **CI** completes **successfully** on a **push** to **`main`**, runs **`npm ci`**, then **`npm run smoke:prod`**: both hosts, **`GET /api/ping`**, share HTML, and OG PNG on Vercel (see **`scripts/smoke-prod.mjs`**).

**Operations** (deploy URLs, Sentry, incident hints, backups, Lighthouse): see **`RUNBOOK.md`**.

| Workflow | When | Purpose |
| -------- | ---- | ------- |
| **Backup recipes JSON** | Weekly + manual | Timestamped copy of `src/data/recipes.json` as an artifact (`scripts/backup-recipes-json.mjs`). |
| **Lighthouse CI** | Manual | Core Web Vitals / quality report for a URL you choose (`lighthouserc.cjs`). |

## Finalize and Deploy

```bash
npm run ci              # Lint, type-check, coverage+thresholds, build, bundle budget
npm run test:e2e        # E2E Chromium + Firefox (includes build + preview)
firebase emulators:exec --only firestore --project demo-schafer "npm run test:rules"
npm run smoke:prod      # Live HTTP smoke: hosts, /api/ping, share HTML, OG PNG
```

After push to `main`: **`ci`** runs (lint, type-check, Vitest `test:run`, build), **`e2e`** and **`firestore-rules`** jobs follow when **`ci`** passes, then the **Smoke production** workflow hits live URLs **if CI completed successfully**. GitHub Pages deploy runs from the deploy workflow; Vercel deploys if linked. Typical Vercel env: **`GEMINI_API_KEY`**, **`FIREBASE_SERVICE_ACCOUNT`**, **`TWILIO_AUTH_TOKEN`**, optional **`NOTIFY_SECRET`** when using **`/api/notify`**.

## Deploy (Vercel)

1. Connect the repo to Vercel.
2. Set environment variables:
   - `GEMINI_API_KEY` – required for AI features.
   - `GEMINI_RATE_LIMIT_DISABLED` – set to `1` to turn off per-IP rate limiting on `/api/gemini` (default: **45 requests / 60s** per IP; override max with `GEMINI_RATE_LIMIT`).
   - `FIREBASE_SERVICE_ACCOUNT` – JSON string for MMS webhook, Firebase Admin, and **`/api/notify`** (FCM multicast).
   - `TWILIO_AUTH_TOKEN` – for validating Twilio webhook requests (recommended in production).
   - **`NOTIFY_SECRET`** – shared secret for **`POST /api/notify`**; callers must send header **`x-notify-secret`** with this value (**Serverless API rate limits** describes throttling).
   - `VITE_SENTRY_DSN` – optional client error reporting (production only).
   - **`VITE_FIREBASE_*`** (six vars) + optional **`VITE_FCM_VAPID_KEY`** – push notifications; injected into `dist/firebase-messaging-sw.js` at build. See **`docs/FIREBASE_PUSH_NOTIFICATIONS.md`**.
   - `VITE_SHARE_BASE` – optional canonical share base (no trailing slash). **`vite build`** loads **`.env.production`**, which defaults this to `https://schafer-family-cookbook.vercel.app`, so links like `${VITE_SHARE_BASE}/share/recipe/<id>` work without setting Vercel dashboard vars (override there if the domain changes). That route serves `/api/share` HTML with `og:image` → `/api/og?recipeId=<id>` plus a redirect to `/#recipe/<id>` for rich previews (iMessage, Slack, WhatsApp). Without this env (e.g. GitHub Pages), the UI falls back to hash-only URLs (no crawler card).
3. Deploy.

### Share card (`/api/og` + `/api/share`)

Vercel serverless routes read recipe metadata from a **slim generated seed** (`api/recipes.seed.generated.ts`), not from `fs` at runtime. The seed is regenerated from `src/data/recipes.json` on **`postinstall`** and before **`npm run test:run`** via **`scripts/sync-recipes-for-api.mjs`** (only fields needed for OG/share: id, title, contributor, image, category).

| Route | Purpose |
| ----- | ------- |
| **`GET /api/ping`** | Diagnostic — returns **`ok`** (use after deploy to confirm functions are warm) |
| **`GET /api/og?recipeId=`** | 1200×630 PNG share card via `sharp` + SVG text overlay |
| **`GET /share/recipe/<id>`** | HTML landing with Open Graph tags → redirects humans to `/#recipe/<id>` |

`api/og.ts` loads the recipe thumbnail from `public/recipe-images/` when the image is site-relative, or fetches absolute URLs. On image failure it falls back to a wordmark-only composition on the parchment/forest palette.

Test locally (requires **`vercel dev`** or a Vercel preview — `npm run dev` does not serve `api/*`):

```bash
curl -i 'http://localhost:3000/api/ping'
curl -o og.png 'http://localhost:3000/api/og?recipeId=749d8765'
curl -i 'http://localhost:3000/share/recipe/749d8765'
```

If OG or share returns **500** in production while ping is **200**, see **`RUNBOOK.md`** (API seed loading).

## Deploy (GitHub Pages)

1. Push to GitHub.
2. In **Settings → Pages**, set _Source_ to **GitHub Actions**.
3. Push to `main` triggers the workflow: lint, type-check, tests, build, then deploy.

Site URL: `https://<username>.github.io/<repo-name>/`

**Note:** GitHub Pages is static-only. `/api/gemini` and `/api/webhook` do not run on Pages. Browsing recipes, gallery, trivia (Firebase-backed) works. For Admin AI features (Magic Import, Imagen) and MMS webhook, use Vercel.

## Twilio MMS to Gallery

Family members can text photos and videos to a Twilio number; they appear in the Family Gallery. See **[TWILIO_SETUP.md](TWILIO_SETUP.md)** for setup.

## Image Generation Scripts

Located in `scripts/`:

| Script                       | Purpose                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `generate-imagen-images.mjs` | Generate Imagen 3 images for all recipes; uses `shared/recipeImagePrompts.mjs` for anti-hallucination rules. Run: `GEMINI_API_KEY=... node scripts/generate-imagen-images.mjs` |
| `generate-recipe-images.mjs` | Create Pollinations AI image URLs from hand-curated prompts.                                                                                                                   |
| `download-recipe-images.mjs` | Download Pollinations URLs to `public/recipe-images/`.                                                                                                                         |

For quota-safe batch runs (resumable, missing-only), see IMAGE_GENERATION_STRATEGY.md. Use: npm run images:dry-run, npm run images:batch, npm run images:resume.

**Prompt rules:** `shared/recipeImagePrompts.mjs` defines canonical prompts for recipe images. Used by AdminView (single + bulk) and `generate-imagen-images.mjs`.

## Security & backups

- **Firestore / Storage rules:** **Public read**, **custodian-only write** (Firebase Auth + custom claim `admin`). Deploy: `firebase deploy --only firestore:rules,storage:rules`. Custodians use **Profile → Admin tools → Sign in with Google**; grant the claim once: `FIREBASE_SERVICE_ACCOUNT='<json>' npm run admin:set-claim -- <uid>`. Details: **[docs/FIREBASE_SECURITY.md](docs/FIREBASE_SECURITY.md)**.
- **Recipe JSON backup (local):** `npm run backup:recipes` copies `src/data/recipes.json` to `backups/recipes-<timestamp>.json` (folder is gitignored). **Backup recipes JSON** (`.github/workflows/backup-recipes.yml`) runs the same script weekly and uploads an artifact.
- **Automated Firestore backup:** The `weeklyFirestoreBackup` Cloud Function (in `functions/`) exports all collections to `gs://PROJECT_ID.firebasestorage.app/backups/YYYY-MM-DD/` every Sunday at 2:00 AM UTC. Deploy with `firebase deploy --only functions`. To restore a backup, see **[scripts/restore-backup.md](scripts/restore-backup.md)**.

## Identity & Access

- **Login:** Name-based (no password). Identity stored in localStorage.
- **Roles:** `user` (read) and `admin` (full CRUD, AI tools). Super-admin (Kyle) can manage permissions.
- **Cloud prefs:** When Firebase is configured, favorites, ratings, and **collections** sync to Firestore **`userPrefs/{userId}`** via `src/services/userPrefsSync.ts` (debounced writes; merge on login).
- Suitable for family/internal use; document limitations in public deployments.

## Testing

```bash
npm run test        # Watch mode
npm run test:run    # Single run (CI)
npm run test:ui     # Interactive UI
npm run test:coverage
```

See [TESTING.md](TESTING.md) for details.

## Project Structure

```
src/
  components/     # React UI (Browse, Cook, Family, Me areas)
  services/       # db, geminiProxy, userPrefsSync, pushNotifications, analytics
  utils/          # favorites, collections, groceryList, ratings, haptics, …
  constants/      # storage keys, taxonomy, theme
  data/           # recipes.json (canonical), trivia seed
  test/           # Vitest setup + render helpers
shared/
  recipeImagePrompts.mjs  # Canonical Imagen prompt rules
firebase/
  firestore.rules           # Public read, custodian write
  firestore.rules.test.ts   # Emulator-backed rules tests (npm run test:rules)
api/
  gemini.ts                 # Gemini/Imagen proxy
  og.ts, share.ts           # Share cards + OG HTML landing
  loadRecipesSeed.ts        # Slim seed loader for OG/share
  recipes.seed.generated.ts # AUTO-GENERATED — do not edit by hand
  ping.ts                   # Diagnostic route
  webhook.ts                # Twilio MMS → gallery
  notify.ts                 # Authenticated FCM broadcast (NOTIFY_SECRET)
scripts/
  sync-recipes-for-api.mjs  # Regenerate api/recipes.seed.generated.ts
  sync-firebase-sw-config.mjs  # Inject VITE_FIREBASE_* into FCM SW at build
  smoke-prod.mjs            # Production HTTP smoke checks
  check-bundle-size.mjs     # Post-build JS budget gate
e2e/                        # Playwright specs
docs/
  FIREBASE_SECURITY.md
  FIREBASE_PUSH_NOTIFICATIONS.md
```

## Documentation index

| Topic | File |
| ----- | ---- |
| Run, deploy, env, share cards | [README.md](README.md) |
| Test plan and verification matrix | [TESTING.md](TESTING.md) |
| Production ops, incidents, API seed | [RUNBOOK.md](RUNBOOK.md) |
| Feature roadmap and priorities | [FEATURE-ROADMAP.md](FEATURE-ROADMAP.md) |
| Next 2-week sprint plan | [FEATURE-PLAN-NEXT-2-WEEKS.md](FEATURE-PLAN-NEXT-2-WEEKS.md) |
| Product requirements | [PRD.md](PRD.md) |
| AI / Cursor context | [cursor.md](cursor.md) |
| Firestore security model | [docs/FIREBASE_SECURITY.md](docs/FIREBASE_SECURITY.md) |
| Push notifications setup | [docs/FIREBASE_PUSH_NOTIFICATIONS.md](docs/FIREBASE_PUSH_NOTIFICATIONS.md) |
| Twilio MMS gallery | [TWILIO_SETUP.md](TWILIO_SETUP.md) |
| Recipe image batch strategy | [IMAGE_GENERATION_STRATEGY.md](IMAGE_GENERATION_STRATEGY.md) |
