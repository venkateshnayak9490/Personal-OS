# Feature gap analysis

Audit date: 2026-11-19. Code at `c056ee6` (main). Audit only; nothing was changed.

Scope: what each section can and can't do, where sections repeat each other, where they should share data,
daily usability, and how well the starter templates serve each type of user. Every recommendation names one
owning section. The ranked top 15 is at the end.

## How to read the tables

| Column | Meaning |
|---|---|
| ID | Used to cross-reference and in the top 15 |
| Section | The section or screen that owns the change |
| Problem | What the user can't do today, or what goes wrong |
| How it should work | The smallest design that fixes it |
| Depends on | Other sections whose data it reads or writes |
| Default | **On**: shown without setup. **Opt**: the user turns it on or adds it |
| Data | **Existing**: no new fields. **Field**: a new optional property on an existing entity (Dexie stores unindexed properties without a schema bump). **Config**: list template or `node.config` / `profile.settings` only. **Entity**: a new table (schema version + migration + sync) |
| P | P1 = fixes a real gap in a core flow. P2 = clear value, not urgent. P3 = nice to have |
| Effort | S = under a day. M = 1 to 3 days. L = more than 3 days |

## What the code does today (verified)

Facts the recommendations rest on, checked in the code, not taken from the docs.

- **Section kinds** (`src/features/structure/section-kinds.ts`) give special tools to only 13 module keys.
  Starter sections whose module key has **no entry** fall back to a plain task page: `thesis` (has
  `ThesisSection` instead), `coursework` (its children get the Assessments list), `updates`, `documents`,
  `assignments`, `exams`, `subjects`, `mock_tests`, `reports`, `clients`, `projects`, and the keyless
  `household`, `admin`, `revision`, `current-affairs`, `proposals`, `work-misc`.
- `freelancer → Invoices` reuses the **Expenses** template (statuses Paid / To reimburse / Reimbursed), which
  doesn't describe invoices.
- **People** (`/people`) is one app-wide list with yearly `birthday` and `anniversary` fields. **Occasions**
  (Dates & Occasions section) is a second list with a yearly `date` and a free-text `who`. Both feed the
  calendar and both raise a 9:00 reminder **on the day only** (`occasionReminders`, `src/core/domain/reminders.ts`).
  The same birthday entered in both places shows twice and reminds twice. There is no "a week before" option.
- **Check-in** lives on Home (`CheckinCard`: mood, energy, sleep, water, weight). **Health** (Health section)
  has its own Today plan (wake, meals, water with reminders, bed) on the same `checkins` row. Water appears in
  both. **Journal** has its own mood. **Habits** has a separate daily check-off.
- **Analytics** reads tasks, habits, habit logs, focus sessions and skips only. Workouts, check-ins, thesis
  writing logs and expenses are not used. **Reviews** summary uses the same sources.
- **Calendar** shows events (including health appointments), tasks, dated list fields (deadlines, birthdays,
  occasions, trip dates) and meetings. Gym routine days and thesis milestones are not on it.
- **Goals** can count habit check-ins (`measure.fromHabits`) and link projects (`Project.goalId`). It can't
  count workouts, words written, focus minutes or list items.
- **Inbox** is "tasks without a section". The `inbox` table (`InboxItem`, with kinds idea/note/link) and the
  `links` table exist in the schema but nothing reads or writes them.
- **Focus** can start from the Focus page or the task editor (`TaskEditor.tsx:482`). Focus minutes are not
  shown on the task or compared with `estimateMin`.
- **Search** is the command palette (tasks, sections, pages, lists, records, meetings, notes, journal). The
  phone bottom bar has no way to open it.
- **Meetings**: open action items and follow-ups already carry over to the next meeting
  (`src/core/domain/meetings.ts`). Not a gap.
- **Expenses**: the list shows a "Spent" total (`CollectionPage.tsx:255`). No budget, no link to trips.
- **Courses**: Assessments list stores type, due, weight, score, out of. No computed grade, no class timetable.

