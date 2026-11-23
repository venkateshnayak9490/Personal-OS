# Personal OS: Implementation Status

What is real in the code today, so design feedback can target working screens and flag gaps.
Checked against `src/` and `tests/e2e/` on 2026-11-18. The spec is `build.md` (roadmap in §14).

**Categories**

- **Fully implemented:** reachable in the UI, does what the spec says, usually covered by an end-to-end test.
- **Partially implemented:** works, but a part promised in `build.md` is missing.
- **UI only / infrastructure only:** code and screens exist but the feature is not active in the live app.
- **Planned:** described in `build.md`, no code yet.
- **Not implemented:** dropped or replaced by a workaround.

> The section-kind work (own list per section, task-box rules) is **uncommitted** in the working tree
> (`src/features/structure/section-kinds.ts`, `src/features/collections/SectionList.tsx`,
> `tests/e2e/m6-sections.spec.ts`) and may not be on the live Vercel site yet.

---

## Fully implemented

| Feature                                                                                      | Main files                                                                                  | Test                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Onboarding (one screen) + Finish setting up checklist                                        | `src/pages/OnboardingPage.tsx`, `src/features/setup/SetupChecklist.tsx`                     | `shell.spec.ts`                                      |
| App shell: sidebar (collapse, drag-resize), phone bottom bar, More, Sections list            | `src/app/Sidebar.tsx`, `src/app/BottomNav.tsx`, `src/pages/ListPages.tsx`                   | `shell.spec.ts`, `m6-daily.spec.ts`, `phone.spec.ts` |
| Choosable phone tabs (3 slots around ＋)                                                     | `BottomNav.tsx`, Settings → Appearance                                                      | `phone.spec.ts`                                      |
| Home section map + daily check-in                                                            | `src/pages/HomePage.tsx`, `src/features/life/Checkin.tsx`                                   | `m6-daily.spec.ts`                                   |
| Today dashboard: 5 widgets, Customize Today (per device), backup banner, review nudge        | `src/pages/DashboardPage.tsx`, `src/features/dashboard/widgets.tsx`                         | `m2.spec.ts`, `m4.spec.ts`                           |
| Command palette (Ctrl+K), N shortcut, ＋ New task sheet                                      | `src/app/CommandPalette.tsx`, `src/app/AppShell.tsx`, `src/features/tasks/TaskComposer.tsx` | `m2.spec.ts`, `shell.spec.ts`                        |
| Tasks: full properties, subtasks, statuses, skip with reason, history, undo, duplicate       | `src/features/tasks/*`, `src/core/repos/tasks.ts`                                           | `m1.spec.ts`                                         |
| Repeating tasks                                                                              | `src/core/domain/recurrence.ts`                                                             | `m2.spec.ts`                                         |
| Task views All / This week / Upcoming; section, tag and status filters                       | `src/pages/TasksPage.tsx`, `TaskList.tsx`                                                   | `m2.spec.ts`, `m1.spec.ts`                           |
| Swipe on tasks (phone)                                                                       | `src/features/tasks/TaskRow.tsx`                                                            | `phone.spec.ts`                                      |
| Natural-language capture + Inbox                                                             | `src/core/domain/capture.ts`, `src/pages/InboxPage.tsx`                                     | `m2.spec.ts`, `capture.test.ts`                      |
| Share target (Android)                                                                       | `src/features/share/SharePage.tsx`, `vite.config.ts`                                        | `m2.spec.ts`                                         |
| Sections: create, nest, rename, icon, color, reorder, hide, delete/restore                   | `src/pages/StructurePage.tsx`, `src/features/structure/NodeDialog.tsx`                      | `m1.spec.ts`, `m2.spec.ts`                           |
| Notion-style page per section (TipTap, `/` menu)                                             | `src/features/pages/PageEditor.tsx`                                                         | `m2.spec.ts`                                         |
| Tags                                                                                         | `src/pages/TagsPage.tsx`, `src/features/tags/TagPicker.tsx`                                 | `m1.spec.ts`                                         |
| Projects with milestones and progress modes                                                  | `src/pages/ProjectsPage.tsx`, `ProjectPage.tsx`                                             | `m2.spec.ts`                                         |
| Goals (measure, habits that build it)                                                        | `src/pages/GoalsPage.tsx`                                                                   | `m2.spec.ts`, `m6-daily.spec.ts`                     |
| Habits (flexible targets, streaks, 30/90 days, history, reminder time)                       | `src/pages/HabitsPage.tsx`, `src/features/habits/*`                                         | `m2.spec.ts`, `m6-daily.spec.ts`                     |
| Calendar (month/week/day, 3-day on phone, events incl. repeating)                            | `src/pages/CalendarPage.tsx`, `src/features/calendar/EventSheet.tsx`                        | `m2.spec.ts`, `phone.spec.ts`                        |
| Lists engine: custom fields, statuses, Table and Board, 16 templates                         | `src/features/collections/*`, `src/content/collection-templates.ts`                         | `m3.spec.ts`                                         |
| Section-kind tools (own list on page, task box full/small/hidden)                            | `section-kinds.ts`, `SectionList.tsx`, `src/pages/NodePage.tsx`                             | `m6-sections.spec.ts` (uncommitted)                  |
| Papers: DOI/arXiv import, BibTeX export                                                      | `src/core/domain/papers.ts`, `src/pages/CollectionPage.tsx`                                 | `m4-lists.spec.ts`                                   |
| Conference deadlines in AoE                                                                  | `collection-templates.ts`, `src/core/domain/collections.ts`                                 | `m3.spec.ts`                                         |
| Course assessments with grade so far                                                         | `collections.ts` (`gradeSummary`)                                                           | `m3.spec.ts`                                         |
| Adviser meetings (action items → tasks, carry-over, from calendar)                           | `src/features/meetings/*`, `src/pages/MeetingPage.tsx`                                      | `m3.spec.ts`                                         |
| People (yearly birthdays/anniversaries) and Occasions (yearly, comments, 9:00 reminder)      | `src/pages/PeoplePage.tsx`, `src/core/domain/reminders.ts`                                  | `m3.spec.ts`, `m6-sections.spec.ts`                  |
| Life lists: movies, places, trips, date ideas, shopping, expenses (monthly totals), learning | `collection-templates.ts`                                                                   | `m4-lists.spec.ts`                                   |
| Thesis chapters, word goals, writing log                                                     | `src/features/life/ThesisSection.tsx`                                                       | `m4-life.spec.ts`                                    |
| Gym: programs by level, routines, today's workout, cardio, habit check-in                    | `src/features/life/Gym.tsx`, `src/core/domain/fitness.ts`                                   | `m6-gym.spec.ts`                                     |
| Workout logger with PRs                                                                      | `src/features/life/Workouts.tsx`                                                            | `m4-life.spec.ts`                                    |
| Health: daily plan, on-time logs, sleep, 14-day record, appointments                         | `src/features/life/Health.tsx`, `src/core/domain/health.ts`                                 | `m6-health.spec.ts`                                  |
| Focus sessions, deep-work totals                                                             | `src/pages/FocusPage.tsx`, `src/features/focus/FocusTimer.tsx`                              | `m3.spec.ts`                                         |
| Analytics (completion, deep work, habits, heatmap, drill-down)                               | `src/pages/AnalyticsPage.tsx`, `src/core/domain/analytics.ts`                               | `m4.spec.ts`                                         |
| Reviews (day/week/month/year, frozen numbers)                                                | `src/pages/ReviewsPage.tsx`, `src/core/repos/reviews.ts`                                    | `m4.spec.ts`                                         |
| Notes (pinned, searchable)                                                                   | `src/pages/NotesPage.tsx`                                                                   | `m4.spec.ts`                                         |
| Journal (daily page, mood, private entries encrypted)                                        | `src/pages/JournalPage.tsx`                                                                 | `m4.spec.ts`, `m5.spec.ts`                           |
| Vault (Argon2id + AES-256-GCM, files, recovery key, auto-lock)                               | `src/pages/VaultPage.tsx`, `src/core/repos/vault.ts`, `src/features/vault/*`                | `m5.spec.ts`                                         |
| App PIN lock                                                                                 | `src/features/vault/AppLock.tsx`, `src/core/repos/pin.ts`                                   | `m5.spec.ts`                                         |
| Motivational messages (context, own lines, off switch)                                       | `src/features/messages/MotivationLine.tsx`, `src/content/messages.ts`                       | `m2.spec.ts`                                         |
| Backup: JSON export/import (merge or replace), tasks CSV, erase device                       | `src/core/backup.ts`, `src/pages/SettingsPage.tsx`                                          | `m1.spec.ts`                                         |
| `.ics` export (events, tasks, deadlines, birthdays, habit and health reminders)              | `src/core/domain/ics.ts`                                                                    | `m4-lists.spec.ts`                                   |
| Trash (30 days) and restore                                                                  | `src/pages/TrashPage.tsx`, `src/core/repos/trash.ts`                                        | `m1.spec.ts`                                         |
| Theme light/dark/system                                                                      | `src/app/theme.ts`                                                                          | `shell.spec.ts`                                      |
| Installable offline PWA, update prompt                                                       | `vite.config.ts`, `src/app/UpdatePrompt.tsx`, `src/app/pwa-install.ts`                      | `shell.spec.ts`                                      |

