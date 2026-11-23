# Personal OS: end-to-end user experience audit

19 Nov 2026, at commit `b4132cf`. This audit only reports findings. No application code, data or dependencies were changed.

## How this audit was done

It ran in four stages, so each screen was looked at once and each finding is written down once.

1. **Earlier work reused.**
   - `docs/discovery/` (functional audit, gap analysis, architecture) and `uiux-handover/EXISTING_UX_AUDIT.md` were re-read. Findings that still hold are referenced, not repeated.
   - Many earlier gaps have since been built and are not reported again: phone search, occasion reminders before the day, Analytics cards for Gym, Health and Thesis, re-planning overdue tasks, missed-while-closed, and Gym ↔ Habits.
2. **Hands-on walk-through.**
   - The app was used on desktop (1280 × 720) and phone (Pixel 7, 412 px) in a fresh, throwaway browser profile.
   - Onboarding was done as a Researcher, and every screen and all 24 seeded section pages were surveyed while empty.
   - The app was then filled the way a user would fill it: plain-language tasks, the Today box, an Inbox capture, a project outline, a goal, habits, a gym routine with a workout, a Health plan with logs and a plan item, a weekly event, an adviser meeting with action items, a watchlist item, an occasion from the calendar, a note, a journal entry and a focus session.
   - Every screen was surveyed again two days later.
   - **None of your real data was used or touched.**
3. **Workflows exercised by the test suite.** The 170 end-to-end tests drive real workflows on both viewports: completing, skipping, rescheduling, deleting and restoring, Vault, App Lock, backup and restore, reminders, Gym, Health, occasions and more. They count as verified behaviour and as the source for step counts.
4. **Code checked only where behaviour was in doubt.** Examples: when the setup checklist disappears, whether the two check-ins share data, and whether storage is persistent.

**How each finding is marked:**

- **[W]** seen in the walk-through
- **[T]** verified by an end-to-end test
- **[C]** confirmed in code
- **[I]** inferred, not proven

**Not covered**, and therefore not judged:

- a real Android device (gestures, notifications, the install prompt, Share Target from another app)
- screen readers
- tablets
- data volumes of 200+ tasks or years of history
- Supabase sync and Web Push, which aren't configured
- closed-app reminders

The walk-through's apparent Notes and Journal "losses" were caused by the script reloading the page during a save. The app flushes saves on leave, hide and close **[C]**, and its tests pass **[T]**. They are not findings.

---

## 1. What is good and should not change

- **Honest data model.** Skipped, missed and rest are never counted as done. Changing a schedule doesn't rewrite history for habits, the Gym or week-only changes. Every change has Undo and a 30-day Trash **[T]**. This is the app's strongest trait. Keep it.
- **Truly offline.** Storage is requested as persistent ("Protected" in Settings) **[C]**. Everything works with no account. Backup and restore round-trips **[T]**.
- **Section-aware tools** instead of one generic list: Papers with DOI/arXiv, Assessments with a grade, Meetings with carried-over action items, Thesis word goals, the Gym week builder, the Health plan, the Occasions calendar **[W]**.
- **Plain-language capture.** "Read RT-2 paper wed !high #reading" becomes a date, a priority and a tag **[T]**, everywhere a task can be typed.
- **Notion-style outlines** in projects and sections, with headings, subtasks and moves **[T]**.
- **Gym ↔ Habits**: one linked habit, Start and End from the Habits card, week-only changes, honest missed and skipped days **[T]**.
- **Undo toasts** on every destructive or bulk action. Confirmations before bigger deletes **[T]**.
- **Phone basics**: swipe on a task row, a 44 px touch target rule, sheets instead of popovers, and search now on Home and More **[T][W]**.

---

## 2. Findings by area

Findings that cut across areas, such as navigation, Home vs Today and visual consistency, are in `NAVIGATION_AND_INFORMATION_ARCHITECTURE.md` and `UI_UX_REDESIGN_RECOMMENDATIONS.md`. The IDs below are used by `FINAL_ACTION_PLAN.md`.

### Starting the day: Home and Today

