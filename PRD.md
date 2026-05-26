# Product Requirements Document: Schafer Family Cookbook

## 1. Overview

The **Schafer Family Cookbook** is a premium digital archive that preserves and celebrates the culinary heritage of the Schafer family. It combines modern web technologies with AI to deliver an interactive, accessible experience for family members and descendants.

## 2. Target Audience

- **Primary:** Members of the Schafer family.
- **Secondary:** Descendants and future generations reconnecting with family traditions.

## 3. Core Features

### 3.1 Recipe Archive

- **Browse Recipes:** Grid or list view with imagery, category filters (Breakfast, Main, Dessert, Side, Appetizer, Bread, Dip/Sauce, Snack), and contributor filters.
- **Sort Options:** A–Z or recently viewed (by recency).
- **Detailed Recipe View:** Full ingredients, step-by-step instructions, prep/cook times, calories, and heirloom notes.
- **Ingredient Scaling:** Adjust servings; ingredients scale proportionally in both recipe modal and Cook Mode.
- **Favorites:** Heart recipes to save (localStorage; optional cloud sync via `userPrefs` when Firebase is configured).
- **Collections:** User-created recipe lists (`CollectionsView`, modal picker, Profile section; optional cloud sync via `userPrefs`).
- **Recently Viewed:** Track viewed recipes; sort by recency (localStorage; Profile sections).
- **Recipe Deep-Linking:** Shareable URLs `#recipe/{id}`; opening link loads recipe modal directly.
- **Alphabetical Index:** A–Z table (tab labeled "A–Z"); grouping for numeric/symbol titles under "#".
- **Image Accuracy:** Anti-hallucination prompt rules in `shared/recipeImagePrompts.mjs`; images match recipe content.
- **Image Sources:** Manual upload, Imagen (Gemini), Pollinations, or local deterministic fallback images. `imageSource` metadata tracks source (`upload`, `nano-banana`, `pollinations`, `local-generated`).
- **Image Error Handling:** Debounced toast when recipe images fail to load; fallback to category placeholder.

### 3.2 Recipe Modal & Cook Mode

- **RecipeModal:** Full recipe details, scaling, print, share link (with deep-link), prev/next navigation (arrow keys), focus trap, Escape to close.
- **Start Cook:** Button launches step-by-step Cook Mode.
- **Cook Mode:** One step at a time, ingredient scaling, keyboard (Arrow Left/Right, Escape), swipe gestures on mobile, Screen Wake Lock to keep display on while cooking.

### 3.3 Grocery List

- **Add from Recipe:** Add all ingredients from a recipe to the grocery list (RecipeModal).
- **Manage Items:** Check/uncheck, remove items, clear checked items.
- **Search:** Filter items by text.
- **Grouping:** Items grouped by recipe/category; unchecked above checked.
- **Persistence:** localStorage; local-only.

### 3.4 Family Gallery

- **Visual Memories:** Archived family photos and culinary snapshots.
- **Videos:** Auto-play on hover/focus; pause on blur/mouse out.
- **Captions:** Descriptive captions for each item.
- **Lightbox:** Enlarged view; Close button, Escape key; focus trap for accessibility.
- **Broken/Empty Image UX:** Clear "Image failed to load" or "No image" states when uploads fail.
- **Admin-Only Delete:** Delete with confirmation dialog; focus trap, Escape to cancel.

### 3.5 Family Story (formerly History)

- **Static Narrative:** Tab dedicated to the family food history story.
- **Renamed from "History"** to reduce confusion with Profile contribution log.

### 3.6 Interactive Trivia

- **Family History:** Repository of trivia questions about Schafer history and traditions.
- **Immediate Feedback:** Answers with explanations.
- **Zero-Guard:** Safe division when no questions exist.
- **Keyboard:** Options 1–4 select answer (accessibility).

### 3.7 Contributor Profiles

- **Directory:** Avatar-based directory of family contributors.
- **Association:** Recipes, gallery, and trivia linked to contributors.
- **Phone (E.164):** Optional `phone` field for MMS attribution in gallery.

### 3.8 Profile

- **Display Identity:** Editable display name; Save Profile with feedback.
- **Avatar Picker:** Change profile photo; avatar or DiceBear options.
- **Role Display:** "Legacy Custodian" (admin) or "Family Member".
- **My Favorites:** Section showing favorited recipes; click to view.
- **Recently Viewed:** Section showing recently viewed recipes; click to view.
- **Collections:** User-created lists under Preferences; create/manage in Profile; add from Recipe modal.
- **My Shared Recipes:** Recipes contributed by the user; admins can edit via "Edit recipe".
- **My Contribution Log:** History of contributions (recipes, gallery, trivia) with timestamps.

## 4. Admin & Contributor Features

### 4.1 AI-Powered Tools

- **Magic Import:** Paste raw recipe text; Gemini extracts structured JSON.
- **Edit with AI:** Admins can edit existing recipes via AI from recipe cards (Records) and Profile.
- **Imagen Integration:** Generate dish photos from recipe ingredients using shared anti-hallucination prompts.
- **Bulk Visual Sourcing:** Fill missing images or regenerate all via Imagen, with local deterministic fallback tooling for full catalog coverage when quota or credentials are unavailable.
- **API Key Proxy:** All Gemini/Imagen calls route through `/api/gemini`; key never exposed to client.

### 4.2 Content Management

- **Manual Entry:** Forms for recipes, gallery, trivia.
- **Image Upload:** Heritage photos to Firebase Storage or local data URL.
- **Edit/Delete:** Full CRUD for admins.
- **Contributor Merge:** Combine recipes under a single contributor name.
- **Cloud Error Handling:** Toast "Could not save — check connection" on CloudArchive failures (upload, delete, upsert).

