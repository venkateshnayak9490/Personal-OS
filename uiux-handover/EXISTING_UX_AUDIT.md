# Existing UX and accessibility audit

This audit describes the app as it is on 18 Nov 2026, working tree after commit `7a3bafe` (the "section pages" change is built but not yet committed). It lists observations only. Nothing here has been fixed.

**Sources.**
- Screenshots in `uiux-screenshots/`. These come from the production build at 1440 × 900 and 390 × 844, with sample data entered through the UI.
- The source code.
- The end-to-end test suite: 122 tests on phone and desktop viewports, all passing.

**Verified** means seen in a screenshot or confirmed in code. **Needs manual testing** means it can't be confirmed without a real device, a screen reader or a person using the app.

> Screenshot caveat: full-page captures show the fixed phone bottom bar and the sticky desktop sidebar part-way down long pages. That is how full-page screenshots stitch fixed elements. It is not a layout bug.

---

## 1. Verified issues

### Visual hierarchy

| # | Observation | Where | Evidence |
|---|---|---|---|
| V1 | Page titles come in five or more sizes (about 28–48 px): the Today greeting is 48 px, page headers 36 px, section pages 32/36 px, the workout title is an input styled like a title, and Home uses a display font. Section headings are split between 15 px and 14 px styles. | All pages | `DESIGN_SYSTEM.md` → Typography; `desktop/dashboard/today.png` vs `desktop/planning/habits.png` |
| V2 | On Today, the "Finish setting up" checklist sits above today's tasks and takes most of the first screen until it's hidden (about 400 px desktop, 700 px phone). | Today | `desktop/dashboard/today.png`, `mobile/dashboard/today.png` |
| V3 | On section pages with their own list, the empty notes placeholder ("Write anything…") floats between the list and the Tasks heading as grey text with no frame. It reads like a stray caption. | Research, Movies, etc. | `desktop/sections/research.png` |
| V4 | Coming up repeats words: "Amma's birthday · Birthday". The occasion also shows a red flag icon, the same icon deadlines use. | Today → Coming up | `desktop/dashboard/today.png` |
| V5 | A disabled primary button (an empty "Add") renders as a solid grey slab. It looks like a different button style rather than a disabled one. | List add boxes | `desktop/sections/research.png` |

### Navigation clarity

| # | Observation | Where |
|---|---|---|
| N1 | There are two "home" ideas. **Home** (`/home`, the section map and check-in) is where the installed app opens. **Today** (`/`) is where the site opens in a browser and where you land after onboarding. Both use dashboard-like icons on desktop. |
| N2 | Tasks added on All Tasks without a section count toward the **Inbox** badge (5 in the screenshots). New users may not expect "add a task" there to land in an inbox. | `desktop/dashboard/today.png` sidebar |
| N3 | Sections can be reached four ways: the sidebar tree, Home map, `/sections` list (reachable from More), and subsection chips. The `/sections` page and the Home map overlap. |
| N4 | The phone bottom bar has 3 customizable tabs plus fixed ＋ and More. `build.md` says 4 customizable; the code allows 3 (by design, More stays fixed). |
| N5 | **Phones have no way to search.** The command palette opens only via Ctrl/⌘+K (`src/app/AppShell.tsx`) or the Search button in the desktop sidebar (`src/app/Sidebar.tsx`), and both are unavailable on a phone. The `N` shortcut is desktop-only too; phones use the ＋ button. |

### Layout consistency

| # | Observation | Evidence |
|---|---|---|
| L1 | Segmented controls are hand-built 6+ times with different heights (h-8/h-9/h-10/h-11, md:h-7/h-9) and text sizes. A global phone CSS rule forces 44 px, so the written classes and the rendered size differ. | `DESIGN_SYSTEM.md` → Inconsistencies |
| L2 | Cards: the shared `Card` component is used only in Settings and Placeholder. About 38 hand-made cards mix `rounded-xl` and `rounded-2xl`, and some sections use `rounded-3xl`. | same |
| L3 | Coming up's date column is fixed-width, so "Wed 25 Nov" wraps onto two lines while other rows stay on one. | `desktop/dashboard/today.png`, `mobile/dashboard/today.png` |
| L4 | List board columns run off the right edge with no fade or scroll cue. On Research the 4th column "Summarized" is cut off. | `desktop/sections/research.png` |
| L5 | In the content column, the heading row and toolbar (add box + Table/Board) wrap differently between embedded lists and the full list page. |

### Component consistency
- C1. 80+ raw `<button>` elements bypass the shared `Button` (Sidebar, TaskComposer, UpdatePrompt, Reminders, setup checklist, habit cells). Hover, focus and disabled styles therefore vary.
- C2. Section color has two systems: the sidebar uses palette classes, and the area tokens `--sec-*` are used elsewhere. `sec-self` (green) is also reused as the generic "done/success" color. Priority, success and rating-star colors are raw Tailwind colors outside the token set.
- C3. Native `<select>` is used for many pickers (section, repeat, timezone, move-to) next to custom radio chips for similar choices (priority, mood).

### Phone responsiveness (390 px)
- M1. In-app reminders stack bottom-right and **cover page content**. On a phone one reminder covers the setup checklist and the Today heading. On desktop three stacked reminders cover the right side of Today. Each needs dismissing. Evidence: `mobile/dashboard/today.png`, `desktop/light-theme/today.png`.
- M2. Board views scroll sideways inside the page. Columns are 256 px wide, so one column fits and the next peeks in (intended). The "Move…" picker on each card is the phone alternative to drag and drop.
- M3. The Today greeting wraps to two large lines and pushes content down. The motivational line under it adds a third block before any task.
- M4. Weight, water and energy inputs sit in a two-column grid in the Check-in card. This is fine at 390 px but tight on smaller phones (not tested below 375).

