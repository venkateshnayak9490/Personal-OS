# Section functional audit

Every section, checked against the code at commit `c056ee6` (19 Nov 2026). Part 1 covers the productivity core (dashboards, tasks, planning, calendar, tools, reminders). Part 2 covers section pages, lists and life modules, the private area, settings and data. Each capability is marked **Fully implemented**, **Partially implemented**, **Non-functional UI** or **Not present**, with file references.

---

# Section Functional Audit — Part 1

> Audit date 2026-11-19, code at commit `c056ee6`. Every row was checked in `src/`; e2e specs in
> `tests/e2e/*.spec.ts` are cited as evidence where a test exercises the behaviour.
> Status: **Full** = fully implemented · **Partial** = partially implemented · **Non-functional** = UI
> present but does nothing useful · **Absent** = not present.
> Paths are relative to the repo root. Part 1 covers: Onboarding, Home, Today, Tasks, Inbox, Projects,
> Goals, Habits, Calendar, Focus, Reviews, Analytics, Command palette, Reminders.

---

## 1. Onboarding (`/welcome`)

Files: `src/pages/OnboardingPage.tsx`, `src/core/repos/profile.ts` (`completeOnboarding`),
`src/core/domain/templates.ts`, `src/core/repos/nodes.ts` (`seedNodes`). Test: `tests/e2e/shell.spec.ts`
("first run goes through setup, then lands on Today").

**Purpose:** create the profile and starter sections in one screen; no account required.

| Capability | Behaviour | Status |
|---|---|---|
| Gate | `AppShell` redirects to `/welcome` while no `profile` row exists; `/welcome` redirects to `/` once it does | Full |
| Name | Optional "What should we call you?" → `profile.settings.displayName` (used by Today greeting, Home root) | Full |
| Profile choice | 6 toggle chips, multi-select, optional; none = `['other']` | Full |
| Starter sections | `buildStarterTree` merges per-profile Work children + Work Misc + Self-Improvement + Personal Life + Miscellaneous; seeded in one transaction (all or nothing) with `config.templateKey` per node | Full |
| Defaults | timezone = device (aliases normalised), week starts Monday, date format `dd MMM yyyy` | Full |
| Sign in on a second device | `<details>` with `AccountCard` only when Supabase env vars are set | Partial (depends on deployment config) |
| Preview / edit the starter tree before creating | `OnboardingInput.tree` supported by API, no UI | Absent |
| Ask research topics / courses / adviser / time zone / week start | API supports, UI does not (moved to Today setup checklist for topics/courses; Settings for tz/week) | Absent here (Partial overall) |
| Change profile types later | No UI | Absent |
| Skip / back / multi-step | Single screen; "Get started" always enabled | n/a |

Data written: `profile` (id `profile`, `profileTypes`, `onboardedAt`, `timezone`, `weekStartsOn`,
`dateFormat`, `settings`), `nodes` (tree), `activityLog`, `outbox`.

---

## 2. Home (`/home`)

Files: `src/pages/HomePage.tsx`, `src/features/life/Checkin.tsx`. Test: `tests/e2e/m6-daily.spec.ts`
("home: the section map opens sections; check-in lives here, not on Today").

**Purpose:** a visual map of all sections plus the daily check-in. PWA `start_url` is `/home`.

| Capability | Behaviour | Status |
|---|---|---|
| Section map | "You" pill → visible top-level areas (colour stripe, icon, "n open") → nested children as tree lines; each node links to `/s/:id` | Full |
| Open counts | Open top-level tasks in the node and all descendants (`useOpenCounts`) | Full |
| Responsive layout | Desktop: one column per area joined by a horizontal bar; phone: vertical trunk | Full |
| Hidden sections | Excluded (uses `visibleTree`) | Full |
| Daily check-in | Mood (stored in journal entry), energy, sleep, water, weight for today → `checkins` row `c:<date>` | Full |
| Customize Home / reorder / add widgets | — | Absent |
| Quick add from Home | Only via global ＋ / N | Absent (by design) |
| Search on Home | — | Absent |

---

## 3. Today dashboard (`/`)

Files: `src/pages/DashboardPage.tsx`, `src/features/dashboard/widgets.tsx`,
`src/features/setup/SetupChecklist.tsx`, `src/features/analytics/ReviewNudge.tsx`,
`src/features/messages/MotivationLine.tsx`, `src/content/messages.ts`, `src/features/habits/HabitsToday.tsx`,
`src/features/life/GymToday.tsx`. Tests: `m2.spec.ts` ("today: hide a widget…", "messages…"),
`m5.spec.ts` ("reviews: weekly review… nudged from Today"), `m6-gym.spec.ts`.

### 3.1 Header
| Item | Behaviour | Status |
|---|---|---|
| Greeting | "Working late" (<5h), Good morning/afternoon/evening + display name | Full |
| Summary line | Counts open top-level tasks: due today (not overdue), overdue, in progress (not already counted) → sentence; "Nothing is due today…" when zero | Full |
| Motivational line | One random line per visit from built-ins for the time of day (`morning/afternoon/evening/night`) plus own enabled lines with no section scope; ✕ hides it for this visit; global off in Settings | Full |

### 3.2 Setup checklist ("Finish setting up")
Shown until all steps done or **Hide** (stored device-only in `meta['setup']`). Progress bar "n of m done".
First undone step auto-expands.

| Step | Shown when | Done when | Action | Status |
|---|---|---|---|---|
| Add your research areas | A visible node with `templateKey 'research'` exists | It has a child | Inline comma-separated adder → child nodes (icon atom) | Full |
| Add your courses | `templateKey 'coursework'` exists | It has a child | Inline adder (icon book); children get the Assessments list kind | Full |
| Add your first task | always | any non-deleted task exists | Opens New task sheet | Full |
| Make the sections yours | always | Clicked "Edit sections" (flag) | → `/settings/sections` | Full (done-on-click, not on actual edit) |
| Install on this device | always | `installed` from PWA store | "Install" when browser offers prompt; else instructions | Partial (iOS / non-Chrome only get text) |
| Download a backup | always | `meta.lastBackup` set | Downloads JSON | Full |

### 3.3 Review nudge
On the last day of the week (offset 0) and the first day of the next (offset −1), until that week's review
has answers → link `/reviews?period=week&offset=…`. Not dismissible except by writing the review. **Full.**

### 3.4 Backup reminder
After setup is hidden/finished: if last backup > 7 days ago, or never and ≥ 5 tasks → banner with
"Download backup". Copy says data lives only here "until sync arrives" even when sync is configured. **Full
(stale copy).**

### 3.5 Widgets
| Widget | Content | Interactions | Hidden when | Status |
|---|---|---|---|---|
| Today's events | Event occurrences today (incl. repeats), time or "All day", location, "Now" badge, past dimmed | Link to Calendar; rows not clickable | none today | Full (rows don't open the event) |
| Today's tasks | Inline composer pre-set to due today; list = open tasks in progress, due ≤ today, or overdue (incl. subtasks with own date); no status tabs | Full task-row actions (§4.3) | never (shows empty text) | Full |
| Habits today | Habits scheduled today + all per-week habits; check-in cell, "n/target this week", streak flame; Gym habit gets the plan line (Start / Skip / Done / rest day) | Cell cycle (§8.4); Start creates a workout → `/workouts/:id` | no habits / none due | Full |
| Coming up | Next 7 days after today: open dated tasks, event occurrences, list deadlines/dates (from now, incl. today); max 8 rows sorted by date | Task → editor; list item → `/lists/:id?item=` ; events not clickable | nothing | Full |
| Active projects | `status = active` projects with progress bar and % | → project page | none active | Full |

### 3.6 Customize Today
Sheet with one checkbox (visible) and ↑/↓ per widget; saves immediately to `meta['dashboard.layout']`
(device-only, not synced; widgets added in later versions append at the end). The header, checklist,
nudge and banner are not customizable. **Full** (test: "today: hide a widget with Customize Today").

---

## 4. Tasks (`/tasks`) — the task system

Files: `src/pages/TasksPage.tsx`, `src/features/tasks/*` (TaskList, TaskRow, TaskEditor, TaskComposer,
SkipDialog, TaskBits, actions), `src/core/repos/tasks.ts`, `src/core/domain/tasks.ts`,
`src/core/domain/recurrence.ts`, `src/core/domain/capture.ts`. Tests: `m1.spec.ts`, `m2.spec.ts`
(capture, repeat, views), `m3.spec.ts` (attachments), `phone.spec.ts` (swipe), `shell.spec.ts` (＋ sheet).

### 4.1 Views, filters, sort
| Capability | Behaviour | Status |
|---|---|---|
| View tabs | **All** (status-filtered list) · **This week** (Overdue group + every remaining day of the week incl. empty "Free" days) · **Upcoming** (every later date with something due, from tomorrow). Stored in `?view=` | Full |
| Section filter | All sections / "Inbox (no section)" / any section (includes descendants). New tasks typed here go to the filtered section | Full |
| Tag filter | Shown only when tags exist; single tag | Full |
| Status tabs (All view, Inbox, section lists) | Open · Completed · Skipped · All, with counts. **Cancelled** only appears under All | Full |
| Recently closed | Under Open: fold-out with up to 20 closed tasks | Full |
| Sort | Fixed: open first → overdue → soonest due instant → priority → oldest; closed by most recently closed. A just-ticked task lingers 0.9 s | Full (not user-selectable) |
| Manual reorder (drag) in lists | — (only the outline in projects/sections has Alt+↑/↓ move) | Absent |
| Text search within Tasks page | — (only command palette) | Absent |
| Filter by priority / date range / status other than above / project | — | Absent |
| Bulk select / bulk actions | — | Absent |
| Group by section/project/priority | — | Absent |

### 4.2 Statuses
`not_started`, `in_progress`, `completed`, `skipped`, `cancelled`. Overdue is derived (date-only tasks
become overdue at the start of the next day; timed tasks at the due instant in the task's zone, AoE
supported). Only `setTaskStatus` writes status; logs `completed`/`skipped`/`reopened`/`status_changed`.
**Full.**

### 4.3 Task row actions (`TaskRow.tsx`)
| Action | How | Result | Status |
|---|---|---|---|
| Complete / reopen | Round checkbox (colour = priority) | `completed` (+ `completedAt`) or back to `not_started`; toast with Undo; repeating task spawns next | Full |
| Open editor | Tap title | Side sheet editor | Full |
| ☰ Edit | Menu | Editor | Full |
| ☰ Start (in progress) / Mark not started / Reopen | Menu (context-dependent) | status change + Undo | Full |
| ☰ Skip… | Menu → SkipDialog | `skipped` with optional reason; shown as "Skipped · reason" | Full |
| ☰ Cancel task | Menu | `cancelled` + Undo | Full |
| ☰ Duplicate | Menu | Copy "(copy)" with subtasks, fresh status; Undo deletes | Full |
| ☰ Delete | Menu | Soft-delete task + subtasks as one Trash batch; Undo restores | Full |
| Swipe right (phone, touch only) | ≥ 88 px | Complete | Full (test `phone.spec.ts`) |
| Swipe left (phone) | ≥ 88 px | Due date → tomorrow (in profile tz) + Undo | Full |
| Inbox "Move to…" | Inline select on open rows in Inbox | Sets `nodeId` | Full |
| Row metadata | Due label (Today/Tomorrow/Yesterday/weekday/date + time + AoE), Overdue in red, In progress, skip reason, repeat icon, subtask count `done/total`, section dot+name, tag chips | Full |
| Subtasks shown inline under the row | Only the count is shown; subtasks are edited in the editor | Absent |
| Archive | — | Absent |
| Priority / date change from the row | Only via editor (or swipe-left to tomorrow) | Absent |

