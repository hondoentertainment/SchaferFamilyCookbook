# Schafer Family Cookbook — Feature Roadmap

A strategic roadmap for the next phases of development, informed by the current codebase, mobile UX audit, and product goals.

---

## Current State Snapshot

### Existing Features
| Area | Capability | Status |
|------|------------|--------|
| **Recipes** | Browse, search, filter (category/contributor), sort (A–Z, recently viewed), grid/list | ✅ Solid |
| **Recipe Modal** | View details, scale ingredients, print, share link, prev/next navigation | ✅ Solid |
| **Cook Mode** | Step-by-step view, ingredient scaling, keyboard navigation | ✅ New |
| **Favorites** | Heart recipes (localStorage) | ✅ New |
| **Recently Viewed** | Track viewed recipes, sort by recency (localStorage) | ✅ New |
| **Gallery** | Photos/videos, lightbox, text-to-archive (Twilio MMS) | ✅ Solid |
| **Trivia** | 25-question quiz, scoreboard (localStorage), admin CRUD | ✅ Solid |
| **Family Story** | Static narrative with TOC, print | ✅ Solid |
| **Contributors** | Directory, filter recipes by contributor | ✅ Solid |
| **Profile** | Display name, avatar picker, my recipes, contribution log | ✅ Solid |
| **Admin** | Records, Gallery, Trivia, Directory, AI (Magic Import, Imagen), merge, bulk upload | ✅ Solid |
| **Mobile** | Bottom nav, safe areas, touch targets, PWA, startup image | ✅ Mostly complete |

### Gaps & Opportunities
- Favorites and recently viewed are **local-only** (no cloud sync / cross-device)
- Trivia scoreboard is **local-only** (no shared family leaderboard)
- No meal planning, grocery list, or collections
- Profile doesn’t surface favorites or recently viewed
- No explicit offline-first UX (beyond PWA caching)
- No Vibration API usage (audit item)
- Family Story is static (not CMS-editable)

---

## Immediate Next Steps (1–2 weeks)

### 1. Finish Mobile UX Polish
- [ ] **Vibration API** – Add light haptic feedback on Trivia correct/incorrect, nav taps, save success (per `AUDIT-MOBILE-UX.md`)
- [ ] **Fix failing E2E tests** – Several Playwright tests show as modified/failing; stabilize before next release

### 2. Quick Wins
- [ ] **Profile integration** – Add "Favorites" and "Recently Viewed" sections to Profile so users see their own activity
- [ ] **Index tab on BottomNav** – Consider whether Index deserves a spot in mobile bottom nav (currently only Recipes, Index, Gallery, Trivia, Profile, Admin)
- [ ] **Recipe deep-link sharing** – Improve share copy (e.g., "Open in Schafer Cookbook: [recipe name]")

### 3. Technical Debt
- [ ] **CI reliability** – Ensure `npm run ci` passes consistently; consider excluding or fixing flaky Playwright tests
- [ ] **Git clean-up** – Decide whether `playwright-report/` and `test-results/` belong in `.gitignore`

---

## Short-Term Roadmap (Sprint 1–2: 1–2 months)

### Phase 1: Discovery & Engagement
| Feature | Description | Effort |
|---------|-------------|--------|
| **Favorites in Profile** | Show user's favorited recipes on Profile; quick access to "My Favorites" | S |
| **Recently Viewed in Profile** | Show recently viewed recipes on Profile with "Clear" option | S |
| **Grocery List** | "Add to Grocery List" from Recipe modal; persist in localStorage; simple list view | M |
| **Cook Mode improvements** | Swipe gestures (left/right) for step navigation on mobile | S |

### Phase 2: Social & Sharing
| Feature | Description | Effort |
|---------|-------------|--------|
| **Trivia Leaderboard (cloud)** | Persist trivia scores to Firestore; show family-wide top scores | M |
| **Recipe share card** | Generate an OG-style image for sharing (e.g., title + contributor + site branding) | M |
| **“Send to family” flow** | Copy link + optional pre-filled SMS/email template | S |

