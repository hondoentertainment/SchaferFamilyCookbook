# Schafer Family Cookbook - Cursor / AI context

This file summarizes how the repo is organized and how to work in it safely. For contributor-facing detail, see [README.md](README.md).

## What this is

A family cookbook SPA: recipes, gallery, trivia, grocery list, cook mode, collections, admin tools (Magic Import, Imagen), contributor profiles, and share previews. Client is **React 19 + Vite 6 + TypeScript + Tailwind 4**. Backend pieces are **Vercel serverless** routes under `api/`. Data includes committed **`src/data/recipes.json`**, localStorage fallback state, and **Firebase** for live/cloud features.

**Navigation IA:** four areas — **Browse**, **Cook**, **Family**, **Me** — with secondary destinations in a **More sections** menu. Admin is under **Me → Admin Tools**.

## Tech stack

| Area        | Choice |
|------------|--------|
| UI         | React 19, Vite 6, Tailwind 4 (`@tailwindcss/vite`) |
| Types      | TypeScript (~5.8), `tsc --noEmit` |
| Tests      | Vitest (unit + coverage thresholds), Playwright (E2E, Chromium + Firefox in CI) |
| Lint/format| ESLint (`src`, `api`), Prettier |
| AI         | Google Gemini (`@google/genai`), proxied via `/api/gemini` |
| Hosting    | Vercel (full stack + APIs) and/or GitHub Pages (static SPA only) |

## Directory map

| Path | Role |
|------|------|
| `src/App.tsx` | Root app shell, tab routing, recipe modal |
| `src/components/` | Feature UI (HomeView, ProfileView, CollectionsView, AdminView, …) |
| `src/services/` | Firebase, Gemini proxy, `userPrefsSync`, push notifications, analytics |
| `src/utils/`, `src/hooks/` | favorites, collections, groceryList, ratings, haptics, … |
| `src/data/recipes.json` | Canonical recipe dataset in repo |
| `src/config/site.ts` | Site metadata, super-admin check |
| `api/*.ts` | Vercel Node handlers (see API routes below) |
| `api/recipes.seed.generated.ts` | AUTO-GENERATED slim seed for `/api/og` and `/api/share` |
| `public/` | Static assets; recipe images under `public/recipe-images/` |
| `scripts/` | sync-recipes-for-api, sync-firebase-sw-config, smoke-prod, Imagen batch, backups |
| `e2e/` | Playwright E2E specs |
| `docs/` | Firebase security, push notifications |
| `TESTING.md` | Test plan and change-type validation matrix |

## Environment variables

Local: **`.env.local`** (not committed). There is no checked-in `.env.example`; README lists variables.

**Client (`VITE_*`):** `VITE_SENTRY_DSN`, `VITE_SHARE_BASE`, six **`VITE_FIREBASE_*`** (FCM SW injection), optional **`VITE_FCM_VAPID_KEY`**.

**Server (Vercel / `vercel dev`):** `GEMINI_API_KEY`, optional `GEMINI_RATE_LIMIT_DISABLED` / `GEMINI_RATE_LIMIT`, `FIREBASE_SERVICE_ACCOUNT`, `TWILIO_AUTH_TOKEN`, `NOTIFY_SECRET`.

**Rule of thumb:** GitHub Pages cannot run `api/*`. AI, Twilio, OG/share, and push features need Vercel (or `vercel dev` locally).

## Commands

```bash
npm install              # postinstall regenerates api/recipes.seed.generated.ts
npm run dev              # Vite only; /api/* missing unless vercel dev
npm run ci               # lint + type-check + test:coverage + build + bundle budget
npm run test:run         # sync seed + Vitest once (no coverage)
npm run test:e2e:desktop # Playwright Chromium; preview on port 4287
npm run smoke:prod       # Live HTTP checks (ping, share, OG on Vercel)
npm run lint / npm run type-check
```

Before larger changes, prefer `npm run ci` locally. For navigation/login/admin/profile/collection flows, also run `npm run test:e2e:desktop`.

## API routes (Vercel)

