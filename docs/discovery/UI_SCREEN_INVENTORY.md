# UI screen inventory

These are real screenshots of the production build (`npm run build && npm run preview`). They were captured on 19 Nov 2026 at commit `c056ee6` with Playwright: desktop at **1440 × 900**, phone (Pixel 7) at **390 × 844** (3× pixel density). The capture script is `docs/discovery/capture/`, and it can be run again.

**How they were made:**

- **Sample data** was typed in through the app in a fresh browser profile: a Researcher profile with Physical AI and SMAI, tasks, three habits, a goal, papers, an adviser meeting, a gym program and a weekday routine, a health plan with logs, movies, a birthday, an expense, a journal entry, a check-in and a project outline. No real user data was used.
- **Clock and time zone:** fixed at **Wed 18 Nov 2026, 10:00 India time**. After the reminder step the clock moves to the evening, so some later shots show "Good evening" or reminder cards. That's real behavior.
- **Full-page shots** show the fixed phone bottom bar and the sticky desktop sidebar part-way down long pages. That's an artefact of stitching the page together, not a layout bug.

Paths are `screenshots/<desktop|mobile>/<folder>/<name>.png`. Every screen exists at both sizes unless noted.

## Navigation and shell

| Screen                   | File(s)                                                                           | What it shows                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Welcome / onboarding     | `onboarding/welcome`                                                              | Name, "what do you do" profiles, Get started, sign in from another device                                                                                                      |
| Desktop sidebar          | visible on every desktop shot; `interactions/sidebar-collapsed` (desktop only)    | Home, Today, All Tasks, Inbox, Projects, Goals, Habits, Focus, Calendar, People; Sections tree; Tools; Private; Settings, Trash; New task (N); Search (Ctrl+K); resizable edge |
| Phone bottom bar         | visible on every phone shot; `interactions/phone-bottom-bar-setting` (phone only) | Home, Today, ＋ New task, Tasks, More. The 3 tabs around ＋ can be changed                                                                                                     |
| More (phone)             | `navigation/more`                                                                 | Every screen that works                                                                                                                                                        |
| Sections list            | `navigation/sections-list`                                                        | Sections tree as a page                                                                                                                                                        |
| Not found                | `navigation/not-found`                                                            | An in-app "not found" message                                                                                                                                                  |
| Search (command palette) | `interactions/command-palette-search` (desktop only)                              | Ctrl+K search with "Add task"                                                                                                                                                  |

## Dashboards

| Screen                        | File(s)                                                                                    | Notes                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Home (section map + check-in) | `dashboard/home-section-map`, `light-theme/home-section-map`                               | Top-down map of every section (tap to open), daily check-in                                |
| Today                         | `dashboard/today`, `light-theme/today`                                                     | Greeting, today's tasks, habits today (with the Gym plan line), Coming up, Customize Today |
| Today on first run            | `dashboard/today-first-run-setup-checklist`                                                | "Finish setting up" checklist                                                              |
| Customize Today               | `interactions/customize-today` (desktop only; on phone a reminder card covered the button) | Show, hide and reorder widgets                                                             |

## Tasks and planning