### Phase 3: Admin & Content
| Feature | Description | Effort |
|---------|-------------|--------|
| **Bulk export** | Export recipes (JSON/CSV) for backup or migration | S |
| **Gallery date/caption editing** | Allow admins to edit caption and date on existing gallery items | S |
| **Family Story CMS** | Make Family Story sections editable via Admin (Firestore-backed) | L |

---

## Medium-Term Roadmap (Quarter 1–2)

### Collections & Planning
| Feature | Description | Effort |
|---------|-------------|--------|
| **Collections** | User-created lists (e.g., "Holiday Favorites", "Grandma's Best"); add/remove recipes | M |
| **Meal Plan** | Assign recipes to days; simple week view; "Plan this week" from favorites | L |
| **Grocery list (enhanced)** | Merge from multiple recipes; check off items; optional cloud sync | M |

### Cloud Sync for Personal Data
| Feature | Description | Effort |
|---------|-------------|--------|
| **Favorites sync** | Store favorites in Firestore per user; sync across devices | M |
| **Recently viewed sync** | Same as above | S |
| **Grocery list sync** | Optional cloud backup for grocery list | M |

### Offline & PWA
| Feature | Description | Effort |
|---------|-------------|--------|
| **Offline recipe view** | Cache selected recipes for offline Cook Mode | M |
| **Install prompt** | Show "Add to Home Screen" prompt after key actions (e.g., first recipe view) | S |
| **Background sync** | Queue gallery uploads when offline; sync when back online | M |

### Content & Discovery
| Feature | Description | Effort |
|---------|-------------|--------|
| **Recipe suggestions** | "You might also like" based on category/contributor | S |
| **Featured recipes** | Admin-curated "Featured" section on Recipes tab | S |
| **Search enhancements** | Search by ingredient; fuzzy search | M |

---

## Long-Term / Strategic

### Multi-Tenant & White-Label
- Use `siteConfig` more fully for rebranding
- Document how to fork and customize for other families
- Optional: subdomain or path-based “sites” (e.g., `/schafer`, `/smith`)

### Authentication Evolution
- Optional email/password for contributors who want cross-device sync
- Keep name-based "guest" mode for quick family access
- OAuth (Google) for easier onboarding

### AI & Automation
- **Voice read-aloud** for Cook Mode instructions
- **Ingredient substitution suggestions** (e.g., "No buttermilk? Use milk + lemon")
- **Recipe parsing from photo** – OCR a handwritten recipe, AI structures it

### Gamification & Engagement
- **Trivia streaks** – Reward consistent quiz attempts
- **Contribution badges** – "First recipe", "10 recipes", "Gallery curator"
- **Family milestones** – "100 recipes archived" celebration

---

## Prioritization Matrix

| Priority | Criteria | Top candidates |
|----------|----------|----------------|
| **P0 (Ship soon)** | Blocks release, user-facing bugs | E2E fixes, Vibration API |
| **P1 (High value)** | High impact, moderate effort | Favorites/Recently Viewed in Profile, Trivia cloud leaderboard, Grocery list |
| **P2 (Nice to have)** | Improves polish | Cook Mode swipe, share card, bulk export |
| **P3 (Backlog)** | Strategic, larger scope | Collections, Meal Plan, Family Story CMS, Offline recipe cache |

---

## Recommended Sequencing

1. **Week 1–2** – Ship mobile polish (Vibration), fix E2E, add Favorites/Recently Viewed to Profile
2. **Month 1** – Grocery list (localStorage), Cook Mode swipe, Trivia cloud leaderboard
3. **Month 2** – Recipe share card, bulk export, Gallery caption edit
4. **Quarter 2** – Collections, Favorites cloud sync, offline recipe cache

---

## Success Metrics to Track

- **Engagement**: Recipes viewed per session, Cook Mode usage, Trivia completions
- **Contribution**: New recipes, gallery uploads, trivia questions added
- **Retention**: Return visitors, PWA installs
- **Technical**: E2E pass rate, Core Web Vitals, PWA audit score

---

*Last updated: Feb 2025*