---

## 1. Missing capabilities per section

### Work

| ID | Section | Problem | How it should work | Depends on | Default | Data | P | Effort | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| W1 | Coursework → each course | No class timetable. Students' most regular commitment isn't anywhere in the app | "Class times" row on a course page: weekday(s), start, end, room. Saves one weekly recurring event per slot with `nodeId` = the course, so classes appear on Calendar and Today's events | Calendar, Today | On (empty prompt on course pages) | Existing (`events.rrule`, `nodeId`) | P1 | M | The daily schedule finally reflects a student's day; Today stops looking empty on class days |
| W2 | Coursework → each course | Scores are stored but the user has to work out their grade | One line above the Assessments table: "Current 78% · 45% of the course graded", from weight × score / outOf of graded rows | none | On when any row has weight and score | Existing | P2 | S | Answers "how am I doing in this course" without a spreadsheet |
| W3 | Coursework (parent) | The student template adds separate **Assignments** and **Exams & Quizzes** sections that are plain task pages, duplicating each course's Assessments list | Remove those two from the student template. The Coursework page shows "Due across your courses": every open Assessment row from its child courses, sorted by due date | Courses' lists | On | Existing | P1 | S | One place to enter an assignment, one place to see them all; removes a confusing duplicate |
| W4 | Research → Updates | `updates` has no section kind, so Updates is a blank task page even though the Conference deadlines template was made for it | Map `updates` to the `deadlines` list in `section-kinds.ts` | Calendar, Today (deadlines already flow there) | On | Config | P1 | S | Deadlines in AoE work out of the box for researchers |
| W5 | Thesis | Word goals exist but no submission date, so there's no pace | Optional "Submit by" date on the Thesis section. Shows "~420 words/day to finish" and puts the date on Calendar | Calendar | Opt | Config (`node.config`) | P2 | S | Turns a total into a daily target |
| W6 | Thesis | Writing-log minutes are separate from Focus, so deep work is counted twice or not at all | Logging words after a focus session on a thesis task pre-fills minutes from that session; Focus totals include writing-log minutes that had no focus session | Focus, Analytics | On | Existing | P3 | S | One honest number for writing time |
| W7 | Research | Papers can't be tied to the chapter that cites them | "Used in" chapter picker on a paper. Thesis chapter rows show the count of papers | Thesis | Opt | Existing (`links` table, unused today) | P3 | M | Literature review tracking for thesis writers |
| W8 | Freelancer → Invoices | Invoices use the Expenses template; the statuses mean the wrong thing | New `invoices` list template: client, amount, issued, due (deadline field, reminds), status Draft / Sent / Paid / Overdue, "Outstanding" total | Calendar (due dates) | On for the Invoices section | Config (template) | P2 | S | Freelancers can see who owes them |
| W9 | Freelancer → Clients | `clients` has no kind: a blank page | Map `clients` to a `clients` list template (contact, rate, status Lead / Active / Past, notes). Invoices' client field is a text match to it | Invoices (W8) | On | Config | P3 | S | Basic CRM without leaving the app |

### Exam aspirant

| ID | Section | Problem | How it should work | Depends on | Default | Data | P | Effort | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| E1 | Subjects | Exam prep is driven by syllabus coverage, but Subjects is a task page | New `syllabus` list template per subject: topic, status Not started / Studied / Revised / Confident, last revised (date), notes. Header shows "Coverage 42%" (done statuses / all) | none | On for Subjects and its children | Config (template + kind) | P1 | M | The aspirant's core question, "how much is left", is answered |
| E2 | Revision | Revision is a blank task page; spaced revision is the main study technique | On syllabus rows, "Revise next" date set automatically from last revised (1, 3, 7, 21 days). The Revision section shows rows due today across all subjects; they also appear in Today's Coming up | Subjects (E1), Today | On for exam template | Existing (record fields) | P2 | M | Daily revision list without manual planning |
| E3 | Mock Tests | `mock_tests` has no kind; scores can't be tracked | `mock_tests` list template: date, score, out of, percentile, weak areas (text). A small score-over-time line above the table | Analytics (later) | On | Config | P1 | M | Shows whether preparation is working |
| E4 | Current Affairs | A blank page for a daily habit | Template seeds a "Read current affairs" daily habit linked to the section, and the section page uses the page editor for notes (already default) | Habits | On for exam template | Existing | P3 | S | Daily routine set up on day one |

