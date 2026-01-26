<instruction>You are an expert software engineer. You are working on a WIP branch. Please run `git status` and `git diff` to understand the changes and the current state of the code. Analyze the workspace context and complete the mission brief.</instruction>
<workspace_context>
<artifacts>
--- CURRENT TASK CHECKLIST ---
# Dashboard Enhancements Implementation

## Tasks

### Live Games Feed
- [x] Research sports APIs and existing project structure
- [x] Create implementation plan
- [x] Create sports API utility (`lib/sports-api.ts`)
- [x] Create LiveGamesFeed component (`components/dashboard/live-games-feed.tsx`)
- [x] Integrate into dashboard page

### Win/Loss Spark Trend
- [x] Create SparkTrend component for mini line graphs
- [x] Add to dashboard below stats cards

### Verification
- [x] Build passes successfully
- [ ] Deploy to production

### UX/UI Polish
- [x] Enhance Hero Section (Dynamic background, floating icons)
- [x] Enhance Interactive Calendar (Popover details, improved styling)
- [x] Add Global Animations (`globals.css`)

--- IMPLEMENTATION PLAN ---
# Live Games Feed - Implementation Plan

## Overview

Add a **Live Games Feed** widget to the Deep Seats dashboard showing today's and upcoming games for the user's favorite teams, with live scores updated in real-time.

## Technical Approach

### API Selection: ESPN Hidden API (Free, No Key Required)

ESPN provides unofficial JSON endpoints that are free to use and require no API key:

| League | Endpoint |
|--------|----------|
| NBA | `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard` |
| NFL | `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` |
| MLB | `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard` |
| NHL | `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard` |

**Benefits:**
- ✅ No API key required
- ✅ Real-time scores
- ✅ Team logos included
- ✅ Game status (scheduled, in-progress, final)
- ✅ Covers all 4 major leagues in Deep Seats

---

## Proposed Changes

### API Layer

#### [NEW] [sports-api.ts](file:///c:/Users/kyle/v0-games-library/lib/sports-api.ts)

Utility functions to fetch live game data from ESPN:
- `fetchLiveGames(leagues: string[])` - Fetches scoreboard data for specified leagues
- `LiveGame` interface with typed game data
- Team name matching to user's favorite teams

---

### Dashboard Components

#### [NEW] [live-games-feed.tsx](file:///c:/Users/kyle/v0-games-library/components/dashboard/live-games-feed.tsx)

Client component for the live games widget:
- Shows games for user's favorite teams
- Auto-refreshes every 60 seconds during live games
- Status indicators: 🔴 LIVE, ⏳ Starting Soon, ✅ Final
- Quick "Log Game" action button
- League color coding (NBA orange, NFL green, MLB blue, NHL slate)
- Empty state when no games today

---

### Dashboard Integration

#### [MODIFY] [page.tsx](file:///c:/Users/kyle/v0-games-library/app/(protected)/dashboard/page.tsx)

- Fetch user's favorite teams from profile
- Add `<LiveGamesFeed>` component above the calendar
- Pass favorite teams to filter relevant games

---

## UI Design

```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 Today's Games                              Auto-refresh │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🏀 NBA                                        🔴 LIVE   │ │
│ │ Lakers  102                                             │ │
│ │ Celtics 98           Q4 2:34                 [Log Game] │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🏈 NFL                                     7:00 PM PST  │ │
│ │ Seahawks @ 49ers                             [Log Game] │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⚾ MLB                                        ✅ Final   │ │
│ │ Mariners 5                                              │ │
│ │ Yankees  3                                   [Log Game] │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Verification Plan

### Manual Verification
1. Run dev server and view dashboard
2. Verify games display for favorite teams
3. Test live score updates (if games in progress)
4. Test "Log Game" button navigation
5. Verify empty state when no games today
6. Test mobile responsiveness

### Build Verification
- Run `npm run build` to ensure no TypeScript errors
</artifacts>
</workspace_context>
<mission_brief>[Describe your task here...]</mission_brief>