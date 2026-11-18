# Personal OS: Design System (as built)

Written from the code as it is today, not from intent docs. File references are relative to the repo root. Class counts come from grepping `src/**/*.tsx`.

Design direction (from the comment in `src/index.css`): **graphite and paper**. Color carries meaning only: which area of life something belongs to (section colors), task priority, and danger. Primary actions use ink on paper (light) or paper on ink (dark), not a brand hue. Dark is the default theme.

---

## 1. Color

### 1.1 Core tokens (`src/index.css`)

CSS variables are set on `:root` (light) and `.dark`. They are exposed to Tailwind via `@theme inline` as `--color-*`, so the utilities are `bg-bg`, `bg-surface`, `bg-surface-2`, `border-line`, `text-fg`, `text-muted`, `bg-accent`, `text-accent-fg`, `text-danger` / `bg-danger`.

| Token (CSS var) | Tailwind name | Light | Dark | Role |
|---|---|---|---|---|
| `--bg` | `bg` | `#f5f3ef` | `#131316` | Page background (also `theme-color`, manifest bg) |
| `--surface` | `surface` | `#ffffff` | `#1a1a1e` | Cards, sidebar, bottom nav, sheets, menus |
| `--surface-2` | `surface-2` | `#eeebe5` | `#242429` | Hover fills, segmented-control track, skeletons, active nav item |
| `--line` | `line` | `#e2ded6` | `#2d2d33` | Borders, dividers |
| `--fg` | `fg` | `#1c1c20` | `#ece9e3` | Body text |
| `--muted` | `muted` | `#6b675e` | `#9c998f` | Secondary text, inactive icons |
| `--accent` | `accent` | `#1c1c20` | `#ece9e3` | Primary button fill, focus outline (same as fg) |
| `--accent-fg` | `accent-fg` | `#ffffff` | `#131316` | Text on accent |
| `--danger` | `danger` | `#c8372d` | `#ff6b5e` | Destructive actions, errors, calendar "now" line |

Other color treatments:
- Selection: `color-mix(in srgb, var(--fg) 22%, transparent)`.
- Overlay/scrim: `bg-black/55` (Sheet, Confirm, CommandPalette). No backdrop blur anywhere, deliberately (Android GPU issues, see comments in `Sheet.tsx`, `BottomNav.tsx`).
- Inverted surfaces: `bg-fg text-bg` for toasts, the update prompt, selected DatePicker day, selected chips (`Checkin.tsx`, `TaskComposer.tsx`).
- Opacity variants of tokens are common: `bg-surface-2/70` (segment tracks), `bg-surface-2/60` (hover), `text-muted/80` (placeholder), `bg-fg/80` (progress fill).

### 1.2 Section accent tokens (`src/index.css`)

| Token | Tailwind | Light | Dark |
|---|---|---|---|
| `--sec-work` | `sec-work` | `#4f5bd5` | `#93a4ff` |
| `--sec-self` | `sec-self` | `#0f8a5f` | `#5fd0a0` |
| `--sec-personal` | `sec-personal` | `#d6345a` | `#ff8c9e` |
| `--sec-misc` | `sec-misc` | `#b7791f` | `#f2c35e` |

In practice `sec-self` (green) is used as the app's generic **success / progress / "done"** color (heatmap, analytics bars, habit cells, focus timer, Gym/Health), in about 20 files. The other three are used rarely. Section color is **not** taken from these tokens; see 1.3.

### 1.3 User-pickable palette (`src/lib/palette.ts`)

Sections and tags store a color *name*. Each maps to literal Tailwind classes: `text` (600 in light / 400 in dark), `soft` (`bg-<c>-500/12`), `dot` (`bg-<c>-500`), `ring` (`ring-<c>-500`). Accessed with `colorFor(name)`; falls back to `slate`.