### Professional

| ID | Section | Problem | How it should work | Depends on | Default | Data | P | Effort | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| PR1 | Meetings (work) | Meetings is good, but work meetings repeat (stand-ups, 1:1s) and each is created by hand | "Repeats weekly" on a meeting creates the linked event with an `rrule`; opening the next occurrence creates its notes page with carried-over action items (carry-over already exists) | Calendar | Opt | Existing (`events.rrule`, `meeting.eventId`) | P2 | M | Recurring 1:1s cost one tap each week |
| PR2 | Reports & Reviews | `reports` has no kind: a blank task page | Leave as a task section, but seed one monthly recurring task "Write monthly report" in the template (recurrence exists) | Tasks | On for professional template | Existing | P3 | S | Shows recurring tasks exist; zero new code |

### Self-improvement

| ID | Section | Problem | How it should work | Depends on | Default | Data | P | Effort | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| S1 | Health | No medicines, though the Health module promises them. Medicines are the most time-critical daily item for many people | "Medicines" block in Health: name, dose, times, until date. Each medicine is saved as a habit with `source: 'medicine'`, using existing habit reminders and repeat-until-done. Shown in Health, not in the general Habits list | Habits, Reminders | Opt (block visible, empty) | Field (`Habit.source` gains `'medicine'`, optional `until`) | P1 | M | Reminders for pills, a taken/missed history, no new reminder engine |
| S2 | Health | Yoga and meditation are promised but missing | Offer "Yoga" and "Meditation" as suggested habits in Health's empty state, linked to the Health section | Habits | Opt | Existing | P3 | S | Covers the promise without a new module |
| S3 | Gym & Fitness | Bodyweight is logged in Home's check-in but never shown where training happens | Small bodyweight trend (last 8 weeks) in Gym, from `checkins.weightKg` | Home check-in | On when any weight is logged | Existing | P2 | S | Gym shows progress beyond lifts |
| S4 | Learning & Skills | Resources have a free-text `skill` field but nothing groups by it; skills ↔ projects was planned and not built | Group the Learning resources board by `skill` with "3 of 5 finished" per skill. Skip the projects link until asked for | none | On | Existing | P3 | S | A skill-level view with no new model |

### Personal life

| ID | Section | Problem | How it should work | Depends on | Default | Data | P | Effort | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| L1 | Dates & Occasions | Reminders fire only at 9:00 on the day, too late to buy a gift or book a table | Per yearly field, "Remind me N days before" (default 0; suggest 7 for birthdays). Fires an extra reminder and appears in Today's Coming up | Reminders, Today | Opt | Config (`FieldDef.remindDaysBefore` in the collection's field list) | P1 | S | Birthdays stop being remembered on the day itself |
| L2 | Trips | Budget exists, spending doesn't; Trips planned "linked expenses" | Trip record sheet shows "Spent ₹X of ₹Y budget" from Expenses rows tagged with the trip's tag; "Add expense" in the trip sheet creates an Expenses row with the tag and Travel category | Expenses | On when the trip has a budget | Existing (record `tags`) | P2 | M | Trip spending tracked where it's planned |
| L3 | Places | No map (deferred); "want to go" places never turn into plans | "Plan it" on a place creates a Date idea or a task with the place's map link and date. Group the table by city | Dates (date ideas), Tasks | On | Existing | P3 | S | Places list becomes actionable without a map |
| L4 | Movies & Series | Series need "where I'm up to" | Add optional `progress` text field (e.g. "S2E5") to the movies template | none | On (new lists) | Config | P3 | S | Small, often-wanted |

