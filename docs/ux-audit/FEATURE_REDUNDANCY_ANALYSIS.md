# Feature redundancy analysis

This document covers features that overlap, and for each one says whether to **merge**, **integrate**, **reorganise**, **simplify** or **keep separate**. Purpose comes before appearance: two things that look alike but do different jobs stay apart. The finding IDs (A1, B1, …) refer to `PERSONAL_PWA_UX_AUDIT.md`.

## Summary
| # | Overlap | Decision | Priority |
|---|---|---|---|
| RD1 | Two daily check-ins (Home card vs Health "Today") | **Merge** into one check-in | P1 |
| RD2 | Section map on Home, `/sections` page, sidebar tree, More | **Reorganise**: remove the `/sections` page; the map moves below the daily check-in | P1 |
| RD3 | Many task entry points with different defaults | **Simplify**: one default rule, shown in the box | P1 |
| RD4 | Inbox ideas, "Ideas & Projects" section, Projects screen | **Integrate**: Inbox → Ideas list → Project | P2 |
| RD5 | Water counted three ways | **Merge** to one water count; the plan item only reminds | P2 |
| RD6 | Two habit-consistency figures | **Simplify** to one definition | P1 |
| RD7 | People birthdays vs Occasions | **Integrate**: an occasion can pick a person | P2 |
| RD8 | Gym page: week strip and weekly schedule | **Merge** into the weekly schedule | P2 |
| RD9 | Health: 14-day dots and weekly check-ins | **Merge** into one history | P3 |
| RD10 | Dated things in five models; the calendar shows three | **Integrate** as optional calendar layers | P2 |
| RD11 | Empty seeded sections (10 of 24) | **Simplify** seeding | P1 |
| RD12 | Six places for free text | **Keep separate**, but **integrate** links and listing | P2 |
| RD13 | Section outlines vs project outlines | **Keep separate** (different purposes) | — |
| RD14 | Reviews vs Analytics | **Keep separate**; **integrate** the numbers into reviews | P2 |
| RD15 | Health repeating plan items vs Habits | **Keep separate**; clarify the naming | P3 |
| RD16 | Skip on the Gym page hero and on the Habits card | **Keep both** (same data, two natural places) | — |
| RD17 | Mood asked on Home and in Journal | **Keep**, already one value; show it as one | P3 |
| RD18 | Two date-entry styles | **Simplify** to one picker | P2 |
| RD19 | Settings: messages, widgets and bottom tabs all scattered | **Reorganise** into sub-pages | P2 |

---

## Details

### RD1 Two daily check-ins → merge (P1)
- **What overlaps:**
  - The **Home** check-in records mood, energy, sleep hours (typed), water (a counter) and weight.
  - **Health → Today** records wake-up, meals and bed (one tap, timestamped), water (with times) and sleep (worked out from bed and wake).
  - Both write to the same day's check-in record, so typed sleep and computed sleep overwrite each other **[C]**.
- **Purpose:** the same, "how did my body do today".
- **Decision:** one check-in component with the Health data model (timestamps, Undo/Reset, windows) plus mood, energy and weight.
  - Shown compactly at the top of Home.
  - Shown in full on Health.
  - Sleep hours come from bed and wake times. A typed figure is offered only when the times are missing.
- **Benefit:** one place in the morning, no conflicting numbers.
- **Complexity:** M.

### RD2 Four ways to reach sections → reorganise (P1)
- **What overlaps:** the Home map, the `/sections` page (via More), the sidebar tree on desktop, and subsection chips on area pages.
- **Purpose:** the map is your requested "structure of everything" overview. The `/sections` page is a plain list of the same thing.
- **Decision:**
  - Remove `/sections` and have More link to the Home map.
  - On Home, put the check-in and "today at a glance" first, with the map below them, collapsible, and its state remembered.
  - This keeps the map you asked for, without making it the first thing you have to scroll past every morning.
- **Complexity:** S.

### RD3 Task entry points → simplify defaults (P1)
- **What overlaps:** ＋, the Today box, the All Tasks box, Inbox, section and project outlines, and Ctrl+K all add tasks, each with a different section and date default (B1). Typing in different places is right. The **defaults** being different is the problem.
- **Decision:**
  - One rule: a task goes where you are (section or project page) or, anywhere else, to the Inbox. It's due today only when you add it on Today, or when you type a date.
  - The ＋ sheet shows the destination as an editable chip before saving ("→ Inbox · today"), not afterwards.
  - Keep all the entry points.
- **Complexity:** S.

### RD4 Ideas in three places → integrate (P2)
- **What overlaps:** an Inbox item of kind "idea", the Ideas list in "Ideas & Projects", and the Projects screen.
- **Purpose:** the stages of one pipeline (capture → keep → act).
- **Decision:**
  - Inbox "Move to…" can target the Ideas list.
  - An idea gets "Make a project", which carries its notes.
  - The project links back to the idea.
  - Don't merge the screens.
- **Complexity:** M.

### RD5 Water in three places → merge (P2)
- **What overlaps:** the Home water counter, Health "+ Glass", and a "Drink water" plan item. All count glasses or occasions.
- **Decision:**
  - One water count, with times.
  - The plan item becomes a **reminder rhythm** for that count: marking an occurrence done adds a glass, so you don't tick separately.
  - The Home counter is the same control.
