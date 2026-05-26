# Site Review: Enhancements & Bug Fixes

## Completed Fixes (2026)

### Vercel API recipe seed bundling (Fixed — late May 2026)
- **Symptom:** `/api/og` and `/share/recipe/<id>` (rewrites to `/api/share`) returned HTTP 500 in production after deploy. Local invocations worked.
- **Root cause:** Vercel's serverless bundler did not trace `src/data/recipes.json` when API routes loaded it via dynamic paths or `fs.readFile`, so the seed file was missing from the deployed function.
- **Fix:** Generated TypeScript seed module — `scripts/sync-recipes-for-api.mjs` (wired into `postinstall` and `test:run`) emits `api/recipes.seed.generated.ts` from `src/data/recipes.json`. `api/loadRecipesSeed.ts` re-exports it and `api/og.ts` / `api/share.ts` consume it directly. Bundler now sees the seed as a plain TS import, guaranteed to be included. Generated file is committed for deterministic builds.
- **Diagnostics:** New `/api/ping` route returns `200 "ok"` so smoke tests / on-call can confirm functions deploy independently of seed state. See `RUNBOOK.md` → **Vercel API recipe seed loading** for verification steps.
- Commits: `6db959d`, `7c8f186`, `5fe2746`, `760f48a`, `d693bfc`, `ad49a2d`, `fcd9c1e`, `423f3f3`, `7e99a26`.

### Featured Recipes (Shipped — late May 2026)
- **Admin curation:** New "★ Featured" toggle on the Add/Edit recipe form in `AdminView`; Featured badge shown on each recipe row in Manage Recipes. Backed by a new optional `featured?: boolean` field on `Recipe`.
- **Recipes tab strip:** New `FeaturedStrip` component renders a horizontally-scrollable hero row above the main grid when at least one recipe is featured. Lazy-loaded; cap of 6 cards, sorted by `created_at` desc with stable insertion-order tiebreaker.
- **Tests:** `src/utils/featured.test.ts` (11 tests) for sort/cap/empty cases; `src/components/FeaturedStrip.test.tsx` (6 tests) for render/empty/click; extensions to `AdminView.test.tsx` and `App.test.tsx`; two new Playwright tests in `e2e/admin.spec.ts` for the admin toggle and the user-facing strip.

### Firebase Cloud Messaging service worker — build-time config (Shipped — late May 2026)
- **Problem:** `public/firebase-messaging-sw.js` shipped with `REPLACE_WITH_*` placeholders, so background push was silently broken in production.
- **Fix:** New `scripts/sync-firebase-sw-config.mjs` (cross-platform Node ESM) injects a JSON config built from `VITE_FIREBASE_*` env vars into `dist/firebase-messaging-sw.js` during `vite build`. Source `public/firebase-messaging-sw.js` keeps a `null` placeholder + safe-by-default guard that warns in console and skips `initializeApp` when config is missing.
- **Operator docs:** `docs/FIREBASE_PUSH_NOTIFICATIONS.md` covers required env vars, where they come from, how to verify FCM with `/api/notify`, and the intentional fail-safe.
- **Tests:** `scripts/sync-firebase-sw-config.test.mjs` (8 tests) covering placeholder substitution, missing-env error path, dev-mode warning, output validity. Vitest `include` extended to pick up `scripts/**/*.test.mjs`.

### Other shipped polish (May 2026)
- **Vibration / haptic feedback** — `src/utils/vibration.ts` integrated in Trivia, favorites, and Profile save.
- **Profile sections** — Favorites and Recently Viewed lists rendered in `ProfileView`.
- **Alphabetical Index scroll spy** — `IntersectionObserver` + `aria-current` on active letter.
- **Header `aria-current="page"`** — active tab announced to screen readers.
- **AdminView form labels** — all inputs (category, prep/cook/calories, ingredients, instructions, gallery caption, archive phone, tag input, heirloom notes) now have matched `htmlFor`/`id`.
- **Trivia ARIA** — answer options use native `<button>` + `aria-pressed`, not `role="listitem"`.
- **`e2e/admin.spec.ts` TODO cleanup** — replaced TODO comments about Firestore-emulator persistence with explicit notes documenting that local-provider round-trips run in Playwright while emulator-backed assertions live in `firebase/firestore.rules.test.ts`.

---

## Completed Fixes (2025)

### Gallery delete (Fixed)
- Only admins see delete button in Gallery view.

### AlphabeticalIndex (Fixed)
- Titles starting with numbers/symbols grouped under "#".

### History → Family Story (Fixed)
- Tab renamed to "Family Story" to match static narrative content.

### Webhook contributor phone lookup (Fixed)
- Tries E.164 and normalized variants (+1... and 1...).
- Contributors should store `phone` in E.164 format for MMS attribution.

### API key security (Fixed)
- Gemini/Imagen calls routed through `/api/gemini` serverless proxy.
- `GEMINI_API_KEY` kept server-side; client never receives key.

### Gallery broken/empty images (Fixed)
- `GalleryImage` component shows "Image failed to load" / "No image" placeholder.
- No Unsplash fallback for failed uploads.

### RecipeModal accessibility (Fixed)
- `aria-modal="true"`, `role="dialog"`, `aria-label` on close buttons.
- Escape key closes modal and lightbox.
- Focus management.

### Code splitting (Fixed)
- AdminView, TriviaView, HistoryView, AlphabeticalIndex, ContributorsView, ProfileView lazy-loaded.
- Bundle optimization with manualChunks for Firebase and @google/genai.

### Recipe image anti-hallucination (Fixed)
- Shared `recipeImagePrompts.mjs` with strict prompt rules.
- Single + bulk generation use canonical prompts; no invented garnish.

### Test coverage
- AdminView, AvatarPicker, RecipeModal (accessibility), webhook tests added.
- Coverage for major components.

### Admin under Profile (Fixed)
- Admin is no longer a top-level tab. Admins access it via **Profile → Admin Tools**. Reduces clutter and keeps admin entry discoverable from identity.

### Recipe image generation strategy (Documented)
- Quota-safe batch script: `npm run images:batch` (see `IMAGE_GENERATION_STRATEGY.md`). Resumable state, missing-only by default, configurable limit and delay.
- Admin shows **Recipe images** progress: total recipes, count with images, count missing. Suggests Fill Missing or local `npm run images:batch`.

### Avatar sets (Enhanced)
- **Photos:** randomuser.me portraits (198). **Illustrated:** DiceBear avataaars (500 seeds). Avatar picker has tabs to switch between sets.

### Polish and finalization
- Contrast: secondary text uses stone-500 for readability. Focus states and motion-reduce where appropriate.
- Empty states: Contributors and A–Z index show "Browse recipes" CTA when empty. Share copy: "Open in [SiteName]: [recipe title]".
- Recipe image source in admin: badge (Imagen / Upload) per recipe in Manage Recipes list.

---

## Open / Future

### Recipe image source metadata
Implemented: imageSource on Recipe and Imagen/Upload badge in Admin Manage Recipes list. Optional pollinations tracking remains URL-based.

### API key in local dev
- AI features require deployed `/api/gemini` or `GEMINI_API_KEY` in Vercel env.
- Document in README for contributors.

### Webhook test refinement
- Expand with Firebase/Twilio integration mocks for full flow.
