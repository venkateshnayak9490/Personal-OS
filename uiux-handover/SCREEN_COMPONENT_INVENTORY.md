# Personal OS: Screen and Component Inventory

Prepared for an external UI/UX review. Everything below was read from the source code (`src/`) as it stands in the working tree; nothing is inferred from screenshots. File paths are relative to the repo root.

**Stack:** Vite + React 19 + TypeScript, Tailwind CSS 4, Dexie (IndexedDB, offline-first), Radix UI primitives (`Dialog`, `AlertDialog`, `DropdownMenu`, `Popover`), lucide-react icons, React Router, Zustand for UI state. Installable PWA.

**Breakpoints used in code:**

| Breakpoint | Where it matters |
|---|---|
| `< 768px` (no `md:`) | Phone layout: bottom tab bar, bottom sheets, larger touch targets (44px+), 15px body text |
| `md:` (≥ 768px) | Sidebar appears, BottomNav hidden, sheets become centered dialogs / side panel, denser controls (h-10 / h-8), 14px text |
| `lg:` (≥ 1024px) | Sidebar can be expanded/collapsed by the user; below 1024px it is forced to an icon rail |
| `sm:` (≥ 640px) | Used for 2-column grids in cards/widgets |

`useMediaQuery` is used in JS in three places only: `Sidebar` (`min-width: 1024px`), `HomePage` (`min-width: 768px`), `CalendarPage` (`max-width: 767px`). Everything else is CSS-only responsive.

**Design tokens referenced in classes:** `bg`, `fg`, `surface`, `surface-2`, `line`, `muted`, `accent` / `accent-fg`, `danger`, section colors `sec-self`, `sec-work`, `sec-misc`, plus a named palette (`colorFor(name)` → `{ text, dot, soft }`) in `src/lib/palette.ts`. Animations: `anim-overlay`, `anim-sheet`, `anim-pop`, `anim-rise`, `anim-check`.

**Recurring patterns (to avoid repeating per screen):**

- **Page header:** `PageHeader` (icon + 28/32px title + muted subtitle + right-side actions). Today and Home use a larger custom hero header (36px / 48px on md).
- **Loading:** `Loading` shows nothing for 250ms, then a 3-bar pulse skeleton, then after 6s a "This is taking longer than usual" empty state with a Reload button.
- **Empty states:** `EmptyState` (round icon, title, muted text, one action). Many widgets instead hide themselves completely when empty.
- **Errors:** async actions go through `attempt()`; failures show a red error toast. A crashing screen shows `RouteError` inside the app frame.
- **Undo:** destructive or bulk actions show an inverted snackbar toast with **Undo** (6s, 4s without undo).
- **Hover-only controls:** on desktop many row actions (⋯ menus, delete X) are `md:opacity-0 md:group-hover:opacity-100`; on phones they are always visible.
- **Save model:** almost all editors save on change/blur; there are few explicit Save buttons.

---

## 1. App frame (global, present on every in-app route)

**File:** `src/app/AppShell.tsx`. Wraps all routes except `/welcome`.

| Element | Detail |
|---|---|
| Guard | If no profile → redirect to `/welcome`. While DB opens → renders nothing. Whole frame wrapped in `AppLockGate` (PIN). |
| Layout | `flex min-h-dvh`: Sidebar (desktop) + `<main>` with centered content column `max-w-5xl`, `px-4` phone / `md:px-8`. Phone gets bottom padding for the tab bar plus safe-area insets. Scrolls to top on route change. |
| Keyboard | `Ctrl/⌘+K` toggles Command Palette (works while typing). `N` (outside inputs/dialogs) opens the New task sheet. |
| Always-mounted overlays | `NewTaskSheet`, `CommandPalette`, `TaskEditor`, `NodeDialog`, `Reminders`, `FocusTimer`, `VaultAutoLock` (no UI), `SyncRunner` (no UI), `UpdatePrompt`, `Toaster`. |

### 1.1 Sidebar (desktop/tablet, ≥ 768px)

**File:** `src/app/Sidebar.tsx`

- **Visibility:** `hidden md:flex`, sticky, full height, right border.
- **Modes:** 768–1023px is always a 64px **icon rail**. ≥ 1024px: expanded (user-resizable width 200–420px, default 256) or user-collapsed rail. Collapse button (PanelLeftClose) in header; expand button at the bottom when collapsed.
- **Resize handle:** invisible 8px strip on the right edge (`role="separator"`), drag, arrow keys (±16px), double-click resets to 256.
- **Header:** app logo + "Personal OS".
- **Action row:** primary **New task** button with `N` kbd hint (icon-only when collapsed); square **Search** button (opens palette, `Ctrl+K`).
- **Nav groups (top to bottom):** Primary (Home, Today, All Tasks, Inbox with open-count badge, Projects, Goals, Habits, Focus with live countdown badge, Calendar, People) → **Sections** label with `+` (new section) → user's section tree (indented 14px/level, colored icon, hover shows "Hide" eye-off button, chevron expand/collapse for children) → **Hidden (n)** disclosure listing hidden sections with an Eye "Show" button → **Tools** (Reviews, Analytics) → **Private** (Notes, Journal, Vault) → **Coming soon** disclosure (currently empty since all items are built) → footer: Settings, Trash.
- **States:** active item `bg-surface-2 font-medium`; hover `bg-surface-2/60`; collapsed items show `title` tooltip. Group labels become thin dividers in rail mode.
- Hiding a section shows a toast with Undo.

### 1.2 Bottom navigation (phone, < 768px)

**File:** `src/app/BottomNav.tsx`

- Fixed bottom, solid background (no blur, deliberately), `h-16`, safe-area padding, `md:hidden`.
- **Five slots:** tab 1, tab 2, centered round **＋ New task** FAB (48px, accent, shadow, scale on press), tab 3, **More** (fixed).
- Tabs 1–3 are user-choosable (Settings → Phone tabs); default Home, Today, Tasks. Choices: any built screen, the "Sections" list, or any individual section.
- Active tab: `text-fg` + thicker icon stroke; inactive `text-muted`. A specific section tab wins over the generic Sections tab. If no tab matches, **More** is active.

### 1.3 Command palette

**File:** `src/app/CommandPalette.tsx` · Opens via `Ctrl/⌘+K`, sidebar Search button.

- Radix Dialog, top-anchored (`top-[12vh]`), `max-w-xl`, rounded-2xl, dim overlay (no blur).
- Search input (h-14, "Search, jump to a section, or type a task to add it") + `Esc` kbd.
- **Empty query:** groups "Go to" (primary screens, Settings, Trash, Edit sections, Tags), "Actions" (New section), "Sections" (top-level sections).
- **With query:** grouped results (max 8 per group): Tasks, Sections, In pages (section page text with snippet), Lists, In lists (records), Meetings, Notes, Journal (non-private only), Go to, and always a final **"Add task: …"** action that parses natural language (date, `#tag`, `!priority`, `@section`).
- Keyboard: ↑/↓ cycle, Enter runs. Mouse hover moves the active item. Active row has `bg-surface-2` and a ↵ icon; closed tasks / hidden sections are muted.
- `role="combobox"` + `listbox`/`option` ARIA.

### 1.4 New task sheet

**File:** `src/features/tasks/TaskComposer.tsx` (`NewTaskSheet`, `TaskComposer variant="sheet"`). Opens from FAB, sidebar button, `N`, setup checklist.

- `Sheet` (bottom sheet on phone, centered dialog on desktop), title "New task".
- Large borderless title input ("What needs doing?") + round accent submit arrow (disabled until text).
- **Understood:** live parse preview chips (date/time/AoE, repeat rule, priority, tags, → section), each with an X to "treat as plain text".
- **Chips row:** Section (native `<select>` disguised as a chip with color dot), Today, Tomorrow, Date (opens `DatePicker`), clear-date X, Priority (native select chip with colored flag).
- After add: stays open, live region shows "✓ Added to X, due … Type the next one." Default section/due follow the current page context (`useComposerContext`).

### 1.5 Task editor (side panel)

**File:** `src/features/tasks/TaskEditor.tsx` · Opens by clicking any task row, palette result, reminder "Open", Coming up widget.

- `Sheet variant="side"`: full-height right panel `max-w-xl` on desktop, bottom sheet on phone. Title "Task" / "Subtask". Auto-closes if the task is deleted.
- **Content (all save on change/blur):** priority-colored check circle + auto-growing title textarea (Enter blurs/saves); Status select + Section select (2-col); Priority 4-way segmented radio (P1 red, P2 orange, P3 sky, none); Due date (`DatePicker` + `DateButton`), Due time (only once a date exists), Time zone for deadline (My zone / AoE) ; Repeat select (presets + custom rule label, hint "When you close this one, the next one appears."); Project select (only if projects exist); Tags (`TagPicker`); Notes textarea; Files (`Attachments`); Subtasks (checklist with hover-delete X and inline "Add a subtask" input; top-level tasks only); **More details** `<details>`: Start date, Type, Estimate (minutes); **History** timeline (first 3 + "Show all n").
- **Footer actions:** Focus 25 min (open tasks; starts timer and navigates to /focus), Duplicate (opens the copy), Delete (ghost, danger text).
- Selecting status "Skipped" opens the **Skip dialog**.

