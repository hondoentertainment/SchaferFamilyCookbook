# Feature Rating Audit
**App**: Schafer Family Cookbook
**Date**: February 21, 2025
**Last reviewed: May 2026** — many of the recommendations below have shipped. Status notes added inline so reviewers can focus on what's still open.

## Summary
- **Overall score**: 7.5 / 10
- **Highest**: Recipe Modal, Trivia, Family Story, Header (8/10)
- **Needs work**: Alphabetical Index scroll spy (7/10), Admin form labels (7/10)
- **Status snapshot (June 2026):** Sticky A–Z headers, gallery video lightbox, Profile save announcements, and Home breadcrumb in the recipe modal are implemented. Remaining optional polish: WebP/AVIF in recipe lightbox, fullscreen video controls polish.

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
1. ~~Add scroll spy: set `aria-current="true"` on the letter section currently in view (like Family Story TOC).~~ **DONE (May 2026)** — `src/components/AlphabeticalIndex.tsx` uses `IntersectionObserver` (lines ~65–106) and sets `aria-current="true"` on the active letter button in both the mobile strip (line 136) and the desktop sticky nav (line 155). The active letter also receives a visual `bg-[#2D4635] text-white scale-110` treatment.
2. ~~Consider sticky section headers during scroll for long lists.~~ **DONE (June 2026)** — letter section `<h3>` headers use `sticky top-[120px]` with backdrop blur.

---

### Family Gallery — 7/10
**Route/Scope**: Gallery tab

**Rationale**: Masonry layout, photo/video support, text-to-archive phone hint, broken-image fallback, admin delete. Videos have controls, playsInline, onFocus/onBlur for keyboard. Images use GalleryLightbox (dialog, Escape, focus), lazy loading. Empty state and loading skeleton.

**Recommendations**:
1. ~~Consider fullscreen viewer for videos (currently only images open in lightbox).~~ **DONE (June 2026)** — `GalleryLightbox` opens videos in a fullscreen dialog with controls and `aria-label="Fullscreen gallery video"`.
2. Add `loading="lazy"` to GalleryLightbox image if loading large files.

---

### Trivia Quiz — 8/10
**Route/Scope**: Trivia tab, TriviaView

**Rationale**: Start flow, answer with 1–4 keys, immediate feedback, results screen, Try Again, Review answers. `aria-pressed` on buttons, `aria-disabled`, `aria-live` for feedback. Progress bar, explanation after each answer.

**Recommendations**:
1. ~~Optional: Add haptic feedback (Vibration API) on correct/incorrect for mobile.~~ **DONE (May 2026)** — `TriviaView.tsx` triggers `navigator.vibrate` (via the shared `vibration` utility) on correct, incorrect, and quiz-complete events; feature-detected so unsupported browsers no-op cleanly.
2. ~~Optional: Consider persisting high scores across sessions.~~ **DONE** — local `triviaScores` history plus Firestore family leaderboard (`triviaScores` collection) are wired in `TriviaView.tsx` / `FamilyLeaderboard`.

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
1. **STILL OPEN (low priority)** — ~~Add a hidden `role="status" aria-live="polite"` node alongside the form that updates on success/error.~~ **DONE (June 2026)** — `profile-save-announcement` region announces save results.

---

### Admin — 7/10
**Route/Scope**: Admin tab, AdminView

**Rationale**: Subtabs (Records, Gallery, Trivia, Directory, Permissions), Magic Import, Imagen (single + bulk), CRUD, confirm dialogs, progress for bulk ops. AI cooldown with countdown. Some labels (admin-recipe-search, admin-recipe-title, admin-recipe-contributor, admin-recipe-notes, admin-archive-phone).

**Recommendations**:
1. ~~Add `htmlFor`/`id` for: category select, prep time, cook time, calories inputs; ingredients and instructions textareas; gallery caption input.~~ **DONE (May 2026)** — `AdminView.tsx` now has matched `<label htmlFor="…">`/`id` pairs for category (line 1267), prep time (1273), cook time (1277), calories (1281), ingredients (1286), instructions (1290), heirloom notes (1296), tag input (1308), archive phone (1383), and gallery caption (1420).
2. ~~Associate labels with file inputs (e.g. `id` on input, `htmlFor` on a wrapper label or sr-only label).~~ **DONE** — see `admin-gallery-file` (line 1411–1412) with wrapper `<label htmlFor>` and `aria-label` on the input itself.
3. Add `aria-label` to icon-only buttons (✨ Quick Gen, 🖼️ Use Default, Edit, 🗑️ Delete). **PARTIAL** — most icon-only buttons in the Manage Recipes list already carry `aria-label`/`title`; spot-check Imagen quick-gen and bulk-image buttons added after this audit.

---

### Login — 7.5/10
**Route/Scope**: Pre-auth screen

**Rationale**: Name-based login, label with `htmlFor="login-name"`, avatar preview, "Need access? Contact an administrator" link. aria-busy on input and button during submit.

**Recommendations**:
1. ~~Consider removing or conditionally applying `autoFocus` for accessibility (screen reader users may prefer to start at top).~~ **DONE (May 2026)** — the `#login-name` input in `src/App.tsx` (around line 1331) no longer sets `autoFocus`; users land on the page heading and tab into the form naturally. (A repo-wide search for `autoFocus` returns no source matches.)
2. Optional: Add visible "Need help?" or similar for access requests.

---

### Header & Navigation — 8/10
**Route/Scope**: Header component, tab nav

**Rationale**: Sticky nav, logo and profile area have `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space. Tab buttons with title tooltips. Scroll-into-view for active tab on narrow screens.

**Recommendations**:
1. ~~Optional: Add `aria-current="page"` to active tab for screen readers.~~ **DONE (May 2026)** — `src/components/Header.tsx` line 111 sets `aria-current={isTabActive(id) ? 'page' : undefined}` on every nav tab button.

---

## Top Cross-Cutting Recommendations
1. ~~**Form labels**~~ **DONE (May 2026)** — Admin inputs and Recipes filters all carry `htmlFor`/`id`. See AdminView line refs above.
2. **Icon-only buttons** — mostly addressed; sweep newer admin AI buttons periodically.
3. ~~**Alphabetical Index** scroll spy with `aria-current`~~ **DONE (May 2026)** — `AlphabeticalIndex.tsx` (IntersectionObserver + `aria-current`).
4. **Touch targets** — global `min-h-11`/`min-w-11` rules in place; do a quarterly visual pass for any new small icon buttons.
5. ~~**Safe area**~~ **DONE (May 2026)** — `env(safe-area-inset-*)` is applied to the main content padding and bottom nav (see `AUDIT-MOBILE-UX.md` checklist, which is now fully checked off).

## Still open (May 2026)
- Profile save: add `aria-live="polite"` status region (low priority, see ProfileView entry).
- Breadcrumb / context line in `RecipeModal` when opened from Contributors / Index / deep link (see UX audit).