- **Complexity:** S–M.

### RD6 Two habit-consistency figures → simplify (P1)
- **What overlaps:** the Analytics "Habits" tile (`habitConsistency`) and the Gym card or Gym page (`adherence`). They give different numbers for "N times a week" habits, because `adherence` counts every day of such a habit as planned (D3).
- **Decision:** use one function everywhere.
  - Fixed-days habits: planned days are the denominator, missed counts against you, rest is excluded, and nothing counts before the habit existed.
  - Per-week habits: the target is N per week, and only a week short of N counts as missed.
- **Complexity:** S.

### RD7 People vs Occasions → integrate (P2)
- **What overlaps:** the same birthday entered in People and in Occasions. Today it's de-duplicated only when the names match **[C]**.
- **Decision:** the occasion sheet has an optional "Person" picker. A person's birthday and anniversary appear on the Occasions calendar automatically, without a second entry. Keep both screens: People is about relationships, Occasions about dates.
- **Complexity:** M.

### RD8 Gym week strip + weekly schedule → merge (P2)
- **What overlaps:** both show this week's training days. The strip shows done/planned, and the schedule shows what each day is.
- **Decision:** one weekly schedule with a done tick per day. Drop the strip. This also shortens a 2-screen page.
- **Complexity:** S.

### RD9 Health history blocks → merge (P3)
- **What overlaps:** the "Last 14 days" on-time dots and "Check-ins by week" (a grid of values).
- **Decision:** one history with on-time/late shown as text or icons (also fixing the color-only dots, E2) and the values beside them.
- **Complexity:** M.

### RD10 Dated things across five models → integrate as layers (P2)
- **What overlaps:** events, dated tasks, list-record dates (birthdays, deadlines), the gym weekday plan, and health plan items. The calendar shows the first three.
- **Decision:** don't merge the models; each has its own rules. Add optional calendar layers for gym days and health appointments/plan items, toggled per layer.
- **Complexity:** M.

### RD11 Empty seeded sections → simplify (P1)
- **What overlaps:** 10 of the 24 Researcher sections are empty containers with only "Tasks 0 open" (G1). Areas (Work, Self-Improvement, Personal Life, Miscellaneous) duplicate their children's content.
- **Decision:**
  - Seed only the sections with a tool, plus the four areas.
  - Offer the rest as one-tap suggestions ("Add Updates, Household, Documents?").
  - Areas show a summary (open tasks by child, next deadlines) rather than their own empty outline.
- **Complexity:** S. Affects only new installs and the suggestions.

### RD12 Free text in six places → keep separate, integrate (P2)
- **The six places:** Notes, section page notes, Journal, meeting notes, list-item comments and Vault notes have different privacy and context needs.
- **Decision:**
  - Keep them separate.
  - Notes can be attached to a section or project, and are listed on that page.
  - Section page notes appear in the Notes list as "on <section>".
  - Search already covers them.
  - The unused `links` table would back this.
- **Complexity:** M.

### RD13 Section outlines vs project outlines → keep separate
- The same editor is used for two jobs: ongoing area vs finite outcome with progress. Section pages already list their projects' tasks.
- **No change**, apart from a one-line explanation on the empty project and section states.

### RD14 Reviews vs Analytics → keep separate, integrate (P2)
- Reviews are reflective and their numbers are frozen. Analytics is exploratory and live.
- **Decision:** the weekly review's "numbers" block gains the Gym/Health/Thesis summaries, and links to Analytics for the same period.
- **Complexity:** S.

### RD15 Health plan items vs Habits → keep separate (P3)
- The purposes differ:
  - A plan item is an intra-day rhythm (every 2 h).
  - A habit is a daily or weekly commitment with streaks.
- **Decision:** keep them separate.
- Rename "Repeating plan items" to "Reminders through the day" so it doesn't read like a second habit system.

### RD16 Skip in two places → keep
- The Gym page and the Habits card use the same data. Users start from either.

### RD17 Mood on Home and in Journal → keep (P3)
- It's already one stored value per day. Show it as such: the Journal shows "Mood: 4 (from your check-in)" instead of asking again.

### RD18 Two date-entry styles → simplify (P2)
- Native date and time fields (Health, Gym, Occasions) vs the custom DatePicker (tasks, goals).
- **Decision:** use the custom picker for dates. Keep the native time fields; they're fine on phones.
- **Complexity:** S–M.

### RD19 Settings sprawl → reorganise (P2)
- Messages, the bottom-bar tabs, the Today widgets and theme are "personalise". Backup, storage and app lock are "keep my data safe". Reminders and quiet hours are "notifications". Profile and the sections editor are "workspace".
- **Decision:** split Settings into four sub-pages with those names. Customize Today stays on Today.
- **Complexity:** S.

## Considered and **not** recommended for merging
- **Habits and Gym.** Already integrated through one linked habit. A full merge would lose the Gym page's own tools.
- **Calendar and Tasks.** Different jobs (time blocks vs commitments). Tasks already appear on the calendar.
- **Notes and Journal.** Different privacy and rhythm.
- **Focus and Tasks.** Focus already starts from a task. A separate page is still needed for untied sessions.