| Screen                                                                | File(s)                                                                                                   |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| All Tasks (All, This week, Upcoming)                                  | `tasks/all-tasks`, `tasks/all-tasks-this-week`, `tasks/all-tasks-upcoming`, `light-theme/all-tasks`       |
| Inbox                                                                 | `tasks/inbox`                                                                                             |
| New task sheet (quick add with plain-language parsing)                | `interactions/quick-add-new-task-sheet`                                                                   |
| Task editor (side panel / full sheet)                                 | `interactions/task-editor`                                                                                |
| Task row menu                                                         | `interactions/task-row-menu`                                                                              |
| Projects list                                                         | `planning/projects`                                                                                       |
| Project page with Notion-style outline (headings, subheadings, tasks) | `planning/project-outline`                                                                                |
| Goals, plus the New goal sheet                                        | `planning/goals`, `interactions/goal-new-sheet`                                                           |
| Habits (week grid, suggestions)                                       | `planning/habits`, `light-theme/habits`                                                                   |
| Habits with the Gym plan line (today's workout, Start, Skip)          | `planning/habits-with-gym-plan`                                                                           |
| New habit sheet, habit history                                        | `interactions/habit-new-sheet`, `interactions/habit-history-sheet`                                        |
| Calendar (desktop week / phone 3-day; month) + new event              | `calendar/calendar`, `calendar/calendar-month`, `light-theme/calendar`, `interactions/calendar-new-event` |
| In-app reminder card                                                  | `interactions/in-app-reminder`                                                                            |

## Tools and private

| Screen              | File(s)                                                |
| ------------------- | ------------------------------------------------------ |
| Focus               | `tools/focus`                                          |
| Reviews             | `tools/reviews`                                        |
| Analytics           | `tools/analytics`, `light-theme/analytics`             |
| People              | `people/people`                                        |
| Notes               | `private/notes`                                        |
| Journal             | `private/journal`, `light-theme/journal`               |
| Vault setup, form   | `private/vault-setup`, `interactions/vault-setup-form` |
| App Lock: set a PIN | `interactions/app-lock-set-pin`                        |

## Section pages (each kind has its own tools)

| Section                                                      | File                                                                                    | Kind                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Work, Self-Improvement, Personal Life, Miscellaneous (areas) | `sections/work`, `self-improvement`, `personal-life`, `miscellaneous`                   | Area: subsection chips, outline, tasks from subsections                    |
| Research                                                     | `sections/research`                                                                     | Papers list embedded, plus the full outline                                |
| Physical AI (research topic)                                 | `sections/physical-ai`                                                                  | Plain section with outline                                                 |
| Thesis                                                       | `sections/thesis`, `sections/thesis-with-outline`                                       | Thesis chapters and word goals, plus the outline                           |
| Coursework, SMAI (a course)                                  | `sections/coursework`, `sections/smai`                                                  | Course → Assessments list with grade so far                                |
| Adviser Meetings + a meeting page                            | `sections/adviser-meetings`, `sections/adviser-meeting-page`                            | Meetings, agenda, notes, action items                                      |
| Updates, Household, Documents                                | `sections/updates`, `household`, `documents`                                            | Plain sections (outline)                                                   |
| Gym & Fitness                                                | `sections/gym-fitness`, `sections/gym-with-weekly-routine`, `light-theme/gym-fitness`   | Today's workout, week strip, routines, consistency, recent workouts        |
| Workout in progress                                          | `sections/gym-workout-in-progress`                                                      | Planned exercises, log set, cardio                                         |
| Gym programs, routine editor, 7-day week builder             | `interactions/gym-programs-by-level`, `gym-routine-editor`, `gym-week-builder`          |                                                                            |
| Health                                                       | `sections/health`, `light-theme/health`                                                 | Daily plan timeline, 14-day on-time record, appointments, weekly check-ins |
| Health plan, new appointment                                 | `interactions/health-daily-plan`, `health-new-appointment`                              |                                                                            |
| Learning & Skills                                            | `sections/learning-skills`                                                              | Resources list, "Add a task here"                                          |
| Movies & Series                                              | `sections/movies-series`, `light-theme/movies-series`                                   | Watchlist board                                                            |
| Places, Trips                                                | `sections/places`, `sections/trips`                                                     | Lists                                                                      |
| Dates & Occasions                                            | `sections/dates-occasions`                                                              | Occasions (yearly)                                                         |
| Shopping, Expenses                                           | `sections/shopping`, `sections/expenses`                                                | Lists (expenses show monthly totals)                                       |
| Section options menu, "Add a list here" picker, new section  | `interactions/section-options-menu`, `add-a-list-template-picker`, `new-section-dialog` |                                                                            |
| List item sheet, list fields & statuses                      | `interactions/list-item-sheet`, `list-fields-and-statuses`                              |                                                                            |

## Settings and customization

| Screen                                       | File(s)                                     |
| -------------------------------------------- | ------------------------------------------- |
| Settings                                     | `settings/settings`, `light-theme/settings` |
| Reminder settings (interval, quiet hours)    | `settings/settings-reminders`               |
| Section editor (reorder, hide, nest, rename) | `settings/section-editor`                   |
| Tags                                         | `settings/tags`                             |
| Trash                                        | `settings/trash`                            |

## Not captured, to capture by hand if needed

| Screen                                                            | Why                                                                                  | How to reach it                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Customize Today on a phone                                        | A reminder card covered the button during capture (a known overlap problem)          | Today → bottom → Customize Today                             |
| Tablet layout (768–1023 px, icon-rail sidebar)                    | Only phone and desktop sizes were captured                                           | Resize a browser to about 900 px wide                        |
| Vault unlocked, Vault items, App Lock screen                      | Needs a passphrase or PIN set; skipped to keep test data simple                      | Vault → set up; Settings → App lock → Set a PIN, then reload |
| Account / sync signed in                                          | Needs the Supabase project (not configured); the card shows "Sync isn't switched on" | Settings → Account & sync                                    |
| System notifications, install prompt, update prompt, Share Target | Browser and system surfaces; can't be captured headless                              | Install the PWA on Android; share a link to Personal OS      |
| Snoozed reminder menu, "+N more" reminders                        | Shown in the reminder report's screenshots instead                                   | `docs/reports/screenshots/habits-gym-line-*`                 |
