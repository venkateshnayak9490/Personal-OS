# Notifications, adaptive day, refresh: audit and proposal

Status: **agreed 2026-11-25.** Decisions in §8: Supabase push (Edge Function + cron), adaptive mode defaults to _Suggest_, the planned day is read from existing items, and stages run in order 1 → 7.

---

## 1. Audit: what exists today

| Area                  | What's there                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | What it means for this work                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stack**             | React 19 + TypeScript + Vite PWA. Data in IndexedDB (Dexie), synced through Supabase (one `sync_rows` table, JSON rows, RLS per user). Hosted on Vercel.                                                                                                                                                                                                                                                                                                                                                               | Everything runs on the device; the server only stores rows. There's no server code yet.                                                                                                                                             |
| **Reminders**         | `Reminders.tsx` + pure functions in `core/domain/reminders.ts` (`dueReminders`, `occasionReminders`) and `core/domain/health.ts` (`healthReminders`). They cover timed tasks, deadlines (`remindBeforeMin`), events, habits (`remindAt`, repeat until checked in), meals, water, bedtime, health plan reminders and occasions. Snooze, dismiss, quiet hours and the repeat interval are already settings. Every reminder fired is recorded in the synced `reminders` table, so it shows **once**, even across devices. | A good engine to reuse. The gap: it only runs **while the app is open**. A system notification appears only when the app is open in the background (`notify()` returns early otherwise).                                            |
| **Permission**        | One "Allow notifications" button in Settings. Never asked at launch.                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Already contextual. Keep that and add a prompt at the moment you set a reminder.                                                                                                                                                    |
| **Service worker**    | `vite-plugin-pwa` with `registerType: 'prompt'`. A new version waits until you tap **Reload** on "A new version is ready". It checks for updates **once an hour**. `sw.js` and `index.html` are served `no-cache`.                                                                                                                                                                                                                                                                                                     | Explains why you saw the old design after deploys: the new version had downloaded and was waiting, and "Later" hid the prompt. There's no update check when the app comes back to the foreground, and no manual way to trigger one. |
| **Sleep**             | Health plan (in profile settings): `wake`, `breakfast`, `lunch`, `dinner`, `bed`, optional windows (wake 05:00–06:00). One-tap **I'm up** / **Going to bed** buttons write exact stamps to the day's `checkins` (`bedTime`, `wakeTime`, `stamps`). "I'm up" is also an app-icon shortcut.                                                                                                                                                                                                                              | The triggers for re-planning already exist and record **actual** times. There's no sleep-duration target yet.                                                                                                                       |
| **Tasks**             | `priority` P1–P4, `kind` (incl. `deadline`), `dueDate` + `dueTime`, **`estimateMin` (exists, unused in UI)**, `status` (incl. `in_progress`, `skipped`), `completedAt`, subtasks (`parentTaskId`), recurrences with per-day occurrences.                                                                                                                                                                                                                                                                               | Durations and priorities are in the model. "Fixed vs flexible" and "after X" (dependency) are not.                                                                                                                                  |
| **Habits / gym**      | Habits: target (daily, N per week, weekdays), `remindAt`, repeat. Gym habit takes its days from the active **weekday routine**; workouts record `startedAt` / `endedAt`.                                                                                                                                                                                                                                                                                                                                               | Habits have a time but no duration. Gym days are already day-specific.                                                                                                                                                              |
| **Events / meetings** | Calendar events with start/end, repeat rules, meeting notes.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | These are the fixed commitments.                                                                                                                                                                                                    |
| **Actual activity**   | `completedAt` on tasks and occurrences, habit logs (done / skipped / rest / missed), focus sessions (real start/end, linked to a task), workout start/end, meal and sleep stamps.                                                                                                                                                                                                                                                                                                                                      | Most of the **Actual** layer is already recorded. Only "partly done" and "deferred" outcomes, plus start time for tasks outside a focus session, are missing.                                                                       |
| **Day view**          | Today's time axis (`DayStrip`) shows timed tasks, events and plan times.                                                                                                                                                                                                                                                                                                                                                                                                                                               | The adjusted day can be drawn here instead of on a new screen.                                                                                                                                                                      |

**What there isn't:** a single "planned daily schedule" object. Your plan today is spread across the health plan times, habit times, timed tasks, gym days and events. This proposal **doesn't add a second place to plan your day**. The planned layer is read from where you already set things.

