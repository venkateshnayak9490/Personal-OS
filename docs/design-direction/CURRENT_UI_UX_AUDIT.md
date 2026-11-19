# Current UI/UX audit: the interface as it stands

**Scope:** the look and feel of the app after UX audit Phases 1–4 (commits `d7d9f56` … `9220cb9`). It doesn't repeat the functional audits in `docs/ux-audit/` and `uiux-handover/`; it refers to them.

**What I checked:**
- **The running app:** `npm run dev`, a fresh Researcher profile, 20 Nov 2026, desktop 1440 × 900 and phone 375 × 812.
- **The populated captures:** `uiux-handover/uiux-screenshots/` (18 Nov, before Phases 1–4).
- **The styling source:**
  - `src/index.css`
  - `src/components/ui.tsx`
  - `src/app/Sidebar.tsx`
  - `src/app/BottomNav.tsx`
  - `src/app/nav.ts`
  - the Home, Today, Tasks and Habits pages

## 1. How the product is used

| Workflow | Frequency | Surface today |
|---|---|---|
| Open the app and see the day | Several times a day | Today (`/`): greeting, overdue, today's tasks, events, Coming up |
| Morning check-in (sleep, mood, energy, water) | Daily | Home → Check-in (first block since Phase 2) |
| Capture a task | Many times a day | `N`, the sidebar's New task button, the phone ＋, the quick-add box on Tasks and Today, share-to-app |
| Tick habits | Daily | Habits page only (decision 2026-11-19) |
| Work a section's tools (Gym, Health, Thesis, Papers) | Daily to weekly | `/s/:id` section pages |
| Review and plan the week | Weekly | Reviews |
| Find anything | As needed | ⌘K palette (desktop), phone search |

**How the screens connect:**
- Every task, habit, note and list belongs to a section, and every section belongs to one of four areas (Work, Self-Improvement, Personal Life, Miscellaneous).
- The area is the one piece of information that travels everywhere, so its colour is the product's main visual signal. This is a brand commitment in `PRODUCT.md`.

## 2. The current visual system

**Colour**
- "Graphite and paper": a warm off-white `#f5f3ef` and graphite `#1c1c20` in light; `#131316` in dark.
- The primary action is ink on paper, with no brand hue.
- Four area colours: Work `#4f5bd5`, Self `#0f8a5f`, Personal `#d6345a`, Misc `#b7791f`.
- Separate status tokens (`--success`, `--warning`, `--danger`) since the last commit.

**Type**
- Inter Variable for the UI.
- Bricolage Grotesque for page titles, the date and the greeting.
- Two title sizes since `9220cb9`.

**Shape**
- Mostly `rounded-xl` and `rounded-lg`. Phones use larger radii and heights (44 px), desktop is denser.

**Components**
- Shared: `Button` (4 variants), `Input`, `Textarea`, `Select`, `Segmented`, `Sheet`, `Menu`, `DatePicker`, `PageHeader`.
- About 80 places still use raw `<button>`s with their own classes (handover `DESIGN_SYSTEM.md`).

**Motion**
- Action-driven only:
  - sheets rise
  - dialogs settle
  - checks pop
- Reduced motion is respected. This is good and should be kept.

**Navigation**
- **Desktop:** a sidebar grouped as Plan, Build, Track, Sections and Personal, with Settings and Trash at the foot.
- **Phone:** bottom tabs Home · Today · ＋ · Tasks · More.

## 3. Findings

Severity:
- **High:** hurts daily use or trust.
- **Medium:** slows scanning or feels unfinished.
- **Low:** polish.

### 3.1 Identity

