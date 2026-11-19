# Gym and Habits integration report

19 Nov 2026. This builds on the existing Gym module (routines, programs, workout logger, PRs, cardio) and the Habits system. There's no separate tracker.

## Architecture decisions

- **The routine is the source of truth.**
  - A weekday routine (`Routine.byWeekday`) defines which days are training days.
  - `syncGymHabit` (`src/core/repos/life.ts`) keeps one linked habit (`Habit.source = 'gym'`) in step: due on the training days, with a note listing the week.
  - It **reuses** your existing "Gym" habit if there is one and never makes a second.
  - It runs when a weekday routine is made active, saved or paused.
- **Habit occurrences are tracked per date** in `habitLogs`, with one log per habit per day:
  - status `done`, `skipped` or `rest`
  - for a skip, the reason `note` and `skippedAt`
  - the `planned` workout name
  - the `workoutId` of the session that completed it
- **History stays stable.** When the plan changes, the old schedule goes into `Habit.targetHistory` (`{ until, target }`). `isScheduled` and `targetOn` (`src/core/domain/progress.ts`) use the schedule that applied **on that date**. Editing next week's plan never turns a past training day into a rest day, or the other way round.
- **Rest days** are the weekdays with no workout:
  - They're shown explicitly in the editor ("Rest day") and in the week strip.
  - They're never due, so they never count as missed, never break consistency and never remind you.
  - An explicit `rest` log on a training day also counts as rest.
- **Pausing** a routine sets its days to none (the old schedule is kept). Nothing is due, and nothing reminds you, until you resume.

## Features

1. **Weekly routine builder** (`src/features/life/RoutineWeekEditor.tsx`). Turn on "Fixed weekdays" in Create or Edit routine, and each day Monday to Sunday shows either:
   - **Rest day**, with "+ Workout", or
   - a workout with a name, **muscle groups** (Chest, Back, Shoulders, Biceps, Triceps, Legs, Glutes, Core, Cardio, Full body; several allowed), and **exercises** (sets, reps, **target kg**) or **cardio** (minutes).
   - Exercises can be reordered, and a day can be **Copied** or **Moved** to another weekday (moving onto a planned day swaps them) or turned into **Rest**.
   - Built-in programs and sequence (non-weekday) routines work as before.
2. **Gym ↔ Habits.**
   - **Habits** and **Today** show the Gym habit with today's plan: "Mon: Chest, triceps, shoulders", muscle chips, its status (Done, or Skipped with the reason), and **Start** and **Skip** (`src/features/life/GymToday.tsx`).
   - **Start** opens the workout from the routine.
3. **Workout completion.**
   - The first entry of a workout marks that day's habit done and stores `workoutId` and `planned`.
   - Further workouts that day don't check it in again.
   - Sets, reps, weight, cardio and PRs are unchanged.
   - A planned target weight pre-fills the set when there's no "last time".
4. **Skipping.**
   - Skipping from the Gym page, Habits, Today or a habit's day cell asks "What got in the way?" and **requires a written reason** (not just spaces).
   - Quick picks: Feeling unwell, Work commitments, Lack of time, Fatigue, Personal reasons, Other.
   - It records the date, planned workout, status, reason and time of the skip.
   - **Edit** a reason from the Gym page's "Skipped workouts" or a habit's History. The original skip time is kept.
5. **Consistency** (`src/features/life/GymConsistency.tsx`, `adherence()` in `progress.ts`):
   - **This week** and **This month** each show: % done of planned, then done, skipped, missed, rest and extra.
   - **Planned** is the denominator; rest is excluded.
   - **Today** counts only once it's logged.
   - A workout on a rest day counts as **extra**, not as adherence.
   - The workout history list is as before.
6. **Reminders.**
   - The Gym habit's reminder (07:00 by default) fires on training days only.
   - It repeats until a workout is logged or the day is skipped, and respects quiet hours and snooze (see the Vault and reminders report).