Names: `indigo, emerald, rose, amber, sky, violet, teal, orange, pink, slate` (slate text is 600 / 300).
These are Tailwind v4 default colors (defined in OKLCH; approximate 500 hex: indigo `#6366f1`, emerald `#10b981`, rose `#f43f5e`, amber `#f59e0b`, sky `#0ea5e9`, violet `#8b5cf6`, teal `#14b8a6`, orange `#f97316`, pink `#ec4899`, slate `#64748b`).

### 1.4 Priority colors (`src/features/tasks/TaskBits.tsx`)

`PRIORITY_STYLE`: P1 `red-500`, P2 `orange-500`, P3 `sky-500`, P4 `muted`. Raw Tailwind colors, no light/dark variants, not tokens.

### 1.5 Other hard-coded colors
- `text-amber-400` rating stars: `src/features/collections/FieldInput.tsx:118`.
- `text-emerald-600 dark:text-emerald-400` success text: `src/pages/SettingsPage.tsx:461,484,500,543`.
- `text-white` on `bg-danger` / colored fills: `ui.tsx:21`, `toast.tsx:61`, `NodeDialog.tsx:134`, `TaskBits.tsx:47`.

---

## 2. Typography

### 2.1 Families (self-hosted, verified)
Loaded in `src/main.tsx` from `@fontsource-variable/inter` and `@fontsource-variable/bricolage-grotesque/opsz.css` (woff2 bundled; Latin subsets precached by the service worker, others on demand; `vite.config.ts` `globIgnores`). No Google Fonts requests (CSP `font-src 'self' data:`).

| Token | Stack | Use |
|---|---|---|
| `--font-sans` / `font-sans` | `'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif` | Everything (set on `body`) |
| `--font-display` / `font-display` | `'Bricolage Grotesque Variable', 'Inter Variable', …` | Every `h1` automatically (base layer), `.font-display` class (5 uses), editor h1-h3, FullCalendar title |

`font-optical-sizing: auto` on display text. `antialiased` on body. `tabular-nums` is used widely for counts, times and stats.

### 2.2 Sizes in use (count of occurrences)

| Class | Count | px | Typical role |
|---|---|---|---|
| `text-xs` | 154 | 12 | Meta, hints, labels on desktop, chips |
| `text-sm` | 148 | 14 | Default body/UI text on desktop; section h2s |
| `md:text-sm` | 58 | | Paired with `text-[15px]` |
| `text-[15px]` | 55 | 15 | **Phone** body / row text and section h2s |
| `text-[13px]` | 31 | 13 | Phone small text (paired with `md:text-xs`) |
| `md:text-xs` | 22 | | |
| `text-base` | 11 | 16 | Inputs on phone (prevents iOS zoom), palette input |
| `text-[11px]` | 11 | 11 | Bottom-nav labels, badges, `kbd` |
| `text-lg` / `text-xl` / `text-2xl` | 7 / 6 / 6 | | Ad-hoc headings, stat values |
| `text-[17px]` | 2 | 17 | Sheet / Confirm title on phone |
| `text-[1.75rem]` → `md:text-[2rem]` | 4 | 28 → 32 | `PageHeader` h1 |
| `text-[2rem]` → `md:text-4xl` | | 32 → 36 | Section (Node) and List (Collection) titles |
| `text-[2.25rem]` → `md:text-5xl` | 2 | 36 → 48 | Today date / Home greeting |
| `text-[2.5rem]` → `md:text-5xl` | 1 | 40 → 48 | Onboarding |
| `text-[10px]` | 1 | | Analytics bar axis labels |

**Pattern:** the phone gets one step larger text, then `md:` steps down (`text-[15px] md:text-sm`, `text-[13px] md:text-xs`). This is applied consistently in the newer components and missing in older ones (see Inconsistencies).

### 2.3 Weights
`font-medium` (128), `font-semibold` (83), `font-normal` (3). No `font-bold` class (FullCalendar "today" number uses 700 in CSS). Headings use semibold with negative tracking: `tracking-[-0.025em]` (page titles), `tracking-[-0.03em]` (hero dates), `tracking-tight` (some).

