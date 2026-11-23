# Design system: Timetable

This is the visual foundation of Personal OS, from Phase 2 of the redesign. The source of truth is the code:

- **Tokens:** `src/index.css`
- **Components:** `src/components/ui.tsx`, `PageHeader.tsx`, `Sheet.tsx`, `Menu.tsx` and `DatePicker.tsx`, plus `src/app/toast.tsx`
- **Live reference:** in development, open **`/dev/design`** to see every token and component in the current theme, with a Dark/Light/System switch. It is not built into production.

**The idea:** a course timetable and an attendance register. It is a ruled sheet in ink with an ink-blue shell:

- rank comes from weight and rules, not size
- tables are the only boxes
- colour means area
- done is an ink tick

The direction contract is in `.impeccable/surfaces/src-app-appshell-tsx.md`.

## 1. Colour

All colours are CSS variables, with Tailwind names (`bg-surface`, `text-muted`, `border-line-strong`, …).

**Dark is the default theme.** The setting offers Dark / Light / System, and `public/theme-init.js` applies it before the first paint.

**Grounds and text:**

| Token                  | Light                   | Dark                    | Role                                                   |
| ---------------------- | ----------------------- | ----------------------- | ------------------------------------------------------ |
| `bg`                   | `#f3f5f7`               | `#0f151c`               | Page ground (a cool sheet, not cream)                  |
| `surface`              | `#ffffff`               | `#151d26`               | Tables, panels, inputs                                 |
| `surface-2`            | `#e8ecf0`               | `#1c2631`               | Sunken tracks (Segmented), hover, skeletons            |
| `surface-3`            | `#ffffff`               | `#1f2a36`               | Elevated: menus, sheets, dialogs, the palette          |
| `line`                 | `#d5dbe2`               | `#263241`               | Hairlines between rows                                 |
| `line-strong`          | `#7b8796`               | `#66778b`               | Under block heads, around inputs and secondary buttons |
| `fg`                   | `#17202b`               | `#e3e8ee`               | Primary text; also the H1 rule and done ticks          |
| `fg-2`                 | `#364250`               | `#c2cbd6`               | Secondary text                                         |
| `muted`                | `#596574` (5.4:1 on bg) | `#8f9bab` (6.5:1 on bg) | Meta text, labels, placeholders                        |
| `accent` / `accent-fg` | ink / white             | light ink / night       | The primary action (ink, not a brand hue)              |
| `focus`                | `#3b4fc8`               | `#8c9bff`               | Focus rings, focused input borders, text selection     |

**Shell:**

| Token                      | Light                 | Dark                  | Role                                            |
| -------------------------- | --------------------- | --------------------- | ----------------------------------------------- |
| `shell` / `shell-2`        | `#1b2735` / `#2b3b4e` | `#0a0f15` / `#1a2531` | Sidebar and phone tab bar; the hover/active row |
| `shell-fg` / `shell-muted` | `#dce3eb` / `#8b99aa` | `#c8d1dc` / `#7d8b9d` | Shell text                                      |

**Status** is always paired with a mark or a word, never colour alone:

| Token                  | Light             | Dark              | Role                                       |
| ---------------------- | ----------------- | ----------------- | ------------------------------------------ |
| `danger` / `danger-fg` | `#c4401a` / white | `#ff7a52` / night | Overdue, missed, destructive, the now-line |
| `warning`              | `#b45309`         | `#f59f4b`         | Needs a look; why Save is off              |
| `success`              | `#0b7285`         | `#3bc9db`         | Saved, on time, synced                     |
| `info`                 | `#4f6178`         | `#9aabc0`         | Neutral notices                            |

**Area colours:**

| Token          | Light     | Dark      | Area             |
| -------------- | --------- | --------- | ---------------- |
| `sec-work`     | `#3b4fc8` | `#8c9bff` | Work             |
| `sec-self`     | `#1d8556` | `#57c792` | Self-Improvement |
| `sec-personal` | `#b3367a` | `#f07fb5` | Personal Life    |
| `sec-misc`     | `#a26b0a` | `#e3b04b` | Miscellaneous    |

**Rules:**

- **Area colour marks area only.** Use it for period rules, square chips and area heads. It must never mean status.
- **Status colours are cyan, orange and vermilion** so they never collide with an area hue.
- **Done is ink.** A tick, never a green fill.
- **User-chosen section and tag colours** (`src/lib/palette.ts`) are the user's own data and stay as they are.

**Primary and secondary palettes.**

- The primary palette is ink on the sheet, plus the ink-blue shell.
- The secondary palette is the four area colours.
- There is no brand accent hue: the product's colour is your life's areas.

## 2. Typography

- **Family:** Public Sans Variable (`@fontsource-variable/public-sans`), self-hosted, one family. `--font-display` points to the same face for older call sites.
- **Figures:** tabular everywhere (`font-variant-numeric: tabular-nums` on `body`), so times and counts line up.

| Role             | Utility                                                    | Phone  | Desktop | Weight  | Line height |
| ---------------- | ---------------------------------------------------------- | ------ | ------- | ------- | ----------- |
| Page title (H1)  | `title-page` (in `PageHeader`, over a 2px ink rule)        | 22px   | 21px    | 700     | 1.2         |
| Block title (H2) | `title-block` (in `BlockHeader`, over the strong hairline) | 15px   | 14px    | 700     | 1.4         |
| Body             | `text-[15px] md:text-sm`                                   | 15px   | 14px    | 400–500 | 1.45        |
| Meta             | `text-meta`                                                | 13px   | 12.5px  | 400     | 1.4         |
| Badge            | inside `Badge`                                             | 11.5px | 11.5px  | 600     | n/a         |

