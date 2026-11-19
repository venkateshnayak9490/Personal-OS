# Gym, Habits and Health: workflow corrections (round 6)

19 Nov 2026. This builds on `FUNCTIONAL_IMPROVEMENTS_REPORT.md` (commit `8900a52`), which covered:
- Gym edit and delete, with confirmations and Undo
- the Monday–Sunday weekly schedule
- Start and End workout
- the explicit habit link
- optional reasons
- the missed status
- Health repeating plan items (every N minutes, hours or days, or exact times)
- the Occasions calendar

This round adds what was still missing from the new spec.

## Database changes
These are optional fields only. There's **no new table, no index, no Dexie version bump and no migration**, and existing data reads the same way.

| Where | Field | Meaning |
|---|---|---|
| `Routine.weeks?` | `{ [Monday date]: { [weekday "0"–"6"]: {routineId, dayIndex} \| null } }` | Changes for **one week only**: that weekday's workout (a day of any routine) or `null` for rest. The routine's own `days` are untouched. |
| `Habit.weekDays?` | `{ [Monday date]: number[] }` | For the Gym habit: the weekdays due in a week that differs from the usual plan. `isScheduled` checks it first. Earlier weeks are never rewritten. |
| `HealthPlan.windows?` | `{ wake?, breakfast?, lunch?, dinner?, bed?: "HH:mm" }` | The end of a time window. The plan's time is the start, so "wake up between 05:00 and 06:00" is wake `05:00` and window `06:00`. No window means an exact time, as before. |

