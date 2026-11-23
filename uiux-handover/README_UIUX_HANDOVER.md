# Personal OS: UI/UX review handover

## 1. The application

**Personal OS** is an offline-first Progressive Web App: one place for a graduate researcher's work, self-improvement and personal life.

- **Work:** research papers, thesis, courses, adviser meetings.
- **Self-improvement:** habits, gym, health.
- **Personal:** movies, places, trips, occasions, shopping, expenses.
- **Private:** journal, an encrypted Vault.

All data lives in the browser (IndexedDB). Desktop and phone share one codebase with layouts tuned for each.

- **Live:** https://personal-os-ruby-xi.vercel.app (`main` branch)
- **Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Dexie (IndexedDB), zustand, Radix primitives, FullCalendar, lucide icons.
- **State documented:** working tree on 18 Nov 2026, after commit `7a3bafe`. The "section pages" change, where each section has its own list and add box, is **built and tested but not yet committed or deployed**, so the live site doesn't have it yet. The screenshots include it.

The documents describe what is implemented and do not propose a redesign. Nothing in the app was changed to produce them.

## 2. Documents

| File                            | What it covers                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRODUCT_OVERVIEW.md`           | Purpose, users, every module and feature, navigation, user journeys, Today/Home, customization, settings, search and quick-add, limitations, and a full feature inventory table.                   |
| `SCREEN_COMPONENT_INVENTORY.md` | Every route and secondary screen: layout, cards, actions, forms, dialogs, states, responsive behavior and files. Also covers the shared components.                                                |
| `DESIGN_SYSTEM.md`              | Tokens and hex values for dark and light themes, type, spacing, radius, shadows, buttons, cards, forms, navigation, icons, charts, breakpoints and motion. Includes **a list of inconsistencies**. |
| `FRONTEND_ARCHITECTURE.md`      | Versions, tooling, folders, routing, state, data flow, styling and themes, PWA, responsive approach, tests, and a screen → file map.                                                               |
| `EXISTING_UX_AUDIT.md`          | Verified UX and accessibility issues, kept separate from items that need manual testing.                                                                                                           |
| `IMPLEMENTATION_STATUS.md`      | Each feature classed as fully or partly implemented, UI only, planned or not implemented, with file references.                                                                                    |
| `capture/`                      | The Playwright script that took the screenshots, so you can recapture them.                                                                                                                        |

## 3. Screenshots: `uiux-screenshots/`

- Real captures of the production build.
- **Desktop** is 1440 × 900 (84 images). **Phone** is 390 × 844 at 3× pixel density (82 images).
- Each folder is laid out the same way:

```
uiux-screenshots/
  desktop/ and mobile/
    onboarding/     welcome (first run)
    dashboard/      home-section-map, today, today-first-run-setup-checklist
    tasks/          all-tasks (+ this-week, upcoming), inbox
    planning/       projects, goals, habits
    calendar/       calendar (desktop week / phone 3-day), calendar-month
    people/         people
    tools/          focus, reviews, analytics
    private/        notes, journal, vault-setup
    settings/       settings, section-editor, tags, trash
    navigation/     more, sections-list, not-found
    sections/       every section page (work, research, physical-ai, thesis, coursework, smai,
                    adviser-meetings, updates, self-improvement, gym-fitness, health,
                    learning-skills, personal-life, movies-series, places, trips,
                    dates-occasions, miscellaneous, shopping, household, expenses, documents)
                    + gym-workout-in-progress, adviser-meeting-page
    interactions/   quick-add-new-task-sheet, task-editor, task-row-menu, customize-today,
                    section-options-menu, add-a-list-template-picker, new-section-dialog,
                    list-item-sheet, list-fields-and-statuses, habit-new-sheet,
                    habit-history-sheet, goal-new-sheet, gym-programs-by-level,
                    gym-routine-editor, health-daily-plan, health-new-appointment,
                    calendar-new-event, in-app-reminder, vault-setup-form, app-lock-set-pin,
                    command-palette-search (desktop), sidebar-collapsed (desktop),
                    phone-bottom-bar-setting (phone)
    light-theme/    home, today, all-tasks, habits, calendar, analytics, journal, settings,
                    gym-fitness, health, movies-series
  desktop-missing.json, mobile-missing.json   steps that could not be captured
