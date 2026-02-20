# Feature Rating Audit
**App**: Schafer Family Cookbook
**Date**: February 20, 2025

## Summary
- **Overall score**: 7.4 / 10
- **Highest**: Recipe Modal & Trivia (8/10)
- **Needs work**: Gallery video UX (5/10), Form labels/a11y (6/10)

---

## Feature Ratings

### Recipe Archive — 8/10
**Route/Scope**: Recipes tab, main grid + RecipeModal

**Rationale**: Full browse, search, category/contributor filters, deep-linking (#recipe/id), accessible card navigation (tabIndex, aria-label, keyboard), image placeholders, AI badge for Imagen-generated images. RecipeModal has focus trap, Escape, Share, Print, JSON-LD schema.

**Recommendations** (if score < 8):
1. Add print-specific CSS for cleaner recipe printouts.
2. Consider serving larger images in lightbox (WebP/AVIF with fallback).

---

### Recipe Index (A–Z) — 7/10
**Route/Scope**: Index tab, AlphabeticalIndex

**Rationale**: Letter strip (horizontal on mobile, vertical on desktop), disabled state for empty letters, scroll-to-section, semantic grouping for numeric/symbol titles.

**Recommendations**:
1. Add `aria-current` when a letter section is in view.
2. Consider sticky section headers during scroll for long lists.

---

### Family Gallery — 6/10
**Route/Scope**: Gallery tab

**Rationale**: Masonry layout, photo/video support, text-to-archive phone hint, broken-image fallback, admin delete. Videos have controls, playsInline.

**Recommendations**:
1. Video: `onMouseOver`/`onMouseOut` need `onFocus`/`onBlur` for keyboard accessibility (jsx-a11y).
2. Add lazy loading with Intersection Observer for below-fold images.
3. Consider lightbox for gallery images (similar to RecipeModal).

---

### Trivia Quiz — 8/10
**Route/Scope**: Trivia tab, TriviaView

**Rationale**: Start flow, answer with 1–4 keys, immediate feedback, results screen, Try Again. `aria-pressed`, `aria-disabled`, `aria-live` for feedback.

**Recommendations**:
1. Fix `aria-pressed`/`aria-disabled` on `listitem` role (use `button` or `option`).
2. Add haptic feedback on correct/incorrect (Vibration API) for mobile.

---

### Family Story — 7/10
**Route/Scope**: Family Story tab, HistoryView

**Rationale**: Static narrative, semantic sections, clear headings.

**Recommendations**:
1. Add table of contents for long content.
2. Ensure font size scales for readability (min 16px).

---

### Contributors — 7/10
**Route/Scope**: Contributors tab, ContributorsView

**Rationale**: Grid of cards, avatar, “Explore Collection” filters Recipes by contributor.

**Recommendations**:
1. Ensure 44px touch targets on “Explore” buttons.
2. Add `aria-label` describing contributor name + action.

---

### Profile — 7/10
**Route/Scope**: Profile tab, ProfileView, AvatarPicker

**Rationale**: Edit name/avatar, view My Recipes, contribution history. AvatarPicker has focus trap, Escape. Admin can edit recipes from profile.

**Recommendations**:
1. Associate form label with name input (`htmlFor` + `id`) for jsx-a11y.
2. Add `aria-busy` during save.

---

### Admin — 7/10
**Route/Scope**: Admin tab, AdminView

**Rationale**: Subtabs (Records, Gallery, Trivia, Directory, Permissions), Magic Import, Imagen generation (single + bulk), CRUD, confirm dialogs, progress for bulk ops.

**Recommendations**:
1. Fix `label-has-associated-control` on several form labels.
2. Add keyboard listeners (`onKeyDown`) to clickable divs (logo, profile area) for jsx-a11y.
3. Add `role="button"` and `tabIndex={0}` to non-button click targets.

---

### Login — 7/10
**Route/Scope**: Pre-auth screen

**Rationale**: Name-based login, avatar preview, simple flow.

**Recommendations**:
1. Associate label with input (`htmlFor`).
2. Remove or conditionally use `autoFocus` (a11y concern).
3. Add “Need help?” link for access requests.

---

## Top Cross-Cutting Recommendations
1. **Accessibility**: Fix jsx-a11y findings (labels, keyboard handlers, `aria-*` on interactive elements).
2. **Form labels**: Ensure all inputs have associated labels via `htmlFor`/`id`.
3. **Keyboard nav**: Add `onKeyDown` (Enter/Space) to all clickable non-button elements.
4. **Touch targets**: Audit mobile for 44px minimum on all tappable elements.
5. **Safe area**: Add `env(safe-area-inset-*)` for notched devices.