| ID  | Finding                                                                                                                                                                                                                                                                                                                                     | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A1  | **On a phone, Home's first screen is entirely the section map.** The check-in (mood, energy, sleep, water, weight), which is the reason Home is the start screen, is about 2 screens down (page height 2.3 screens). The map repeats the sidebar, More, and the Sections page.                                                              | [W]      |
| A2  | **Morning logging is split across three screens:** wake-up and meals on **Health**, mood, energy, sleep hours, water and weight on **Home**, and the Gym workout on **Habits**. Logging a morning takes 3 screens plus navigating to Health (Home → Self-Improvement → Health, or More → Sections).                                         | [W][C]   |
| A3  | **Two inputs for the same facts.** Home's check-in has "Sleep last night (hours)" and a water counter. Health works out sleep from bed and wake times, and counts water glasses with times. Both write to the same check-in record, so whichever is entered last wins, and a typed sleep figure is replaced when you log bed or wake times. | [C]      |
| A4  | **"Finish setting up" stays on Today until every step is done, or it's hidden.** The steps include "install the app" and "make a backup". After two days of real use it was still the second block on Today, taking about 500 px before the tasks.                                                                                          | [W][C]   |
| A5  | Today on a phone shows, in order: greeting, motivational line, While-you-were-away, setup checklist, review nudge, backup reminder, then the Today tasks. On a normal morning, the first task can be **below the fold**.                                                                                                                    | [W]      |
| A6  | Today is now work-only, as you asked: tasks, events, Coming up, active projects. Habits are no longer on Today, but there is also **no single place that shows "everything due today"** (tasks + habits + health items + gym). This is a deliberate trade-off, but it means the morning needs Home, Health and Habits.                      | [W]      |

### Capturing and managing tasks

| ID  | Finding                                                                                                                                                                                                                                                                                                                                                                                                                      | Evidence                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| B1  | **Many ways to add a task, each with a different default.** ＋ puts it in the Inbox, due today. The Today box: due today, no section. The All Tasks box: the filtered section. Inbox: no date. Section outline: that section. Project outline: that project. Ctrl+K: Inbox, or the current section. Meeting action items: the meeting. The quick capture is good, but "where did my task go?" depends on where you typed it. | [T][C]                        |
| B2  | The ＋ sheet stays open after adding, showing "Added to Inbox, due today". This is fast for batches, but the first time it looks like nothing happened, and the "Inbox" in that message surprises people who meant "today".                                                                                                                                                                                                  | [T]                           |
| B3  | **The Inbox can only send items to a section,** not to a project, note or list. Ideas captured in the Inbox can't become an Ideas-list item or a project.                                                                                                                                                                                                                                                                    | discovery F1 (still open) [C] |
| B4  | Task fields exist without any UI: type, start date and estimate. So there's no time-boxing or capacity check for the day.                                                                                                                                                                                                                                                                                                    | discovery [C]                 |
| B5  | Rescheduling is good: swipe to Tomorrow, the date picker in one click, and the new "move all overdue". There's **no "plan tomorrow" flow in the evening** to pick tomorrow's tasks on purpose.                                                                                                                                                                                                                               | [T]                           |

### Projects and Goals

| ID  | Finding                                                                                                                                                                                                                                                                          | Evidence          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| C1  | Projects and section outlines use the same outline editor. The difference is clear in theory (a finite outcome vs an ongoing area), but the **"Ideas & Projects" section** (with an Ideas list) sits next to the **Projects** screen, and nothing connects an idea to a project. | [W]               |
| C2  | Goals can be measured manually or through linked habits. They **can't** be measured from workouts, words written, focus hours or list items. A goal like "Read 30 papers" needs manual + / − even though Papers are tracked in Research.                                         | [T], discovery C2 |
| C3  | "Goal ideas that grow from your habits" stays under your goals forever, even once you have goals.                                                                                                                                                                                | [W]               |

### Habits and Gym & Fitness

| ID  | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Evidence        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| D1  | The habit day grid cycles done → skipped (asks a reason) → rest → cleared on repeated taps. This is explained only in the page subtitle. You have to tap three times to undo a mistaken tick.                                                                                                                                                                                                                                                                      | [W], earlier I4 |
| D2  | The Gym card in Habits is clear: Start workout / End workout / Skip, completed times, reasons. The Gym page is long (about 2 screens): hero, week strip, weekly schedule, routines, consistency, recent workouts. The **weekly schedule and the week strip show the same week twice**.                                                                                                                                                                             | [W]             |
| D3  | **Two consistency formulas.** The Analytics "Habits" tile uses `habitConsistency`, and the Gym card and Gym page use `adherence`. They agree for habits on fixed days. They **disagree for "N times a week" habits.** `adherence` treats every day as planned, so a "3× a week" Gym habit (a routine without fixed weekdays) shows 4 missed days in a week where all 3 workouts were done. This affects the Gym page's Consistency box and the Analytics Gym card. | [C]             |