```

**How the screenshots were made:**

- **Sample data** was typed in through the UI in a fresh browser profile: about 6 tasks, 3 habits with a few check-ins, a goal, 2 papers, a meeting, a gym routine with one logged set, a health plan with logs, 3 movies, a birthday, an expense, a journal entry and a check-in.
- **Clock and time zone:** the clock is fixed at **Wed 18 Nov 2026, 10:00 India time**. After the reminder step it moves to the evening, so some greetings say "Good evening" and reminder cards appear in later shots.
- **Page-length shots** are full-page. The fixed phone bottom bar and the sticky desktop sidebar therefore appear part-way down long pages. That's a screenshot artefact; on screen they stay fixed.
- **Reminder cards** that fired during capture overlap some later shots. That's real behavior (audit item M1), not editing.

## 4. Running the app

Needs Node 22+ and npm.

```bash
npm ci
```

```bash
npm run dev
```

The dev server runs at http://localhost:5173. On first run you'll see the welcome screen. Pick "Researcher" to get the sections shown in the screenshots.

The production build, served exactly as on Vercel including the security headers, runs at http://localhost:4173:

```bash
npm run build && npm run preview -- --port 4173
```

Tests:

```bash
npm test
```

```bash
npx playwright test
```

Recapture the screenshots (builds and serves automatically; about 30 minutes for both sizes):

```bash
cd uiux-handover/capture && npx playwright test --config playwright.config.ts
```

## 5. Limitations of this inspection

- **One screenshot is missing:** the phone **Customize Today** sheet. Its button didn't respond within 15 seconds, most likely because a reminder card covered it (audit M1). It's captured on desktop. To capture it by hand on a phone: Today → scroll to the bottom → Customize Today.
- **By design, some shots exist on only one size:**
  - The command palette and collapsed sidebar are desktop-only: phones have no search entry point (audit N5) and no sidebar.
  - The bottom-bar setting is phone-only.
- **Not captured at all:**
  - Tablet layout (768–1023 px, sidebar as an icon rail).
  - Unlocked Vault and the PIN lock screen. Setting a passphrase takes about 1 s of Argon2 work per attempt and was skipped.
  - Sync / Account. It needs a Supabase project, which isn't configured; it shows "Sync isn't switched on".
  - System notifications, the PWA install prompt, the update prompt and the Share Target screen.
- **What the docs are based on:** they come from reading code, plus the screenshots and the end-to-end tests. No screen reader, contrast meter or real phone was used. Those checks are listed under "Needs manual testing" in the audit.
- **Planned features** (Notion-style project task outlines, Web Push, AI, Google Calendar, places map) are not built. See `IMPLEMENTATION_STATUS.md`.

## 6. Files worth opening first

- `src/app/AppShell.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `routes.tsx`, `nav.ts`: frame and navigation.
- `src/index.css`: all design tokens, themes, animations and phone overrides.
- `src/components/ui.tsx`, `Sheet.tsx`, `Menu.tsx`, `DatePicker.tsx`: the shared components.
- `src/pages/DashboardPage.tsx` (Today), `HomePage.tsx`, `NodePage.tsx` (every section page).
- `src/features/structure/section-kinds.ts`: which tools each section gets.
- `src/features/life/Gym.tsx`, `Workouts.tsx`, `Health.tsx`, `src/pages/HabitsPage.tsx`, `GoalsPage.tsx`.
- `src/features/tasks/*`: task rows (swipe), composer, editor.
- `build.md`: the product plan and decision log, including what's planned next.

## 7. Context a reviewer should know

- **One user:** the product was built for its owner, a graduate researcher in India, who uses it on an Android phone and a laptop. The design aims for "calm": graphite and paper neutrals, with color meaning only _which area of life_ something belongs to.
- **Customization:** sections are user-editable (rename, nest, hide, recolor). Section _kinds_ come from the starter template, so a renamed "Gym & Fitness" still shows the gym tools.
- **No account needed:** with no sign-in, backups (JSON) and the `.ics` calendar export are how data leaves the device.
- **Phone vs desktop:** phones get 44 px targets, bottom sheets, swipe on task rows and a bottom bar. Desktop gets denser rows, hover actions, the sidebar and keyboard shortcuts.
