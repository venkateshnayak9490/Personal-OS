# Feature gaps and recommendations

This document lists features that would make daily use better. It's not here to make the app look more advanced. Improvements to features that already exist come first.

**How to read the tags:**

- **Type:** Add (a new feature) or Improve (an existing one).
- **Complexity:**
  - S: under a day
  - M: 1–3 days
  - L: more than 3 days, or needs a server
- **Priority:**
  - P1: frequent, high value
  - P2: useful
  - P3: optional

The fixes and merges are in `FEATURE_REDUNDANCY_ANALYSIS.md`. This document adds what's **missing**.

## Ranked list

| ID   | Recommendation                                               | Where             | Type    | Priority | Complexity |
| ---- | ------------------------------------------------------------ | ----------------- | ------- | -------- | ---------- |
| GP1  | "Today at a glance" + one check-in at the top of Home        | Home              | Improve | P1       | M          |
| GP2  | ~~Evening "Plan tomorrow"~~ **Dropped** (your decision)      | —                 | —       | —        | —          |
| GP3  | Inbox "Move to…" project, list or note                       | Inbox             | Improve | P1       | M          |
| GP4  | Goals measured from data the app already has                 | Goals             | Improve | P1       | M          |
| GP5  | App-icon shortcuts (New task, I'm up, Start workout, Search) | PWA manifest      | Add     | P1       | S          |
| GP6  | Closed-app reminders (Web Push)                              | Reminders         | Add     | P1       | L (server) |
| GP7  | Weekly plan step in the weekly review                        | Reviews           | Improve | P2       | M          |
| GP8  | Time estimates and a daily load indicator                    | Tasks / Today     | Improve | P2       | M          |
| GP9  | Calendar layers: gym days, health plan                       | Calendar          | Improve | P2       | M          |
| GP10 | Notes linked to sections and projects                        | Notes             | Improve | P2       | M          |
| GP11 | Coursework: cross-course "Due" view and class timetable      | Coursework        | Improve | P2       | M          |
| GP12 | Search filters and recent items                              | Search            | Improve | P2       | S–M        |
| GP13 | Encrypted backup file                                        | Settings → Backup | Improve | P2       | M          |
| GP14 | Medicines with dose times                                    | Health            | Add     | P2       | M          |
| GP15 | Papers ↔ Thesis chapter links                                | Research / Thesis | Add     | P3       | M          |
| GP16 | Trip budget from expenses                                    | Trips / Expenses  | Improve | P3       | M          |
| GP17 | Shopping staples (re-add with one tap)                       | Shopping          | Improve | P3       | S          |
| GP18 | Events from plain-language capture ("call Amma sun 6pm")     | Capture           | Improve | P3       | M          |
| GP19 | Google Calendar (read-only import of events)                 | Calendar          | Add     | P3       | L          |

---

## Details

### GP1 "Today at a glance" + one check-in on Home (P1, M)

- **Problem:** the morning takes three screens (A1, A2, A6). The first phone screen on Home is a navigation map.
- **How it would work:**
  - The app opens on Today (work) on desktop and phone.
  - The top of Home shows:
    - the merged check-in (RD1): I'm up, water +, mood, energy, and meals as one-tap chips
    - due health plan items
    - the next event
  - The section map is below, collapsible.
  - Today stays work-only and habits stay on the Habits page, as you decided.
- **Where:** Home. Integrated, not a new screen.
- **Value:** the morning routine on one screen. This matters most for daily use.

### GP2 Evening "Plan tomorrow": dropped

You decided not to add an evening wrap-up. "Move all overdue" on Today already handles leftover tasks.

### GP3 Inbox "Move to…" (P1, M)

- **Problem:** captured items can only go to a section (B3).
- **How it would work:** the item menu offers "Move to" a project (it becomes a task there), a list (it becomes a list item, e.g. Ideas or Movies), or a note.
- **Where:** Inbox.
- **Value:** makes capture-then-sort real. This is the core of a Personal OS.

### GP4 Goals measured from existing data (P1, M)

- **Problem:** goals like "Read 30 papers" or "Train 150 times this year" need manual counting (C2).
- **How it would work:** a goal measure picks a source:
  - a habit's done days (exists)
  - finished workouts
  - words written
  - focus hours
  - list items reaching a status, e.g. Papers → Read
- **Where:** Goals.
- **Value:** goals update themselves, so they stay honest.

### GP5 App-icon shortcuts (P1, S)

- **Problem:** the most frequent actions take an app open plus 1–3 taps.
- **How it would work:** PWA manifest `shortcuts`. A long press on the app icon offers New task, I'm up, Start workout and Search, each opening the app at that action.
- **Where:** PWA manifest plus 4 small routes.
- **Value:** these are the most-repeated actions of the day, done in one gesture.

### GP6 Closed-app reminders (P1, L)

- **Problem:** reminders fire only while the app is open (known limitation). "While you were away" softens it.
- **How it would work:** Web Push through a Supabase Edge Function and `pg_cron`, using the existing reminder rules.
- **Where:** Reminders.
- **Depends on:** Supabase being set up and the four sync-only risks being fixed first (L3).
- **Value:** reminders work when the app is closed, as people expect.

### GP7 Weekly plan in the weekly review (P2, M)

- **Problem:** the review looks back only (K1).
- **How it would work:** the last step picks up to 3 outcomes for next week from projects and goals, shown on Today all week. The Gym/Health/Thesis numbers are also added to the review (RD14).
- **Where:** Reviews.

### GP8 Time estimates and daily load (P2, M)

- **Problem:** there's no sense of whether today's list fits the day. The `estimate` field already exists without UI (B4).
- **How it would work:** an optional "~30m" in capture ("draft intro 2h"). Today shows "≈ 5h planned · 3h of events" as a gentle warning, not a block.
- **Where:** Tasks / Today.

### GP9 Calendar layers (P2, M)

- See RD10. Gym days and health appointments and plan items as toggleable layers.

### GP10 Notes linked to sections and projects (P2, M)

- See RD12. A note can belong to a section or project and is listed there. Section notes appear in Notes.

### GP11 Coursework (P2, M)

- **Problem:** there's no view across courses (G2).
- **How it would work:** the Coursework page shows "Due in the next 14 days" across all courses' assessments. A weekly class timetable is entered as recurring events with the course tag.

### GP12 Search filters and recents (P2, S–M)

- **Problem:** search finds everything but can't be narrowed.
- **How it would work:** filter chips (Tasks, Notes, Lists, Meetings, Journal) and a "Recent" group when the box is empty.

### GP13 Encrypted backup (P2, M)

- **Problem:** the backup file is plain JSON, including journal and health data. Vault items are already encrypted.
- **How it would work:** an optional passphrase on export (the same Argon2id/AES-GCM code as the Vault).
- **Value:** safe to keep the file in cloud storage.

### GP14 Medicines (P2, M)

- Health-owned items with dose times and "taken" logs, reusing the repeating plan items (exact times) and reminders. Only if you actually need it. It was listed earlier and not asked for.

### GP15–GP19 (P3)

- **GP15 Papers ↔ Thesis chapters:** "cited in" links.
- **GP16 Trip budget:** spending from tagged expenses.
- **GP17 Shopping staples:** "bought" moves an item to staples, and one tap re-adds it.
- **GP18 Events from capture:** when the phrase has a time and an "event" word.
- **GP19 Google Calendar:** a read-only import of events, which needs OAuth and a server.

## Considered and not recommended

- **AI summaries and suggestions.** Not needed for the core loop yet, and they add cost and privacy questions. Revisit after sync.
- **Gamification** (points, badges). It conflicts with the honest-numbers principle.
- **More list templates.** The existing ones cover the sections. Custom lists already handle the rest.
- **Streak freezes.** Rest days already do this honestly.
- **A separate "Dashboard builder".** Customize Today already covers it. More flexibility would add complexity without daily value.
