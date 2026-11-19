# Personal OS — Product Overview (discovery, verified against code)

> Audit date: 2026-11-19. Source of truth is the code at commit `c056ee6` (branch `main`). Older docs in
> `uiux-handover/*.md` and `docs/reports/*.md` are partly outdated; everything below was checked in `src/`.
> Status legend used in tables: **Full** = fully implemented, **Partial** = partially implemented,
> **Non-functional** = UI present but does nothing useful, **Absent** = not present.

---

## 1. Purpose

Personal OS is an **offline-first Progressive Web App** that puts work, self-improvement and personal life
in one place: tasks, projects, goals, habits, calendar, focus timer, reviews, analytics, Notion-style
section pages, custom lists ("collections"), meetings, notes, journal, an encrypted vault, gym and health
tracking.

Key product principles (visible in code comments and behaviour):

| Principle | Where it shows |
|---|---|
| Data lives on the device (IndexedDB via Dexie); no account needed | `src/core/db/schema.ts`, onboarding copy in `src/pages/OnboardingPage.tsx` |
| Optional cloud sync (Supabase) only when env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`/`VITE_SUPABASE_PUBLISHABLE_KEY` are set | `src/core/sync/supabase.ts`, `src/features/sync/*` |
| "Honest" progress: only *Completed* counts as done; *Skipped* counts against you; *Cancelled* is removed from totals; *Overdue* is derived, never stored | `src/core/domain/progress.ts`, `src/core/domain/tasks.ts` |
| Everything is soft-deleted to Trash (30 days) with Undo toasts | `src/core/repos/trash.ts`, `src/app/toast.tsx` |
| Every write is logged to an append-only `activityLog` (history + analytics) | `src/core/repos/write.ts` |
| Profiles are only starter templates; nothing checks the profile afterwards | `src/core/domain/templates.ts` |

Tech: React 19, TypeScript, Vite (PWA plugin, `start_url: /home`, Web Share Target), Tailwind 4,
Dexie/IndexedDB (schema v11, 36 tables), zustand (UI state persisted to `localStorage` key `pos-ui`),
React Router, FullCalendar (lazy-loaded), TipTap editor (lazy-loaded), chrono-node (natural-language dates).

## 2. Target users

Onboarding asks "What do you do?" (multi-select, optional). Choices come from `PROFILE_OPTIONS` in
`src/core/domain/templates.ts`:

| Profile (value) | Label | Starter "Work" sub-sections it adds |
|---|---|---|
| `researcher` | Researcher | Research (Papers list), Thesis (chapters), Coursework, Adviser Meetings, Updates, Ideas & Projects |
| `student` | Student | Coursework, Assignments, Exams & Quizzes, Projects |
| `professional` | Working professional | Projects, Meetings, Reports & Reviews, Admin |
| `exam_aspirant` | Exam aspirant (competitive exams) | Subjects, Mock Tests, Revision, Current Affairs |
| `freelancer` | Freelancer / entrepreneur | Clients, Projects, Proposals, Invoices |
| `other` ("Something else") | Other | Projects |

Every profile also gets: **Work › Work Misc**, **Self-Improvement** (Gym & Fitness, Health, Learning &
Skills), **Personal Life** (Movies & Series, Places, Trips, Dates & Occasions), **Miscellaneous**
(Shopping, Household, Expenses, Documents). Duplicate keys across profiles merge (e.g. two "Projects").

Notes:
- "General users" map to `other`. There is no separate "general" profile.
- Profile types **cannot be changed after onboarding** (no UI; `updateProfile` supports it in
  `src/core/repos/profile.ts` but nothing calls it with `profileTypes`).
- Research topics, courses, adviser name, time zone and week start are accepted by `completeOnboarding`
  but onboarding does not ask; research areas and courses are offered later in the Today setup checklist.

## 3. Navigation model

### 3.1 Desktop / tablet (≥ 768 px) — `src/app/Sidebar.tsx`

| Width | Sidebar behaviour |
|---|---|
| 768–1023 px (tablet) | Always an icon rail (64 px), no labels, no collapse toggle |
| ≥ 1024 px (desktop) | Full sidebar; user can collapse to rail (`PanelLeftClose/Open`) and drag-resize 200–420 px (double-click resets to 256; arrow keys on the handle). Width and collapsed state persist (`pos-ui`) |

Sidebar contents, top to bottom:
1. App logo + "Personal OS" + collapse button.
2. **New task** button (shortcut **N**) and **Search** button (Ctrl/⌘+K).
3. Primary nav: Home, Today, All Tasks, Inbox (badge = open section-less tasks), Projects, Goals, Habits,
   Focus (live countdown badge while a session runs), Calendar, People.
4. **Sections** group label with ＋ (new section) → the user's section tree (expand/collapse chevrons,
   remembered; hover "eye-off" hides a section with Undo).
5. **Hidden (n)** fold-out listing hidden sections with a "Show again" eye button.
6. **Tools**: Reviews, Analytics. **Private**: Notes, Journal, Vault.
7. "Coming soon" fold-out — renders nothing today because every nav item is built (`BUILT_KEYS` in `src/app/nav.ts`).
8. Footer: Settings, Trash (+ expand button when collapsed).

Global keyboard: **N** opens the New task sheet (ignored inside inputs/dialogs); **Ctrl/⌘+K** toggles the
command palette everywhere (`src/app/AppShell.tsx`).

### 3.2 Phone (< 768 px) — `src/app/BottomNav.tsx`

Bottom bar: `[tab 1] [tab 2] (＋ New task) [tab 3] [More]`.
- Tabs 1–3 are user-choosable (Settings › Appearance › Phone bottom bar). Default: **Home, Today, Tasks**.
  Choices: any built screen, the "Sections" list, or any individual section.
- ＋ opens the New task sheet. **More** (`/more`) lists every built screen, Tools & private, Settings,
  Trash.
- `/sections` (Sections tab, if chosen) lists the section tree with ＋ and "Edit sections".
- Floating elements: Focus timer pill (bottom-left while a session runs), reminder cards (bottom-right).
- **Gap:** there is **no way to open the command palette / search on a phone** (only the desktop sidebar
  button and Ctrl+K open it). Notes has its own filter box; nothing else is searchable on phone.

### 3.3 App frame — `src/app/AppShell.tsx`

Always mounted: Sidebar, BottomNav, NewTaskSheet, CommandPalette, TaskEditor (side sheet), NodeDialog
(section create/edit), Reminders (cards), FocusTimer, VaultAutoLock, SyncRunner, UpdatePrompt (new PWA
version), Toaster (Undo toasts). Wrapped by `AppLockGate` (optional PIN). No profile → redirect to `/welcome`.
Route errors render inside the frame (`src/app/RouteError.tsx`).

## 4. Hierarchical application map

Legend: `→` navigates, `⧉` opens a sheet/dialog, `☰` opens a menu.

```
/welcome  Onboarding (outside the frame)
├─ Name field, "What do you do?" chips (6), Get started
└─ "Already use Personal OS on another device? Sign in" (only if sync configured) → AccountCard

/home  Home  (PWA start_url)
├─ Date + "Home" title
├─ Section map: "You" root → top-level areas (cards with open-task count) → nested sub-sections (tree lines)
│    every node → /s/:nodeId
└─ Check-in card (mood, energy, sleep, water, weight)  [features/life/Checkin.tsx]

/  Today (dashboard)
├─ Greeting, date, task summary sentence, motivational line (dismissible ✕)
├─ Setup checklist "Finish setting up" (Hide) — steps expand inline
│    ├─ Add your research areas (inline adder) / Add your courses (inline adder)  [only if those sections exist]
│    ├─ Add your first task → ⧉ New task sheet
│    ├─ Make the sections yours → /settings/sections
│    ├─ Install on this device (browser install prompt)
│    └─ Download a backup
├─ Weekly review nudge → /reviews?period=week&offset=0|-1
├─ Backup reminder banner (Download backup)
├─ Widgets (order/visibility per device):
│    ├─ Today's events → link /calendar
│    ├─ Today's tasks: inline composer (due today) + task list (rows → ⧉ Task editor, ☰ row menu, swipe on phone)
│    ├─ Habits today: check-in cells (⧉ skip-reason sheet), Gym plan line (Start → /workouts/:id, Skip ⧉) → link /habits
│    ├─ Coming up (next 7 days; task → ⧉ Task editor, list deadline → /lists/:id?item=)
│    └─ Active projects → /projects/:id, link /projects
└─ "Customize Today" → ⧉ Customize sheet (checkbox per widget, move up/down)

/tasks  All Tasks
├─ Inline composer (goes to the filtered section)
├─ View tabs: All | This week | Upcoming  (?view=week|upcoming)
├─ Filters: Section select (All / Inbox (no section) / each section), Tag select (if tags exist)
├─ (All view) status tabs: Open | Completed | Skipped | All, "Recently closed (n)" fold-out
└─ Task rows → ⧉ Task editor; ☰ Edit, Start/Mark not started/Reopen, Skip… ⧉, Cancel task, Duplicate, Delete

/inbox  Inbox
├─ Inline capture composer (no section chip)
└─ Task list (status tabs) with per-row "Move to…" section picker

/projects  Projects
├─ "New project" → inline name form → /projects/:id
└─ Groups: Active, Planned, On hold, Finished (collapsed) → /projects/:id
   /projects/:id  Project page
   ├─ ← Projects, editable title, progress bar
   ├─ Fields: Status, Section, Goal, Due date (date picker), Progress from (Tasks/Milestones/Set by hand) [+ slider]
   ├─ Outline (Notion-style): headings/subheadings/tasks/subtasks; ☰ per line; "Hide done" toggle
   ├─ Milestones (checkbox, add, delete)
   ├─ Notes textarea
   └─ Delete project → ⧉ Confirm

/goals  Goals
├─ New goal → ⧉ Goal sheet; goal cards (☰ Edit ⧉ / Mark achieved / Delete); ± measure buttons
├─ Linked project chips → /projects/:id; linked habit chips → /habits
└─ "Goal ideas that grow from your habits" (Add → ⧉ prefilled Goal sheet)

/habits  Habits
├─ New habit → ⧉ Habit sheet
├─ Week grid (7 cells per habit; click cycles status; skip → ⧉ Skip-reason sheet)
├─ Row ☰ History ⧉ / Edit ⧉ / Delete; title click → ⧉ Habit detail (stats, 20-week heatmap, "Why you skipped" + Edit ⧉)
├─ Gym habit row: Gym plan line (Start / Skip)
└─ "Suggested for you" (Add → ⧉ prefilled Habit sheet)

/focus  Focus
├─ Timer: 25/50/90 chips + minutes input, task select, Start | (running) Stop and save, +5 min, Discard
├─ Deep work: today, this week, 7-day bars, by top-level section
└─ Recent sessions (task → ⧉ Task editor, ✕ delete)

/calendar  Calendar (lazy)
├─ New event → ⧉ Event sheet; drag-select/click on grid → ⧉ Event sheet (create)
├─ Views desktop: Month | Week | Day (+ prev/next/today). Phone: 3 days (default) | Month | Day
├─ Click: event → ⧉ Event sheet (edit; Delete; "Meeting notes" → /meetings/:id); task → ⧉ Task editor;
│    list date → /lists/:id?item=…; meeting → /meetings/:id
└─ Drag/resize: one-off events and tasks (repeating events locked)

/people  People = the fixed "People" collection (/lists view embedded) — birthdays/anniversaries yearly

Tools
├─ /reviews  Reviews: Day | Week | Month | Year tabs, ‹ period ›, Back to now, summary, questions, Save review, Past reviews
└─ /analytics  Analytics: Week | Month | Year, ‹ period ›, scope breadcrumb (drill into sections), tiles, bars,
                12-month heatmap, By section table, Habits consistency

Private
├─ /notes, /notes/:noteId  Notes: list + filter box, pin/unpin, editor, delete
├─ /journal  Journal: one page per day (‹ ›, ?date=), mood, private toggle (needs Vault), past entries
└─ /vault  Vault: set up passphrase / recovery key, unlock, encrypted items with files, lock

Sections (user-defined, any depth)
└─ /s/:nodeId  Section page
   ├─ Breadcrumb, icon, title, motivational line
   ├─ ☰ Section options: Edit name/icon/color ⧉ NodeDialog, Add subsection ⧉, Add a list here ⧉ Template picker,
   │     Hide/Show in navigation, Delete section… ⧉ Confirm
   ├─ Kind-specific tools (src/features/structure/section-kinds.ts):
   │     Gym & Fitness → GymSection (today's workout, routines, Programs ⧉, Routine ⧉ week builder, consistency)
   │     Health → HealthSection (daily plan ⧉, one-tap logs with timestamps, appointments ⧉, last 14 days)
   │     Thesis → chapters + writing log
   │     Research → Papers list; Ideas → Ideas; Learning → Learning; Movies → Movies & series; Places;
   │     Trips; Dates & Occasions → Occasions; Shopping; Expenses/Invoices → Expenses;
   │     course inside Coursework → Assessments (grade so far)
   ├─ Sub-section chips → /s/:childId
   ├─ Meetings block (not on Gym/Health) → /meetings/:id
   ├─ Notion-style page editor ("/" menu)
   ├─ Other lists in this section → /lists/:id
   ├─ Task outline (if the kind allows tasks) + "From subsections and projects" task list
   └─ "Add a task here" button for kinds with tasks: 'more'
   /lists/:collectionId  List page: add box (Papers: DOI/arXiv import), Table | Board views, column sort,
        item → ⧉ Record sheet, "Fields & statuses" ⧉ ListSettings, ☰ Export BibTeX (Papers) / Delete list…
   /meetings/:meetingId  Meeting: agenda, attendees, earlier items carried over, action items (tasks), notes, files
   /workouts/:workoutId  Workout: sets, cardio, PRs, delete

Settings  /settings
├─ Workspace: Sections → /settings/sections (reorder ↑↓, ☰ per node, nest, hide, recolor), Tags → /settings/tags, Trash
├─ Messages (your own motivational lines, on/off)
├─ Appearance: Theme (dark/light/system), Phone bottom bar (3 selects)
├─ Profile: Name, Time zone, Week starts on
├─ Account & sync (AccountCard), App lock (PIN, "Lock again" timing)
├─ Backup & data: Full backup (JSON), Restore/import ⧉ (merge or replace), Tasks CSV, Calendar .ics, Erase this device ⧉
├─ Storage on this device: persistent storage request, storage used
└─ App: Install, Reminders (Notifications permission, Remind again until done, Quiet hours), Connection, Version, Copy diagnostics

/trash  Trash: Restore, Delete forever, Empty trash (30-day retention)
/share  Web Share Target landing: shared text/URL becomes an Inbox task once
/more, /sections  Phone-only list screens; * → Not found ("Go to Today")
```

Global overlays reachable from anywhere: New task sheet (＋ / N / sidebar), Command palette (Ctrl+K /
sidebar search; desktop only), Task editor side sheet, Section dialog, Reminder cards, Undo toasts,
PWA update prompt, App lock screen.

## 5. Dashboards

### 5.1 Home (`/home`, `src/pages/HomePage.tsx`)
- A visual tree: a "You" pill (display name) → one card per **visible** top-level area (colour stripe,
  icon, "n open") → nested sub-sections as an indented list with connector lines. Desktop lays areas out
  as columns; phone stacks them on a vertical trunk.
- Counts = open top-level tasks in that section **and all descendants**.
- Below: the **daily Check-in** card (mood, energy, sleep, water, weight). It is not on Today.
- Not customizable; no widgets, no quick actions besides navigation.

### 5.2 Today (`/`, `src/pages/DashboardPage.tsx`)
Fixed header (greeting by hour, name, summary of due/overdue/in-progress, motivation line), then conditional
blocks (setup checklist, weekly-review nudge, backup reminder), then five reorderable widgets:
Today's events, Today's tasks, Habits today, Coming up, Active projects. Widgets with nothing to show hide
themselves (except Today's tasks). Layout is stored per device in `meta['dashboard.layout']` (not synced).
Details in `SECTION_FUNCTIONAL_AUDIT.md` §3.

## 6. Customization and settings overview

| What | How | Scope / storage | Status |
|---|---|---|---|
| Section tree (add, rename, icon, colour, nest/move, reorder, hide, delete) | Sidebar ＋, NodeDialog, `/settings/sections`, section ☰ | Synced (`nodes`) | Full |
| Lists inside sections (from ~16 templates or blank), custom fields (9 types), statuses, done-statuses | "Add a list here", "Fields & statuses" | Synced (`collections`, `records`) | Full |
| Section page free-form content | TipTap editor with "/" menu | Synced (`pages`) | Full |
| Task outline headings per project / per section | Outline "# " / "## " | Synced (`projects.headings`, `nodes.config.headings`) | Full |
| Today widgets: show/hide, order | Customize Today sheet | Device only (`meta`) | Full |
| Setup checklist hide | "Hide" | Device only (`meta['setup']`) | Full |
| Phone bottom bar tabs (3 slots) | Settings › Appearance | Synced (`profile.settings.bottomTabs`) | Full |
| Sidebar width / collapsed / expanded sections | Drag edge, toggle | Browser `localStorage` (`pos-ui`) | Full |
| Theme dark / light / system | Settings › Appearance | Device | Full |
| Name, time zone, week start | Settings › Profile | Synced (`profile`) | Full |
| Profile types | — | — | Absent (onboarding only) |
| Motivational messages: built-in by time of day / section template; own lines; global off | Settings › Messages | Own lines synced (`messages`, optional section scope "Anywhere"/one section); on/off device (`meta['messages.off']`) | Full (own lines can't be edited, only deleted; on Today they appear only if scoped "Anywhere") |
| Tags (create via #tag or picker, rename, recolour, delete) | `/settings/tags` | Synced | Full |
| Reminder repeat interval and quiet hours | Settings › App › Reminders | Synced (`profile.settings.remindEveryMin`, `remindQuiet`) | Full |
| Per-habit reminder time and repeat | Habit sheet | Synced | Full |
| Notifications permission | Settings button | Browser | Full (only while app is open; see Part 1 §15) |
| App lock PIN, auto-lock delay | Settings › App lock | Device | Full |
| Backup/restore JSON, CSV export, .ics export, erase | Settings › Backup & data | — | Full |
| Sync account | Settings › Account & sync | Supabase | Present when configured (not audited here) |

## 7. Data model at a glance (`src/core/db/schema.ts`, `src/core/domain/types.ts`)

36 Dexie tables. Every syncable record carries `id` (UUIDv7), `createdAt`, `updatedAt`, `deletedAt?`,
`trashBatchId?`, `archivedAt?`, `version`, `deviceId`, `_ft` (per-field timestamps for merge).

| Area | Tables in use |
|---|---|
| Structure | `profile`, `nodes`, `tags`, `pages`, `messages` |
| Productivity | `tasks`, `recurrences`, `projects`, `milestones`, `goals`, `habits`, `habitLogs`, `events`, `reminders`, `focusSessions`, `reviews` |
| Content | `collections`, `records`, `meetings`, `attachments`, `files` (device-only bytes), `notes`, `journalEntries` |
| Life | `thesisChapters`, `writingLogs`, `workoutSessions`, `workoutSets`, `routines`, `checkins` |
| Security / sync | `vaultMeta`, `vaultItems`, `syncSeen`, `outbox`, `meta`, `activityLog` |

**Defined but unused by any app code** (verified by search): `inbox` (Inbox is tasks without a section),
`taskOccurrences` (repeats spawn new task rows instead), `widgets` (Today layout lives in `meta`), `links`
(no generic backlinks). Fields defined but unused: `archivedAt` (no archive feature anywhere),
`Task.milestoneId`, `Recurrence.until/exceptions/taskTemplate`, `Reminder.channel: 'push'`,
`Habit.unit`, `HabitLog.value`, `Project.startDate/color` (no UI), `Milestone.dueDate/weight` (no UI; weight
defaults to 1).

Key relationships: `Task.nodeId → nodes`, `Task.projectId → projects`, `Task.parentTaskId → tasks`,
`Task.recurrenceId → recurrences`, `Project.goalId → goals`, `Habit.goalId → goals`,
`HabitLog.habitId → habits` (+ `workoutId → workoutSessions`), `Milestone.projectId → projects`,
`Record.collectionId → collections`, `Attachment.targetTable/targetId → any`, `Reminder.target → any
(events/tasks/habits/health/records)`, `Meeting.eventId → events`, action items = tasks with
`custom.meetingId`.

## 8. Known documentation drift

| Claim (older docs / UI copy) | Reality in code |
|---|---|
| Today hint "Your data lives only on this device until sync arrives" and Settings "until sync arrives (M5)" | Sync exists (Supabase) when configured; copy is stale when sync is on |
| build.md §7.3 `taskOccurrences` per-occurrence status | Table unused; each repeat is a new `tasks` row linked by `recurrenceId` and `custom.recurrenceFrom` |
| build.md collections `defaultView` incl. cards/kanban/map/calendar | Only `table` and `board` exist |
| "Coming soon" groups in nav | Empty (all nav screens are built); placeholder code (`PlaceholderPage`, `MODULES` milestones) is dead |