## Partially implemented

| Feature          | What works                                                                                      | What is missing                                                                                                    | Files                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Reminders        | In-app reminders while open; system notification when the tab is in the background (if allowed) | Nothing fires when the app is closed (no Web Push). `.ics` is the workaround and must be re-exported after changes | `src/features/reminders/Reminders.tsx`                                                               |
| Attachments      | Files on tasks and Vault items, up to 25 MB, stored on this device                              | Bytes not in backups and not uploaded to Storage; metadata only                                                    | `src/features/attachments/Attachments.tsx`, `src/core/repos/attachments.ts`, `src/core/db/schema.ts` |
| Inbox processing | Sort an item by giving it a section; reorder                                                    | Spec's "→ Task / Project / Note / Collection item / Archive" buttons                                               | `src/pages/InboxPage.tsx`; spec `build.md` §12.3                                                     |
| Task list views  | List, This week, Upcoming                                                                       | Board (kanban by status) and Calendar views on the task list; saved filters                                        | `src/pages/TasksPage.tsx`                                                                            |
| List views       | Table and Board                                                                                 | Cards, Map and Calendar views (dated items do show on the main calendar)                                           | `src/pages/CollectionPage.tsx`, `src/features/collections/views.tsx`                                 |
| Places           | A list with a map link per place                                                                | An actual map                                                                                                      | `collection-templates.ts`; `build.md` M4                                                             |
| Trips            | A simple list on the Trips section                                                              | Itinerary days, stays, linked expenses                                                                             | `collection-templates.ts`; `build.md` §7                                                             |
| Profiles         | Six starter section trees                                                                       | Researcher is the only fleshed-out pack; other profile packs are M6                                                | `src/core/domain/templates.ts`                                                                       |
| Analytics data   | Computed from stored history                                                                    | `dailyStats` rollup table (performance)                                                                            | `src/core/domain/analytics.ts`; `build.md` M4                                                        |
| Phone layout     | Every screen works and is tested at phone size                                                  | A separately designed phone interface (planned after desktop)                                                      | `build.md` §14, `tests/e2e/phone.spec.ts`                                                            |
| Section reorder  | Up/down arrow buttons                                                                           | Drag-and-drop                                                                                                      | `src/pages/StructurePage.tsx`                                                                        |

