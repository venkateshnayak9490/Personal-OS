---
version: 1
slug: "src-app-appshell-tsx"
primary_target: "src/app/AppShell.tsx"
related_targets: ["src/index.css","src/components/ui.tsx","src/pages/DashboardPage.tsx","src/pages/HomePage.tsx","src/pages/TasksPage.tsx","src/pages/HabitsPage.tsx"]
---

# App shell and daily screens

**Scope:** the whole app UI (shell, Today, Home, Tasks, Habits, then sections and the other screens).
**Mode:** Operate.

**Audience and task:** the owner, every day, on a desktop and an Android phone. Open the app, see today's work, check in, capture tasks, tick habits.

**Constraints:**
- no behaviour or data changes
- decisions of 2026-11-19 hold
- colour means area
- 44 px phone targets
- no backdrop blur
- motion only on action

**Chosen:** Direction A, Timetable, on 2026-11-20.
- **Prototype:** `docs/design-direction/prototypes/a-*.html`
- **Rationale:** `docs/design-direction/DESIGN_DIRECTION_PROPOSALS.md`

**Unresolved:**
- the font package (Public Sans), pending the user's OK
- the rule for timetable items under 45 minutes

## Direction contract

THESIS: Life set as a course timetable and attendance register: every item has a period and an area code, and habits are marked, not filled. It refuses the graphite card-dashboard.

OWN-WORLD:
- **Ground and ink:** a cool sheet `#f3f5f7` with ink `#17202b`; dark is an ink-blue night `#0f151c`.
- **Shell:** an ink-blue sidebar and tab bar, `#1b2735`.
- **Rules instead of cards:** hairline `#d5dbe2` and strong `#a3afbc` rules; tables are the only boxes. A 2 px ink rule sits under the H1 and the table heads.
- **Radii:** 4 px everywhere.
- **Type:** Public Sans with tabular figures, in three sizes (21/14/12.5) and three weights.
- **Area colours:** they mark area only (period rules, square chips, map heads).
- **Status:** done is an ink tick; danger is vermilion.

STORY: The owner opens Today and reads the day as periods: what is timed, what is any time, what is late. They check in on Home in one table, and mark habits in a register without guessing what a colour means.

FIRST VIEWPORT:
- **Sidebar:** the ink-blue sidebar on the left (236 px), with New task at the top.
- **Page:** a sheet up to 1040 px with a 21 px H1 over a 2 px rule.
- **Home:**
  - the check-in table first
  - next up as ruled rows
  - Friday's timetable on a 08–21 axis with a vermilion now-line
  - then the ruled section map
- **Tasks:** a time column whose right rule carries the area colour.
- **Primary action:** New task in the sidebar, and ＋ in the phone tab bar.
- **Signature:** the time axis and the register.

FORM: the university course timetable and attendance register, candidate 3 of 7 on the ordered list; seed:28abf9dc75606eda.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