### Desktop responsiveness (1440 px)
- D1. Content is capped at `max-w-5xl` (1024 px), which leaves wide empty margins at 1440. That suits reading, but tables and boards (lists, analytics) can't use the extra width.
- D2. The sidebar is resizable (200–420 px). Its section tree truncates long names at the default width.

### Forms and validation
- F1. Most forms validate by **disabling the submit button** (for example "Create" stays disabled until a name is typed) and give no inline message saying why.
- F2. Repo-level errors show as toasts (for example "Use at least 4 characters.", "Name the routine"). That puts messages away from the field.
- F3. Time and date use native inputs (`type=time`, `type=date`) in Health, Gym and Occasions, but the custom DatePicker in tasks and goals. Two different date-entry experiences.

### Loading and empty states
- E1. Every page shows a centered `Loading` spinner until IndexedDB answers. It's usually invisible (a few milliseconds).
- E2. Empty states are written to teach, for example "Nothing here yet — Add your first title above". They are consistent on list pages, but the empty task list ("All clear / No tasks here yet") sits far below on section pages.
- E3. Before a section's own list exists, it shows only its name, a hint and an add box (`SectionList`). That's clear but looks different from the populated list.

### Error handling
- R1. Every write goes through `attempt()`, which logs the error and shows an error toast. There's no retry action, and no per-field highlighting.
- R2. Unknown routes show an in-app "not found" message (`navigation/not-found.png`). Deleted items show "doesn't exist" with a link to Trash.
- R3. Offline: the app works fully offline (local database). The account card says "offline, will sync" once sync is set up.

### Interaction feedback
- I1. Destructive and status actions show an **Undo** toast (complete, skip, delete, move to tomorrow, hide section).
- I2. Ticking a task animates the check, and the task lingers about 1 s before leaving the Open list.
- I3. On phones, swiping a task row shows a colored backdrop with the label "Complete" or "Tomorrow", and it commits at 88 px.
- I4. Habit day cells cycle done → skipped → rest → cleared on repeated taps. That's explained only in the page subtitle.

---

## 2. Accessibility (verified in code)

| Area | Status |
|---|---|
| Landmarks | `main`, `aside` ("Main navigation", desktop), `nav` ("Main navigation", phone) and labelled `section`s throughout. Tests rely on these roles. |
| Names | Icon buttons have `aria-label`s (e.g. "More actions for {task}", "Section options"). Checkboxes for tasks use `role="checkbox"` with `aria-checked`. |
| Dialogs | Sheets and menus use Radix primitives: focus trap, Escape closes, focus returns to the trigger. |
| Keyboard | `N` adds a task, Ctrl/⌘+K opens search, and the sidebar resize handle works with the arrow keys. FullCalendar buttons have focus-visible outlines. |
| Touch targets | The phone rule forces tabs and radio groups to at least 44 px, and buttons are 40–44 px on phones. Task checkboxes are 22 px visually with a 44 px hit area through a pseudo-element. Desktop targets are 28–32 px. |
| Motion | `prefers-reduced-motion` is respected by the CSS animations (see `DESIGN_SYSTEM.md` → Animations). |
| Color only | Habit status uses icons as well as color (✓ / – / moon). The on-time and late dots in Health's 14-day view are **color only** (green/amber/grey), with the state in a `title` tooltip that touch users can't reach. |
| Contrast | Muted text (`--muted`) on surfaces is used heavily for metadata at 11–13 px. It needs measuring in both themes. |
| Live regions | The sync status uses `aria-live="polite"`. Reminders use `role="alert"`. Toasts: see `src/app/toast.tsx`. |

---

## 3. Needs manual testing

1. **Screen reader pass** (TalkBack on Android, NVDA on desktop): reading order on Home's tree map, board columns, and the habit week grid (7 buttons per row).
2. **Contrast measurement** of `--muted` text, the `sec-*` accent text on surfaces, and disabled buttons, in dark and light.
3. **Real-phone gestures**: whether a swipe on a task row conflicts with Android's back gesture near the screen edge, and whether a slow vertical scroll is mistaken for a swipe.
4. **Keyboard-only use** of list tables, board cards (drag has no keyboard alternative on desktop; the Move… picker is phone-only), and the habit grid.
5. **Reminders on a real device**: background notifications while the tab is hidden, and how many stack up after a long absence.
6. **Installed PWA**: update prompt flow, opening on Home from the app icon, Share Target from another app.
7. **Small phones (320–360 px)** and **tablets (768–1023 px)**. The tablet sidebar shows an icon rail and wasn't screenshotted.
8. **Large data**: 200+ tasks, long section trees, a 2-year habit history (performance and scroll).
9. **Zoom to 200%** and OS large-font settings on phones.

---

## 4. Already-known product gaps (not UX defects)
- Reminders fire only while the app is open (no Web Push). The `.ics` export is the workaround.
- Sync needs a Supabase project, which isn't set up yet.
- No AI features. Google Calendar is not connected.
- Some sections show mismatched motivational lines, for example "Call someone you've been meaning to call" on Movies & Series.