7. **Pause or replace.** The routine menu has **Pause** and **Resume**. "Make active" replaces the active routine, and the habit follows it.

## Migration
- **None needed:** no new tables or indexes. New optional fields:
  - `Routine.paused`, day `muscles[]`, `RoutineExercise.weight`
  - `Habit.source`, `Habit.targetHistory[]`
  - `HabitLog.planned`, `workoutId`, `skippedAt`
- **Existing data:** routines, habits and logs read as before. A habit without `targetHistory` uses its current schedule for every date, which is how it behaved before.
- **Offline:** all writes are local through the repositories.
- **Sync:** the new fields sync like any other field (per-field last-write-wins).

## Changed files
- **Domain:**
  - `src/core/domain/types.ts`
  - `src/core/domain/progress.ts`: `targetOn`, `isScheduled` per date, `adherence`, "Paused" label
  - `src/core/domain/fitness.ts` is unchanged this round; it has `todaysDayIndex`, `weekPlan` and the weekly split from earlier.
- **Repositories:**
  - `src/core/repos/life.ts`: `syncGymHabit` (linked habit, history, pause), `setRoutinePaused`, `checkInGym` (link and plan, once a day), validation "Add at least one workout day"
  - `src/core/repos/plans.ts`: `setHabitLog` keeps `skippedAt`, plan and workout link; new habit fields
- **Screens:**
  - `src/features/life/RoutineWeekEditor.tsx` (new), `GymToday.tsx` (new), `GymConsistency.tsx` (new)
  - `src/features/life/Gym.tsx`: week editor in the routine sheet, Pause and Resume, paused state, skip records the plan, consistency panel
  - `src/features/life/Workouts.tsx`: check-in link, target weight
  - `src/features/habits/habit-ui.tsx`: skip sheet with quick reasons, neutral wording, editing
  - `src/features/habits/HabitsToday.tsx`, `src/pages/HabitsPage.tsx`: today's workout line, editable skip history

## Screenshots
In `docs/reports/screenshots/`, each at `-desktop` and `-phone`:
- `gym-week-editor`: the 7-day builder with muscles, target kg, rest days, Copy and Move
- `gym-today`, `gym-consistency`: today's workout, the week strip with training days ringed, "Skipped today: …"
- `habits-gym-line`: the Gym habit in Habits with today's plan, Start and Skip, and the reminder card with Snooze
- `skip-reason`: the skip sheet with quick reasons

## Tests

| Requirement | Test |
|---|---|
| Weekly routine creation, multiple muscle groups, rest days, copy | e2e `m6-gym` › gym week builder |
| Changing days, editing routines, history after edits | unit `life.test.ts` › weekly routine drives one Gym habit: Wed 18 stays a training day after the plan changes from 19 Nov |
| Workout logging → habit done, linked, no duplicate | unit: a second workout the same day doesn't add a log; e2e: Start → log a set → Habits shows done |
| Mandatory skip reasons, skip history, edit | e2e `m6-gym` › weekly split (empty reason blocked), `m6-daily` › habit skip. Unit: editing keeps `skippedAt` |
| Missed workouts, consistency maths | unit `life.test.ts` › adherence (planned, done, skipped, missed, rest, extra, %) |
| Pause | unit and e2e: paused → nothing due, "Routine paused" |
| Reminder integration | e2e `m6-reminders`; the Gym habit reminder shows with Snooze (screenshot) |
| Phone and desktop layouts | every e2e test runs on both, plus the screenshots |
| Offline | e2e `m6-reminders` › offline |

**Results:** 171 unit tests and 142 end-to-end tests pass.

## Remaining limitations
- Only **one** linked Gym habit. Several weekday routines can exist, but only the active one drives it.
- **Muscle groups** are a fixed list (no custom names).
- **Analytics** doesn't show workouts or skip reasons yet; they're on the Gym page and in the habit's History.
- **"Missed"** is worked out from planned days with nothing logged. The app doesn't ask you about them afterwards.
- **Closed-app reminders:** see the Vault and reminders report.