### 4.4 Task editor (side sheet, `TaskEditor.tsx`) — saves on change/blur
| Field / control | Behaviour | Status |
|---|---|---|
| Checkbox + Title | Title saved on blur / Enter; empty title rejected | Full |
| Status select | All 5 statuses; choosing Skipped opens SkipDialog | Full |
| Section select | "No section" or any node (incl. hidden); subtasks follow their parent | Full |
| Priority | 4 radio buttons: Urgent (P1), High, Medium, Low (P4, default) | Full |
| Due date | Date picker (quick: Today, Tomorrow, This weekend, Next week, No date + month grid). Clearing also clears time and zone | Full |
| Due time | Shown when a date exists | Full |
| Time zone for deadline | Profile zone or AoE (UTC−12) | Partial (only two choices) |
| Repeat | Doesn't repeat · Every day · Every weekday · Every week on <day> · Every 2 weeks · Every month on the Nth · Every year; custom rules from quick-add show read-only label | Partial (no custom-rule editor, no end date/count, no "repeat from completion") |
| Remind me before | Only at the deadline / 10 min / 1 h / 3 h / 1 day before (single value) | Full (single offset only) |
| Project | "No project" + non-cancelled projects (list hidden if no projects) | Full |
| Tags | TagPicker (pick existing / create) | Full |
| Notes | Plain textarea (saved on blur) | Full (plain text only) |
| Files | Attach (picker or drop), open (PDF/images in a tab, else download), remove. Bytes stay on this device (`files`), metadata syncs | Full (bytes not synced or backed up) |
| Subtasks | List with checkbox, delete ✕, "Add a subtask" input; one level only; not shown for subtasks | Full (no reorder, no due dates in this UI) |
| More details | Start date, Type (General/Daily/Deadline/Learning/Long-term), Estimate (minutes) | Partial — stored only; Type, start date and estimate are not used by any view, filter or analytics |
| History | Activity log: created, completed, skipped (with reason), reopened, status, moved section, priority/due changes, other field names; first 3 + "Show all" | Full |
| Focus 25 min | Starts a 25-min focus session linked to the task, closes editor, goes to `/focus` | Full |
| Duplicate / Delete | As in row menu | Full |
| Milestone link | `milestoneId` field exists, no UI | Absent |
| Dependencies / blocked-by | — | Absent |

### 4.5 Recurrence (`repos/tasks.ts`)
- A repeating task has a `recurrences` row (RRULE: DAILY/WEEKLY/MONTHLY/YEARLY, interval, BYDAY). Setting a
  repeat on an undated task sets its due date to today.
- **Completing, skipping or cancelling** an occurrence creates the next one (same fields, fresh status,
  subtasks copied, `custom.recurrenceFrom`). If done late it jumps to the next date not in the past. No
  duplicate if an open occurrence exists for that date. Undo of the completion purges the untouched next
  occurrence. Toast says "Next one: <date>". Test: "repeating task: completing it brings the next one".
- Stop repeating: choose "Doesn't repeat" (unlinks; the rule row stays).
- Not present: end date / count (`until` unused), skipping a single future date (`exceptions` unused),
  per-occurrence table (`taskOccurrences` unused), editing "this vs all future".
- **Status: Partial** (core loop solid; advanced options absent).

### 4.6 Skip with reason
Tasks: optional reason ("Rest day, sick, plan changed"), stored in `skippedReason` and the activity log;
never counts as done; counts against completion rate. **Full.** (Habits require a reason — see §8.)

### 4.7 Natural-language quick add (`domain/capture.ts`) — all composers + command palette
| Token | Example | Result |
|---|---|---|
| Date/time (chrono, forward) | `fri 5pm`, `nov 30`, `tomorrow` | `dueDate`, `dueTime` if an hour was given |
| `#tag` | `#thesis` | Tag (created if missing) |
| `!priority` | `!high`, `!p1`, `!urgent`, `!3` | Priority |
| `@section` | `@research` | Section by exact/prefix/contains match of title |
| `aoe` | `deadline nov 30 aoe` | AoE zone |
| Repeat | `every monday 7am`, `daily`, `every 2 weeks`, `weekdays`, `yearly` | Repeat rule; first date aligned to the weekday |
"Understood:" chips preview each parsed part with ✕ to treat it as plain text. **Full** (English only).

### 4.8 Composer, New task sheet, N shortcut
| Capability | Behaviour | Status |
|---|---|---|
| Inline composer | On Today (due today preset), All Tasks (filtered section), Inbox (no section chip), section/project outlines use their own line input. Chips appear once you type: Section, Today, Tomorrow, Date picker, Priority | Full |
| Feedback | "Added to <section>, due …" live text (sheet); input stays focused for the next task | Full |
| New task sheet | Opened by phone ＋, sidebar "New task", **N** key (not in inputs/dialogs), setup checklist; uses the page's context (`useComposerContext`: section on section/project pages, due today on Today) | Full |
| Description / project / tags chips in composer | Tags only via `#`; project only on project page; no notes field | Partial |

Data: `tasks` (`title, description, nodeId, projectId, parentTaskId, priority, status, kind, startDate,
dueDate, dueTime, timezone, recurrenceId, remindBeforeMin[], estimateMin, completedAt, skippedReason,
tags[], custom{}, order`), `recurrences`, `tags`, `attachments` + `files`, `activityLog`.

---

## 5. Inbox (`/inbox`)

Files: `src/pages/InboxPage.tsx`, `src/features/share/SharePage.tsx`, sidebar badge in `src/app/Sidebar.tsx`.
Tests: `m2.spec.ts` ("Inbox: plain-language capture, then sort into a section", "share target…").

**Purpose:** capture fast, sort later. Inbox = **tasks with no section (or a section that no longer
exists) and no project**. The dedicated `inbox` table / `InboxItem` kinds (idea, note, link…) are unused.

| Capability | Behaviour | Status |
|---|---|---|
| Capture | Inline composer with NL parsing (no section chip); `@section` in text files it directly | Full |
| Sort | Per-row "Move to…" section select (open rows) | Full |
| Status tabs | Open / Completed / Skipped / All | Full |
| Badge | Desktop sidebar count of open inbox tasks | Full (no badge on phone bottom bar/More) |
| Share target | Text/URL shared to the installed PWA → one Inbox task (dedup on reload) | Full |
| Convert to project / note / list item | — | Absent |
| Item kinds (idea/link/note) | Table exists, unused | Absent |
| Bulk triage, "process" flow, inbox-zero stats | — | Absent |

---

## 6. Projects (`/projects`, `/projects/:id`)

Files: `src/pages/ProjectsPage.tsx`, `src/pages/ProjectPage.tsx`, `src/features/projects/ProjectOutline.tsx`,
`src/core/repos/plans.ts`, `src/core/repos/outline.ts`, `src/core/domain/outline.ts`,
`src/core/domain/progress.ts`. Tests: `m2.spec.ts` ("projects: create, add tasks, honest progress"),
`m6-projects.spec.ts` (outline), `src/core/repos/outline.test.ts`, `progress.test.ts`.

### 6.1 List
| Capability | Behaviour | Status |
|---|---|---|
| Create | "New project" → inline name (Esc cancels) → opens the project page; defaults: status Active, progress from Tasks | Full |
| Groups | Active, Planned, On hold, Finished (completed + cancelled, collapsed) with counts | Full |
| Row | Title (struck if cancelled), section dot, "Goal: …", "Due …", progress bar, `done/total` or % (manual) or "No tasks yet" | Full |
| Sort / filter / search | Fixed order within groups | Absent |
| Archive | Use status Completed/Cancelled | Absent (no archive) |

### 6.2 Project page
| Capability | Behaviour | Status |
|---|---|---|
| Title | Inline editable, saved on blur/Enter | Full |
| Fields | Status (5), Section, Goal, Due date, Progress from | Full |
| Start date, colour | In data model, no UI | Absent |
| Progress modes | **Tasks**: completed ÷ (top-level tasks − cancelled); skipped counts against. **Milestones**: done weight ÷ total weight (weight always 1 — no UI). **Set by hand**: 0–100 slider in steps of 5 | Full / Partial (weights) |
| Milestones | Add (Enter), toggle done (checkbox), delete ✕ (hover/focus only — hard to reach on touch) | Partial (no rename, due date, weight, reorder, or task linking) |
| Notes | Plain textarea saved on blur | Full |
| Delete project | Confirm → Trash with milestones; tasks keep their `projectId` (section tasks still show under "From projects"; section-less ones disappear from Inbox and every list except All Tasks until the project is restored) | Full (side effect noted) |
| Composer context | ＋/N on a project page uses the project's section, **not** the project | Partial |

### 6.3 Notion-style outline (shared with section pages)
| Capability | Behaviour | Status |
|---|---|---|
| Line types | Task, subtask (one level), heading (`# `), subheading (`## `) | Full |
| Keyboard | Enter = new line after current; Tab / Shift+Tab indent/outdent tasks; Alt+↑/↓ move; Backspace on empty line deletes (task → Trash with Undo; heading removed, tasks stay) | Full (desktop hint text) |
| Line menu (tasks) | Open details, Make subtask / Move out, Move up/down, Skip…, Delete | Full |
| Line menu (headings) | Make subheading/heading, Turn into a task, Move up/down, Delete heading (+Undo) | Full |
| Collapse headings | Chevron per heading (not persisted) | Full |
| Hide done (n) | Checkbox when closed tasks exist (not persisted) | Full |
| Due label per task | Shown, red if overdue | Full |
| Drag and drop | — | Absent |
| Set priority/date inline | Only via "Open details" | Absent |
| Storage | Headings in `projects.headings[]` / `nodes.config.headings[]`; tasks share one fractional `order` | Full |

---

## 7. Goals (`/goals`)

