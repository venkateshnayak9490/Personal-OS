# Vault and reminder implementation report

19 Nov 2026. The starting point is described in `FEATURE_ENHANCEMENT_AUDIT.md`.

## A. Vault passphrase: minimum 4 characters

**Result: already correct (fixed in `9bde2ce`), verified again here. No code changes this round.**

| Flow | Rule | Where |
|---|---|---|
| Set up | at least 4 characters, plus "Type it again" must match | `createVault` (`src/core/crypto/vault.ts`), `VaultPage` form (`MIN = MIN_PASSPHRASE`) |
| Unlock | no length rule, so any existing passphrase still opens | `unlockVault` |
| Change passphrase | at least 4 | `changePassphrase`, `VaultPage` change form |
| Recover with recovery key | new passphrase at least 4 | `resetPassphrase`, `VaultPage` recover form |
| Message | "At least 4 characters." under the field; repo errors say "Use at least 4 characters." | |

- **Unchanged:** Argon2id (64 MiB, t=3), the AES-256-GCM data key, existing Vault items (no re-encryption), and the separate App Lock PIN rule (`AppLock.tsx`, at least 4 digits).
- **WebAuthn:** the app has no WebAuthn passkey.
- **Tests:** unit test `vault.test.ts` rejects `abc`. A new e2e test (`tests/e2e/m5.spec.ts`) shows the hint for `abc`, then creates a Vault with `lamp` and gets a recovery key.

## B. and C. Repeating habit and task reminders

### What a reminder now does

