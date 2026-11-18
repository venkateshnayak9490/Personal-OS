# Personal OS: Frontend Architecture (as built)

Personal OS is an offline-first, installable PWA for work, research, health and life management. All user data lives in the browser (IndexedDB). Optional sync to Supabase. Single user, no server-rendered pages. File references are relative to the repo root.

---

## 1. Stack and versions (`package.json`)

| Area | Package | Version |
|---|---|---|
| Runtime | Node | `>=22` |
| UI | `react`, `react-dom` | ^19.3.1 |
| Routing | `react-router` (data router, `createBrowserRouter`) | ^8.5.1 |
| Language | `typescript` | ~6.0.3 |
| Build | `vite` + `@vitejs/plugin-react` | ^8.3.8 / ^6.3.0 |
| Styling | `tailwindcss` + `@tailwindcss/vite` (v4, CSS-first config) | ^4.3.5 |
| Class utils | `clsx` ^2.1.1, `tailwind-merge` ^3.7.0 (combined in `src/lib/cn.ts`) | |
| Headless UI | `radix-ui` (unified package: Dialog, AlertDialog, DropdownMenu, Popover) | ^1.8.1 |
| Icons | `lucide-react` | ^1.74.0 |
| Local DB | `dexie` ^4.4.7, `dexie-react-hooks` ^4.4.0 | |
| UI state | `zustand` | ^5.1.0 |
| Validation | `zod` | ^4.6.7 |
| Rich text | `@tiptap/react`, `starter-kit`, `pm`, `extensions`, `extension-list` | ^3.34.0 |
| Calendar | `@fullcalendar/core`, `react`, `daygrid`, `timegrid`, `interaction` | ^6.1.22 |
| Dates | `date-fns` ^4.4.0, `@date-fns/tz` ^1.5.0, `chrono-node` ^2.10.3 (natural-language dates in task capture) | |
| IDs / ordering | `uuidv7` ^1.2.1, `fractional-indexing` ^3.4.0 | |
| Crypto | `hash-wasm` 4.12.0 (Argon2 for Vault/App lock; needs CSP `wasm-unsafe-eval`) | |
| Sync | `@supabase/supabase-js` | 2.118.0 |
| Fonts | `@fontsource-variable/inter`, `@fontsource-variable/bricolage-grotesque` | ^5.3.0 |
| PWA | `vite-plugin-pwa` ^2.0.0, `workbox-build`/`workbox-window` ^7.4.1, `@vite-pwa/assets-generator` ^2.0.0 | |
| Tests | `vitest` ^5.1.0, `jsdom` ^31, `@testing-library/react` ^16.3.3, `fake-indexeddb` ^6.2.8, `@playwright/test` ^1.65.1 | |
| Lint/format | `eslint` ^10 + `typescript-eslint` + `eslint-plugin-react-hooks`, `prettier` ^3.10 + `prettier-plugin-tailwindcss` | |

