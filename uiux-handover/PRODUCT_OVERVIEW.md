# Personal OS: Product Overview (for UI/UX review)

Working name: **Personal OS** (final name and logo not decided, `build.md` header).
Live build: https://personal-os-ruby-xi.vercel.app
Stack: Vite 8, React 19, TypeScript, Tailwind 4, Dexie (IndexedDB), zustand, TipTap (page editor), FullCalendar.

Everything in this document was checked against the source in `src/` and the end-to-end tests in `tests/e2e/`.
Where `build.md` (the spec) and the code disagree, the code wins and the difference is called out.

> **Note on freshness.** At the time of writing, the "section pages" work (each section kind gets its own
> list and task-box behaviour) exists only as uncommitted changes in the working tree
> (`src/features/structure/section-kinds.ts`, `src/features/collections/SectionList.tsx`,
> `tests/e2e/m6-sections.spec.ts`). The live Vercel build may not show it yet.

---

## 1. Purpose and target users

- **Purpose:** one offline-first app that replaces a to-do app, habit tracker, calendar, notes app and a
  handful of spreadsheets for someone whose life spans research, coursework, fitness, health and personal life.
  Data lives in the browser (IndexedDB); no account is needed (`src/pages/OnboardingPage.tsx`: "Your data stays
  on this device, and you don't need an account").
- **Primary persona:** an MS-by-Research student (research area Physical AI, one adviser, coursework,
  thesis not started) using an **Android phone (Chrome)** and a **desktop (Chrome)** (`build.md` "Your context").
- **Secondary personas** (starter structures only, less fleshed out): Student, Working professional, Exam
  aspirant, Freelancer/entrepreneur, Other (`src/core/domain/templates.ts`, `PROFILES`).
- **Design intent** (`build.md` §12.1): "a calm instrument in graphite and paper, where color only ever means
  which part of your life something belongs to." Dark-first, four area colors (Work, Self, Personal, Misc), Inter
  for UI, Bricolage Grotesque for page titles. No backdrop blur (Android GPU issue). Motion only in response to
  actions; reduced motion respected.
- **Product decisions affecting review** (`build.md` §14): desktop first; the phone gets a separately designed
  interface later ("the phone keeps working meanwhile, but isn't polished"); features first, UI/UX discussion
  after the desktop app is complete. **This handover is that UI/UX discussion.**

---

## 2. Modules at a glance

Two kinds of screens exist:

1. **Fixed app screens** (defined in `src/app/nav.ts`, routed in `src/app/routes.tsx`).
2. **The user's own sections** (rows in the `nodes` table, rendered by `src/pages/NodePage.tsx` at `/s/:nodeId`).
   Some sections have a `moduleKey` that switches on special tools (Gym, Health, Thesis, Papers, etc.).

| Group (sidebar label) | Screen             | Route                        | Page file                             |
| --------------------- | ------------------ | ---------------------------- | ------------------------------------- |
| Primary               | Home (section map) | `/home`                      | `src/pages/HomePage.tsx`              |
| Primary               | Today (dashboard)  | `/`                          | `src/pages/DashboardPage.tsx`         |
| Primary               | All Tasks          | `/tasks`                     | `src/pages/TasksPage.tsx`             |
| Primary               | Inbox              | `/inbox`                     | `src/pages/InboxPage.tsx`             |
| Primary               | Projects / Project | `/projects`, `/projects/:id` | `ProjectsPage.tsx`, `ProjectPage.tsx` |
| Primary               | Goals              | `/goals`                     | `GoalsPage.tsx`                       |
| Primary               | Habits             | `/habits`                    | `HabitsPage.tsx`                      |
| Primary               | Focus              | `/focus`                     | `FocusPage.tsx`                       |
| Primary               | Calendar           | `/calendar`                  | `CalendarPage.tsx` (lazy-loaded)      |
| Primary               | People             | `/people`                    | `PeoplePage.tsx` (a built-in list)    |
| Sections              | User sections      | `/s/:nodeId`                 | `NodePage.tsx`                        |
| (from sections)       | A list             | `/lists/:collectionId`       | `CollectionPage.tsx`                  |
| (from sections)       | A meeting          | `/meetings/:meetingId`       | `MeetingPage.tsx`                     |
| (from Gym)            | A workout          | `/workouts/:workoutId`       | `src/features/life/Workouts.tsx`      |
| Tools                 | Reviews            | `/reviews`                   | `ReviewsPage.tsx`                     |
| Tools                 | Analytics          | `/analytics`                 | `AnalyticsPage.tsx`                   |
| Private               | Notes              | `/notes`, `/notes/:id`       | `NotesPage.tsx`                       |
| Private               | Journal            | `/journal`                   | `JournalPage.tsx`                     |
| Private               | Vault              | `/vault`                     | `VaultPage.tsx`                       |
| Footer                | Settings           | `/settings`                  | `SettingsPage.tsx`                    |
| Footer                | Sections editor    | `/settings/sections`         | `StructurePage.tsx`                   |
| Footer                | Tags               | `/settings/tags`             | `TagsPage.tsx`                        |
| Footer                | Trash              | `/trash`                     | `TrashPage.tsx`                       |
| Phone only            | Sections list      | `/sections`                  | `ListPages.tsx` (`SectionsPage`)      |
| Phone only            | More               | `/more`                      | `ListPages.tsx` (`MorePage`)          |
| System                | Onboarding         | `/welcome`                   | `OnboardingPage.tsx`                  |
| System                | Share target       | `/share`                     | `src/features/share/SharePage.tsx`    |

All 17 fixed screens are marked built (`BUILT_KEYS` in `src/app/nav.ts`), so the "Coming soon" groups in the
sidebar and More page are currently empty. `PlaceholderPage.tsx` still exists but is not reachable.

### Default section tree (Researcher profile)

From `src/core/domain/templates.ts`, editable after onboarding:

- **Work**: Research, Thesis, Coursework (plus one subsection per course typed in), Adviser Meetings,
  Updates, Ideas & Projects, Work Misc
- **Self-Improvement**: Gym & Fitness, Health, Learning & Skills
- **Personal Life**: Movies & Series, Places, Trips, Dates & Occasions
- **Miscellaneous**: Shopping, Household, Expenses, Documents

---

## 3. Features per module

### 3.1 Tasks (core)

- Properties in the editor (`src/features/tasks/TaskEditor.tsx`): title, status (not started, in progress,
  completed, skipped, cancelled), section, priority (P1 to P4), due date, due time, deadline time zone (e.g.
  AoE), project, tags, notes, files (attachments), subtasks, repeat, and under "more": start date, type, estimate
  (minutes). Change history is listed per task. A focus session can be started from a task.
- Row actions (`TaskRow.tsx`): Edit, Start/Mark not started/Reopen, Skip… (with reason, `SkipDialog.tsx`),
  Cancel, Duplicate, Delete. Undo toast after status changes and deletes.
- "Overdue" is computed, not stored (`src/core/domain/tasks.ts`).
- Repeating tasks: completing one creates the next (`src/core/domain/recurrence.ts`; test `m2.spec.ts`
  "repeating task").
- Phone gestures: swipe right = complete, swipe left = move to tomorrow, both with Undo (`phone.spec.ts`).
- All Tasks views (`TasksPage.tsx`): **All**, **This week** (grouped by day, overdue on top), **Upcoming**.
  Filters by section and tag; status filter Open / Completed / Skipped / All (`TaskList.tsx`).
  Not built: Board (kanban) view of tasks, saved filters.

### 3.2 Inbox and capture

- Inbox = tasks with no section (`InboxPage.tsx`). Has its own composer with the hint
  "submit review fri 5pm #thesis !high". Items can be drag-reordered and sorted by giving them a section.
- Natural-language parser runs on device (`src/core/domain/capture.ts`, uses chrono-node): dates/times,
  `#tags`, `!priority` (p1/urgent, high, medium…), `@section`, repeats ("every monday 7am"), "aoe" deadlines.
  The preview lets you drop parts it guessed wrong (`CapturePart`).
- Not built: the spec's one-by-one processing buttons "→ Task / Project / Note / Collection item / Archive".

### 3.3 Projects, milestones, goals

- Projects (`ProjectsPage.tsx`, `ProjectPage.tsx`): name, section, status, due date, goal link, notes,
  milestones, tasks, progress from tasks / milestones / set by hand.
- Goals (`GoalsPage.tsx`): title, why it matters, section, target date, status, a counted measure (e.g. papers
  read 0/2) with + and −, "Mark achieved", and **habits that build this goal** (each habit check-in counts,
  `m6-daily.spec.ts`).

### 3.4 Habits

- `HabitsPage.tsx`: every day / a number of times a week / specific days; reminder time; links to a goal;
  stats: streak, last 30 days, last 90 days, done in total; per-habit history. Suggested habits (Gym, a book,
  a research paper, DSA, placement prep). Habit reminders also go into the `.ics` export.
- Today shows "Habits today" with tap-to-check-in (`src/features/habits/HabitsToday.tsx`).

### 3.5 Calendar

- FullCalendar (`CalendarPage.tsx`): desktop Month / Week / Day (opens on Week); phone opens on a 3-day view
  with the view switch in a bottom toolbar.
- Shows events, dated tasks, dated list items (conference deadlines, experiments, birthdays, occasions),
  meetings. Create, edit, delete events, including repeating ones (`src/features/calendar/EventSheet.tsx`).
- Not built: Google Calendar sync (M6).

### 3.6 Section pages (`NodePage.tsx`)

- Header: icon, title, breadcrumb, a motivational line, ⚙ menu (Edit name/icon/color, Add subsection,
  Add a list here, Hide/Show in navigation, Delete section).
- A Notion-style page editor per section (TipTap; `/` menu and markdown shortcuts for headings, lists,
  checklists, quotes, dividers; `src/features/pages/PageEditor.tsx`).
- Subsection chips with open-task counts.
- Section-kind tools (`src/features/structure/section-kinds.ts`, uncommitted): its own list on the page and how
  much of the task box shows:
  | Section kind                                                     | Own list on page   | Task box                |
  | ---------------------------------------------------------------- | ------------------ | ----------------------- |
  | Research                                                         | Papers             | full                    |
  | Ideas                                                            | Ideas              | small "Add a task here" |
  | Learning                                                         | Learning resources | small                   |
  | Movies & Series                                                  | Watchlist (movies) | hidden                  |
  | Places                                                           | Places             | hidden                  |
  | Trips                                                            | Trips              | small                   |
  | Dates & Occasions                                                | Occasions          | hidden                  |
  | Shopping                                                         | Shopping           | hidden                  |
  | Expenses / Invoices                                              | Expenses           | hidden / small          |
  | Adviser Meetings                                                 | (meetings list)    | small                   |
  | A course inside Coursework                                       | Assessments        | small                   |
  | Gym, Health                                                      | own tools (below)  | hidden                  |
  | anything else                                                    | none               | full                    |
  | "Hidden" means hidden unless the section already has open tasks. |
- Thesis section: chapters (Outline/Drafting/Revising/Done) with word goals and a writing log
  (`src/features/life/ThesisSection.tsx`).

### 3.7 Lists engine (collections)

- Any section can hold lists ("Add a list here", `ListsSection.tsx` `TemplatePicker`).
- Templates (`src/content/collection-templates.ts`): Papers, Conference deadlines (AoE), Experiments,
  Datasets & resources, Ideas, Assessments (course), People, Movies & series, Places, Trips, Occasions, Date
  ideas, Expenses, Shopping, Learning, Blank.
- Field types: text, long text, number, URL, date, deadline (with time zone), select, rating, checkbox.
- List settings (`ListSettings.tsx`): add/remove/rename fields and statuses without losing items.
- Views: **Table** (sortable) and **Board** (drag between statuses; on phones a "Move to…" picker).
  Not built: cards, map and calendar views listed in the spec (dated items do appear on the main calendar).
- Specials: Papers import by DOI or arXiv link (Crossref / DataCite, `src/core/domain/papers.ts`) and BibTeX
  export; Assessments show "grade so far" from weights; Expenses show monthly totals; People and Occasions
  repeat yearly on Today and the calendar.

### 3.8 Adviser meetings

- `MeetingsSection.tsx`, `MeetingPage.tsx`: date/time, with whom, agenda, notes (page editor), action items
  that become real tasks, items still open or flagged "follow up" carry over to the next meeting; meeting notes
  can be opened from a calendar event.

### 3.9 Gym (Gym & Fitness section)

- `src/features/life/Gym.tsx`: choose level (beginner / intermediate / advanced / athlete) → recommended
  built-in programs, copied so they can be edited; your own routines with cardio days; "today's workout" from
  the active routine (days in order, or "Do a different day"); a week strip with cardio totals.
- Workout logger (`Workouts.tsx`): sets, reps, weight pre-filled from last time, cardio (minutes, km), notes,
  automatic personal records ("Best lifts"). Logging a workout checks in the Gym habit.

### 3.10 Health (Health section) and daily check-in

- `src/features/life/Health.tsx`: a daily plan (wake, meals, water target, bedtime, water reminder interval);
  one-tap logs of meals, water and sleep judged early / on time / late; sleep hours; a 14-day on-time record;
  doctor appointments as calendar events with reminders a day and 2 hours before, plus notes afterwards.
- Daily check-in (`Checkin.tsx`): mood, energy, sleep, water, weight. Lives on Home; history on Health.

### 3.11 Focus

- `FocusPage.tsx`: 25 / 50 / 90 minute or custom sessions, optionally tied to a task; only time actually
  focused counts; per-day bars for the last 7 days; survives a reload; a floating timer on phones
  (`FocusTimer.tsx`); a badge in the sidebar while running.

### 3.12 Analytics and Reviews

- Analytics (`AnalyticsPage.tsx`): Week / Month / Year with previous/next, scope by section (drill-down),
  completion rate, completed, deep work, habits, per-day bars, 12-month heatmap (`Heatmap.tsx`).
  Computed from stored history; no rollup table.
- Reviews (`ReviewsPage.tsx`): Day / Week / Month / Year with frozen numbers and "What you completed".
  A weekly review nudge appears on Today (`ReviewNudge.tsx`).

### 3.13 Notes, Journal, Vault

- Notes: pinned notes, title + page editor, filter box, searchable with Ctrl+K, delete to Trash.
- Journal: one page a day with previous/next day, mood (Rough → Great). Entries can be marked Private: kept out
  of search and lists, encrypted with the Vault key, locked until the Vault is unlocked.
- Vault: passphrase (min 4 characters) set-up, recovery key, encrypted items with text and files, search,
  change passphrase, auto-lock (`VaultAutoLock.tsx`). Crypto: Argon2id + AES-256-GCM (`src/core/repos/vault.ts`).
- App PIN lock (`src/features/vault/AppLock.tsx`, Settings → App lock): asked on open, wrong PIN refused.

### 3.14 People

- A built-in People list (template `people`): birthday, anniversary (yearly), phone, email, gift ideas, notes.
  Birthdays show on Today and the calendar and trigger reminders.

### 3.15 Reminders

- In-app only while the app is open (`src/features/reminders/Reminders.tsx`): due tasks, habits with a reminder
  time (silent once checked in or the weekly target is met), health plan items, occasions/birthdays at 9:00.
  If notification permission is granted, a system notification shows when the tab is in the background.
- To be reminded with the app closed, the user exports an `.ics` file (Settings → Backup & data) into their
  phone/Google calendar. No Web Push.

### 3.16 Motivational messages

- A small dismissible line under page headers (`MotivationLine.tsx`), chosen by section, template and time of
  day from `src/content/messages.ts`. Settings → Messages: add your own lines (optionally for one section),
  turn messages off.

### 3.17 Sync and accounts

- Sync engine exists (`src/core/sync/*`): per-field last-write-wins, conflict copies, tombstones, first-sign-in
  merge; Supabase table with row-level security; email-link sign-in (`AccountCard.tsx`).
- It only activates when `VITE_SUPABASE_URL` and a key are set (`src/core/sync/supabase.ts`). Without them
  Settings says "Sync isn't switched on for this copy of the app yet." Setup steps: `docs/setup/SUPABASE.md`.
  Tested only against an in-memory server (`engine.test.ts`, `m5.spec.ts`).

---

## 4. Navigation structure

### Desktop and tablet (`src/app/Sidebar.tsx`)

- Shown from 768px. Below 1024px it is always collapsed to icons (64px). From 1024px it can be collapsed
  or expanded, and **resized by dragging its edge** (arrow keys also work, double-click resets to 256px; width
  remembered, `m6-daily.spec.ts`).
- Top: app name, **New task (N)** button, **Search (Ctrl+K)** button.
- Groups: Primary (Home, Today, All Tasks, Inbox with count, Projects, Goals, Habits, Focus with running
  badge, Calendar, People) → **Sections** (the user's tree, with a + to add one, and a "Hidden" group to
  restore hidden sections) → **Tools** (Reviews, Analytics) → **Private** (Notes, Journal, Vault) → footer
  (Settings, Trash).

### Phone (`src/app/BottomNav.tsx`, below 768px)

- Five slots: **[tab 1] [tab 2] [＋ New task] [tab 3] [More]**.
- Tabs 1 to 3 are chosen in Settings → Appearance; defaults Home, Today, Tasks. Choices: any built screen,
  the Sections list, or any of the user's sections (e.g. Gym). ＋ and More are fixed.
  _Note: `build.md` §12.2 says "the 4 tabs other than ＋ are customizable"; the code allows 3._
- **More** (`MorePage`): every primary screen, then "Tools and private", then Settings and Trash.
- **Sections** (`SectionsPage`): the whole section tree as grouped rows, with New section and Edit sections.

### Home map (`HomePage.tsx`)

- A top-down tree: you → four areas → subsections, each with an open-task count; tap to open. The daily
  check-in sits here. The installed PWA opens on Home (`vite.config.ts` `start_url: '/home'`); the browser root
  `/` is Today.

### Command palette (`src/app/CommandPalette.tsx`)

- Ctrl+K / ⌘K anywhere, even while typing. One box to search, jump, or add: groups Go to, Sections, Tasks,
  In pages, Lists, In lists, Meetings, Notes, Journal (non-private only), Actions ("New section",
  "Add task: …" parsed with natural language). Arrow keys + Enter.

---

## 5. User journeys

1. **Onboarding** (`OnboardingPage.tsx`, `shell.spec.ts`): one screen, two optional questions (first name;
   what you do, multi-select). Lands on Today. A dismissible **Finish setting up** checklist on Today
   (`SetupChecklist.tsx`): add research areas, add courses, first task, make the sections yours, install, download
   a backup.
2. **Capture a task:** press **N** (desktop) or **＋** (phone) → New task sheet, saved to the section you are on
   (or due today when on Today); chips for section, Today/Tomorrow/date, priority; stays open for the next one
   (`TaskComposer.tsx`). Alternatives: inline "Add a task" boxes, the Inbox box, Ctrl+K "Add task: …", or
   sharing a link from another app.
3. **Daily loop Home → Today → Habits:** open the app on Home, do the check-in, tap into a section; Today shows
   the day's tasks (overdue and in-progress included), events, habits to tick, Coming up (7 days of deadlines,
   birthdays), active projects; Habits page for streaks and history.
