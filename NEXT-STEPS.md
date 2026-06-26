# Recommended Next Steps

_Last updated: 2026-06-26 (batch 5)_

## Recently shipped (June 2026 — batch 5)

### UX polish & scroll reduction (continued) — ✅ shipped

- **Gallery, Trivia, Recipes, Family Story** — shared `PageHeader` / `view-shell` layout; mobile story jump pills; compact trivia skeleton
- **Home** — tabbed Recently viewed / Favorites shelf; collapsed community feed panel
- **Meal Plan** — sticky footer for week grocery + copy actions
- **Grocery** — keyboard-safe scroll on manual-add input (`visualViewport`)
- **Recipe modal** — mobile Read mode: instructions first, collapsible ingredients; deferred “You might also like”
- **Profile** — admin tools collapsed by default (opens when editing)
- **Admin** — sticky subtab jump strip
- **Recipes** — contributor filter hero; desktop filter chips; search focus from Home
- **Offline cook cache** — IndexedDB snapshot for deep-link Cook Mode when offline
- **E2E** — `e2e/ux-collapsible.spec.ts` for search focus, shelf tabs, meal-plan footer, suggestions panel

### Batch 4 (prior)

- Shared **`PageHeader`**, **`CollapsiblePanel`**, **`view-shell`** utilities
- Meal Plan accordion days; Grocery checked panel; Profile activity tabs; Help/Privacy collapsibles

### Vercel env hygiene — ✅ shipped

- Removed misnamed env var (`AIzaSy…` used as the variable name)
- `npm run verify:vercel-env` fails on misnamed keys and lists optional push vars

## What to do next (manual — needs external consoles)

1. **Sentry DSN** — [Create a Sentry project](https://sentry.io) → add on Vercel Production:
   - `VITE_SENTRY_DSN`
   - Optional: `VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=0.1`
   - **Source maps (recommended):** `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in Vercel build env
   - Redeploy production after setting vars
2. **Firebase push (optional)** — Firebase Console → add on Vercel Production:
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FCM_VAPID_KEY`
   - See `docs/FIREBASE_PUSH_NOTIFICATIONS.md`
3. **Lighthouse review** — download artifact from the next **Lighthouse CI** GitHub Action run; tune `lighthouserc.cjs` if scores drift
4. **Recipe images** — run `npm run images:batch` for cards still on fallback covers (admin banner shows count)

## Explicitly deferred

- Real OAuth/email auth for guests
- Gamification (trivia streaks, badges)
- Multi-tenant / site forks
- Family Story CMS live preview before publish