### 2.4 Rich text (`.pos-doc .ProseMirror` in `src/index.css`)
15px / 1.65 line height. h1 1.75rem, h2 1.35rem, h3 1.1rem (display font, 600, -0.02em). Inline code and `pre` on `surface-2` with 0.3rem / 0.6rem radius. Task-list checkboxes use `accent-color: var(--fg)`.

---

## 3. Spacing and layout

Default Tailwind 4px scale; no custom spacing tokens. Most used: `gap-2` (106), `gap-3` (67), `gap-1` (50), `gap-1.5` (31), `px-3`/`px-4` (38/37), `py-2` (30), `p-4` (16), `p-3` (13).

Vertical rhythm between page blocks: `mb-3` (39, heading to content), `mb-8` (29), `mb-10` (18), `mb-6` (17, `PageHeader`). Analytics and Reviews use `mb-10` between sections, Dashboard/Node pages mostly `mb-8`.

App frame (`src/app/AppShell.tsx`): content column `max-w-5xl`, `px-4 md:px-8`, top `pt-[calc(1.25rem+env(safe-area-inset-top))] md:pt-8`, bottom padding `5rem + safe-area` on phone to clear the bottom nav. Safe-area insets are respected in AppShell, BottomNav, Sheet footer, UpdatePrompt.

---

## 4. Radius, borders, elevation

Radius counts: `rounded-full` 45, `rounded-xl` 42 (12px), `rounded-2xl` 34 (16px), `rounded-lg` 31 (8px), `rounded-md` 25 (6px), `rounded` 11, `rounded-3xl` 3 (sheet top on phone).

Intended scale, from primitives: **phone uses one radius step larger than desktop** (Button md `rounded-xl md:rounded-lg`, sm `rounded-lg md:rounded-md`, inputs `rounded-xl md:rounded-lg`, Card `rounded-2xl md:rounded-xl`). Dialogs `rounded-2xl`, phone bottom sheet `rounded-t-3xl`, menus `rounded-xl`, menu items `rounded-lg`, pills/chips/avatars `rounded-full`, heatmap cells `rounded-[2px]`, bars `rounded-t-[4px]`.

Borders: always `border border-line` (1px). Lists are `divide-y divide-line` inside a bordered rounded container.

Shadows are rare and reserved for floating layers: `shadow-2xl` (Sheet, Confirm), `shadow-xl` (Menu, update prompt), `shadow-lg shadow-black/30` (bottom-nav FAB), `shadow-sm` (6, small chips), plain `shadow` (offline pill). Cards are flat (border only).

---

## 5. Components

### 5.1 Button (`src/components/ui.tsx`)
Base: `inline-flex items-center justify-center font-medium whitespace-nowrap`, `transition-[background-color,opacity,transform] duration-150`, `active:scale-[0.97]`, disabled `opacity-50 pointer-events-none`. Default `variant="secondary"`, `size="md"`, `type="button"`.

| Variant | Classes |
|---|---|
| `primary` | `bg-accent text-accent-fg hover:opacity-90` |
| `secondary` | `border border-line bg-surface text-fg hover:bg-surface-2` |
| `ghost` | `text-muted hover:bg-surface-2 hover:text-fg` |
| `danger` | `bg-danger text-white hover:opacity-90` |

| Size | Phone | Desktop (`md:`) |
|---|---|---|
| `sm` | h-9 (36), px-3, 13px, rounded-lg | h-8 (32), px-2.5, 12px, rounded-md |
| `md` | h-11 (44), px-4, 15px, rounded-xl | h-10 (40), 14px, rounded-lg |
| `icon` | 44×44, rounded-xl | 40×40, rounded-lg |
| `icon-sm` | 40×40, rounded-lg | 32×32, rounded-md |

