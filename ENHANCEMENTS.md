# Site Review: Enhancements & Bug Fixes

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

---

## Open / Future

### Recipe image source metadata
- Optional `imageSource?: 'upload' | 'imagen' | 'pollinations'` for explicit tracking.
- Current: AI badge inferred from URL patterns (pollinations.ai, /recipe-images/).

### API key in local dev
- AI features require deployed `/api/gemini` or `GEMINI_API_KEY` in Vercel env.
- Document in README for contributors.

### Webhook test refinement
- Expand with Firebase/Twilio integration mocks for full flow.