---

## 2. Device notifications

### Choice: Web Push from Supabase (free), with the app's own reminder engine deciding _what_ and _when_

Without a server, there's no reliable way to notify when the app is closed. Notification Triggers were abandoned. Periodic Background Sync is Chrome-only, runs at most roughly every 12 hours, and can't hit a time. So:

```
Device (open now and then)                 Supabase (always on)                Push service → device
─────────────────────────                  ───────────────────                 ─────────────────────
existing reminder functions  ──upsert──▶   push_queue (next 48 h)
compute the next 48 h                      push_subscriptions (per device)
                                           pg_cron, every minute ──▶ Edge Function "send-due"
                                               picks due rows, sends Web Push (VAPID) ──▶ service worker
                                               marks sent, drops dead subscriptions       shows notification,
                                                                                          click opens the item
```

- **What gets queued.** Whenever the app runs and after every sync, the device works out the next 48 hours of reminders. It uses the same functions that drive the in-app cards, so the rules stay in one place: tasks, deadlines, events, habits, gym, meals, water, bed, plan items and occasions. Those go into `push_queue`, with one row per reminder occurrence. The row id is the existing `reminderKey` (target + fire time), so two devices queueing the same reminder write the **same row**.
- **Sending.** `pg_cron` calls an Edge Function every minute. It sends each due row once to each of your subscribed devices and stamps `sent_at`. A `404` or `410` from the push service deletes that subscription, which covers expired subscriptions. Other failures retry twice, then give up.
- **No duplicates:**
  1. One queue row per reminder occurrence, shared by all devices.
  2. The notification `tag` is the reminder key, so a repeat replaces rather than stacks.
  3. The service worker skips the system notification when the app is open and visible, because the in-app card already shows. The in-app engine already records each reminder once in `reminders`.
- **Clicking a notification** focuses the open app, or opens it, at the item's page: `/tasks?task=…`, the habit, the event, or Health.
- **Actions on the notification** (Android and desktop Chrome or Edge): **Done** and **Snooze 10 min**. They write to the local database from the service worker and sync later.
- **Preferences** (Settings → Notifications, synced with your profile):
  - master on/off, and on/off per device;
  - categories: tasks, deadlines, events, habits, gym, health, occasions;
  - lead times: events N min before, deadline reminders (already per task);
  - quiet hours and repeat interval (both already exist).

  Individual reminders keep their existing per-item settings.

- **Permission** is asked in context: the first time you set a reminder time on something, or from Settings. Never at launch. If permission is denied or later revoked, Settings says so and explains how to re-allow it, and the in-app reminders keep working.

### Platform limits (we can't change these)

- **Android (Chrome):** works with the app closed.
- **iPhone/iPad:** works only for the app **added to the Home Screen**, on iOS 16.4 or later. Not in Safari tabs.
- **Windows/macOS:** works when the app is closed but the browser (Chrome or Edge) is still running in the background. That's the default on Windows. It doesn't work if the browser is fully quit.
- Timing is within about a minute (cron granularity).
- A reminder created **offline** reaches the server only once that device syncs. Reminders for things created on the phone while offline still fire in the app on the phone itself.

### What it needs from you (once)

- I generate a VAPID key pair. The public key goes in the app. You paste the private key into Supabase → Edge Functions → Secrets, because I don't enter keys.
- Deploy the Edge Function and the migration. Either you run two Supabase CLI commands, which I'll write out, or I do it while you're signed in to the CLI.
- Enable `pg_cron` and `pg_net` in Supabase (two switches). Both are free-tier.

**Cost:** ₹0 on Supabase's free tier. One cron call a minute is about 43k a month, against 500k Edge Function calls.

---

## 3. Adaptive day engine

### 3.1 Inputs, read from what you already have

| Kind                    | Comes from                                                                                               | Rule                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Fixed**               | events and meetings; tasks with `kind: deadline`; any task or habit you mark **Fixed time** (new switch) | Never moved.                            |
| **Flexible**            | timed tasks, habits with a time, gym session, health plan items, meals (anchored to wake)                | Can move. Keeps its duration and order. |
| **Optional**            | tasks/habits you mark **Optional** (new switch), P4 tasks                                                | Deferred first when time runs out.      |
| **Done or in progress** | completed items; a running focus session or workout; tasks `in_progress`                                 | Never touched.                          |

