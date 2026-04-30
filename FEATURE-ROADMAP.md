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
| **Favorites** | Heart recipes (local + optional cloud sync via `userPrefs`) | Solid |
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
- No **meal planning** or **user collections** (beyond roadmap ideas)
- No **explicit offline recipe cache** for Cook Mode (PWA network caching only)
- **Family Story** is static in-repo (not CMS-editable in Admin)

---

## Immediate Next Steps (1–2 weeks)

### 1. Automation confidence
- [x] **Playwright** — Preview bound to a dedicated port in `playwright.config.ts`; document `npm run ci` vs E2E in README
- [x] **Firebase index** for `triviaScores` (score ↓, completedAt ↑) in `firebase/firestore.indexes.json` — deploy with `firebase deploy --only firestore:indexes` when project updates

### 2. Housekeeping
- [x] **Roadmap** — This file aligned to shipped features (grocery, profile, swipe, cloud trivia, share API, admin export)
- [x] **IA reset** — Bottom nav simplified to Browse/Cook/Family/Me; A–Z lives under Browse and More sections

### 3. Technical debt
- [x] **Admin export** — JSON/CSV recipe export available from Admin → Records (`Export JSON` / `Export CSV`)

---

## Short-Term Roadmap (Sprint 1–2: 1–2 months)

| Feature | Description | Effort | Notes |
|---------|-------------|--------|--------|
| **Recipe share card (discoverability)** | Ensure `VITE_SHARE_BASE` and `/api/og` + `/api/share` are set in production | S | Implementation exists on Vercel |
| **Collections** | User-created recipe lists | M | |
| **Cook Mode polish** | e.g. voice read-aloud (PRD) | M | |
| **”Send to family”** | Pre-filled message template with share URL | S | |

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
| **Featured recipes** | Admin-curated on Recipes tab | S |
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

1. **Done (baseline)** — Mobile polish (haptics, vibration, Cook swipe), Grocery, Profile sections, family trivia leaderboard + rules, Vercel OG/share, admin export + gallery edit, E2E port isolation
2. **Next** — **Collections** or **Meal plan** (pick one focus), then featured recipes
3. **Next quarter** — Family Story CMS, search-by-ingredient, cross-device story for non-custodian users if you add real auth

---

## Success Metrics to Track

- **Engagement:** Recipes per session, Cook Mode usage, trivia completions
- **Contribution:** New recipes, gallery uploads, trivia questions
- **Retention:** Return visitors, PWA installs
- **Technical:** E2E pass rate, Core Web Vitals, PWA audit

---

*Last updated: April 2026*