## Gym & Fitness
- **One active routine:** you can keep several saved routines (programs, older plans), but only one is active.
  - "Make active **from today**" says so. Past workouts keep their history, and the habit's schedule history keeps past days as they were.
  - **Follow this week only** (in another routine's menu) uses that routine for the current week without changing which one is active.
- **The weekly schedule** has a choice of **One week only** (the default) or **Every week**:
  - **One week only:** pick This week or Next week. Each day shows its date. Change any day to another workout or Rest.
    - Changed days are marked **This week**, and the routine itself doesn't change.
    - Days already gone are locked.
    - **Follow another routine that week…** and **Back to "routine"** are available.
  - **Every week:** changes the routine itself from today.
  - The line above the days says which one applies, plus "5 workout days, 2 rest days".
- **Workout days a week:**
  - For a weekday routine, the count *is* the week you build ("From the days below"), so it can't conflict.
  - For a routine that goes in order, it's the number you set.
  - The Gym page's "N of M workouts" uses **this week's** planned days, so a week with Friday off expects 5.
  - Rest days never count.
- **Streak:** the Gym page's Consistency shows a streak. Recent workouts show each workout's duration, or "in progress".

## Habits ↔ Gym
- **Adding Gym in Habits:** adding a habit called Gym (or ticking **Follow my Gym & Fitness routine** on any habit) links it.
  - Its days and weekly count come from the active routine, and the "How often" fields are hidden.
  - Without a routine yet it says so and follows one as soon as you pick it.
  - Only one habit can be linked. Unticking it unlinks the habit, which keeps its current schedule.
- **The Gym card in Habits (and Today):**

| State | Shown | Actions |
|---|---|---|
| Pending | "Wed: Legs and core", muscles | **Start workout**, **Skip** |
| In progress | "In progress since 07:30" | **End workout**, Log sets |
| Completed | "Done · 07:30–08:20 · 50 min" | the times open the workout |
| Skipped | "Skipped: reason" | **Edit reason** |
| Rest day | "Rest day · No workout due" | Train anyway (optional) |
| Paused | "Routine paused: nothing due" | none |

- **Start from Habits:** records the start and stays on Habits.
  - It uses `startWorkout`, which **picks up a workout already in progress that day**, so there's never a second session.
  - The session lives in IndexedDB, so a reload or reopening the app shows it still in progress (tested).
- **End from Habits:** ends **that same session** and completes the linked habit for the day (`resyncGymDay`).
  - **Start alone never completes it.**
  - Editing, moving or deleting the session updates the habit, as before.
- **Skip:** asks for a reason (quick picks, or your own words). You can edit it later from the card or the history.
- **Statuses:**
  - A day that passes without a workout or a skip is **missed**.
  - Rest days, including days made rest for one week only, are never missed.
- **Gym & Fitness stays the source of truth** for sessions, times, duration, sets, and planned, done, skipped and missed days by week and month, plus the streak.

## Health
- **Undo:**
  - "I'm up", the meal buttons, "Going to bed", "+ Glass", and the matching reminder-card actions now show an **Undo** toast.
  - Undo (`undoHealthEvent`) takes back **just that tap**: the stamp and the shown time are removed, and sleep hours worked out from bed and wake go too.
  - If the time was corrected or tapped again since, Undo does nothing.
  - Tapping again afterwards logs once. There's still one check-in per day, so there are no duplicates.
- **Time windows:**
  - In the daily plan each time has an optional **until**: wake up 05:00–06:00, bed 23:00–00:00 (past midnight is allowed), lunch 13:00–14:00.
  - Inside the window counts as on time. After it is late. For meals, before it is early.
  - It shows as "Plan 05:00–06:00".
  - A window that ends before it starts is refused.
- **Repeating items:** they stay where they were, under Repeating plan items. The plan sheet points there.
- **Plan items are protected:** saving the daily plan keeps your repeating plan items exactly as they are.

## Dates & Occasions
Unchanged since the last round: month calendar, several occasions per date, yearly or once, reminders 1, 3 or 7 days before.

## Files
- **Domain:**
  - `src/core/domain/types.ts`
  - `progress.ts` (`mondayOf`, week-aware `isScheduled`)
  - `fitness.ts` (`plannedOn`, `weekDates`, `trainingDaysOf`)
  - `health.ts` (windows, `planTime`, `windowProblem`, timing with windows)
- **Repos:**
  - `src/core/repos/life.ts`: `startWorkout`, `changeWeek`, `resetWeek`, `followRoutineForWeek`, `linkGymHabit`, week-aware `syncGymHabit`, `undoHealthEvent`, and the sleep-hours fix when a time is cleared
  - `plans.ts`: `weekDays`
- **UI:**
  - `src/features/life/Gym.tsx` (hero, weekly schedule, routine menu, day count)
  - `GymToday.tsx` (the Gym card in Habits)
  - `GymConsistency.tsx` (streak)
  - `Workouts.tsx` (durations)
  - `src/pages/HabitsPage.tsx` (link to routine)
  - `src/features/life/Health.tsx` (Undo, windows)
  - `src/features/reminders/Reminders.tsx` (Undo)
- **Tests:**
  - `src/core/repos/life.test.ts`
  - `src/core/domain/health.test.ts`
  - `tests/e2e/m8-gym-habits-health.spec.ts` (new)
  - `m6-gym`, `m6-health` and `m7-functional` (updated selectors and the Habits Start flow)

## Tests
**Unit tests (187 pass):**
- one-week changes leave the routine, other weeks and days already gone alone; Habits follows that week only; past weeks are refused; reset
- following another routine for a week keeps the active one
- Start picks up a workout in progress
- linking from Habits takes the routine's schedule; only one habit can be linked
- Undo of "I'm up" restores everything, an old Undo doesn't touch a newer tap, and there's still one check-in
- windows are on time, late and early; validation

**End-to-end (desktop + Pixel 7):** 158 pass, 6 skipped (desktop-only). The new acceptance tests:
- Add Gym in Habits, and it follows the routine (one habit)
- Start in Habits gives in progress, and it **survives a reload**
- End in Habits gives done with times and duration; Gym shows "1 of 6" and the 50-minute workout
- change this week (Friday rest): marked, "0 of 5", next week and every week unchanged, Habits shows a rest day that Friday, Back to routine
- Skip from Habits with a quick reason, then edit the reason
- deleting the active routine asks first
- Health: "I'm up", Undo, "I'm up" again; a wake window shows "Plan 05:00–06:00", an invalid window is refused, and a tap inside it is on time

Lint, types and formatting are clean.

**Screenshots:** `docs/reports/screenshots/round6-*-{desktop,phone}.png`

## Acceptance checklist
1. Create, edit and delete routines: yes.
2. One active routine: yes.
3. Change one week without changing the routine: yes.
4. Workout and rest days: yes.
5. The Gym habit follows the schedule: yes.
6. Start from Habits: yes.
7. End from Habits: yes.
8. End completes the habit: yes.
9. Skip from Habits: yes.
10. A passed day becomes missed: yes.
11. Gym history and consistency: yes.
12. A reload keeps the active workout: yes.
13. Undo "I'm up": yes.
14. Interval Health plan: yes.
15. Occasions on a calendar: yes.

## Limitations
- **Week-only changes:** they can be made for this week and next week from the schedule (any week through the repository function). Past weeks are locked by design.
- **Gym habit card label:** the card shows the routine's usual days ("Mon, Tue, …, Sat") even in a changed week. Its weekly count ("0/5 this week") and which days are due do follow the change.
- **Sequence routines:** a routine with no fixed weekdays has no per-week editor. Use "Assign to weekdays" first.
- **Reminders:** as before, they work only while the app is open; Web Push is still to do.

## Follow-up: Today without habits, Health reset any time
- **Today** no longer shows habits. The Habits page and the Gym card there are unchanged. The "Habits today" widget and its component are removed, and a saved Today layout that listed it simply skips it.
- **Reset on Health:** every logged item (woke up, each meal, water, tonight's bedtime, bed last night) has **Reset**, which works any time, not only in the few seconds the Undo toast shows. Reset clears it as if never logged, and an Undo toast can put it back (`resetHealthEvent`/`restoreHealthEvent`, `resetWater`/`restoreWater`). If you logged it again in the meantime, the newer log is kept.
- **Earlier days:** a **Day** picker on Health opens any of the last 14 days. There you can set, correct or reset times; past days use a time field instead of the one-tap buttons, which record "now". **Back to today** returns.
- **Tests:** a unit test (reset days later, Undo, a newer log kept, water) and an end-to-end test (Reset hours later after a reload, and on yesterday). 188 unit tests and 160 end-to-end tests pass, with 6 skipped (desktop-only).