Durations come from `estimateMin`, which already exists and gets a field in the task sheet; habits get one too. When there isn't one, the default is 30 min for tasks and habits, 60 min for gym, 30 min for meals. All of these are editable in Settings.

**Dependencies:** "do after …" is **new and optional** (`afterId` on a task or habit). Without it, the planned order of the day is the dependency.

**Sleep settings** (added to the health plan): target sleep (7 h), minimum sleep (6 h), the existing bed and wake times, and the existing windows as the flexibility.

### 3.2 When it runs

- **Going to bed** pressed: the projected wake is `bed + target sleep`, then the next day is planned.
- **I'm up** pressed: the actual wake replaces the projection, and the rest of the day is planned again.
- Manual "Re-plan the rest of today" (button on Today).
- **Not** on small changes. It proposes only if something moves by ≥ 20 min. The threshold is a setting.

### 3.3 Algorithm: priority-ordered placement into free time (deterministic)

1. **Day window:** from wake (actual or projected) to `next bed`. The next bed is the planned bedtime. If you went to bed late, it **isn't** pulled earlier to "catch up".
2. **Sleep check:** if a fixed item falls inside the sleep window (`bed → bed + target`), say so: _"Your 08:00 meeting leaves 6 h sleep."_ Sleep is never shortened silently. Below the minimum, the message is a warning.
3. **Busy time:** fixed items, done or in-progress items, and the past (`now`). The rest is a list of free gaps, with a 10-min buffer after each item (setting).
4. **Order of placement:**
   1. P1 tasks
   2. habits that are due today (gym on its routine day only)
   3. P2/P3 tasks and flexible plan items
   4. optional and P4 items

   Inside each tier, items keep their **planned order**.

5. **Placement:** each item goes into the first gap that starts at or after **all** of these, and that it fits whole:
   - its planned time shifted by the morning's delay;
   - the end of anything it comes after;
   - the end of the previous item in its sequence.

   Items are never split or squeezed.

6. **Doesn't fit today:** the item is **deferred** to the first day it fits, which is shown and not hidden. Nothing is dropped, nothing is marked done, and a habit is never scheduled twice in a day.
7. **Overnight:** times are minutes from the start of the day _you woke into_, so a 01:00 bedtime belongs to the previous evening. This matches how Health already files sleep.

**Why not a constraint solver (OR-tools, an ILP)?** A typical day has fewer than 30 items, and the rules above are a strict hierarchy, so greedy placement in priority order gives the same answer a solver would for this shape of problem. It can also explain every move ("moved because you woke 1 h 10 min late; 09:00–10:00 is now taken by your meeting"). It runs instantly offline and needs no new dependency. The trade-off: when two items compete for one gap, it won't find a clever reshuffle that a solver might. Lower-tier items lose, which matches your priority order.

### 3.4 You stay in control

- **Off, Suggest (default), or Automatic** (Settings).
  - **Suggest:** after "Going to bed" or "I'm up", a sheet shows _"Your day, adjusted"_. It lists each moved item as planned → adjusted with the reason, and you can **Accept all**, accept or reject per item, or edit a time.
  - **Automatic:** applies straight away, with a one-line notice and **Undo**.
- Moved items show both times on Today and on the time axis, e.g. ~~09:00~~ 10:15. **Restore planned times** puts the day back.
- History: every adjustment (automatic, accepted, rejected, manual) is kept for that day.
- Notifications follow the **adjusted** times once accepted, because the push queue is rebuilt.

---

## 4. Planned, Adjusted, Actual

| Layer        | Where it lives                                                                                                                                                                                                                     | Rules                                                                                                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Planned**  | Where it is today: the task's `dueTime`, the habit's `remindAt`, health plan times, the gym routine.                                                                                                                               | The engine **never writes here**. Editing your plan stays as it is.                                                                                                                                                                                                  |
| **Adjusted** | New synced table **`dayPlans`**, one record per date (`id = date`, so two devices merge into one).                                                                                                                                 | Per item: `ref`, `plannedStart`, `plannedMin`, `adjustedStart`, `reason`, `source` (auto or manual), `state` (proposed, accepted or rejected), plus a `history[]` of changes. Wake, bed and sleep-target inputs are stored too, so the reasoning can be shown later. |
| **Actual**   | Mostly **existing** records: `completedAt`, focus sessions (start/end), workout start/end, habit logs, meal and sleep stamps. New: a task **Start** action records `startedAt`, and an outcome of **partly done** or **deferred**. | Never inferred from the clock. A moved item is not done, and a passed time doesn't mark anything done.                                                                                                                                                               |