### Health

| ID  | Finding                                                                                                                                                                                                            | Evidence                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| E1  | The Health page is about 2.4 screens: set-up prompt, Today plan, Repeating plan items, Last 14 days, Appointments, Check-ins by week. The two "history" blocks (14-day dots, weekly check-ins) overlap in purpose. | [W]                           |
| E2  | The 14-day on-time dots are **color only**, with the state in a hover tooltip that phones can't show.                                                                                                              | earlier audit, still true [C] |
| E3  | **Water is counted in three places:** the Home check-in, Health's "+ Glass", and an optional "Drink water" plan item. Each answers a slightly different question, which isn't obvious.                             | [W][C]                        |
| E4  | Appointments are calendar events with a Health tag. They're good, but they appear only on Health and Calendar, not in Coming up on Today unless the event widget is visible.                                       | [I]                           |

### Calendar, events and dates

| ID  | Finding                                                                                                                                                                                                                                                                                                         | Evidence |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F1  | **Calendar shows:** events, tasks with dates, meetings, occasions and birthdays. **It doesn't show:** gym days, health plan items or habits. Dated things live in five models: events, tasks, list-record dates, the gym weekday plan, and the health plan. Only the first three come together on the calendar. | [C]      |
| F2  | Phones get a 3-day calendar. The "New event" sheet has many fields: name, all-day, date, start, end, repeat, reminder, section, where, notes. The repeat-scope choice for repeating events is now clear.                                                                                                        | [W][T]   |

### Work: Research, Thesis, Coursework, Meetings, Updates

| ID  | Finding                                                                                                                                                                                                                                                                                               | Evidence             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| G1  | **10 of the 24 seeded sections have no tool of their own**, only "Tasks 0 open" and a blank page: Work, Physical AI, Coursework, Updates, Work Misc, Self-Improvement, Personal Life, Miscellaneous, Household, Documents. On day one a Researcher gets 24 sections, about half of them empty shells. | [W]                  |
| G2  | **Coursework** is a plain section. Each course (SMAI) has an Assessments list, but there's no cross-course "what's due" view or timetable.                                                                                                                                                            | [W], discovery W1/W3 |
| G3  | **Updates** is a plain task section with no structure for its likely purpose (weekly progress updates to the adviser).                                                                                                                                                                                | [W]                  |
| G4  | Thesis, Papers and Meetings are strong. Meeting action items are real tasks and carry over **[T]**. Papers ↔ Thesis aren't linked: you can't cite a paper in a chapter or see which papers belong to which chapter.                                                                                   | [I]                  |

### Personal life lists

| ID  | Finding                                                                                                                                                                                           | Evidence          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| H1  | Movies, Places, Trips, Shopping, Expenses and Learning are consistent list pages (table/board, statuses, fields) and easy to add to. Trips and Expenses aren't connected (no budget vs spending). | [W], discovery L2 |
| H2  | **People vs Dates & Occasions.** The same birthday now shows once when the names match, but you still enter it twice, once per screen. Occasions can't pick a person.                             | [C], discovery D7 |
| H3  | List items can have dates and comments. Shopping has no "staples" or repeat.                                                                                                                      | discovery M3      |

### Notes, Journal, Vault, App Lock

| ID  | Finding                                                                                                                                                                                                                                          | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| J1  | **Free text lives in six places:** Notes, each section's page notes, Journal, meeting notes, list-item comments, Vault notes. Each has a purpose, but nothing links a note to a project or section, and section notes aren't listed under Notes. | [W][C]   |
| J2  | Journal (one page a day, mood, private entries encrypted with the Vault) and Vault/App Lock are solid **[T]**. The Vault passphrase and the App Lock PIN are separate secrets, which is right, but not explained side by side.                   | [T]      |

### Reviews and Analytics