4. **Research papers import:** Research section → Papers list on the page → paste a DOI or arXiv link →
   "Import" fills title, authors, year, venue → move across the board (To read → summarized) → List options →
   Export BibTeX (`m4-lists.spec.ts`).
5. **Gym workout:** Gym section → pick level → choose a program → Today's workout → log sets (pre-filled from
   last time) and cardio → PRs detected → Gym habit checked in (`m6-gym.spec.ts`).
6. **Health logging:** Health section → set the daily plan → tap meals/water/sleep as they happen (on time /
   late) → appointment with reminders → notes after (`m6-health.spec.ts`).
7. **Journal and Vault:** Journal → write today's page, set mood → mark Private (prompts Vault set-up/unlock) →
   Vault stores encrypted items and files; lock, unlock, recover with the recovery key (`m5.spec.ts`).
8. **Review and analytics:** Today shows a weekly review nudge → Reviews (week) with frozen numbers →
   Analytics for trends and per-section drill-down (`m4.spec.ts`).
9. **Backup:** Today reminds after 7 days without a backup (or once 5+ tasks exist) → Settings → Download
   backup (JSON) → Import (merge or replace) on another device; also Tasks CSV and `.ics` (`m1.spec.ts`).

---

## 6. Today (dashboard)

`src/pages/DashboardPage.tsx`, `src/features/dashboard/widgets.tsx`.

