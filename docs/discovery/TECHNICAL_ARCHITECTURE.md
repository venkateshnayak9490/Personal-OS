# Technical Architecture

Audit date: 2026-11-19 · Commit `c056ee6` · Package `personal-os` 0.0.1.

This document replaces `uiux-handover/FRONTEND_ARCHITECTURE.md` and the token sections of `uiux-handover/DESIGN_SYSTEM.md`, which are out of date. They predate Dexie v11 (routines), sync, the Vault and App Lock. No secret values are included; environment variables are listed by name only.

---

## 1. Overview

Personal OS is an offline-first single-page PWA.

- **Data.** All user data lives in IndexedDB (Dexie database `personal-os`) on the device. The UI reads it reactively with `useLiveQuery`.
- **Writes.** Every entity write goes through one module, `core/repos/write.ts`. In a single transaction it records an activity-log entry and an outbox entry.
- **Sync.** Optional sync to Supabase pushes and pulls rows through one generic `sync_rows` table, merging changes field by field.
- **Hosting.** The app is a static Vercel deployment with a strict Content Security Policy.

```
React pages/features ──read──▶ core/hooks.ts (useLiveQuery) ──▶ Dexie (IndexedDB)
        │                                                         ▲
        └──write──▶ core/repos/*.ts ──▶ core/repos/write.ts ──────┘
                                         (record + activityLog + outbox, 1 transaction)
                                                    │
                       features/sync/SyncRunner ──▶ core/sync/engine.ts ⇄ Supabase sync_rows
```

## 2. Folder structure

```
personal_app/
├── index.html                 # loads public/theme-init.js before the app (no theme flash)
├── vite.config.ts             # React, Tailwind, VitePWA (manifest, Workbox), Vitest config
├── vercel.json                # SPA rewrite, CSP and security headers, cache headers
├── playwright.config.ts       # e2e against the production build (desktop + Pixel 7)
├── pwa-assets.config.ts       # icon generation (npm run icons)
├── supabase/migrations/       # 20261118000000_sync.sql (sync_rows table, RLS, seq trigger)
├── public/                    # icons, favicon, theme-init.js
├── tests/e2e/                 # 15 Playwright specs (m1…m6-*, phone, shell) + helpers.ts
├── docs/                      # setup/SUPABASE.md, testing/M0–M5, reports/, discovery/
└── src/
    ├── main.tsx               # entry: fonts, CSS, error logging, install prompt, DB open, trash purge, router
    ├── index.css              # Tailwind 4 import, design tokens, motion, editor and calendar styles
    ├── app/                   # shell: routes, AppShell, Sidebar, BottomNav, CommandPalette, nav,
    │                          #   theme, toast, ui-store, UpdatePrompt, pwa-install, diagnostics, hooks
    ├── components/            # shared primitives: ui.tsx, Sheet.tsx, Menu.tsx, DatePicker.tsx, PageHeader.tsx
    ├── content/               # static content: collection-templates.ts, messages.ts
    ├── core/
    │   ├── db/                # schema.ts (Dexie v1–v11), index.ts (db singleton)
    │   ├── domain/            # pure logic + types: tasks, recurrence, capture (NL parse), collections,
    │   │                      #   papers, fitness, health, reminders, ics, outline, progress, analytics…
    │   ├── repos/             # all writes, one file per area; write.ts is the single write path
    │   ├── sync/              # backend.ts (interface), supabase.ts, engine.ts, merge.ts
    │   ├── crypto/            # vault.ts (Argon2id + AES-GCM), session.ts (in-memory key)
    │   ├── backup.ts          # JSON backup/restore, tasks CSV, erase device, download helper
    │   ├── hooks.ts           # useLiveQuery read hooks
    │   ├── device.ts, storage.ts
    ├── features/              # feature UI: analytics, attachments, calendar, collections, dashboard, focus,
    │                          #   habits, life (Gym/Health/Thesis), meetings, messages, pages (editor),
    │                          #   plans, projects (outline), reminders, setup, share, structure, sync,
    │                          #   tags, tasks, vault
    ├── pages/                 # one component per route (27 files)
    ├── lib/                   # cn.ts, icons.ts, NodeIcon.tsx, palette.ts
    └── test/                  # setup.ts, db-reset.ts, pwa-register-stub.ts
```

Size: about 28,200 lines in `src/`. The largest files are `SettingsPage.tsx` (804), `Gym.tsx` (702), `types.ts` (651), `Health.tsx` (572) and `HabitsPage.tsx` (565).

## 3. Framework and dependencies (`package.json`)

Node `>=22`. ESM (`"type": "module"`).

### Runtime

| Package                                                    | Version          | Role                                      |
| ---------------------------------------------------------- | ---------------- | ----------------------------------------- |
| react / react-dom                                          | ^19.3.1          | UI                                        |
| react-router                                               | ^8.5.1           | Routing (`createBrowserRouter`)           |
| dexie / dexie-react-hooks                                  | ^4.4.7 / ^4.4.0  | IndexedDB, `useLiveQuery`                 |
| zustand                                                    | ^5.1.0           | UI and session stores                     |
| radix-ui                                                   | ^1.8.1           | Dialog, menu, popover primitives          |
| @tiptap/react, starter-kit, pm, extensions, extension-list | ^3.34.0          | Rich-text pages, notes, journal, meetings |
| @fullcalendar/core, react, daygrid, timegrid, interaction  | ^6.1.22          | Calendar page (lazy-loaded)               |
| @supabase/supabase-js                                      | 2.118.0 (pinned) | Optional sync and auth                    |
| hash-wasm                                                  | 4.12.0 (pinned)  | Argon2id for the Vault and PIN            |
| chrono-node                                                | ^2.10.3          | Natural-language dates in quick capture   |
| date-fns / @date-fns/tz                                    | ^4.4.0 / ^1.5.0  | Dates and timezones                       |
| zod                                                        | ^4.6.7           | Backup validation                         |
| uuidv7                                                     | ^1.2.1           | Time-ordered ids                          |
| fractional-indexing                                        | ^3.4.0           | `order` keys                              |
| lucide-react                                               | ^1.74.0          | Icons                                     |
| clsx, tailwind-merge                                       | ^2.1.1, ^3.7.0   | `cn()`                                    |
| @fontsource-variable/inter, bricolage-grotesque            | ^5.3.0           | Self-hosted fonts                         |

