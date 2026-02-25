# Feature Plan: Next 1–2 Weeks

**Scope:** Vibration API, fix E2E, add Favorites/Recently Viewed to Profile  
**Duration:** ~1–2 weeks  
**Includes:** Unit and E2E tests for each feature

---

## 1. Vibration API

### Overview

Add haptic feedback on key actions to improve mobile UX (per AUDIT-MOBILE-UX.md). Use `navigator.vibrate()` with feature detection; no-op when unsupported.

### Design

- **Utility:** `src/utils/vibration.ts`
  - `vibrateShort()` → success/confirm feedback (e.g. `[50]`)
  - `vibrateError()` → error feedback (e.g. `[100, 50, 100]`)
  - Feature detection: only call `navigator.vibrate` when available
  - No-op in non-secure contexts (e.g. `http` may not support it)

### Integration Points

| Action                         | Feedback type |
|--------------------------------|---------------|
| Trivia: correct answer         | `vibrateShort()` |
| Trivia: incorrect answer       | `vibrateError()` |
| Trivia: quiz complete           | `vibrateShort()` |
| Toggle favorite (add/remove)    | `vibrateShort()` |
| Profile save success            | `vibrateShort()` |
| Toast success                  | Optional: `vibrateShort()` |
| Toast error                    | Optional: `vibrateError()` |

### Tests

- **Unit** (`src/utils/vibration.test.ts`):
  - When `navigator.vibrate` exists and is called, it receives expected pattern
  - When `navigator.vibrate` is absent, no error; calls are no-op
  - Mock `navigator.vibrate` in tests
- **E2E:** Not practical (browser API; no Playwright assertion). Manual verification only.

### Implementation Tasks

1. [ ] Add `src/utils/vibration.ts` with `vibrateShort` and `vibrateError`
2. [ ] Add `src/utils/vibration.test.ts` unit tests
3. [ ] Integrate in `TriviaView.tsx` (correct/incorrect/complete)
4. [ ] Integrate in `App.tsx` (`handleToggleFavorite`)
5. [ ] Integrate in `ProfileView.tsx` (save success)
6. [ ] Optional: Integrate in `UIContext` toast handler
7. [ ] Update `AUDIT-MOBILE-UX.md` checklist for Vibration API

---

## 2. Fix E2E Tests

### Current State

- E2E specs: `e2e/profile.spec.ts`, `e2e/gallery.spec.ts`, `e2e/trivia.spec.ts`, etc.
- Fixtures: `loginAs()`, `loginAsAdmin()` in `e2e/fixtures.ts`
- Playwright config: Desktop Chrome + Firefox; `baseURL` 4173; `webServer` build+preview
- Several tests show `error-context.md` / `test-failed-1.png` (failures)

### Likely Root Causes

1. **Selector drift:** `getByRole('button', { name: 'Profile' })` — multiple buttons may match; nav tabs vs Footer vs BottomNav
2. **Timing:** Lazy-loaded Profile/Gallery/Trivia; `waitFor` may need adjustment
3. **Placeholder/label:** Fixture waits for `getByPlaceholder(/Search by title/i)` — placeholder is `Search by title...`; aria-label is `Search recipes by title` (both should work)
4. **Viewport:** Some tests may expect desktop layout; `md:hidden` / `hidden md:flex` affect visibility
5. **Data dependency:** Tests may rely on Firestore data; ensure mock/emulator or stable seed

### Fix Strategy

1. Run full E2E suite locally to reproduce failures.
2. Use more specific selectors where needed:
   - Profile: `getByRole('tab', { name: 'Profile' })` or `getByRole('button', { name: /^Profile$/ })` to avoid matching "Alice, view profile"
   - If Header uses `<button>` (not `role="tab"`), prefer `locator('[id="tab-Profile"]')` or unique test ID
3. Add `test-id` attributes where helpful:
   - `data-testid="nav-profile"` on Profile tab
   - `data-testid="profile-view"` on Profile container
4. Increase `waitFor` timeouts for lazy-loaded views where needed.
5. Ensure fixtures clear storage and wait for app-ready state before assertions.

### Implementation Tasks

1. [ ] Run `npm run test:e2e` and capture failing tests
2. [ ] Add `data-testid` to Header tabs, Footer, BottomNav where useful
3. [ ] Update profile.spec.ts selectors to use unambiguous locators
4. [ ] Update gallery.spec.ts, trivia.spec.ts, recipes.spec.ts, admin.spec.ts as needed
5. [ ] Adjust `loginAs` / `loginAsAdmin` waits if needed
6. [ ] Document any required env (e.g. Firebase emulator) for E2E
7. [ ] Add `playwright-report` and `test-results` to `.gitignore` if not already

---

## 3. Add Favorites / Recently Viewed to Profile

### Overview