### 5.2 Form fields (`ui.tsx`)
Shared `field` class: `w-full rounded-xl border border-line bg-surface px-3 text-base text-fg placeholder:text-muted/80 focus:border-fg/40 focus:outline-none md:rounded-lg md:text-sm`. `Input`/`Select` h-11 → h-10, `Textarea` `min-h-24 py-2.5 leading-relaxed`. `Select` is the native `<select>`. Focus on fields is a border darkening (not the global outline ring). `Field` = label (`text-[13px] md:text-xs font-medium text-muted`) + control + hint (`text-xs text-muted`), `space-y-1.5`.

### 5.3 Other primitives
- **Card** (`src/components/PageHeader.tsx`): `rounded-2xl md:rounded-xl border border-line bg-surface p-4`. Only used by `SettingsPage` (9) and `PlaceholderPage` (1); everywhere else cards are hand-rolled (see Inconsistencies).
- **PageHeader**: optional Lucide icon (`size-6 md:size-7`, section color or muted) + h1 (28→32px) + subtitle (15→14px muted) + actions slot; `mb-6`.
- **EmptyState**: centered, 44px round `surface-2` icon well with `size-5` muted icon, title 15/14 medium, body `text-sm muted max-w-xs`, optional action; `py-14` (`py-8` compact).
- **Loading**: invisible for 250ms, then 3 pulsing `surface-2` skeleton bars; after 6s an EmptyState with Reload.
- **ProgressBar**: `h-1.5 rounded-full bg-surface-2`, fill `bg-fg/80`, width transition 500ms, `role="progressbar"`.
- **MilestoneBadge**: bordered pill, 11px.
- **Sheet** (`src/components/Sheet.tsx`, Radix Dialog): phone = bottom sheet (`rounded-t-3xl`, max 92dvh, grab handle); desktop `variant="center"` = dialog at 14vh, `max-w-lg`, `rounded-2xl`; `variant="side"` = right panel `max-w-xl` (task editor). Header title 17→16px semibold + ghost `icon-sm` close. Optional sticky footer with top border.
- **Confirm** (Radix AlertDialog): centered `max-w-md rounded-2xl p-5`, Cancel (secondary) + primary/danger action.
- **Menu** (Radix DropdownMenu, non-modal): `min-w-48 rounded-xl border p-1 shadow-xl`; items `rounded-lg px-2.5 py-2 text-sm`, highlight `bg-surface-2`, danger items `text-danger`, `size-4` icons.
- **DatePicker** (Radix Popover): quick picks (Today, Tomorrow, This weekend, Next week) + month grid; selected day `bg-fg text-bg`.
- **Toast** (`src/app/toast.tsx`, zustand): max 2 visible, inverted (`bg-fg text-bg`) or `bg-danger text-white`, optional Undo, 4s (6s with undo).
- **Update prompt / offline pill** (`src/app/UpdatePrompt.tsx`): inverted rounded-2xl bar above the bottom nav; offline is a bordered muted pill.

### 5.4 Cards and widgets (as actually styled)
Common recipe: `border border-line rounded-2xl` (or `rounded-xl`) + `px-4 py-3` / `p-4`, often on `bg` rather than `bg-surface`. Lists: `ul.border-line.divide-line.divide-y.rounded-2xl.border` (`widgets.tsx:159,249`). Analytics stat tile: `rounded-2xl border px-4 py-3`, label `text-xs muted`, value `text-2xl font-semibold tabular-nums` (`AnalyticsPage.tsx:322`).

### 5.5 Segmented controls and chips
No shared component. Common recipe: track `bg-surface-2/70 inline-grid grid-cols-N gap-1 rounded-lg p-1`, buttons `role="tab"`; selected state usually `bg-surface text-fg shadow-sm`. A global rule in `index.css` forces `[role=tablist] > button, [role=radiogroup] > button` to min 44px tall below 768px. Chip/pill radios: `h-8 rounded-full border px-3 text-xs`, selected `bg-fg text-bg`.

