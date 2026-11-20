# Phase 5: polish report

## What the pass checked

**Automated checks**
- The impeccable design detector ran over every file the redesign changed (`git diff main`, `.tsx` and `.css`). It found nothing.
- `tsc`, `eslint` and the unit and end-to-end suites pass (see the commit).

**By eye**, in dark and light, at four sizes (1440×900, 768×1024, 390×844, and the pane width):
- Today, Home, All Tasks, Habits, Projects, a project page, Goals, Focus, Calendar
- the Work, Gym & Fitness, Health, Dates & Occasions, Expenses and Movies section pages
- People, Settings, Analytics, Journal

## Fixed in this pass

**Leftover pill shapes** (rounded-full chips that predate the system) were squared to match every other control:
- the onboarding profile choices
- occasion badges
- skip-reason chips
- tag chips and the tag picker
- the section dialog's colour and icon choices
- the phone focus-timer chip
- the "+N more reminders" key

**Green "done" fills** now follow the rule that done is ink:
- the setup checklist ticks and progress bar
- the analytics and habit heatmap (ink at four strengths)
- the task swipe background (ink for Complete, the info tint for Tomorrow, where it had used the Work area colour)

**Elevation:** reminder cards and the focus-timer chip sit on the raised surface (`surface-3`), the same as menus.

**Titles:**
- A list opened on its own page, and the 404 page, now carry the title rule.
- The onboarding headline is bold over a rule at 32–40px, down from 40–48px.
- The settings index no longer draws a second rule under its title.

## Micro-interactions (already in place, verified)

- **Press:** every `Button` scales to 0.97 and darkens.
- **Hover:** rows and ghost buttons tint `surface-2`.
- **Overlays:** sheets rise from the bottom on phones and slide in from the right on desktop. Dialogs settle in place. Exits are faster than entrances.
- **Completing a task:** the check ticks (`anim-check`). The row stays with its ink tick for a moment, then leaves, and a toast offers Undo.
- **Toasts:** one at a time, inverted colours, Undo for 6 s.
- **Loading:** nothing shows for the first 250 ms, then a skeleton of a ruled page, then a reload offer after 6 s.
- **Focus:** a 2px focus ring everywhere. On the ink-blue shell it switches to the light shell colour so it stays visible.
- **Reduced motion:** every animation and transition is cut to almost zero.

## Remaining visual inconsistencies

These are known and left on purpose, or need your decision:

1. **Class times show AM/PM** (Coursework) while the rest of the app uses 24-hour. An end-to-end test expects "9:00 AM". Changing it is a one-line format change plus that test.
2. **Phone boards scroll sideways** instead of showing one status at a time (decisions log #10).
3. **Health** uses its own L and E letters (late, early) beside the shared ✓ mark. A shared "late" mark would unify them.
4. **People** shows its list header like other built-in lists. Its title has no rule when it's embedded as a block, which is correct for a block but looks lighter than other screens.
5. **FullCalendar internals:** the event popover and the "+N more" link keep some library spacing.
6. **On day one**, the setup checklist still comes before the tasks on Today (deliberate, but long on phones).
7. **Sidebar section rows** don't show open counts (Home does).
8. **The schedule's tick labels** truncate when an item's title is long. The full title is in the tooltip and the accessible name.
9. **A pre-existing unit-test warning** (`DatabaseClosedError` in `AppShell.test.tsx`) predates the redesign. Every test passes.