### Miscellaneous

| ID | Section | Problem | How it should work | Depends on | Default | Data | P | Effort | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| M1 | Documents | `documents` has no kind; it overlaps Vault and tracks nothing | Map `documents` to a `renewals` list: name, expires (deadline field, reminds, on calendar), where kept, "In Vault" yes/no. Files themselves stay in Vault | Vault, Calendar | On | Config | P2 | S | Passport, insurance, licence expiries stop being missed |
| M2 | Household | Keyless blank page; bills and chores are recurring | Template seeds a `bills` list (amount, due day, paid this month) **or** simply 2 example recurring tasks. Prefer the recurring tasks: no new code | Tasks | On | Existing | P3 | S | Shows the right tool for chores |
| M3 | Shopping | Staples (milk, rice) are re-typed every week | Bought items stay in a "Buy again" strip; tapping one moves it back to To buy | none | On | Existing (status change) | P2 | S | Weekly grocery list in seconds |
| M4 | Expenses | Totals exist, budgets don't | Optional monthly budget per category in list settings; the Spent card shows used/left per category this month | none | Opt | Config (collection settings) | P2 | M | The main reason people track expenses |

---

## 2. Workflow improvements

| ID | Section | Problem | How it should work | Depends on | Default | Data | P | Effort | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| F1 | Inbox | Inbox only holds tasks. An idea, link or note captured fast must become a task first; the spec's "→ Task / Project / Note / List item" triage was never built | On each inbox row, a "Move to…" menu: a section (today's behaviour), a project, a note (creates `Note` with the text, deletes the task), or a list item (pick list, creates a record). No new inbox table; keep using unsectioned tasks | Notes, Lists, Projects | On | Existing | P1 | M | Capture once, file anywhere; Inbox gets to zero |
| F2 | Focus | Focus minutes aren't visible on the task they were spent on | Task editor shows "Focused 1h 40m (estimate 2h)"; Focus page "pick a task" lists today's tasks first | Tasks | On | Existing (`focusSessions.taskId`) | P2 | S | Honest estimates, and the timer starts on the right task |
| F3 | Habits | Gym habit is linked to the routine, but other habits ask for a manual check even when the app already knows (thesis writing logged, focus session done, water target reached) | Optional "Counts automatically from…" on a habit: words logged, focus minutes ≥ N, water ≥ target. Auto-marks done; the user can still undo | Thesis, Focus, Health | Opt | Field (`Habit.autoFrom`) | P2 | M | Removes double entry for the most common habits |
| F4 | Today | Overdue tasks pile up with no fast way to re-plan | "Move overdue to today / tomorrow / pick a date" action on the overdue group | Tasks | On | Existing | P1 | S | Morning re-planning in one tap instead of N edits |
| F5 | Reviews | Weekly review shows numbers but doesn't help plan next week | After answering, "Plan next week" lists open tasks without dates and lets the user set due dates in place | Tasks | On | Existing | P2 | M | Review becomes the weekly planning ritual |
| F6 | All lists | A list item can't be turned into work | "Make a task" on any record creates a task in the same section with the record's title and a back-link (e.g. a paper → "Summarize X"; an assignment → work task) | Tasks | On | Existing (`links` or `task.custom.recordId`) | P2 | S | Lists stop being dead ends |

---

## 3. Redundant functionality across sections