- Header: date, greeting by time of day with name, one-line summary ("3 tasks for today, 1 overdue…"),
  motivational line.
- Then, in order: Finish setting up checklist (until dismissed/done) → weekly review nudge → backup reminder
  banner → widgets.
- Widgets: **Today's events**, **Today's tasks** (with an "Add a task for today" box), **Habits today**,
  **Coming up**, **Active projects**.
- **Customize Today** (button at the bottom → sheet): show/hide each widget and move up/down. Saved **per device**
  (local `meta` table, not synced).
- The daily check-in moved to Home (`m6-daily.spec.ts`: "check-in lives here, not on Today").

---

## 7. Customization

| What                                                                                                | Where                                                                                  | Evidence                   |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------- |
| Sections tree: add, rename, icon, color, nest, reorder (up/down arrows), hide/show, delete to Trash | Settings → Sections (`StructurePage.tsx`), sidebar +, section ⚙ menu, `NodeDialog.tsx` | `m1.spec.ts`, `m2.spec.ts` |
| One-click hide a section from navigation                                                            | sidebar / section menu                                                                 | `m2.spec.ts`               |
| Tags: create from a task, rename, recolor, delete, filter                                           | `TagsPage.tsx`, `TagPicker.tsx`                                                        | `m1.spec.ts`               |
| List fields and statuses                                                                            | List options → settings (`ListSettings.tsx`)                                           | `m3.spec.ts`               |
| Lists on any section                                                                                | ⚙ → Add a list here                                                                    | `ListsSection.tsx`         |
| Phone bottom tabs (3 slots)                                                                         | Settings → Appearance                                                                  | `phone.spec.ts`            |
| Theme: Light / Dark / System                                                                        | Settings → Appearance (`src/app/theme.ts`)                                             | `shell.spec.ts`            |
| Sidebar width                                                                                       | drag edge                                                                              | `m6-daily.spec.ts`         |
| Today widgets                                                                                       | Customize Today                                                                        | `m2.spec.ts`               |
| Motivational messages: own lines, per-section, turn off, dismiss one                                | Settings → Messages, `MotivationLine.tsx`                                              | `m2.spec.ts`               |
| Gym routines, health plan, habit reminder times                                                     | Gym / Health / Habits                                                                  | `m6-*.spec.ts`             |