### 1.6 Skip task dialog

**File:** `src/features/tasks/SkipDialog.tsx` · Sheet "Skip task", description about honest recording, optional Reason input, footer Cancel / Skip (primary).

### 1.7 Section create/edit dialog (NodeDialog)

**File:** `src/features/structure/NodeDialog.tsx` · From sidebar `+`, Sections page `+`, section page actions, Section editor, palette.

- Sheet "New section" / "Edit section"; footer Cancel / Create|Save (disabled with empty name).
- Fields: Name; Inside (parent select, top level option, excludes self/descendants, marks hidden); Color (swatch circles with check + ring when selected, plus "Same as parent" pill with inherited dot when a parent is set); Icon grid (8 cols, 10 on `sm:`; selected icon gets accent border and soft color fill).
- Create shows a toast with Undo.

### 1.8 Reminders stack

**File:** `src/features/reminders/Reminders.tsx`

- Fixed bottom-right stack, max 3 cards, `w-[min(22rem,100%-2rem)]`; on phone sits above the tab bar, on desktop `bottom-4`.
- Card: bell icon, title, sub-line ("Due · 3:00 PM", "Habit · …", "Health · …", "Starts in 5 min · …", "Now · …", "Was at …"), one ghost action button whose label depends on type: **Open** (task/event/occasion), **Mark done** (habit), **Had a glass** / **Going to bed** / **Ate now** (health plan), plus dismiss X. `role="alert"`, `anim-rise`.
- Also sends a system notification if permission granted and the app is in the background.

### 1.9 Focus timer pill

**File:** `src/features/focus/FocusTimer.tsx` · Phone only (`md:hidden`), fixed bottom-left above the tab bar, shows `mm:ss` while a session runs; hidden on `/focus`. On desktop the countdown appears as the Focus sidebar badge (`FocusBadge`). Ending a session shows a toast and a system notification.

### 1.10 Toasts and update prompt

- **Toaster** (`src/app/toast.tsx`): bottom-center, above tab bar on phone / `bottom-6` on md. Inverted (`bg-fg text-bg`) snackbar, error variant red with alert icon. Optional **Undo** button, dismiss X. Max 2 visible. 4s (6s with Undo).
- **UpdatePrompt** (`src/app/UpdatePrompt.tsx`): "Offline — everything still works on this device" pill when offline; "A new version is ready." snackbar with **Reload** / **Later**.

### 1.11 PIN lock screen

**File:** `src/features/vault/AppLock.tsx` · Shown instead of the whole app when a PIN is set and the app is locked (on start or after being backgrounded longer than the chosen time; also locks the Vault).

- Full-screen, centered `max-w-xs`: lock icon, "Personal OS is locked", password-type numeric PIN input (digits only, max 8, large letter-spaced centered text), **Unlock** (disabled < 4 digits or during back-off).
- **Error:** "Wrong PIN. Try again in N s." with an increasing wait after each failure.
- **Forgot your PIN?** → if a Vault exists: passphrase input, "Remove PIN" (busy "Checking…"), Back, error "That passphrase didn't work." If no Vault: explanatory text (clear site data, restore backup) + Back link.
- Renders nothing while the PIN setting loads (never flashes the app).

### 1.12 Route error

**File:** `src/app/RouteError.tsx` · Inside the app frame when a screen throws: warning icon, "This screen couldn't load", reassurance copy, error message in a `pre` block, **Reload** (primary), **Copy details** (→ "Copied"), "Go to Today" link.

---

## 2. Screens

Route map (`src/app/routes.tsx`): fixed pages come from `src/app/nav.ts`; `/` is Today (index route). All in-app routes render inside the App frame (section 1). `PlaceholderPage` exists as a fallback for nav items without a built screen, but every nav item is currently built.

| Route | Screen | File |
|---|---|---|
| `/welcome` | Onboarding (outside app frame) | `src/pages/OnboardingPage.tsx` |
| `/home` | Home map | `src/pages/HomePage.tsx` |
| `/` | Today | `src/pages/DashboardPage.tsx` |
| `/tasks` (`?view=week` / `upcoming`) | All Tasks | `src/pages/TasksPage.tsx` |
| `/inbox` | Inbox | `src/pages/InboxPage.tsx` |
| `/projects`, `/projects/:projectId` | Projects, Project page | `src/pages/ProjectsPage.tsx`, `ProjectPage.tsx` |
| `/goals` | Goals | `src/pages/GoalsPage.tsx` |
| `/habits` | Habits | `src/pages/HabitsPage.tsx` |
| `/focus` | Focus | `src/pages/FocusPage.tsx` |
| `/calendar` | Calendar (lazy-loaded) | `src/pages/CalendarPage.tsx` |
| `/people` | People | `src/pages/PeoplePage.tsx` |
| `/reviews` (`?period=&offset=`) | Reviews | `src/pages/ReviewsPage.tsx` |
| `/analytics` | Analytics | `src/pages/AnalyticsPage.tsx` |
| `/notes`, `/notes/:noteId` | Notes, Note page | `src/pages/NotesPage.tsx` |
| `/journal` (`?date=`) | Journal | `src/pages/JournalPage.tsx` |
| `/vault` | Vault | `src/pages/VaultPage.tsx` |
| `/settings` | Settings | `src/pages/SettingsPage.tsx` |
| `/settings/sections` | Section editor | `src/pages/StructurePage.tsx` |
| `/settings/tags` | Tags | `src/pages/TagsPage.tsx` |
| `/trash` | Trash | `src/pages/TrashPage.tsx` |
| `/s/:nodeId` | Section page (varies by kind) | `src/pages/NodePage.tsx` |
| `/lists/:collectionId` (`?item=`) | List page | `src/pages/CollectionPage.tsx` |
| `/meetings/:meetingId` | Meeting page | `src/pages/MeetingPage.tsx` |
| `/workouts/:workoutId` | Workout page | `src/features/life/Workouts.tsx` |
| `/sections` | Sections list (phone tab) | `src/pages/ListPages.tsx` |
| `/more` | More (phone tab) | `src/pages/ListPages.tsx` |
| `/share` | Share target | `src/features/share/SharePage.tsx` |
| `*` | 404 | `src/pages/ListPages.tsx` |

---

### 2.1 Onboarding

- **Route:** `/welcome`. Shown automatically when no profile exists (AppShell redirects). If a profile exists it redirects to `/`.
- **Purpose:** first run in one screen; two optional questions that pick starter sections.
- **Layout:** full page, no app frame, single centered column `max-w-md`, generous top padding with safe-area.
- **Content:** logo (48px), hero headline (40px / 48px md), muted intro ("Two quick questions, both optional…").
- **Form:** "What should we call you?" underlined borderless input (text-xl); "What do you do?" fieldset of toggle pills (`aria-pressed`, filled `bg-fg` with a check when on; "Something else" for `other`).
- **Actions:** **Get started** (primary, h-12, full width; disabled + "Setting up…" while saving). Footnote "You can rename, add or remove anything later."
- **Secondary:** when sync is configured, a `<details>` card "Already use Personal OS on another device? Sign in" containing `AccountCard`.
- **States:** saving/disabled; errors via toast.
- **Files:** `OnboardingPage.tsx`, `features/sync/AccountCard.tsx`, `core/domain/templates.ts` (PROFILE_OPTIONS).

### 2.2 Home (section map)

- **Route:** `/home` (sidebar "Home", default phone tab 1).
- **Purpose:** all sections as one connected tree ("you → areas → subsections") + daily check-in.
- **Header:** muted date, large "Home" title (36px / 48px md, `font-display`). No PageHeader.
- **Map:** root pill with the user's name → connector line → area cards. Each area card: colored left bar, colored icon, bold name, "n open" count; below it a nested `Branch` tree (`ul` with left border and tick connectors) of subsections with icon + count.
- **Responsive (JS `useMediaQuery(min-width:768px)`):** desktop lays areas out in equal columns (`repeat(n, 1fr)`) with a horizontal connector bar and drop lines; phone stacks areas vertically along a left trunk line with ticks. Row heights 44px phone / 36px md. Note: with many top-level areas, desktop columns get narrow (no wrap).
- **Check-in card** (`CheckinCard`, `features/life/Checkin.tsx`): bordered card, `sm:grid-cols-2`. Mood radio pills, Energy radio pills (Drained…Full; tap again to clear), "Sleep last night (hours)" number (saves on blur), Water glasses −/+ stepper (− disabled at 0), Weight (kg) number. Everything saves immediately.
- **States:** `Loading` until tree is ready. No dedicated empty state.