| ID | Section | Problem | How it should work | Depends on | Default | Data | P | Effort | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| D1 | Home | Home's section map, the `/sections` page, and the sidebar tree all list the same sections. Home also hosts the check-in, which has nothing to do with the map | Keep the sidebar tree (desktop) and the Sections page (phone). Turn Home into the day's *personal* page: check-in, gym plan, health plan, habits. Drop the map, or collapse it to a small "Areas" row | Today, Health, Gym | On | Existing | P1 | M | One reason for each screen; fewer places to look |
| D2 | Today vs Home | Two dashboards with dates and greetings; habits on Today, check-in on Home; the installed app opens on Home, the browser on Today | Today = work and plan (tasks, events, deadlines, projects). Home = body and wellbeing (D1). One start screen setting in Settings, default Today | none | On | Config (`profile.settings.startScreen`) | P1 | S | Users stop asking "which one do I open" |
| D3 | Health vs Home check-in | Water is counted in both; sleep is in check-in but bed/wake times are in Health; check-in exists twice in spirit | Single "Daily check-in" component: Health shows the full version (wake, meals, water, bed, sleep, weight); Home/Today shows a compact version of the same row (mood, energy, water +/-). Sleep hours computed from bed/wake when both are logged instead of typed | Health | On | Existing (same `checkins` row) | P1 | M | No conflicting numbers; less typing |
| D4 | Journal vs check-in | Mood is recorded in both Journal and check-in, separately | Journal's mood picker reads and writes `checkins.mood` for that date (keep `JournalEntry.mood` for private entries only) | Home/Health check-in | On | Existing | P2 | S | One mood history for Analytics |
| D5 | Habits vs Health | Habit check-off and Health logging are separate flows for daily routines (water, sleep, medicines) | Habits that mirror health data use F3 auto-counting; medicines (S1) live in Health. Rule: anything with a time stamp belongs to Health, anything yes/no belongs to Habits | Habits, Health | On | see F3 / S1 | P2 | S (policy) | Clear rule for where things go |
| D6 | Notes vs section pages | Every section already has a page editor for free notes, and Notes can also be filed under a section (`Note.nodeId`). Users can't tell where a note should go | Section page shows "Notes in this section" (Notes with that `nodeId`) under its page editor, with "New note here". Notes page keeps the global list. Section page = the section's overview; Notes = individual documents | Notes | On | Existing | P2 | S | Notes become findable from the section they belong to |
| D7 | People vs Occasions | Birthdays and anniversaries can be entered in both lists, showing and reminding twice | Occasions' `who` becomes a pick from People. Occasions shows People's birthdays/anniversaries as read-only rows ("from People"); reminders de-duplicate by person + date | People | On | Existing (store the person record id in `who`) | P1 | M | No duplicate reminders; one place per fact |
| D8 | Documents vs Vault | Two places for documents | Documents tracks expiries (M1); Vault stores the files. Documents rows link to the Vault item | Vault | On | Existing | P3 | S | Clear split |
| D9 | Student Assignments/Exams vs course Assessments | Same data entered twice | See W3 | | | | P1 | S | |

---

## 4. Missing connections between modules