Not built: drag-and-drop reordering of sections (arrows only), per-section accent color picker beyond the
node color, custom task fields (custom fields exist only on lists).

---

## 8. Settings (`src/pages/SettingsPage.tsx`, in order)

1. **Workspace:** Sections, Tags, Trash.
2. **Messages:** your own lines (optionally tied to a section), on/off.
3. **Appearance:** Theme, Bottom bar tabs.
4. **Profile:** Name, Time zone, Week starts on (Mon/Sun).
5. **Account & sync:** email-link sign-in, or the "not switched on" notice.
6. **App lock:** PIN on/off.
7. **Backup & data:** Download backup (shows "Last backup"), Import (merge or replace), Tasks CSV, Calendar
   file (.ics), Erase this device.
8. **Storage on this device:** persistent storage status / request, storage used. (Hint text still says
   "until sync arrives (M5)".)
9. **App:** Install, Reminders (notification permission), Connection, Version, Diagnostics (copy a report
   without personal data).

---

## 9. Search and quick-add

| Entry point                             | Behaviour                                                         | File                                             |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| Ctrl+K / ⌘K palette                     | Search all content, jump, add a task in plain language            | `CommandPalette.tsx`, `AppShell.tsx`             |
| **N** key (desktop)                     | Opens the New task sheet (ignored while typing or with modifiers) | `AppShell.tsx`                                   |
| **＋** (phone bar) / New task (sidebar) | Same sheet; context-aware default section/date                    | `TaskComposer.tsx`, `composer-context.ts`        |
| Inline composers                        | On Today, every section, Inbox, projects                          | `TaskComposer.tsx`                               |
| Natural-language capture                | dates, times, `#tag`, `!priority`, `@section`, "every …", "aoe"   | `src/core/domain/capture.ts`                     |
| Inbox                                   | Tasks with no section; sort by assigning a section                | `InboxPage.tsx`                                  |
| Share target (Android)                  | Share a link/text to the installed app → task in Inbox, once      | `SharePage.tsx`, `vite.config.ts` `share_target` |
| Notes / list search                     | Notes filter box; Vault search; list table sort                   | `NotesPage.tsx`, `VaultPage.tsx`                 |

