# Functional improvements report: Gym, Habits, Health, Occasions

19 Nov 2026, starting from `e70d8d4`. These are changes to the existing sections; nothing was rebuilt and no data is migrated.

## Schema changes

All are optional, unindexed fields. Dexie stores them as they are and sync merges them per field, so there's **no Dexie version bump, no migration, and no new tables**. Older records keep working unchanged.

| Where                                    | Field                                          | Meaning                                                                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WorkoutSession`                         | `startedAt?`, `endedAt?` (epoch ms)            | Set by Start workout and End workout. A session counts once it has ended. Sessions from before this change (no `startedAt`) still count, so history isn't rewritten.           |
| `HabitLog.status`                        | adds `'missed'`                                | Only when you add a reason to a missed day. An empty past scheduled day still counts as missed, the same as before.                                                            |
| `HabitLog.note`                          | now also used for `'missed'`                   | The reason, which is optional for Gym.                                                                                                                                         |
| `profile.settings.healthPlan.routines[]` | `HealthRoutine`                                | Repeating plan items: `mode` interval or times, `every`, `unit` (min, h or d), `start`, `end`, `times`, `from`, `until`, `paused`, `remind`                                    |
| `Checkin.routineDone?`                   | `{ [routineId]: "HH:mm"[] }`                   | Which occurrences you marked done that day                                                                                                                                     |
| Occasion records `custom`                | `repeats?: 'once'`, `remindDays?: 1 \| 3 \| 7` | Missing `repeats` means yearly, which is how older occasions behave                                                                                                            |
| Occasions template                       | kinds                                          | Birthday, Anniversary, Special occasion, Personal event, Important deadline, Custom. Existing lists keep their kinds; a new kind is added to a list the first time you use it. |

## 1. Gym: edit and delete

- **Sets:** each logged set has ✎ to correct reps and kg (or minutes and km for cardio) and × to remove it, with an Undo toast. `updateSet` validates at least 1 rep, no negative weight, and minutes above 0.
- **Sessions:**
  - The name, date and notes were already editable.
  - The start and end times can now be corrected once a session has ended, and the duration updates. An end time before the start is refused.
  - "Not finished" re-opens a session.
  - **Delete workout…** asks first, and its Undo restores the session together with that day's habit check-in.
- **Routines:**
  - Edit, pause, resume and make active stay as they were.
  - **Delete…** now asks first and offers Undo.
  - Deleting the active routine leaves nothing due, while past days keep their schedule (audit item R4).
- **Exercises in routines:** add, edit and remove already existed in both editors (sequence and week builder), with name, sets, rep range, target kg and cardio minutes. Unchanged.

## 2. Gym: weekly schedule

- **Weekly schedule** on the Gym page, for a weekday routine:
  - Monday to Sunday (Sunday to Saturday if your week starts on Sunday).
  - Each day shows its workout and muscles (or exercise count), or **Rest**.
  - **Today** is highlighted.
  - Each day has a picker: assign any of the routine's workouts, change it, or set Rest. The Gym habit follows immediately.
  - **Edit workouts** opens the full week builder.
- **Routines in order:** a routine without fixed weekdays shows **Assign to weekdays**, which opens the editor with weekdays switched on.
- **Programs:** "See the days" lists weekday programs Monday to Sunday, with rest days.
- **Removed:** dead code (a weekday picker that could never show) from the sequence editor. Nothing is hard-coded: everything comes from the routine.

## 3. Gym ↔ Habits

- **Start** records the start time. The workout page shows "Started 07:30", and the Gym page and Habits show "In progress · Continue".
- **End workout** records the end time and the duration, and completes the **linked** Gym habit for that day (`resyncGymDay`). The day's check-in is linked to that session through `workoutId`.
- **Explicit link only:** the old title match (`/gym|workout|exercise/`) and the section match are gone, so "Morning workout stretches" is never ticked (audit item R5). The linked habit is the one with `source: 'gym'`. The first time a routine becomes active, an existing habit named "Gym" is adopted, as before.
- **Gym is the source of truth:**
  - The active routine drives the habit's schedule: weekday routines give those days, sequence routines give N a week, and paused or deleted give nothing due.
  - Schedule changes keep their history.
  - One habit, never a duplicate.
- **Edits follow through:** deleting or moving a session, or marking it not finished, relinks the day to another ended session if there is one. Otherwise the app's own check-in is removed. Check-ins you made by hand, skips and explained misses are never touched.
- **Statuses:**
  - **Completed:** an ended session, or a manual check-in.
  - **Skipped:** only when you choose Skip.
  - **Missed:** a scheduled day passed with neither.
  - **Rest:** not scheduled.
- **Reasons:** optional for Gym. Quick picks are Busy with work/studies, Not feeling well, Personal commitments, Recovery/rest, and Other (type your own). "Skip without a reason" is allowed.
- **Skipped and missed (last 4 weeks)** on the Gym page has **Add reason** and **Edit** on each day. Habit history lists reasons for both.
- **Other habits:** they still need a reason to skip, as you asked earlier.

## 4. Health: repeating plan items

- **Repeating plan items** on Health:
  - **Repeat every N minutes, hours or days** from a start time, with an optional end time.
  - **At exact times**, for example 11:00 and 16:00.
  - Each has an active period (Starting date, optional Ending date) and an optional reminder.
  - The existing exact-time plan (wake, meals, water, bed) is unchanged.
- **Checks:**
  - name required
  - at least 15 minutes apart
  - end after start
  - at least one time
  - end date not before the start date
  - a live preview, e.g. "7 a day: 08:00, 10:00, …"
- **Today's occurrences:**
  - **done**
  - **due now**: the latest one that has come
  - **missed**: passed, with a later one already come, or the day over
  - **later**
- **Marking done:** tap an occurrence to mark it done or undo it. A summary line reads "1 of 7 done today · 2 missed · 4 later".
- **Reminders:**
  - A reminder fires for the latest occurrence that has come, once (the same once-only, cross-tab logic as other reminders).
  - The card's **Mark done** checks off that occurrence.
  - Marking it done anywhere clears the card.
  - Older rounds don't pile up after closing and reopening; only the latest due one shows.
- **Edit, Pause and Resume, Delete…:** delete asks first and offers Undo, and occurrences you marked done stay in your check-ins.

## 5. Dates & Occasions: calendar

- **Month calendar** at the top of the section:
  - previous and next month, a month and year picker, Today
  - dates with occasions highlighted and dotted
  - today outlined
- **Picking a date** lists its occasions. You can add **several per date** and edit or delete each one (delete asks first and offers Undo).
- **Each occasion** has a name, kind, date, **every year or once**, **Remind me** (on the day, or 1, 3 or 7 days before as well as on the day), for or with whom, and a description.
- **Coming up:** the next occasions ("in 6 days").
- **The list stays:** the existing Occasions list (table and board) remains below with the same records. The list is created with the first occasion.
- **Reminders** come at 09:00, N days before ("In 3 days: …") and on the day. Once-only occasions don't repeat on the calendar, in Coming up, or in reminders.

## Files

- **Domain:**
  - `src/core/domain/types.ts`
  - `fitness.ts` (`isFinished`, `weekdayOrder`)
  - `progress.ts` (missed status)
  - `health.ts` (`HealthRoutine`, `routineSlots`, `slotStates`, `routineProblem`, `routineLabel`, reminders)
  - `reminders.ts` (occasion reminders before)
  - `collections.ts` (once-only dates)
- **Repos:**
  - `src/core/repos/life.ts`: `createWorkout` start time, `updateWorkout`, `endWorkout`, `deleteWorkout`, `restoreWorkout`, `updateSet`, `resyncGymDay` (replaces `checkInGym`), `syncGymHabit` for any routine, `deleteRoutine`/`restoreRoutine`, health plan item functions, `markRoutineSlot`
  - `plans.ts`: reasons for missed days
- **UI:**
  - `src/features/life/Gym.tsx`
  - `Workouts.tsx`
  - `GymConsistency.tsx`
  - `GymToday.tsx`
  - `HealthRoutines.tsx` (new)
  - `Health.tsx`
  - `src/features/habits/habit-ui.tsx`
  - `src/pages/HabitsPage.tsx`
  - `src/features/collections/OccasionsCalendar.tsx` (new)
  - `src/pages/NodePage.tsx`
  - `src/features/reminders/Reminders.tsx`
  - `src/content/collection-templates.ts`
- **Tests:**
  - `src/core/repos/life.test.ts`
  - `src/core/domain/health.test.ts`
  - `src/core/repos/collections.test.ts`
  - `tests/e2e/m6-gym.spec.ts` (updated for Start/End and optional reasons)
  - `tests/e2e/m7-functional.spec.ts` (new)

## Tests

**New unit tests:**

- Ending a workout completes only the linked habit, never "Gym stretches at home" or "Morning workout", and only once.
- End before start is refused.
- Deleting, moving, undoing and "not finished" all keep the habit right; manual check-ins and skips stay.
- Set corrections and their validation.
- Optional reasons; an explained miss counts as missed.
- Any routine drives the habit; deleting the active one leaves nothing due, with history kept.
- Plan item occurrences for minutes, hours, days and exact times, paused and outside the active period; validation; done, due, missed and later; reminders only for the latest occurrence, gone once done or paused.
- Plan item save, idempotent mark done, delete and undo; a new plan doesn't turn on meal reminders.
- Occasion kinds; once-only doesn't repeat; reminders 3 days before and on the day only.

**New end-to-end tests** (desktop and Pixel 7):

- Gym:
  - "See the days" by weekday
  - Mon–Sun schedule, today marked
  - assign Sunday, rest Thursday
  - Start and End with duration, then correct the start time
  - edit a set, remove it and Undo
  - habit done on End, removed on a confirmed delete
  - missed Tuesday, add a reason
- A "workout" habit is not completed by a workout.
- Health: plan item create and validate; done, due, missed and later; reminder Mark done; switch to exact times; pause; delete and Undo.
- Occasions: calendar, two on one date, yearly vs once across years, edit, delete and Undo, reminder 3 days before.

**Results:**

- `npm run lint`: clean. `tsc`: clean.
- `npx vitest run`: **180 passed**.
- `npx playwright test`: **150 passed**, 6 skipped (desktop-only), on desktop and phone.

**Screenshots:** `docs/reports/screenshots/functional-*-{desktop,phone}.png` (weekly schedule, ended workout, plan item sheet, plan items, occasions calendar).

## Limitations

- **Linking another habit:** only a habit with `source: 'gym'` is completed by workouts. There's no switch yet to link a different habit to Gym by hand.
- **Planned workout on a missed day:** the planned name shown for a missed day comes from the current routine's weekday, not the plan that was in force that day.
- **Closed app:** repeating plan item and occasion reminders still work only while the app is open. When you open it, the latest due one shows. Closed-app reminders need Web Push.
- **Quiet hours:** health plan items don't follow quiet hours; their own start and end times set the window.
- **Overlap on phones:** reminder cards can still sit over the bottom of the page (a known issue from the UX audit).
- **Repeating calendar events:** editing a single occurrence (audit item R7) and schedule history for ordinary habits (R6) weren't part of this task and are unchanged.
