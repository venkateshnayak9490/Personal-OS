# Health timestamp implementation report

19 Nov 2026.

## What changed for you

- **"I'm up"**, the **meal buttons** ("Ate breakfast", "Ate lunch", "Ate dinner"), **"Going to bed"** and **water (+ Glass)** record the **device clock at the moment of the tap**. They never use the planned time, the time the page was opened, or a rounded time.
- **Shown time:** the recorded local time is shown and judged on time or late against your plan.
- **Correcting a time:** you change the time field. The **corrected** time is shown and saved separately, and "tapped 07:42" stays visible so the original is never lost. Clearing the field undoes the log.
- **Bedtime date:** "Going to bed" after midnight (e.g. 00:30) now goes on **that** morning's check-in. Before, it went a day too late.

## Data model

`Checkin` gains these optional fields (`src/core/domain/types.ts`):

```ts
stamps?: Partial<Record<'wake' | 'bed' | 'breakfast' | 'lunch' | 'dinner', HealthStamp>>;
waterAt?: number[];          // epoch ms of each glass

interface HealthStamp {
  at: number;        // canonical moment, epoch ms (UTC)
  tz: string;        // device IANA timezone at capture (Intl.DateTimeFormat().resolvedOptions().timeZone)
  date: LocalDate;   // local calendar date there
  time: string;      // local "HH:mm" there: the original tap
  corrected?: string;  // corrected "HH:mm", if you fixed it
  correctedAt?: number;
}
```

- **Why the existing fields stay:**
  - `wakeTime`, `bedTime` and `meals.*` remain the **shown** value (`corrected ?? time`).
  - Older records (no stamp) display exactly as before.
  - On-time stats, sleep hours, the week grid and sync keep working unchanged.
  - The stamp is the record of what happened; the HH:mm field is what's displayed.
- **Day assignment** (`dayFor` in `src/core/domain/health.ts`):
  - Wake and meals go on the local date of the tap.
  - Bedtime goes on the morning after: before 12:00 that's the tap's own date (after midnight), otherwise the next date.
- **Timezones and DST:**
  - The local date and time come from `Intl.DateTimeFormat` in the tap's own zone, so a phone in another country, or a DST change, records that place's wall-clock time.
  - The display uses the stored local time, so history doesn't shift if you travel later.
  - The epoch `at` keeps the exact instant.

## Duplicate protection (idempotent)

- **One row per day:** each day has one check-in with id `c:<date>`, so a duplicate _record_ is impossible.
- **`logHealthEvent`** (`src/core/repos/life.ts`) writes inside the serialized check-in chain and **does nothing if that event is already logged** for that day. It returns `{ logged: false }`. Double taps, repeated clicks and re-renders therefore never overwrite. The button turns into the time display after the first tap.
- **Other tabs:** IndexedDB transactions on the single per-day row mean the second write finds the first, or writes the same values.
- **Offline:** everything is local, and retrying a write is the same idempotent call.
- **Corrections** go through `correctHealthTime`, which is the explicit way to change a logged time.

## Migration

None (optional fields only, nothing indexed). Old check-ins keep their HH:mm values; they just have no stamp.

## Changed files

- `src/core/domain/types.ts`: `HealthEvent`, `HealthStamp`, `Checkin.stamps`, `Checkin.waterAt`
- `src/core/domain/health.ts`: `deviceTz`, `stampAt`, `dayFor`, `shownTime`
- `src/core/repos/life.ts`: `logHealthEvent` (idempotent), `correctHealthTime`, `addWater` with times. Sleep hours still come from bed and wake times.
- `src/features/life/Health.tsx`: buttons and corrections use the above; "tapped HH:mm" after a correction
- `src/features/reminders/Reminders.tsx`: "Ate now" and "Going to bed" on a reminder record the tap time too

## Screenshots

`docs/reports/screenshots/health-wake-corrected-desktop.png` and `health-wake-corrected-phone.png`: "Woke up" with the corrected time and "tapped …" beside it.

## Tests

| Requirement                                                             | Test                                                                                                                    |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Recording wake-up time, device local time, timezone metadata, local day | unit `life.test.ts` › one-tap health logs (07:42 IST: `at`, `tz`, `date`, `time`). Unit `health.test.ts` › stamps a tap |
| Duplicate prevention                                                    | unit: second tap → `logged: false`, value unchanged                                                                     |
| Editing a recorded time                                                 | unit: corrected 07:15 keeps the original 07:42. e2e `m6-health`: "I'm up" → correct → "tapped 08:40" shown              |
| Bedtime after midnight                                                  | unit: 00:30 tap → that morning's check-in, sleep 6.5 h                                                                  |
| Timezone change                                                         | unit: the same instant in Los Angeles → its own date and time                                                           |
| DST                                                                     | unit: America/New_York after the 1 Nov 2026 change → correct local time                                                 |
| Offline logging                                                         | everything is local. e2e offline coverage for reminders; health writes use the same local path                          |
| Historical display                                                      | e2e `m4-life` check-in week grid; stamps don't change the HH:mm values shown                                            |

**Results:** 171 unit tests and 142 end-to-end tests pass.

## Limitations

- **Water corrections:** water taps are timed but can't be individually corrected; "− glass" removes the last one.
- **Wake time:** "Woke up" can only be logged for today, from the Health page or by correcting the field. There's no separate "log yesterday" flow.
