# Schafer Family Cookbook — Feature Roadmap

A strategic roadmap for the next phases of development, informed by the current codebase, mobile UX audit, and product goals.

---

## Current State Snapshot

### Existing Features
| Area | Capability | Status |
|------|------------|--------|
| **Recipes** | Browse, search, filter (category/contributor), sort (A–Z, recently viewed), grid/list | Solid |
| **Recipe Images** | Full local `public/recipe-images` coverage with recipe-specific WebP fallback assets and Imagen-ready generation tooling | Solid |
| **Recipe Modal** | View details, scale ingredients, print, share link, prev/next navigation | Solid |
| **Cook Mode** | Step-by-step view, ingredient scaling, keyboard + **swipe** navigation on mobile | Solid |
| **Favorites** | Heart recipes (local + cloud sync via `userPrefs` when Firebase configured) | Solid |
| **Collections** | User-created lists (`CollectionsView`, modal picker + Profile sections; cloud sync via `userPrefs`) | Solid |
| **Recently Viewed** | Track viewed recipes; **Profile** sections for favorites and recent | Solid |
| **Grocery List** | Add from recipe modal, list view, local persistence, **cloud sync via `userPrefs`** | Solid |
| **Meal Plan** | Weekly planner, add-from-modal/day picker, generate grocery list, optional `userPrefs` cloud sync | Solid |
| **Gallery** | Photos/videos, lightbox, **community upload + moderation queue (approve/decline)**, contributor filter, text-to-archive (Twilio MMS), **admin caption/date edit** | Solid |
| **Trivia** | 32-question quiz (+ Family Story links), local scoreboard + **Firestore family leaderboard** (`triviaScores`) | Solid |
| **Family Story** | Built-in narrative with TOC/print plus Firestore-backed Admin CMS override | Solid |
| **Contributors** | Directory, filter recipes by contributor, **View photos → Gallery filter** | Solid |
| **Profile** | Display name, avatar, my recipes, contribution log, favorites & recently viewed | Solid |
| **Admin** | Records, Gallery, Trivia, Directory, AI (Magic Import, Imagen), merge, bulk upload, **JSON/CSV export** | Solid |
| **Share / SEO (Vercel)** | `api/og` (1200×630 PNG), `api/share` HTML with OG + redirect when `VITE_SHARE_BASE` is set | Solid |
| **Mobile / IA** | Four-area navigation (**Browse**, **Cook**, **Family**, **Me**), bottom nav, safe areas, touch targets, PWA, haptics | Solid |
| **E2E** | Playwright on **dedicated preview port**; CI: unit job + emulators + Chromium E2E | Solid |

### Gaps & Opportunities
- Favorites / recent / ratings / meal-plan sync is **opt-in** via `userPrefs` in Firestore; not full “restore everywhere” for every guest
- Trivia has **both** a local run history and a **cloud** leaderboard; local scores remain for offline / comparison
- **Offline recipe text cache** — IndexedDB snapshot + **Offline badge** on cards (batch 7); not a full offline-first sync layer
- **Family Story CMS** — **publish vs draft** workflow for custodians (batch 7); preview + autosave draft already existed

---

## Immediate Next Steps (1–2 weeks)

### 1. Product (next sprint)
- [x] **Enable Firebase Storage** — enabled; rules deploy via `npm run deploy:firebase-rules`
- [x] **Firestore rules for family notes** — `notes` / `displayName` on `userPrefs` (deployed 2026-07-17)
- [ ] **Sentry on Vercel** — add `VITE_SENTRY_DSN` (+ optional source-map upload vars)
- [ ] **Firebase push vars (optional)** — `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FCM_VAPID_KEY`
- [ ] **App Check (optional)** — `VITE_FIREBASE_APP_CHECK_SITE_KEY` after registering reCAPTCHA v3 in Firebase Console
- [ ] **Lighthouse baseline** — `gh workflow run "Lighthouse CI"` or monthly schedule; headless Chrome configured
- [ ] **Live prod gallery walkthrough** — `npm run custodian:runbook` then family upload → approve on production
- [ ] **Credentials apply** — `npm run bootstrap:credentials` then `npm run finalize -- --apply --deploy`

### 2. Done (recent — June 2026 batch 11)
- [x] **Gallery decline** — custodian reject pending submissions
- [x] **Gallery contributor filter** — Gallery tab + Contributors “View photos”
- [x] **Admin pending badge** — Profile Open Admin Tools count
- [x] **Ops verify scripts** — `verify:storage`, `verify:ops`
- [x] **App Check bootstrap** — optional production reCAPTCHA v3

