# Schafer Family Cookbook

A digital archive for preserving and celebrating the Schafer family's culinary heritage. Built with React, Vite, Firebase, and Google Gemini.

## For Contributors

### Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies: `npm install`
2. Create `.env.local` with (no `.env.example` in repo):
   - `GEMINI_API_KEY` – for AI features (Magic Import, Imagen). **Note:** In production, the key is used server-side via `/api/gemini`; set `GEMINI_API_KEY` in Vercel environment variables.
   - `VITE_SENTRY_DSN` (optional) – enables Sentry in production builds only (`src/monitoring/sentry.ts`). Release/environment are taken from **`VERCEL_GIT_COMMIT_SHA` / `VERCEL_ENV`** on Vercel and **`GITHUB_SHA`** in GitHub Actions when present; override with **`VITE_SENTRY_RELEASE`** / **`VITE_SENTRY_ENVIRONMENT`** if needed.
   - **Uploading browser source maps to Sentry (optional):** set **`SENTRY_ORG`**, **`SENTRY_PROJECT`**, and a **`SENTRY_AUTH_TOKEN`** (build-only secret, not `VITE_`) in CI or Vercel. The production Vite build then emits **`hidden` sourcemaps** and the `@sentry/vite-plugin` upload step runs automatically.
3. Run: `npm run dev`

### AI Features in Local Dev

Magic Import and Imagen (image generation) require the Gemini API. In local development:

- **Option A (recommended):** Deploy to Vercel and set `GEMINI_API_KEY` in the Vercel dashboard. AI features work against your deployed `/api/gemini` proxy.
- **Option B:** Run `vercel dev` instead of `npm run dev` so the `/api/gemini` serverless route runs locally. Add `GEMINI_API_KEY` to `.env.local`.
- **Option C:** Set `GEMINI_API_KEY` in `.env.local` and use `npm run dev`. This only works if your Vite setup proxies API requests; otherwise the client may hit a non-existent `/api/gemini` endpoint.

Without a valid key or working proxy, AI buttons will fail with network/API errors. Non-AI features (browse recipes, gallery, trivia) work without the key.

### Troubleshooting

| Symptom | Cause |
|--------|-------|
| AI buttons fail with network error | No `GEMINI_API_KEY` or no working `/api/gemini` proxy (use `vercel dev` or deploy to Vercel) |
| MMS webhook doesn't receive texts | Needs `FIREBASE_SERVICE_ACCOUNT` and `TWILIO_AUTH_TOKEN` in Vercel env; webhook runs only on Vercel, not GitHub Pages |

### Tests and CI

- **`npm run ci`** runs ESLint, TypeScript check, **Vitest** (unit), and a production build. It does **not** run Playwright; run E2E separately before large UI or routing changes.
- **Playwright** (`npm run test:e2e` or `npm run test:e2e -- --project=chromium` to mirror the Actions job) builds the app, serves `vite preview` on a **dedicated localhost port** defined in `playwright.config.ts`, then runs the specs. That avoids accidentally testing whatever happens to be bound to Vite’s default preview port (4173). If you need to attach to an already-running server, set `PLAYWRIGHT_BASE_URL` to that origin; to reuse a preview Playwright just started, set `PW_REUSE_E2E_SERVER=1` (see `playwright.config.ts`).
- **GitHub Actions** runs `ci` first, then a second job starts Firebase emulators and E2E with the env vars in `.github/workflows/ci.yml` (`VITE_FIREBASE_USE_EMULATOR`, etc.).

## Finalize and Deploy

```bash
npm run ci              # Lint, type-check, unit tests, build (no Playwright)
npm run test:e2e        # E2E (e.g. --project=chromium; includes build + preview)
npm run smoke:prod      # Verify Vercel + GitHub Pages return 200 and expected content
```

After push to `main`: CI runs lint, type-check, unit tests, build, then a **separate Playwright E2E** job (Chromium, with emulators as in the workflow). Deploy to GitHub Pages runs from the deploy workflow. Vercel deploys if connected. Verify env vars in Vercel: `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `TWILIO_AUTH_TOKEN`.

## Deploy (Vercel)

1. Connect the repo to Vercel.
2. Set environment variables:
   - `GEMINI_API_KEY` – required for AI features.
   - `GEMINI_RATE_LIMIT_DISABLED` – set to `1` to turn off per-IP rate limiting on `/api/gemini` (default: **45 requests / 60s** per IP; override max with `GEMINI_RATE_LIMIT`).
   - `FIREBASE_SERVICE_ACCOUNT` – JSON string for MMS webhook and Firebase Admin.
   - `TWILIO_AUTH_TOKEN` – for validating Twilio webhook requests (recommended in production).
   - `VITE_SENTRY_DSN` – optional client error reporting (production only).
   - `VITE_SHARE_BASE` – optional canonical share base (no trailing slash). **`vite build`** loads **`.env.production`**, which defaults this to `https://schafer-family-cookbook.vercel.app`, so links like `${VITE_SHARE_BASE}/share/recipe/<id>` work without setting Vercel dashboard vars (override there if the domain changes). That route serves `/api/share` HTML with `og:image` → `/api/og?recipeId=<id>` plus a redirect to `/#recipe/<id>` for rich previews (iMessage, Slack, WhatsApp). Without this env (e.g. GitHub Pages), the UI falls back to hash-only URLs (no crawler card).