## UI only / infrastructure only

| Feature            | State                                                                                                                                                                                                                                                                                                               | Files                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Accounts and sync  | Engine (per-field last-write-wins, conflict copies, tombstones, first-sign-in merge), Supabase table with RLS, email-link sign-in UI all exist. Only switches on with `VITE_SUPABASE_URL` + key; the live app shows "Sync isn't switched on for this copy of the app yet." Tested only against an in-memory server. | `src/core/sync/*`, `src/features/sync/AccountCard.tsx`, `src/features/sync/SyncRunner.tsx`, `docs/setup/SUPABASE.md`, `m5.spec.ts` |
| Placeholder screen | Component still exists for unbuilt nav items, but every nav item is built, so it is unreachable. "Coming soon" groups in sidebar/More render nothing.                                                                                                                                                               | `src/pages/PlaceholderPage.tsx`, `src/app/nav.ts`                                                                                  |

## Planned (no code yet)

| Feature                                                                                   | Where it is planned         |
| ----------------------------------------------------------------------------------------- | --------------------------- |
| Notion-style project tasks with headings and subheadings (next up)                        | `build.md` §14 "Next"       |
| Web Push reminders and a morning digest                                                   | `build.md` M5               |
| Attachment bytes in Supabase Storage                                                      | `build.md` M5               |
| Google Calendar sync                                                                      | `build.md` M6               |
| Zotero integration ("maybe"), advanced analytics, more profile packs, performance tuning  | `build.md` M6               |
| AI help via free Google Gemini behind a Vercel function (explicitly out of current scope) | `build.md` §14 decisions    |
| Skills ↔ projects linking                                                                 | `build.md` M4 ("not built") |
| Long-press reorder / multi-select on phone                                                | `build.md` §12.4            |
| Final app name and logo                                                                   | `build.md` header           |

## Not implemented (dropped or replaced)

| Feature                        | Replacement                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Places map                     | Map link per place (`build.md` M4)                                                       |
| Closed-app local notifications | Not possible in browsers without a push server; `.ics` export instead (`build.md` §4 C1) |
| Paid AI (Claude API)           | Ruled out by the owner (`build.md` §14)                                                  |

---

## Known doc/code mismatches a reviewer may notice

- `build.md` §12.2 says the 4 phone tabs other than ＋ are customizable; the code lets you choose **3**
  (More is fixed) (`src/app/BottomNav.tsx`).
- `src/app/nav.ts` labels Home with milestone `M6` and the Journal summary says "Private entries are
  encrypted (M5)"; both are built. These labels are not shown as "coming soon" anywhere.
- Settings "Storage used" hint and the Today backup banner still say data lives only on this device "until sync
  arrives".
