# Redesign preparation: findings and next steps

This summarises the discovery audit of 19 Nov 2026 (commit `c056ee6`). It is for reviewing together before choosing features or starting the UI redesign. Nothing in the app was changed.

| Document                      | What's in it                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRODUCT_OVERVIEW.md`         | Purpose, users, the full map of sections, pages, sheets and menus, desktop vs phone navigation                                                       |
| `SECTION_FUNCTIONAL_AUDIT.md` | Every section: features, workflows, data, dependencies, limits, each marked Fully / Partially / Non-functional / Not present, with file references   |
| `FEATURE_GAP_ANALYSIS.md`     | About 60 section-specific recommendations (problem, how it works, dependencies, default on/off, data needed, priority, effort), plus a ranked top 15 |
| `TECHNICAL_ARCHITECTURE.md`   | Stack, folders, routing, state, schema v11 and relations, write path, sync, tokens, themes, PWA, responsiveness, tests                               |
| `UI_SCREEN_INVENTORY.md`      | 90 desktop and 88 phone screenshots in `screenshots/`, plus the screens to capture by hand                                                           |

---

## 1. The application in one paragraph

Personal OS is an offline-first PWA that runs entirely on the device (IndexedDB), with optional sync once a Supabase project is set up.

- **Structure:** your life is a tree of sections (Work, Self-Improvement, Personal Life, Miscellaneous), seeded from a profile (researcher, student, professional, exam aspirant, freelancer).
- **Section tools:** each section has the tools that suit it:
  - Notion-style task outlines everywhere.
  - Papers with DOI/arXiv import, course assessments with grades, meetings with carried-over action items, a thesis writing log.
  - A Gym module with weekly routines linked to a habit; Health with a daily plan and timestamped logs.
  - Lists for movies, places, trips, occasions, shopping and expenses.
- **Around them:** Home (section map and check-in), Today (work and habits), All Tasks, Inbox, Projects, Goals, Habits, Calendar, Focus, Reviews, Analytics, Notes, Journal (with encrypted private entries), an encrypted Vault, an App Lock, reminders, backups, .ics export and a search palette.

## 2. Strengths

- **Honest data model:** skipped and missed are never counted as done, schedule history keeps the past stable, and every change is logged with Undo and a 30-day Trash.
- **Truly offline:** with no account or server, everything works, including reminders while the app is open, encryption and search.
- **Section-aware tools** instead of one generic task list everywhere, plus Notion-style outlines, plain-language quick add ("fri 5pm !high #tag"), and AoE deadlines for conferences.
- **Real integrations already built:**
  - Gym ↔ Habits ↔ Goals ↔ reminders.
  - Meetings → tasks.
  - Lists → Calendar and Coming up.
  - Health plan → reminders.
- **Phone and desktop from one codebase**, with phone-specific touches: swipe, bottom bar, 44 px targets, sheets.
- **Well tested:** 171 unit tests and 142 end-to-end tests, run on both phone and desktop.

## 3. Correctness and safety issues to fix before the redesign

These are bugs or data risks, not feature ideas. Most were found by reading code, so each fix should start with a test that reproduces it.

| #   | Issue                                                                                                                                                                                            | Area           | Source       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ------------ |
| R1  | Records imported from a backup **after** the first sync are never uploaded (imports bypass the upload queue; only the first sign-in uploads everything). Confirmed in `src/core/sync/engine.ts`. | Sync / Backup  | Audit part 2 |
| R2  | Making a journal entry private doesn't remove its earlier **plain-text copy** from the server, if it had already synced.                                                                         | Journal / Sync | Audit part 2 |
| R3  | Setting up the Vault on **two devices** before syncing can leave items unreadable on one of them. Needs a "Vault already exists on your account" check.                                          | Vault / Sync   | Audit part 2 |
| R4  | Deleting the active routine, or switching to a non-weekday routine, leaves the **Gym habit's days and reminders** as they were.                                                                  | Gym            | Audit part 2 |
| R5  | The workout check-in also marks any habit whose title contains "gym", "workout" or "exercise". It should use only the linked habit.                                                              | Gym / Habits   | Audit part 2 |
| R6  | Changing an **ordinary** habit's schedule changes its past consistency. Only the Gym habit keeps schedule history.                                                                               | Habits         | Audit part 1 |
| R7  | Editing or deleting a **repeating event** always affects the whole series.                                                                                                                       | Calendar       | Audit part 1 |
| R8  | Concurrent edits to a private journal entry on two devices: the last write wins with no conflict copy (other long text gets one).                                                                | Journal / Sync | Audit part 2 |