| File | Purpose |
|------|---------|
| `api/gemini.ts` | Gemini/Imagen proxy + rate limiting |
| `api/og.ts` | 1200×630 share image (Sharp) |
| `api/share.ts` | HTML landing with OG tags + redirect to SPA |
| `api/ping.ts` | Diagnostic — returns `ok` |
| `api/loadRecipesSeed.ts` | Loads slim seed from `recipes.seed.generated.ts` |
| `api/webhook.ts` | Twilio MMS → gallery |
| `api/notify.ts` | FCM multicast (NOTIFY_SECRET) |

Co-located tests: `api/*.test.ts`. Seed sync: `scripts/sync-recipes-for-api.mjs` (also `postinstall`).

## User prefs cloud sync

`src/services/userPrefsSync.ts` mirrors **favorites**, **ratings**, **collections**, and **meal plans** to Firestore `userPrefs/{userId}` when Firebase is configured. Local utils (`favorites.ts`, `ratings.ts`, `collections.ts`, `mealPlan.ts`) call `notifyPrefsChanged()`; `useUserPrefsSync` debounces remote writes and merges on login. Firestore rules allow anonymous create/update with constrained shape (see `firebase/firestore.rules`).

## Conventions for edits

- **Scope:** Match existing patterns in nearby files; ESLint covers `src` and `api`.
- **Recipes:** Schema-aware changes align with `src/utils/recipeSchema.ts` and `recipes.json`. After editing recipes JSON, run `node scripts/sync-recipes-for-api.mjs` and commit `api/recipes.seed.generated.ts`.
- **Gemini from browser:** Use `src/services/geminiProxy.ts` (not raw keys in client bundles).
- **PWA / offline:** Service worker via `vite-plugin-pwa`; FCM SW injected at build by `scripts/sync-firebase-sw-config.mjs`.
- **Site branding/header:** Use `src/config/site.ts` for full site name/metadata. Primary nav follows Browse/Cook/Family/Me; secondary in More menu.
- **Recipe images:** Normalize in `src/services/db.ts`. Preserve uploaded/Imagen images; legacy paths resolve to deterministic `/recipe-images/<id>.webp` fallbacks.
- **Contributor avatars:** `src/utils/contributorAvatar.ts` + `mergeContributorsForDisplay.ts` for read-only lists; do not overwrite admin roles from synthetic display contributors.
- **Super admin:** Use `isSuperAdmin()` from `src/config/site.ts`.

## Testing expectations

See [TESTING.md](TESTING.md) for the full matrix. Useful focused commands:

```bash
npx vitest run src/services/userPrefsSync.test.ts src/utils/collections.test.ts src/utils/mealPlan.test.ts
npx vitest run api/loadRecipesSeed.test.ts api/share.test.ts api/ping.test.ts
npx vitest run src/components/RecipeModal.test.tsx src/components/ProfileView.test.tsx
npx playwright test e2e/profile.spec.ts e2e/admin.spec.ts --project=chromium
firebase emulators:exec --only firestore --project demo-schafer "npm run test:rules"
```

Known noisy passing output includes invalid JSON recovery, Twilio webhook failure-path logs, user preference sync network errors, and some React `act(...)` warnings. Treat non-zero exits as failures.

## Docs index

| Topic | File |
|-------|------|
| Run, deploy, env, share cards | [README.md](README.md) |
| Test plan and verification matrix | [TESTING.md](TESTING.md) |
| Production ops, API seed, incidents | [RUNBOOK.md](RUNBOOK.md) |
| Feature roadmap | [FEATURE-ROADMAP.md](FEATURE-ROADMAP.md) |
| Next sprint plan | [FEATURE-PLAN-NEXT-2-WEEKS.md](FEATURE-PLAN-NEXT-2-WEEKS.md) |
| Product requirements | [PRD.md](PRD.md) |
| Twilio MMS gallery | [TWILIO_SETUP.md](TWILIO_SETUP.md) |
| Firestore security | [docs/FIREBASE_SECURITY.md](docs/FIREBASE_SECURITY.md) |
| Push notifications | [docs/FIREBASE_PUSH_NOTIFICATIONS.md](docs/FIREBASE_PUSH_NOTIFICATIONS.md) |

When unsure about production-only behavior (webhook, OG, rate limits, seed loading), check README, RUNBOOK, and the relevant `api/*.ts` implementation.