### 5.6 Navigation
- **Sidebar** (`src/app/Sidebar.tsx`, ≥768px): `bg-surface border-r`, sticky full height. Icon rail (`w-16`) on 768–1023px; at ≥1024px user can collapse it or drag width (200–420px, default 256, persisted). Items `min-h-9 rounded-lg px-2.5 text-sm gap-3`, icons 18px; active `bg-surface-2 font-medium text-fg`, idle `text-muted hover:bg-surface-2/60`. Sections are a nested tree (indent 14px per depth) with section-colored icons; count badges `text-xs muted tabular-nums`. Primary "New task" button `bg-accent h-9 rounded-lg`.
- **BottomNav** (`src/app/BottomNav.tsx`, <768px): fixed, solid `bg-surface border-t`, `h-16`, `max-w-lg` centered. 2 tabs + center FAB (48px round `bg-accent`, `+` icon) + 1 tab + More. The 3 tabs are user-choosable (Settings). Labels 11px medium; icons 22px, `strokeWidth` 2.25 active / 1.75 idle; active = `text-fg`, idle = `text-muted` (no pill/indicator).
- **CommandPalette** (`src/app/CommandPalette.tsx`): Ctrl/⌘K, search row `h-14 text-base`, Esc `kbd`.

---

## 6. Iconography

`lucide-react` (^1.74.0) only. Section icons come from a curated name→component map in `src/lib/icons.ts` (rendered by `NodeIcon`). Default stroke width (2) except the nav (1.75/2.25) and a few emphasised glyphs (`strokeWidth` 2.5 ×4, 3 ×7).

Sizes in use: `size-4` (139, the default inline/button icon), `size-3.5` (43, small buttons, chips), `size-5` (29, empty states, larger buttons), `size-3` (20, breadcrumbs, tiny meta), `size-[18px]` (9, sidebar, sheet close), `size-[22px]` (bottom nav), `size-6`/`size-7` (page header).

---

## 7. Charts and data visualization

**No chart library is installed.** `build.md` §5 lists Apache ECharts (`echarts-for-react`), but it is not in `package.json` and not imported anywhere. All visualisation is hand-built with divs and Tailwind:
- **Heatmap** (`src/features/analytics/Heatmap.tsx`): GitHub-style week columns, CSS grid `gap-[2px]`, square cells `max-h-3 rounded-[2px]`, 5 levels `surface-2` → `sec-self/30` → `/55` → `/80` → `sec-self`; `binary` mode for habits. Native `title` tooltips; whole grid is `role="img"` with an aria-label total. Legend "Less … More" in `text-xs muted`. Used in Analytics and Habits.
- **Bar chart** (`AnalyticsPage.tsx` ~line 330): `h-36` flex row of bars, `bg-sec-self`, `rounded-t-[4px]`, hover opacity 80, axis labels `text-[10px] tabular-nums`, "Highest: N" caption.
- **Tables**: section breakdown `table.w-full.text-sm`, header `text-xs muted border-b`, right-aligned `tabular-nums` numbers.
- **Progress**: `ProgressBar` for goals/projects/habit consistency.
- **Calendar**: FullCalendar 6 (daygrid, timegrid, interaction) themed purely through CSS variables in `index.css` (`.pos-cal .fc` overrides: borders `line`, today 5% fg tint, now-indicator `danger`, buttons 0.5rem radius 13px, active button `fg`, events 0.375rem radius, done tasks 55% opacity + strikethrough; phone 44px buttons, smaller title).

---

## 8. Breakpoints

Tailwind defaults. Usage: `md:` 238, `sm:` 25, `max-md:` 11, `lg:` 4. No custom breakpoints.