| # | Finding | Evidence | Severity |
|---|---|---|---|
| V1 | The app has no visual identity of its own | Graphite and warm paper, Inter, a black primary button and soft rounded panels are the category default. With the name covered, the Tasks page could be any to-do app. The one distinctive element, colour-coded life areas, shows only as small icons in the sidebar and dots in meta lines. | High (for this redesign's goal) |
| V2 | Area colour is underused for what it means | The commitment is that colour means area, but on Today, Tasks and Habits a task's area is an 8 px dot in grey meta text. You can't tell at a glance that the day is mostly Work. | Medium |
| V3 | Display face doing too little | Bricolage Grotesque appears only in titles. It adds a second voice without carrying any meaning, and its rounded quirks fight the dense UI around it. | Low |

### 3.2 Hierarchy and density

| # | Finding | Evidence | Severity |
|---|---|---|---|
| H1 | Containers inside containers | Today and Home wrap every block in a bordered, rounded panel (`today.png`, `home-section-map.png`). Rows inside those panels then get their own rules. It reads as a stack of cards rather than one page. | Medium |
| H2 | Phone Tasks spends a third of the screen on filters | At 375 × 812 the add box plus three filter rows (When, Section, Status) take about 260 px before the first task. | Medium |
| H3 | Meta lines differ by screen | The same task shows "Today" with a calendar icon on All Tasks, a date column in Coming up, and a section dot elsewhere. There is no single row anatomy. | Medium |
| H4 | The greeting is large on Today | "Good morning, Venkatesh" uses the display face at the H1 size and pushes the tasks down. On a phone it costs a line and a half before any work is visible. | Low |
| H5 | The section map is wide but shallow | At 1440 px the four-column tree leaves a large empty area under the shorter columns, while Work runs long. | Low |

### 3.3 Components and consistency

| # | Finding | Evidence | Severity |
|---|---|---|---|
| C1 | About 80 raw buttons | Hover, focus and pressed states vary, and some have no visible focus beyond the global outline (handover `DESIGN_SYSTEM.md`) | Medium |
| C2 | The habit cell states rely on colour and icon fill | Done is a green fill with a tick; skipped and rest are subtle variants. In dark mode the empty, future and missed cells are hard to tell apart (`habits.png`). | Medium |
| C3 | The section select is a native `<select>` next to the custom Segmented control | Different height, radius and focus ring on the Tasks filter row | Low |
| C4 | Radii are mixed | `rounded-xl`, `rounded-2xl` and `rounded-lg`, with different values on phone and desktop | Low |

### 3.4 Phone

| # | Finding | Evidence | Severity |
|---|---|---|---|
| P1 | On day one, the setup checklist comes before the tasks | Deliberate (`DashboardPage.tsx:115`: "above the tasks on day one"). On a phone it fills the first screen with 6 rows (`today-first-run-setup-checklist.png`). | Low (deliberate; revisit with the new layout) |
| P2 | Bottom bar: the ＋ is a solid light circle with no label | Fine. Keep it, but restyle it in the chosen world. | — |
| P3 | Reminder cards and toasts | Fixed in Phase 1 (one at a time, a slim bar) | Fixed |

### 3.5 Accessibility (spot checks)

- **Contrast:** muted text `#6b675e` on `#f5f3ef` is 5.1:1, and `#9c998f` on `#131316` is 6.5:1. Both pass AA.
- **Focus:** a global `:focus-visible` outline uses the accent. On the ink primary button, the outline is the same colour as the button.
- **Targets:** 44 px on phones is enforced in the shared components. Raw buttons don't all follow it.
- **Status by colour alone:** habit cells (C2) and the Health on-time dots (`uiux-handover/EXISTING_UX_AUDIT.md`).

## 4. What to keep

These carry the product and should survive any direction:
- **Structure:**
  - the shell (grouped sidebar, phone tab bar with ＋, command palette)
  - two title sizes
  - one Segmented control
- **Interactions:**
  - action-only motion with reduced-motion support
  - Undo toasts, one at a time
  - swipe on task rows
  - the outline editor
- **Copy:** plain-language capture and copy ("I'm up", "Move all to today").
- **Colour rules:**
  - the four area colours, and the rule that colour means area
  - status colours kept separate

## 5. What the redesign must fix

In order of impact:
1. Give the product an identity that comes from its own content, the four life areas, not from a borrowed palette (V1, V2).
2. Replace cards-in-cards with one page structure: rules, spacing and alignment (H1, C4).
3. Give every item type one row anatomy across all screens (H3).
4. Draw habit states with marks that work without colour (C2).
5. Make Tasks on the phone start with tasks (H2).
6. Move every button onto one component with a full state set (C1, C3).

Section 6 of the proposals document scores each direction against these six points.