Private journal entries are excluded from search.

---

## 10. Limitations and unfinished features

- **No sync in practice:** the engine and Supabase schema exist but no project is connected; the live app is
  single-device. Backups are the only way to move data.
- **No Web Push:** reminders fire only while the app is open (system notification if the tab is in the
  background). `.ics` export is the workaround and must be re-exported after changes.
- **Attachments are device-only:** file bytes are not in the JSON backup and not uploaded to Storage; only the
  metadata is backed up (`src/core/db/schema.ts` v5 comment). Restoring on another device loses the files.
- **AI features:** planned (free Gemini behind a Vercel function, "basic help only") and explicitly out of
  current scope; no code exists.
- **Google Calendar sync (M6):** not built. Zotero integration: "maybe".
- **Places:** no map; each place has a map link instead.
- **Not built from the spec:** task Board/Calendar views on the task list, saved filters, Inbox one-by-one
  processing buttons (→ Project / Note / Collection item / Archive), list Cards/Map/Calendar views, skills ↔
  projects, trip itineraries (Trips is a simple list), long-press reorder/multi-select, more profile packs
  beyond starter trees, `dailyStats` rollup table, morning digest.
- **Next planned:** Notion-style project tasks with headings and subheadings (`build.md` §14 "Next").
- **Phone UI:** works and is tested at phone size, but a separately designed phone interface is planned after
  desktop is done.