| Width | Behaviour |
|---|---|
| < 768px (phone) | Bottom nav, bottom sheets, 44px targets, larger text/radii, global segmented-control 44px rule, phone calendar view (`CalendarPage.tsx` `useMediaQuery('(max-width: 767px)')`) |
| ≥ 768px (`md`) | Sidebar appears (icon rail), dialogs/side panels, denser controls; Home map view (`HomePage.tsx`) |
| ≥ 1024px (`lg`) | Full sidebar (collapsible/resizable) via `useMediaQuery('(min-width: 1024px)')` |

`md` is the real phone/desktop switch; `sm:` is used sporadically for grid columns (EventSheet, Settings, Meeting, Project pages).

---

## 9. Motion

Defined in `src/index.css`. Principle (comment): motion only answers an action; exits faster than entrances. Easing token `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`.

| Class | Keyframe | Duration / easing | Used for |
|---|---|---|---|
| `.anim-overlay` | `pos-fade-in` / `pos-fade-out` | 200ms ease-out / 150ms ease-in | Scrims (keyed on Radix `data-state`) |
| `.anim-sheet` | `pos-sheet-up` / `pos-sheet-down` | 340ms expo / 180ms | Phone bottom sheet |
| `.anim-sheet.sheet-center` (md+) | `pos-settle` / `pos-unsettle` (scale .97, fade) | 220ms / 120ms | Desktop dialog |
| `.anim-sheet.sheet-side` (md+) | `pos-slide-in-right` / out | 320ms / 180ms | Task editor panel |
| `.anim-pop` | settle / unsettle | 220ms / 120ms | Confirm |
| `.anim-check` | `pos-check` (0.7 → 1.12 → 1) | 260ms | Task checkbox |
| `.anim-rise` | `pos-rise` (6px up + fade) | 240ms | Update prompt, inline reveals |

Plus Tailwind `transition`/`transition-colors` (≈30 uses), `duration-150` on buttons, `active:scale-[0.97]` on Button and `active:scale-95` on the FAB, `animate-pulse` skeletons. `prefers-reduced-motion: reduce` collapses all animation and transition durations to 0.01ms globally.

Focus: global `:focus-visible` = 2px `accent` outline, 2px offset (fields override with border color).

---

## 10. Inconsistencies found (not fixed)

1. **Segmented controls are hand-rolled 6+ times with different sizes.**
   - `src/features/tasks/TaskList.tsx:112-118`: track `rounded-xl md:rounded-lg`, buttons `h-9 md:h-7 text-[13px] md:text-xs rounded-lg md:rounded-md`.
   - `src/pages/TasksPage.tsx:106-110`: buttons `h-8 md:h-7 text-[13px]` (h-8 on phone, unlike the others).
   - `src/pages/AnalyticsPage.tsx:133-147` and `src/pages/ReviewsPage.tsx:86-90`: buttons `h-9 md:h-7 text-sm md:text-xs rounded-md`.
   - `src/pages/CollectionPage.tsx:184-200`: same track, icon+label buttons.
   - `src/pages/SettingsPage.tsx:290-300` (theme switch): different recipe entirely: `border border-line bg-surface-2 p-0.5`, buttons `px-3 py-1.5 text-sm`, no fixed height.
   - `src/features/tasks/TaskEditor.tsx:295` priority: bordered `h-11 md:h-9 rounded-xl md:rounded-lg` tiles.
   - Pill radios: `JournalPage.tsx:118` and `Checkin.tsx:29` use `h-8 text-xs rounded-full`; `FocusPage.tsx:100` uses `h-10 text-sm rounded-full`.
   The global CSS rule (`index.css`, min-height 44px on phone for `role=tablist/radiogroup > button`) silently overrides the declared `h-8`/`h-9` on phones, so declared and rendered heights differ.
