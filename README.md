# Schafer Family Cookbook

A digital archive for preserving and celebrating the Schafer family's culinary heritage. Built with React, Vite, Firebase, and Google Gemini.

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and add:
   - `GEMINI_API_KEY` – for AI features (Magic Import, Imagen). **Note:** In production, the key is used server-side via `/api/gemini`; set `GEMINI_API_KEY` in Vercel environment variables.
3. Run: `npm run dev`

### AI Features in Local Dev

Magic Import and Imagen (image generation) require the Gemini API. In local development:

- **Option A (recommended):** Deploy to Vercel and set `GEMINI_API_KEY` in the Vercel dashboard. AI features work against your deployed `/api/gemini` proxy.
- **Option B:** Run `vercel dev` instead of `npm run dev` so the `/api/gemini` serverless route runs locally. Add `GEMINI_API_KEY` to `.env.local`.
- **Option C:** Set `GEMINI_API_KEY` in `.env.local` and use `npm run dev`. This only works if your Vite setup proxies API requests; otherwise the client may hit a non-existent `/api/gemini` endpoint.

Without a valid key or working proxy, AI buttons will fail with network/API errors. Non-AI features (browse recipes, gallery, trivia) work without the key.

## Deploy (Vercel)

1. Connect the repo to Vercel.
2. Set environment variables:
   - `GEMINI_API_KEY` – required for AI features.
   - `FIREBASE_SERVICE_ACCOUNT` – JSON string for MMS webhook and Firebase Admin.
   - `TWILIO_AUTH_TOKEN` – for validating Twilio webhook requests (recommended in production).
3. Deploy.

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

**Prompt rules:** `shared/recipeImagePrompts.mjs` defines canonical prompts for recipe images. Used by AdminView (single + bulk) and `generate-imagen-images.mjs`.

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