### Development

| Package                                                                       | Version                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------ |
| vite                                                                          | ^8.3.8                                           |
| @vitejs/plugin-react                                                          | ^6.3.0                                           |
| typescript                                                                    | ~6.0.3                                           |
| tailwindcss / @tailwindcss/vite                                               | ^4.3.5                                           |
| vite-plugin-pwa                                                               | ^2.0.0                                           |
| workbox-build / workbox-window                                                | ^7.4.1                                           |
| @vite-pwa/assets-generator                                                    | ^2.0.0                                           |
| vitest                                                                        | ^5.1.0                                           |
| jsdom                                                                         | ^31.0.1                                          |
| fake-indexeddb                                                                | ^6.2.8                                           |
| @testing-library/react / dom / user-event / jest-dom                          | ^16.3.3 / ^10.4.2 / ^14.6.12 / ^7.0.1            |
| @playwright/test                                                              | ^1.65.1                                          |
| eslint / @eslint/js / typescript-eslint / eslint-plugin-react-hooks / globals | ^10.15.0 / ^10.0.1 / ^8.73.0 / ^7.1.1 / ^17.14.0 |
| prettier / prettier-plugin-tailwindcss                                        | ^3.10.1 / ^0.8.1                                 |
| @types/node, @types/react, @types/react-dom                                   | ^24.19.2, ^19.3.0, ^19.3.0                       |

### Scripts

| Script                    | Command                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `dev`                     | `vite`                                                                             |
| `build`                   | `tsc -b && vite build`                                                             |
| `preview`                 | `vite preview` (serves with the production headers from `vercel.json`, minus HSTS) |
| `typecheck`               | `tsc -b --noEmit`                                                                  |
| `lint`                    | `eslint .`                                                                         |
| `format` / `format:check` | Prettier                                                                           |
| `test`                    | `vitest run`                                                                       |
| `test:watch`              | `vitest`                                                                           |
| `e2e`                     | `playwright test`                                                                  |
| `icons`                   | `pwa-assets-generator`                                                             |
| `check`                   | typecheck + lint + test                                                            |

The path alias `@` points to `src/`. The build-time constant `__APP_VERSION__` comes from the `package.json` version.

## 4. Routing (`src/app/routes.tsx`, `src/app/nav.ts`)

- `createBrowserRouter(routes)` runs in `main.tsx`.
- `/welcome` (`OnboardingPage`) sits outside the shell.
- Every other route is a child of `/` (`AppShell`), with a nested `errorElement: <RouteError/>`. A failing screen shows its error inside the frame, and navigation keeps working.
- Navigation routes are generated from `allNavItems()` in `nav.ts`. A key found in `BUILT` renders its page; any other key renders `PlaceholderPage` (no keys currently do).

| Path                                                                                                                                                                                                                         | Component                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `/` (index), `/home`, `/dashboard`, `/tasks`, `/inbox`, `/projects`, `/goals`, `/habits`, `/calendar` (lazy, Suspense), `/people`, `/focus`, `/analytics`, `/reviews`, `/notes`, `/journal`, `/vault`, `/settings`, `/trash` | Nav items: Home, Dashboard, Tasks, Inbox, …    |
| `/s/:nodeId`                                                                                                                                                                                                                 | `NodePage` (section page)                      |
| `/projects/:projectId`                                                                                                                                                                                                       | `ProjectPage`                                  |
| `/settings/sections`                                                                                                                                                                                                         | `StructurePage`                                |
| `/settings/tags`                                                                                                                                                                                                             | `TagsPage`                                     |
| `/share`                                                                                                                                                                                                                     | `SharePage` (PWA share target)                 |
| `/lists/:collectionId`                                                                                                                                                                                                       | `CollectionPage` (`?item=<id>` opens a record) |
| `/meetings/:meetingId`                                                                                                                                                                                                       | `MeetingPage`                                  |
| `/notes/:noteId`                                                                                                                                                                                                             | `NotesPage`                                    |
| `/workouts/:workoutId`                                                                                                                                                                                                       | `WorkoutPage`                                  |
| `/sections`, `/more`                                                                                                                                                                                                         | `SectionsPage`, `MorePage` (phone tabs)        |
| `*`                                                                                                                                                                                                                          | `NotFoundPage`                                 |

On Vercel, any path without a dot and outside `/assets/` is rewritten to `/index.html`. In the service worker, `navigateFallback` serves `/index.html` while offline.

Code splitting covers only `CalendarPage`, the TipTap editor (`PageEditor`, imported lazily by NodePage, Notes, Journal and Meeting) and `RichEditor`.

## 5. State management