Profile currently shows "My Shared Recipes" and "My Contribution Log". Add two sections:

- **My Favorites** — recipes the user has favorited (from `favorites.ts`)
- **Recently Viewed** — recipes recently opened (from `recentlyViewed.ts`)

### Data Flow

- **Favorites:** `getFavoriteIds()` → filter `recipes` by id → pass `favoriteRecipes` to Profile
- **Recently Viewed:** Add `getRecentEntries()` to `recentlyViewed.ts` (returns `{id, title, viewedAt}[]`) → resolve ids against `recipes` for images → pass `recentEntries` (or derived `recentRecipes`) to Profile
- **Callbacks:** `onViewRecipe(recipe)` to open recipe modal from Profile

### `recentlyViewed.ts` Changes

```ts
/** Get recently viewed entries (id, title, viewedAt) in order. */
export function getRecentEntries(): RecentlyViewedEntry[] {
  return loadEntries();
}
```

### `ProfileView` Changes

- New props: `favoriteRecipes: Recipe[]`, `recentRecipes: (Recipe | { id; title })[]`, `onViewRecipe: (r: Recipe | { id; title }) => void`
- New sections (similar layout to "My Shared Recipes"):
  - **My Favorites** (❤️ icon)
  - **Recently Viewed** (🕐 icon)
- Each row: thumbnail, title, category (if available), click opens recipe
- Empty states: "No favorites yet" / "No recently viewed recipes"

### `App.tsx` Changes

- Compute `favoriteRecipes = recipes.filter(r => favoriteIds.has(r.id))`
- Compute `recentEntries = getRecentEntries()`; map to recipes where possible for images
- Pass `favoriteRecipes`, `recentRecipes`, `onViewRecipe={handleNavigateToRecipe}` to `ProfileView`

### Tests

- **Unit (`ProfileView.test.tsx`):**
  - Renders "My Favorites" when `favoriteRecipes` has items
  - Renders "No favorites yet" when `favoriteRecipes` is empty
  - Renders "Recently Viewed" when `recentRecipes` has items
  - Renders "No recently viewed" when empty
  - Clicking a favorite calls `onViewRecipe` with correct recipe
  - Clicking a recent item calls `onViewRecipe` with correct data

- **Unit (`favorites.test.ts`, `recentlyViewed.test.ts`):**
  - `getFavoriteIds`, `toggleFavorite`, `isFavorite` behavior
  - `recordRecipeView`, `getRecentRecipeIds`, `getRecentEntries` behavior (mock `localStorage`)

- **E2E (`profile.spec.ts`):**
  - After viewing a recipe, Profile shows it in "Recently Viewed"
  - After favoriting a recipe, Profile shows it in "My Favorites"
  - Clicking a recently viewed recipe opens the modal
  - Clicking a favorite opens the modal

### Implementation Tasks

1. [ ] Add `getRecentEntries()` to `recentlyViewed.ts`
2. [ ] Add `src/utils/favorites.test.ts` and `src/utils/recentlyViewed.test.ts`
3. [ ] Extend `ProfileView` props: `favoriteRecipes`, `recentRecipes`, `onViewRecipe`
4. [ ] Add "My Favorites" and "Recently Viewed" sections to `ProfileView`
5. [ ] Update `App.tsx` to compute and pass new props
6. [ ] Add unit tests in `ProfileView.test.tsx` for favorites and recently viewed
7. [ ] Add E2E tests in `profile.spec.ts` for favorites and recently viewed flows

---

## Suggested Order of Work

| Week | Focus | Tasks |
|------|--------|------|
| **1** | E2E fix + Profile Favorites/Recent | 1) Run E2E, fix selectors and timing<br>2) Add `getRecentEntries`, extend Profile with favorites/recent<br>3) Unit + E2E for Profile |
| **2** | Vibration API + polish | 4) Add vibration utility and tests<br>5) Integrate vibration in Trivia, favorites, Profile save<br>6) Final E2E and manual QA |

---

## File Checklist

### New Files

- `src/utils/vibration.ts`
- `src/utils/vibration.test.ts`
- `src/utils/favorites.test.ts`
- `src/utils/recentlyViewed.test.ts`

### Modified Files

- `src/utils/recentlyViewed.ts` — add `getRecentEntries`
- `src/components/ProfileView.tsx` — favorites + recently viewed sections
- `src/App.tsx` — pass new props, wire `onViewRecipe`
- `src/components/TriviaView.tsx` — vibration on answer/complete
- `e2e/profile.spec.ts` — new tests + selector fixes
- `e2e/fixtures.ts` — if needed for timing
- `AUDIT-MOBILE-UX.md` — check off Vibration API

### Optional

- Other E2E specs (gallery, trivia, recipes, admin) — selector fixes
- `UIContext` — vibration on toast
- `data-testid` in Header, Footer, BottomNav for more robust E2E