| ID | Section | Problem | How it should work | Depends on | Default | Data | P | Effort | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| C1 | Analytics | Analytics ignores Gym, Health and Thesis, so half of what the user logs never shows up | Three cards in Analytics, same period selector: Training (sessions/week, planned vs done, top lift trend), Wellbeing (sleep, mood, water averages from check-ins), Writing (words/week). Hide a card when its data is empty | Gym, Health, Thesis | On when data exists | Existing | P1 | M | One honest picture of the week |
| C2 | Goals | Goals count only habits or projects; "Bench 100 kg", "Write 40k words", "Run 20 sessions" can't measure themselves | Measure source picker: habit check-ins (now), workouts in a routine, best lift for an exercise, thesis words, focus hours, list items done (e.g. books finished) | Gym, Thesis, Focus, Lists | Opt per goal | Field (`Goal.measure.source`, replaces `fromHabits`, migrate `fromHabits: true`) | P1 | M | Goals update themselves from real activity |
| C3 | Calendar | Gym routine weekdays aren't on the calendar, so a meeting can be booked on leg day unknowingly | Show planned training days as all-day markers (derived, not stored), toggleable like other layers | Gym | On (toggle) | Existing | P2 | S | Planning sees the whole week |
| C4 | Calendar | Courses' class times | Covered by W1 (events) | Coursework | | | P1 | | |
| C5 | Reviews | Weekly/monthly review summary leaves out workouts, words, sleep and spending | Add those lines to the review summary when data exists, reusing C1's calculations | Gym, Thesis, Health, Expenses | On | Field (`ReviewSummary` gains optional numbers) | P2 | S | Reviews reflect the whole life, not only tasks |
| C6 | Expenses ↔ Trips | See L2 | | | | | P2 | M | |
| C7 | People ↔ Meetings | Meeting attendees are free text; People has your adviser and colleagues | Attendee field suggests names from People; a person's sheet lists their meetings | People, Meetings | On | Existing (names match, no ids) | P3 | S | "When did I last meet my adviser?" |
| C8 | People ↔ Occasions | See D7 | | | | | P1 | M | |
| C9 | Focus ↔ sections | Focus page groups by top-level area only | Analytics' section breakdown includes focus minutes per section alongside tasks done | Analytics | On | Existing | P3 | S | Where time went vs what got done |
| C10 | Today ↔ Health | Today shows the gym plan line (via HabitsToday) but not the health plan (next meal, water) | Compact health line on Today: "Water 3/8 · Lunch at 13:00" with + water | Health | On when a health plan is set | Existing | P2 | S | One screen during the day |

---

## 5. Daily-usability features

| ID | Section | Problem | How it should work | Depends on | Default | Data | P | Effort | Benefit |
|---|---|---|---|---|---|---|---|---|---|
| U1 | App shell (phone) | No search on phones | Search icon in the phone header of every page (opens the existing palette), and in More | none | On | Existing | P1 | S | Everything stored becomes findable on the main device |
| U2 | Reminders | Nothing fires while the app is closed; `.ics` must be re-exported after each change | Short term: a "subscribe" `.ics` is impossible offline, so add a Today banner "3 reminders were missed while the app was closed" listing them on next open. Long term: Web Push when sync exists | Sync (long term) | On | Existing (`reminders.sentAt`) | P1 | S (banner) / L (push) | Missed reminders are at least visible |
| U3 | Today | No end-of-day close-out | Evening prompt (after 20:00, once): "Done for today? 2 open tasks" → move to tomorrow / skip with reason; links to the daily review | Tasks, Reviews | Opt | Existing | P2 | S | Clean start each morning; honest skips |
| U4 | Quick capture (+) | Capture defaults to a task; list items (expense, movie, paper) need navigation | In the composer, a prefix or chip "→ Expenses" / "→ Watchlist" adds a record to that list (e.g. `250 lunch ₹` to Expenses) | Lists | On | Existing | P2 | M | Logging an expense takes 3 seconds |
| U5 | Settings / Today | Backup is manual; the reminder says data lives only on this device | Keep as is until sync; add "Back up to a file automatically weekly" using the File System Access API where supported | none | Opt | Config | P3 | M | Fewer lost-data accidents |

---

## 6. Per-user-type needs

What the onboarding template (`src/core/domain/templates.ts`) gives each type, what actually works on day
one, and what's missing. All types also get Self-Improvement, Personal Life and Miscellaneous.

