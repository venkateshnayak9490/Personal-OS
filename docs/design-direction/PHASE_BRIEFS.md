# Redesign phase briefs (from the owner, 2026-11-20)

This is a working copy of the owner's briefs for Phases 2–6, kept so the run survives a context reset. Every bullet from each brief is kept, but the wording is condensed.

**Standing rules for the overnight run** (the owner's answers on 2026-11-20):

- Work on the branch `redesign/timetable` and commit after each phase. **Never push**: main deploys the live site.
- The sidebar may be reorganised (regroup, collapse, or move rare screens into groups or More), but every move is documented and nothing is removed. The phone tabs stay Home · Today · ＋ · Tasks · More, and the app still opens on Today.
- When unsure, decide, keep going, and log the choice in `docs/design-direction/DECISIONS_LOG.md`.
- Do the phases in order, each building on the one before.

**Always:**

- Use frontend-design, impeccable and ponytail.
- Build to the direction contract: Timetable (`.impeccable/surfaces/src-app-appshell-tsx.md`).
- Keep these earlier decisions (in `ux-audit-roadmap` memory):
  - habits only on the Habits page
  - no evening wrap-up
  - colour means area

## Phase 2: design system

**1. Foundations.** Define and implement:

- primary and secondary palettes
- background, surface and elevated surface colours
- primary, secondary and muted text colours
- borders and dividers
- success, warning, error and info colours
- type families, sizes, weights and line heights
- spacing scale
- radius scale
- shadows and elevation
- layout widths and content constraints
- icon sizes and conventions
- transition and animation standards

**Dark is the default theme.** Keep light and system theme support.

**2. Components.** Audit the existing components and reuse or improve them. Make each pattern consistent:

- buttons and icon buttons
- inputs and textareas
- dropdowns and selects
- date and time pickers
- cards and panels
- tabs and segmented controls
- dialogs and drawers
- toasts and notifications
- badges and status indicators
- tables and lists
- navigation items
- search
- empty states
- loading states
- confirmation and undo

Only one implementation per purpose.

**3. Layout standards:**

- app shell
- desktop sidebar
- mobile navigation
- page headers
- content containers
- dashboards
- forms
- tables
- calendars
- timelines
- analytics and charts

Sections may differ in layout, but the visual language stays the same.

**4. Responsive:** desktop, laptop, tablet and mobile. Don't just shrink layouts. Give proper behaviour to navigation, tables, calendars, forms, dialogs and charts.

**5. Constraints:**

- inspect dependencies first
- reuse the styling architecture
- no unnecessary UI libraries
- keep functionality, data and the database structure
- keep components maintainable
- avoid unnecessary refactoring

**6. QA:** check both themes for typography, contrast, spacing, states, keyboard focus and responsive behaviour.

**Deliverables:**

- `DESIGN_SYSTEM.md`
- `COMPONENT_GUIDELINES.md`
- `RESPONSIVE_DESIGN_GUIDELINES.md`

Implement the foundations and the components, but don't redesign every page yet. Report the files changed, the components updated and the tests run.

## Phase 3: shell, navigation, Home and Today

**1. Navigation.** Review:

- the desktop sidebar and mobile navigation
- grouping and section hierarchy
- icons and labels
- active and selected states
- expanding and collapsing
- density
- search and quick navigation

**Areas:**

- Home and Today
- Tasks, Inbox, Projects and Goals
- Habits, Focus and Calendar
- Work and Research
- Self-Improvement
- Gym & Fitness and Health
- Personal Life
- Dates & Occasions
- Notes and Journal
- Miscellaneous tools
- People, Reviews and Analytics
- Vault, Backup, Sync and Settings

Don't expose everything at once if a better information architecture is simpler. Don't remove or hide anything without documenting why.

**2. Home** becomes a meaningful overview of life and productivity: prioritise, no excess metrics or widgets, and give useful context.

**3. Today** is the execution workspace:

- today's tasks
- upcoming deadlines
- scheduled activities
- habit progress (note: this conflicts with the earlier "habits only on Habits" decision; logged in the decisions log)
- important reminders
- relevant events

Home and Today must not become duplicate dashboards.

**4. Interaction quality:**

- navigation transitions
- page headers
- search
- quick actions
- responsive behaviour
- feedback

**Constraints:** keep routes, functionality, data and logic. Don't redesign the individual sections yet.

**Deliverables:** implement the shell, navigation, Home and Today. Document the navigation decisions and the remaining usability problems. Test on desktop and mobile.

## Phase 4A: productivity and work sections

**Sections:**

- Tasks, Inbox, Projects, Goals
- Habits, Focus, Calendar
- Research, Thesis, Coursework, Adviser Meetings
- Updates and Ideas

**For each one:**

1. Understand its workflows before changing anything.
2. Identify the key actions.
3. Improve the hierarchy and organisation.
4. Simplify confusing or repetitive interactions.
5. Improve forms, editors, dialogs and action menus.
6. Make the important actions easy to find.
7. Improve the empty, loading, completed, overdue and error states.
8. Keep it consistent with the rest of the app.

Pay particular attention to how Tasks, Projects, Goals, Habits, Calendar and Focus relate to each other.

No duplicated functionality, no new business logic, and keep all features and data. Test the main workflows after each section.

## Phase 4B: Health, Gym and Self-Improvement

**Sections:**

- Gym & Fitness
- workouts and workout history
- gym consistency and analytics
- Health
- Learning & Skills
- other Self-Improvement features

Clarity comes before decoration.

**Gym:**

- weekly schedule
- routine management
- exercise and set management
- start and end workout
- history
- rest and skipped days
- consistency
- progress and analytics

**Habits:**

- daily list
- completion states
- habit details
- the Gym-linked habit card
- Start Workout, End Workout and Skip
- weekly progress
- history

**Health:**

- daily overview
- daily plan
- repeating activities
- time windows
- events
- meals, water and sleep
- reminders and undo

Keep the Gym ↔ Habits link. Make it clear what is planned, completed, skipped, missed or a rest day. Don't change the tracking logic or historical records. Test the interactions in both themes.

## Phase 4C: Personal life and miscellaneous

**Sections:**

- Movies & Series, Places, Trips, Dates & Occasions
- Journal, Notes
- Shopping, Expenses, Household, Documents
- People, Reviews, Analytics, Custom Lists
- Vault and App Lock, Backup and Sync, Settings

**Not identical cards.** Each section follows its purpose:

| Section   | Priority                    |
| --------- | --------------------------- |
| Occasions | Calendar and upcoming       |
| Journal   | Writing and reading comfort |
| Notes     | Organisation and editing    |
| Expenses  | Financial summaries         |
| Movies    | Browsing and tracking       |
| Vault     | Privacy and security        |
| Analytics | Readable charts             |

All sections keep the same design language.

Keep all features, security behaviour, data and workflows. Test create, edit, delete, search and navigation.

## Phase 5: polish and micro-interactions

**Review the whole app for:**

- spacing
- typography
- alignment
- hierarchy
- button sizes
- icon sizes
- excess borders and containers
- contrast
- clutter
- page headers
- awkward responsive layouts

**Micro-interactions:**

- hover and pressed states
- restrained transitions
- dialogs and drawers
- toasts
- loading feedback
- skeletons
- empty states
- success and error feedback
- undo
- focus

Use animation only where it helps understanding, and respect reduced motion. No new dependencies or logic changes. Test both themes and all major sizes. Report what remains inconsistent.

## Phase 6: final quality audit

Act as an independent UX researcher, designer and QA engineer. Don't assume the redesign succeeded.

**1. Explore every section and submenu.** Run these workflows:

- start the day
- create and complete tasks
- organise projects
- track habits
- start and end a workout
- record health
- add an occasion
- write a journal entry
- use notes
- review analytics
- change settings and themes

**2. States:**

- empty, partially populated and fully populated
- long titles
- large lists
- overdue and completed items
- error and loading states
- modals and dropdowns

**3. Responsive:** desktop, laptop, tablet and mobile. Look for:

- horizontal overflow
- clipping
- badly placed controls
- inaccessible actions
- spacing
- navigation
- touch targets

**4. Accessibility, to WCAG 2.2 AA:**

- keyboard
- focus visibility
- semantics
- contrast
- screen-reader labels
- reduced motion
- status beyond colour

**5. Grade issues** as Critical, High, Medium or Low. For each, give the page or component, the problem, why it matters and the fix.

Make no further changes until the findings are documented. Write `FINAL_UI_UX_QUALITY_REPORT.md` as an honest assessment.
