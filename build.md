# Personal OS — Build Plan (build.md)

> **Status:** v0.2 — APPROVED (all recommendations D1–D15 accepted on 2026-11-17). App name and logo still to be decided (working name "Personal OS").
> **Date:** 2026-11-17

### Your context (used for starter data)

| Item | Value |
|---|---|
| Phone | Android (Chrome) → Web Push works for an installed PWA; no iOS workarounds needed for you |
| Desktop browser | Chrome |
| Course | SMAI |
| Research | Physical AI |
| Adviser | Prof. KS Rajan |
| Thesis | Not started yet → starter chapter outline only, editable |
| Accounts ready | GitHub ✅ · Vercel ✅ (hosting, replaces Cloudflare in D14) · Supabase ✅ (used from M5) · Google Calendar API enabled ✅ (used in M6) |
> **Owner:** You (MS by Research student). This is the primary persona for v1.
> **How to review:** Every decision I need from you is labeled **D1, D2, …** and has a recommendation. Reply with things like "D3: agree", "D7: option B", or "change section 6.2 to …".

---

## Table of Contents

1. [Summary](#1-summary)
2. [Requirements Analysis](#2-requirements-analysis)
3. [Missing Features & Suggested Improvements](#3-missing-features--suggested-improvements)
4. [Technical Challenges & Risks](#4-technical-challenges--risks)
5. [Technology Stack](#5-technology-stack)
6. [Architecture](#6-architecture)
7. [Data Model (Database Design)](#7-data-model-database-design)
8. [Offline-First Strategy](#8-offline-first-strategy)
9. [Authentication & Sync Strategy](#9-authentication--sync-strategy)
10. [Security & Privacy](#10-security--privacy)
11. [Progress Tracking & Analytics Rules](#11-progress-tracking--analytics-rules)
12. [UI/UX Design](#12-uiux-design)
13. [MVP Definition](#13-mvp-definition)
14. [Revised Roadmap (Milestones)](#14-revised-roadmap-milestones)
15. [Testing & Quality Strategy](#15-testing--quality-strategy)
16. [Project Structure & Conventions](#16-project-structure--conventions)
17. [Decisions Needed From You](#17-decisions-needed-from-you)
18. [Glossary](#18-glossary)

---

## 1. Summary

**Personal OS** is an installable, offline-first **Progressive Web App (PWA)** that works as one workspace for work and research, self-improvement, personal life, and miscellaneous tasks. Under all four areas runs one shared productivity layer: Inbox, Tasks, Projects, Habits, Goals, Calendar, Reviews and Analytics.

**Guiding ideas**

- **Local-first.** Your data lives on your device first and works without internet. Cloud sync is optional and added later.
- **One engine, many modules.** Rather than hard-coding 30 separate features, we build a small set of **core entities** plus a **customizable "Collections" engine** (similar to a lightweight Notion database). Movies, places, papers, date ideas and similar modules then become *templates* on that engine, not separate code.
- **Honest data.** Statistics come from an **append-only activity log**, not from the current state of items. Editing a task never rewrites history.
- **Profile-agnostic core.** "Researcher", "Student" and other profiles are just **starter templates** (a predefined set of sections, collections, widgets and messages). The core never checks which profile you picked.

---

## 2. Requirements Analysis

### 2.1 What you asked for, grouped by layer

| Layer | Contents | Notes |
|---|---|---|
| **Core platform** | Onboarding/profiles, sections tree, customization, tags, custom fields, templates, settings, theming | Must exist before anything else |
| **Productivity core** | Inbox, Tasks (subtasks, recurrence, statuses), Projects, Milestones, Habits, Goals, linking | Used by every section |
| **Time layer** | Calendar, Events, Reminders/Notifications, Dashboard views (Today/Week/Upcoming) | Depends on productivity core |
| **Insight layer** | Activity log, analytics, heatmaps, streaks, Reviews (D/W/M/Y), motivational messages | Depends on the activity log existing from day 1 |
| **Content modules** | Research, Thesis, Coursework, Adviser Meetings, Updates, Ideas, Gym, Activities, Health, Learning/Skills, Movies, Places, Trips, Dates/Relationships, Misc | Mostly Collections + templates; some need special UIs |
| **Private modules** | Notes (ordinary), Journal (private), Vault (encrypted) | Three separate modules, as you specified |
| **Platform services** | Offline storage, PWA install, backup/export/import, auth, sync, encryption, notifications, integrations | Cross-cutting concerns |

### 2.2 Key observations

1. **Many "modules" are the same shape.** Movies, places, papers, datasets, date ideas, gift ideas, resources, conference deadlines and courses are all *lists of records with custom fields, a status and some views*. A generic **Collections engine** covers roughly 60% of the content modules with one well-tested feature.
2. **A few modules really do need specialized UIs:**
   - **Workout logger:** fast set/rep/weight entry and progressive-overload charts.
   - **Journal:** distraction-free editor, calendar browsing, mood.
   - **Vault:** encryption, lock/unlock.
   - **Thesis:** chapter tree with word-count progress.
   - **Adviser meetings:** notes plus action items that turn into real tasks.
   - **Skills ↔ Projects graph:** prerequisite linking.
3. **Phase 4 in your plan (specialized modules) is where your daily value is,** but it depends on Phases 1–3. I propose pulling the **Collections engine and 2–3 researcher modules into the MVP** so the app is useful to you early (see §13).
4. **Export/backup appears in Phase 5 of your plan, which is too late.** In guest mode, data lives only in the browser, and browsers can evict it. **Backup/export must ship in the MVP.** This is my strongest recommendation.
5. **"Overdue" should not be a stored status.** It is *derived*: due date has passed and status is not Completed, Skipped or Cancelled. Storing it creates bugs, such as a task staying "Overdue" after its due date is moved.

---

## 3. Missing Features & Suggested Improvements

Each item is tagged with the milestone where I'd put it (see §14). **Bold** items are ones I strongly recommend.

### 3.1 Productivity

| # | Feature | Why | When |
|---|---|---|---|
| F1 | **Global search + command palette (Ctrl/Cmd+K)** | With this many modules, search *is* the navigation on desktop | MVP |
| F2 | **Natural-language Quick Capture** ("submit review fri 5pm #thesis !high") | Makes capture take about 3 seconds; uses `chrono-node` for dates | MVP |
| F3 | **Trash with 30-day recovery + Undo** | You asked for reliable recovery; protects against accidental deletes | MVP |
| F4 | **PWA Share Target** | On your phone, Share → Personal OS sends any link or text straight to the Inbox | M2 |
| F5 | **Focus sessions / Pomodoro + time tracking** | Researchers care about *deep work hours*, not only tasks done; also feeds honest analytics | M3 |
| F6 | **Backlinks / "linked items" panel** | Paper ↔ project ↔ meeting ↔ task connections; you asked for linking | M2 |
| F7 | Keyboard shortcuts (desktop) | Speed | M2 |
| F8 | Time-blocking (drag tasks onto calendar) | Planning your day | M4+ |
| F9 | Morning digest notification ("3 tasks due, 1 meeting") | Pairs with reminders | M5 |

### 3.2 Research-specific (your persona)

| # | Feature | Why | When |
|---|---|---|---|
| R1 | **Paper pipeline:** To Read → Reading → Read → Summarized → Cited | Literature review tracking, better than a flat list | M3 |
| R2 | **Import paper by DOI / arXiv ID / BibTeX** (auto-fills title, authors, year, venue) | Saves a lot of typing; free public APIs (Crossref, arXiv) | M4 |
| R3 | Export references as BibTeX | Feeds your LaTeX thesis | M4 |
| R4 | **Conference deadlines in AoE (Anywhere on Earth) timezone** | Most CS/ML deadlines use AoE; a common source of missed deadlines in IST | M3 |
| R5 | Thesis word-count goals per chapter + writing log | Measurable writing progress | M4 |
| R6 | Meeting action items → tasks with "follow up at next meeting" flag | Closes the loop on adviser suggestions | M3 |
| R7 | Experiment log template (hypothesis, config, result, link to notebook/W&B run) | Reproducibility | M3 |
| R8 | Zotero integration | Many researchers already use Zotero | Later |

### 3.3 Health & Self-improvement

| # | Feature | Why | When |
|---|---|---|---|
| H1 | **Daily check-in:** sleep hours, mood, energy, water (each optional) | Lets analytics correlate productivity with health | M4 |
| H2 | Body metrics over time (weight, measurements) | Fitness progress beyond lifts | M4 |
| H3 | **Habits with flexible targets** ("Gym 4×/week", not just daily) + planned rest days | Honest streaks without punishing rest days (see §11) | M2 |
| H4 | Personal records (PRs) auto-detected in workout log | Motivation that comes from real data | M4 |

### 3.4 Personal life & general

| # | Feature | Why | When |
|---|---|---|---|
| P1 | **People entity** (lightweight contacts: adviser, partner, friends, family) | Birthdays, anniversaries, gift ideas, meeting attendees and dates all link to people instead of being typed repeatedly | M3 |
| P2 | Basic expense tracking with categories (Misc) | Listed in your Misc section; trips can reuse it | M4 |
| P3 | Optional app-wide PIN/biometric lock | Phones get shared or borrowed | M5 |
| P4 | Dark/Light/System theme | Your preference from earlier | MVP |
| P5 | `.ics` calendar export/subscription | Guest-mode reminders via your phone's calendar (see §4, challenge C1) | M4 |

### 3.5 Things I suggest *not* building (or postponing)

- **Full nutrition/calorie tracking:** a large feature with its own food database. Postpone.
- **Real-time collaboration/sharing:** this is a personal OS. Postpone indefinitely; the data model won't block it.
- **AI features** (summaries, auto-categorization): could be valuable later (for example, "summarize my week" in reviews), but not in the MVP.
- **Storing real passwords in the Vault:** see §10.4. I recommend a dedicated password manager for live credentials and using the Vault for documents, IDs and private notes.

---

## 4. Technical Challenges & Risks

| # | Challenge | Impact | Mitigation |
|---|---|---|---|
| **C1** | **Notifications when the app is closed.** Browsers have no reliable way to schedule a local notification for later (the Notification Triggers API was abandoned). Reliable reminders on a closed PWA need **Web Push from a server**. | Guest mode (no server) can only notify while the app is open. | (a) In-app reminders and badges while open. (b) **`.ics` export/subscription** so your phone's native calendar fires reminders. (c) Server-side Web Push in M5, using a backend cron job and VAPID keys. |
| **C2** | **iOS limitations.** Web Push works only if the PWA is **installed to the Home Screen** (iOS 16.4+). Safari may **delete site data after 7 days of non-use** for non-installed sites. | Possible data loss on iPhone if not installed | Prompt users to install. Call `navigator.storage.persist()`. Run automatic backup reminders. On iOS, treat sync or export as essential. |
| **C3** | **Browser storage eviction and quota** (photos and attachments are large) | Data loss and quota errors | Request persistent storage. Compress images on the client (max ~1600px, WebP). Show storage usage in Settings. Run scheduled backups. |
| **C4** | **Sync conflicts** (the same task edited on phone and laptop while offline) | Lost edits | Per-field last-write-wins with timestamps plus a conflict log for long text (see §9). |
| **C5** | **Recurring tasks** (RRULE, exceptions, "complete this occurrence only", timezone and DST) | Classic source of bugs | Use the `rrule` library. Recurring task = template + occurrences generated lazily. Each occurrence's completion is stored separately. |
| **C6** | **Customizability vs. data integrity.** User-defined fields and sections can corrupt analytics if they are free-form | Broken charts and migrations | Custom fields have **typed schemas** (text, number, date, select, multi-select, checkbox, URL, rating, link-to-entity). Renaming never changes IDs. Deleting a field archives it rather than destroying it. |
| **C7** | **Encryption + search.** Encrypted journal and vault entries can't be searched on a server | Search only works after unlocking | Decrypt locally after unlock and build an in-memory search index that is never persisted in plaintext. |
| **C8** | **Analytics performance** as years of logs build up | Slow dashboards | Daily rollup table (`dailyStats`) computed incrementally. Charts read the rollups, not raw logs. |
| **C9** | **Scope creep.** The spec is very large | Never shipping | Strict milestones, each usable on its own (§14). |
| **C10** | **Schema migrations** for local IndexedDB across app versions | Users stuck on broken data | Versioned Dexie schema + migration tests + automatic backup before each migration. |
| **C11** | **Vault key loss** (forgotten passphrase means data is gone forever by design) | Permanent loss | Recovery key generated at setup that you must save or print, with clear warnings (§10). |

---

## 5. Technology Stack

**Recommendation (D1):**

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | Large data model; types prevent many bugs |
| UI framework | **React 19 + Vite 8** | Largest ecosystem, fast dev server, first-class PWA plugin |
| Routing | **React Router 8 (data routers)** | Mature and simple |
| Styling | **Tailwind CSS 4 + Radix primitives (`radix-ui`), shadcn-style components** | Accessible components; you own the code; easy theming (dark/light) |
| Local database | **Dexie.js (IndexedDB)** + `dexie-react-hooks` (`useLiveQuery`) | Best offline DB for the web; reactive queries; schema versioning |
| UI state | **Zustand** | Tiny; for UI-only state (sidebar open, filters) |
| Validation | **Zod** | Validate entities, imports and custom-field values |
| Dates & recurrence | **date-fns** + **rrule** + **chrono-node** (NL parsing) | Standard tools |
| Rich text (Journal/Notes) | **Tiptap** (ProseMirror) | Markdown shortcuts, images, stores JSON |
| Charts | **Apache ECharts** (via `echarts-for-react`) | Heatmaps, calendars, trends, good on mobile |
| Calendar UI | **FullCalendar** (MIT core) | Day/week/month views, drag and drop, recurrence display |
| Maps | **Leaflet + OpenStreetMap** | Free, no API key; visited-places map |
| Drag & drop | **dnd-kit** | Reorder sections, widgets, subtasks; touch-friendly |
| Ordering | **fractional-indexing** | Reorder without rewriting every row (and sync-friendly) |
| PWA | **vite-plugin-pwa (Workbox)** | Service worker, offline cache, install prompt, share target |
| Crypto | **WebCrypto (AES-GCM)** + **Argon2id via `hash-wasm`** | Standard, audited primitives; no hand-rolled crypto |
| Testing | **Vitest** + **React Testing Library** + **Playwright** (incl. mobile viewport) + `fake-indexeddb` | Unit, component and end-to-end tests |
| Backend (M5, optional) | **Supabase** (Postgres + Auth + Storage + Edge Functions + pg_cron) | Free tier, row-level security, can be self-hosted (no lock-in) |
| Hosting | **Cloudflare Pages** or **Vercel** (free) | HTTPS (required for PWA), global CDN |

> **Versions in use (M0, 2026-11-17):** React 19.3, React Router 8.5, Vite 8.3, Tailwind 4.3, Dexie 4.4, vite-plugin-pwa 2.0, Vitest 5.1, Playwright 1.65, Zod 4, Zustand 5. TypeScript is pinned to **6.0** (not 7.0) because `typescript-eslint` doesn't support TS 7 yet.

Alternatives I considered and rejected for now:
- **Next.js:** server-first framework with no benefit for an offline-first SPA.
- **Flutter/React Native:** you chose PWA.
- **Firebase:** more lock-in, NoSQL makes analytics harder.
- **PouchDB/CouchDB:** older ecosystem.
- **Dexie Cloud:** paid sync service. Simplest sync option, but it creates lock-in. Revisit in **D6**.

---

## 6. Architecture

### 6.1 High-level picture

```
┌──────────────────────────── Browser / Installed PWA ────────────────────────────┐
│                                                                                  │
│  UI Layer (React)                                                                │
│   ├─ Shell: Sidebar/BottomNav, Command Palette, Quick Capture, Theme             │
│   ├─ Feature modules: dashboard, tasks, projects, habits, goals, calendar,       │
│   │   collections, research, thesis, meetings, workout, journal, vault, reviews  │
│   └─ Shared components: EntityList, EntityForm, CustomFieldRenderer, Charts      │
│                                                                                  │
│  Domain Layer (pure TypeScript, no React)                                        │
│   ├─ Repositories (TaskRepo, ProjectRepo, …) — the ONLY code that writes to DB   │
│   ├─ Services: recurrence, progress calc, streaks, NL parser, reminders, export  │
│   └─ ActivityLog writer (every mutation emits an event)                          │
│                                                                                  │
│  Data Layer                                                                      │
│   ├─ Dexie (IndexedDB): entities + activityLog + dailyStats + outbox + blobs     │
│   ├─ Crypto module (vault/journal key mgmt, encrypt/decrypt)                     │
│   └─ Sync engine (M5): outbox → push, pull → merge                               │
│                                                                                  │
│  Service Worker: offline app shell, asset cache, push handler, share target      │
└──────────────────────────────────────────────────────────────────────────────────┘
                                     │  (optional, M5)
                                     ▼
            Supabase: Auth · Postgres (RLS) · Storage (encrypted blobs)
                      · Edge Functions (web push, cron reminders)
```

### 6.2 Key architectural rules

1. **The repository pattern is the only write path.** UI never calls Dexie directly to write. Each repository method (a) validates with Zod, (b) writes the entity, (c) appends to `activityLog`, (d) appends to `outbox` (for future sync), and (e) updates `dailyStats`, all in **one IndexedDB transaction**. This single rule gives us honest analytics, sync readiness and undo.
2. **Modules are plugins.** Each module (e.g. `workout`) registers: routes, sidebar entry, dashboard widgets, collection templates, motivational message pools, export handlers. Profiles are just lists of modules plus starter data. Adding the "Competitive Exam Aspirant" profile later means adding templates, not changing core code.
3. **Sync-ready from day 1.** Even before accounts exist, every record has a UUID, `createdAt`, `updatedAt`, `deletedAt` (soft delete), `version` and `deviceId`. Adding sync later then needs no data migration.
4. **No hard-coded sections in logic.** Sections and subsections are data (the `nodes` table). Built-in modules attach to nodes by `moduleKey`, so renaming or moving "Thesis" never breaks it.

---

## 7. Data Model (Database Design)

### 7.1 Common fields (on every syncable table)

```ts
interface BaseEntity {
  id: string;            // UUIDv7 (time-sortable)
  createdAt: number;     // epoch ms
  updatedAt: number;
  deletedAt?: number;    // soft delete → Trash (purged after 30 days)
  archivedAt?: number;
  version: number;       // increments on every write
  deviceId: string;      // which device last wrote it
}
```

### 7.2 Structure & customization

| Table | Purpose | Key fields |
|---|---|---|
| `profile` | Single row: onboarding choice, settings, theme, timezone, week start | `profileTypes[]`, `settings{}` |
| `nodes` | **The sections tree.** Main sections, subsections and nested categories | `parentId?`, `title`, `icon`, `color`, `order` (fractional), `hidden`, `moduleKey?` (e.g. `"thesis"`, `"collection"`, `"workout"`), `config{}` |
| `tags` | Global tags | `name`, `color` |
| `fieldDefs` | Custom field definitions | `scope` (`task` / `project` / collection id), `name`, `type`, `options[]`, `required`, `order`, `archived` |
| `templates` | Reusable templates for tasks, projects, meetings, workouts, trips, journal entries, reviews | `kind`, `name`, `payload{}` |
| `widgets` | Dashboard layout | `dashboardId`, `type`, `order`, `config{}`, `visible` |
| `messages` | Motivational messages (built-in + user) | `text`, `author?`, `contexts[]` (`nodeId` / `moduleKey` / `timeOfDay` / `trigger`), `enabled` |

### 7.3 Productivity core

| Table | Purpose | Key fields |
|---|---|---|
| `inbox` | Quick-capture items not yet processed | `text`, `kind?` (idea/task/link/note/reminder), `url?`, `processedInto?` (`{table,id}`) |
| `goals` | Long-term objectives | `title`, `why`, `nodeId`, `targetDate?`, `status`, `measure?` (e.g. "papers submitted: 0/2") |
| `projects` | Multi-task efforts | `title`, `nodeId`, `goalId?`, `status`, `startDate`, `dueDate?`, `color`, `progressMode` (`tasks` / `milestones` / `manual`) |
| `milestones` | Project checkpoints | `projectId`, `title`, `dueDate?`, `doneAt?`, `weight` |
| `tasks` | Actionable items | `title`, `description`, `nodeId`, `projectId?`, `milestoneId?`, `parentTaskId?` (subtasks), `priority` (P1–P4), `status` (`not_started`/`in_progress`/`completed`/`skipped`/`cancelled`), `kind` (general/learning/…), `startDate?`, `dueDate?`, `dueTime?`, `timezone?` (for AoE), `recurrenceId?`, `estimateMin?`, `tags[]`, `custom{}`, `order` |
| `recurrences` | Recurring task templates | `rrule` (string), `taskTemplate{}`, `startDate`, `until?`, `exceptions[]` |
| `taskOccurrences` | Per-occurrence status for recurring tasks | `recurrenceId`, `date`, `status`, `completedAt?`, `note?` |
| `habits` | Recurring behaviors | `title`, `nodeId`, `goalId?`, `target` (`{type:"daily"}` / `{type:"perWeek",n:4}` / `{type:"days",days:[1,3,5]}`), `unit?` (e.g. minutes), `restDaysAllowed` |
| `habitLogs` | One row per habit per day | `habitId`, `date`, `status` (`done`/`skipped`/`rest`), `value?`, `note?` |
| `events` | Calendar events (meetings, exams, appointments, dates, trips) | `title`, `start`, `end`, `allDay`, `rrule?`, `nodeId`, `location?`, `linked{table,id}?`, `reminders[]` |
| `reminders` | Scheduled notifications | `target{table,id}`, `fireAt`, `channel` (in-app/push), `sentAt?` |
| `links` | Generic many-to-many links (backlinks) | `from{table,id}`, `to{table,id}`, `relation` (e.g. `requires_skill`, `discussed_in`) |
| `attachments` | File metadata | `owner{table,id}`, `name`, `mime`, `size`, `blobId`, `encrypted` |
| `blobs` | Binary data (images, PDFs) | `data: Blob` (encrypted when owned by vault or private journal) |

### 7.4 Collections engine (generic lists with custom fields)

| Table | Purpose |
|---|---|
| `collections` | A user- or template-defined list: "Movies", "Places", "Papers", "Datasets", "Date Ideas", "Gift Ideas", "Courses", "Conference Deadlines", "Shopping List" … Fields: `nodeId`, `name`, `icon`, `templateKey?`, `statusOptions[]`, `defaultView` (`table`/`cards`/`kanban`/`map`/`calendar`) |
| `records` | One item in a collection: `collectionId`, `title`, `status`, `rating?`, `custom{}` (validated by `fieldDefs`), `tags[]`, `location?{lat,lng,address,mapUrl}` |

**Built-in templates in MVP / M3:** Papers, Courses, Conference Deadlines, Datasets & Resources, Ideas, Learning Resources, Movies & Series, Places, Date Ideas, Gift Ideas, Shopping List.

### 7.5 Specialized modules (own tables)

| Module | Tables |
|---|---|
| Thesis | `thesisChapters` (`order`, `title`, `targetWords`, `currentWords`, `status`), `writingLogs` (`date`, `chapterId`, `wordsDelta`, `minutes`) |
| Adviser meetings | `meetings` (`eventId`, `attendees[]` → people, `agenda`, `notes` (rich text), `decisions[]`), action items are `tasks` with `links` → meeting |
| Workout | `exercises` (`name`, `muscleGroups[]`, `type`: strength/cardio/mobility), `workoutPlans`, `workoutSessions` (`date`, `planId?`, `durationMin`, `notes`), `workoutSets` (`sessionId`, `exerciseId`, `reps`, `weight`, `durationSec?`, `distance?`, `rpe?`) |
| Activities | `activityEntries` (`type`: yoga/meditation/run/walk/cycle/sport, `durationMin`, `distance?`, `notes`) |
| Health | `healthRecords` (appointments are `events`; medicines are `habits` with reminders; documents are `attachments`), `checkins` (`date`, `sleepH`, `mood`, `energy`, `waterMl`), `bodyMetrics` |
| Skills/Learning | `skills` (`name`, `level`, `targetLevel`), links `project → requires_skill → skill`, `skill → resource (record)` |
| People | `people` (`name`, `relation`, `birthday?`, `anniversary?`, `notes`) |
| Trips | `trips` (`destination`, `start`, `end`, `status`, `budget`), `tripItems` (`day`, `placeRecordId?`, `notes`), `expenses` (shared with Misc) |
| Expenses | `expenses` (`date`, `amount`, `currency`, `category`, `tripId?`, `note`) |
| Notes | `notes` (`title`, `content` (Tiptap JSON), `nodeId`, `tags[]`, `pinned`) |
| Journal | `journalEntries` (`date`, `title?`, `content`, `mood?`, `category`, `tags[]`, `isPrivate`, `cipher?`) |
| Vault | `vaultItems` (`type`: note/document/reference, **all content in `cipher`**: encrypted JSON) + `vaultMeta` (salt, KDF params, wrapped keys) |
| Reviews | `reviews` (`period`: day/week/month/year, `periodStart`, `autoSummary{}` (snapshot), `answers{}`, `templateId`) |

### 7.6 History & analytics

| Table | Purpose |
|---|---|
| `activityLog` | **Append-only.** `ts`, `entity{table,id}`, `action` (`created`/`updated`/`status_changed`/`completed`/`skipped`/`deleted`/…), `before?`, `after?`, `nodeId` (denormalized for fast per-section stats) |
| `dailyStats` | Rollup per `date × nodeId`: `tasksDue`, `tasksCompleted`, `tasksSkipped`, `tasksOverdue`, `habitTargets`, `habitDone`, `focusMinutes`, … |
| `outbox` | Pending changes to push when sync is enabled (M5) |

### 7.7 Entity relationships (simplified)

```
Goal 1─* Project 1─* Milestone
 │         │
 │         └─* Task 1─* Subtask (Task with parentTaskId)
 │               └── Recurrence 1─* TaskOccurrence
 └─* Habit 1─* HabitLog

Node (section tree) 1─* {Task, Project, Habit, Goal, Collection, Note, Event, …}
Collection 1─* Record
Any entity *─* Any entity   via `links`
Any entity 1─* Attachment ─1 Blob
Every write ──► ActivityLog ──► DailyStats
```

---

## 8. Offline-First Strategy

1. **The app shell is precached** by the service worker, so the app opens instantly with no network.
2. **IndexedDB is the source of truth** on each device. The UI reads only from local DB through `useLiveQuery`, so the screen updates instantly with no loading spinners for your own data.
3. **Network is optional.** Only these need the network: sync (M5), DOI/arXiv lookup, map tiles (cached after first view), web push registration.
4. **Persistent storage:** call `navigator.storage.persist()` after install or onboarding, and show its status in Settings.
5. **Backups (MVP):**
   - One-click **full export** (JSON + attachments) as a `.zip`.
   - **Auto-backup reminder** every N days (default 7) while in guest mode.
   - On desktop Chrome/Edge: optional **auto-backup to a chosen folder** (File System Access API).
   - Automatic local snapshot before every DB schema migration.
6. **Update flow:** a new version is downloaded in the background and the user sees "Update available → Reload". It never reloads silently mid-edit.

---

## 9. Authentication & Sync Strategy

### 9.1 Modes

| Mode | Storage | Available |
|---|---|---|
| **Guest (default)** | Local IndexedDB only | MVP |
| **Account** | Local IndexedDB + cloud sync | M5 |

**Guest → Account upgrade:** your local DB is already sync-ready (UUIDs, versions, outbox). Signing in for the first time **uploads everything**. No data is re-created or lost. If you sign in on a second device that already has guest data, we **merge** (UUIDs never collide).

### 9.2 Sync approach (D6)

| Option | Pros | Cons |
|---|---|---|
| **A. Supabase + custom sync engine** *(recommended)* | No lock-in (Postgres, can self-host), free tier, RLS security, I control conflict rules | More code (~1–2 weeks of the M5 milestone) |
| B. Dexie Cloud | Almost zero sync code, built for Dexie | Paid beyond small usage, vendor lock-in |
| C. PowerSync / ElectricSQL + Supabase | Robust sync engines | Extra service, more complexity than needed for one user |
| D. CRDTs (Yjs/Automerge) | Perfect merging, even for text | Heavy, harder to query/analyze; overkill |

**Option A design:**
- **Push:** the outbox sends batched changes `{table, id, fields changed, version, updatedAt, deviceId}`.
- **Pull:** fetch rows changed since `lastSyncCursor` (server-assigned sequence number, not client clocks).
- **Conflict resolution:** **per-field last-write-wins**. If phone edits the title and laptop edits the due date, both survive. For **long text fields** (notes, journal, meeting notes), if both sides changed the same field, keep the newer one and **save the other as a "conflict copy"** you can review. Nothing is silently lost.
- **Deletes** are tombstones (`deletedAt`), so deletions sync correctly.
- **activityLog** rows are immutable and synced append-only.
- **Encrypted tables** (vault, private journal) sync as ciphertext only. The server never sees keys.

### 9.3 Authentication

- Supabase Auth: **email + magic link** and/or **Google sign-in**; optional TOTP 2FA later.
- Session tokens stored by the Supabase client. Short-lived access tokens with refresh.
- **Account deletion:** deletes all server rows and files; local data stays unless you also choose "wipe this device".

---

## 10. Security & Privacy

### 10.1 Threat model (what we protect against)

| Threat | Protection |
|---|---|
| Someone picks up your unlocked phone or laptop | Optional app PIN lock (M5), vault auto-lock after inactivity, private journal entries hidden until unlocked |
| Cloud provider breach or misconfigured DB | **End-to-end encryption** for vault and private journal (server stores ciphertext); RLS for everything else |
| Network snooping | HTTPS only (HSTS) |
| Malicious script in the page (XSS) | Strict **Content Security Policy**, no `dangerouslySetInnerHTML` with user content, sanitize rich text, minimal third-party scripts, no analytics or trackers |
| Malicious import file | Zod-validate every imported record; reject unknown fields |

### 10.2 Encryption design (Vault + private Journal)

```
Your Vault passphrase ──Argon2id(salt, memory-hard)──► KEK (key-encryption key)
                                                         │ wraps
Random 256-bit Data Key (DEK) ◄──────────────────────────┘
        │  AES-256-GCM (random 96-bit IV per item)
        ▼
  vaultItems.cipher / journalEntries.cipher / encrypted blobs

Recovery Key (random, shown ONCE, you print/save it) ──► also wraps the same DEK
```

- Changing your passphrase only re-wraps the DEK; data is not re-encrypted.
- **Forgot passphrase and lost the recovery key → data is unrecoverable.** This is intentional; it's what makes it a real vault. The UI will say this clearly during setup.
- The decrypted DEK lives **only in memory** and is wiped on lock, on tab close, or after N minutes idle (default 5).
- **Search inside the vault and private journal** works only while unlocked (in-memory index).
- **Exports** of the vault are encrypted by default (`.posvault` file). Plaintext export requires re-entering the passphrase plus a warning.

### 10.3 Journal privacy (D8)

- **Option 1:** every journal entry encrypted with the vault key (maximum privacy; journal locked until unlocked).
- **Option 2** *(recommended)*: per-entry **"Private" toggle**. Private entries are encrypted; normal entries stay searchable and shown in reviews and analytics. Default for new entries is configurable.

### 10.4 About storing credentials in the Vault (D9)

The Vault will be properly encrypted, but a web app is a weaker place for **live passwords** than a dedicated password manager (Bitwarden, 1Password, KeePassXC), which has browser autofill, breach monitoring and independent security audits. **Recommendation:** use the Vault for documents (ID scans, certificates), private notes and reference details (policy numbers, account *hints*), and keep live passwords in a password manager. The Vault won't technically block you from storing them; this is guidance, not a restriction.

---

## 11. Progress Tracking & Analytics Rules

These are the **"honest progress" rules**, written as precise definitions so the code can enforce them.

### 11.1 Statuses

| Status | Counts as done? | Notes |
|---|---|---|
| Not Started | No | |
| In Progress | No | |
| **Completed** | **Yes** | Only via explicit user action (checkbox, button or swipe). Never automatic. |
| Skipped | **No** | Recorded separately; requires a deliberate tap; optional reason |
| Cancelled | Excluded | Removed from the denominator (it is no longer expected work) |
| *Overdue* (derived) | No | `dueDate < now` and status is not Completed/Skipped/Cancelled |

### 11.2 Formulas

- **Task completion rate (period)** = completed ÷ (completed + skipped + still-open-and-due-in-period). Cancelled is excluded.
- **Project progress** depends on `progressMode`:
  - `tasks`: completed ÷ non-cancelled tasks.
  - `milestones`: weighted milestone completion.
  - `manual`: you set the %. Shown with a "manual" badge so it's never mistaken for computed progress.
- **Subsection / section progress** = aggregate of tasks, habits and projects under that node *for the selected period* (not all-time).
- **Habit consistency** = done ÷ target over period, where the target respects `perWeek` and planned rest days.
- **Streaks:**
  - Daily habits: consecutive days with `done`.
  - Weekly-target habits: consecutive weeks hitting the target.
  - A **planned rest day doesn't break the streak but doesn't increase it either**. Skipped *does* break it.
  - No "streak freeze" purchases or gamified loopholes.
- **Editing history is preserved:** changing a task's due date or title doesn't change past days' stats, because stats come from `activityLog` and `dailyStats`.
- **Backdating:** you can mark something completed "yesterday" (forgot to tick it), but the log stores both `completedFor` and `loggedAt`, and analytics can show "late-logged" items.

### 11.3 Visualizations (M4)

Calendar heatmap (GitHub-style, per section or habit), daily/weekly bar charts, monthly trend lines, yearly consistency grid, completion % donut per section, section-vs-section comparison, streak timelines, project burndown, habit grid, visited-places map (Leaflet), workout volume/PR charts, thesis word-count progress. Every chart is **drill-down**: overall → section → subsection → project → task.

---

## 12. UI/UX Design

### 12.1 Look and feel (from your answers)

- **Dark mode first** with Light and System options.
- **Minimal, content-first** style, inspired by Notion (structure and customization) and TickTick/Todoist (task speed). We take inspiration only, not copies of their look.
- One accent color per main section (user-changeable). Calm neutrals elsewhere.
- Typography: Inter (UI) + a serif option for the Journal editor.

> **UI refresh (2026-11-17, after your first phone test).** Design thesis: *a calm instrument in graphite and paper,
> where color only ever means which part of your life something belongs to.*
> - **Palette:** graphite background `#131316`, paper text `#ECE9E3`; primary buttons are paper/ink, not a brand
>   hue. The four area colors (Work `#93A4FF`, Self `#5FD0A0`, Personal `#FF8C9E`, Misc `#F2C35E`) are the only
>   color, plus priority and danger. Light theme mirrors it (`#F5F3EF` / `#1C1C20`).
> - **Type:** Inter for reading and UI; **Bricolage Grotesque** (display, optical sizing) only for page titles,
>   the greeting and the onboarding headline. Both self-hosted, so they work offline.
> - **Phone vs desktop:** same app and screens, tuned per device. Phones get 16px text, 44px+ targets, bottom
>   sheets and native pickers; desktop gets denser rows, hover-revealed actions, a "New task" button and the
>   `N` shortcut.
> - **Motion:** only in answer to an action (sheets rise, a ticked task checks off and lingers ~1s before
>   leaving). Exits faster than entrances; reduced-motion respected.
> - **No backdrop blur** anywhere (it can black out the screen on some Android GPUs).
> - Guidance applied: Anthropic `frontend-design` skill and the open-source *impeccable* skill suite
>   (onboard, adapt, distill, delight, animate, polish).

### 12.2 Navigation

**Desktop (≥1024px):** collapsible, reorderable **left sidebar**:

```
[Quick Capture  +]          [Search ⌘K]
Dashboard
Inbox (3)
Calendar
──────────
▸ Work
   Research · Thesis · Coursework · Adviser Meetings · Updates · Ideas
▸ Self-Improvement
▸ Personal Life
▸ Miscellaneous
──────────
Reviews · Analytics
Notes · Journal · Vault 🔒
Settings
```

**Mobile (<768px):** **bottom tab bar** with 5 slots:

```
[ Today ]  [ Tasks ]  [ ＋ New task ]  [ Sections ]  [ More ]
```

- *(Changed 2026-11-17: Tasks replaces Calendar until the calendar exists in M2.)*
- The center **＋** is always reachable with one thumb and opens a **New task** bottom sheet: type, press
  Enter, and it's saved to the section you're on (or due today on Today). Chips set section, Today/Tomorrow/
  date and priority. The sheet stays open for the next task. Natural-language capture and the Inbox arrive in M2.
- Screens from later milestones are folded under **Coming soon** (sidebar and More), so navigation shows only
  what works today.
- "Sections" opens a list of your four main sections and their subsections.
- "More" holds Inbox, Reviews, Analytics, Notes, Journal, Vault and Settings.
- **The 4 tabs other than ＋ are customizable** (for example, swap Calendar for Gym).

**Tablet:** collapsible sidebar (icons only), expanded on demand.

### 12.3 Key screens (MVP)

1. **Onboarding (one screen, both questions optional):** your name + what you do (multi-select). Theme, time zone
   and week start use sensible defaults. *(Changed 2026-11-17: the old 5-step flow asked too much up front.)*
   Everything else is suggested afterwards by a dismissible **Finish setting up** checklist on Today: research
   areas, courses, first task, shape your sections, install, first backup.
2. **Dashboard / Today:** greeting + context message, Quick Capture bar, Today's tasks (overdue pinned on top in red), habits for today (tap to check), upcoming deadlines (7 days), ongoing projects (progress bars), today's events. Widgets can be reordered, hidden and configured.
3. **Section page:** header (icon, color, message), subsections as cards with progress, section-level task list and stats.
4. **Task list views:** List · Board (Kanban by status) · Calendar. Filters by section, tag, priority and date; saved filters.
5. **Task detail:** side panel on desktop, full-screen sheet on mobile.
6. **Inbox:** process items one by one with "→ Task / Project / Note / Collection item / Archive" buttons.
7. **Settings:** profile, sections and structure editor, tags, custom fields, templates, messages, theme, backup/export/import, storage usage, about.

### 12.4 UX principles

- **Progressive disclosure:** task forms show only the title by default, with "More options" for the rest. Customization lives in Settings and "⋯" menus, not cluttering every screen.
- **Mobile gestures:** swipe right = complete, swipe left = skip or reschedule, long-press = reorder or multi-select.
- **Undo toast** after every destructive or status action.
- **Empty states** that teach ("No papers yet — paste a DOI to add one").
- **Accessibility:** keyboard navigable, WCAG AA contrast in both themes, respects reduced-motion, touch targets ≥44px.
- **Motivational messages:** small, dismissible line under section headers. Rotates at most once per visit. Never a pop-up. Globally disable-able.

---

## 13. MVP Definition

**MVP goal:** a fast, installable app you can use **every day** for research and life tasks, with your data safe from loss.

### ✅ In the MVP (Milestones M0–M2)

| Area | Included |
|---|---|
| Platform | PWA (installable, offline), dark/light theme, responsive layouts (mobile/tablet/desktop), persistent storage |
| Onboarding | Profile selection (Researcher fully fleshed out; others get a basic starter structure), editable starter sections |
| Structure | Four main sections + subsections; add/rename/reorder/hide/restore/nest; icons and colors; tags |
| Tasks | Full task properties (title, description, section, project, priority, start/due date+time, status, subtasks, tags, notes, recurrence), completion history, derived Overdue, Skip with reason |
| Projects & Goals | Projects (with milestones), goals, linking tasks → projects → goals |
| Habits | Habits with daily / N-per-week / specific-day targets, rest days, check-in, streaks |
| Inbox | Quick Capture (global button + `Ctrl/Cmd+K` palette), natural-language dates/tags/priority, process-to-entity |
| Dashboard | Today, This Week, Upcoming, All Tasks views; customizable widget order/visibility |
| Calendar | Month/week/day views showing tasks with dates and events; create/edit events; recurring events |
| History | Activity log, trash (30 days), undo |
| Data safety | **Full export/import (JSON + ZIP), CSV export of tasks, backup reminders** |
| Messages | Context-aware motivational messages per section (built-in set + add your own + disable) |
| Search | Global search across tasks, projects, inbox, notes |
| Reminders | **In-app** reminders (when the app is open) |

### ❌ Not in the MVP (comes right after)

Analytics charts and reviews (M3–M4; the data is logged from day 1, so nothing is lost), Collections engine and specialized modules (M3–M4), Journal (M4), Vault (M5), accounts and sync (M5), push notifications (M5), attachments (M3), custom fields UI (M3), Google Calendar (M6).

> **Why this cut?** It's the smallest set that replaces your current to-do system *and* creates the honest activity history that analytics and reviews need later. Researcher modules come immediately after (M3), so you're not waiting long.

---

## 14. Revised Roadmap (Milestones)

Each milestone ends with: tests passing → you test it on phone + laptop → your sign-off → next milestone.

> **Decisions, 2026-11-18 (from you):**
> - **Desktop first.** Every remaining milestone is designed and tested for the desktop app first. The phone
>   gets its own, separately designed interface after the desktop app is complete (the phone keeps working
>   meanwhile, but isn't polished).
> - **Features first, UI/UX discussion after** the desktop app is complete.
> - **No paid AI.** No Claude API. If AI is added later, it uses a free tier (e.g. Google Gemini) behind a
>   Vercel function, and only for basic help. Not in the current scope.
> - **Notion-style pages:** every section has a page you can type into (headings, text, lists, checklists,
>   quotes, dividers) above its tasks. Added to M2.
> - **Simplicity:** anything you don't use can be hidden in one click (sections today; the same pattern for
>   modules and dashboard widgets as they arrive).

| Milestone | Scope | Maps to your phase |
|---|---|---|
| **M0 — Setup** ✅ *built 2026-11-17* | Repo, Vite+React+TS, Tailwind/shadcn, Dexie schema v1, PWA shell, theme, app layout (sidebar + bottom nav), CI (lint, typecheck, tests), deploy preview | Phase 1 |
| **M1 — Foundation** ✅ *built 2026-11-17; UI refresh after first phone test 2026-11-17; awaiting your sign-off* | Onboarding + profiles, section tree + full structural customization, tags, tasks (core + subtasks + statuses), repository layer + activity log + trash/undo, **export/import** | Phase 1 |
| **M2 — Core productivity** *(✅ done on desktop: Notion-style pages, fast date picker, one-click hide/show sections, Inbox + plain-language capture, Ctrl+K search, repeating tasks, projects + milestones, goals, habits, calendar + events, in-app reminders, Today widgets, motivational messages, This week / Upcoming views, Share Target; the phone layout comes after desktop)* | Inbox + Quick Capture + NL parsing + command palette, projects/milestones/goals, habits, recurrence, dashboard + views + widgets, calendar + events, in-app reminders, global search, motivational messages, Share Target | Phase 2 |
| **M3 — Researcher pack** *(✅ done on desktop: ✅ lists engine with custom fields, Table and Board views, ✅ templates: Papers, Conference deadlines (AoE), Experiments, Datasets & resources, Ideas, Blank, ✅ Adviser Meetings: notes, action items as tasks, follow-up carry-over, notes from calendar events, ✅ Courses (Assessments with weights and grade so far), ✅ People (birthdays and anniversaries every year), ✅ attachments (on this device, up to 25 MB), ✅ focus sessions with deep-work totals)* | Collections engine (+ custom fields, table/card/kanban views), templates (Papers, Courses, Conference Deadlines w/ AoE, Datasets, Ideas, Learning Resources), Adviser Meetings (+ action items → tasks), experiment log, attachments, People | Phase 4 (pulled forward) |
| **M4 — Analytics, Reviews & Life modules** | dailyStats rollups, all charts + heatmaps + drill-down, daily/weekly/monthly/yearly reviews, Thesis (chapters + word goals), Workout logger, activities, health check-in, skills ↔ projects, Movies, Places (+ map), Trips, Dates & Occasions, Expenses, Notes, Journal, DOI/arXiv import, `.ics` export | Phases 3 + 4 |
| **M5 — Accounts, Sync & Security** | Supabase auth, sync engine, guest→account migration, conflict copies, Vault (E2E), private journal encryption, app PIN lock, Web Push reminders + morning digest | Phase 5 |
| **M6 — Integrations & polish** | Google Calendar sync, Zotero (maybe), advanced analytics, more profile packs (Student, Professional, Exam Aspirant, Freelancer), performance tuning | Phase 5+ |

I haven't attached time estimates because your pace (and how much you test between milestones) decides that. As a rough guide, M0–M2 is the largest chunk of work.

---

## 15. Testing & Quality Strategy

- **Unit tests (Vitest):** recurrence generation, progress formulas, streak rules, NL capture parser, encryption round-trip, sync merge rules, import validation.
- **Repository tests** on `fake-indexeddb`: every write produces the correct activity log and outbox entries, all in one transaction.
- **Component tests (React Testing Library):** task form, quick capture, section editor.
- **End-to-end tests (Playwright):** desktop and mobile viewports for core flows: onboarding → create task → complete → see it on dashboard → export → wipe → import → data identical.
- **Manual test checklist per milestone** (I'll write it into `docs/testing/Mx.md`) for things automation can't easily cover: install on Android/iOS, offline mode, notifications.
- **Quality gates in CI:** TypeScript strict, ESLint, Prettier, tests, Lighthouse PWA/performance check.

---

## 16. Project Structure & Conventions

```
personal_app/
├─ build.md                  ← this file
├─ docs/                     ← decisions log (ADRs), testing checklists
├─ public/                   ← icons, manifest assets
├─ src/
│  ├─ app/                   ← shell, routes, providers, layout (sidebar/bottom nav)
│  ├─ core/
│  │  ├─ db/                 ← Dexie schema, migrations
│  │  ├─ repos/              ← repositories (only write path)
│  │  ├─ domain/             ← types, zod schemas, pure logic (recurrence, progress, streaks)
│  │  ├─ crypto/             ← (M5) key mgmt, encrypt/decrypt
│  │  └─ sync/               ← (M5) outbox, push/pull, merge
│  ├─ modules/               ← feature plugins: dashboard, tasks, projects, habits, calendar,
│  │                            inbox, collections, research, thesis, meetings, workout, journal, vault…
│  ├─ components/            ← shared UI (shadcn-based)
│  ├─ content/               ← starter templates per profile, built-in motivational messages
│  └─ sw/                    ← service worker extensions (push, share target)
├─ tests/e2e/
└─ package.json
```

- **Commits:** small, one feature per commit, conventional messages (`feat:`, `fix:`).
- **Decisions log:** every major decision gets a short record in `docs/adr/` so you can see *why* later.
- **Motivational content:** I'll write original messages plus public-domain quotes. No copyrighted quote collections.

---

## 17. Decisions Needed From You

> ✅ **All accepted as recommended (2026-11-17).** D13: working name "Personal OS", final name/logo pending. D14: **Vercel**.

| ID | Decision | My recommendation |
|---|---|---|
| **D1** | Tech stack (§5) | React + TypeScript + Vite + Tailwind/shadcn + Dexie, as listed |
| **D2** | Collections engine approach: generic engine + templates for list-like modules, specialized UIs only where needed (§2.2) | **Yes** |
| **D3** | MVP scope as defined in §13 (export/import moved into MVP; analytics & specialized modules right after) | **Yes** |
| **D4** | Pull "Researcher pack" (M3) ahead of analytics & life modules | **Yes**, it's your daily need |
| **D5** | Navigation: sidebar (desktop) + 5-slot bottom bar with center ＋ (mobile) | **Yes** |
| **D6** | Sync approach (§9.2) | **Option A: Supabase + custom sync** (no lock-in) |
| **D7** | Sign-in methods for M5 | **Email magic link + Google** |
| **D8** | Journal privacy (§10.3) | **Option 2: per-entry Private toggle** |
| **D9** | Live passwords in Vault (§10.4) | Allowed but discouraged; recommend a password manager |
| **D10** | Week starts on | **Monday** |
| **D11** | Default timezone / date format | **Asia/Kolkata (IST), DD MMM YYYY** + per-task timezone for AoE deadlines |
| **D12** | Accent colors per section (Work / Self-Improvement / Personal / Misc) | Indigo / Emerald / Rose / Amber (all changeable) |
| **D13** | App name & icon | "Personal OS" with a simple geometric icon, or your own name/logo |
| **D14** | Hosting for phone testing | **Cloudflare Pages** (free, fast, HTTPS) or Vercel |
| **D15** | Which items from §3 (F1–F9, R1–R8, H1–H4, P1–P5) to keep, drop, or move | As tagged in §3 |

---

## 18. Glossary

- **PWA:** a website that can be installed like an app, works offline, and can send notifications.
- **IndexedDB / Dexie:** the database built into every browser; Dexie is a friendly library on top of it.
- **Offline-first:** the app reads and writes locally first; the network is only for sync.
- **Service worker:** background script that caches the app and receives push notifications.
- **RRULE:** standard format for repeating schedules ("every Mon/Wed/Fri until June").
- **E2E encryption:** data is encrypted on your device; the server only stores scrambled bytes.
- **KDF (Argon2id):** turns your passphrase into an encryption key in a deliberately slow way, to resist guessing.
- **RLS (Row-Level Security):** a database rule that each user can only read and write their own rows.
- **Last-write-wins (LWW):** in a conflict, the most recent edit is kept.
- **AoE (Anywhere on Earth):** UTC−12, a timezone used for many academic deadlines.
- **Tombstone:** a "deleted" marker kept so deletions sync to other devices.