| User type | Starter sections | Works with real tools on day one | Blank pages (no kind) | Missing for this user | Recommendations |
|---|---|---|---|---|---|
| Student | Coursework (+ courses), Assignments, Exams & Quizzes, Projects, Work Misc | Course pages with Assessments list; Projects page | Assignments, Exams & Quizzes, Projects section page | Class timetable, grade so far, one view of everything due | W1, W2, W3 |
| Professional | Projects, Meetings, Reports & Reviews, Admin, Work Misc | Meetings with notes and action items; Projects | Reports & Reviews, Admin | Recurring meetings, recurring reports | PR1, PR2 |
| Exam aspirant | Subjects, Mock Tests, Revision, Current Affairs, Work Misc | Tasks only | All four | Syllabus coverage, spaced revision, mock score trend, daily reading habit. This is the weakest template | E1, E2, E3, E4 |
| Researcher | Research (+ topics), Thesis, Coursework, Adviser Meetings, Updates, Ideas & Projects | Papers, Thesis chapters and writing log, courses, meetings, Ideas list | Updates | Deadlines on Updates, thesis pace, papers ↔ chapters | W4, W5, W7 |
| Freelancer | Clients, Projects, Proposals, Invoices, Work Misc | Invoices (with the wrong template) | Clients, Proposals | Invoice tracking, client list | W8, W9 |
| General ("Other") | Projects, Work Misc | Projects | none | Everyday life lists already cover them; needs medicines, occasions lead time, bills/renewals, shopping staples | S1, L1, M1, M3 |

Also for every type: the template should seed 2–3 suggested habits matched to the type (Goals already has
presets: read papers, gym, etc.) instead of starting Habits empty. P3, S, Existing data.

---

## Not recommended (considered and left out)

- **A real map for Places**: needs a tile provider and network; the map link is enough (L3 makes places actionable).
- **Separate Inbox entity / using the unused `inbox` table**: unsectioned tasks plus F1 triage cover it with less code.
- **Kanban board for tasks**: Projects' outline and list views cover planning; no evidence it's needed.
- **AI features, Google Calendar sync, Web Push**: already deferred for external reasons; U2 is the cheap stop-gap.
- **Skills ↔ projects link**: S4's grouping gives most of the value.

---

## Top 15, ranked

Ranked by benefit to daily use × number of users affected ÷ effort. Integration and removing duplicates first.

| Rank | ID | Section | Recommendation | P | Effort | Data |
|---|---|---|---|---|---|---|
| 1 | U1 | App shell (phone) | Search button on phones opening the existing palette | P1 | S | Existing |
| 2 | D7 | Dates & Occasions / People | Occasions picks from People; one birthday, one reminder | P1 | M | Existing |
| 3 | L1 | Dates & Occasions | "Remind me N days before" for yearly dates | P1 | S | Config |
| 4 | D1 + D2 | Home / Today | Give Home and Today distinct jobs (wellbeing vs work); drop the duplicate section map; start-screen setting | P1 | M | Config |
| 5 | C1 | Analytics | Training, Wellbeing and Writing cards from existing Gym, check-in and Thesis data | P1 | M | Existing |
| 6 | S1 | Health | Medicines with times and reminders, stored as health-owned habits | P1 | M | Field |
| 7 | F1 | Inbox | "Move to…" section, project, note or list item | P1 | M | Existing |
| 8 | D3 | Health / Home | One check-in, full in Health, compact on Home/Today; sleep from bed/wake | P1 | M | Existing |
| 9 | W1 | Coursework | Class timetable as weekly recurring events | P1 | M | Existing |
| 10 | E1 + E3 | Subjects / Mock Tests | Syllabus coverage list and mock-test score trend for exam aspirants | P1 | M | Config |
| 11 | C2 | Goals | Goal measures from workouts, lifts, words, focus hours, list items | P1 | M | Field |
| 12 | F4 | Today | Re-plan all overdue tasks in one action | P1 | S | Existing |
| 13 | W3 + W4 | Coursework / Updates | Remove duplicate student sections (cross-course "Due" view); give Updates the deadlines list | P1 | S | Existing / Config |
| 14 | U2 | Reminders | "Missed while closed" list on next open | P1 | S | Existing |
| 15 | L2 | Trips | Trip spending vs budget from tagged expenses | P2 | M | Existing |

Next in line: F2 (focus time on tasks), C3 (gym days on calendar), D6 (notes on section pages), M1
(document expiries), W8 (invoice template), M3 (shopping staples).
