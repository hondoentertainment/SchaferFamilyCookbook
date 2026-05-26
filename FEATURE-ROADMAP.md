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
| **Grocery List** | Add from recipe modal, list view, local persistence | Solid |
| **Gallery** | Photos/videos, lightbox, text-to-archive (Twilio MMS), **admin caption/date edit** | Solid |
| **Trivia** | 25-question quiz, local scoreboard + **Firestore family leaderboard** (`triviaScores`) | Solid |
| **Family Story** | Static narrative with TOC, print | Solid |
| **Contributors** | Directory, filter recipes by contributor | Solid |
| **Profile** | Display name, avatar, my recipes, contribution log, favorites & recently viewed | Solid |
| **Admin** | Records, Gallery, Trivia, Directory, AI (Magic Import, Imagen), merge, bulk upload, **JSON/CSV export** | Solid |
| **Share / SEO (Vercel)** | `api/og` (1200×630 PNG), `api/share` HTML with OG + redirect when `VITE_SHARE_BASE` is set | Solid |
| **Mobile / IA** | Four-area navigation (**Browse**, **Cook**, **Family**, **Me**), bottom nav, safe areas, touch targets, PWA, haptics | Solid |
| **E2E** | Playwright on **dedicated preview port**; CI: unit job + emulators + Chromium E2E | Solid |

### Gaps & Opportunities
- Favorites / recent / ratings sync is **opt-in** via `userPrefs` in Firestore; not full “restore everywhere” for every guest
- Trivia has **both** a local run history and a **cloud** leaderboard; local scores remain for offline / comparison
- **Collections cloud sync** — shipped via `userPrefs` (`userPrefsSync`, Firestore rules); same opt-in model as favorites/ratings when Firebase is configured
- No **meal planning** yet
- No **explicit offline recipe cache** for Cook Mode (PWA network caching only)
- **Family Story** is static in-repo (not CMS-editable in Admin)

---

## Immediate Next Steps (1–2 weeks)

### 1. Product (next sprint)
- [ ] **Meal plan MVP** — simple week view, local persistence, add-from-modal
- [ ] **Ingredient search** — match against `ingredients[]` in browse search
- [ ] **Featured recipes polish** — strip ordering, empty state, admin E2E coverage
- [ ] **Lighthouse baseline** — run `npm run lighthouse:ci` on production; track scores in CI artifacts

### 2. Done (recent)
- [x] **Mobile vibration / haptics**, **E2E stabilization**, **Profile favorites & recent**, **collections in Profile**, **recipe modal collection picker**, **a11y batch**
- [x] **Collections cloud sync** — `userPrefs` payload, Firestore rules, debounced sync via `useUserPrefsSync` (late May 2026)
- [x] **Featured recipes** — admin curation + hero strip (late May 2026)
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
| Feature | Description | Effort |
|---------|-------------|--------|
| **Collections** | User-created lists; add/remove recipes | M |
| **Meal Plan** | Simple week view | L |
| **Grocery (enhanced)** | Merge from multiple recipes; optional stronger cloud sync | M |

### Content & Discovery
| Feature | Description | Effort |
|---------|-------------|--------|
| **Family Story CMS** | Firestore-backed sections editable in Admin | L |
| **Featured recipes** | Admin-curated on Recipes tab | S | **Shipped** (late May 2026) |
| **Search** | By ingredient, fuzzy | M |

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
| **P1** | User value | Collections, meal plan, featured recipes, Story CMS |
| **P2** | Polish | A–Z on mobile nav, “send to family” template, analytics review |
| **P3** | Backlog | Offline recipe cache, OAuth |

---

## Recommended Sequencing

1. **Done (baseline)** — Mobile polish (haptics, vibration, Cook swipe), Grocery, Profile sections, family trivia leaderboard + rules, Vercel OG/share, admin export + gallery edit, E2E port isolation, **Vercel API recipe seed bundling** (late May 2026 — see `RUNBOOK.md`)
2. **Just shipped (multi-agent run, late May 2026)** — **Featured recipes**, **FCM SW build config**, **Profile favorites/recent**, **collections UI** (Profile + modal picker), **collections cloud sync**, **a11y batch**, **E2E fixes**, **mobile vibration**. See `ENHANCEMENTS.md` and `FEATURE-PLAN-NEXT-2-WEEKS.md`.
3. **Next (2 weeks)** — **Meal plan MVP**, **ingredient search**, **featured strip polish**, **Lighthouse baseline**
4. **Next quarter** — **Family Story CMS** or stronger cross-device prefs; offline recipe cache for Cook Mode

---

## Success Metrics to Track

- **Engagement:** Recipes per session, Cook Mode usage, trivia completions
- **Contribution:** New recipes, gallery uploads, trivia questions
- **Retention:** Return visitors, PWA installs
- **Technical:** E2E pass rate, Core Web Vitals, PWA audit

---

*Last updated: 25 May 2026*
