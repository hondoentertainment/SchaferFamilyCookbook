# Schafer Family Cookbook - Cursor / AI context

This file summarizes how the repo is organized and how to work in it safely. For contributor-facing detail, see [README.md](README.md).

## What this is

A family cookbook SPA: recipes, gallery, trivia, grocery list, cook mode, admin tools (Magic Import, Imagen), contributor profiles, and share previews. Client is **React 19 + Vite 6 + TypeScript + Tailwind 4**. Backend pieces are **Vercel serverless** routes under `api/`. Data includes committed **`src/data/recipes.json`**, localStorage fallback state, and **Firebase** for live/cloud features.

## Tech stack

| Area        | Choice |
|------------|--------|
| UI         | React 19, Vite 6, Tailwind 4 (`@tailwindcss/vite`) |
| Types      | TypeScript (~5.8), `tsc --noEmit` |
| Tests      | Vitest (unit), Playwright (E2E, Chromium in CI) |
| Lint/format| ESLint (`src`, `api`), Prettier |
| AI         | Google Gemini (`@google/genai`), proxied via `/api/gemini` |
| Hosting    | Vercel (full stack + APIs) and/or GitHub Pages (static SPA only) |

## Directory map

| Path | Role |
|------|------|
| `src/App.tsx` | Root app shell and routing |
| `src/components/` | Feature UI |
| `src/services/` | Firebase, Gemini proxy, analytics, prefs sync, etc. |
| `src/utils/`, `src/hooks/` | Shared logic |
| `src/data/recipes.json` | Canonical recipe dataset in repo |
| `src/config/site.ts` | Site metadata |
| `api/*.ts` | Vercel Node handlers (`gemini`, `og`, `share`, `webhook`, `notify`) |
| `public/` | Static assets; recipe images often under `public/recipe-images/` |
| `scripts/` | One-off Node tooling (smoke tests, backups, Imagen batch, admin claims) |
| `e2e/` | Playwright E2E specs |
| `TESTING.md` | Current test plan and change-type validation matrix |

## Environment variables

Local: **`.env.local`** (not committed). There is no checked-in `.env.example`; README lists variables.

**Client (`VITE_*`):** e.g. `VITE_SENTRY_DSN`, `VITE_SHARE_BASE` (share link base for OG-rich previews on Vercel).

**Server (Vercel / `vercel dev`):** `GEMINI_API_KEY`, optional `GEMINI_RATE_LIMIT_DISABLED` / `GEMINI_RATE_LIMIT`, `FIREBASE_SERVICE_ACCOUNT`, `TWILIO_AUTH_TOKEN` for webhook/MMS.

**Rule of thumb:** GitHub Pages cannot run `api/*`. AI and Twilio features need Vercel (or `vercel dev` locally).

## Commands

```bash
npm install
npm run dev              # Vite only; /api/* may be missing unless proxied or vercel dev
npm run ci               # lint + type-check + unit tests + build
npm run test:e2e:desktop # Playwright Chromium; starts preview on port 4287
npm run lint / npm run type-check / npm run test:run
```

Before larger changes, prefer `npm run ci` locally. For navigation/login/admin/image UX changes, also run `npm run test:e2e:desktop`.

## API routes (Vercel)

| File | Purpose |
|------|---------|
| `api/gemini.ts` | Gemini proxy + rate limiting |
| `api/og.ts` | 1200×630 share image (Sharp) |
| `api/share.ts` | HTML landing with OG tags + redirect to SPA |
| `api/webhook.ts` | Twilio MMS → gallery |
| `api/notify.ts` | Push / notification helper as applicable |

Co-located tests: `api/*.test.ts`.

## Conventions for edits

- **Scope:** Match existing patterns in nearby files; ESLint covers `src` and `api`.
- **Recipes:** Schema-aware changes should align with `src/utils/recipeSchema.ts` and how `recipes.json` is consumed.
- **Gemini from browser:** Use `src/services/geminiProxy.ts` (not raw keys in client bundles).
- **PWA / offline:** Service worker and PWA config via `vite-plugin-pwa`; see existing offline/upload queue code before changing caching behavior.
- **Site branding/header:** `Header` is compact by design. Primary nav is `Recipes`, `A-Z`, `Gallery`, `Trivia`; secondary sections live in the `More sections` menu. Use `src/config/site.ts` for full site name/metadata.
- **Recipe images:** Normalize display data in `src/services/db.ts`. Preserve uploaded Firebase/Storage images and Imagen-curated images. Legacy `/recipe-images/imported_*.jpg`, old Pollinations URLs, Unsplash placeholders, and invalid URLs should resolve to deterministic recipe-specific generated images based on title/category/ingredients. UI surfaces should have designed loading and fallback states, not blank/broken images.
- **Image UX:** Recipe cards, hero, modal, admin thumbnails, add/edit previews, profile lists, and gallery thumbnails should use fixed aspect containers, `object-cover`/`object-contain` intentionally, `loading="lazy"` for below-fold images, `decoding="async"` where appropriate, and accessible `alt` text for meaningful images.
- **Contributor avatars:** Use `src/utils/contributorAvatar.ts` for deterministic fallback avatars and `src/utils/mergeContributorsForDisplay.ts` for read-only display lists. Keep raw `contributors` for authoritative admin/upsert paths; do not let synthetic display contributors overwrite admin roles.
- **Super admin:** Use `isSuperAdmin()` from `src/config/site.ts`; do not hardcode admin identifiers in new code.

## Testing expectations

See [TESTING.md](TESTING.md) for the full matrix. Useful focused commands:

```bash
npx vitest run src/services/db.test.ts src/components/RecipeModal.test.tsx src/App.test.tsx
npx vitest run src/components/ContributorsView.test.tsx src/components/ProfileView.test.tsx src/components/AdminView.test.tsx
npx playwright test e2e/admin.spec.ts e2e/navigation.spec.ts e2e/privacy.spec.ts --project=chromium
```

Known noisy passing output includes intentional invalid JSON recovery, Twilio webhook failure-path logs, user preference sync network errors, and some React `act(...)` warnings in older tests. Treat non-zero exits as failures.

## Docs index

| Topic | File |
|-------|------|
| Run, deploy, env, share cards | [README.md](README.md) |
| Test plan and verification matrix | [TESTING.md](TESTING.md) |
| Twilio MMS gallery | [TWILIO_SETUP.md](TWILIO_SETUP.md) |

When unsure about production-only behavior (webhook, OG, rate limits), check README and the relevant `api/*.ts` implementation.