Files: `src/pages/GoalsPage.tsx`, `src/core/repos/plans.ts`, `src/core/domain/progress.ts` (`goalProgress`).
Tests: `m2.spec.ts` ("goals: measure progress with plus and minus"), `m6-daily.spec.ts` ("a goal built by a
habit counts its check-ins").

| Capability | Behaviour | Status |
|---|---|---|
| Create / edit | Sheet: Goal title, Why it matters, Section, Target date, Measure (label, current, target, "Count each check-in of the habits below"), habit chips to link, Status (edit only: Active/Paused/Achieved/Dropped) | Full |
| Suggestions | 5 presets ("Read 100 research papers", "150 days of DSA practice", "120 gym sessions this year", "100 days of placement prep", "Finish 12 books"); Add opens prefilled sheet and pre-links a habit with the matching title **if it exists** (does not create the habit) | Partial |
| Progress | Measure → current/target (capped 100%); habit-driven measure counts linked habits' `done` logs since goal creation; no measure → average of linked projects' % | Full |
| Manual measure | ± buttons on the card | Full |
| Link projects | Only from the project page (Goal select) | Partial (one-way) |
| Link habits | From goal sheet chips or habit sheet "Counts toward goal" | Full |
| Card | Title, status, section, "by <date>", why, progress bar, linked project chips (%), habit chips (30-day %, streak) | Full |
| Mark achieved / Delete (Trash + Undo) | Menu | Full |
| Ordering | Active → Paused → Achieved → Dropped; no manual order | Partial |
| Overdue/target-date warnings, reminders, history chart | — | Absent |

Data: `goals` (`title, why, nodeId, targetDate, status, measure{label,current,target,fromHabits}, order`);
`habits.goalId`, `projects.goalId`.

---

## 8. Habits (`/habits`)

Files: `src/pages/HabitsPage.tsx`, `src/features/habits/habit-ui.tsx`, `src/features/habits/HabitsToday.tsx`,
`src/core/repos/plans.ts` (`createHabit`, `updateHabit`, `deleteHabit`, `setHabitLog`),
`src/core/domain/progress.ts` (`isScheduled`, `streak`, `weekProgress`, `adherence`),
`src/core/domain/analytics.ts` (`habitConsistency`), gym link in `src/core/repos/life.ts`
(`syncGymHabit`, `checkInGym`), `src/features/life/GymToday.tsx`, `GymConsistency.tsx`.
Tests: `m2.spec.ts`, `m6-daily.spec.ts` (suggested habit, skip reason), `m6-reminders.spec.ts`,
`m6-gym.spec.ts`.

### 8.1 Creation (exact flow)
1. **New habit** (header) or **Add** on a suggestion → Habit sheet.
2. Fields: **Habit** name (required) · **How often**: Every day / A number of times a week (1–7) / On
   specific days (Mon…Sun toggles; ≥ 1 required) · **Remind me at** (time) · **Until done, remind again**
   (As in Settings / Just once / 15 / 30 / 60 / 120 min; disabled without a time) · **What counts**
   (note) · **Section** · **Counts toward goal** · **Allow rest days** (default on).
3. **Create** → `habits` row appended at the end (`order`).
Suggestions (hidden once a habit of that title exists): Gym 4×/week 07:00 (Gym & Fitness), Read a book
daily 21:30, Read a research paper daily 10:00 (Research), DSA practice daily 18:00, Placement prep daily
20:00 — section pre-filled from the matching `moduleKey`. **Full.**

### 8.2 Schedules
| Type | Due on | Week target | Streak unit | Status |
|---|---|---|---|---|
| `daily` | every day | scheduled days in week | days | Full |
| `perWeek` n | any day (always listed on Today) | n | weeks meeting n (current week counts once met) | Full |
| `days` [weekday…] | listed weekdays | count of those days | scheduled days | Full |
Schedule history: `targetHistory` keeps old schedules so the past is judged by the old plan — **only
written by the Gym routine sync**. Editing a normal habit's frequency in the sheet **rewrites the past**
(consistency/streak recomputed with the new schedule). **Partial.**

### 8.3 Check-in grid
Current week only (week start from profile), 7 cells per habit; today's column highlighted; unscheduled days
dimmed but clickable. Past weeks cannot be viewed or back-filled in the grid. **Partial.**

### 8.4 Check-in cell cycle (`nextStatus`)
`empty → done → skipped (asks a reason) → rest (only if rest days allowed) → empty`.
- Skipped requires a non-empty reason (quick picks: Feeling unwell, Work commitments, Lack of time, Fatigue,
  Personal reasons, Other — combinable with free text). Cancelling the sheet leaves the cell unchanged.
- Clearing deletes the log permanently (purge, not Trash).
- **Gap:** an accidental "done" can only be cleared by first saving a skip reason, then tapping on (rest →
  empty). There is no direct "undo"/clear. **Partial.**

### 8.5 Skip reasons, rest days
| Capability | Behaviour | Status |
|---|---|---|
| Reason stored | `habitLogs.note`, `skippedAt` (first skip time kept when edited) | Full |
| Review & edit reasons | Habit detail → "Why you skipped" (last 10, with "Planned: …" for gym) → Edit sheet | Full |
| Rest day | Moon cell; never breaks the streak; counts as neither done nor missed | Full |
| Rest days disallowed | Cycle skips "rest" | Full |

### 8.6 Streaks, consistency, history
| Metric | Where | Status |
|---|---|---|
| Current streak (flame) | Habits row, Today card, Goals chip, Analytics | Full ("gentle": rest days and today-not-yet-done don't break it) |
| Week progress `done/target` | Habits row (desktop column / phone text), Today | Full |
| Consistency last 30 days % | Habits row, Goals chip | Full |
| Habit detail sheet | Streak, Last 30 days, Last 90 days, Done in total, 20-week binary heatmap, skip reasons | Full |
| Longest streak, per-weekday pattern, skip-reason analytics | — | Absent |
| Quantity tracking (`unit`, `value`) | Fields exist, no UI | Absent |

### 8.7 Edit / delete / archive / order
Edit via ☰ Edit (same sheet). Delete → Trash with all its logs (+Undo). **Archive/pause: Absent** (only the
Gym habit shows "Paused" when its routine is paused). **Reorder: Absent.**

### 8.8 Reminders
`remindAt` on scheduled days; quiet once checked in today or (per-week) once the week's target is met;
repeats per habit (`remindRepeatMin`) or Settings default; respects quiet hours; card button **Mark done**
logs `done`; snooze/dismiss never complete it. Fires only while the app is open. **Full** within the in-app
model (test "habit reminders: repeat hourly, snooze, dismiss never completes, done stops them").

### 8.9 Gym-linked habit
| Capability | Behaviour | Status |
|---|---|---|
| Source of truth | The **active weekday routine** (Gym section) sets the Gym habit to `days` = its training weekdays; paused/none → no days due; previous schedule appended to `targetHistory` | Full |
| Auto-create | Creates "Gym" (section Gym & Fitness, 07:00) if none; otherwise reuses `source:'gym'` or a habit titled "Gym…" | Full |
| Plan line | Under the Gym habit on Habits and Today: weekday + day name + muscle chips; Start (creates workout, opens it) / Skip (reason, stores `planned`) / Done / Skipped: reason / rest day / "Routine paused" / "Pick a weekday routine" link | Full |
| Auto check-in | Saving a workout marks gym habits done that day (linked habit, habits in that section, or titled gym/workout/exercise) with `workoutId` | Full |
| Consistency (planned-day adherence) | Gym section: this week / this month done, skipped, missed, rest, extra | Full |
| Conflict | The Habit sheet still lets you change the Gym habit's frequency; the next routine change overwrites it | Partial |

Data: `habits` (`title, nodeId, goalId, target, restDaysAllowed, remindAt, remindRepeatMin, source,
targetHistory[], note, order`), `habitLogs` (`habitId, date, status done|skipped|rest, note, skippedAt,
planned, workoutId`; unique per `[habitId+date]`).

---

## 9. Calendar (`/calendar`)

Files: `src/pages/CalendarPage.tsx`, `src/features/calendar/EventSheet.tsx`, `src/core/repos/events.ts`,
`src/core/domain/events.ts`, `src/core/domain/collections.ts` (`datedItems`), `src/core/domain/ics.ts`.
Tests: `m2.spec.ts` ("calendar: create, edit and delete an event"), `m3.spec.ts` (AoE deadline, people
birthdays, meetings from events), `m6-sections.spec.ts` (occasions), `phone.spec.ts` (3-day view), `m4-lists`
(.ics).

### 9.1 Views and navigation
| Capability | Behaviour | Status |
|---|---|---|
| Desktop | Week (default) · Month · Day; prev/next/Today; now indicator; scroll to 08:00; week start from profile | Full |
| Phone | 3 days (default) · Month · Day; view switch in a bottom toolbar | Full |
| Agenda/list view, year view | — | Absent |
| Filter by section / type, search | — | Absent |

### 9.2 What appears
| Source | Display | Click | Drag/resize | Status |
|---|---|---|---|---|
| Events (incl. repeating occurrences) | Section colour dot | Event sheet | One-off events only; repeating locked | Full |
| Tasks with a due date (not subtasks, not cancelled; completed shown filled) | Checkbox marker; all-day unless due time | Task editor | Move changes due date/time; no resize | Full |
| List dates/deadlines (`date`/`deadline` fields; yearly ones every year; AoE converted to local) | Flag marker, "Item · Field" | → list item | Locked | Full |
| Meetings not tied to an event | 1-hour block | → meeting page | Locked | Full |
| Habits, focus sessions, goals/project due dates | — | — | — | Absent (project/goal due dates never on calendar) |

### 9.3 Events
| Capability | Behaviour | Status |
|---|---|---|
| Create | "New event" (next full hour, 1 h), drag-select on grid, click a month day (09:00–10:00) | Full |
| Fields | Event name, All day toggle, Date (From/To for all-day), Starts/Ends (overnight if end < start), Repeat (same presets as tasks), Reminder (none/at start/5/10/30/60 min/1 day; default 10 min for timed), Section, Where, Notes | Full |
| Edit | Click → same sheet; save applies to the **whole series** | Partial (no "this occurrence only") |
| Delete | Trash + Undo; deletes the whole series | Partial (no single-occurrence delete; `exceptions`/EXDATE unsupported) |
| Meeting notes | "Meeting notes" creates/opens the meeting for that occurrence | Full |
| Repeat end date, custom RRULE editor, multiple reminders, attendees, invitations, time zones per event | — | Absent |
| Health appointments (`kind:'appointment'`) | Created from Health section; show as events | Full |
| External calendar sync / import | Export only (.ics, see §15) | Absent (import) |

### 9.4 Occasions and dated list items
Occasions template (Dates & Occasions section): Kind (Birthday/Anniversary/Festival/Celebration/Other), Date
(**yearly**), For/with, Comments. People list: Birthday and Anniversary (yearly). Yearly dates appear every
year on the calendar and in Coming up, and trigger a 09:00 in-app reminder on the day. **Full.**

---

## 10. Focus (`/focus`)

Files: `src/pages/FocusPage.tsx`, `src/features/focus/FocusTimer.tsx`, `src/core/repos/focus.ts`,
`src/core/domain/focus.ts`. Tests: `m3.spec.ts` ("focus: a session from a task counts as deep work, even
across a reload"), `focus.test.ts`.

| Capability | Behaviour | Status |
|---|---|---|
| Length | 25 / 50 / 90 chips or 1–240 minutes | Full |
| Link a task | Select of open top-level tasks (sorted like lists); also "Focus 25 min" in the task editor | Full |
| Start | Stores the running timer in `meta` (device-only, survives reload) | Full |
| Running | Big countdown, "until HH:mm"; **Stop and save**, **+5 min** (max 240), **Discard** | Full |
| Auto-finish | When time is up (even after the app was closed) the session is saved up to the planned end, toast + system notification (if allowed and app hidden) | Full |
| Minimum | Sessions under 1 minute are not saved | Full |
| Elsewhere | Phone: floating pill → /focus; desktop: countdown badge next to Focus in sidebar | Full |
| Stats | Today, This week, last-7-day bars, minutes by top-level section (this week) | Full |
| Recent sessions | Last 15 (in loaded range: this week or last 7 days): time, task (opens editor), length, delete (Trash + Undo) | Full |
| Pause/resume, breaks / Pomodoro cycles, sounds | — | Absent |
| Manual entry / edit of a session | — | Absent |
| Mark task done when finishing | — | Absent |
| Focus goals / daily target | — | Absent |

Data: `focusSessions` (`start, end, minutes, plannedMin, taskId, nodeId`); running state `meta[FOCUS_KEY]`.

---

## 11. Reviews (`/reviews`)

Files: `src/pages/ReviewsPage.tsx`, `src/core/repos/reviews.ts`, `src/features/analytics/summary.ts`,
`src/core/domain/analytics.ts` (`REVIEW_QUESTIONS`, `periodOf`). Test: `m5.spec.ts` ("reviews: weekly review
with numbers, nudged from Today").

| Capability | Behaviour | Status |
|---|---|---|
| Periods | Day · Week · Month · Year tabs; ‹ › (no future), "Back to now"; deep link `?period=&offset=` | Full |
| Summary | Completed, Completion rate (with skipped · missed), Deep work, Habits %; completions per top-level section; "What you completed" (wins) | Full |
| Frozen numbers | Saving stores `summary`; past saved periods show "As it was when you wrote this" | Full |
| Questions | Day: went well / got in the way / one thing tomorrow. Week: went well / didn't go as planned / learned / top three next week. Month: wins / change / focus. Year: proud / differently / themes | Full |
| Save | One record per period (id `<kind>:<first day>`); re-save overwrites | Full |
| Past reviews | List per kind with first answer + "n done · rate"; click jumps to it | Full |
| Delete a review | — | Absent |
| Custom questions, templates, mood/energy in reviews, goals review, carry-over action items | — | Absent |
| Reminder | Weekly nudge on Today only (no notification, no day/month/year nudges) | Partial |

---

## 12. Analytics (`/analytics`)

Files: `src/pages/AnalyticsPage.tsx`, `src/core/domain/analytics.ts`, `src/features/analytics/Heatmap.tsx`.
Test: `m5.spec.ts` ("analytics: honest completion rate, drill-down by section"), `analytics.test.ts`.

| Capability | Behaviour | Status |
|---|---|---|
| Period | Week · Month · Year with ‹ › | Full |
| Scope | "Everything" or drill into a section (breadcrumb; includes descendants) | Full |
| Tiles | Completed, Completion rate = completed ÷ (completed + skipped + missed), Deep work, Habits (done of target) | Full |
| Bars | Tasks completed per day (week/month) or per month (year) | Full |
| Heatmap | Tasks completed, last 12 months | Full |
| By section table | Child sections: completed, rate, deep work; click drills down | Full |
| Habits | Per-habit consistency in period + streak | Full |
| Goals/projects progress over time, focus by day chart (only on Focus page), skip-reason breakdown, health/gym trends, export | — | Absent |
| Custom date range, compare periods | — | Absent |

"Missed" = open tasks whose due date in the period is before today. Skips are counted from the
activity log (`action = 'skipped'`).

---

## 13. Command palette / search (Ctrl/⌘+K)

File: `src/app/CommandPalette.tsx`. Test: `m2.spec.ts` ("Ctrl+K: find a task, jump to a section, add a
task"), `m5.spec.ts` (notes found with Ctrl+K, private journal excluded).

| Capability | Behaviour | Status |
|---|---|---|
| Open | Ctrl/⌘+K anywhere (even in inputs); desktop sidebar Search button | Full (desktop) |
| Open on phone | No trigger | **Absent** |
| Empty query | "Go to": primary screens, Settings, Trash, Edit sections, Tags; Actions: New section; top-level sections | Partial — Reviews, Analytics, Notes, Journal, Vault are **not** in "Go to" and cannot be reached from the palette at all (the nav list is `PRIMARY_NAV` + Settings + Trash) |
| Search groups | Tasks (title/description; open first), Sections, In pages (section page text with snippet), Lists, In lists (record title + text fields), Meetings (title/notes/agenda/attendees), Notes, Journal (non-private only) — max 8 per group | Full |
| Not searched | Projects, Goals, Habits, Events, Tags, Vault, focus, reviews | Absent |
| Add task | Last item "Add task: …" with NL parsing; files into parsed `@section`, else the current page's section, else Inbox; toast | Full |
| Keyboard | ↑/↓, Enter, Esc | Full |
| Fuzzy matching / ranking | Plain substring | Partial |

---

## 14. Inline section task lists ("every section")

(Covered in detail in Part 2; summarised here because Tasks/Projects share it.) Section pages show their
own tasks as the same Notion-style outline (`SectionOutline`), with tasks from subsections and projects
listed apart. Whether the task box shows depends on the section kind (`section-kinds.ts`): `main` (always),
`more` ("Add a task here" button), `off` (no task box unless tasks already exist — e.g. Movies, Places,
Occasions, Shopping, Expenses, Gym, Health). Tests: `m6-sections.spec.ts`.

---

## 15. Reminders system

Files: `src/features/reminders/Reminders.tsx`, `src/core/domain/reminders.ts`, `src/core/repos/events.ts`
(record/snooze/dismiss with Web Locks), `src/core/domain/health.ts` (`healthReminders`),
`src/core/domain/ics.ts`, Settings in `src/pages/SettingsPage.tsx`. Tests: `m2.spec.ts`,
`m6-reminders.spec.ts` (repeat, snooze, quiet hours, two tabs, offline), `m6-health.spec.ts`,
`m6-sections.spec.ts` (occasions), `reminders` unit tests.

### 15.1 What reminds, and when
| Source | Fires | Repeats until done? | Status |
|---|---|---|---|
| Event | Its reminder offset before each occurrence start (one offset per event) | No | Full |
| Task with due time | At the due instant (task zone or profile zone) | Yes, every N min (Settings) outside quiet hours | Full |
| Task advance reminder | `remindBeforeMin` before the due time, once, while still ahead | No | Full |
| Task with date only | 09:00 on the due day, **only when repeat is on** (Settings "Remind again" ≠ Just once) | Yes | Full (implicit rule) |
| Habit with `remindAt` | On scheduled days; silent once checked in or weekly target met | Per-habit or Settings interval | Full |
| Health plan | Meals, water, bedtime nudges (only after a plan is set on Health) | Per plan | Full |
| Occasions / yearly list dates | 09:00 on the day | No | Full |
| Subtasks, goals, project/milestone due dates, review nudges | — | — | Absent |

Window: a reminder older than 6 h is dropped (app was closed). Only the latest round of a repeating
reminder is shown.

### 15.2 In-app cards
Fixed bottom-right (above bottom bar on phone); **one card at a time** with "+N more reminders"
expand (max 5). Each card: title, context line ("Due · 9:00 AM", "Habit · …", "Health · …", "Starts in
n min"), buttons:
| Target | Primary | Extra |
|---|---|---|
| Task | Open (editor) | **Mark done** |
| Habit | **Mark done** (logs done) | — |
| Health | Had a glass / Going to bed / Ate now (logs with device time) | — |
| Occasion | Open (list item) | — |
| Event | Open (→ /calendar, not the event) | — |
All: **Snooze** (10 min / 30 min / 1 h) and ✕ Dismiss. Dismiss never completes anything. **Full.**

### 15.3 Snooze, repeat, quiet hours
| Capability | Behaviour | Status |
|---|---|---|
| Snooze | Hides the card and suppresses new rounds for that item until the time; on return notifies once ("Your snoozed reminder is back.") | Full |
| Remind again until done | Settings: Just once / 15 / 30 / 60 (default) / 120 / 180 min; per-habit override | Full |
| Quiet hours | Settings from–to; default follows Health plan bedtime→wake, else 22:30–07:00; rounds inside are skipped (reload catches up) | Full |
| Multi-tab / multi-device dedupe | Each round recorded in `reminders` under a Web Lock → shown/notified once | Full |
| Offline | Works (no network needed) | Full |

### 15.4 System notifications
"Notifications" button in Settings requests permission. `notify()` shows a notification **only when the app
is open in a background tab/window** (`document.hidden`) via the service worker. There is **no push and no
scheduled notification**: with the app closed nothing fires (`Reminder.channel: 'push'` is unused). The UI
copy says so ("while the app is open"). **Partial.**

### 15.5 .ics export (workaround for closed-app reminders)
Settings › Backup & data › **Export .ics** downloads `personal-os.ics` with events (with RRULE and alarms),
dated tasks, list deadlines and dates (yearly ones with `FREQ=YEARLY`), habit reminders (repeating 15-min
slots with alarms) and health-plan items. One-off snapshot; must be re-exported after changes. **Full**
(manual, no subscription URL).

Data: `reminders` (`target{table,id}`, `fireAt`, `channel`, `sentAt`, `dismissedAt`, `snoozedUntil`,
`resurfacedAt`) — a log of shown rounds, not a schedule; schedules are computed from tasks/events/habits/
settings each 15 s (`useNow(15_000)`).

---

## 16. Cross-cutting gaps and non-functional UI found (Part 1 scope)

| # | Finding | Type | Where |
|---|---|---|---|
| 1 | No search/command palette entry point on phones | Absent | `Sidebar.tsx` only; no phone trigger |
| 2 | Palette "Go to" omits Reviews, Analytics, Notes, Journal, Vault | Partial | `CommandPalette.tsx` nav list uses `PRIMARY_NAV` + Settings + Trash |
| 3 | Habit "done" can't be cleared without entering a skip reason | Partial (UX bug) | `habit-ui.tsx` `nextStatus` |
| 4 | Editing a normal habit's schedule rewrites its history (no `targetHistory`) | Partial | `HabitsPage.tsx` `HabitSheet` |
| 5 | Habit grid shows only the current week; no back-fill of older days | Partial | `HabitsPage.tsx` |
| 6 | Task Type, Start date, Estimate are stored but used nowhere | Non-functional (data only) | `TaskEditor.tsx` "More details" |
| 7 | Milestones: no edit, due date, weight; `milestoneId` on tasks unused | Partial | `ProjectPage.tsx` |
| 8 | Project start date and colour have no UI | Absent | `types.ts` |
| 9 | Repeating events: edit/delete always whole series | Partial | `EventSheet.tsx`, `events.ts` |
| 10 | Reminders only while the app is open; no push | Partial | `Reminders.tsx` |
| 11 | Unused tables `inbox`, `taskOccurrences`, `widgets`, `links`; unused `archivedAt` (no archive anywhere) | Dead schema | `schema.ts` |
| 12 | "Coming soon" sidebar/More group and `PlaceholderPage`/`MODULES` milestone text are dead code | Dead UI | `nav.ts`, `Sidebar.tsx`, `ListPages.tsx` |
| 13 | Backup/storage copy says "until sync arrives" although sync exists | Stale copy | `DashboardPage.tsx`, `SetupChecklist.tsx`, `SettingsPage.tsx` |
| 14 | Milestone delete ✕ and subtask delete are hover-revealed (opacity 0 on desktop; milestone ✕ also on touch) | UX | `ProjectPage.tsx` |
| 15 | Today's events rows and reminder "Open" for events don't open the specific event | Partial | `widgets.tsx`, `Reminders.tsx` |
| 16 | Goal suggestions don't create the matching habit | Partial | `GoalsPage.tsx` |
| 17 | Project deletion leaves its tasks with a dangling `projectId` (they vanish from Inbox and project views until restored) | Side effect | `plans.ts deleteProject` |


---

# Section Functional Audit — Part 2

Audit date: 2026-11-19 · Commit: `c056ee6` · Read-only audit. No code was changed.

Paths are relative to `src/` unless stated otherwise. `file:N` means a line number.

## Status legend

| Label | Meaning |
|---|---|
| **Full** | Fully functional. The UI works end to end and writes through the repo layer. |
| **Partial** | Works, but has a gap: a missing branch, a stale link, data stored but never shown, or an edge-case bug. |
| **Non-functional UI** | A control or block is shown (or is in the render tree) but does nothing, or can never render. |
| **Not present** | There is no code for it. |

**Overall:** no TODO or FIXME comments and no `onClick={() => {}}` stubs were found in the audited files. Gaps are mostly missing features and data-consistency issues, not dead buttons.

The only true non-functional UI found is listed here:

| Item | Where | Effect |
|---|---|---|
| "Days a week" input is ignored when "Fixed weekdays" is on | `features/life/Gym.tsx:503,538-547` | Shown and editable, but the save code overwrites the value with the number of days. |
| Weekday `<Select>` wrapped in `byWeekday &&` inside the `!byWeekday` branch | `Gym.tsx:562,571-584` | Dead code. It can never render. |
| "Coming soon" group on More | `pages/ListPages.tsx:131-140` with `app/nav.ts:188-206` | `BUILT_KEYS` covers every nav key, so the group is always empty and never shows. Harmless. |

---

## 1. Sections and section pages

Main files: `pages/NodePage.tsx`, `features/structure/section-kinds.ts`, `features/structure/NodeDialog.tsx`, `features/pages/PageEditor.tsx`.

**Purpose.** Every life area is a section, stored in the `nodes` table as a tree (`parentId`, `order`). A section page at `/s/:nodeId` combines several blocks:
- a notes page
- the section's "own" list (when its kind has one)
- dedicated tools (Gym, Health, Thesis, Meetings)
- other lists
- a task outline
- a rollup of tasks from subsections and projects

### 1.1 Section kinds

`sectionKind(node, parent)` is defined at `section-kinds.ts:30-35`. The kind comes from `node.moduleKey`.

A section without a `moduleKey` whose parent is `coursework` gets the course kind. Every other section gets the default kind: `{tasks:'main'}`.

The `tasks` value controls the outline:
- `main`: the outline is always shown.
- `more`: an "Add a task here" button is shown.
- `off`: the outline is shown only when open tasks exist.

| moduleKey | Own list (template) | Tasks | Extra tool | Status |
|---|---|---|---|---|
| research | papers | main | — | Full |
| ideas | ideas | more | — | Full |
| learning | learning | more | — | Full |
| entertainment | movies | off | — | Full |
| places | places | off | — | Full |
| trips | trips | more | — | Full |
| dates | occasions | off | — | Full |
| shopping | shopping | off | — | Full |
| finance | expenses | off | — | Full |
| invoices | expenses | more | — | Full |
| meetings | — | more | `MeetingsSection` (`NodePage.tsx:220`) | Full |
| fitness | — | off | `GymSection` (`NodePage.tsx:185`) | Full (see §6) |
| health | — | off | `HealthSection` (`NodePage.tsx:186`) | Full (see §7) |
| thesis | — | main | `ThesisSection` (`NodePage.tsx:216`) | Full (see §4) |
| child of coursework | course (Assessments) | more | — | Full |
| coursework, assignments, exams, subjects, updates, documents, reports, clients, projects | — | main | — | **Partial.** These keys are seeded but have no KINDS entry. In `app/nav.ts` MODULES, `updates` promises "Conference deadlines (AoE)" and `documents` promises references, but neither is wired up automatically. |
| A kind for a section the user creates | — | — | — | **Not present.** NodeDialog has no moduleKey or template picker, so a section the user makes called "Research" does not get Papers. Kinds come only from onboarding seeds (`core/repos/nodes.ts:107`) or the coursework-parent rule. |

### 1.2 Page layout (top to bottom, `NodePage.tsx:115-271`)

1. Breadcrumb.
2. Header: icon, title, "Hidden from navigation" note, `MotivationLine`, options menu.
3. Gym and Health tools.
4. Notes page. It appears here unless the section has its own list or tools (`toolsFirst`, line 94).
5. Subsection chips.
6. Thesis.
7. Own list (`SectionList`).
8. `MeetingsSection`. It is rendered on every section except fitness and health, and shows itself only when the section has meetings or is the meetings kind.
9. Notes page, when `toolsFirst` is set.
10. `ListsSection` (other lists).
11. `TemplatePicker` sheet.
12. Task outline, or the "Add a task here" button.
13. "From subsections and projects" rollup.
14. Delete confirmation.

A missing section id shows "This section doesn't exist" with a link to Trash (`:70-78`). **Full.**

### 1.3 Section options menu (`NodePage.tsx:146-182`)

| Item | Action | Status |
|---|---|---|
| Edit name, icon, color | Opens NodeDialog in edit mode. The "Inside" select re-parents the section; cycles are blocked (`nodes.ts:71`). | Full |
| Add subsection | Opens NodeDialog in create mode with `parentId` set. | Full |
| Add a list here | Opens `TemplatePicker`. | Full |
| Hide / Show in navigation | `updateNode({hidden})`, with an Undo toast on hide. | Full |
| Delete section… | Confirm dialog → `deleteNode` → Undo toast → navigates to the parent. | Full (partial cascade, see §1.10) |
| Reorder, duplicate, export, archive, history | — | Not present. Hide stands in for archive; reordering is only in the Section editor. |

### 1.4 NodeDialog (`features/structure/NodeDialog.tsx`)

- **Fields:**
  - Name (required)
  - Inside (parent): the list excludes the section itself and its descendants
  - Color: 12 swatches, plus "Same as parent"
  - Icon: a grid from `lib/icons.ts`
- **Create:** `createNode`, then a toast whose Undo calls `purge` (a hard delete).
- **Edit:** `updateNode`, plus `moveNodeToParent` when the parent changes. The section is placed at the end of the new parent.
- **Defaults:** top level gets `sky`; a subsection inherits its parent's color.

Status: **Full.** Limitation: there is no kind, template or description field.

### 1.5 Notes page editor and the "/" menu (`features/pages/PageEditor.tsx`, `core/repos/pages.ts`)

- **Editor:** TipTap (StarterKit, autolink, TaskList with nested TaskItem, Placeholder). It is lazy-loaded (`NodePage.tsx:42`).
- **Storage:** the `pages` table, with `id = nodeId` and fields `{doc, text}`. The row is created on the first save.
- **Saving:** debounced by 400 ms. It also flushes on blur, `visibilitychange`, `pagehide` and unmount. A "Saving… / Saved" indicator is shown.
- **History:** at most one activity line per 10 minutes (`pages.ts:6`, `quiet: true`). Saving is skipped if the section is in Trash.

**Slash menu** (`BLOCKS`, `PageEditor.tsx:35-116`):
- Filters by label or keyword.
- Keyboard: ↑ ↓ Enter Esc. Mouse works too.
- Flips above the cursor when there is no room below.
- Disabled inside code blocks.

| Block | Markdown shortcut | Status |
|---|---|---|
| Text | — | Full |
| Heading 1 / 2 / 3 | `#` `##` `###` | Full |
| Bulleted list | `-` | Full |
| Numbered list | `1.` | Full |
| Checklist | `[]` | Full. These are document checkboxes, not tasks, and are not counted anywhere. |
| Quote | `>` | Full |
| Divider | `---` | Full |
| Code block | ```` ``` ```` | Full |
| Images, tables, callouts, toggles, @-mentions, links to tasks or sections, link-insert UI, formatting toolbar, page templates, version history UI | — | Not present |

### 1.6 Subsection chips (`NodePage.tsx:190-214`)

Each direct child is shown as a pill linking to `/s/:id`. The pill shows the child's icon and color, and the count of open top-level tasks across the child's whole subtree. Hidden children are dimmed (opacity 60).

Status: **Full.** There is no add or reorder on the chips themselves.

### 1.7 Section task outline (`features/projects/ProjectOutline.tsx`: `SectionOutline` at :183, `TaskOutline` at :195; `core/repos/outline.ts`; `core/domain/outline.ts`)

- **Scope.** The section's own tasks: `nodeId === node.id && !projectId`, outline scope `node:<id>`. Headings are stored in `node.config.headings` (`{id, title, level 1|2, order, createdAt}`), not in a table.

- **Line parsing.** `# ` makes a heading and `## ` a subheading. Any other line becomes a task, parsed like Quick add:
  - dates, e.g. "fri 5pm"
  - `!priority`
  - `#tag` (the tag is created automatically if it doesn't exist)
  - "every …" for repeats

  See `repos/outline.ts:35-50`.

- **Keyboard.**
  - Enter adds a new line.
  - Tab and Shift+Tab change the indent. Only one subtask level is allowed.
  - Alt+↑ / Alt+↓ move the line.
  - Backspace on an empty line deletes it.

- **Row menu for a heading:** toggle heading/subheading, turn into a task, move up or down, delete. Deleting has an Undo toast, and the heading's tasks stay.

- **Row menu for a task:** open details (TaskEditor), indent/outdent, move up or down, Skip… (`SkipDialog`), delete. The check circle completes the task. Overdue due dates are shown in red.

- **Other controls:** collapse a heading, a "Hide done (n)" toggle, and an "n open" counter.

- **Concurrency.** All edits are serialised (`repos/outline.ts:53-58`).

| Aspect | Status |
|---|---|
| Outline editing | Full |
| Collapse, Hide done, and "Add a task here" persisted across reloads | **Partial.** These are local state only (`ProjectOutline.tsx:211-213`, `NodePage.tsx:53`). |
| Drag-and-drop, deeper nesting, filter or search inside the outline | Not present |

**When the outline is visible** (`NodePage.tsx:105`): when the kind is `main`, or when open tasks exist, or after clicking "Add a task here". `openCount` includes subsection tasks, so an `off` section shows the outline whenever any child has open tasks.

### 1.8 "From subsections and projects" (`NodePage.tsx:242-252`)

Shows tasks whose `nodeId` is in the subtree but are not this section's own direct tasks, plus any project tasks. They are rendered with `TaskList hideFilters showSection`. The heading changes to "From projects" when there are no subsections.

- `includeSubs` is hard-coded `true` (`:50`). There is no toggle.
- The rollup only renders inside the outline branch. On an `off` section with no open tasks it is hidden.

Status: **Full.**

### 1.9 Add a list here, own list, other lists

| Feature | Behaviour | Status |
|---|---|---|
| `TemplatePicker` (`features/collections/ListsSection.tsx:60-110`) | A sheet with every template except `people`. Templates that suit the section path's `config.templateKey` are ranked first and Blank is last. Tapping one runs `createCollection({templateKey,nodeId})` and navigates to `/lists/:id`. There is no name prompt; you rename the list later. | Full |
| Own list (`features/collections/SectionList.tsx`) | Nothing is created on visit. The block shows the template name, a hint and an add box. The first add creates the list and the first item; for papers it does a DOI/arXiv lookup first. After that it renders `CollectionPage embedded`. If the own list is deleted, the add box comes back. | Full |
| `ListsSection` (other lists) | Cards with icon, name, and "Empty" / "n open of N" / "N items". The heading is "More lists" or "Lists". There is no add button in this header; adding is only through the menu. | Full |

### 1.10 Delete cascade (`core/repos/nodes.ts:79-104`)

Deleting a section trashes, as one batch:
- the section and all its descendants
- tasks, pages, collections, records, meetings and notes whose `nodeId` is in the subtree

It does **not** trash projects, goals or habits that point at those sections. They keep a dangling `nodeId`. Project tasks that carry a subtree `nodeId` are trashed while their project stays.

Status: **Partial cascade.**

---

## 2. Lists / collections engine

Files: `content/collection-templates.ts`, `core/domain/collections.ts`, `core/repos/collections.ts`, `pages/CollectionPage.tsx`, `features/collections/{views,RecordSheet,ListSettings,FieldInput}.tsx`.

**Data.**
- `collections`: `{name, icon, nodeId?, templateKey, statusOptions[], statusName?, doneStatuses[], fields: FieldDef[], defaultView 'table'|'board', order}`.
- `records`: `{collectionId, nodeId (copied from the list), title, status, custom{fieldKey: value}, tags[], order}`.
- `FieldDef` is `{key, name, type, options?, yearly?, defaultTz?}`. New field keys are `f` + 8 id characters.
- Status changes are logged as `status_changed`.
- Read-modify-write edits are serialised (`repos/collections.ts:14-21`).

### 2.1 Templates

✓ marks a status that counts as done.

| key | Name | Statuses | View | Fields | Suits |
|---|---|---|---|---|---|
| papers | Papers | To read, Reading, Read, Summarized, Cited (none done) | board | Authors, Year (number), Venue, Link (url), Rating, Summary (longtext) | research, thesis |
| deadlines | Conference deadlines | Planning, Writing, Submitted✓, Skipped✓ | table | Paper deadline (deadline, AoE), Abstract deadline (deadline, AoE), Link, Notes | research, updates |
| experiments | Experiments | Planned, Running, Done✓, Failed✓ | table | Date, Hypothesis, Config, Result, Run link | research, ideas |
| datasets | Datasets & resources | To check, Using, Used | table | Link, Kind (select), License, Notes | research, learning |
| ideas | Ideas | New, Exploring, Parked, Pursuing | board | Promise (rating), Notes | ideas, research |
| course | Assessments | To do, Submitted✓, Graded✓ | table | Type (select), Due (deadline, "My time"), Weight %, Score, Out of, Notes | coursework |
| people | People (status is called "Relation") | Family, Partner, Friends, Adviser & lab, Colleagues, Others | table | Birthday (date, yearly), Anniversary (date, yearly), Phone, Email, Gift ideas, Notes | — (not in the picker) |
| movies | Movies & series | Want to watch, Watching, Watched✓, Dropped✓ | board | Type, Where, Year, Rating, Review | entertainment, personal |
| places | Places | Want to go, Been there, Favourite | table | Kind, City, Map link, Rating, Notes | places, trips, dates |
| trips | Trips | Idea, Planning, Booked, Done✓ | board | From, To (dates), Budget, With, Plan | trips, places |
| occasions | Occasions (status is called "Kind") | Birthday, Anniversary, Festival, Celebration, Other | table | Date (yearly), For / with, Comments | dates, personal |
| dates | Date ideas | Idea, Planned, Done✓ | board | When, Cost (select), Rating, Notes | dates, personal |
| expenses | Expenses | Paid✓, To reimburse, Reimbursed✓ | table | Amount, Category (9 options), Date, Notes | finance, trips, misc |
| shopping | Shopping list | To buy, Bought✓ | board | How many, Where | shopping, household |
| learning | Learning resources | To start, In progress, Finished✓ | board | Skill, Kind, Link, Notes | learning |
| blank | New list | To do, Doing, Done✓ | table | — | — |

An unknown template key falls back to `blank` (`repos/collections.ts:45`).

### 2.2 Field types (`FieldInput.tsx`)

| Type | Editor | Saves on | Table display | Status |
|---|---|---|---|---|
| text | Input | blur | raw text | Full |
| longtext | Textarea | blur | hidden in table and board | Full |
| number | number Input | blur | raw value | Full |
| url | Input plus an open-link button | blur | link without protocol or `www` | Full |
| date | DatePicker. Yearly fields use a native date input. | change | `d MMM yyyy` | Full |
| deadline | Date + time (default 23:59) + zone (AoE / UTC / My time). Shows a "Your time … in X / X ago" line. | change | `d MMM yyyy HH:mm AoE` | Full |
| select | Select | change | raw value | Full |
| rating | 5 stars. Clicking the current star clears it. | change | ★ | Full |
| checkbox | checkbox | change | "Yes" | Full |
| Change a field's type, required fields, defaults, formulas, relations, multi-select, currency, setting the `yearly` or `defaultTz` flag in the UI | — | — | — | Not present |

### 2.3 List page, views, filters

The list page lives at `/lists/:collectionId` (`CollectionPage.tsx`).

| Feature | Status | Notes |
|---|---|---|
| Breadcrumb, "Fields & statuses", "…" menu (Export BibTeX for papers, Delete list…) | Full | Delete trashes the list and its records together and shows an Undo toast. |
| Add box (title → first status) | Full | |
| Table / Board switch | Full | Saved to `defaultView`, so it persists and syncs. |
| Open item by URL (`?item=<id>`) | Full | Deep-linkable. |
| Table: Title, inline Status select, columns for all non-longtext fields | Full | Done rows are dimmed. |
| Column sort (asc → desc → off, empty values last) | **Partial** | Kept in `useState` (`views.tsx:19`), so it is not persisted. |
| Board: a column per status, HTML5 drag between columns, "Move…" select on phones, 2-value preview | Full | No reordering within a column. |
| Text search, filters (status, field, tag, hide done), group-by, saved views, bulk actions, CSV import/export, manual reorder | Not present | |
| Move a list to another section | **Not present** in the UI | `updateCollection({nodeId})` supports it and cascades to records (`repos/collections.ts:63-71`), but only a test calls it. |

### 2.4 Record sheet (`RecordSheet.tsx`)

The record sheet holds:
- the title (required, saved on blur)
- the status (labelled with `statusName`)
- one `FieldInput` per field
- Files (the `Attachments` component)
- Delete (soft delete with an Undo toast) and Done buttons

Status: **Full.**

Not present: tags on records (the `tags[]` field exists but has no UI), moving an item to another list, converting it to a task or project, duplicating it, comments, and per-record history.

### 2.5 List settings (`ListSettings.tsx`)

| Area | Behaviour | Status |
|---|---|---|
| List name | Saved on blur. | Full. The icon is not editable. |
| Statuses | Rename, a Done checkbox, remove (not allowed for the last status), Add, Undo changes, Save. Renames carry their items with them. Items in a removed status move to the first status. Empty or duplicate names are rejected. | Full. Statuses cannot be reordered. |
| Fields | Rename, move up or down, remove, choices for select (comma-separated), add a field of any of the 9 types. | Full |
| Field removal | Hides the field but keeps its values in `custom`. Re-adding creates a **new key**, so the old values do not come back. | Partial |

### 2.6 Special list behaviours

| Feature | Implementation | Status |
|---|---|---|
| AoE deadlines | `deadline` values are `{date, time, tz?}`. `deadlineInstant` uses `dueInstant`. The editor shows the time converted to local time and a countdown that refreshes every 60 s. Open items are fed to Calendar (`CalendarPage.tsx:76`), the Dashboard "Coming up" widget (`widgets.tsx:227`) and the reminders scan. | Full for display |
| Deadline and date notifications | `occasionReminders` (`domain/reminders.ts:130-142`) fires only for `yearly` fields. Non-yearly deadlines never send a notification. | **Partial** |
| Occasions and People yearly dates | `datedItems` (`domain/collections.ts:103-128`) repeats yearly dates. A same-day reminder at 09:00 reads "Today: <title> · <label>". The label is the status when the field key is `date`. | Full. There are no advance (week-before) reminders and no age or years count. |
| Course grades | `gradeSummary` (`domain/collections.ts:149-164`; UI in `CollectionPage.tsx:240-252`). Only items with weight > 0 count; an item is graded when it has a score and outOf > 0. Shows "So far X of Y marks graded (Z%)" and warns when the weights don't add up to 100. | Full. No GPA, letter grades or cross-course rollup. |
| Expenses totals | `expenseSummary` (`domain/collections.ts:135-147`; `CollectionPage.tsx:255-272`). Shows the total for the current month and per-category totals, largest first. | **Partial.** Current month only, items in "To reimburse" are counted, no currency, no budget or chart. |
| Paper DOI / arXiv import | `domain/papers.ts`. `parsePaperId` accepts a DOI, a doi.org URL, an arXiv id or URL (old and new formats), or an arXiv DataCite DOI. DOIs are looked up on Crossref; arXiv ids on DataCite (`api.datacite.org/dois/10.48550/arXiv.…`). Fills title, authors (more than 8 becomes "et al."), year, venue, link, and the abstract as summary. The button changes to "Import" when the input parses. Duplicates are detected by link on the list page only. | Full. Needs a network connection. No title search and no PDF parsing. |
| BibTeX export | `toBibTeX` (`papers.ts:134-161`). Uses @article for arXiv, @inproceedings when there is a venue, otherwise @misc. Cite keys are unique; braces are escaped. Downloads `<list>.bib`. | Full. Exports all records; you cannot pick a subset. |

---

## 3. Research / Papers

| Aspect | Detail | Status |
|---|---|---|
| Purpose | A research section (`moduleKey research`) gets a Papers board as its own list, plus a task outline. | Full |
| Add | Type a title, or paste a DOI/arXiv id to import it. | Full |
| Workflow | Status board: To read → Reading → Read → Summarized → Cited. No status counts as done, so the "open" count equals the total. | Partial (no done state) |
| Related lists | Experiments, Datasets and Conference deadlines are added through "Add a list here"; they are ranked first by `suits`. | Full |
| Export | BibTeX. | Full |
| Reading progress, PDF storage per paper, citation graph, Semantic Scholar / OpenAlex search | — | Not present. Files can be attached to a paper record. |
| Dependencies | Crossref and DataCite APIs, both allowed in the CSP `connect-src`. | — |

## 4. Thesis (`features/life/ThesisSection.tsx`, `core/repos/life.ts:36-88`)

**Data.**
- `thesisChapters`: `{title, order, targetWords (default 5000), currentWords, status outline|drafting|revising|done}`.
- `writingLogs`: `{date, chapterId, words, delta, minutes?}`.

| Feature | Status | Ref |
|---|---|---|
| Add a chapter | Full | `:160-181` |
| Rename inline, change status, edit the word goal | Full | `:100-139` |
| Delete a chapter with its logs (Undo toast, no confirm) | Full | `:145-157` |
| Log writing as the new total word count. The delta is computed; minutes are optional; an outline chapter moves to drafting automatically. | Full | `:41-95`, `life.ts:72-88` |
| Totals: words / target, %, "This week ±N", progress bar per chapter | Full | `:34-63` |
| Writing log (latest 20, in a `<details>` block) | **Partial.** Entries cannot be edited or deleted, and older entries are not reachable. | `:184-203` |
| Reorder chapters (the `order` field exists), deadlines, reminders, streaks, charts, backdating a log | Not present | `:43` uses device-local today |

## 5. Coursework / courses

| Aspect | Detail | Status |
|---|---|---|
| Purpose | Each subsection of a `coursework` section is a course. It gets an Assessments table and the "Add a task here" mode (`section-kinds.ts:33`). | Full |
| Assessments | Type, Due (deadline), Weight %, Score, Out of, Notes. Submitted and Graded count as done. | Full |
| Grade summary | See §2.6. | Full |
| Due dates | Shown on Calendar and in "Coming up". **No notification.** | Partial |
| Coursework parent page | Generic page with tasks only. There is no overview across courses. | Partial |
| Seeded Assignments, Exams & Quizzes, and Subjects sections | Siblings of Coursework, not children, so they get the generic page. | Partial |
| GPA, credits, semesters, timetable | — | Not present |

## 6. Gym & Fitness

Files: `features/life/{Gym,Workouts,RoutineWeekEditor,GymToday,GymConsistency}.tsx`, `core/domain/fitness.ts`, `core/repos/life.ts`.

**Data.**
- `routines` (Dexie v11): `{title, level?, perWeek, days[{name, exercises[], weekday?, muscles?}], byWeekday?, paused?, active?, programKey?}`. Exercises are embedded: `{name, sets, reps (string), cardio?, minutes?, weight?}`.
- `workoutSessions`: `{date, title, nodeId?, notes?, routineId?, dayIndex?}`.
- `workoutSets`: `{sessionId, exercise (free text; normalised name is the identity), reps, weight (0 = bodyweight), order, kind?='cardio', minutes?, distanceKm?}`.
- The Gym habit is a `habits` row with `source:'gym'`. Its `habitLogs` carry `status done|skipped|rest`, a note (the skip reason), `skippedAt`, `planned` and `workoutId`.
- `profile.settings.fitnessLevel`.

### 6.1 Programs and routines

| Feature | Status | Ref / notes |
|---|---|---|
| 5 built-in programs: weekday split Mon–Sat, Full body ×3, Upper/Lower ×4, PPL ×6, Athlete ×4 | Full | `fitness.ts:91-345` |
| Level picker (4 levels) saved to the profile; "Recommended for you" first | Full | `Gym.tsx:385,411-436` |
| "See the days" expander; "Use this routine" copies a program and makes it active | Full | `Gym.tsx:386-479`. Using the same program twice creates a duplicate. |
| Routines list: Active badge, level, week plan | Full | `Gym.tsx:276-341` |
| Create and edit a routine (title, days, exercises, sets/reps, target kg, cardio minutes). New routines become active. | Full | `Gym.tsx:490-702` |
| Make active (resets today's override and syncs the habit) | Full | `life.ts:173-180` |
| Pause / Resume | **Partial.** Only `active.paused` is ever read, so pausing a non-active routine has no visible effect. | `Gym.tsx:315-325` |
| Delete (soft delete, Undo) | **Partial.** It does not call `syncGymHabit`, so the Gym habit keeps its old weekdays and its 07:00 reminder. | `life.ts:232` |
| "Days a week" with Fixed weekdays on | **Non-functional UI** | `Gym.tsx:503,538-547` |
| Weekday select in the flexible editor | **Non-functional UI** (dead code) | `Gym.tsx:571-584` |
| Reorder or duplicate routines or days; reorder exercises in the flexible editor | Not present | |

### 6.2 Weekday week builder (`RoutineWeekEditor.tsx`)

| Feature | Status |
|---|---|
| Seven rows starting Monday; an empty day reads "Rest day" with a "+ Workout" button | Full |
| Day name and muscle-group chips (10) | Full |
| Copy… to another weekday (overwrites it) | Full |
| Move… to another weekday (swaps if the target is taken) | Full |
| Rest (clears the day) | Full |
| Exercise rows: name, sets, reps, kg or cardio minutes, up/down, remove | Full |
| Turning Fixed weekdays on with more than 7 days | **Partial.** Weekdays are assigned as `(i+1)%7`, so they collide. The editor shows only the first day per weekday (`:36`), while the hidden days are still saved. |

### 6.3 Today card, logging, PRs, cardio

| Feature | Status | Ref / notes |
|---|---|---|
| Day picker: weekday routines use today's weekday (−1 means rest); flexible routines take the next day after the last one done | Full | `fitness.ts:350-371` |
| Paused state: Resume or Free workout | Full | `Gym.tsx:102-121` |
| Rest day: next training day and "Train anyway…" | Full | `Gym.tsx:122-150` |
| Exercise chips, estimated minutes, Start → `/workouts/:id`, "Do a different day", Free workout | Full | `Gym.tsx:83-192` |
| "Done today. Next up" label | **Partial.** For weekday routines it shows today's workout again. | `Gym.tsx:100` |
| Skip today: reason required, writes a skipped habit log | Full | Hidden on rest days. |
| Week strip: trained / planned / today, "N of perWeek", weekly cardio minutes and km | Full | Any workout counts as trained. |
| Workout page: title, date, delete (Undo), notes | Full | `Workouts.tsx:224-448`. Changing the date or deleting the workout does not move or remove the habit's done log. |
| Planned exercises: progress, "Last time" values, prefilled reps/kg, one-tap Log set or Log cardio | Full | `Workouts.tsx:111-221` |
| Extra Add set (name suggestions) and cardio form (10 activities, minutes, km) | Full | |
| Remove a set | **Partial.** There is no Undo. | `Workouts.tsx:95-103` |
| Edit a set, rest timer, RPE, supersets, units other than kg | Not present | |
| PR detection: heaviest weight or Epley e1RM (1–12 reps). The first-ever set never counts as a PR. Cardio is excluded. | Full | `fitness.ts:4-36`. A toast and a badge are shown. |
| "Best lifts" (top 8) | Full | `Workouts.tsx:61-73` |
| Recent workouts | **Partial.** Only the latest 8. No full history, search, or Ctrl+K entry. | `Workouts.tsx:33` |
| Per-exercise charts and volume trends | Not present | |

### 6.4 Linked habit, reminders, consistency, skip history

| Feature | Status | Ref / notes |
|---|---|---|
| `syncGymHabit`: the habit's target days match the routine's weekdays (none when paused). Old targets are kept in `targetHistory`. If no habit exists, "Gym" is created with `remindAt 07:00`. | Full | `life.ts:198-223` |
| Switching to a non-weekday routine | **Partial.** By design the habit is not changed, so it keeps its old days and reminder. | `life.ts:178` |
| `GymPlanLine` in Habits and Today: planned day, muscles, Start / Skip, Done / Skipped (reason) | Full | `GymToday.tsx:22-101` |
| `checkInGym`: the first set marks habits done | **Partial.** It matches the linked habit, any habit in the same section, **and any habit title matching `/gym|workout|exercise/i`**, which is too broad. | `life.ts:329-350` |
| Reminders | Full | Fire at `remindAt` on scheduled days. Repeat every `remindEveryMin`, or the per-habit `remindRepeatMin` (0 = once). Silent during quiet hours; snooze 10/30/60; "Mark done". They only fire while the app is open. |
| Consistency: adherence for the week and month (done / skipped / missed / rest / extra) | Full | `GymConsistency.tsx:33-64` |
| Skip history: last 8 within 120 days; edit the reason | Full | `:66-100`. Un-skip is only possible from the Habits day cell. There is no analysis of reasons. |

## 7. Health

Files: `features/life/Health.tsx`, `features/life/Checkin.tsx`, `core/domain/health.ts`, `core/repos/life.ts:236-326`.

**Data.**
- `profile.settings.healthPlan`: wake, breakfast, lunch, dinner and bed times (HH:mm), `waterTarget`, `waterEveryH`, `remind{meals, water, bed}`.
- `checkins` (one per day, id `c:YYYY-MM-DD`): `sleepH, energy, waterGlasses, weightKg, meals{b,l,d}, bedTime, wakeTime, stamps{event: {at, tz, date, time, corrected?, correctedAt?}}, waterAt[]`.
- Mood is stored on the journal entry.
- Appointments are `events` with `kind:'appointment'`.

| Feature | Status | Ref / notes |
|---|---|---|
| Plan: "Set my plan" prompt; sheet with 5 times, water target and interval, 3 reminder toggles | Full | `Health.tsx:107-189,401-412` |
| One-tap timestamped logs (I'm up, each meal, Going to bed) with device time and timezone; repeat taps are ignored | Full | `life.ts:300-310` |
| Bedtime from noon onward is filed on tomorrow's check-in | Full | `health.ts:57-62` |
| Correction: edit the time; the original tap is kept ("tapped HH:mm"); clearing the time removes the log | Full | `life.ts:313-326`, `Health.tsx:41-105` |
| Tonight's bed row can be corrected | **Partial.** Correction is only possible on tomorrow's "Bed last night" row. | `Health.tsx:497-505` |
| Sleep hours computed from bed and wake times | Full | `health.ts:82-85` |
| Water + / − with a timestamp and a progress bar | Full | `life.ts:281-285` |
| Water from the Home check-in card | **Partial.** Writes only the count, not `waterAt`. | `Checkin.tsx:98-121` |
| `waterAt` timestamps shown anywhere | Not present | |
| On-time record, last 14 days (meals ±45 min, bed or wake up to 30 min late, water target met) | **Partial.** The wake stat is computed but has no row. Days are judged against the *current* plan. | `Health.tsx:520-563`, `health.ts:146-170` |
| Health reminders: meals until logged, bedtime, water slots when behind pace; Ate now / Going to bed / Had a glass; snooze; dismiss | Full | They ignore quiet hours and repeat settings (one per slot). |
| New appointment: with, reason, date, time, place, reminders 1 day and/or 2 h before; creates a 1-hour event | Full | `Health.tsx:191-351` |
| Upcoming appointments | **Partial.** Read-only here; edit them in Calendar. | |
| Past appointments (5) with notes | **Partial.** Notes overwrite `description`, which also holds the reason. | `Health.tsx:333-343` |
| Home `CheckinCard`: mood, energy, sleep, water, weight | Full | `Checkin.tsx` |
| Weekly check-in history table, previous/next week | Full | `Checkin.tsx:142-262` |
| Weekly weight average | **Partial.** Computed, but not shown. | `Checkin.tsx:186-193,257-260` |
| Timezones | **Partial.** Stamps use the device timezone; Health "today" uses the profile timezone; Checkin and Thesis use the device's local date. | |
| Charts, export, medication tracking, plan history | Not present | |

## 8. Meetings

Files: `features/meetings/{MeetingsSection,ActionItems}.tsx`, `pages/MeetingPage.tsx`, `core/repos/meetings.ts`, `core/domain/meetings.ts`.

**Data.**
- `meetings`: `{title, nodeId?, start, eventId?, attendees string[], agenda?, doc, text}`.
- Action items are `tasks` with `custom.meetingId`; `custom.followUp` marks a follow-up.
- Files are `attachments` targeting `meetings`.

| Feature | Status | Ref / notes |
|---|---|---|
| Section list: newest first, 6 then "Show all"; open item counts; future meetings shaded | Full | `MeetingsSection.tsx` |
| New meeting: starts at the current hour and reuses the last title | Full | `:35-42` |
| Open notes from a calendar event (creates or opens that occurrence's meeting) | Full | `EventSheet.tsx:96-102` |
| Meeting page: title, date and time (read-only for calendar-linked meetings), section select, agenda, rich notes, files | Full | `MeetingPage.tsx` |
| Attendees: comma-separated with People suggestions | **Partial.** Stored as plain strings, not linked to People records. | `:127-144` |
| "From earlier meetings" carry-over: open items from the same series or section, plus flagged follow-ups | Full | `domain/meetings.ts:12-34` |
| Action items: natural-language add, complete, open in the task editor, follow-up toggle, due date shown red when overdue | Full | `ActionItems.tsx` |
| Errors when adding an action item | **Partial.** Not wrapped in `attempt()`. | `ActionItems.tsx:85-108` |
| Delete a meeting (confirm, Trash, Undo; action items are kept) | Full | |
| Search or filter meetings, duplicate, export or share notes, assign owners | Not present | |

## 9. People (`pages/PeoplePage.tsx`)

| Aspect | Detail | Status |
|---|---|---|
| Implementation | A collection with the fixed id `people`, created automatically on first visit and rendered by `CollectionPage`. | Full |
| Fields | Relation (status), Birthday and Anniversary (yearly), Phone, Email, Gift ideas, Notes. | Full |
| Views | Table (sortable) and Board grouped by Relation. "Fields & statuses" can be customised. | Full |
| Reminders | Birthdays and anniversaries at 09:00 on the day. | Full |
| Delete the list | Goes to Trash; the page then offers "Restore it from Trash". | Full |
| Search, an upcoming-birthdays view, tel: and mailto: actions, meeting history per person | — | Not present |

## 10. Personal life lists

| Kind | List | Notes | Status |
|---|---|---|---|
| entertainment | Movies & series (board) | Watched and Dropped count as done. | Full |
| places | Places (table) | The map link is a URL; there is no map view. | Full / map Not present |
| trips | Trips (board) | From/To dates are on Calendar until the trip is Done. The budget is not linked to Expenses. | Full |
| dates | Occasions (table) | Yearly dates with a 09:00 reminder on the day. | Full |
| — | Date ideas | Added through the picker. | Full |
| shopping | Shopping list (board) | Change the status to tick an item off; there is no quick checkbox. | Full |
| finance / invoices | Expenses | See §2.6. | Partial |
| learning | Learning resources | — | Full |

## 11. Notes (`pages/NotesPage.tsx`, `core/repos/notes.ts:12-36`)

Notes live at `/notes` and `/notes/:noteId`. The table is `notes` with fields `{title, doc, text, nodeId?, pinned}`.

| Feature | Status | Ref / notes |
|---|---|---|
| New note, title saved on blur, rich body with "/" commands (history at most once per 10 min) | Full | `:33-147` |
| Pin / unpin; pinned notes first, then by `updatedAt` | Full | `hooks.ts:169-176` |
| Delete with Undo; a missing-note state | Full | `:96-113` |
| Filter by title or text; Ctrl+K search | Full | `:28-31` |
| Section link (`nodeId`) | **Partial.** Shown in the list, but there is no UI to set it. | `:35,83` |
| Archive, tags, sort options, attachments, a history view | Not present | |

## 12. Journal (`pages/JournalPage.tsx`, `core/repos/notes.ts:38-141`)

The table is `journalEntries`, with the fixed id `j:<date>` (one entry per day). Fields: `{date, doc, text, mood?, isPrivate, cipher?}`.

| Feature | Status | Ref / notes |
|---|---|---|
| Day navigation (previous / next / date picker / Today); future dates refused; `?date=` parameter | Full | `:46,85-110` |
| Rich entry with serialised upserts | Full | `notes.ts:49-54` |
| Mood (5 levels, toggle) | Full | `:118-138` |
| Private toggle (needs the Vault set up and unlocked; prompts to unlock inline) | Full | `:139-184`. After unlocking, the box must be ticked again. |
| Private encryption: AES-GCM with the Vault key; plaintext cleared; turning private off decrypts | Full | `notes.ts:72-80` |
| Encrypt older private entries on Vault setup or unlock | Full | `notes.ts:120-127` |
| Redact local history when an entry is made private | **Partial.** Only local `activityLog` rows are redacted. Plaintext already pushed to sync stays on the server and on other devices. | `notes.ts:107-117` |
| Decryption failure | **Partial.** The error is swallowed and the editor never appears; no message is shown. | `:59` |
| Delete with Undo (writing on that day again restores the entry) | Full | |
| Earlier entries | **Partial.** Only the newest 60; no paging. | `:206` |
| Search the journal, reminders, templates | Not present | Ctrl+K excludes private entries. |

## 13. Vault (`pages/VaultPage.tsx`, `core/crypto/{vault,session}.ts`, `core/repos/vault.ts`)

**Data.**
- `vaultMeta`: a single row with id `vault`, holding `{kdf, salt, wrapped, recoverySalt, recoveryWrapped}`.
- `vaultItems`: `{cipher (sealed {title, text, files[]}), fileIds}`.
- Encrypted file bytes are stored in `files.sealed`. They stay on the device and are not synced or backed up.

| Crypto aspect | Implementation |
|---|---|
| Key derivation | Argon2id (hash-wasm): 64 MiB, 3 iterations, parallelism 1, 32-byte output, 16-byte salt. The passphrase is NFKC-normalised. |
| Key hierarchy | A random 256-bit data key (DEK). It is wrapped by the passphrase key with AES-256-GCM, and wrapped again by a key derived from the recovery key. |
| Cipher | AES-GCM with a new 96-bit IV each time, stored as base64 `{iv, ct}`. |
| Key in memory | A non-extractable `CryptoKey` held in a zustand store. It is lost on reload. |
| Recovery key | 32 characters from an unambiguous alphabet (160 bits). |
| Minimum passphrase | 4 characters. Weak, but it is the user's choice. |
| Unlock rate limit | None beyond the Argon2 cost. |

| Feature | Status |
|---|---|
| Set up (passphrase + confirm) and a recovery-key screen (Copy, Download .txt, "I've saved" check) | Full |
| Unlock; forgot passphrase → recovery key + new passphrase | Full |
| Lock button; auto-lock after 5 minutes idle (checked every 15 s and on visibility change); locks together with App Lock | Full. The timeout is not configurable. |
| New, edit (re-encrypted on blur), search (in memory), delete with Undo | Full. Sort is fixed by `updatedAt`. |
| Attach files (25 MB each, encrypted); open or download; remove | Full |
| Change passphrase (re-wraps the key only) | Full |
| Categories, item types (password or card), copy a field, reset the Vault | Not present |
| Two devices setting up separate Vaults | **Risk.** The fixed `vault` row is merged per field with last-write-wins, so items encrypted with the losing key become unreadable. |

## 14. App Lock (`core/repos/pin.ts`, `features/vault/AppLock.tsx`, `pages/SettingsPage.tsx:679-804`)

The PIN is stored in `meta.pinLock` as `{salt, hash (Argon2id, 19 MiB, 2 iterations), afterMs}`. It is not synced or backed up.

| Feature | Status |
|---|---|
| Set a PIN (4–8 digits, entered twice) | Full |
| Gate the whole AppShell; the app starts locked | Full |
| Lock again after time hidden: right away, 1, 5 or 15 min | Full |
| Lock now (also locks the Vault); turn off (needs the current PIN) | Full |
| Back-off after wrong PINs (5 free tries, then 30 s doubling) | **Partial.** The counter is React state, so a reload resets it. |
| Forgot PIN: the Vault passphrase removes it; without a Vault, the only fix is clearing site data | Full / informational |
| Encrypt data at rest | Not present by design. App Lock is a privacy screen only. |

## 15. Settings (`pages/SettingsPage.tsx`) — every card and row

| Card | Row / control | Behaviour | Status |
|---|---|---|---|
| Workspace | Sections → `/settings/sections` | Link | Full |
| | Tags → `/settings/tags` | Link | Full |
| | Trash → `/trash` | Link | Full |
| Messages | "Show a short motivational line" checkbox | Writes `meta`, so it is not synced | Full |
| | Add message (text + section or "Anywhere") | `createMessage` | Full |
| | Delete message | Soft delete with Undo | Full |
| | Edit message | — | Not present |
| Appearance | Theme: Dark / Light / System | `useThemeStore` → localStorage `pos-theme` | Full |
| | Phone bottom bar: 3 slot selects (pages or sections) | `profile.settings.bottomTabs` | Full |
| Profile | Name | `settings.displayName`, saved on blur | Full |
| | Time zone | `profile.timezone` | Full |
| | Week starts on Monday / Sunday | `weekStartsOn` | Full |
| Account & sync | `AccountCard` | See §18. Shows "Sync isn't switched on" when the env variables are missing. | Full |
| App lock | Set a PIN / Lock now / Turn off / Lock again after | See §14 | Full |
| Backup & data | Download backup + "Last backup …" | `downloadBackup` | Full |
| | Import… (.json) → Merge or Replace dialog | `parseBackup`; Replace downloads a safety backup first | Full |
| | Export tasks CSV | `tasksCsv` (13 columns) | Full |
| | Export .ics | `toICS` | Full |
| | Erase this device → confirm | `db.delete()` | Partial: it does not sign out of Supabase, so the next sync pulls the data back |
| Storage | Persistent storage: "Protected" / "Request protection" | `navigator.storage.persist` | Full |
| | Storage used "X of Y" | Estimate | Full. The hint text "until sync arrives (M5)" is stale. |
| App | Install app / Installed / browser-menu hint | `beforeinstallprompt` | Full (iOS gets the hint only) |
| | Allow notifications | `Notification.requestPermission` | Full |
| | Remind again until done (once, 15, 30, 60, 120, 180 min) | `settings.remindEveryMin` | Full |
| | Quiet hours (from / to) | `settings.remindQuiet`, defaulting to the Health plan's bed and wake times | Full |
| | Connection | Shows Online / Offline | Full |
| | Version | `__APP_VERSION__` | Full |
| | Copy diagnostics | Copies `diagnosticsReport()` | Full |

No dead buttons. Stale copy: `SettingsPage.tsx:476`, `nav.ts:153` ("encrypted (M5)"), `write.ts:13`.

## 16. Section editor (`pages/StructurePage.tsx`, `/settings/sections`)

| Feature | Status | Notes |
|---|---|---|
| Full tree including hidden sections (dimmed) | Full | |
| Move up / down (`moveNodeStep`) | Full | No drag-and-drop. |
| Show / Hide, Edit (re-parent via NodeDialog), Add inside, New section | Full | Inline icons on desktop; a "…" menu on phones. |
| Delete | **Partial.** Deletes immediately with an Undo toast. There is no confirm, unlike NodePage. | `:48-58` |
| Set a kind or template, duplicate, multi-select, apply a template tree after onboarding | Not present | |

## 17. Tags, Trash, Sections list, More

| Feature | Detail | Status |
|---|---|---|
| Tags page (`pages/TagsPage.tsx`) | Create (colors cycle), rename inline (name normalised, unique ignoring case), change color, delete with Undo, "N tasks" count. | Full |
| TagPicker | 8 suggestions; Enter picks or creates. Used only in TaskEditor. Outline and Quick add create `#tag` automatically. | Full |
| Tag → list of its tasks, merge or nest tags, tags on records, notes or pages | — | Not present (records have an unused `tags` field) |
| Trash (`pages/TrashPage.tsx`, `core/repos/trash.ts`) | 24 trashable tables, grouped by `trashBatchId`. Restore; Delete forever (confirm); Empty trash (confirm); "days left"; auto-purge after 30 days at startup; orphan files cleaned up. | Full |
| Trash gaps | "+N" counts only sections and tasks. `pages`, `habitLogs` and `routines` show their raw table names. No search or filter. No toast after Delete forever. | Partial (minor) |
| Sections list (`/sections`, the phone tab) | Visible tree grouped by top-level section; "+" opens NodeDialog; gear icon → section editor. | Full |
| More (`/more`) | Groups of navigation rows. The "Coming soon" group can never render. | Full / Non-functional UI (harmless) |

## 18. Backup, import/export, .ics, sync, share target, PWA

### 18.1 Backup and .ics (`core/backup.ts`, `core/domain/ics.ts`)

| Feature | Status | Notes |
|---|---|---|
| JSON backup | Full | All entity tables plus `activityLog`. Envelope `{app, formatVersion 1, schemaVersion, exportedAt, appVersion, tables}`. Sets `meta.lastBackupAt`. Excludes `meta`, `files`, `outbox` and `syncSeen`. Vault and private journal content stays ciphertext. |
| Validation | Full | Zod schema; readable errors for a wrong app, newer version, unknown table or damaged file. |
| Merge import | Full | Missing records are added; the newer `updatedAt` wins. |
| Replace import | Full | A safety backup is downloaded first, then all tables are cleared. |
| Import vs sync | **Partial.** Imports use `table.put` and write no outbox entry. After the first full upload, imported records never reach the cloud unless edited later. Replace does not reset the sync cursor. | |
| Tasks CSV | Full | |
| .ics export | Full | Events (with RRULE and alarms); habits with `remindAt`; health-plan meal and bed reminders; dated open tasks; list deadlines (alarms 1 day and 2 h before); yearly date fields. Manual export only. |
| .ics import, scheduled or automatic backups | Not present | |

### 18.2 Sync / account (`core/sync/*`, `features/sync/*`, `docs/setup/SUPABASE.md`)

| Aspect | Implementation | Status |
|---|---|---|
| Config | Env names `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (fallback `VITE_SUPABASE_ANON_KEY`). Sync is off when either is missing. | Full |
| Auth | Email magic link (`signInWithOtp`, redirect to `/settings`). Onboarding offers "Sign in". There is no password or OAuth sign-in. | Full |
| Server | One table: `sync_rows(user_id, tbl, id, data jsonb, updated_at, seq)` with RLS and a sequence trigger (`supabase/migrations/20261118000000_sync.sql`). | Full |
| Triggers | Session start, every 60 s, coming back online, 3 s after the outbox changes. Runs never overlap. No realtime. | Full |
| Pull / push / merge | See TECHNICAL_ARCHITECTURE §8. | Full |
| Conflict copies | When long text (`doc, text, description, agenda`) changed on both sides, the losing copy is saved as a pinned note "Conflict copy: …". | Full |
| Private journal `cipher` conflicts | **Partial.** `cipher` is not treated as long text, so the losing edit is lost silently. | |
| Sign out (keeps local data, resets sync state); Delete my cloud data (confirm) | Full | |
| Files (attachments and Vault bytes) sync | Not present. Only metadata syncs. | |

### 18.3 Share target and PWA

| Feature | Status | Notes |
|---|---|---|
| Manifest `share_target` (GET `/share?title&text&url`) → Inbox task | Full | `taskFromShare` pulls out the URL, builds the title (max 200 characters) and the description. Undo is available; a ref guard prevents double-adds. Empty shares go to `/inbox`. |
| Sharing files or images (POST) | Not present | |
| Install button (`beforeinstallprompt` captured before render), standalone detection, iOS hint | Full | `app/pwa-install.ts` |
| Update prompt ("A new version is ready", Reload / Later; checks hourly; never reloads on its own) | Full | `app/UpdatePrompt.tsx`, `registerType:'prompt'` |
| Offline pill and full precache | Full | |
| Web Push or background notifications | Not present | Reminders fire only while the app is open. The .ics export is the workaround. |

---

## 19. Priority gap list

| # | Gap | Class | Ref |
|---|---|---|---|
| 1 | Records imported after the first sync never upload | Partial (data loss risk) | `backup.ts:96-122`, `sync/engine.ts:134-144` |
| 2 | Plaintext journal history can stay on the server after an entry is made private | Partial (privacy) | `notes.ts:107-117`, `write.ts:99-108` |
| 3 | Concurrent edits to a private journal entry: the losing edit is lost silently | Partial | `sync/merge.ts:12` |
| 4 | Separate Vault setup on two devices can make items unreadable | Risk | `vaultMeta` id `vault` |
| 5 | Deleting the active routine, or switching to a non-weekday routine, leaves the Gym habit and its reminders stale | Partial | `life.ts:178,232` |
| 6 | `checkInGym` title regex can tick off unrelated habits | Partial | `life.ts:334` |
| 7 | "Days a week" input and weekday select do nothing | Non-functional UI | `Gym.tsx:503,571-584` |
| 8 | Users cannot set a section's kind; the `updates` and `documents` tools are never wired | Not present / Partial | `NodeDialog.tsx`, `section-kinds.ts` |
| 9 | No search or filter in lists; table sort not persisted; no UI to move a list | Not present / Partial | `CollectionPage.tsx`, `views.tsx:19` |
| 10 | No notifications for non-yearly deadlines, assessments or dates | Partial | `domain/reminders.ts:130-142` |
| 11 | Expenses: current month only, includes "To reimburse", no currency | Partial | `domain/collections.ts:135-147` |
| 12 | Section delete leaves projects, goals and habits pointing at a trashed section | Partial cascade | `nodes.ts:79-104` |
| 13 | Health: wake on-time row, weekly weight average and `waterAt` timestamps are computed or stored but never shown | Partial | `Health.tsx`, `Checkin.tsx` |
| 14 | Mixed timezone sources (device vs profile) across Health, Checkin and Thesis | Partial | see §7 |
| 15 | PIN back-off resets on reload; Erase device keeps the Supabase session | Partial | `AppLock.tsx:48`, `backup.ts:203` |
| 16 | History views capped: workouts at 8, thesis logs at 20, journal at 60 | Partial | see §§4, 6, 12 |
| 17 | Meeting attendees are not linked to People | Partial | `MeetingPage.tsx:127-144` |
| 18 | No .ics import, no Web Push, file bytes never synced or backed up | Not present | — |