R1–R3 and R8 matter only once sync is switched on. R4–R7 affect use today.

## 4. Biggest functional gaps (from the gap analysis)

1. **No search on phones.** The palette exists but nothing opens it on a phone (U1). The palette's "Go to" list also leaves out Reviews, Analytics, Notes, Journal and Vault; they are in the sidebar and More.
2. **Occasions and People don't talk to each other.** The same birthday can be entered twice and remind twice (D7). Yearly dates remind only on the day (L1).
3. **Analytics ignores Gym, Health and Thesis**, even though the data is stored (C1).
4. **Exam aspirants get the weakest start.** All four of their sections are plain task pages (E1–E3).
5. **Inbox can only send items to a section**, not to a project, note or list (F1).
6. **Health has no medicines** (S1), and the check-in lives in two places: Home and Health (D3).
7. **Stored but unused:**
   - Task type, start date and estimate have no UI.
   - The `links`, `widgets` and `taskOccurrences` tables are unused.
   - There's no archive (only Trash).
   - Leftover code: the "Coming soon" navigation and "until sync arrives" text.
8. **Closed-app reminders** still need Web Push (server work, after Supabase).

## 5. Decisions for you

These recommendations touch things you asked for, or are a matter of taste, so they're yours to make:

| Topic                          | The recommendation                                                                                                                                    | Why it needs you                                                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home vs Today (D1/D2)          | The gap analysis suggests giving Home and Today distinct jobs and **dropping Home's section map**, since it repeats the sidebar and the Sections page | **You asked for the section map** on Home and for the app to open on it. A gentler option: keep the map, remove the `/sections` page instead, and add a "start screen" setting |
| Check-in placement (D3)        | One check-in, in full on Health, compact on Home                                                                                                      | You asked for check-ins on Home                                                                                                                                                |
| Exam aspirant template (E1–E3) | Syllabus coverage and mock-test score trend                                                                                                           | Only matters if you plan to share the app beyond your own use                                                                                                                  |
| Medicines (S1)                 | Health-owned habits with dose times                                                                                                                   | New feature; you didn't ask for it                                                                                                                                             |
| Archive                        | An "archive" state for projects, lists and sections, separate from Trash                                                                              | Adds a concept; not asked for                                                                                                                                                  |

## 6. Inputs for the UI redesign

- **Design-system inconsistencies** to settle first (`uiux-handover/DESIGN_SYSTEM.md`, `TECHNICAL_ARCHITECTURE.md` here):
  - page titles in 5+ sizes
  - 6+ hand-built segmented controls
  - 80+ raw buttons that don't use the shared Button
  - cards mixing rounded-xl and rounded-2xl
  - two systems for section colour
  - the same green doing double duty as "done"
- **UX issues already recorded** (`uiux-handover/EXISTING_UX_AUDIT.md`):
  - reminder cards cover content (partly fixed with one card and "+N more"; Customize Today was still covered on a phone during capture)
  - colour-only Health dots
  - Coming up's date column wraps
  - board columns get cut off
- **The external reviewer's feedback** on the earlier UI/UX handover package hasn't come in yet. It should be merged with this list.

## 7. Suggested next steps

1. **Review these documents together.** Mark each top-15 recommendation as yes, no or later, and settle the decisions in §5.
2. **Fix R4–R7** (they affect daily use now), each with a regression test first. Leave R1–R3 and R8 until sync is turned on.
3. **Quick wins** from the top 15, small effort with existing data:
   - U1: phone search
   - L1: occasion reminders N days before
   - F4: re-plan all overdue tasks at once
   - U2: "missed while closed" list
   - palette "Go to" completeness
4. **Then the redesign**, in this order:
   1. design tokens and a component library (buttons, segmented controls, cards, headings)
   2. navigation, settling the Home / Today / Sections roles
   3. section pages
   4. phone refinements
5. **Later:** Supabase sync and Web Push, Google Calendar, free Gemini AI help, and the larger P2 integrations (Analytics cards, Goals measured from Gym, Thesis and Focus, coursework timetable).
