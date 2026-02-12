# Schafer Family Cookbook

A digital archive for preserving and celebrating the Schafer family's culinary heritage. Built with React, Vite, Firebase, and Google Gemini.

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and add:
   - `GEMINI_API_KEY` – for AI features (Magic Import, Imagen). **Note:** In production, the key is used server-side via `/api/gemini`; set `GEMINI_API_KEY` in Vercel environment variables.
3. Run: `npm run dev`

## Deploy (Vercel)

1. Connect the repo to Vercel.
2. Set environment variables:
   - `GEMINI_API_KEY` – required for AI features.
   - `FIREBASE_SERVICE_ACCOUNT` – JSON string for MMS webhook and Firebase Admin.
3. Deploy.

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