| Layer           | Technology                               | Contents                                                                                                              | Persisted                                                                                                                            |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Domain data     | Dexie + `useLiveQuery` (`core/hooks.ts`) | All entities                                                                                                          | IndexedDB                                                                                                                            |
| UI store        | zustand `useUIStore` (`app/ui-store.ts`) | Sidebar collapsed and width, expanded sections, composer open and context, palette open, node dialog, editing task id | localStorage key `pos-ui`; only `sidebarCollapsed`, `sidebarWidth` and `expandedSections` are persisted, through a try/catch wrapper |
| Theme           | zustand `useThemeStore` (`app/theme.ts`) | `dark` / `light` / `system`                                                                                           | localStorage `pos-theme` (default `dark`)                                                                                            |
| Vault session   | zustand (`core/crypto/session.ts`)       | Unlocked data key (non-extractable `CryptoKey`)                                                                       | Memory only                                                                                                                          |
| App Lock        | zustand in `core/repos/pin.ts`           | Locked flag (starts locked)                                                                                           | Memory; the PIN hash is in `meta.pinLock`                                                                                            |
| Toasts          | `app/toast.tsx`                          | Queue with Undo actions                                                                                               | Memory                                                                                                                               |
| Device settings | Dexie `meta` table (key/value)           | Device id, `lastBackupAt`, `pinLock`, messages-off flag, `sync.cursor`, `sync.uploadedAll`, `sync.logTs`              | IndexedDB, never synced or backed up                                                                                                 |
| User settings   | `profile.settings` (synced entity)       | `displayName`, `bottomTabs`, `healthPlan`, `fitnessLevel`, `remindEveryMin`, `remindQuiet`                            | IndexedDB and sync                                                                                                                   |

## 6. Database schema (`src/core/db/schema.ts`)

**Rules.**

- The Dexie schema strings list only indexed fields; every other property is stored without being indexed.
- New schema versions are added as new `version(n)` blocks; old blocks are never edited.
- None of the versions defines an `.upgrade()` migration. Every version only adds tables.

**Base entity** (`types.ts:21`). Every syncable record has these fields:

| Field                         | Purpose                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `id`                          | uuidv7                                                                  |
| `createdAt`, `updatedAt`      | Timestamps                                                              |
| `deletedAt?`, `trashBatchId?` | Soft delete → Trash                                                     |
| `archivedAt?`                 | Archive marker (exists on every record; unused by notes and most areas) |
| `version`                     | Incremented on every write                                              |
| `deviceId`                    | Last writer                                                             |
| `_ft?`                        | Per-field change times, used by sync merge                              |

### 6.1 Version history

