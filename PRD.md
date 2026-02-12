# Product Requirements Document: Schafer Family Cookbook

## 1. Overview

The **Schafer Family Cookbook** is a premium digital archive that preserves and celebrates the culinary heritage of the Schafer family. It combines modern web technologies with AI to deliver an interactive, accessible experience for family members and descendants.

## 2. Target Audience

- **Primary:** Members of the Schafer family.
- **Secondary:** Descendants and future generations reconnecting with family traditions.

## 3. Core Features

### 3.1 Recipe Archive

- **Browse Recipes:** Grid view with imagery, category filters (Breakfast, Main, Dessert, Side, Appetizer, Bread, Dip/Sauce, Snack), and contributor filters.
- **Detailed Recipe View:** Full ingredients, step-by-step instructions, prep/cook times, calories, and heirloom notes.
- **Alphabetical Index:** A–Z table with grouping (numeric/symbol titles under "#").
- **Image Accuracy:** Anti-hallucination prompt rules in `shared/recipeImagePrompts.mjs`; images match recipe content.
- **Image Sources:** Manual upload, Imagen (Gemini), or Pollinations. Optional `imageSource` metadata for tracking.

### 3.2 Family Gallery

- **Visual Memories:** Archived family photos and culinary snapshots.
- **Captions:** Descriptive captions for each item.
- **Broken/Empty Image UX:** Clear "Image failed to load" or "No image" states when uploads fail.
- **Admin-Only Delete:** Only admins can remove gallery items.

### 3.3 Family Story (formerly History)

- **Static Narrative:** Tab dedicated to the family food history story.
- **Renamed from "History"** to reduce confusion with Profile contribution log.

### 3.4 Interactive Trivia

- **Family History:** Repository of trivia questions about Schafer history and traditions.
- **Immediate Feedback:** Answers with explanations.
- **Zero-Guard:** Safe division when no questions exist.

### 3.5 Contributor Profiles

- **Directory:** Avatar-based directory of family contributors.
- **Association:** Recipes, gallery, and trivia linked to contributors.
- **Phone (E.164):** Optional `phone` field for MMS attribution in gallery.

## 4. Admin & Contributor Features

### 4.1 AI-Powered Tools

- **Magic Import:** Paste raw recipe text; Gemini extracts structured JSON.
- **Imagen Integration:** Generate dish photos from recipe ingredients using shared anti-hallucination prompts.
- **Bulk Visual Sourcing:** Fill missing images or regenerate all via Imagen.
- **API Key Proxy:** All Gemini/Imagen calls route through `/api/gemini`; key never exposed to client.

### 4.2 Content Management

- **Manual Entry:** Forms for recipes, gallery, trivia.
- **Image Upload:** Heritage photos to Firebase Storage or local data URL.
- **Edit/Delete:** Full CRUD for admins.
- **Contributor Merge:** Combine recipes under a single contributor name.

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
- **Deployment:** Vercel
- **AI:** Google Gemini (Flash + Imagen 3) via serverless proxy

### 5.2 Architecture

- **Code Splitting:** Lazy load for AdminView, TriviaView, HistoryView, AlphabeticalIndex, ContributorsView, ProfileView.
- **Bundle Optimization:** `manualChunks` for Firebase and @google/genai.
- **API Routes:** `/api/gemini` (Gemini/Imagen), `/api/webhook` (Twilio MMS → gallery).

### 5.3 Security

- **API Key:** `GEMINI_API_KEY` server-side only (Vercel env).
- **Identity:** Name-based; acceptable for family use. Document limitations.

### 5.4 Accessibility

- **RecipeModal:** `role="dialog"`, `aria-modal="true"`, `aria-label` on close buttons, Escape key, focus management.
- **Lightbox:** Same accessibility patterns.

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

- **Vitest + React Testing Library:** Component and integration tests.
- **Coverage:** AdminView, AvatarPicker, RecipeModal, webhook, db, Header, etc.
- **Mocks:** Firebase, GenAI, Twilio.

## 9. Access & Deployment

- **Production URL:** [https://schafer-family-cookbook.vercel.app](https://schafer-family-cookbook.vercel.app)
- **Admin Login:** Use "Admin" (or designated name) for full privileges.
- **Env Vars:** `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT` (for webhook).