### 2.3 Today (dashboard)

- **Route:** `/` (sidebar "Today", default phone tab 2).
- **Purpose:** tasks due today/overdue/in progress, habits, events, upcoming, projects.
- **Header:** muted long date; greeting by hour ("Working late / Good morning / afternoon / evening, Name") at 36px / 48px md; one-sentence summary ("2 tasks for today, 1 overdue and 1 in progress." or "Nothing is due today…"); `MotivationLine` (one dismissible muted line, hidden if turned off in Settings).
- **Conditional cards (top):**
  - `SetupChecklist` "Finish setting up": progress bar, "n of m done. All optional.", **Hide**; accordion steps with round check (done = filled + strikethrough, disabled). Steps: Add research areas / Add courses (inline comma list + Add; only if those template sections exist), Add your first task (New task), Make the sections yours (Edit sections link), Install on this device (Install button or Chrome instructions), Download a backup. First undone step auto-expands.
  - `ReviewNudge`: on the last/first day of a week if unreviewed, a bordered link card "The week ends today. Take five minutes for your weekly review." → `/reviews?period=week&offset=…`.
  - Backup reminder (when setup is hidden and no backup in 7 days, or never with ≥5 tasks): card with icon, copy, **Download backup**; stacks vertically on phone, row on `sm:`.
- **Widgets (user-orderable/hideable, per device):**
  - **Today's events** (hidden if none): bordered list, time column (or "All day"), title, location with pin; past items 50% opacity; "Now" badge for current; link "Calendar".
  - **Today's tasks:** heading "Today", inline `TaskComposer` (due-today preset, "Add a task for today"), `TaskList` with filters hidden, section labels shown; empty text explains what appears here.
  - **Habits today** (hidden if no habits due): grid `sm:2 / lg:3` columns of habit cards with a large `DayCell` toggle, title, "n/m this week", flame streak; link "All habits".
  - **Coming up** (hidden if empty): next 7 days of tasks, events and list deadlines (deadline rows have a red flag icon, events a calendar icon), max 8 rows; tasks open the editor, deadlines navigate to the list item; event rows are disabled buttons. Label "Next 7 days".
  - **Active projects** (hidden if none): `sm:grid-cols-2` cards with title, %, `ProgressBar`; link "All projects".
- **Bottom:** ghost **Customize Today** button → **Customize Today sheet**: checkbox per widget + up/down arrow buttons (disabled at ends); footer **Done**. Saved per device.
- **States:** `Loading` until tasks + tree ready.
- **Files:** `DashboardPage.tsx`, `features/dashboard/widgets.tsx`, `features/habits/HabitsToday.tsx`, `features/setup/SetupChecklist.tsx`, `features/analytics/ReviewNudge.tsx`, `features/messages/MotivationLine.tsx`.

### 2.4 All Tasks (and its views)