Analytics gain "planned vs actual start" and "on time vs adjusted plan". Existing stats keep reading the same fields, so nothing changes under them.

**Database changes** (Dexie version 12, purely additive, so old data keeps working):

- **New table** `dayPlans`.
- **New optional fields:**
  - `Task.startedAt`, `Task.fixed`, `Task.optional`, `Task.afterId`, `Task.outcome`;
  - `Habit.durationMin`, `Habit.fixed`, `Habit.optional`;
  - in the health plan: `sleepTargetH` and `sleepMinH`;
  - in settings: `notify`, `adapt`.
- **Supabase:** one migration adding `push_subscriptions` and `push_queue` (RLS per user, like `sync_rows`), plus the cron job.

---

## 5. Desktop refresh, and stale versions

- **The real fix:**
  - check for a new version whenever the app comes back to the foreground, not just hourly;
  - when one is waiting, keep a small **"Update ready"** marker on the refresh button instead of a prompt that "Later" hides for good.

  Still never a reload on its own, so nothing is lost mid-edit.

- **The refresh button** sits in the desktop sidebar header, next to search, as a 16 px icon in the existing ghost-button style. When pressed:
  1. it syncs now;
  2. if a new version is waiting, it installs it, otherwise it checks for one;
  3. then it reloads.
- **Unsaved changes:** everything typed straight into the app saves as you type, and pending sync survives a reload. The one real risk is a **half-filled sheet** (New task, New event…). Sheets that have been edited register as "dirty", and Refresh asks first: _"Discard the task you're writing?"_

---

## 6. Stages (one PR each, tested before the next)

| #   | Stage                                                                                                             | Size | Merge risk                                  |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------- |
| 1   | Refresh button + update-on-focus + dirty-sheet guard                                                              | S    | Low. Fixes the stale-version problem first. |
| 2   | Push infrastructure: migration, Edge Function, VAPID, SW push and click handling, device subscription in Settings | M    | Needs your one-time Supabase steps (§2).    |
| 3   | Push queue from the existing reminder functions, plus notification preferences and actions                        | M    |                                             |
| 4   | Sleep target, durations, fixed/optional switches (fields + UI)                                                    | S    | Additive fields only.                       |
| 5   | Scheduling engine (pure functions + heavy unit tests for every scenario in your list)                             | M    | No UI yet, so nothing can break.            |
| 6   | `dayPlans` + Suggest/Automatic flow + Today/time-axis display + restore + history                                 | M–L  |                                             |
| 7   | Actual layer: Start, partly done, deferred + planned-vs-actual analytics                                          | S–M  |                                             |

Each stage: unit tests for the logic, end-to-end tests for the flows, the full existing suite green, and checks on phone and desktop sizes. Design follows Timetable (DESIGN.md).

## 7. Edge cases covered by tests

- **Sleep:**
  - bed on time;
  - 1–2 h late;
  - after midnight;
  - waking early or late;
  - a fixed meeting inside the sleep window.
- **Re-planning:**
  - two re-plans in one day;
  - a change below the threshold, so nothing proposed;
  - a manual override, then a re-plan (the override is kept);
  - done or in-progress items untouched.
- **Fitting the day:**
  - a day too full, so optional items are deferred first and nothing is dropped;
  - recurring habits not duplicated;
  - gym only on routine days;
  - yesterday's unfinished tasks;
  - a time-zone change.
- **Notifications:**
  - permission denied or revoked;
  - an expired subscription;
  - two devices queueing the same reminder;
  - the app open versus closed;
  - clicking through to the right item.

## 8. Decisions I need from you

1. **Supabase Edge Function + cron for push** (free) — OK? It's the only option that works with the app closed.
2. **Adaptive mode default:** _Suggest_ (you review each change) or _Automatic_ (applies, with Undo)?
3. **Planned schedule:** read from your existing plan (recommended) or add a new "daily timetable" editor? The second duplicates what you already set in Health, Habits and Tasks.
4. **Order of stages:** start with 1 (refresh, quick) then 2–3 (notifications), or the adaptive day (4–7) first?
