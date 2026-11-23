# UI/UX redesign recommendations

This is limited to changes that improve **usability**. The detailed design-system inventory (type sizes, buttons, cards, tokens) is already in `uiux-handover/DESIGN_SYSTEM.md` and `EXISTING_UX_AUDIT.md`. It's summarised here, not repeated.

## 1. Fix first (usability, not looks)

| ID  | Issue                                                                                                                                                                         | Recommendation                                                                                                                                                                                                                                | Priority | Complexity |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| UI1 | Toasts and reminder cards stack at the bottom on phones and **cover content and buttons**: two toasts covered the Gym card and its Undo; a reminder covered "Add reason" (X1) | <ul><li>One toast at a time (a newer one replaces the older, or queues behind it).</li><li>Reminders collapse into a slim bar that expands on tap.</li><li>Pages get bottom padding equal to the overlay height while one is shown.</li></ul> | P1       | S–M        |
| UI2 | The setup checklist and nudges come before the tasks on Today (A4, A5)                                                                                                        | Move them below the tasks, or show one dismissible line ("3 setup steps left"). Auto-hide "install the app" once installed and "backup" once a backup exists (already detected).                                                              | P1       | S          |
| UI3 | Habit day cells cycle through four states on repeated taps (D1)                                                                                                               | <ul><li>A tap toggles done / not done.</li><li>A long press or menu gives Skip (asks a reason), Rest and Clear.</li><li>Show the hint once as an inline tip, not in the page subtitle.</li></ul>                                              | P1       | S          |
| UI4 | Color-only on-time dots on Health (E2)                                                                                                                                        | Add a shape or letter (✓ / L / –) and a tap-to-see popover that works on touch                                                                                                                                                                | P2       | S          |
| UI5 | Most forms say what's wrong only by disabling the submit button (X2)                                                                                                          | Use the newer pattern everywhere: inline status text under the form ("Give it a name"). Keep the disabled button.                                                                                                                             | P2       | S–M        |
| UI6 | A blank first paint while the database opens (X4)                                                                                                                             | A lightweight skeleton of the page header plus 3 rows                                                                                                                                                                                         | P3       | S          |
| UI7 | Analytics tiles show "—" with "0 logged" for unused features (K2)                                                                                                             | Hide tiles with no data in the period, or show one line "No meals logged this week"                                                                                                                                                           | P2       | S          |

## 2. Page-level redesigns (structure, not decoration)

### Home (P1, M)

Detailed in `NAVIGATION_AND_INFORMATION_ARCHITECTURE.md` §4.

- **First screen:** the check-in and next up. Habits stay on the Habits page.
- **Map:** below, collapsible.
- **Goal:** on a phone, the check-in is visible without scrolling. The app itself opens on Today.

### Today (P1, S)

The order becomes: overdue bar → today's tasks → events → Coming up → projects → nudges. The greeting goes down to one line on phones; the motivational line stays optional (it's already a setting).

### Health (P2, M)

| Order | Block                                 |
| ----- | ------------------------------------- |
| 1     | Today, including plan items due now   |
| 2     | Appointments (next 2)                 |
| 3     | History (merged, RD9)                 |
| 4     | Repeating items management, collapsed |

The "Set your daily plan" prompt becomes an inline card **within** Today's plan, not a separate block above it.

### Gym & Fitness (P2, S)

| Order | Block                                  |
| ----- | -------------------------------------- |
| 1     | Today's workout hero                   |
| 2     | Weekly schedule (with done ticks, RD8) |
| 3     | Consistency                            |
| 4     | Recent workouts                        |
| 5     | Routines, collapsed                    |

Programs and "Create" stay in the routines header.

### Section pages (P2, S)

- **Order:** tools first (lists, outline), then the notes area.
- **Notes:** collapsed to a "Notes" header when empty (earlier V3: the floating "Write anything…" placeholder).
- **"Tasks 0 open":** shown as an add-line, not as a heading with a zero.

### Settings (P2, S)

Split into four sub-pages (RD19). On phones each one is a short list.

## 3. Consistency (one design pass, P2–P3)

These come from `uiux-handover/DESIGN_SYSTEM.md`. They matter because inconsistency makes the app feel unfinished and slows scanning, not for looks alone.

| Area                    | Today                                                                                       | Recommendation                                                                   | Priority |
| ----------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| Page titles             | 5+ sizes (28–48 px)                                                                         | Two: an H1 for screens, an H2 for blocks                                         | P2       |
| Buttons                 | 80+ raw `<button>`s with varying hover, focus and disabled styles                           | All through the shared `Button`                                                  | P2       |
| Segmented controls      | 6+ hand-built, with different heights                                                       | One `Segmented` component (Week/Month/Year, One week / Every week, mode pickers) | P2       |
| Cards                   | rounded-xl/2xl/3xl mixed                                                                    | Two radii: containers 2xl, inner tiles xl                                        | P3       |
| Color                   | `sec-self` green is also "done" and "success"; raw Tailwind colors for priority and success | Separate status tokens (done, warning, danger) from section colors               | P3       |
| Date input              | native vs custom picker (RD18)                                                              | The custom picker for dates; native time inputs                                  | P2       |
| Disabled primary button | a solid grey slab                                                                           | Lower opacity of the primary color                                               | P3       |

## 4. Mobile and desktop

- **Phone:**
  - 44 px targets are already enforced.
  - The main phone problems are page length (Health 2.4 screens, Settings 4.6) and overlays (UI1). The structure changes above fix both.
- **Desktop:**
  - Content is capped at 1024 px. Keep it for reading pages.
  - Let tables, boards, the calendar and analytics use the full width.
  - The sidebar groups (IA §4) make it scannable.
- **Not tested:** tablets (768–1023 px) and small phones (≤360 px). Check them during the redesign.

## 5. What not to redesign

Leave these as they are:

- the outline editor
- plain-language capture
- swipe on task rows
- Undo toasts (just one at a time)
- the Occasions calendar
- the Gym card in Habits
- the weekly schedule's "One week only / Every week" choice
- dark/light theming