2. **Many raw `<button>` elements instead of `Button`.** 80+ raw buttons across 40+ files; heaviest: `Sidebar.tsx` (10), `DatePicker.tsx` (6), `TaskComposer.tsx` (5), `AnalyticsPage.tsx` (4), `NodeDialog.tsx` (4). Examples that duplicate Button variants by hand: Sidebar "New task" (`Sidebar.tsx:294`, `bg-accent h-9 rounded-lg`), composer submit (`TaskComposer.tsx:294`, `bg-accent size-11`), update prompt Reload/Later (`UpdatePrompt.tsx`, `h-10 md:h-8 rounded-xl`), `Reminders.tsx:209` (`rounded-lg p-1`, below 44px target).
3. **`Card` primitive barely used.** Only `SettingsPage` and `PlaceholderPage` use `<Card>`. ~38 other places hand-roll bordered containers with mixed radii: `rounded-xl` (`GoalsPage.tsx:176,216,318,455`, `HabitsPage.tsx:272,326,464`, `ProjectsPage.tsx:116,169`) vs `rounded-2xl` (`widgets.tsx:159,249,297`, `AnalyticsPage.tsx:322`, `DashboardPage.tsx:132`, `HomePage.tsx:129`); and mixed fills (`bg-surface` vs page `bg`), padding (`p-3`, `p-4`, `px-4 py-3`).
4. **Heading scale is ad hoc.** Page titles: `PageHeader` 28→32px; NodePage/CollectionPage 32→36px (`NodePage.tsx:134`, `CollectionPage.tsx:125`); Today/Home 36→48px (`DashboardPage.tsx:117`, `HomePage.tsx:86`); Onboarding 40→48px; Gym hero 28px fixed (`Gym.tsx:69,110`); `AppLock.tsx:71` `text-xl`; `ListPages.tsx:148` and `JournalPage.tsx:113` `text-2xl`; `VaultPage.tsx:128` `text-lg`; `Health.tsx:399` `text-xl font-display`. Section h2s are split between `text-[15px] md:text-sm` (Dashboard, Home, Node, Gym, Health, Workouts…) and a flat `text-sm` (Analytics, Focus, Meeting, Project, Reviews, `HabitsToday.tsx:29`). Group labels use yet another style (`text-[13px] font-medium text-muted` in `ListPages.tsx:121,133`, `SettingsPage.tsx:141`).
5. **Phone/desktop type pairing applied unevenly.** Primitives use `text-[15px] md:text-sm`; older screens use flat `text-sm` or `text-xs` on phone (Analytics, Reviews, Meeting, Project section headers; segmented controls in Analytics/Reviews use `text-sm`, TaskList/Tasks use `text-[13px]`).
6. **Two color systems for "section".** `--sec-*` tokens (index.css) exist for work/self/personal/misc but sections actually use the `palette.ts` Tailwind colors; `sec-self` is repurposed as a generic success/green. Priority colors (`TaskBits.tsx:7-10`) and success text (`SettingsPage.tsx:461,484,500,543`, raw `emerald`) and stars (`FieldInput.tsx:118`, `amber-400`) bypass tokens.
7. **Two primary-fill recipes.** `bg-accent text-accent-fg` (Button primary, FAB, Sidebar) vs `bg-fg text-bg` (toasts, update prompt, selected chips, DatePicker). Visually identical today because accent = fg, but they would diverge if accent ever became a hue.
8. **Mixed radius steps for the same control size.** Desktop Button sm is `rounded-md`, but segment buttons in TaskList use `rounded-lg` on phone and `md:rounded-md`, while Analytics/Reviews use `rounded-md` on both. Plain `rounded` (4px) appears 11 times alongside the scale.
9. **Breakpoint `sm:` used sporadically** (25 uses) for layout grids in a system where `md` is the only meaningful switch; some grids jump at 640px, others at 768px.
10. **Small touch targets outside the global rule.** Icon-only raw buttons with `p-1` (e.g. `Reminders.tsx:209`, rating stars `FieldInput.tsx:107` `rounded-md p-1`) are under 44px on phone; the global 44px rule only covers buttons that are direct children of `role=tablist/radiogroup` (the stars are, the reminder close is not).
