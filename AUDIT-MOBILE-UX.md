# Mobile-First UX Audit: Schafer Family Cookbook

## Executive Summary
The app has solid mobile foundations: PWA manifest, viewport config, responsive Tailwind breakpoints, and touch-target rules. The main gaps are safe-area handling for notched devices, some touch-target consistency, and keyboard/accessibility on video and div-based click handlers.

## Current Strengths
- **Responsive layout**: Mobile-first breakpoints (`sm:`, `md:`, `lg:`); recipe grid 2→5 cols; filters stack on mobile.
- **PWA**: vite-plugin-pwa with manifest (name, icons, standalone), Workbox runtime caching, auto-update.
- **Meta**: `theme-color`, `apple-mobile-web-app-capable`, viewport `width=device-width`.
- **Touch targets**: Global rule `min-height: 44px; min-width: 44px` for buttons/links on small screens.
- **Modals**: RecipeModal and AvatarPicker use focus trap; RecipeModal slides up on mobile.
- **Nav**: Horizontal scroll with `no-scrollbar`, `scroll-smooth`; `scrollIntoView` on tab click.

## Findings and Recommendations

### Critical (fix immediately)
| Area | Finding | Recommendation |
|------|---------|----------------|
| Safe area | No `env(safe-area-inset-*)` usage | Add `padding-bottom: env(safe-area-inset-bottom)` to main content and fixed bottom elements; `padding-top` for sticky header if needed |
| Source order | Login/Profile may not match visual order on some screen readers | Ensure DOM order matches visual hierarchy for tab order |

### Important (fix soon)
| Area | Finding | Recommendation |
|------|---------|----------------|
| Touch targets | Some icon-only buttons (share, print, close) are 48px; verify 44px minimum everywhere | Audit all buttons; ensure `min-w-[44px] min-h-[44px]` or equivalent |
| Video accessibility | Gallery video uses `onMouseOver`/`onMouseOut` only | Add `onFocus`/`onBlur` for keyboard users (jsx-a11y) |
| Input zoom | Input font size not explicitly set | Use `text-base` (16px) or `text-[16px]` on inputs to prevent iOS zoom on focus |
| Scroll behavior | `.custom-scrollbar` uses `-webkit-overflow-scrolling: touch` | Verify momentum scroll works on iOS; consider `overscroll-behavior` for pull-to-refresh |

### Enhancement (nice to have)
| Area | Finding | Recommendation |
|------|---------|----------------|
| Haptics | No Vibration API usage | Add haptic on Trivia correct/incorrect, nav tap, success toasts |
| Splash | No `apple-touch-startup-image` | Add startup images for iOS add-to-home-screen |
| Bottom nav | Primary nav is top-header scroll | Consider bottom nav bar for primary actions on mobile (Recipes, Gallery, Profile) |
| Skeleton | Recipe grid has skeleton; Gallery does not | Add skeleton for Gallery load |

## Implementation Checklist
- [ ] Add `env(safe-area-inset-bottom)` to main `pb-20` container
- [ ] Add `env(safe-area-inset-top)` to sticky header if needed
- [ ] Set `font-size: 16px` (or Tailwind `text-base`) on form inputs
- [ ] Add `onFocus`/`onBlur` to gallery video hover handlers
- [ ] Run touch-target audit (44px) on Header, RecipeModal, Contributors, Profile
- [ ] Add `apple-touch-startup-image` for iOS PWA
- [ ] Consider Vibration API on key success/error actions
