# Navigation, Home and Today (Phase 3)

## 1. Sidebar: from five labelled groups to a day-first order

**Before:** Plan (Home, Today, All Tasks, Inbox, Calendar), Build (Projects, Goals), Track (Habits, Focus, Reviews, Analytics), Sections, Personal (People, Notes, Journal, Vault), then Settings and Trash.
- That is 19 rows and 5 labels.
- It scrolled at 900 px tall.
- Home sat above Today, although the app opens on Today.

**After** (`src/app/nav.ts` → `NAV_GROUPS`):

| Group | Screens | Why |
|---|---|---|
| (unlabelled, top) "Your day" | **Today**, Home, Inbox (count), All Tasks, Calendar | The app opens on Today, so it comes first. Inbox is next because it needs sorting daily. "Your day" is the label only on the phone's More page. |
| Plan and track | Projects, Goals, Habits, Focus | The four things you build and keep up. "Build" and "Track" were split across two labels for six screens. |
| Sections | Your own tree (unchanged), with a square chip in the area colour | The chip ties each area to its colour everywhere else in the app (map heads, rows) |
| Notes and people | Notes, Journal, People | Writing and the people you write about |
| **Review and private** (folds) | Reviews, Analytics, Vault | Weekly or occasional screens. Folded by default and remembered, so the open/closed choice persists. |
| Footer | Settings (holds Backup, Sync, App lock), Trash | Unchanged |

**Rules that keep it honest:**
- **Nothing is removed.** Every screen is still one click away: open the folded group, use the tablet icon rail (which always shows everything), the phone's More page (which always shows everything), or ⌘K.
- **A folded group still shows the screen you're on**, so the sidebar never hides where you are.
- **Visible rows:** 16 instead of 19, with 3 labels instead of 5. The sidebar no longer scrolls at 1440×900 with the default sections.
- **Why these three are folded:**
  - Reviews is weekly, and the Today page already nudges you when a review is due (`ReviewNudge`).
  - Analytics is occasional.
  - The Vault is private: keeping it out of sight is a small privacy gain on a shared screen.

**Look:**
- The sidebar sits on the ink-blue shell (`--shell`).
- The current screen is a lit row (`shell-2`) in bold white. There is no side bar on the row (craft floor rule).
- Focus rings on the shell use `shell-fg`, so they stay visible on the dark ground.
- Section rows show a 8px square in the area colour at the top level, and muted icons for subsections.

## 2. Phone

- The tab bar is unchanged (your decision): Home · Today · ＋ · Tasks · More.
- It now sits on the same ink-blue shell. The active tab is white and the others are `shell-muted`. ＋ is a light square key.
- More lists every screen in the same four groups, all open.
- Search stays in the Home header and at the top of More.

## 3. Home and Today: two jobs, no duplicates

| | Today (`/`, opens first) | Home (`/home`) |
|---|---|---|
| Job | **Do the day** | **See where you stand** |
| Top | Greeting over its rule, the day's summary ("4 tasks for today and 1 overdue"), and **one read-only habits line** ("Habits: 1 of 3 done today", which links to Habits) | Date and title; the **check-in** (sleep, mood, energy, water, weight) |
| Then | **Schedule:** events and timed tasks on a time axis (the Timetable's signature) | **Next up:** the next timed event with "in 1 h 50 m", plus a line of tasks due and overdue that links to Today |
| Then | **Today:** quick add, the overdue bar, the task list | **Your sections this week:** a ruled map with one column per area. Each head shows open tasks and tasks done this week, with a rule in the area colour; sections and subsections are listed with their open counts. It can be hidden (remembered) |
| Then | Coming up (7 days), Active projects; setup, review and backup nudges | — |
| Habits | One read-only line (see decisions log #2) | None (your decision) |

**Decisions made here** (also in `DECISIONS_LOG.md`):
- The time axis lives on **Today**, not on Home as the prototype showed, because Phase 3 asks that Home and Today not duplicate each other and the schedule is execution. Home keeps "Next up" as the glance.
- Home's map gained "done this week" per area. This is the one new number: it answers "how am I doing across my life this week" without becoming a metrics wall.
- Customize Today still works. The "Today's events" widget is now called **Schedule** and shows the time axis.

**The schedule strip** (`src/features/dashboard/DayStrip.tsx`):
- **Tablet and up:** a 08:00–21:00 axis that stretches to fit earlier or later items, with a vermilion now-line.
  - Items of 75 minutes or longer are blocks.
  - Shorter items are a tick with their label beside it, so labels never overflow their block.
  - Overlapping items drop into lanes (tested in `DayStrip.test.ts`).
- **Phone:** the same periods as a ruled list (time, area rule, title, "until 13:00, H-105"), with "Now" on the current one.
- **Interaction:** a timed task opens the task editor, an event opens the Calendar. Each item has a full accessible name ("11:30–13:00, SMAI lecture, H-105").

## 4. Interaction quality

- **Page headers:** every screen title sits over a 2px ink rule (`PageHeader`); Today's greeting matches. Block heads (`BlockHeader`) carry their action on the right ("Open Today", "Calendar", "Hide").
- **Search and quick actions:** unchanged and verified:
  - N for a new task
  - ⌘K / Ctrl K for the palette
  - the sidebar search button
  - phone search on Home and More
  - the ＋ key
- **Transitions:** no page transitions were added. Navigation is instant (Operate mode: users don't wait for choreography). Sheets, menus and checks keep their action-driven motion.

## 5. Remaining usability problems (for Phases 4–5)

1. **Check-in controls** use round pill chips and bare number boxes. They predate the system and should become `Segmented` controls with the register look. (Phase 4B, Health.)
2. **The overdue bar's** "Today / Tomorrow / Pick a date" wraps to two lines on phones. (Phase 4A.)
3. **Task rows** still use the old circle checks and a two-line meta. The single row anatomy (period column, area chip) comes with the Tasks redesign. (Phase 4A.)
4. **On a fresh install, the setup checklist** still comes before the tasks on Today. This is deliberate for day one, but long on phones. (Phase 5.)
5. **The section map on phones** is two columns. Sections with long names truncate ("Learning & Ski…"). (Phase 5.)
6. **Sidebar section rows** don't show open counts (Home does). Adding counts was left out to avoid noise. Revisit if you miss them.