### 3. Done (June 2026 batch 10)
- [x] **Gallery moderation queue** — pending status, public filter, admin approve, Firestore rules

### 4. Done (June 2026 batch 9)
- [x] **Community gallery upload** — Gallery tab panel, Firebase append-only rules, offline queue highlight
- [x] **Upload guardrails** — rate limit, analytics, Sentry breadcrumbs, E2E + rules tests
- [x] **Button polish (partial)** — Admin form CTAs + Recipe modal action bar use shared `.btn` / `ViewActionBar`

### 3. Done (June 2026 batch 8)
- [x] **Unified button system** — `.btn`, `ViewActionBar`, `PageHeader` actions across major views

### 4. Done (June 2026 batch 7)
- [x] **Offline badge on recipe cards** — after IndexedDB cache
- [x] **Prefs sync status banners** — Profile when Firebase connected
- [x] **Story CMS publish workflow** — publish / revert to published
- [x] **Trivia expansion** — five Family Story questions; Firebase seed merge
- [x] **Help custodian checklist** — Sentry, env, Lighthouse, images, push

### 3. Done (June 2026 batch 6)
- [x] **Sentry test event** — Help → Troubleshooting (when DSN configured)
- [x] **Guest cloud sync notice** — Profile when Firebase not connected
- [x] **Offline cook banner** — Cook Mode saved-copy indicator
- [x] **Help** — Listen/TTS tips; troubleshooting section
- [x] **Lighthouse** — mobile + desktop CI presets
- [x] **Trivia** — two Family Story–linked questions

### 3. Done (June 2026 batch 5)
- [x] **UX consistency pass (continued)** — Gallery/Trivia/History/Recipes shells; Home shelf tabs; meal-plan sticky footer; recipe modal mobile collapse
- [x] **Discovery** — contributor filter hero; Home → Recipes search focus; desktop filter chips
- [x] **Offline cook cache** — IndexedDB recipe snapshot for deep links
- [x] **E2E** — collapsible UX smoke tests (`e2e/ux-collapsible.spec.ts`)

### 4. Done (June 2026 batch 4)
- [x] **Shared layout utilities** — `PageHeader`, `CollapsiblePanel`, `view-shell`
- [x] **Meal Plan / Grocery / Profile / Help / Privacy** — accordion & collapsible panels

### 5. Done (June 2026 batch 3)
- [x] **CI critical audit** — `npm audit fix` (vitest/vite/ws); pipeline unblocked
- [x] **Firebase client bootstrap** — `VITE_FIREBASE_*` in production builds seeds cloud sync automatically
- [x] **Grocery sync E2E** — `e2e/grocery-sync.spec.ts` against Firestore emulator
- [x] **Lighthouse artifacts** — filesystem upload to `.lighthouseci`
- [x] **Vercel env audit script** — `npm run verify:vercel-env`

### 6. Done (June 2026 batch 2)
- [x] **Grocery cloud sync** — `userPrefs.groceryList`, merge/de-dupe, Firestore rules + tests
- [x] **Collections → grocery** — add entire collection ingredients in one action
- [x] **Lighthouse schedule** — monthly workflow trigger on production URL
- [x] **Home dashboard & six-tab nav** — `HomeView`, `SectionSubNav`, bottom nav groups, E2E in `e2e/home.spec.ts` and `e2e/navigation.spec.ts`
- [x] **Meal Plan polish** — copy week/day, fuzzy picker search, grocery de-dupe toasts
- [x] **Family Story CMS polish** — preview, autosave draft, section templates
- [x] **A11y polish** — A–Z sticky headers, gallery video lightbox, Profile save announcements, Home breadcrumb in recipe modal
- [x] **Grocery share** — copy/share list from Grocery List view
- [x] **Fuzzy search** — browse search with typo tolerance (`fuzzyMatch`)
- [x] **Collections cloud sync** — `userPrefs` payload, Firestore rules, debounced sync via `useUserPrefsSync` (late May 2026)
- [x] **Featured recipes** — admin curation + hero strip (late May 2026)
- [x] **Meal Plan MVP + cloud sync** — week view, grocery-list generation, modal day picker, optional `userPrefs.mealPlan` sync (June 2026)
- [x] **Ingredient search** — browse search matches ingredient text
- [x] **Family Story CMS** — Admin sections render on the public Family Story view with static fallback
- [x] **Vercel API recipe seed** — generated module + `postinstall` sync + smoke `/api/ping` (late May 2026)
- [x] **Playwright** — Preview bound to a dedicated port; document `npm run ci` vs E2E in README
- [x] **Firebase index** for `triviaScores` — deploy with `firebase deploy --only firestore:indexes` when project updates
- [x] **Admin export** — JSON/CSV recipe export from Admin → Records