| Version | Milestone | Tables added (index string)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1      | M0/M1     | `meta: 'key'`; `profile: 'id'`; `nodes: 'id, parentId, order, moduleKey, updatedAt'`; `tags: 'id, name, updatedAt'`; `tasks: 'id, nodeId, projectId, parentTaskId, status, dueDate, startDate, recurrenceId, updatedAt, *tags'`; `recurrences: 'id, updatedAt'`; `taskOccurrences: 'id, recurrenceId, date, [recurrenceId+date], updatedAt'`; `projects: 'id, nodeId, goalId, status, updatedAt'`; `milestones: 'id, projectId, updatedAt'`; `goals: 'id, nodeId, status, updatedAt'`; `habits: 'id, nodeId, goalId, updatedAt'`; `habitLogs: 'id, habitId, date, [habitId+date], updatedAt'`; `inbox: 'id, createdAt, updatedAt'`; `events: 'id, start, nodeId, updatedAt'`; `reminders: 'id, fireAt, updatedAt'`; `links: 'id, [fromTable+fromId], [toTable+toId], updatedAt'`; `messages: 'id, updatedAt'`; `widgets: 'id, dashboardId, order, updatedAt'`; `activityLog: 'id, ts, [entityTable+entityId], nodeId, action'`; `outbox: '++seq, table, entityId'` |
| v2      | M2        | `pages: 'id, nodeId, updatedAt'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| v3      | M3        | `collections: 'id, nodeId, updatedAt'`; `records: 'id, collectionId, nodeId, status, updatedAt'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| v4      | M3        | `meetings: 'id, nodeId, eventId, start, updatedAt'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| v5      | M3        | `attachments: 'id, targetId, updatedAt'`; `files: 'id'`; `focusSessions: 'id, start, taskId, nodeId, updatedAt'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| v6      | M4        | `reviews: 'id, period, periodStart, updatedAt'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| v7      | M4        | `notes: 'id, nodeId, updatedAt'`; `journalEntries: 'id, date, updatedAt'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| v8      | M4        | `thesisChapters: 'id, order, updatedAt'`; `writingLogs: 'id, date, chapterId, updatedAt'`; `workoutSessions: 'id, date, updatedAt'`; `workoutSets: 'id, sessionId, exercise, updatedAt'`; `checkins: 'id, date, updatedAt'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| v9      | M5        | `vaultMeta: 'id, updatedAt'`; `vaultItems: 'id, updatedAt'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| v10     | M5        | `syncSeen: 'key'` (device-only sync bookkeeping)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| v11     | M6        | `routines: 'id, updatedAt'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### 6.2 Tables, key fields and relationships

`ENTITY_TABLES` lists the 34 synced tables, ending with `vaultItems`. Four tables are device-only: `meta`, `files`, `outbox` and `syncSeen`. `activityLog` syncs append-only and separately from the entity tables.

| Table                  | Key fields (beyond the base entity)                                                                                                                                                                                                                         | Relationships / notes                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| profile                | `profileTypes[]`, `onboardedAt`, `timezone` (IANA), `weekStartsOn`, `dateFormat`, `settings{}`                                                                                                                                                              | Single row (`PROFILE_ID`)                                                                       |
| nodes                  | `parentId?`, `title`, `icon`, `color`, `order`, `hidden`, `moduleKey?`, `config{}` (`headings`, `templateKey`)                                                                                                                                              | Self-tree; the root of most data through `nodeId`                                               |
| tags                   | `name`, `color`                                                                                                                                                                                                                                             | Referenced by `tasks.tags[]` (multi-entry index `*tags`)                                        |
| tasks                  | `title`, `description`, `nodeId?`, `projectId?`, `milestoneId?`, `parentTaskId?`, `priority 1-4`, `status`, `kind`, `startDate`, `dueDate`, `dueTime`, `timezone`, `recurrenceId`, `remindBeforeMin[]`, `tags[]`, `custom{}` (e.g. `meetingId`, `followUp`) | → node, project, milestone, parent task, recurrence, meeting                                    |
| recurrences            | `rrule`, `startDate`, `until?`, `exceptions[]`, `taskTemplate`                                                                                                                                                                                              | ← tasks                                                                                         |
| taskOccurrences        | `recurrenceId`, `date`, `status`, `completedAt`, `note`                                                                                                                                                                                                     | Appears unused in app code (reserved)                                                           |
| projects               | `title`, `nodeId`, `goalId`, `status`, dates, `progressMode`, `manualProgress`, `order`, `headings[]`                                                                                                                                                       | → node, goal; ← tasks, milestones                                                               |
| milestones             | `projectId`, `title`, `dueDate`, `doneAt`, `weight`, `order`                                                                                                                                                                                                | → project                                                                                       |
| goals                  | `title`, `why`, `nodeId`, `targetDate`, `status`, `measure{}`, `order`                                                                                                                                                                                      | → node; ← projects, habits                                                                      |
| habits                 | `title`, `nodeId`, `goalId`, `target` (daily / perWeek / days), `unit`, `restDaysAllowed`, `remindAt`, `remindRepeatMin`, `source?='gym'`, `targetHistory[]`                                                                                                | → node, goal; ← habitLogs                                                                       |
| habitLogs              | `habitId`, `date`, `status` done/skipped/rest, `note`, `skippedAt`, `planned`, `workoutId`                                                                                                                                                                  | Compound index `[habitId+date]`; → habit, workout                                               |
| inbox                  | `text`, `kind`, `url`, `processedInto`                                                                                                                                                                                                                      | Legacy table. The Inbox screen and share target use tasks with no node or project               |
| events                 | `title`, `description`, `start`, `end` (ms), `allDay`, `rrule`, `nodeId`, `location`, `linked`, `reminderOffsetsMin[]`, `kind?='appointment'`                                                                                                               | ← meetings (`eventId`)                                                                          |
| reminders              | `target`, `fireAt`, `channel`, `sentAt`, `dismissedAt`, `snoozedUntil`, `resurfacedAt`                                                                                                                                                                      | Used by event and repo reminders; most reminders are computed in memory (`domain/reminders.ts`) |
| links                  | `fromTable`, `fromId`, `toTable`, `toId`, `relation`                                                                                                                                                                                                        | Not referenced by app code (reserved)                                                           |
| messages               | `text`, `author`, `contexts[]` (node ids), `builtIn`, `enabled`                                                                                                                                                                                             | Motivational lines                                                                              |
| widgets                | `dashboardId`, `type`, `order`, `visible`, `config`                                                                                                                                                                                                         | Not referenced by app code (reserved)                                                           |
| pages                  | `nodeId` (= id), `doc` (TipTap JSON), `text`                                                                                                                                                                                                                | One per section                                                                                 |
| collections            | `name`, `icon`, `nodeId`, `templateKey`, `statusOptions[]`, `statusName`, `doneStatuses[]`, `fields[]`, `defaultView`, `order`                                                                                                                              | → node; ← records                                                                               |
| records                | `collectionId`, `nodeId`, `title`, `status`, `custom{}`, `tags[]`, `order`                                                                                                                                                                                  | → collection                                                                                    |
| meetings               | `title`, `nodeId`, `start`, `eventId`, `attendees[]`, `agenda`, `doc`, `text`                                                                                                                                                                               | → node, event; ← tasks (`custom.meetingId`)                                                     |
| attachments            | `targetTable`, `targetId`, `nodeId`, `name`, `type`, `size`, `fileId`                                                                                                                                                                                       | → any record; → `files`                                                                         |
| files (device-only)    | `id`, `blob?`, `sealed?`                                                                                                                                                                                                                                    | Bytes are not synced or backed up; orphans are cleaned at start-up                              |
| focusSessions          | `start`, `end`, `minutes`, `plannedMin`, `taskId`, `nodeId`                                                                                                                                                                                                 | → task, node                                                                                    |
| reviews                | `period` (day/week/month/year), `periodStart`, `periodEnd`, `answers{}`, `summary`                                                                                                                                                                          |                                                                                                 |
| notes                  | `title`, `doc`, `text`, `nodeId?`, `pinned`                                                                                                                                                                                                                 |                                                                                                 |
| journalEntries         | id `j:<date>`, `date`, `doc`, `text`, `mood?`, `isPrivate`, `cipher?{iv,ct}`                                                                                                                                                                                |                                                                                                 |
| thesisChapters         | `title`, `order`, `targetWords`, `currentWords`, `status`                                                                                                                                                                                                   | ← writingLogs                                                                                   |
| writingLogs            | `date`, `chapterId`, `words`, `delta`, `minutes?`                                                                                                                                                                                                           | → chapter                                                                                       |
| workoutSessions        | `date`, `title`, `nodeId`, `notes`, `routineId`, `dayIndex`                                                                                                                                                                                                 | → routine                                                                                       |
| workoutSets            | `sessionId`, `exercise`, `reps`, `weight`, `order`, `kind?`, `minutes?`, `distanceKm?`                                                                                                                                                                      | → session                                                                                       |
| routines               | `title`, `level`, `perWeek`, `days[]` (embedded exercises), `byWeekday`, `paused`, `active`, `programKey`                                                                                                                                                   | Drives the gym habit                                                                            |
| checkins               | id `c:<date>`, `sleepH`, `energy`, `waterGlasses`, `weightKg`, `meals{}`, `bedTime`, `wakeTime`, `stamps{}`, `waterAt[]`                                                                                                                                    |                                                                                                 |
| vaultMeta              | id `vault`, `kdf`, `salt`, `wrapped`, `recoverySalt`, `recoveryWrapped`                                                                                                                                                                                     | Single row                                                                                      |
| vaultItems             | `cipher`, `fileIds[]`                                                                                                                                                                                                                                       | → `files` (sealed)                                                                              |
| meta (device-only)     | `key`, `value`                                                                                                                                                                                                                                              |                                                                                                 |
| activityLog            | `ts`, `entityTable`, `entityId`, `action`, `nodeId`, `effectiveDate?`, `before?`, `after?`, `deviceId`                                                                                                                                                      | Immutable history; feeds analytics                                                              |
| outbox (device-only)   | `++seq`, `table`, `entityId`, `op` put/delete, `changedFields[]`, `ts`                                                                                                                                                                                      | Sync queue                                                                                      |
| syncSeen (device-only) | `key` (`tbl:id`), `ft{}`                                                                                                                                                                                                                                    | Server field times from the last merge                                                          |

Fixed ids that make one record per natural key: `j:<date>` (journal), `c:<date>` (check-ins), `vault` (vaultMeta), `people` (the People collection), and page id = node id.

## 7. Write path (`src/core/repos/write.ts`)

`write.ts` is the only module that writes to entity tables. Repos in `core/repos/*.ts` call:

| Function                             | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `insert(table, data)`                | Builds the base fields (`newBase`: uuidv7 id, timestamps, version, deviceId). In one `rw` transaction over [table, activityLog, outbox] it adds the record, logs `created` with `after` = the full record, and adds an outbox entry with all keys as `changedFields`.                                                                                                                                                                                                                                           |
| `patch(table, id, changes, options)` | `diff()` ignores bookkeeping fields (`updatedAt`, `version`, `deviceId`, `_ft`). If nothing changed it returns `null` and writes no log. Otherwise it bumps `version` and `updatedAt`, stamps `_ft[field] = now` for each changed field (`stampFields`), and logs `before`/`after` with only the changed fields. `quiet: true` logs field names only; it is used for large documents, at most one line per 10 minutes for pages, notes and meetings. The action can be `status_changed`, `completed` and so on. |
| `softDeleteBatch(items)`             | Sets `deletedAt` and `trashBatchId` (= the first item's id) on every item, stamps those fields in `_ft`, and logs each item with an outbox entry.                                                                                                                                                                                                                                                                                                                                                               |
| `restoreBatch(batchId, tables)`      | Finds records by `trashBatchId`, removes both fields, stamps `_ft`, logs `restored`.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `purge(items)`                       | Hard delete. Logs `purged` and adds an outbox `op:'delete'` entry, which sync turns into a `_purged` tombstone.                                                                                                                                                                                                                                                                                                                                                                                                 |

**Trash.** `core/repos/trash.ts` knows 24 trashable tables. Trash groups records by batch. `autoPurgeTrash()` runs at start-up (`main.tsx`) and purges batches older than 30 days, then runs `cleanOrphanFiles()`.

**Reads.** `core/hooks.ts` wraps `useLiveQuery` and filters out `deletedAt` records. Sorting is done in the hooks; for example, notes are sorted pinned first, then by `updatedAt`.

**Known bypasses of the write path:**

- Backup import uses `table.put` directly, with no log or outbox entry.
- The messages-off flag and the PIN are written straight to `meta`.
- Sync `applyRow` writes merged rows directly. This is intended.

## 8. Persistence, backup and sync

### 8.1 Device persistence

- `requestPersistentStorage()` (`core/storage.ts`) runs at start-up, and again from Settings.
- `navigator.storage.estimate()` feeds the usage shown in Settings.
- `getDeviceId(db)` creates the device id and stores it in `meta`.

### 8.2 Backup (`src/core/backup.ts`)

| Operation         | Details                                                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export            | One read transaction over all entity tables plus `activityLog`. Output: `{app:'personal-os', formatVersion:1, schemaVersion, exportedAt, appVersion, tables}`, saved as `personal-os-backup-YYYY-MM-DD.json`. Sets `meta.lastBackupAt`. |
| What is excluded  | `meta`, `files` (attachment and Vault bytes), `outbox`, `syncSeen`.                                                                                                                                                                     |
| Import validation | A zod schema with strict table keys. Rejects an unknown app, unknown tables, and a newer format or schema version.                                                                                                                      |
| Merge import      | Adds missing records. For existing records, the one with the newer `updatedAt` wins. Activity-log rows are added only if absent.                                                                                                        |
| Replace import    | The UI first downloads a safety backup, then clears all entity tables, `activityLog` and `outbox`.                                                                                                                                      |
| Other exports     | `tasksCsv` (13 columns). `toICS` (`core/domain/ics.ts`, RFC 5545 escaping and line folding) covers events, habits, health-plan reminders, dated tasks, list deadlines and yearly dates. There is no .ics import.                        |
| `eraseDevice`     | `db.delete()`. It does not sign out of Supabase.                                                                                                                                                                                        |

### 8.3 Sync (`src/core/sync/*`, `src/features/sync/*`, `docs/setup/SUPABASE.md`)

| Part                                         | Design                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend interface                            | `core/sync/backend.ts`, implemented by `supabase.ts`. The client is created only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or the fallback `VITE_SUPABASE_ANON_KEY`) are set. Otherwise sync is off and the app is fully local.                                                                                                                                      |
| Server table                                 | `sync_rows(user_id, tbl, id, data jsonb, updated_at, seq)`, primary key `(user_id, tbl, id)`. A trigger assigns `seq` from a global sequence and sets `user_id = auth.uid()`. RLS policies cover select, insert, update and delete. There is an index on `(user_id, seq)`. The activity log is pushed separately.                                                                        |
| Auth                                         | Email magic link (`signInWithOtp`, redirect to `/settings`). The session is restored with `getSession` and `onAuthStateChange`.                                                                                                                                                                                                                                                          |
| Runner (`features/sync/SyncRunner.tsx`)      | Runs on session start, every 60 s, on the `online` event, and 3 s after the outbox count changes. Runs never overlap, and it skips when offline or signed out. There is no realtime subscription.                                                                                                                                                                                        |
| Pull                                         | The cursor is `meta['sync.cursor']`. Each pull re-reads 200 `seq` values behind the cursor, in pages of 500. `applyRow` handles `_purged` tombstones, skips rows with a pending local delete, merges, and stores the server field times in `syncSeen`. Unknown tables are ignored.                                                                                                       |
| Push                                         | On the first sign-in it uploads every record (`sync.uploadedAll`); after that only outbox entries. Server rows are fetched in chunks of 100. For each record: merge, then compare-and-swap with `updateIfSeq` or `insert`. On a collision it retries up to 5 times. Activity-log rows are pushed in chunks of 500 since `sync.logTs`. The outbox is cleared up to the last pushed `seq`. |
| Merge (`merge.ts`)                           | Per-field last-write-wins on `_ft[field]`, falling back to `createdAt`. A tie in the same millisecond goes to the larger `deviceId`. For long-text fields (`doc`, `text`, `description`, `agenda`), when both sides changed, the losing text is saved as a pinned note "Conflict copy: …" and counted in AccountCard.                                                                    |
| Account UI (`features/sync/AccountCard.tsx`) | Sign in, status ("Synced N ago" or an error), Sync now, Sign out (keeps local data and resets sync state), Delete my cloud data.                                                                                                                                                                                                                                                         |
| Not synced                                   | `meta`, `files`, `outbox`, `syncSeen`.                                                                                                                                                                                                                                                                                                                                                   |

## 9. Shared UI components

| Component                                   | File                                                                                                                                                                                       | Notes                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button` (forwardRef; variants and sizes)   | `components/ui.tsx:36`                                                                                                                                                                     |                                                                                                                                                      |
| `Input`, `Textarea`, `Select`               | `components/ui.tsx:58-73`                                                                                                                                                                  | Token-styled native controls                                                                                                                         |
| `Field` (label, hint, error)                | `components/ui.tsx:80`                                                                                                                                                                     |                                                                                                                                                      |
| `EmptyState`, `Loading`, `ProgressBar`      | `components/ui.tsx:105-173`                                                                                                                                                                |                                                                                                                                                      |
| `Sheet`                                     | `components/Sheet.tsx:27`                                                                                                                                                                  | Radix Dialog. A bottom sheet on phones. From `md` up it is either centred (`sheet-center`, max-w-lg) or a right side panel (`sheet-side`, max-w-xl). |
| `Confirm`                                   | `components/Sheet.tsx:112`                                                                                                                                                                 | Confirm dialog                                                                                                                                       |
| `Menu`                                      | `components/Menu.tsx`                                                                                                                                                                      | Radix dropdown ("…" menus)                                                                                                                           |
| `DatePicker`, `DateButton`, `dateChipLabel` | `components/DatePicker.tsx`                                                                                                                                                                |                                                                                                                                                      |
| `PageHeader`, `Card`, `MilestoneBadge`      | `components/PageHeader.tsx`                                                                                                                                                                |                                                                                                                                                      |
| Toast with Undo                             | `app/toast.tsx`                                                                                                                                                                            |                                                                                                                                                      |
| `CommandPalette` (Ctrl+K)                   | `app/CommandPalette.tsx`                                                                                                                                                                   | Searches tasks, notes, meetings, sections and more; excludes private journal entries                                                                 |
| `NodeIcon`, `PALETTE`, `cn`                 | `lib/`                                                                                                                                                                                     |                                                                                                                                                      |
| Feature-level shared pieces                 | `features/tasks/{TaskRow,TaskList,TaskComposer,TaskEditor}`, `features/attachments/Attachments`, `features/tags/TagPicker`, `features/pages/PageEditor`, `features/collections/FieldInput` |                                                                                                                                                      |

## 10. Design tokens and CSS (`src/index.css`)

Tailwind 4 is used CSS-first: `@import 'tailwindcss'`. There is no `tailwind.config`. The `dark` variant is defined as `@custom-variant dark (&:where(.dark, .dark *))`. Tokens are CSS variables, exposed to Tailwind through `@theme inline` as `bg-bg`, `text-fg`, `border-line`, `bg-surface-2`, `text-muted`, `bg-accent`, `text-danger`, `text-sec-work` and similar.

| Token            | Light (`:root`) | Dark (`.dark`) | Use                                               |
| ---------------- | --------------- | -------------- | ------------------------------------------------- |
| `--bg`           | `#f5f3ef`       | `#131316`      | Page background                                   |
| `--surface`      | `#ffffff`       | `#1a1a1e`      | Cards, sidebar, sheets                            |
| `--surface-2`    | `#eeebe5`       | `#242429`      | Hover, inputs, code                               |
| `--line`         | `#e2ded6`       | `#2d2d33`      | Borders                                           |
| `--fg`           | `#1c1c20`       | `#ece9e3`      | Text                                              |
| `--muted`        | `#6b675e`       | `#9c998f`      | Secondary text                                    |
| `--accent`       | `#1c1c20`       | `#ece9e3`      | Primary action (ink or paper, no brand hue)       |
| `--accent-fg`    | `#ffffff`       | `#131316`      | Text on the accent colour                         |
| `--danger`       | `#c8372d`       | `#ff6b5e`      | Destructive actions, overdue items, now-indicator |
| `--sec-work`     | `#4f5bd5`       | `#93a4ff`      | Section accent                                    |
| `--sec-self`     | `#0f8a5f`       | `#5fd0a0`      | Section accent                                    |
| `--sec-personal` | `#d6345a`       | `#ff8c9e`      | Section accent                                    |
| `--sec-misc`     | `#b7791f`       | `#f2c35e`      | Section accent                                    |

- **Fonts:** `--font-sans` is Inter Variable; `--font-display` is Bricolage Grotesque Variable, used for `h1`, `.font-display` and editor headings. Both are self-hosted with @fontsource, and only Latin subsets are precached.
- **Easing:** `--ease-out-expo` is `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Base layer:** body uses `bg-bg text-fg font-sans antialiased`; `:focus-visible` gets a 2px accent outline with offset 2; `::selection` is fg mixed at 22%.
- **Motion:** keyframes `pos-fade-in/out`, `pos-sheet-up/down`, `pos-settle/unsettle`, `pos-slide-in/out-right`, `pos-check` and `pos-rise`. Utility classes are `.anim-overlay`, `.anim-sheet`, `.anim-pop`, `.anim-check` and `.anim-rise`, keyed on Radix `data-state`. Durations are 120–340 ms, and exits are faster than entrances. `prefers-reduced-motion` reduces all animations and transitions to 0.01 ms.
- **Editor (`.pos-doc .ProseMirror`):** 15px / 1.65 body text; display-font headings at 1.75 / 1.35 / 1.1 rem; task-list, blockquote, hr, code and pre styling; placeholder via `.is-empty::before`.
- **Calendar (`.pos-cal .fc`):** FullCalendar variables are mapped to the tokens. These rules are unlayered because FullCalendar injects its own CSS. On phones, buttons are at least 44px.
- **Phone touch targets:** at `max-width: 767px`, `[role=tablist]` and `[role=radiogroup]` buttons are at least 2.75rem tall.
- **User colours (`lib/palette.ts`):** sections and tags store a colour name. Each name maps to literal Tailwind classes, such as `text-indigo-600 dark:text-indigo-400` and `bg-indigo-500/12`. The palette includes indigo, emerald, rose, amber, sky, violet, teal and others; NodeDialog offers 12 swatches.

## 11. Theme implementation

1. `public/theme-init.js` is loaded by `index.html` before the bundle. It reads `localStorage['pos-theme']`, defaulting to `dark`; resolves `system` with `matchMedia('(prefers-color-scheme: dark)')`; toggles `.dark` on `<html>`; sets `color-scheme`; and sets `<meta name="theme-color">` to `#131316` (dark) or `#f5f3ef` (light). This prevents a flash of the wrong theme.
2. `app/theme.ts` (`useThemeStore`) does the same at runtime through `applyTheme()`. `useSystemThemeListener()` follows OS changes while the theme is `system`.
3. Settings → Appearance has a Dark / Light / System radio. The choice is per device: it is not synced and not in the profile.
4. The manifest's `background_color` and `theme_color` are both `#131316`.

## 12. PWA and offline

| Aspect         | Implementation                                                                                                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin         | `vite-plugin-pwa` with `registerType: 'prompt'` and `injectRegister: false`. Registration happens through `virtual:pwa-register/react` in `app/UpdatePrompt.tsx`.                                                                                                                   |
| Manifest       | `id '/'`, name and short_name "Personal OS", `start_url '/home'`, `scope '/'`, `display standalone`, `orientation any`, `background_color` and `theme_color` `#131316`, categories productivity / lifestyle / health. Icons: 64, 192 and 512 px, plus a maskable 512 px.            |
| Share target   | `share_target: { action: '/share', method: 'GET', params: {title, text, url} }`. `SharePage` creates an Inbox task (`core/domain/share.ts`). Files are not supported.                                                                                                               |
| Service worker | Workbox `generateSW`. `globPatterns` cover js, css, html, svg, png, ico and woff2; non-Latin font subsets are ignored. `navigateFallback: '/index.html'` and `cleanupOutdatedCaches`. Extra included assets: favicon.ico, favicon.svg, apple-touch-icon-180x180.png, theme-init.js. |
| Updates        | Checks hourly. A toast says "A new version is ready", with Reload (`updateServiceWorker(true)`) or Later. The app never reloads on its own.                                                                                                                                         |
| Install        | `beforeinstallprompt` is captured in `main.tsx` before render (`app/pwa-install.ts`). Settings shows an Install button, detects standalone mode, and shows a browser-menu hint on iOS.                                                                                              |
| Offline        | The shell and all code are precached; the data is local. An offline pill appears via `useOnline()`. Paper import and sync need the network.                                                                                                                                         |
| Notifications  | In-app only, through the `Notification` API while the app is open. There is no Web Push and no background sync. `.ics` export is the workaround.                                                                                                                                    |

### 12.1 Hosting headers (`vercel.json`)

- **Content-Security-Policy:**
  - `default-src 'self'`
  - `script-src 'self' 'wasm-unsafe-eval'` (needed by Argon2 in hash-wasm)
  - `style-src 'self' 'unsafe-inline'`
  - `img-src 'self' data: blob:`
  - `font-src 'self' data:`
  - `connect-src 'self' https://*.supabase.co https://api.crossref.org https://api.datacite.org`
  - `worker-src 'self'`
  - `manifest-src 'self'`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
  - `frame-ancestors 'none'`
- **Other security headers:**
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(self), interest-cohort=()`
  - HSTS `max-age=63072000; includeSubDomains`
- **Caching:**
  - `/assets/*` is `public, max-age=31536000, immutable`.
  - `sw.js`, `workbox-*.js`, `manifest.webmanifest`, `index.html` and `theme-init.js` are `no-cache`.
- **Preview parity:** `vite preview` applies the same headers, except HSTS, so e2e tests catch CSP breakage.

## 13. Responsive implementation

| Breakpoint                             | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `< 768px` (phone, below Tailwind `md`) | `BottomNav` is fixed at the bottom (`md:hidden`), honouring `env(safe-area-inset-bottom)`. It has 3 user-configurable slots (`profile.settings.bottomTabs`: built screens, the Sections list, or any section) plus a fixed "+" composer button and a fixed More tab. `main` gets `pb-[calc(5rem+safe-area)]`. Sheets are bottom sheets with a drag handle. Board cards show a "Move…" select instead of drag. StructurePage row actions collapse into a "…" menu. Touch targets are at least 44px (CSS). |
| `768–1023px` (tablet)                  | The `Sidebar` shows as an icon rail (`w-16`), because `useMediaQuery('(min-width: 1024px)')` is false. Sheets become centred or side panels.                                                                                                                                                                                                                                                                                                                                                             |
| `≥ 1024px` (desktop)                   | Full sidebar, collapsible by the user, with a drag-resizable width (`sidebarWidth`, persisted).                                                                                                                                                                                                                                                                                                                                                                                                          |
| Content                                | `max-w-5xl` centred, padding `px-4` → `md:px-8`, top padding includes `safe-area-inset-top`.                                                                                                                                                                                                                                                                                                                                                                                                             |

Hooks: `useMediaQuery` and `useOnline` (`app/use-media-query.ts`). Tailwind `md:` and `max-md:` classes are used across about 50 component files. Horizontal scroll strips (board columns, chips) use `-mx-4 overflow-x-auto px-4`.

## 14. Testing

| Layer              | Setup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit / integration | Vitest 5 with `jsdom`, `fake-indexeddb` and Testing Library. Setup file `src/test/setup.ts`; `src/test/db-reset.ts` resets the database. `virtual:pwa-register/react` is aliased to `src/test/pwa-register-stub.ts`. Tests match `src/**/*.test.{ts,tsx}`, with `css: false`.                                                                                                                                                                                                                                      |
| Unit test files    | 24 files, about 176 test cases. Largest: `repos.test.ts` (26), `life.test.ts` (17), `AppShell.test.tsx` (11), `collections.test.ts` (11), `sync/engine.test.ts` (10). Others cover the schema, backup, vault crypto, capture parsing, events/recurrence, health, ics, papers, progress, share, tasks, attachments, focus, meetings, notes, outline, pin and analytics.                                                                                                                                             |
| E2E                | Playwright with `testDir tests/e2e`. Projects: `desktop` (Desktop Chrome) and `mobile` (Pixel 7). Locally it uses the installed Chrome channel; CI uses Playwright Chromium with 1 retry and the GitHub reporter. `webServer` runs `npm run build && npm run preview --port 4173`, so the tests run against the real production build with the service worker and CSP. Specs: `shell`, `phone`, `m1`–`m5`, `m4-life`, `m4-lists`, `m6-daily`, `m6-gym`, `m6-health`, `m6-projects`, `m6-reminders`, `m6-sections`. |
| Static checks      | `tsc -b` (strict TS 6), ESLint 10 flat config (`eslint.config.js`) with typescript-eslint and react-hooks, Prettier with the Tailwind class sorter. `npm run check` runs typecheck, lint and tests.                                                                                                                                                                                                                                                                                                                |
| Manual test notes  | `docs/testing/M0.md` … `M5.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Gaps:**

- No component tests for Gym, Health or the collection views (they are covered only by e2e).
- No test for import-then-sync.
- No visual regression tests.

## 15. Differences from the uiux-handover docs

- Dexie is now at **v11**: `routines` was added, along with v9 `vaultMeta`/`vaultItems` and v10 `syncSeen`.
- Sync (Supabase), the Vault, App Lock, private journal encryption, gym routines and the weekday builder, timestamped health logs, and reminder snooze, quiet hours and per-habit repeat are all **implemented**. Older copy that says "M5 / coming" is stale (`SettingsPage.tsx:476`, `nav.ts:153`, `write.ts:13`, the `nav.ts` MODULES descriptions).
- The `links`, `widgets` and `taskOccurrences` tables exist in the schema but are not used by app code. The `inbox` table is legacy: the Inbox is built from tasks.