- **Route:** `/tasks`, `/tasks?view=week`, `/tasks?view=upcoming`.
- **Header:** PageHeader "All Tasks", "Every task from every section."
- **Composer:** inline `TaskComposer` targeting the filtered section (so new tasks don't vanish behind the filter).
- **Filter bar (wraps):** segmented tabs **All / This week / Upcoming** (`role=tablist`, selected = raised `bg-surface` + shadow); Section select (All sections, Inbox (no section), indented tree); Tag select (only if tags exist).
- **All view:** `TaskList` with status filter tabs (Open / Completed / Skipped / All, with counts) and section labels.
- **This week view:** day groups: "Overdue" (red heading) then every remaining day of the week, each with date hint and count; empty days show "Free".
- **Upcoming view:** a group for every later date with something due; empty → "Nothing due after today. Give a task a date and it shows up here."
- **States:** `Loading` while tasks load; TaskList empty state "All clear" / "Nothing here".

### 2.5 Inbox

- **Route:** `/inbox` (sidebar shows open-count badge).
- **Content:** PageHeader "Inbox" / "Capture anything fast, sort it into a section later."; inline composer without section chip (placeholder demonstrates syntax: `submit review fri 5pm #thesis !high`); `TaskList sortable` → each open row gets a small **Move to…** section select.
- **Empty:** "Inbox zero. Anything you add without a section lands here."

### 2.6 Projects list

- **Route:** `/projects`.
- **Header action:** **New project** (primary, sm) → reveals an inline bordered form (icon, autofocus input, Escape cancels, **Create** disabled while empty); creating navigates to the new project.
- **List:** groups Active / Planned / On hold / **Finished** (collapsed disclosure, completed + cancelled), each with count. Each group is a bordered divided list; row = 3-col grid: title (cancelled = strikethrough) + meta (section dot + name, "Goal: …", "Due …") | `ProgressBar` with "done/total", "%" (manual) or "No tasks yet" | chevron. Row hover `bg-surface-2/60`.
- **Empty:** EmptyState "No projects yet" with explanation and New project button.
- **Responsive note:** the row grid is fixed `1fr 9rem 1.25rem` at all widths (no phone variant).

### 2.7 Project page

- **Route:** `/projects/:projectId` (from Projects rows, Today "Active projects", Goal chips).
- **Layout:** back link "← Projects"; inline-editable title input (36px, saves on blur/Enter); progress bar (h-2) with "% · n of m"; properties grid `2 cols → lg:5 cols`: Status, Section (`SectionSelect`), Goal, Due date (`DatePicker`), Progress from (Tasks / Milestones / Set by hand). Manual mode adds a range slider (step 5) labelled "Progress: n%".
- **Body:** `lg:grid-cols-[1fr_18rem]` (stacked below lg): **Tasks** (inline composer linked to project, `TaskList`) | aside with **Milestones** (square checkboxes, hover-reveal delete X, inline "Add a milestone" input), **Notes** textarea (save on blur), ghost danger **Delete project**.
- **Dialog:** `Confirm` "Delete "X"?" → "Move to Trash" (danger) → toast with Undo, navigates back.
- **Not found:** EmptyState "This project doesn't exist" + link to Trash.

### 2.8 Goals

- **Route:** `/goals`.
- **Header:** "Goals" / "Small long-term goals, built by your habits and projects." + **New goal**.
- **Goal cards** (bordered; achieved/dropped at 70% opacity, dropped strikethrough): title, meta "Status · Section · by date", optional "why"; a pencil icon button opens a Menu (Edit, Mark achieved, separator, Delete danger → toast with Undo). Progress row: `ProgressBar` + either "current/target label" (habit-counted), −/+ steppers for manual measures, or "n% across k projects" / "Link a project or add a measure". Chip links to linked projects (with %) and linked habits (30-day consistency %, flame streak).
- **Goal ideas:** "Goal ideas that grow from your habits" (sparkles icon) list of preset suggestions not yet added, each with **Add** → opens sheet prefilled.
- **Goal sheet (New/Edit goal):** Goal input; Why it matters textarea; Section + Target date (2-col); fieldset "Measure it (optional)": what you count / current / target (current disabled when counted from habits), checkbox "Count each check-in of the habits below", hint; fieldset "Habits that build this goal" toggle pills; Status select (edit only). Footer Cancel / Create|Save (disabled without title).
- **Empty:** EmptyState "No goals yet" only when there are also no suggestions left.
- **Note:** the per-goal options trigger uses a pencil icon although it opens a multi-item menu.

### 2.9 Habits (+ history sheet)

- **Route:** `/habits`.
- **Header:** "Habits" / "Tap a day to check in. Tap again for skipped, then rest day." + **New habit**.
- **Week grid card:** header row of 7 weekday initials + dates (today bold). Each habit row:
  - Phone: 2-col grid; title/meta button on row 1 with the ⋯ menu at right; 7 `DayCell`s span row 2; "n/m this week" shown in meta (`md:hidden`). The "Habit" and "This week" column headers are hidden.
  - Desktop (`md:grid-cols-[1fr_auto_6rem_2.5rem]`): Habit | 7 day cells | "This week" n/m (turns `text-sec-self` when met) | menu.
  - Meta: target label, flame streak ("3 days" / "2 weeks"), "n% last 30 days", bell + reminder time.
  - **DayCell** cycles empty → done (filled, check) → skipped (dashed border, minus) → rest (moon, only if allowed) → empty. Unscheduled days 40% opacity; today has a stronger border.
  - Row menu (⋯): History, Edit, Delete (toast + Undo). Tapping the title also opens History.
- **Suggested for you:** preset habits with **Add** (prefills sheet, auto-assigns matching section).
- **Habit sheet (New/Edit habit):** Habit name; How often (Every day / A number of times a week / On specific days); Times a week (1–7) or Mon–Sun toggle buttons; Remind me at (time); What counts (textarea); Section + Counts toward goal (2-col); checkbox "Allow rest days (they don't break your streak)". Footer Cancel / Create|Save (disabled if invalid).
- **History sheet** (`HabitDetail`): title = habit, description = target label; note; 4 stat tiles (`grid-cols-2 sm:grid-cols-4`): Streak, Last 30 days, Last 90 days, Done in total; 20-week binary `Heatmap`; reminder note.
- **Empty:** "No habits yet" (only when suggestions are also exhausted).

### 2.10 Focus

- **Route:** `/focus`.
- **Header:** "Focus" / "Timed blocks of deep work. Only time you actually focused counts."
- **Timer card** (rounded-3xl, centered):
  - **Idle:** length radio pills 25 / 50 / 90 min + custom minutes number input; task select ("No particular task" + open tasks); **Start N min** (primary).
  - **Running:** "Task · until HH:mm", huge `text-7xl` countdown (`role=timer`), **Stop and save** (primary), **+ 5 min**, ghost **Discard**. Stop toasts "Saved Xh Ym of focus" or "Under a minute: not saved".
- **Deep work:** "Today X · This week Y"; 7-day bar chart (div bars, empty days grey, title tooltips, weekday initials); per-top-section minutes this week.
- **Recent sessions** (if any): up to 15 rows: time, task (clickable → editor) or "No particular task", duration, delete X (toast + Undo).
- Elsewhere in the app a running session shows as the phone pill / sidebar badge (section 1.9).

### 2.11 Calendar

- **Route:** `/calendar` (lazy-loaded; shows `Loading` while the FullCalendar chunk loads).
- **Purpose:** events, dated tasks, list dates/deadlines and meetings on one calendar.
- **Header:** "Calendar"; subtitle "Events and dated tasks together." (+ " Drag on the calendar to add an event." on desktop); **New event** (primary, sm; prefilled to the next whole hour, 1h).
- **Calendar (FullCalendar)**, container height `max(36rem, 100dvh − 12rem)`, custom `.pos-cal` styling:
  - **Desktop:** default Week (time grid). Toolbar: prev/next/Today left, title center, Month/Week/Day right.
  - **Phone (JS `max-width: 767px`):** default **3 days** view. Title + arrows on top; Today and Month / 3 days / Day switch in a **footer toolbar** near the thumb. The calendar remounts when crossing the breakpoint.
  - Now indicator, scroll to 08:00, "+n more" in month cells (`dayMaxEvents`), week starts per profile.
  - **Item rendering:** events = colored dot (section color); tasks = small square checkbox outline (filled when done), class `pos-cal-task` (+ `is-done`); list dates = flag icon; meetings = dot. Time-grid items show title + time on two lines.
  - **Interactions:** drag/resize events (not repeating ones) and tasks (changes due date/time); list items and meetings are not draggable. Click: task → Task editor; meeting → meeting page; list date → list item; event → Event sheet (edit). Drag-select empty time → Event sheet (create); single click on a month day → create at 09:00 for 1h.
- **Event sheet** (`features/calendar/EventSheet.tsx`): title "New event" / "Edit event". Event name; **All day** checkbox; Date (or From/To when all-day) via DatePicker, Starts/Ends times (start change keeps duration); grid is 3-col on `sm:`, stacked on phone. Inline error "The end must be after the start." Repeat select (presets + custom label), Reminder select (No reminder … 1 day before; default 10 min for timed), Section, Where, Notes. Footer: ghost danger **Delete** (left, edit only, toast + Undo), ghost **Meeting notes** (edit only; opens/creates a meeting for that occurrence), Cancel, Create/Save (disabled until valid).

### 2.12 People

- **Route:** `/people`.
- **Purpose:** an app-wide "People" list (birthdays, anniversaries, gift ideas). It is a regular list rendered with `CollectionPage` (see 2.27), created automatically on first visit from the `people` template.
- **States:** `Loading` while creating; if the list is in Trash: EmptyState "Your People list is in Trash" + "Restore it from Trash" link.
- **File:** `src/pages/PeoplePage.tsx`.

### 2.13 Reviews

- **Route:** `/reviews`, deep-linkable with `?period=week&offset=-1` (from the Today nudge).
- **Header:** "Reviews" / "Look back with real numbers, then decide what's next."
- **Period bar:** segmented Day / Week / Month / Year (full width on phone via `max-md:w-full`); prev/next arrows (next disabled at current; arrows enlarge to 40px on phone) around the period label (`max-md:flex-1`); **Back to now** when offset ≠ 0.
- **Summary card:** heading "So far" or "As it was when you wrote this" (frozen snapshot for past saved reviews); 4 stats (`grid-cols-2 sm:grid-cols-4`): Completed, Completion rate (+ "n skipped · n missed"), Deep work, Habits %; per-section completed counts line; `<details>` "What you completed" list.
- **Form:** one Textarea per review question for the period type (from `REVIEW_QUESTIONS`); **Save review** (primary) + "Saved <timestamp>". Form remounts per period.
- **Past reviews:** "Past week reviews" list: period label, first answer (truncated), "n done · rate"; click jumps to that period.
- **States:** `Loading` while data loads.

### 2.14 Analytics

- **Route:** `/analytics`.
- **Header:** "Analytics" / "Only completed counts as done. Skipped and missed are shown, never hidden."
- **Period bar:** Week / Month / Year segmented + prev/next + Back to now (same pattern as Reviews).
- **Scope breadcrumb:** "Everything › Section › Subsection" (drill-down; current item bold).
- **Stat tiles** (`grid-cols-2 md:grid-cols-4`): Completed, Completion rate (+ skipped/missed hint), Deep work, Habits (+ "n of m done" / "No habits here").
- **Bar chart** "Tasks completed per day/month": div bars, hover tooltip via `title`, labels thinned when > 12 bars, "Highest: n" or "Nothing completed in this period."
- **Heatmap** "Last 12 months" (53 weeks, 5-step scale, legend Less → More).
- **By section table:** Section (button, drills into scope), Completed, Rate, Deep work.
- **Habits:** per habit "done of target · streak" + ProgressBar.
- **States:** `Loading`; empty bar chart text. Table has no horizontal-scroll wrapper on phone (4 narrow columns).

### 2.15 Notes and note page

- **Routes:** `/notes` (list, "Pick a note") and `/notes/:noteId` (same component with the note open). Reached from sidebar, palette search results.
- **Header:** "Notes" / "Ordinary notes. Everything here is searchable with Ctrl+K." + **New note** (creates and navigates).
- **Layout:** `md:grid-cols-[16rem_1fr]`: left list, right editor. **On phone the list and the open note stack** (list first, editor below) — there is no separate phone detail view.
- **List:** filter input with search icon; rows: pin icon, title (or derived), relative time + section; selected `bg-surface-2` + `aria-current`. Empty: "No notes yet." / "No match."
- **Note view:** large borderless title input (save on blur, autofocus if empty), Pin/Unpin and Delete icon buttons (delete → toast with Undo, back to /notes), `RichEditor` (see 3.x) with "Saving…/Saved" indicator.
- **Empty / not found:** EmptyState "Pick a note — Or start a new one." / "This note doesn't exist — It may have been deleted. Check the Trash."

### 2.16 Journal

- **Route:** `/journal`, `/journal?date=YYYY-MM-DD` (from palette results). Future dates are not allowed.
- **Header:** "Journal" / "A quiet place to write. One page a day."
- **Layout:** `md:grid-cols-[1fr_15rem]` (aside drops below on phone).
- **Day bar:** prev day arrow, DatePicker date button (w-52), next arrow (disabled on today), **Today** button when not on today.
- **Entry:** long date heading; Mood radio pills (Rough…Great, tap to clear); **Private** checkbox with lock icon; ghost **Delete entry** (toast + Undo) when an entry exists.
- **Private flow (Vault-dependent):** ticking Private without a Vault shows a bordered notice "Private entries are encrypted with your Vault. Set up the Vault first…" (link to /vault); without the Vault unlocked shows an inline compact `UnlockForm` ("Unlock the Vault to make this entry private."). A private entry while locked shows "This entry is private. Unlock the Vault to read and write it." + compact unlock form instead of the editor. Unlocked private entries show a muted explanation line.
- **Editor:** `RichEditor` ("How was today? What's on your mind?").
- **Aside "Earlier entries":** up to 60 entries: date, mood, preview (or lock + "Private"); selected highlighted. Empty: "Nothing yet."

### 2.17 Vault (setup / recovery key / locked / unlocked)

- **Route:** `/vault`. File: `src/pages/VaultPage.tsx` (+ `features/vault/Unlock.tsx`).
- **Header:** "Vault" / "Encrypted on this device with your passphrase. Without it, nobody can read what's here, including us." When unlocked, a **Lock** button sits in the header actions.
- **State machine (one screen, four bodies):**
  1. **Setup** (no vault yet): `max-w-md` form: explanatory copy, Passphrase + "Type it again" (password inputs; inline hints "At least 10 characters." / "They don't match yet."), bordered warning about losing passphrase + recovery key, **Create Vault** (disabled until valid; "Creating…").
  2. **Recovery key** (right after setup): "Your recovery key" (shield icon), copy, large monospace `code` block (select-all), **Copy** (toast "Copied"), **Download as a file**, checkbox "I've saved my recovery key", **Open the Vault** (disabled until ticked).
  3. **Locked:** `UnlockForm`: password input "Vault passphrase", **Unlock** ("Unlocking…" while Argon2 runs ~1s), error "That passphrase didn't work.", link "Forgot the passphrase?" → **Recover** form: Recovery key input, New passphrase (min-length hint), error "That recovery key didn't work.", **Set new passphrase** ("Checking…"), Back.
  4. **Unlocked (Items):** `md:grid-cols-[16rem_1fr]` (stacks on phone). Aside: full-width **New item** (primary), Search input, item list (title, "n files" / text preview / "Empty"; selected `bg-surface-2`), small "Change passphrase" link → inline form (Current, New (10+), error, Change / Cancel). Main: **Item editor**: title input (save on blur; autofocus for new), delete icon (toast "Moved to Trash (still encrypted)" + Undo), monospace Textarea (min-h-40, save on blur), file rows (open/download, remove X), ghost **Add file** + "encrypted before it's stored · up to 25 MB". Empty: "Pick an item." / "Nothing here yet. Good for ID scans, certificates, policy numbers and private notes."
- The Vault also auto-locks (`VaultAutoLock`, no UI) and locks with the app PIN.

### 2.18 Settings

- **Route:** `/settings`. File: `src/pages/SettingsPage.tsx`.
- **Layout:** PageHeader "Settings"; a vertical stack of groups, each a small muted `SectionTitle` (icon + label) above a `Card`. Rows use `SettingRow`: label + hint on the left, control on the right on `sm:`+; **stacked (control below) on phone**.
- **Cards, in order:**
  1. **Workspace:** link rows (icon, label, hint, chevron, min-h-14): Sections → `/settings/sections`; Tags → `/settings/tags`; Trash → `/trash`.
  2. **Messages:** checkbox "Show a short motivational line under Today and section titles"; when on: add-your-own form (text input + `SectionSelect` "Anywhere" + **Add**; stacks on phone), list of own messages with delete icon (toast + Undo).
  3. **Appearance:** Theme segmented radio Dark / Light / System (icons); **Phone bottom bar**: three selects (tab 1–3; options include "Section: X"), stacked on phone, row on `sm:`.
  4. **Profile:** Name (save on blur), Time zone select, Week starts on (Monday/Sunday). Inputs fixed `w-56`.
  5. **Account & sync** (`AccountCard`): (a) not configured: cloud-off icon + "Sync isn't switched on…"; (b) signed out: copy + email input + **Email me a sign-in link** (disabled until valid email) → "Check your email…"; (c) signed in: cloud icon, email, live status ("Syncing…", "Synced 3 min ago", red "Couldn't sync: …", "· offline, will sync…"), **Sync now** (disabled while syncing), conflict note, ghost **Sign out**, ghost danger **Delete my cloud data** → `Confirm` ("Delete cloud data").
  6. **App lock:** PIN row: off → hint + **Set a PIN**; on → **Lock now** + ghost **Turn off**. "Lock again" select (Right away / 1 / 5 / 15 min) when on. Inline form for set (New PIN + Again, digits only, max 8, **Save PIN** disabled until valid) or remove (Current PIN, **Turn off**) + Cancel. Errors ("The two PINs don't match.", "That's not the PIN.") surface as error toasts.
  7. **Backup & data:** Full backup (hint shows "Last backup: Today/Yesterday/n days ago/Never") **Download backup** (primary); Restore / import **Import…** (hidden file input) → **Import backup sheet** (description with date + record counts; two big option buttons: "Merge (recommended)" and red "Replace everything" which first downloads a safety backup; result toast with counts); Tasks spreadsheet **Export CSV**; Calendar file **Export .ics** (long hint); Erase this device ghost danger **Erase…** → `Confirm` "Erase everything on this device?" → "Erase this device".
  8. **Storage on this device:** Persistent storage (green "Protected" or **Request protection**); Storage used "X of Y".
  9. **App:** Install (green "Installed" / **Install app** / "Use the browser menu → Install app"); Reminders (`NotificationsButton`: **Allow notifications** / green "Allowed" / "Blocked in browser settings" / "Not supported here"); Connection (green Online / muted Offline); Version; Diagnostics **Copy diagnostics** → "Copied".
- **Copy inconsistencies a reviewer may notice:** Storage hint says data lives only in this browser "until sync arrives (M5)" and the Today backup reminder says "until sync arrives", while the Account card offers sync.

### 2.19 Section editor

- **Route:** `/settings/sections` (Settings → Sections, setup checklist, Sections page gear icon, palette "Edit sections").
- **Header:** "Sections" / "Add, rename, reorder, nest, hide and recolor. Hidden sections keep their data." + **New section**.
- **Tree list:** one bordered card; rows indented 22px/level; top-level names bold; hidden (or hidden-by-parent) rows at 50% opacity. Each row: colored icon, name (link to section page), Move up / Move down arrows (disabled at ends; 40px on phone).
  - **Desktop:** inline icon buttons Show/Hide (eye), Edit (pencil → NodeDialog), Add inside (plus → NodeDialog with parent), Delete (trash, hover red → toast + Undo).
  - **Phone:** those four actions collapse into a ⋯ `Menu` (Hide/Show, Edit, Add a section inside, Delete).
- **Footer tip:** use Edit to move a section inside another; delete moves to Trash for 30 days.

### 2.20 Tags

- **Route:** `/settings/tags`.
- **Content:** PageHeader "Tags" / "Tags work across every section."; add form (input "New tag, e.g. urgent-review" + **Add**, auto-assigned color); list card of rows: color dot, inline-rename input (border appears on hover/focus, saves on blur, reverts on error), "n tasks", color `Select` (named colors), delete icon (toast "Deleted #tag" + Undo).
- **Empty:** "No tags yet — Create one above or from any task."

### 2.21 Trash

- **Route:** `/trash`.
- **Header:** "Trash" / "Deleted items are kept for 30 days, then removed for good." + ghost danger **Empty trash** (only when not empty).
- **List:** card rows: label (journal entries named by date, vault items "Encrypted vault item"), meta "Kind · +n subsections · +n tasks · n days left", **Restore** (toast "Restored …"), X delete-forever icon.
- **Dialog:** `Confirm` "Empty the trash?" / "Delete "X" forever?" → "Delete forever" (danger).
- **Empty:** EmptyState "Trash is empty".

### 2.22 More (phone tab)

- **Route:** `/more` (BottomNav "More"; reachable on desktop by URL only).
- **Content:** PageHeader "More"; grouped rounded lists of rows (icon, label, chevron, min-h-14): primary screens; "Tools and private" (Reviews, Analytics, Notes, Journal, Vault); Settings + Trash; "Coming soon" group (only if any unbuilt items; currently none).

### 2.23 Sections list (phone tab)

- **Route:** `/sections` (a choosable bottom tab). PageHeader "Sections" with icon actions **+** (New section) and gear (→ Section editor).
- **Content:** one rounded group per top-level section; rows for the section and every descendant, indented 20px/level, colored icons, chevrons. Visible sections only.

### 2.24 Share target

- **Route:** `/share?title=&text=&url=` (PWA `share_target`). No UI of its own: shows `Loading`, creates an Inbox task from the shared content, toasts "Saved "X" to Inbox" with Undo, then redirects to `/inbox`. With nothing to save it redirects immediately.

### 2.25 404

- **Route:** any unknown path inside the frame. Centered: "Page not found", "This page doesn't exist (yet).", accent link "Go to Today". Plain; no icon or PageHeader.

### 2.26 Section page (all kinds)

- **Route:** `/s/:nodeId`. Reached from sidebar section tree, Home map, Sections list, bottom tab (if chosen), palette, breadcrumbs, child chips. File: `src/pages/NodePage.tsx`.
- **Kind resolution** (`src/features/structure/section-kinds.ts`): by the section's `moduleKey` (or parent = Coursework). Each kind sets an embedded **list** template and how prominent **tasks** are (`main` = full task box, `more` = small "Add a task here" button until tasks exist, `off` = only when tasks already exist).

| Section kind (moduleKey) | Embedded list | Tasks | Special tools |
|---|---|---|---|
| research | Papers | main | Paper import from DOI/arXiv |
| ideas | Ideas | more | |
| learning | Learning resources | more | |
| entertainment | Movies & series | off | |
| places | Places | off | |
| trips | Trips | more | |
| dates | Occasions | off | |
| shopping | Shopping list | off | |
| finance / invoices | Expenses | off / more | "This month" spend summary |
| meetings | none | more | Meetings block always shown |
| fitness | none | off | **Gym** (replaces generic blocks) |
| health | none | off | **Health** (replaces generic blocks) |
| thesis | none | main | **Thesis** chapters + writing log |
| child of coursework (course) | Assessments | more | "Graded so far" summary |
| anything else | none | main | |

- **Common layout (top → bottom):**
  1. **Breadcrumb** (only for nested sections): ancestor links with chevrons.
  2. **Header:** colored section icon (28/32px), title (32px / 36px md), "Hidden from navigation" note if hidden, `MotivationLine`. Right: settings icon (Settings2) → **Section options Menu**: Edit name, icon, color (NodeDialog); Add subsection; Add a list here (→ Template picker); Show/Hide in navigation (hide toasts with Undo); separator; Delete section… (→ `Confirm` "Move to Trash", navigates to parent or Today).
  3. **Gym** or **Health** block (if that kind).
  4. **Notes page** (`PageEditor`, rich text) — placed here for plain sections; placed *after* the tools for sections that have their own list or tools.
  5. **Subsection chips:** rounded pills (icon, name, open count; hidden children 60% opacity). **Phone:** a single horizontally scrolling row bleeding to the screen edges; **md+:** wrapping.
  6. **Thesis** block (thesis kind).
  7. **Embedded list** (`SectionList`), if the kind has one.
  8. **Meetings** block (`MeetingsSection`; hidden for Gym/Health; shown on meetings kind always, otherwise only if the section has meetings).
  9. Notes page (tools-first kinds).
  10. **Lists / More lists** (other lists added to this section): grid of list cards (`sm:2 / lg:3` cols) with icon, name, "n open of m" / "n items" / "Empty".
  11. **Tasks:** heading "Tasks n open", "Include subsections" checkbox (if children), inline composer (section chip only when children exist), `TaskList` (section labels when including subsections). For `more` kinds without tasks: ghost **+ Add a task here** button reveals this block.
- **Template picker sheet** ("New list", "Pick a starting point…"): list of template buttons (icon, name, hint); templates that suit this section first, Blank last; People excluded. Creating navigates to the new list page.
- **Not found:** EmptyState "This section doesn't exist" + "Open Trash".

#### 2.26a Embedded list (SectionList)

- File: `src/features/collections/SectionList.tsx`.
- **Before the first item:** heading (template name), hint, single add form (input "Add a paper, or paste a DOI or arXiv link" / "Add a/an <noun>", **Add**; for a detected DOI/arXiv id the button becomes **Import** with download icon and "Importing…"). Nothing is created until the first add.
- **After:** renders the full list UI (`CollectionPage embedded`): section-sized `h2` instead of page title, no breadcrumb; everything else as 2.27.

#### 2.26b Meetings block

- File: `src/features/meetings/MeetingsSection.tsx`. Heading "Meetings" + ghost **New meeting** (creates one at the current hour, reusing the last title, and opens it). Empty copy explains carry-over. Bordered list (max 6, then "Show all n" / "Show fewer"): date/time column, title, "n open" action items; future meetings get a faint background.

#### 2.26c Thesis block

- File: `src/features/life/ThesisSection.tsx`. Heading "Thesis"; totals "X of Y words (n%) · This week +n" + ProgressBar; **Log writing** form card (Chapter select, Word count now, Minutes optional; wraps) → toast "+n words in Chapter"; chapter list: inline-rename title, status mini-select (Outline / Drafting / Revising / Done), "current / [goal input]", small ProgressBar, delete icon (toast + Undo); last row is an "Add a chapter" form; `<details>` "Writing log" (last 20).

#### 2.26d Gym section (fitness)

- File: `src/features/life/Gym.tsx`.
- **Today's workout card** (rounded-3xl): label "Today's workout" / "Done today. Next up"; with an active routine: day name (28px display), "Routine · day n of m · about N min", exercise chips ("Bench press 3×8-12" / "Running 20 min"), **▶ Start <Day>** (primary), "Do a different day" select (if > 1 day), ghost **Free workout**. Without a routine: "Pick a routine" + copy, **★ Choose a routine** (→ Programs sheet), ghost **Log a free workout**. Footer strip: 7 round day markers (trained = filled check, today ringed) + "n of m workouts" and cardio minutes/km this week.
- **Your routines:** header with ghost **Programs** and **Create**; bordered list rows (title, "Active" pill, "Level · n× a week · day names"), ⋯ menu: Make active, Edit, Delete (toast + Undo). Empty copy.
- **Recent workouts** (`RecentWorkouts`, hidden if none): `md:grid-cols-[1fr_16rem]`: list (date, title · exercises, trophy + PR count) linking to workout page | "Best lifts" (name, heaviest kg).
- **Programs sheet:** title "Programs", "Pick your level for a recommendation."; level radio cards (2-col grid; label + who); program cards (title, "Recommended for you" pill for matching level, level + summary), expandable days (`sm:grid-cols-2` lists of exercises), **Use this routine** (primary if recommended, else secondary; toast "… is your routine now"), ghost **See the days / Hide days**.
- **Routine editor sheet** ("New routine" / "Edit routine"): Routine name + Days a week (1–7) in `1fr 7rem` grid; one bordered fieldset per day: day name input + delete-day trash (if > 1); exercise rows grid `1fr 3.5rem 4.5rem 2.5rem` (name, sets, reps or "cardio" + minutes, remove X); ghost **+ Exercise**, **+ Cardio**; below, ghost **+ Add a day**. Footer Cancel / Save (disabled without name). Empty exercise names are dropped on save. Note: the fixed 4-column row is tight at 375px inside the sheet padding.

#### 2.26e Workout page

- **Route:** `/workouts/:workoutId` (from Start buttons, Recent workouts). File: `src/features/life/Workouts.tsx` (`WorkoutPage`).
- **Header:** dumbbell icon, inline-editable title (32/36px), ⋯ menu "Delete workout" (toast + Undo, navigates back). Date button (DatePicker, w-52).
- **Planned exercises** (when started from a routine): one bordered card each (border tints `sec-self` when complete): name, progress "n/sets × reps" (or minutes), "Last time: …", logged sets list (Set n, "reps × kg", PR trophy badge, remove X), inline form Reps + kg (or Minutes + km) pre-filled from last time, **Log set / Log cardio** (primary until complete, then secondary).
- **Another exercise / Add a set** form card: Exercise (datalist of known lifts), Reps, Weight (kg), **Add set**.
- **Cardio** form card: Activity (datalist), Minutes, km optional, **Log cardio**.
- Extra exercise groups with their set lists; "No sets yet. Add your first one above." when empty.
- **Notes** textarea "How did it feel?" (save on blur).
- **Feedback:** PR toast "New personal record: …"; first log also checks in the Gym habit.
- **Not found:** "This workout doesn't exist" + Open Trash.

#### 2.26f Health section

- File: `src/features/life/Health.tsx` (+ `CheckinHistory` from `Checkin.tsx`).
- **Plan prompt** (until a plan is saved): rounded-3xl card "Set your daily plan", copy, **Set my plan**.
- **Today** (heading + ghost **Edit plan** once saved): bordered list of plan rows (icon, label, "Plan HH:mm", right-side controls):
  - Woke up: timing status ("on time" green / "late" amber / "early" blue) + time input.
  - Breakfast / Lunch / Dinner: **Ate <meal>** button (logs now) → once logged, status + editable time (clear to undo).
  - Water: "n of target glasses", − (disabled at 0), **+ Glass**, ProgressBar.
  - Tonight: **Going to bed** (logs now) or logged time + status.
  - Bed last night: status + time input + "n h" slept.
- **Last 14 days:** per item (meals, bedtime, water) a row of 14 dots (green on time, amber late, grey not logged; tooltip per day) + "n% on time". Grid `5.5rem 1fr` on phone (percentage wraps under), `md:` three columns.
- **Appointments:** heading + ghost **New appointment**; upcoming rows (stethoscope, title, date · place · reason); past (last 5) rows with an editable notes textarea ("What did the doctor say?…"). Empty copy.
- **Check-in history:** averages line + 14-row table (Day, Mood, Energy, Sleep, Water, Weight). Six columns with no overflow wrapper on phone.
- **Daily plan sheet** ("Your daily plan"): 2-col grid of time inputs (Wake up, Bedtime, Breakfast, Lunch, Dinner), Glasses of water a day (1–20), Water reminder every (hours) (1–6); "Remind me" checkboxes (meal times, water when behind, bedtime). Footer Cancel / **Save plan**.
- **Appointment sheet** ("New appointment"): With (autofocus), Reason, Date (native date input) + Time (2-col), Where; "Remind me" checkboxes (A day before, 2 hours before; both on). Footer Cancel / Save (disabled until With/date/time). Toast "Appointment saved. It's on your calendar too."

### 2.27 List page (+ record sheet + list settings)

- **Route:** `/lists/:collectionId`, `?item=<recordId>` opens a record (from palette, Coming up, reminders, calendar). Same component renders `/people` and embedded section lists. File: `src/pages/CollectionPage.tsx`.
- **Header:** breadcrumb to owning section (non-embedded); list icon + title (32/36px) or section-sized `h2` when embedded; ghost **Fields & statuses** (→ List settings); ⋯ menu: Export BibTeX (Papers only, disabled when empty), Delete list… (`Confirm` → "Move to Trash").
- **Toolbar (wraps):** add form (input "Add a/an <noun>", or "Add a paper, or paste a DOI or arXiv link"; **Add** / **Import** with "Importing…"; duplicate paper toasts "already in"); view switch tabs **Table / Board** (persisted on the list).
- **Summaries:** Assessments (course): "So far: X of Y marks graded (n%)…" + weight warning; Expenses: "This month: total · category amounts" or guidance.
- **Table view** (`features/collections/views.tsx`): bordered, horizontally scrollable (`overflow-x-auto`). Sortable headers (Title, Status, each non-longtext field; click cycles asc → desc → none, arrow icon, `aria-sort`). Title cell is a button opening the record; Status is an inline mini-select; URL fields render as links; done-status rows 60% opacity; row hover tint.
- **Board view:** horizontal scroll of 256px status columns (bleeds to screen edge on phone), column header with count; cards (title + up to 2 field previews) are HTML5-draggable between columns (column highlights on drag-over). **Phone:** each card shows a small "Move…" select in its top-right corner instead (`md:hidden`, card gets right padding).
- **Empty:** compact EmptyState "Nothing here yet — Add your first <noun> above. Open it to fill in the details."
- **Record sheet** (`features/collections/RecordSheet.tsx`, side panel / phone bottom sheet): title = record title, description = list name. Fields: Title (save on blur), Status select (custom label e.g. "Relation", "Kind"), one `FieldInput` per field, Files (`Attachments`). Footer: ghost danger **Delete** (left; toast + Undo) and **Done**.
- **FieldInput types** (`features/collections/FieldInput.tsx`): Text, Long text (textarea), Number, Link (input + external-link button), Date (DatePicker; yearly dates like birthdays use a native date input), Deadline (DatePicker + time + time-zone select, both disabled until a date is set; hint "Your time: … · in 3 days"), Choice (select), Rating 1–5 (radio star buttons), Checkbox.
- **List settings sheet** (`features/collections/ListSettings.tsx`, side variant, "Fields & statuses", footer **Done**):
  - List name (save on blur).
  - **Statuses / "<Name> options":** explanatory hint; rows of name input + "Done" checkbox + remove X (disabled for the last one); ghost **+ Add status**; when changed: **Undo changes** + **Save statuses** (primary) and a note "Items in a removed status move to the first one." (explicit save, unlike the rest of the app).
  - **Fields:** rows of name input (save on blur), type label, up/down/remove buttons; Choice fields get a comma-separated choices input. Add-field form card: name, type select (w-44), choices (for Choice), **+ Add field** (disabled without name).
- **Not found:** EmptyState "This list doesn't exist" + Open Trash.

### 2.28 Meeting page

- **Route:** `/meetings/:meetingId` (Meetings block, calendar meeting items, Event sheet "Meeting notes", palette). File: `src/pages/MeetingPage.tsx`.
- **Header:** breadcrumb to section; inline-editable title (32/36px); ⋯ menu "Delete meeting…" (`Confirm` → "Move to Trash"; action items stay as tasks).
- **Details grid** (`sm:grid-cols-[auto_auto_1fr]`, stacked on phone): if linked to a calendar event: read-only date line "(from your calendar)" link; else Date (DatePicker) + Time input. **With** (comma-separated attendees, datalist from People list, save on blur). Section select (`sm:max-w-xs`).
- **From earlier meetings** (if any): carried-over open/flagged action items.
- **Agenda** textarea (save on blur).
- **Action items:** `AddActionItem` (natural-language input, e.g. "send draft fri", **+ Add**) + `ActionItemList` (native checkbox, title button → Task editor, source meeting date, due label (red if overdue), flag toggle "Bring this up at the next meeting" — filled amber when on); explanatory footnote.
- **Notes:** `RichEditor` ("Notes and decisions…").
- **Files:** `Attachments`.
- **Not found:** "This meeting doesn't exist" + Open Trash.

---

## 3. Shared components

### 3.1 Primitives — `src/components/ui.tsx`

| Component | Props | Variants / behavior |
|---|---|---|
| `Button` | `variant?: 'primary' \| 'secondary' \| 'ghost' \| 'danger'` (default `secondary`), `size?: 'sm' \| 'md' \| 'icon' \| 'icon-sm'` (default `md`), all `<button>` attrs; forwards ref; `type="button"` by default | primary = `bg-accent` / `text-accent-fg`; secondary = bordered surface; ghost = muted text, hover `surface-2`; danger = red fill. Sizes are **larger on phone** (sm 36px → 32px md; md 44px → 40px; icon 44 → 40; icon-sm 40 → 32). Press = `scale(0.97)`. Disabled = 50% opacity, no pointer events. Many "danger" actions actually use `ghost` + `text-danger`. |
| `Input` | `<input>` attrs; forwards ref | 44px phone / 40px md; 16px text on phone (prevents iOS zoom) / 14px md; focus darkens border (no ring); disabled 60%. |
| `Textarea` | `<textarea>` attrs | min-h-24, relaxed leading, same field styles. |
| `Select` | `<select>` attrs | Native select styled like Input. Used for most pickers (section, status, time zone, priority etc.). |
| `Field` | `label`, `hint?`, `htmlFor?`, `children`, `className?` | Muted 13/12px label above control, optional muted hint below. |
| `EmptyState` | `icon?`, `title`, `children?`, `action?`, `compact?` | Centered; round `surface-2` icon badge; py-14 (py-8 compact). |
| `Loading` | `label?` | Invisible for 250ms → 3 pulsing skeleton bars → after 6s "This is taking longer than usual" + Reload. |
| `ProgressBar` | `pct`, `label`, `className?` | 6px track, `bg-fg/80` fill, animated width, `role=progressbar`. Monochrome (not section-colored). |

### 3.2 Layout — `src/components/PageHeader.tsx`

| Component | Props | Notes |
|---|---|---|
| `PageHeader` | `title`, `icon?`, `color?` (palette name), `subtitle?`, `actions?` | 28px title (32px md), muted subtitle, actions right-aligned. Used by most fixed pages; Today, Home, section, list, project, meeting, workout pages use their own larger headers. |
| `Card` | `className?`, `children` | Bordered `surface` section, rounded-2xl (xl on md), p-4. Used mainly in Settings and Placeholder. |
| `MilestoneBadge` | `milestone` | Pill "Available" / "Arrives in Mx" (Placeholder page only). |

### 3.3 Overlays — `src/components/Sheet.tsx`, `Menu.tsx`, `DatePicker.tsx`

| Component | Props | Behavior |
|---|---|---|
| `Sheet` | `open`, `onOpenChange`, `title`, `description?`, `children`, `footer?`, `variant?: 'center' \| 'side'`, `bare?`, `onOpenAutoFocus?`, `className?` | Radix Dialog. **Phone: bottom sheet** (rounded-t-3xl, max 92dvh, grab handle, safe-area padding). **md+: `center`** = dialog at 14vh, max-w-lg, max 76dvh; **`side`** = full-height right panel max-w-xl. Header: title + optional description + ghost X close. Scrollable body; optional bordered footer (right-aligned buttons). Dim overlay, no blur. `bare` hides the visible header. Used by: New task, Task editor (side), Skip, NodeDialog, Customize Today, Goal, Habit, Habit history, Event, Import backup, Template picker, Record (side), List settings (side), Programs, Routine, Daily plan, Appointment. |
| `Confirm` | `open`, `onOpenChange`, `title`, `description`, `confirmLabel`, `danger?`, `onConfirm` | Radix AlertDialog, centered on all sizes (max-w-md), Cancel + primary/danger action. Used for deletes that are not instantly undoable or are large (section, project, list, meeting, erase device, empty trash, delete forever, delete cloud data). |
| `Menu` | `trigger`, `items: (MenuItem \| null)[]` (`null` = separator), `align?: 'start' \| 'end'` | Radix DropdownMenu, non-modal; `MenuItem = { label, icon?, onSelect, danger?, disabled? }`. Rounded-xl panel, highlighted row `surface-2`, danger items red. Used for row ⋯ menus, section options, list options. |
| `DatePicker` | `value` (yyyy-MM-dd or ''), `onChange`, `children` (trigger), `weekStartsOn?`, `align?`, `onCloseFocus?` | Radix Popover (19rem): quick picks Today / Tomorrow / This weekend / Next week (with date hints, selected highlighted), "No date" (when set), month grid with prev/next; today ringed, selected filled `bg-fg`, other-month days faded. Applies immediately on pick. Same popover on phone (not a sheet). |
| `DateButton` | `label`, `value?`, button attrs | Field-styled trigger with calendar icon; shows "Today" / "Tomorrow" / "Fri 21 Nov" / "No date" (muted). |
| `dateChipLabel(value, now)` | function | Shared date formatting for chips and lists. |

### 3.4 Task components — `src/features/tasks/`

| Component | Props | Notes |
|---|---|---|
| `TaskComposer` | `variant: 'inline' \| 'sheet'`, `nodeId?`, `dueToday?`, `showSection?` (default true), `placeholder?`, `autoFocus?`, `onAdded?`, `projectId?` | Natural-language capture (`fri 5pm #tag !high @section every monday`), live "Understood:" chips with per-part ignore X; option chips (Section, Today, Tomorrow, Date, Priority). **Inline:** bordered rounded input with + icon; **Add** button and chips appear only once text is typed. **Sheet:** large title, round submit, chips always shown, confirmation line after add. |
| `TaskList` | `tasks`, `showSection?`, `currentNodeId?`, `emptyText?`, `hideFilters?`, `sortable?` | Status tabs Open / Completed / Skipped / All with counts (full-width 4-col on phone, inline on md); sorted rows; completed tasks linger ~0.9s checked before leaving; "Recently closed (n)" disclosure (max 20). Empty → compact EmptyState "All clear" / "Nothing here". |
| `TaskRow` | `task`, `subtasks`, `tags`, `tree?`, `showSection?`, `timezone?`, `now`, `lingering?`, `onCompleted?`, `sortable?` | Priority-colored check circle; title (strikethrough when closed); meta line: due (red "Overdue · …"), "In progress", skipped/cancelled reason, repeat icon, subtask n/m, section dot + name, tag chips. Optional "Move to…" select (Inbox). ⋯ menu: Edit, Start / Mark not started / Reopen, Skip…, Cancel task, Duplicate, Delete. **Phone:** touch swipe right = Complete (green reveal), swipe left = Tomorrow (blue reveal), 88px threshold; ⋯ always visible. **Desktop:** ⋯ appears on hover/focus. |
| `TaskCheck` | `status`, `priority`, `onClick`, `label`, `small?`, `animate?` | `role=checkbox`; ring color = priority (P1 red, P2 orange, P3 sky, none muted); filled + check when done; dashed + minus when skipped; X when cancelled; thick ring when in progress; invisible ~44px hit area. |
| `TagChip` | `tag`, `onRemove?` | Soft-colored "#name" pill, optional X. |
| `PRIORITY_STYLE` | map | `ring` / `text` / `fill` classes per priority. |
| `TaskEditor`, `NewTaskSheet`, `SkipDialog` | (store-driven) | See 1.4–1.6. |

### 3.5 Other shared feature components

| Component | File | Props / notes |
|---|---|---|
| `TagPicker` | `features/tags/TagPicker.tsx` | `value: string[]`, `onChange`. Selected chips with X; input "Add a tag…"; suggestion pills; dashed "+ Create #name". Enter picks exact match or creates. |
| `Attachments` | `features/attachments/Attachments.tsx` | `target: {table, id}`, `nodeId?`. File rows (name, size, remove X → toast + Undo), ghost **Attach file**, drag-and-drop zone (ring highlight while dragging), hint "kept on this device, up to 25 MB". Missing blob → toast explaining it's on another device. |
| `RichEditor` / `PageEditor` | `features/pages/PageEditor.tsx` | `initial`, `placeholder`, `onSave(doc, text)`, `label?`. Tiptap: headings, lists, checklists, quote, divider, code; markdown shortcuts; **"/" slash menu** (floating listbox, arrow keys/Enter/Esc, mouse hover). Debounced save (400ms) + save on blur / tab hide; "Saving…" / "Saved" indicator top-right. `PageEditor` = section notes page (`nodeId`). Lazy-loaded. |
| `SectionSelect` | `features/plans/SectionSelect.tsx` | `value`, `onChange`, `id?`, `noneLabel?` ("No section"), `className?`. Native select of visible sections, indented by depth with spaces. |
| `DayCell` | `features/habits/habit-ui.tsx` | `habit`, `date`, `status?`, `scheduled`, `isToday?`, `dayLabel`, `large?`. 32/36px square cycling done → skipped → rest → empty. |
| `Heatmap` | `features/analytics/Heatmap.tsx` | `byDay: Map`, `from`, `today`, `label`, `binary?`. Week-column grid of small squares (max 12px), 5-step `sec-self` scale, legend "n completed · Less ■■■■■ More". `role=img`. |
| `CheckinCard`, `CheckinHistory` | `features/life/Checkin.tsx` | Home check-in card; Health 14-day table. |
| `MotivationLine` | `features/messages/MotivationLine.tsx` | `keys`, `nodeIds?`. One random muted line + small dismiss X (hit area enlarged on phone). Off via Settings. |
| `ReviewNudge`, `SetupChecklist` | `features/analytics/`, `features/setup/` | Today-page cards (2.3). |
| `UnlockForm` | `features/vault/Unlock.tsx` | `onForgot?`, `compact?`. Full (stacked, max-w-sm) or compact (inline) passphrase form. |
| `AccountCard` | `features/sync/AccountCard.tsx` | `redirectPath?`. Three states (2.18 card 5). Used in Settings and Onboarding. |
| `ActionItemList`, `AddActionItem` | `features/meetings/ActionItems.tsx` | Compact task rows with follow-up flag; natural-language add. |
| `NodeIcon` | `lib/NodeIcon.tsx` | `name`, `className?`. Renders a lucide icon by stored name, `aria-hidden`. |
| `colorFor(name)` / `PALETTE` | `lib/palette.ts` | Returns `{ text, soft, dot, ring }` Tailwind classes for indigo, emerald, rose, amber, sky, …, pink, slate (fallback slate). Text shades differ for light/dark. |

### 3.6 Interaction conventions worth reviewing

- **Two segmented-control implementations** look alike but are separate markup: All Tasks views, TaskList status filter, Reviews/Analytics periods, List Table/Board, Settings theme, Focus lengths (pills), Check-in mood/energy (pills).
- **Native `<select>` everywhere** for pickers (sections, statuses, priority, repeat, time zone, tags filter); composer chips wrap a transparent native select so phones get the system picker.
- **Inline-editable titles** (project, note, meeting, workout, list record, tag, chapter) are borderless inputs that save on blur with no visible edit affordance.
- **Undo via toast** is the main safety net; `Confirm` dialogs are reserved for larger deletions.
- **Hover-revealed controls on desktop** (task ⋯, milestone X, subtask X, sidebar hide eye) are always visible on phone; milestone delete X is `opacity-0` + `group-hover` with no `md:` guard, so on touch devices it is only reachable via focus.
- **Focus styles:** inputs change border color; buttons rely on browser default focus rings (no custom `focus-visible` ring on `Button`).
- **Keyboard:** `N` new task, `Ctrl/⌘+K` palette, arrow keys in palette / slash menu / sidebar resize; Escape closes sheets/menus (Radix) and cancels the inline new-project form.

---

## 4. Uncertainties / not verified

- Visual rendering was not inspected in a browser; this inventory is from code only. Custom CSS classes (`pos-cal`, `pos-doc`, `sheet-center`, `sheet-side`, `anim-*`, `font-display`, color tokens) live in global CSS that was not reviewed in detail.
- `PlaceholderPage` and the sidebar/More "Coming soon" groups are currently unreachable because every nav item is marked built.
- Collection template field lists (per list type) are defined in `src/content/collection-templates.ts` and were not enumerated here; the list UI is generic across them.
- `VaultAutoLock` and `SyncRunner` have no visible UI and were not read.