- **Rank** comes from weight (700, 600, 500) and from rules. There is no third title size and no display face.
- **Long prose** (Journal, Notes, pages) uses the `.pos-doc` styles: 15px at 1.65 line height.

## 3. Spacing

Tailwind's 4px scale. The rhythm used throughout:

| Step      | px    | Use                                             |
| --------- | ----- | ----------------------------------------------- |
| `1`–`1.5` | 4–6   | Icon to label; inside badges                    |
| `2`–`3`   | 8–12  | Inside rows; control gaps                       |
| `4`       | 16    | Panel padding; phone page gutter                |
| `6`       | 24    | Between blocks; below the page header           |
| `8`–`10`  | 32–40 | Between major sections; the desktop page gutter |

There is more space above a block head than below it: the head sits 8px above its rows.

## 4. Radius

The Tailwind radius tokens are redefined, so every existing `rounded-*` class follows them. Phase 2 did not edit the classes themselves.

| Token                        | Value  | Typical use                                                       |
| ---------------------------- | ------ | ----------------------------------------------------------------- |
| `rounded-xs`                 | 2px    | Progress bars                                                     |
| `rounded-sm`                 | 3px    | Badges, menu items, checks                                        |
| `rounded-md` / `-lg` / `-xl` | 4px    | Buttons, inputs, Segmented, cells                                 |
| `rounded-2xl`                | 6px    | Panels (`Card`), toasts, dialogs                                  |
| `rounded-3xl`                | 8px    | Bottom-sheet tops on phones                                       |
| `rounded-full`               | circle | Avatars, the "due" ring, dots that mean a person or point in time |

## 5. Shadows and elevation

There are three levels. Depth always has an offset and a blur; there are no glows and no hard offset shadows.

| Level             | Surface                  | Shadow                                              |
| ----------------- | ------------------------ | --------------------------------------------------- |
| 0 Sheet           | `bg` / `surface`         | none; separated by rules                            |
| 1 Raised in place | Segmented "on" key       | `shadow-xs` plus a 1px `line-strong` ring           |
| 2 Floating        | menus, popovers, toasts  | `surface-3` + `shadow-xl`                           |
| 3 Modal           | sheets, dialogs, palette | `surface-3` + `shadow-2xl`, over a `black/50` scrim |

There is no backdrop blur (Android GPU cost; product constraint).

## 6. Layout widths

| Constant       | Value                                          | Where                                  |
| -------------- | ---------------------------------------------- | -------------------------------------- |
| Sidebar        | 236–256px (expanded), icon rail when collapsed | `Sidebar.tsx`                          |
| Reading pages  | max 1024px, centred                            | Today, Home, Habits, sections          |
| Wide pages     | full width                                     | Calendar, tables and boards, Analytics |
| Text measure   | ≤ 75ch                                         | Journal, Notes, pages                  |
| Phone gutter   | 16px                                           | All pages                              |
| Desktop gutter | 32–40px                                        | All pages                              |

## 7. Icons

- **Library:** lucide-react, stroke 1.75 (the default).
- **Sizes:** 18px in navigation and buttons (`size-[18px]` / `size-4.5`), 16px in rows and inputs (`size-4`), 14px in meta lines (`size-3.5`), 20px in page titles and empty states (`size-5`).
- Icons sit in the text colour of their row and are never coloured for decoration. An area or section icon may take its area colour.
- Every icon-only button has an `aria-label`.

## 8. Motion

Motion answers an action and nothing else. These are defined in `src/index.css`:

| Moment                                           | Animation       | Duration                               |
| ------------------------------------------------ | --------------- | -------------------------------------- |
| Sheet rises (phone), side panel slides (desktop) | `anim-sheet`    | 320–340ms in, 180ms out, ease-out-expo |
| Dialog or menu settles                           | `anim-pop`      | 220ms in, 120ms out                    |
| Scrim                                            | `anim-overlay`  | 200 / 150ms                            |
| Task check                                       | `anim-check`    | 260ms                                  |
| Toast                                            | `anim-rise`     | 240ms                                  |
| Hover, press, colour                             | CSS transitions | 150ms                                  |

- Exits are faster than entrances.
- `prefers-reduced-motion` reduces every animation and transition to nearly zero.
- There are no page-load sequences and no scroll-triggered effects.

## 9. Focus and browser surfaces

- **Focus:** a 2px `focus` outline with a 2px offset on every focusable element (`:focus-visible`). Inputs add a 1px focus ring on top of their border.
- **Selection:** `focus` at 28%.
- **Scrollbars:** thin, `muted` at 45%.
- **Browser theme colour:** follows the shell (`#0a0f15` dark, `#1b2735` light), set in `index.html`, `theme.ts`, `theme-init.js` and the manifest.

## 10. Checks done (Phase 2)

- **Contrast** (computed): body and muted text ≥ 5.4:1 in both themes. `danger-fg` on `danger` is 5.1:1 (light) and 7.1:1 (dark); status colours on `bg` are ≥ 4.6:1; shell text ≥ 5.2:1. Area colours on `bg` are ≥ 4.1:1, used only for non-text marks and rules (3:1 target).
- **Rendered** at `/dev/design` in dark and light at 1440×900: buttons in all variants and sizes, inputs including invalid, Segmented, the date picker, badges, status marks, progress, panel, sheet, confirm, toast with undo, menu, empty state and skeleton.
- **Tests:** `npm run typecheck`, `npm run lint` and `npm test` pass (see the Phase 2 commit).