**Not present:** no chart library (ECharts is named in `build.md` but not installed), no CSS-in-JS, no component library beyond Radix primitives, no React Query/Redux, no i18n.

Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck`, `lint`, `format`, `test` (vitest), `e2e` (playwright), `icons` (PWA icon generation), `check`.

---

## 2. Build and hosting

- `vite.config.ts`: React + Tailwind + VitePWA plugins; `@` alias → `src`; `__APP_VERSION__` injected from package version; Vitest config inline (jsdom, `src/test/setup.ts`, stub for `virtual:pwa-register/react`).
- Hosting: Vercel (`vercel.json`). SPA rewrite of every non-asset path to `/index.html`. Immutable caching for `/assets/*`; `no-cache` for `sw.js`, workbox files, manifest, `index.html`, `theme-init.js`.
- **Security headers / CSP** (`vercel.json`): `default-src 'self'`; `script-src 'self' 'wasm-unsafe-eval'` (no inline scripts, hence `public/theme-init.js` is an external file); `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `font-src 'self' data:`; `connect-src 'self' https://*.supabase.co https://api.crossref.org https://api.datacite.org` (DOI/paper import); `frame-ancestors 'none'`. Plus nosniff, referrer policy, Permissions-Policy (geolocation self only), HSTS. `vite preview` reuses the same headers (minus HSTS) so E2E runs under the production CSP.
- Code splitting: `CalendarPage` is `lazy()` (FullCalendar is large); the TipTap editor (`features/pages/PageEditor`) is lazy-loaded from NodePage, NotesPage, JournalPage, MeetingPage. Everything else is in the main bundle.

---

## 3. Folder structure

```
index.html                 root html, theme-color meta, loads /theme-init.js before paint
public/                    icons, favicon, logo.svg, theme-init.js
src/
  main.tsx                 font imports, index.css, error logging, install-prompt listener,
                           opens DB + device id, auto-purges Trash >30d, persistent storage, router
  index.css                design tokens, @theme, motion, ProseMirror + FullCalendar overrides, phone rules
  app/                     the shell: AppShell, Sidebar, BottomNav, CommandPalette, UpdatePrompt,
                           toast, routes, nav (static nav config), theme, ui-store, media-query hooks,
                           pwa-install, diagnostics, RouteError
  components/              shared primitives: ui.tsx (Button, Input, Textarea, Select, Field, EmptyState,
                           Loading, ProgressBar), Sheet.tsx (Sheet, Confirm), Menu.tsx, DatePicker.tsx,
                           PageHeader.tsx (PageHeader, Card, MilestoneBadge)
  lib/                     cn, palette (section/tag colors), icons (icon-name map), NodeIcon
  content/                 static content: list templates (collection-templates.ts), motivational messages
  core/                    framework-free data layer
    db/                    Dexie schema (PersonalOSDB, version 11 with migrations), db singleton
    domain/                pure types + logic (types.ts, tasks, recurrence, progress, analytics, fitness,
                           health, ics, papers, capture (NL parsing), tree, templates, reminders, ...)
    repos/                 the only write path (write.ts) + per-entity repos (tasks, nodes, plans, life,
                           collections, notes, vault, trash, pin, ...)
    hooks.ts               useLiveQuery read hooks
    sync/                  sync engine, per-field merge, Supabase backend
    crypto/                vault encryption + in-memory key session
    backup.ts, storage.ts, device.ts
  features/                feature components used by pages (tasks, collections, life, calendar,
                           analytics, habits, vault, sync, setup, structure, reminders, focus, ...)
  pages/                   one component per route
  test/                    vitest setup, DB reset, PWA stub
tests/e2e/                 Playwright specs per milestone (m1…m6, phone, shell)
build.md                   product/engineering spec (partly aspirational; see note on charts)
```

Convention: `pages/` compose; `features/` hold reusable feature UI and feature-local state; `core/` has no React except `hooks.ts`; `components/` are design primitives.

---

## 4. Routing (`src/app/routes.tsx`, `src/app/nav.ts`)

`createBrowserRouter` with two top-level routes:
- `/welcome` → `OnboardingPage` (outside the shell).
- `/` → `AppShell` (redirects to `/welcome` if no profile), with a nested pathless route carrying `errorElement` so a crashing screen shows `RouteError` inside the frame.

Fixed screens are generated from `allNavItems()` in `nav.ts` (key, title, path, icon, milestone, summary); keys missing from the `BUILT` map would render `PlaceholderPage` (currently all are built). Dynamic routes: `/s/:nodeId` (section), `/projects/:projectId`, `/lists/:collectionId`, `/meetings/:meetingId`, `/notes/:noteId`, `/workouts/:workoutId`, `/settings/sections`, `/settings/tags`, `/share`, `/sections`, `/more`, `*` (NotFound).

Nav groups: PRIMARY (Home, Today `/`, All Tasks, Inbox, Projects, Goals, Habits, Focus, Calendar, People), TOOLS (Reviews, Analytics), PRIVATE (Notes, Journal, Vault), Settings, Trash. User-created sections live in the DB and are rendered in the sidebar tree and at `/s/:id`.

Note: `start_url` is `/home`; the index route `/` is "Today" (DashboardPage).

---

## 5. Component architecture

- **AppShell** (`src/app/AppShell.tsx`): `AppLockGate` (optional PIN/passphrase lock) → flex row: `Sidebar` (md+) | `main` (centered `max-w-5xl`, `<Outlet/>`) | `BottomNav` (phone). Mounts app-global singletons once: `NewTaskSheet`, `CommandPalette`, `TaskEditor` (side sheet), `NodeDialog`, `Reminders` (in-app/system notifications), `FocusTimer`, `VaultAutoLock`, `SyncRunner`, `UpdatePrompt`, `Toaster`. Global keys: Ctrl/⌘K palette, `N` new task. Scrolls to top on route change.
- **Global overlays are store-driven:** any component opens the task composer, editor, palette or section dialog by setting a flag in `useUIStore`, not by rendering its own instance.
- **Pages** are thin-to-medium compositions: `PageHeader` + feature components + local `useState` for filters/tabs. Section pages (`NodePage`) choose what to render via `sectionKind()` (`src/features/structure/section-kinds.ts`) and the node's `moduleKey` (Gym, Health, Thesis, Meetings, list templates, tasks).
- **Primitives** wrap Radix for behaviour/accessibility and add Tailwind styling (see DESIGN_SYSTEM.md).

---

## 6. State management

| Kind | Mechanism | Where |
|---|---|---|
| User data (tasks, sections, habits, notes, …) | IndexedDB via Dexie; read with `useLiveQuery` (auto re-render on any write) | `src/core/hooks.ts`, plus inline `useLiveQuery` in features |
| Per-device UI prefs + overlay flags | zustand `useUIStore` with `persist` to localStorage key `pos-ui` (only `sidebarCollapsed`, `sidebarWidth`, `expandedSections` persisted; overlay flags are transient) | `src/app/ui-store.ts` |
| Theme | zustand `useThemeStore` + localStorage `pos-theme` | `src/app/theme.ts` |
| Toasts | zustand `useToasts` | `src/app/toast.tsx` |
| Vault key | zustand `useVaultSession`, memory only (never persisted), dropped on lock/idle/reload | `src/core/crypto/session.ts`, `features/vault/VaultAutoLock.tsx` |
| Sync status / session | zustand `useSync` | `src/features/sync/SyncRunner.tsx` |
| Focus timer | running session stored in DB; `useRunningFocus` | `src/features/focus/FocusTimer.tsx` |
| Screen-local | `useState` / `useMemo` | pages |
| Profile settings (bottom tabs, week start, etc.) | `profile` table in Dexie | `useProfile()` |

Loading convention: live-query hooks return `undefined` while loading, `null` for "not found"; screens render `<Loading/>` (blank for 250ms, skeleton, then a reload prompt after 6s).

---

## 7. Data flow

**Read:** component → `useXxx()` hook (`core/hooks.ts`) → `useLiveQuery(() => db.table…)` → re-renders automatically whenever any write touches the queried tables (including writes from sync). Filtering is mostly in memory; soft-deleted rows (`deletedAt`) are filtered out.

**Write** (`src/core/repos/write.ts`, documented as the ONLY write path): component calls a repo function (e.g. `createTask`, `updateNode`) usually wrapped in `attempt()` (shows errors as a toast) → `insert` / `update` / `remove` → one Dexie transaction that:
1. writes the record with bookkeeping (`version`, `updatedAt`, `deviceId`, per-field change times `_ft` for field-level merge),
2. appends an immutable `activityLog` entry (before/after diff; feeds Analytics and Reviews),
3. appends an `outbox` entry (changed fields) for sync.

Live queries pick up the change, so there is no manual cache invalidation. Many destructive actions offer Undo through `toast(message, undo)`; deletes are soft (Trash, auto-purged after 30 days on startup).

**Sync** (`src/core/sync/engine.ts`, `SyncRunner.tsx`): only when signed in to Supabase (env `VITE_SUPABASE_URL` + publishable/anon key). Runs on start, on reconnect, every 60s and ~3s after edits (outbox count). Pull → per-field merge (`merge.ts`; long-text conflicts saved as a "Conflict copy" note) → push outbox. Server writes go straight into tables, bypassing the outbox.

**Encryption:** Vault items and private journal entries are encrypted client-side (`core/crypto/vault.ts`); the key exists only in `useVaultSession`.

---

## 8. Styling architecture

- Tailwind v4, configured in CSS (`src/index.css`): `@import 'tailwindcss'`, `@custom-variant dark (&:where(.dark, .dark *))`, `@theme inline` mapping CSS variables to Tailwind color/font names. No `tailwind.config.js`.
- Tokens are CSS variables on `:root` / `.dark`; components use semantic utilities (`bg-surface`, `text-muted`, `border-line`) so theme switching is pure CSS.
- Responsive density is done in class strings (`h-11 md:h-10`, `text-[15px] md:text-sm`), not with separate components.
- Class composition with `cn()` (clsx + tailwind-merge). Variants in plain objects (`VARIANTS`, `SIZES` in `ui.tsx`; `PALETTE` in `palette.ts`; `PRIORITY_STYLE` in `TaskBits.tsx`).
- Global CSS only for: tokens, motion keyframes/classes (`.anim-*`, keyed off Radix `data-state`), reduced-motion, TipTap content (`.pos-doc`), FullCalendar theme (`.pos-cal`, unlayered because FullCalendar injects unlayered CSS), and two phone media rules (calendar button sizes; 44px min height for `role=tablist/radiogroup` buttons).
- Prettier sorts Tailwind classes.

---

## 9. Theme management

- Options: `dark` (default), `light`, `system`. Stored in localStorage `pos-theme`.
- `public/theme-init.js` runs synchronously in `<head>` before the bundle, toggles `.dark` on `<html>`, sets `color-scheme` and the `theme-color` meta (`#131316` / `#f5f3ef`): no flash of wrong theme. `index.html` also ships with `class="dark"`.
- `src/app/theme.ts` mirrors that logic at runtime (`applyTheme`, `useThemeStore.setTheme`), and `useSystemThemeListener()` (called in AppShell) follows OS changes when set to `system`. The two files must be kept in sync manually.
- UI: theme segmented control in `SettingsPage.tsx` (~line 290).

---

## 10. Reusable components (inventory)

| Component | File | Notes |
|---|---|---|
| Button, Input, Textarea, Select, Field, EmptyState, Loading, ProgressBar | `src/components/ui.tsx` | Core primitives |
| Sheet, Confirm | `src/components/Sheet.tsx` | Radix Dialog / AlertDialog; responsive bottom sheet / dialog / side panel |
| Menu | `src/components/Menu.tsx` | Radix DropdownMenu |
| DatePicker | `src/components/DatePicker.tsx` | Radix Popover + quick picks + month grid |
| PageHeader, Card, MilestoneBadge | `src/components/PageHeader.tsx` | |
| NodeIcon | `src/lib/NodeIcon.tsx` | Section icon by name |
| Toaster / toast / attempt | `src/app/toast.tsx` | Undo-able toasts, error wrapper |
| TaskList, TaskRow, TaskComposer / NewTaskSheet, TaskEditor, TaskBits, SkipDialog | `src/features/tasks/` | Task UI used on Today, Tasks, Inbox, Section, Project pages; swipe actions on phone |
| TagPicker | `src/features/tags/TagPicker.tsx` | |
| SectionSelect | `src/features/plans/SectionSelect.tsx` | Section dropdown for goals/habits/projects |
| Heatmap | `src/features/analytics/Heatmap.tsx` | Div-based activity grid |
| DayCell | `src/features/habits/habit-ui.tsx` | Habit day toggle |
| TableView, BoardView, RecordSheet, FieldInput, ListSettings, ListsSection, SectionList | `src/features/collections/` | Typed custom lists ("collections") engine |
| RichEditor / PageEditor | `src/features/pages/PageEditor.tsx` | TipTap, lazy |
| EventSheet | `src/features/calendar/EventSheet.tsx` | Create/edit events |
| UnlockForm, AppLockGate | `src/features/vault/` | |
| CheckinCard | `src/features/life/Checkin.tsx` | Mood/energy/sleep/water/weight |

---

## 11. PWA architecture

- **Manifest** (generated by `vite-plugin-pwa` in `vite.config.ts`): name/short_name "Personal OS", `start_url: /home`, `scope: /`, `display: standalone`, `orientation: any`, background/theme `#131316`, categories productivity/lifestyle/health, icons 64/192/512 + maskable 512 (generated by `@vite-pwa/assets-generator`), apple-touch icon 180.
- **Share target:** `GET /share?title&text&url` → `src/features/share/SharePage.tsx` turns it into an Inbox task (`taskFromShare`), toasts with Undo, then `replace`-navigates to `/inbox` so reloads don't duplicate.
- **Service worker:** Workbox `generateSW`, `registerType: 'prompt'`, `injectRegister: false` (registered from React). Precaches `**/*.{js,css,html,svg,png,ico,woff2}` except non-Latin font subsets; `navigateFallback: /index.html`; `cleanupOutdatedCaches`. No runtime caching rules for APIs (Supabase/Crossref calls simply fail offline; data is local anyway).
- **Update prompt:** `src/app/UpdatePrompt.tsx` uses `useRegisterSW`; when a new SW is waiting it shows "A new version is ready. Reload / Later" and never reloads on its own; checks for updates hourly. "Offline ready" is intentionally not announced.
- **Offline:** the app is fully functional offline (all data in IndexedDB). An "Offline — everything still works on this device" pill shows when `navigator.onLine` is false (`useOnline`). Sync resumes on reconnect.
- **Install:** `src/app/pwa-install.ts` captures `beforeinstallprompt` (exposed in Settings / setup checklist).
- **Storage durability:** `navigator.storage.persist()` requested at startup (`src/core/storage.ts`); JSON backup/restore in `src/core/backup.ts`.
- **Notifications:** `src/features/reminders/Reminders.tsx` shows system notifications via `registration.showNotification` when permission is granted and the tab is hidden, otherwise in-app.

---

## 12. Responsive implementation

- Mobile-first Tailwind with `md` (768px) as the main switch; `lg` (1024px) only for the full sidebar; `sm` sporadically for grids.
- JS media queries via `useMediaQuery` (`src/app/use-media-query.ts`, `useSyncExternalStore`): Sidebar (`min-width: 1024px` → full vs icon rail), CalendarPage (`max-width: 767px` → phone calendar layout), HomePage (`min-width: 768px` → section map layout).
- Phone: BottomNav (3 user-selectable tabs + center "+" FAB + More), bottom sheets, 44px touch targets in primitives and via a global rule, larger type, `env(safe-area-inset-*)` padding, viewport `viewport-fit=cover, interactive-widget=resizes-content` (keyboard resizes layout), `-webkit-tap-highlight-color: transparent`, swipe actions on task rows.
- Tablet (768–1023): icon-rail sidebar, desktop dialogs.
- Desktop: resizable/collapsible sidebar, side-panel task editor, keyboard shortcuts (N, Ctrl/⌘K).

---

## 13. Testing

- **Unit/integration:** Vitest + jsdom + Testing Library; `fake-indexeddb` for Dexie; 23 `*.test.ts(x)` files in `src/` (schema/migrations, domain logic, repos, backup, AppShell).
- **E2E:** Playwright (`playwright.config.ts`), runs against the real production build (`npm run build && vite preview` on :4173, with production CSP headers, service worker and manifest). Two projects: `desktop` (Desktop Chrome) and `mobile` (Pixel 7). Specs in `tests/e2e/`: `m1…m6` milestone suites, `phone.spec.ts`, `shell.spec.ts`, shared `helpers.ts`.
- Lint (`eslint` with react-hooks rules), `tsc -b`, Prettier check; `npm run check` runs typecheck + lint + unit tests.

---

## 14. Screen → rendering files

| Screen | Route | Page file | Main feature files |
|---|---|---|---|
| Onboarding | `/welcome` | `src/pages/OnboardingPage.tsx` | `core/domain/templates.ts`, `core/repos/profile.ts` |
| App frame | (all) | `src/app/AppShell.tsx` | `Sidebar.tsx`, `BottomNav.tsx`, `CommandPalette.tsx`, `UpdatePrompt.tsx`, `toast.tsx`, `features/vault/AppLock.tsx` |
| Home (section map + check-in) | `/home` | `src/pages/HomePage.tsx` | `features/life/Checkin.tsx`, `features/structure/use-tree.ts` |
| Today | `/` | `src/pages/DashboardPage.tsx` | `features/dashboard/widgets.tsx`, `features/tasks/TaskList.tsx`, `TaskComposer.tsx`, `features/habits/HabitsToday.tsx`, `features/setup/SetupChecklist.tsx`, `features/analytics/ReviewNudge.tsx`, `features/messages/MotivationLine.tsx` |
| All Tasks | `/tasks` | `src/pages/TasksPage.tsx` | `features/tasks/TaskList.tsx`, `TaskRow.tsx`, `TaskComposer.tsx` |
| Inbox | `/inbox` | `src/pages/InboxPage.tsx` | `features/tasks/TaskList.tsx` |
| Task composer / editor (overlays) | global | — | `features/tasks/TaskComposer.tsx` (`NewTaskSheet`), `features/tasks/TaskEditor.tsx`, `components/Sheet.tsx`, `components/DatePicker.tsx`, `features/tags/TagPicker.tsx` |
| Projects / Project | `/projects`, `/projects/:id` | `src/pages/ProjectsPage.tsx`, `src/pages/ProjectPage.tsx` | `features/tasks/*`, `features/plans/SectionSelect.tsx` |
| Goals | `/goals` | `src/pages/GoalsPage.tsx` | `features/plans/SectionSelect.tsx`, `core/domain/progress.ts` |
| Habits | `/habits` | `src/pages/HabitsPage.tsx` | `features/habits/habit-ui.tsx`, `features/analytics/Heatmap.tsx` |
| Focus | `/focus` | `src/pages/FocusPage.tsx` | `features/focus/FocusTimer.tsx` |
| Calendar | `/calendar` (lazy) | `src/pages/CalendarPage.tsx` | FullCalendar, `features/calendar/EventSheet.tsx`, `.pos-cal` CSS in `index.css` |
| People | `/people` | `src/pages/PeoplePage.tsx` | creates/reuses a People collection and renders `src/pages/CollectionPage.tsx` |
| Reviews | `/reviews` | `src/pages/ReviewsPage.tsx` | `core/repos/reviews.ts`, `features/analytics/summary.ts` |
| Analytics | `/analytics` | `src/pages/AnalyticsPage.tsx` | `features/analytics/Heatmap.tsx`, `features/analytics/summary.ts`, `core/domain/analytics.ts` |
| Notes | `/notes`, `/notes/:id` | `src/pages/NotesPage.tsx` | `features/pages/PageEditor.tsx` (lazy `RichEditor`) |
| Journal | `/journal` | `src/pages/JournalPage.tsx` | `RichEditor` (lazy), `features/vault/Unlock.tsx` |
| Vault | `/vault` | `src/pages/VaultPage.tsx` | `features/vault/*`, `features/attachments/Attachments.tsx`, `core/crypto/*` |
| Section page | `/s/:nodeId` | `src/pages/NodePage.tsx` | `features/structure/section-kinds.ts`, `features/tasks/*`, `features/collections/ListsSection.tsx`, `SectionList.tsx`, `features/meetings/MeetingsSection.tsx`, `features/life/Gym.tsx`, `Health.tsx`, `ThesisSection.tsx`, `features/pages/PageEditor.tsx` (lazy) |
| Workout | `/workouts/:id` | `src/features/life/Workouts.tsx` (`WorkoutPage`) | `core/domain/fitness.ts` |
| List (collection) | `/lists/:collectionId` | `src/pages/CollectionPage.tsx` | `features/collections/views.tsx` (Table/Board), `RecordSheet.tsx`, `FieldInput.tsx`, `ListSettings.tsx` |
| Meeting | `/meetings/:id` | `src/pages/MeetingPage.tsx` | `features/meetings/ActionItems.tsx`, `RichEditor` (lazy) |
| Sections list / More (phone) | `/sections`, `/more` | `src/pages/ListPages.tsx` | `app/nav.ts` |
| Settings | `/settings` | `src/pages/SettingsPage.tsx` | `features/sync/AccountCard.tsx`, `app/theme.ts`, `core/backup.ts`, `app/BottomNav.tsx` (tab choices) |
| Manage sections / tags | `/settings/sections`, `/settings/tags` | `src/pages/StructurePage.tsx`, `src/pages/TagsPage.tsx` | `features/structure/NodeDialog.tsx` |
| Trash | `/trash` | `src/pages/TrashPage.tsx` | `core/repos/trash.ts` |
| Share target | `/share` | `src/features/share/SharePage.tsx` | `core/domain/share.ts` |
| Errors / 404 | — / `*` | `src/app/RouteError.tsx`, `ListPages.tsx` (`NotFoundPage`) | |
