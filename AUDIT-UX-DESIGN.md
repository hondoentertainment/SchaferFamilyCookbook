# UX Design Review: Schafer Family Cookbook

> **Last reviewed: May 2026.** Most of the recommendations below have shipped — form labels, Trivia ARIA roles, safe-area padding, Gallery video focus handlers, and Gallery skeleton are now in production. See the **Prioritized List** section at the bottom for current status. Remaining open items: breadcrumb for deep-linked recipes, a `aria-live` polite region for ProfileView save announcements (tracked in `AUDIT-FEATURE-RATING.md` and `FEATURE-PLAN-NEXT-2-WEEKS.md`).

## Executive Summary
The app delivers a clear, family-focused recipe archive with strong information architecture and thoughtful flows. The main improvements are in accessibility (labels, keyboard, ARIA), visual consistency of interactive elements, and mobile polish (safe area, touch targets).

## Strengths
- **IA & navigation**: Tab names are clear (Recipes, Index, Gallery, Trivia, Family Story, Contributors, Profile, Admin). Current tab is visually indicated. Profile and Admin are contextually shown.
- **Primary flows**: Login → Browse → View recipe is straightforward. Deep links (#recipe/id) work. Admin flows have confirmations for destructive actions.
- **Feedback**: Toasts for success/error, loading skeletons for Recipes and Contributors, progress for bulk image generation.
- **Modals**: RecipeModal and AvatarPicker use focus trap, Escape to close. Confirm dialogs are modal with clear primary/cancel.
- **Content**: Category icons, contributor attribution, AI badge for Imagen images add clarity.

## Recommendations by Area

### 1. Information Architecture & Navigation
| Finding | Recommendation |
|---------|-----------------|
| "Family Story" vs "History" naming was resolved | ✓ Good |
| No breadcrumb for deep links | Consider "Recipes > [Recipe Title]" when opening modal from Index/Contributors |
| Admin subtabs could be clearer | Add `aria-current="true"` on active subnav |

### 2. Primary User Flows
| Finding | Recommendation |
|---------|-----------------|
| Empty states present (no recipes, no gallery) | ✓ Good |
| Login has no "forgot access?" path | Add "Need access? Contact an administrator." link (already in copy; could be a mailto) |
| Bulk operations have good progress | ✓ Good |

### 3. Feedback & System Status
| Finding | Recommendation |
|---------|-----------------|
| Toasts are concise | ✓ Good |
| Skeleton for Recipes, Contributors | Add skeleton for Gallery load |
| Magic Import / AI generation loading | Spinner/state visible | ✓ Good |

### 4. Accessibility
| Finding | Recommendation |
|---------|-----------------|
| Several forms lack `label` association | Add `htmlFor`/`id` to inputs and labels (Login, Profile, Admin forms) |
| `autoFocus` on login input | Use conditionally or remove; can hurt screen reader users |
| Div/span click handlers | Add `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space) |
| Video in Gallery | Add `onFocus`/`onBlur` with `onMouseOver`/`onMouseOut` |
| Trivia `aria-pressed` on `listitem` | Use `button` or `option` role for options |

### 5. Visual Consistency & Clarity
| Finding | Recommendation |
|---------|-----------------|
| Primary (green), secondary, danger (red) are distinct | ✓ Good |
| Icon-only buttons have `aria-label` or `title` | ✓ Good |
| Typography hierarchy clear (serif for titles) | ✓ Good |

### 6. Mobile & Performance
| Finding | Recommendation |
|---------|-----------------|
| Touch targets: 44px rule exists | Audit all interactive elements |
| Safe area | Add `env(safe-area-inset-*)` for notched devices |
| Input zoom | Ensure 16px on inputs |
| Code splitting | Lazy load for Admin, Trivia, Index, etc. | ✓ Good |

## Prioritized List

### High — all shipped (May 2026)
- ~~Fix form label associations~~ **DONE** — AdminView/Profile/Login inputs now have `htmlFor`/`id`. See `AUDIT-FEATURE-RATING.md` for line refs.
- ~~Add keyboard handlers to clickable divs~~ **DONE** — Header logo/profile-area buttons use `role="button" tabIndex={0} onKeyDown` (Enter/Space). Recipe cards rendered as `<button>` elements.
- ~~Fix Trivia ARIA roles~~ **DONE** — Trivia answer options in `TriviaView.tsx` (line ~657) are native `<button>` elements with `aria-pressed`, not `role="listitem"`. The remaining `role="listitem"` (line 527) is on score-breakdown chips inside `role="list"`, which is the correct semantic.

### Medium — all shipped (May 2026)
- ~~Safe-area padding~~ **DONE** — `env(safe-area-inset-*)` applied to main padding and bottom nav.
- ~~Gallery video focus handlers~~ **DONE** — Gallery videos now have `onFocus`/`onBlur` paired with `onMouseOver`/`onMouseOut`.
- ~~Skeleton for Gallery~~ **DONE** — Gallery shows a loading skeleton on initial load.

### Lower — mixed status (May 2026)
- **Breadcrumb for deep links** — still open. When `RecipeModal` is opened from `AlphabeticalIndex`, `ContributorsView`, or a `#recipe/<id>` deep link, show a small breadcrumb like "Recipes › *Title*" or "A–Z › *Title*" so users have orientation. Tracked in `FEATURE-PLAN-NEXT-2-WEEKS.md`.
- ~~`aria-current` on Admin subtabs~~ **DONE** — `src/components/AdminView.tsx` line 764 sets `aria-current={activeSubtab === tab.id ? 'true' : undefined}` on each subnav button.
- ~~`apple-touch-startup-image`~~ **DONE** (see `AUDIT-MOBILE-UX.md` checklist).
