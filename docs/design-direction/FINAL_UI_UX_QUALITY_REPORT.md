# Final UI/UX quality report: Timetable redesign

Branch `redesign/timetable` at commit 6bbb53c, tested on 2026-11-20 against the dev server (http://localhost:5174). I tested the app as a user would, through the in-app browser. I also read the source to confirm causes. I changed no code.

## Overall assessment

**What works.**
- On laptop and desktop the redesign is calm and consistent. The ruled sheet, the ink-blue shell, the single type family, the 2px title rules and the register-style habit grid hang together.
- Both themes are applied fully by the setting, and text contrast is strong: body and muted text measured 5.2 to 14.9:1.
- Across 22 routes I found no unnamed controls. Sheets trap focus and close with Escape. `prefers-reduced-motion` is handled globally.
- Forms such as New habit and New occasion explain why Save is off ("Give it a name").
- At 1280 and 1440 no page scrolls sideways.
- The Timetable idea (the schedule axis on Today, ticks for short items) reads well at 1440.

**What does not work.**
- The product does not yet feel trustworthy. Habits, Gym, Analytics, Home and Today give different numbers for the same day or week.
- Quick add silently rewrote one of my task titles.
- A persistent reminder stack sits on top of content at every size.
- On the phone, one long project name breaks Today: the page widens to 807px, and the tab bar leaves the screen.
- Control borders fail non-text contrast in both themes.
- Priority is shown only by colour, and it reuses the overdue colour.

**Against "premium, calm, consistent, distinctive".**
- **Distinctive:** yes, at desktop.
- **Calm:** mostly, except the reminder stack and the Occasions calendar.
- **Consistent:** visually yes, behaviourally no. Numbers, time formats and validation differ by screen.
- **Premium:** not yet. The data contradictions and the phone fragility undercut it. The issues below are fixable and mostly local.

Counts: **1 critical, 5 high, 10 medium, 12 low.**

---

## Status after the fixes (2026-11-21)

C1 and H1–H5 are fixed on `redesign/timetable` (see the commit "fix: audit critical and high issues" and decisions log #13–15). M1 (Gym sideways scroll) was fixed by the same root-cause change as C1. M2–M10 are fixed too (commit "fix: audit medium issues"); M7's motivational-line dismiss and Journal checkbox already had 44px hit areas and needed no change. The low issues L1–L12 are fixed as well (commit "fix: audit low issues"); for L9 two date fields stay native on purpose (decisions log #18). Every finding in this report is now addressed.

## Critical

### C1. Phone: a long project name breaks the Today page and pushes the tab bar off screen
- **Where:** Today → "Active projects" widget (`src/features/dashboard/widgets.tsx:256`, `<ul className="grid gap-x-8 sm:grid-cols-2">`).
- **Steps:**
  1. Create the project "Thesis chapter three: literature review on vision-language-action models for robotic manipulation in cluttered scenes" (117 characters, a realistic thesis title).
  2. Open Today at 390×844 in either theme.
- **Result:**
  - `document.documentElement.scrollWidth` is 807 against `clientWidth` 390. `innerWidth` becomes 807, so the layout viewport zooms out.
  - The project rows run off the right edge, and the page scrolls sideways.
  - The fixed bottom tab bar sits at y=1681 in a 1745px layout viewport, so it was not visible in the phone view.
  - This reproduced on every visit to Today. Home, Tasks and Projects stayed at 390.
- **Cause:** The grid items (`li`, then `a`, then a flex row) keep `min-width: auto`, so the `truncate` span can't shrink. Its min-content width (759px) sets the column width.
- **Why it matters:** Today is the screen the app opens on, and the phone is the main device. One ordinary piece of data breaks primary navigation.
- **Fix:**
  - Use `grid-cols-[minmax(0,1fr)]` on that list, with `sm:grid-cols-2` becoming `sm:grid-cols-[repeat(2,minmax(0,1fr))]`.
  - Add `min-w-0` to the `li` and the link.
  - Add a phone regression test with a 120-character project name. Also scan other `grid` lists for the same pattern (see M1).

---

## High

### H1. Habits, Gym and Analytics disagree about the same week
- **Where:** Habits page, Gym & Fitness section (week strip and Consistency), Analytics (Gym and Habits blocks), Today's habits line.
- **Steps (1440×900):**
  1. On Habits, the Gym row showed Thu 19 done. I ticked Fri 20 and right-clicked Wed 18 → Skip… → "Not feeling well". Habits then showed `S ✓ ✓` and "2/4".
  2. I opened Gym & Fitness.
- **What each screen showed:**
  - **Gym week strip** (accessible names): "Thursday: no workout / Not yet" and "Monday … Not yet" for past days, with a header of "0 workouts".
  - **Gym Consistency:** "This week 100% · 1 of 1 planned done · 0 skipped". The skip I had just logged does not count.
  - **After one workout:** Gym said "1 of 3 workouts".
  - **Analytics, week 16–22 Nov:**
    - The Gym block said "Planned days done 100% · 1 of 1 · 0 skipped".
    - The Habits block said "Gym 1 of 1, DSA practice 1 of 1". The Habits page said 2/3 and 1/7 for the same week.
  - **Habits page after the workout:** the Gym row read "Full body B ✓ Done 11:19–11:19". The workout I did was **Full body A**. B is the next one, as Gym's "Recent workouts" confirms ("Full body A · 0 min").
- **Why it matters:** The product promise is "see where you stand". When three screens give three answers, the user stops trusting all of them, and the Habits register stops meaning anything.
- **Fix:**
  - Derive the week from one function shared by Habits, Gym and Analytics.
  - In the Gym strip, show a habit tick as done (or as "done, no workout logged") and never as "Not yet" for a past day.
  - Count skips in Consistency.
  - Label the Habits line with the workout actually logged, and put the next routine day on its own line ("Next: Full body B").
  - Use "Not logged" for past days instead of "Not yet".

### H2. Quick add silently rewrites the title and overrides the chosen date
- **Where:** Today quick add (`TaskComposer`, `parseCapture` in `src/core/domain/capture.ts`).
- **Steps (1440×900):**
  1. On Today, with the "Today" chip selected, type "Buy groceries for the week including vegetables, … across multiple lines tomorrow".
  2. Press Enter.
- **Result:**
  - The "Understood" chip showed **Fri 27 Nov**, while the "Today" chip still looked selected.
  - The saved task is titled "Buy groceries **for including** vegetables…". The words "the week" were deleted from the title.
  - It went to Inbox, due 27 Nov.
  - "tomorrow" at the end was neither parsed nor removed.
  - The task vanished from the Today list I was adding to.
- **Why it matters:**
  - The app changed what the user wrote without a clear signal. Phrases like "for the week" and "this month" are common in task titles.
  - The visible "Today" chip says the opposite of what happens.
- **Fix:**
  - Parse only explicit date phrases (trailing ones, or ones marked with a token).
  - Highlight the matched words inside the input so they can be seen before saving.
  - Make the chip state follow the parsed date, or let an explicit chip choice win.
  - Say in the confirmation where the task went ("Added to Inbox, due Fri 27 Nov. Undo"). The phone sheet already does this; the inline Today composer does not.

### H3. The reminder stack covers content and controls at every size
- **Where:** Reminders stack (`src/features/reminders/Reminders.tsx:219`, `fixed right-4 bottom-4 z-40`; on phone `bottom-[5.5rem]`).
- **Evidence:**
  - **1440×900:**
    - It covers the "Next 7 days" link on Today.
    - It covers the Miscellaneous column of Home's section map.
    - It covers "About this project" on a project page.
    - It covers the **Name** and **Time zone** fields in Settings → General.
  - **390×844:** it fills y 668–780, a 112px band above the tab bar, on every page. It sits over task rows on All Tasks, over Next up on Home and over the calendar.
  - It stays open across navigation. It grew from "+2 more reminders" to "+4 more reminders" during the session.
  - It shares `z-40` with the sheet and palette scrims and comes later in the DOM, so it stays bright and clickable above the dimmed overlay of the command palette.
- **Why it matters:**
  - It hides real controls.
  - It breaks the "calm" goal on every screen.
  - The responsive guideline promises that pages leave room for the reminder bar; they don't.
- **Fix:**
  - Collapse it to a single-line chip (count plus the first title) that expands on tap.
  - On reading pages at desktop, dock it in the page gutter or the header instead of over the content.
  - On phone, add its height to the page's bottom padding while it is shown.
  - Put it below modal overlays (for example `z-30`).

### H4. Control boundaries fail non-text contrast (WCAG 1.4.11) in both themes
- **Where:** The `line-strong` token, which draws:
  - the default-priority task check
  - unchecked habit cells
  - inputs, selects and textareas
  - secondary buttons
- **Measured** from the computed CSS variables:

  | Theme | line-strong on `bg` | line-strong on `surface` | Required |
  |---|---|---|---|
  | Dark | 2.03:1 | 1.88:1 | 3:1 |
  | Light | 2.04:1 | 2.23:1 | 3:1 |

- **Why it matters:** For a normal-priority task, this border is the only visual sign that the check is a control. The same goes for the edge of every input. Low-vision users will miss them, and on an Android phone in sunlight the problem is worse.
- **Fix:**
  - Raise `line-strong` to at least 3:1 on `surface`, for example about `#5d6d80` in dark and `#7b8796` in light. Then check that it still reads as a quiet rule under block heads.
  - Alternatively, add a separate `control-border` token at 3:1 and keep `line-strong` for rules.

### H5. Priority is shown only by colour, and the colour is the overdue colour
- **Where:** Task check (`src/features/tasks/TaskBits.tsx:7`, `PRIORITY_STYLE`: urgent → `border-danger`, high → `border-warning`).
- **Steps:**
  1. On Today, move the two overdue tasks to today.
  2. Their meta now says "Today", but their checks keep the vermilion border.
- **Result:**
  - These tasks look exactly like overdue ones, and a user reads them as still overdue.
  - Priority appears nowhere else in the row, and the check's accessible name ("Complete Submit SMAI assignment 2 report") leaves it out.
- **Why it matters:**
  - It fails WCAG 1.4.1 (use of colour).
  - It breaks the design system's own rules: "Status is always paired with a mark or a word" and status colours are for overdue and missed.
- **Fix:**
  - Show priority as a word or flag in the meta line ("Urgent"), at least for urgent and high, and add it to the accessible name.
  - Keep vermilion for overdue only, and give priority its own non-status treatment, such as a filled weight on the flag icon.

---

## Medium

### M1. The Gym page scrolls sideways on phone after the first workout
- **Where:** Gym & Fitness → Recent workouts / Best lifts (`src/features/life/Workouts.tsx:51`, `grid gap-6 md:grid-cols-[1fr_16rem]`).
- **Result:** At 390×844, `scrollWidth` is 397 against 390. At 768 it is 754 against 753.
- **Cause:** The same `min-width: auto` grid problem as C1, here from "Full body A · 0 min · Goblet squat".
- **Fix:** Use `grid-cols-[minmax(0,1fr)]` and `min-w-0` on the children.

### M2. The undo toast expires in 6 seconds with no pause, and doesn't name the item
- **Where:** `src/app/toast.tsx:52` (`setTimeout(… t.undo ? 6000 : 4000)`, no hover or focus pause).
- **Steps:** Complete a task on Today, then move overdue tasks to Today. In both cases the toast was gone before I reached Undo.
- **Other problems:**
  - The message is "Marked complete", without the task name.
  - On Today the completed row disappears at once, so the "ink tick" done state is never seen.
- **Why it matters:** This is WCAG 2.2.1 (timing adjustable) for the only undo path. It also matters for slower users and for a phone held in one hand.
- **Fix:**
  - Pause the timer while the toast is hovered or focused, and extend it to about 10 seconds when an Undo is offered.
  - Name the item ("Completed 'Prepare lab meeting slides'").
  - Consider keeping completed rows for a moment, ticked, before they leave.

### M3. Home and Today count the same tasks differently
- **Steps (1440, start of session):**
  - Today said "1 task for today and 2 overdue" for a list of 3.
  - Home said "2 due today, 2 overdue".
- **Cause:** A task due today at 09:30, which had already passed, is counted on Home as both due today and overdue.
- **Fix:** Use one counting rule for both. A task that is overdue is not also "due today".

### M4. Analytics and Reviews claim 100% with nothing missed while tasks are overdue
- **Where:** Analytics and Reviews, "Completion rate 100% · 0 skipped · 0 missed" for 16–22 Nov, with 2 overdue tasks (one due yesterday).
- **Why it matters:** The page subtitle promises "Skipped and missed are shown, never hidden".
- **Fix:** Count overdue tasks due in the period as missed or as their own "overdue" figure. Say "so far" if the week isn't over.

### M5. Validation is silent or inconsistent across forms
Four places behave differently from the good New habit and New occasion pattern ("Give it a name" next to a disabled Create):
- **Task editor:** clearing the title leaves an empty title on screen with no message. On close, the old title silently returns (`TaskEditor.tsx:247`).
- **Health → daily plan:**
  - A "Breakfast: until" time of 07:00, earlier than the 08:30 start, was saved without a word and then discarded.
  - Clearing "Glasses of water a day" saved **1** without saying so. Water then read "1 of 1 glasses".
- **Habit skip dialog:** "Skip with this reason" stays greyed out until a reason is entered, with no text saying a reason is required.
  - The responsive guideline says validation is "never only by greying out the button".

**Fix:** Use the footer-message pattern everywhere, show an inline error under the field, and never coerce or drop a value without telling the user.

### M6. The workout screen has wrong fields and contradictory status
- **Where:** `/workouts/:id`.
- **Problems:**
  - **Plank** (planned as "3×30 s") offers **Reps** and **kg** inputs.
  - After "End workout", the header reads "✓ 0 min · completed" beside a button labelled "Not finished". The button is an action, but it reads as a status.
  - Ending with 1 of 13 sets logged asks for no confirmation.
  - Every set row's inputs are announced only as "Reps" and "kg", without the exercise name.
  - There is no back link to Gym & Fitness.
- **Fix:**
  - Give timed exercises a seconds field.
  - Rename the button "Reopen workout".
  - Confirm ending when fewer than half the sets are logged.
  - Use labels such as "Goblet squat, reps".
  - Add a "← Gym & Fitness" breadcrumb.

### M7. Touch targets fall below the app's 44px rule on phone, and some below the 24px AA minimum
Measured at 390×844 with `getBoundingClientRect`:
- **Below 24px (fails WCAG 2.5.8):**
  - motivational-line dismiss "Hide this message": 18×18
  - section breadcrumb ("Self-Improvement"): 18px tall
  - Journal "Private" checkbox: 16×16
  - Settings "Show a short motivational line" checkbox: 13×13 (its label may extend the target; check)
  - project outline checks: 20×20
- **Below the app's own 44px rule:**
  - page-header actions at 36px tall: New habit, New note, New event, Edit plan, Fields & statuses, Assign to weekdays
  - reminder Snooze 32×36, Dismiss 32×32, "+4 more reminders" 132×30
  - Inbox "Move…" 160×32
  - project-outline task options 36×36
- **Tablet (768):**
  - rail items are 40×36 on a touch device
  - their labels exist only as `title` tooltips, which touch users can't see
- **Fix:**
  - Apply the 44px minimum to header buttons and reminder controls on phone.
  - Wrap small checkboxes in a padded label.
  - On tablet, make rail items 44×44, and show labels on long-press or offer a labelled expanded rail.

### M8. Project page: a long name is clipped mid-word, and the page has no H1
- **Where:** `/projects/:id`.
- **Result:**
  - The project name is a single-line `<input aria-label="Project name">` (scrollWidth 1139 against 960). It is cut off at "…manipulation i" with no ellipsis or wrap.
  - The page has no `h1`. `document.querySelector('h1')` returned null.
- **Fix:** Use an auto-growing textarea, or show the name as a wrapping H1 that turns into an input when edited.

### M9. Calendar: a different time format, low contrast for done items, and an unreadable phone grid
- **Where:** `/calendar`.
- **Time format:** The calendar uses 12-hour times ("4:00pm–5:00pm", the "11am" axis, "11:19am"). Today's schedule, tasks and Health use 24-hour times (11:30, 14:00).
- **Contrast, light theme:** Completed (struck-through) items measured 3.55:1, and the "2:00pm" time on a done item 2.17:1, both at 11px.
- **Phone (390):**
  - The 3-day view squeezes the overlapping workout and lecture into blocks about 30px wide ("S…", "Full |").
  - The all-day row has its own scrollbar holding "+14 more".
- **Fix:**
  - Use the user's 24-hour format everywhere.
  - Keep done items at `muted` (≥4.5:1) with the strike-through.
  - On phone, stack overlaps or default to a 1-day or list view.

### M10. Dates & Occasions: the month grid takes the whole screen, and its loudest element is the selected day
- **Where:** Dates & Occasions section.
- **Result at 1440×900:**
  - Cells are `aspect-square` (128px tall), so six weeks fill the first screen.
  - "Add occasion" starts at y≈1077, below the fold.
  - The selected day is a solid light block (`fg` fill), the brightest thing on the page.
  - "Coming up" lists the same yearly birthday twice ("today" and "in 365 days").
- **Why it matters:** The main action is hidden, and the page is the least calm in the app.
- **Fix:**
  - Cap the cell height (for example 56–64px) or move the list beside the grid at desktop.
  - Mark the selected day with a ring or the ink rule instead of a full fill.
  - De-duplicate recurring occasions in Coming up.

---

## Low

### L1. Dimmed counts and out-of-month days fall below 4.5:1
- Segmented counts on All Tasks (Open / Completed / Skipped) use `muted` at 60% opacity: 2.88:1 in dark, 2.37:1 in light, at 12px.
- Out-of-month days in the Occasions calendar use `text-muted/60`, about 3:1.
- The "N" shortcut hint on New task measures 4.34:1 (dark) and 3.77:1 (light) at 11px.
- **Fix:** Use full `muted` for these.

### L2. The overdue bar's "Today" looks like a selected toggle
- "Today" is a `secondary` (bordered, filled) button next to the ghost buttons "Tomorrow" and "Pick a date", so it reads as the current choice in a Segmented control. It is actually an action.
- **Fix:** Give all three the same style, or label the row "Move to: Today · Tomorrow · Pick a date".

### L3. Moving overdue tasks to today drops their time
- "Email Prof. Rajan about the draft" (09:30) became an untimed task and left the schedule.
- **Fix:** Keep the time when moving to today, or say in the toast that the time was cleared.

### L4. The habit day menu: confusing state, and it covers the row
- In the day menu (right-click), "Clear" is shown as the primary button when the day is empty, because it marks the current state. That reads as the suggested action.
- The menu also covers the day headers of the row above.
- **Fix:** Mark the current state with a tick, and keep one visual style for the actions.

### L5. The habit day menu has no visible keyboard path
- The menu opens only through `onContextMenu`. It works with the keyboard's context-menu key, but nothing tells keyboard users that.
- **Fix:** Add an "Options for this day" item to each habit's "⋯" menu, or open the menu with Enter plus a modifier, and mention it in the cell's description.

### L6. Notes shows two empty states at once
- With no notes, the left column says "No notes yet." and the right says "Pick a note. Or start a new one."
- **Fix:** Show one empty state with the New note action.

### L7. Journal: "Earlier entries" includes today, and the active row uses a banned edge bar
- The "Earlier entries" list includes today's entry.
- The active entry is marked with a one-sided left bar on a rounded box. Decisions log #6 bans this pattern for the sidebar.
- **Fix:** Rename the list to "Entries", and mark the active entry with the lit row used in the sidebar.

### L8. Focus doesn't return to the task after the editor closes
- After closing the task editor with Escape on All Tasks, focus moved to the page container, not the task row that opened it.
- **Fix:** Return focus to the triggering row (Radix `onCloseAutoFocus`).

### L9. Native date inputs show a different date format
- Health and the occasion form show native "20-11-2026" inputs. The rest of the app writes "Fri 20 Nov".
- **Fix:** Use the app's `DatePicker`, which is already used in the task editor.

### L10. Gym offers the next workout straight after today's
- Right after finishing today's workout, the primary button reads "Start Full body B".
- **Fix:** After "Done today", make the primary block a summary of today's workout, and show the next workout as secondary.

### L11. Tablet: a 90-minute event is truncated on the schedule
- At 768, the 90-minute "SMAI lecture" block on Today's schedule is truncated to "SMA…". The 75-minute rule (decision #3) was tuned for 1440.
- **Fix:** Base the block-or-tick threshold on pixel width, not minutes.

### L12. Phone: the All Tasks section filter is clipped
- At 390 the "All sections" select is clipped to "All sectio".
- **Fix:** Put the select on its own row on phone, or shorten it to an icon button with a sheet.

---

## What was tested

**Sizes:**
- 1440×900: dark and light
- 1280×800: light and dark
- 768×1024: light
- 390×844: light, with the Android user agent

**Themes:**
- Dark (the default) and Light, switched through Settings → General → Theme. I set it back to Dark at the end.
- Contrast was computed from the CSS variables and from rendered text, walking the background stack, on 10 pages per theme.

**Workflows:**

| Area | What I did |
|---|---|
| Starting the day | Today summary and habits line. Home check-in: I'm up, mood, energy, sleep, water, invalid weight |
| Tasks | Quick add with a long title. Phone ＋ sheet with the Today chip. 13 tasks added through the sheet, about 25 open in total. Task editor: fields, empty title, focus trap, Escape. Complete and undo. Move overdue to today and undo. Command palette (Ctrl K) |
| Projects | Created a project with a long name. Outline tasks and a milestone |
| Habits | Tap to mark done. Right-click → Skip with a reason. Rest day. New habit with an empty name |
| Gym | Programs → Beginner → Use routine → Start → log a set → End workout. Week strip, Consistency, Recent workouts |
| Health | Set my plan, Edit plan with invalid values, Water +, check-in table |
| Dates & Occasions | Added an occasion with an empty name, then a valid one |
| Journal | Mood carried over from the check-in, entry autosave |
| Notes | New note, the "/" menu, a checklist item |
| Analytics and Reviews | Week view |
| Other screens | Settings index and General, Goals, Vault (landing only), Inbox, Focus, People, Trash and More, all loaded |

**Responsive checks:** Horizontal overflow on 22 routes at phone, and on 14 to 21 routes at tablet and laptop. Touch-target sizes on 22 phone routes and the task sheet.

**Accessibility:**
- names of icon-only controls on 22 routes
- Tab order through the sidebar
- focus ring visibility on the shell
- sheet focus trap and Escape
- `prefers-reduced-motion` CSS
- status marks shown without relying on colour (the habit register)

**Data I added (left in place):**
- tasks: "Call the bank", "Bulk task 01–12 reading", the groceries task
- the long-named project, with 2 tasks and 1 milestone
- one workout (Full body A)
- the Full body routine
- the Health plan
- the occasion "Amma's birthday"
- a journal entry
- the note "Paper ideas"
- habit marks: Gym Fri done, Gym Wed skipped, DSA Tue rest
- check-in values
- "Prepare lab meeting slides" left completed
- the two overdue tasks moved to today

## Not tested

- **Vault:** creating, unlocking or locking, because it needs a passphrase.
- **Settings:** App lock, Backup, import and export, Sync.
- **Platform features:** notifications, PWA install, offline behaviour, the update prompt.
- **Real touch:** long-press on habit cells, swipe actions on task rows, scroll physics. Right-click was used for long-press.
- **Assistive technology:** a real screen reader (I checked the accessibility tree only), and browser zoom at 200% or 400% for reflow.
- **Other conditions:**
  - landscape phone
  - the System theme
  - runtime reduced motion (I checked the CSS only)
  - loading skeletons, which never appeared because the local database answered instantly
  - real error and offline states
- **Screens tested lightly:** Focus timer, People, Reviews submission, the Calendar drag-to-create flow, and Collections board view.
- **Devices:** no real Android or iOS device. I used browser emulation only.