---

## Short-Term Roadmap (Sprint 1–2: 1–2 months)

| Feature | Description | Effort | Notes |
|---------|-------------|--------|--------|
| **Recipe share card (discoverability)** | Production builds default `VITE_SHARE_BASE` via `.env.production`; `/api/og` + `/api/share` unchanged | S | Override in Vercel env if the canonical domain changes |
| **Collections cloud sync** | Extend `userPrefs` to mirror custom lists across devices | M | **Shipped** (late May 2026) |
| **Cook Mode polish** | Read-aloud via Web Speech API (Listen / Stop); clears when changing steps | M | Tap-to-play only — no autoplay |
| **”Send to family”** | SMS + mailto invites with heirloom copy (`ShareRecipe`) | S | Uses OG-rich share URL when base is set |

---

## Medium-Term Roadmap (Quarter 1–2)

### Collections & Planning
| Feature | Description | Effort | Notes |
|---------|-------------|--------|-------|
| **Collections** | User-created lists; add/remove recipes | M | **Shipped** |
| **Meal Plan** | Simple week view with optional cloud sync | L | **Shipped** (June 2026) |
| **Grocery (enhanced)** | Merge from multiple recipes; optional stronger cloud sync | M | **Cloud sync shipped**; collection bulk-add shipped |

### Content & Discovery
| Feature | Description | Effort | Notes |
|---------|-------------|--------|-------|
| **Family Story CMS** | Firestore-backed sections editable in Admin and rendered publicly | L | **Shipped** (June 2026) |
| **Featured recipes** | Admin-curated on Recipes tab | S | **Shipped** (late May 2026) |
| **Search** | By ingredient, fuzzy | M | Ingredient search shipped; fuzzy search still open |

---

## Long-Term / Strategic

### Multi-tenant
- Deeper `siteConfig` for forks; path-based “sites”

### Authentication
- Optional email/OAuth for contributors wanting stronger identity

### AI
- Cook Mode TTS, substitutions, OCR of handwritten cards

### Gamification
- Trivia streaks, contribution badges, milestones

---

## Prioritization Matrix

| Priority | Criteria | Top candidates |
|----------|----------|----------------|
| **P0** | Release safety | CI green, E2E on PRs, critical Firestore indexes deployed |
| **P1** | User value | Meal plan polish, Story CMS polish, offline Cook Mode cache |
| **P2** | Polish | A–Z on mobile nav, “send to family” template, analytics review |
| **P3** | Backlog | Offline recipe cache, OAuth |

---

## Recommended Sequencing

1. **Done (baseline)** — Mobile polish (haptics, vibration, Cook swipe), Grocery, Profile sections, family trivia leaderboard + rules, Vercel OG/share, admin export + gallery edit, E2E port isolation, **Vercel API recipe seed bundling** (late May 2026 — see `RUNBOOK.md`)
2. **Just shipped (multi-agent run, late May 2026)** — **Featured recipes**, **FCM SW build config**, **Profile favorites/recent**, **collections UI** (Profile + modal picker), **collections cloud sync**, **a11y batch**, **E2E fixes**, **mobile vibration**. See `ENHANCEMENTS.md` and `FEATURE-PLAN-NEXT-2-WEEKS.md`.
3. **Just shipped (June 2026)** — **Meal Plan cloud sync**, **Family Story CMS rendering**, stale roadmap cleanup.
4. **Next (2 weeks)** — **Lighthouse baseline**, production monitoring, content/image verification.
5. **Next quarter** — optional stronger identity if cross-device personalization needs grow; gamification backlog.

---

## Success Metrics to Track

- **Engagement:** Recipes per session, Cook Mode usage, trivia completions
- **Contribution:** New recipes, gallery uploads, trivia questions
- **Retention:** Return visitors, PWA installs
- **Technical:** E2E pass rate, Core Web Vitals, PWA audit

---

*Last updated: 26 June 2026*