### 4.3 Access Control

- **Roles:** `user` (read) and `admin` (full access).
- **Identity:** Name-based login; profile photo from avatar picker or DiceBear.
- **Super-Admin:** Kyle / designated email for permission management.
- **Admin Promotion:** Admins promote others via Family Directory.

## 5. Technical Specifications

### 5.1 Stack

- **Frontend:** React 19 + Vite 6 (TypeScript)
- **Styling:** Tailwind CSS
- **Database:** Firebase (Firestore + Storage) with local fallback
- **Deployment:** Vercel; GitHub Pages (static) via Actions
- **AI:** Google Gemini (Flash + Imagen 3) via serverless proxy

### 5.2 Architecture

- **Code Splitting:** Lazy load for AdminView, TriviaView, HistoryView, AlphabeticalIndex, ContributorsView, ProfileView, GroceryListView.
- **Bundle Optimization:** `manualChunks` for Firebase and @google/genai.
- **API Routes:** `/api/gemini` (Gemini/Imagen), `/api/webhook` (Twilio MMS → gallery), `/api/og` + `/api/share` (social cards), `/api/ping` (diagnostic), `/api/notify` (FCM broadcast).
- **Recipe seed for serverless:** `scripts/sync-recipes-for-api.mjs` generates `api/recipes.seed.generated.ts` (slim fields for OG/share); runs on `postinstall` and before tests.
- **User prefs sync:** `userPrefsSync` + `useUserPrefsSync` mirror favorites, ratings, and collections to Firestore when configured.
- **UIContext:** Global toast and confirm dialogs; haptic feedback on success/error.
- **Offline Banner:** Fixed banner when navigator is offline; dismisses when back online.

### 5.3 Navigation

- **Main Areas:** Browse, Cook, Family, Me.
- **Browse:** Recipes, A–Z index, and collections.
- **Cook:** Grocery list and cooking-oriented recipe entry points.
- **Family:** Gallery, Trivia, Family Story, and Contributors.
- **Me:** Profile, preferences, privacy, and Admin Tools for admins.
- **Mobile/Desktop:** Same four-area model with a single **More sections** drawer/menu for secondary destinations. Admin entry remains under **Me → Admin Tools**.

### 5.4 Security

- **API Key:** `GEMINI_API_KEY` server-side only (Vercel env).
- **Identity:** Name-based; acceptable for family use. Document limitations.

### 5.5 Accessibility

- **Skip to Main Content:** Screen-reader-only link; visible on focus.
- **RecipeModal:** `role="dialog"`, `aria-modal="true"`, `aria-label` on close buttons, Escape key, focus trap.
- **Gallery Lightbox / Delete Confirm:** Same patterns; focus trap, Escape key.
- **Contrast:** Stone-400 replaced with stone-500 for improved contrast.

### 5.6 Mobile & Polish

- **Haptic Feedback:** Light tap on nav, success/error on toast; Vibration API on trivia and key actions; respects `prefers-reduced-motion`.
- **PWA:** Startup image, safe areas, touch targets; FCM service worker with build-time Firebase config injection.
- **Grocery / Profile:** Requires authenticated user (Profile and Grocery hidden when logged out).
- **Push notifications:** Profile → Notifications; tokens in Firestore `fcm_tokens`; broadcast via `/api/notify`.

## 6. MMS Archive (Twilio)

- **Flow:** Text photo/video to configured number → Twilio webhook → Firebase Storage → Firestore gallery.
- **Contributor Lookup:** Phone in E.164; tries multiple formats.
- **Archive Phone:** Set in Admin → Gallery; stored in localStorage and optionally synced.

## 7. Scripts & Tooling

| Script | Purpose |
|--------|---------|
| `generate-imagen-images.mjs` | Batch Imagen images for recipes; uses shared prompts |
| `generate-recipe-images.mjs` | Pollinations URLs from hand-curated prompts |
| `download-recipe-images.mjs` | Download Pollinations to `public/recipe-images/` |

## 8. Testing

- **Vitest + React Testing Library:** Component, service, API, and script tests (~700+ cases). Coverage thresholds enforced in CI (`vitest.config.ts`).
- **Playwright E2E:** Login, navigation, recipes, recipe modal, profile (favorites, recently viewed, collections), gallery, admin, cook mode.
- **Firestore rules:** Emulator-backed suite (`npm run test:rules`) in CI **`firestore-rules`** job.
- **Production smoke:** `npm run smoke:prod` — hosts, `/api/ping`, share HTML, OG PNG on Vercel.
- **Bundle budget:** `scripts/check-bundle-size.mjs` gates total/per-file gzipped JS after build.
- **Recipe data integrity:** `src/data/recipes.test.ts` validates `recipes.json` shape.
- **Mocks:** Firebase, GenAI, Twilio, IntersectionObserver (scroll spy tests).

See [TESTING.md](TESTING.md) for the change-type validation matrix.

## 9. Access & Deployment

- **Production URL:** [https://schafer-family-cookbook.vercel.app](https://schafer-family-cookbook.vercel.app)
- **GitHub Pages:** Optional; static deploy via Actions. AI features and MMS webhook require Vercel.
- **Admin Login:** Use "Admin" (or designated name) for full privileges.
- **Env Vars:** `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT` (webhook, notify, Admin SDK), `TWILIO_AUTH_TOKEN`, `NOTIFY_SECRET`, optional `VITE_FIREBASE_*` + `VITE_FCM_VAPID_KEY` for push, `VITE_SENTRY_DSN` for error reporting.
