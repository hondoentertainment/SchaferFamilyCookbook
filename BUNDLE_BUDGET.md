# Bundle budget

Snapshot from `npm run build` after lazy-loading AdminView (chore: prod hardening pass).

## Targets

| Asset | Target (gzip) | Hard ceiling |
| --- | --- | --- |
| Main `index` chunk | <= 300 KB gz / 1.0 MB raw | 350 KB gz |
| `vendor-firebase` | <= 100 KB gz | 120 KB gz |
| `vendor-react` | <= 50 KB gz | 60 KB gz |
| Any single lazy view | <= 25 KB gz | 40 KB gz |
| Critical CSS | <= 25 KB gz | 30 KB gz |

The 300 KB gz target for the main chunk follows the [web.dev "interactive within 5s on a slow 3G phone"](https://web.dev/articles/fast) guidance.

## Current sizes (raw / gz)

```
index-Bey0YIib.js               434.42 KB / 118.42 KB    main app chunk
vendor-firebase.js              381.25 KB /  94.91 KB    firebase/app + firestore + storage
vendor-react.js                  11.79 KB /   4.21 KB    react + react-dom
index.css                        88.96 KB /  14.29 KB    tailwind atoms

ProfileView.js                   30.10 KB /   7.31 KB    lazy
AdminView.js                     48.51 KB /  11.99 KB    lazy (NEW: split out of ProfileView)
RecipeModal.js                   27.66 KB /   7.72 KB    lazy
TriviaView.js                    16.42 KB /   4.73 KB    lazy
HistoryView.js                   12.50 KB /   4.81 KB    lazy
AddRecipeModal.js                12.27 KB /   3.81 KB    lazy
ContributorsView.js               7.33 KB /   2.55 KB    lazy
AlphabeticalIndex.js              5.88 KB /   2.10 KB    lazy
CookModeView.js                   5.09 KB /   2.03 KB    lazy
ContributorSpotlight.js           3.58 KB /   1.30 KB    lazy
PrivacyView.js                    2.77 KB /   1.22 KB    lazy
OnboardingWalkthrough.js          2.59 KB /   1.28 KB    lazy
```

Status: **within budget** (118 KB gz main vs 300 KB gz target).

## Wins applied this pass

- `AdminView` (~48 KB raw / 12 KB gz) made lazy inside `ProfileView`. It only renders for admin users, but was previously bundled into the ProfileView chunk for everyone. Saves 47.7 KB raw / 10.65 KB gz for non-admin visitors loading the Profile tab.

## Known offenders / follow-ups

- `vendor-firebase` 95 KB gz. Driven by `firebase/firestore` + `firebase/storage`. Modular SDK is already used; consider:
  - Loading `firebase/storage` only when an upload is triggered (most read traffic doesn't need it).
  - Switching read paths to the Firestore Lite SDK where realtime subscriptions are not required.
- `index.css` 14 KB gz is OK for Tailwind v4; verify content scanning is tight (`tailwind.config` includes only `src/**/*`).
- No icon library is bundled (the app uses inline SVG and emoji), so no tree-shaking work needed there.
- No `firebase-admin` import has leaked into the client bundle (verified — that package is server-only via `api/`).

## How to re-check

```sh
npm run build
# look for any chunk > 200 KB raw and confirm it's vendor or intentionally large.
```