3. Deploy.

### Share card (`/api/og`)

The serverless `api/og.ts` endpoint renders a 1200×630 PNG share card for any recipe. It reads `src/data/recipes.json`, loads the recipe image from `public/recipe-images/` (or fetches it if the image is an absolute URL), and composites the title, contributor, category, and site branding using SVG text overlay via `sharp`. If the recipe image cannot be loaded, it falls back to a clean wordmark-only composition on the parchment/forest palette.

Test locally:

```bash
curl -o og.png 'http://localhost:3000/api/og?recipeId=749d8765'
```

The share landing route `/share/recipe/<id>` (implemented in `api/share.ts`) serves an HTML document with full Open Graph + Twitter Card meta tags for crawlers, and a `<meta http-equiv="refresh">` that redirects human visitors to `/#recipe/<id>`.

## Deploy (GitHub Pages)

1. Push to GitHub.
2. In **Settings → Pages**, set *Source* to **GitHub Actions**.
3. Push to `main` triggers the workflow: lint, type-check, tests, build, then deploy.

Site URL: `https://<username>.github.io/<repo-name>/`

**Note:** GitHub Pages is static-only. `/api/gemini` and `/api/webhook` do not run on Pages. Browsing recipes, gallery, trivia (Firebase-backed) works. For Admin AI features (Magic Import, Imagen) and MMS webhook, use Vercel.

## Twilio MMS to Gallery

Family members can text photos and videos to a Twilio number; they appear in the Family Gallery. See **[TWILIO_SETUP.md](TWILIO_SETUP.md)** for setup.

## Image Generation Scripts

Located in `scripts/`:

| Script | Purpose |
|--------|---------|
| `generate-imagen-images.mjs` | Generate Imagen 3 images for all recipes; uses `shared/recipeImagePrompts.mjs` for anti-hallucination rules. Run: `GEMINI_API_KEY=... node scripts/generate-imagen-images.mjs` |
| `generate-recipe-images.mjs` | Create Pollinations AI image URLs from hand-curated prompts. |
| `download-recipe-images.mjs` | Download Pollinations URLs to `public/recipe-images/`. |

For quota-safe batch runs (resumable, missing-only), see IMAGE_GENERATION_STRATEGY.md. Use: npm run images:dry-run, npm run images:batch, npm run images:resume.

**Prompt rules:** `shared/recipeImagePrompts.mjs` defines canonical prompts for recipe images. Used by AdminView (single + bulk) and `generate-imagen-images.mjs`.

## Security & backups

- **Firestore / Storage rules:** **Public read**, **custodian-only write** (Firebase Auth + custom claim `admin`). Deploy: `firebase deploy --only firestore:rules,storage:rules`. Custodians use **Profile → Admin tools → Sign in with Google**; grant the claim once: `FIREBASE_SERVICE_ACCOUNT='<json>' npm run admin:set-claim -- <uid>`. Details: **[docs/FIREBASE_SECURITY.md](docs/FIREBASE_SECURITY.md)**.
- **Recipe JSON backup (local):** `npm run backup:recipes` copies `src/data/recipes.json` to `backups/recipes-<timestamp>.json` (folder is gitignored).
- **Automated Firestore backup:** The `weeklyFirestoreBackup` Cloud Function (in `functions/`) exports all collections to `gs://PROJECT_ID.firebasestorage.app/backups/YYYY-MM-DD/` every Sunday at 2:00 AM UTC. Deploy with `firebase deploy --only functions`. To restore a backup, see **[scripts/restore-backup.md](scripts/restore-backup.md)**.

## Identity & Access

- **Login:** Name-based (no password). Identity stored in localStorage.
- **Roles:** `user` (read) and `admin` (full CRUD, AI tools). Super-admin (Kyle) can manage permissions.
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
  components/     # React components
  services/       # db.ts, geminiProxy.ts
  constants/      # Category images, avatars
  data/           # recipes.json, trivia seed
  test/           # setup, utils
shared/
  recipeImagePrompts.mjs  # Canonical prompt rules
api/
  gemini.ts       # Serverless proxy for Gemini/Imagen
  webhook.ts      # Twilio MMS → gallery
```
