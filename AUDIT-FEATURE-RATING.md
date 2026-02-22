# Feature Rating Audit
**App**: Schafer Family Cookbook
**Date**: February 21, 2025

## Summary
- **Overall score**: 7.5 / 10
- **Highest**: Recipe Modal, Trivia, Family Story, Header (8/10)
- **Needs work**: Alphabetical Index scroll spy (7/10), Admin form labels (7/10)

---

## Feature Ratings

### Recipe Archive — 8/10
**Route/Scope**: Recipes tab, main grid + RecipeModal

**Rationale**: Full browse, search, category/contributor filters, deep-linking (#recipe/id), accessible card navigation (tabIndex, role="button", aria-label, keyboard), image placeholders, AI badge for Imagen-generated images. RecipeModal has focus trap, Escape, Share, Print, JSON-LD schema, image lightbox, scroll-to-top. Print-specific CSS in index.html.

**Recommendations** (if score < 8):
1. Add `aria-label` or `label` for the recipe search input and category/contributor selects on the main Recipes tab.
2. Consider WebP/AVIF with fallback for recipe images in lightbox.

---

### Recipe Index (A–Z) — 7/10
**Route/Scope**: Index tab, AlphabeticalIndex

**Rationale**: Letter strip (horizontal on mobile, vertical on desktop), disabled state for empty letters, scroll-to-section, semantic grouping for numeric/symbol titles. Good aria-labels on letter buttons.

**Recommendations**:
1. Add scroll spy: set `aria-current="true"` on the letter section currently in view (like Family Story TOC).
2. Consider sticky section headers during scroll for long lists.

---

### Family Gallery — 7/10
**Route/Scope**: Gallery tab

**Rationale**: Masonry layout, photo/video support, text-to-archive phone hint, broken-image fallback, admin delete. Videos have controls, playsInline, onFocus/onBlur for keyboard. Images use GalleryLightbox (dialog, Escape, focus), lazy loading. Empty state and loading skeleton.

**Recommendations**:
1. Consider fullscreen viewer for videos (currently only images open in lightbox).
2. Add `loading="lazy"` to GalleryLightbox image if loading large files.

---

### Trivia Quiz — 8/10
**Route/Scope**: Trivia tab, TriviaView

**Rationale**: Start flow, answer with 1–4 keys, immediate feedback, results screen, Try Again, Review answers. `aria-pressed` on buttons, `aria-disabled`, `aria-live` for feedback. Progress bar, explanation after each answer.

**Recommendations**:
1. Optional: Add haptic feedback (Vibration API) on correct/incorrect for mobile.
2. Optional: Consider persisting high scores across sessions.

---

### Family Story — 8/10
**Route/Scope**: Family Story tab, HistoryView

**Rationale**: Static narrative, semantic sections, table of contents with `aria-current`, scroll spy, Print Story button, Back to top FAB. Print-specific CSS when `body.print-history`. Skip link, clear headings.

**Recommendations**:
1. Ensure font size is at least 16px for readability (currently text-lg, verify on small screens).

---

### Contributors — 7.5/10
**Route/Scope**: Contributors tab, ContributorsView

**Rationale**: Grid of cards, avatar, search with label, "Explore Collection" with `aria-label` including contributor name and contribution summary. Min-height ~44px on Explore button for touch targets. Admin badge with aria-label.

**Recommendations**:
1. Verify Explore button meets 44px touch target on very small viewports (min-h-[2.75rem] ≈ 44px).

---

### Profile — 7.5/10
**Route/Scope**: Profile tab, ProfileView, AvatarPicker

**Rationale**: Edit name/avatar with `htmlFor`/`id`, `aria-busy` during save. My Recipes, contribution history. AvatarPicker has focus trap, Escape. Admin can edit recipes from profile. Error and success feedback.

**Recommendations**:
1. Consider `aria-live="polite"` region for save result announcement.

---

### Admin — 7/10
**Route/Scope**: Admin tab, AdminView

**Rationale**: Subtabs (Records, Gallery, Trivia, Directory, Permissions), Magic Import, Imagen (single + bulk), CRUD, confirm dialogs, progress for bulk ops. AI cooldown with countdown. Some labels (admin-recipe-search, admin-recipe-title, admin-recipe-contributor, admin-recipe-notes, admin-archive-phone).

**Recommendations**:
1. Add `htmlFor`/`id` for: category select, prep time, cook time, calories inputs; ingredients and instructions textareas; gallery caption input.
2. Associate labels with file inputs (e.g. `id` on input, `htmlFor` on a wrapper label or sr-only label).
3. Add `aria-label` to icon-only buttons (✨ Quick Gen, 🖼️ Use Default, Edit, 🗑️ Delete).

---

### Login — 7.5/10
**Route/Scope**: Pre-auth screen

**Rationale**: Name-based login, label with `htmlFor="login-name"`, avatar preview, "Need access? Contact an administrator" link. aria-busy on input and button during submit.

**Recommendations**:
1. Consider removing or conditionally applying `autoFocus` for accessibility (screen reader users may prefer to start at top).
2. Optional: Add visible "Need help?" or similar for access requests.

---

### Header & Navigation — 8/10
**Route/Scope**: Header component, tab nav

**Rationale**: Sticky nav, logo and profile area have `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space. Tab buttons with title tooltips. Scroll-into-view for active tab on narrow screens.

**Recommendations**:
1. Optional: Add `aria-current="page"` to active tab for screen readers.

---

## Top Cross-Cutting Recommendations
1. **Form labels**: Add `htmlFor`/`id` to all remaining Admin inputs (category, prep/cook/calories, ingredients, instructions, gallery caption) and main Recipes filters (search, category, contributor selects).
2. **Icon-only buttons**: Ensure all icon-only buttons have `aria-label` (Admin quick actions, Header logout).
3. **Alphabetical Index**: Implement scroll spy with `aria-current` for letter in view.
4. **Touch targets**: Final audit for 44px minimum on all tappable elements (Log out, small Admin buttons).
5. **Safe area**: Add `env(safe-area-inset-*)` for notched devices on fixed elements (Header, FABs).