| ID  | Finding                                                                                                                                                                                                                                                       | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| K1  | Reviews (questions + frozen numbers, weekly nudge on Today) and Analytics (live numbers, drill-down, now Gym/Health/Thesis) are different jobs **[W]**. The review doesn't show the new Gym/Health/Thesis numbers, so a weekly review sends you to Analytics. | [C]      |
| K2  | Analytics shows empty tiles (the "—" style) for things never used (for example cardio, or meals on time with 0 logged). Several tiles read "— · 0 logged".                                                                                                    | [W]      |

### Settings, backup, sync

| ID  | Finding                                                                                                                                                                                                                                                                                                | Evidence  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| L1  | Settings is **one page of 3.2 screens on desktop and 4.6 on a phone**, with 9 groups and about 470 words: Workspace, Messages, Appearance, Profile, Account & sync, App lock, Backup & data, Storage, App. Things you use once (profile, messages) sit between things you need now (backup, app lock). | [W]       |
| L2  | The Sections editor (`/settings/sections`) has 169 controls on desktop. It's powerful but dense. Hiding a section is now one click from the sidebar **[T]**, which is the better path.                                                                                                                 | [W]       |
| L3  | Sync isn't set up. Four sync-only data risks remain open from the discovery audit (R1–R3, R8). They're harmless today and blockers before sync is switched on.                                                                                                                                         | discovery |

### Across the app

| ID  | Finding                                                                                                                                                                                                           | Evidence   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| X1  | **Toasts and reminder cards stack at the bottom and cover content on phones.** In the walk-through, two toasts covered the Gym card and its Undo. Tests had to work around a reminder card covering "Add reason". | [W][T]     |
| X2  | Forms usually say what's wrong only by disabling the submit button. The newer sheets (plan items, occasions, Health windows) explain the problem inline. The two styles coexist.                                  | [W][C]     |
| X3  | Dates use two kinds of input: native date and time fields in Health, Gym and Occasions, and the custom picker in tasks and goals.                                                                                 | earlier F3 |
| X4  | Pages first render blank for a moment while the local database opens (a capture caught a fully blank Today). On slower phones this reads as a flash of an empty app.                                              | [W]        |

---

## 3. A day and a week with the app

Each step shows how many screens it takes, then what works and where the friction is.

| Moment         | What you do                     | Screens                     | Works well                                             | Friction                                                              |
| -------------- | ------------------------------- | --------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| Morning        | Open the app (installed → Home) | 1                           | Fast, offline                                          | The map fills the first screen; the check-in is below it (A1)         |
|                | Log wake-up, breakfast, water   | Home → Health               | One tap records the device time, with Undo and Reset   | Wake-up is on Health, mood/sleep/water on Home (A2, A3)               |
|                | See what's planned              | Today                       | Overdue bar, Coming up, events                         | The setup checklist and nudges come before the tasks (A4, A5)         |
|                | Start the gym                   | Habits → Start workout      | Start/End without leaving Habits; it survives a reload | A third screen just for the morning (A6)                              |
| During the day | Capture and do tasks            | ＋ / Ctrl+K / swipe         | Plain-language capture, swipe, Undo                    | Different defaults by entry point (B1, B2)                            |
|                | Work on a project               | Projects → outline          | Notion-like and fast                                   | Ideas don't flow into projects (C1, B3)                               |
|                | Meeting with your adviser       | Adviser Meetings            | Action items become tasks and carry over               | None                                                                  |
|                | Focus                           | Focus or from a task        | Counts as deep work, even across a reload              | None                                                                  |
|                | Health items                    | Reminder card → Mark done   | Each occurrence is tracked                             | Water counted in three ways (E3)                                      |
| Evening        | Review the day                  | Today / All Tasks / Reviews | Daily review exists                                    | No "done today" summary or "plan tomorrow" step (B5)                  |
|                | Journal                         | Journal                     | Private entries encrypted                              | Mood is also asked on Home; it's one value, but asked twice           |
| Weekly         | Weekly review                   | Reviews (nudged from Today) | Frozen numbers, questions                              | Gym/Health/Thesis aren't in the review (K1); no "plan next week" step |
|                | Check consistency               | Habits, Gym, Analytics      | Honest, with missed days shown                         | Two consistency figures disagree (D3)                                 |