- **Copy drift:** a few UI strings still refer to milestones ("until sync arrives (M5)" in Settings and on the
  backup banner).

---

## 11. Feature inventory

Status key: **Built** = present in `src/` and covered by a test or clearly wired into a reachable screen;
**Partial** = works but a spec'd part is missing; **Infra only** = code exists but is not active in the live
app; **Planned** = in `build.md`, no code.

| Module      | Feature                                                                                         | Status                    | Evidence file                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| Shell       | Onboarding (one screen, 2 optional questions)                                                   | Built                     | `src/pages/OnboardingPage.tsx`, `tests/e2e/shell.spec.ts`                      |
| Shell       | Finish setting up checklist                                                                     | Built                     | `src/features/setup/SetupChecklist.tsx`                                        |
| Shell       | Desktop sidebar, collapsible, resizable                                                         | Built                     | `src/app/Sidebar.tsx`, `tests/e2e/m6-daily.spec.ts`                            |
| Shell       | Phone bottom bar with 3 choosable tabs                                                          | Built                     | `src/app/BottomNav.tsx`, `tests/e2e/phone.spec.ts`                             |
| Shell       | More page, Sections page                                                                        | Built                     | `src/pages/ListPages.tsx`                                                      |
| Shell       | Home section map                                                                                | Built                     | `src/pages/HomePage.tsx`, `tests/e2e/m6-daily.spec.ts`                         |
| Shell       | Ctrl+K command palette                                                                          | Built                     | `src/app/CommandPalette.tsx`, `tests/e2e/m2.spec.ts`                           |
| Shell       | N shortcut / ＋ New task sheet                                                                  | Built                     | `src/app/AppShell.tsx`, `src/features/tasks/TaskComposer.tsx`, `shell.spec.ts` |
| Shell       | Theme light/dark/system                                                                         | Built                     | `src/app/theme.ts`, `shell.spec.ts`                                            |
| Shell       | Installable PWA, offline                                                                        | Built                     | `vite.config.ts`, `shell.spec.ts`                                              |
| Shell       | Update prompt                                                                                   | Built                     | `src/app/UpdatePrompt.tsx`                                                     |
| Shell       | In-app error screen per route                                                                   | Built                     | `src/app/RouteError.tsx`, `shell.spec.ts`                                      |
| Tasks       | Full task editor (status, priority, dates, tz, project, tags, notes, files, subtasks, estimate) | Built                     | `src/features/tasks/TaskEditor.tsx`, `m1.spec.ts`                              |
| Tasks       | Skip with reason, history, undo                                                                 | Built                     | `SkipDialog.tsx`, `m1.spec.ts`                                                 |
| Tasks       | Repeating tasks                                                                                 | Built                     | `src/core/domain/recurrence.ts`, `m2.spec.ts`                                  |
| Tasks       | All / This week / Upcoming views                                                                | Built                     | `src/pages/TasksPage.tsx`, `m2.spec.ts`                                        |
| Tasks       | Section, tag, status filters                                                                    | Built                     | `TasksPage.tsx`, `TaskList.tsx`                                                |
| Tasks       | Swipe gestures on phone                                                                         | Built                     | `TaskRow.tsx`, `phone.spec.ts`                                                 |
| Tasks       | Task Board / Calendar list views, saved filters                                                 | Planned                   | `build.md` §12.3                                                               |
| Inbox       | Inbox + natural-language capture                                                                | Built                     | `InboxPage.tsx`, `capture.ts`, `m2.spec.ts`                                    |
| Inbox       | Process-to-entity buttons                                                                       | Planned                   | `build.md` §12.3                                                               |
| Inbox       | Share target                                                                                    | Built                     | `SharePage.tsx`, `m2.spec.ts`                                                  |
| Projects    | Projects with milestones and progress modes                                                     | Built                     | `ProjectPage.tsx`, `m2.spec.ts`                                                |
| Projects    | Notion-style project tasks with headings                                                        | Planned (next)            | `build.md` §14                                                                 |
| Goals       | Goals with measure, habits that build it                                                        | Built                     | `GoalsPage.tsx`, `m2.spec.ts`, `m6-daily.spec.ts`                              |
| Habits      | Daily / N per week / specific days, streaks, 30/90 day, history, reminders                      | Built                     | `HabitsPage.tsx`, `m6-daily.spec.ts`                                           |
| Calendar    | Month/week/day, 3-day on phone, events CRUD, repeating                                          | Built                     | `CalendarPage.tsx`, `EventSheet.tsx`, `m2.spec.ts`, `phone.spec.ts`            |
| Calendar    | Google Calendar sync                                                                            | Planned                   | `build.md` M6                                                                  |
| Today       | Widgets + Customize Today (per device)                                                          | Built                     | `widgets.tsx`, `m2.spec.ts`                                                    |
| Today       | Backup reminder banner, review nudge                                                            | Built                     | `DashboardPage.tsx`, `ReviewNudge.tsx`                                         |
| Sections    | Section tree editor                                                                             | Built                     | `StructurePage.tsx`, `m1.spec.ts`                                              |
| Sections    | Notion-style page per section                                                                   | Built                     | `PageEditor.tsx`, `m2.spec.ts`                                                 |
| Sections    | Section-kind tools (own list, task-box rules)                                                   | Built (uncommitted)       | `section-kinds.ts`, `SectionList.tsx`, `m6-sections.spec.ts`                   |
| Lists       | Lists engine, custom fields, statuses                                                           | Built                     | `src/core/repos/collections.ts`, `ListSettings.tsx`, `m3.spec.ts`              |
| Lists       | Table and Board views                                                                           | Built                     | `src/features/collections/views.tsx`                                           |
| Lists       | Cards / Map / Calendar views                                                                    | Planned                   | `build.md` §7                                                                  |
| Lists       | 16 templates                                                                                    | Built                     | `src/content/collection-templates.ts`                                          |
| Research    | Paper import (DOI/arXiv), BibTeX export                                                         | Built                     | `src/core/domain/papers.ts`, `m4-lists.spec.ts`                                |
| Research    | Conference deadlines in AoE                                                                     | Built                     | `m3.spec.ts`                                                                   |
| Research    | Experiments, datasets lists                                                                     | Built                     | `collection-templates.ts`                                                      |
| Thesis      | Chapters, word goals, writing log                                                               | Built                     | `ThesisSection.tsx`, `m4-life.spec.ts`                                         |
| Coursework  | Assessments with weights, grade so far                                                          | Built                     | `collections.ts` `gradeSummary`, `m3.spec.ts`                                  |
| Meetings    | Notes, action items → tasks, carry-over, from calendar                                          | Built                     | `MeetingPage.tsx`, `m3.spec.ts`                                                |
| People      | Birthdays/anniversaries yearly                                                                  | Built                     | `PeoplePage.tsx`, `m3.spec.ts`                                                 |
| Personal    | Movies, places, trips, occasions, date ideas, shopping, expenses (monthly totals), learning     | Built                     | `collection-templates.ts`, `m4-lists.spec.ts`, `m6-sections.spec.ts`           |
| Personal    | Places map                                                                                      | Not built (map link only) | `build.md` M4                                                                  |
| Personal    | Trip itineraries, skills ↔ projects                                                             | Planned                   | `build.md` §7, M4                                                              |
| Gym         | Programs by level, routines, today's workout, cardio, habit check-in                            | Built                     | `Gym.tsx`, `m6-gym.spec.ts`                                                    |
| Gym         | Workout logger with PRs                                                                         | Built                     | `Workouts.tsx`, `m4-life.spec.ts`                                              |
| Health      | Daily plan, on-time logs, sleep, appointments                                                   | Built                     | `Health.tsx`, `m6-health.spec.ts`                                              |
| Health      | Daily check-in                                                                                  | Built                     | `Checkin.tsx`, `m4-life.spec.ts`                                               |
| Focus       | Timed sessions, deep-work totals                                                                | Built                     | `FocusPage.tsx`, `m3.spec.ts`                                                  |
| Analytics   | Completion, deep work, habits, heatmap, drill-down                                              | Built                     | `AnalyticsPage.tsx`, `m4.spec.ts`                                              |
| Reviews     | Day/week/month/year with frozen numbers                                                         | Built                     | `ReviewsPage.tsx`, `m4.spec.ts`                                                |
| Notes       | Pinned, searchable notes                                                                        | Built                     | `NotesPage.tsx`, `m4.spec.ts`                                                  |
| Journal     | Daily page, mood, private entries encrypted                                                     | Built                     | `JournalPage.tsx`, `m4.spec.ts`, `m5.spec.ts`                                  |
| Vault       | Encrypted items + files, recovery key, auto-lock                                                | Built                     | `VaultPage.tsx`, `src/core/repos/vault.ts`, `m5.spec.ts`                       |
| Security    | App PIN lock                                                                                    | Built                     | `AppLock.tsx`, `m5.spec.ts`                                                    |
| Attachments | Files on tasks (device only, 25 MB)                                                             | Partial                   | `Attachments.tsx`, `m3.spec.ts`                                                |
| Reminders   | In-app + background tab notification                                                            | Built                     | `Reminders.tsx`, `m2.spec.ts`                                                  |
| Reminders   | `.ics` export with reminders                                                                    | Built                     | `src/core/domain/ics.ts`, `m4-lists.spec.ts`                                   |
| Reminders   | Web Push / morning digest                                                                       | Planned                   | `build.md` M5                                                                  |
| Messages    | Context messages, own lines, off switch                                                         | Built                     | `MotivationLine.tsx`, `src/content/messages.ts`, `m2.spec.ts`                  |
| Data        | JSON backup/import, CSV, erase, trash + restore                                                 | Built                     | `src/core/backup.ts`, `TrashPage.tsx`, `m1.spec.ts`                            |
| Data        | Persistent storage request, usage                                                               | Built                     | `SettingsPage.tsx`                                                             |
| Sync        | Sync engine + Supabase + email sign-in                                                          | Infra only                | `src/core/sync/*`, `AccountCard.tsx`, `docs/setup/SUPABASE.md`, `m5.spec.ts`   |
| Sync        | Attachment bytes in Storage                                                                     | Planned                   | `build.md` M5                                                                  |
| AI          | Gemini-based help                                                                               | Planned (out of scope)    | `build.md` §14                                                                 |
| Profiles    | Extra profile packs beyond starter trees                                                        | Planned                   | `build.md` M6                                                                  |