| | Habits (with a reminder time) | Tasks with a deadline |
|---|---|---|
| First reminder | at `remindAt` on days the habit is due | at the due time (the task's own timezone, AoE included). Date-only tasks start at 09:00 on the due date |
| Advance reminder | none | optional: 10 min, 1 h, 3 h or 1 day before (task editor → "Remind me before"), once each |
| Repeats | every *N* minutes (default **60**) | every *N* minutes once overdue (same setting, default **60**) |
| Stops when | done, explicitly skipped, rest day, or the week's target is met (per-week habits) | completed, cancelled, skipped or deleted |
| Never stops because | you dismissed a reminder | you dismissed a reminder |

- **Settings → App:**
  - "Remind again until done": just once, or every 15 min, 30 min, 1 h, 2 h or 3 h.
  - "Quiet hours": a from–to time. By default it follows the Health plan's bedtime and wake time, otherwise 22:30–07:00.
- **Per habit** (habit sheet → "Until done, remind again"): As in Settings, just once, or every 15, 30, 60 or 120 min.
- **Reminder card actions:**
  - Habits get **Mark done**.
  - Tasks get **Open** and **Mark done**.
  - Health items get **Ate now**, **Had a glass** or **Going to bed**.
  - Everything gets **Snooze** (10 min, 30 min, 1 hour) and **Dismiss** (×).
- **Snooze:** the card hides, and no new rounds for the same thing show until the snooze ends. Then the card comes back and notifies once.
- **Card display:**
  - Only the latest round per item is kept.
  - One card shows at a time, with "+N more".
- **Skipped vs completed:** a skipped habit is stored as `status: 'skipped'` with its reason and time. It's shown dashed, never as done, and it stops reminders.
- **Recurring tasks:** each occurrence is its own task, and reminders are keyed by task id. Completing one creates the next, which has its own deadline and its own reminders, with no duplicates.

### Duplicate prevention across tabs

**`fireReminderOnce`** (`src/core/repos/events.ts`) takes care of new rounds:
- It runs under a Web Lock (`navigator.locks`, named `pos-reminders`).
- If Web Locks aren't available, it falls back to a queue within the tab.
- It checks IndexedDB for the same item and round before recording.
- Only the tab that records the round shows a system notification.
- Notifications use a per-item `tag`, so the operating system replaces an older one instead of stacking.

**`resurfaceOnce`** does the same for a snoozed reminder coming back.

### Re-evaluation
- **When reminders are re-checked:**
  - when the app starts or reloads, it shows the latest round that's due
  - every 15 s while the app is open
  - straight away on **window focus** and when the app **becomes visible** again (`src/app/use-now.ts`)
- **No duplicate timers:** there's one reminder manager (`<Reminders/>` in the app shell) and no extra intervals.

### D. Platform limits (stated plainly)
- **While the app is open:** reminders show inside the app. A **system notification** also appears if you allowed notifications and the tab is in the background.
- **While the app is closed:** nothing runs. **Repeating reminders do not happen while the PWA or browser is closed.** When you open it, you see the latest round that's due.
- **The .ics export is kept:** your phone's calendar gives one alarm per habit time, task deadline, meal or bedtime, and appointment.
- **Future work, not done:** reliable reminders while the app is closed need **Web Push**, which means a small server with VAPID keys, e.g. a Supabase Edge Function plus `pg_cron`. It needs your approval and your Supabase project. No backend or paid service was added.

### Changed files
- `src/core/domain/reminders.ts`: `Repeat` in minutes, `repeatOf` (60 min default, carries over the older hours setting), `latestRound` handling "just once", per-habit `remindRepeatMin`, task `remindBeforeMin`.
- `src/core/domain/types.ts`: optional fields `Habit.remindRepeatMin`, `Task.remindBeforeMin`, `Reminder.snoozedUntil` and `Reminder.resurfacedAt`.
- `src/core/repos/events.ts`: `fireReminderOnce`, `snoozeReminder`, `resurfaceOnce` (Web Locks plus fallback).
- `src/features/reminders/Reminders.tsx`: settings, snooze handling, once-only firing, Snooze menu, Mark done for tasks.
- `src/app/use-now.ts`: refresh on focus and visibility.
- `src/pages/SettingsPage.tsx`: interval in minutes, quiet hours. Saves read the latest settings, so two quick changes can't undo each other.
- `src/pages/HabitsPage.tsx`: per-habit repeat. `src/features/tasks/TaskEditor.tsx`: "Remind me before".
- `src/core/repos/plans.ts`, `src/core/repos/tasks.ts`: allow the new fields.

**Database migration:** none needed. The new fields are optional and not indexed. Dexie stores them as they are, and sync merges them per field like any other field.

### Tests

| Requirement | Test |
|---|---|
| Initial reminder | e2e `m6-reminders` › habit reminders (09:01 card) |
| Repeated reminder | e2e: back at 10:01. Unit: `events.test.ts` hourly rounds, per-habit 30 min, latest round only |
| Snoozed reminder | e2e: snooze 30 min, still hidden at +20 min, back at +35 min. Unit: `repos.test.ts` resurfaces once |
| Dismissed reminder | e2e: dismiss → habit still "not checked", comes back next round |
| Completed habit | e2e: Mark done → stops now and at the next round |
| Skipped habit | unit: `quiet` set (any log for today) → no rounds. e2e `m6-daily` › skipping asks for a reason |
| Completed / cancelled task | unit: completed and cancelled → none |
| Overdue task | unit: overdue rounds hourly, continuing the next day |
| Advance reminder | unit: one hour before |
| AoE deadline | unit: 23:59 AoE → 11:59 UTC next day |
| Recurring task | unit (existing `repos.test.ts`): completing makes the next occurrence; reminders are keyed per task |
| Quiet hours | e2e: 08:00–10:00 → none at 09:08. Unit: overnight quiet |
| Duplicate prevention / multiple tabs | e2e: two tabs, one stored round. Unit: three simultaneous checks → one record |
| Offline | e2e: offline, the reminder still fires |
| App restart / missed reminders | e2e: closed through 10:00, reload → the 10:00 round shows |

**Results:**
- `npm test`: 171 unit tests pass.
- `npx playwright test`: 142 end-to-end tests pass on desktop and phone (Pixel 7), with 6 skipped because they're desktop-only.
