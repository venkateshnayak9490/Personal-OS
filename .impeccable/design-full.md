---
name: Personal OS
description: Life set as a course timetable and attendance register, a ruled sheet in ink with an ink-blue shell.
colors:
  ink: '#17202b'
  ink-2: '#364250'
  muted-slate: '#596574'
  sheet: '#f3f5f7'
  surface: '#ffffff'
  surface-sunken: '#e8ecf0'
  surface-raised: '#ffffff'
  hairline: '#d5dbe2'
  rule-strong: '#7b8796'
  accent: '#17202b'
  accent-fg: '#ffffff'
  focus-blue: '#3b4fc8'
  shell: '#1b2735'
  shell-2: '#2b3b4e'
  shell-fg: '#dce3eb'
  shell-muted: '#8b99aa'
  vermilion: '#c4401a'
  vermilion-fg: '#ffffff'
  warning-amber: '#b45309'
  success-teal: '#0b7285'
  info-slate: '#4f6178'
  area-work: '#3b4fc8'
  area-self: '#1d8556'
  area-personal: '#b3367a'
  area-misc: '#a26b0a'
  night-ink: '#e3e8ee'
  night-ink-2: '#c2cbd6'
  night-muted: '#8f9bab'
  night-ground: '#0f151c'
  night-surface: '#151d26'
  night-surface-sunken: '#1c2631'
  night-surface-raised: '#1f2a36'
  night-hairline: '#263241'
  night-rule-strong: '#66778b'
  night-accent: '#e3e8ee'
  night-accent-fg: '#0f151c'
  night-focus: '#8c9bff'
  night-shell: '#0a0f15'
  night-shell-2: '#1a2531'
  night-shell-fg: '#c8d1dc'
  night-shell-muted: '#7d8b9d'
  night-vermilion: '#ff7a52'
  night-vermilion-fg: '#0f151c'
  night-warning: '#f59f4b'
  night-success: '#3bc9db'
  night-info: '#9aabc0'
  night-area-work: '#8c9bff'
  night-area-self: '#57c792'
  night-area-personal: '#f07fb5'
  night-area-misc: '#e3b04b'
typography:
  headline:
    fontFamily: 'Public Sans Variable, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif'
    fontSize: '1.3125rem'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '-0.01em'
    fontFeature: 'tnum'
  title:
    fontFamily: 'Public Sans Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 700
    lineHeight: 1.4
    fontFeature: 'tnum'
  body:
    fontFamily: 'Public Sans Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: 'tnum'
  meta:
    fontFamily: 'Public Sans Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '12.5px'
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: 'tnum'
  label:
    fontFamily: 'Public Sans Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '11.5px'
    fontWeight: 600
    lineHeight: 1
  prose:
    fontFamily: 'Public Sans Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.65
rounded:
  xs: '2px'
  sm: '3px'
  md: '4px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-fg}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '0 16px'
    height: '40px'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: '0 16px'
    height: '40px'
  button-secondary-hover:
    backgroundColor: '{colors.surface-sunken}'
  button-ghost:
    textColor: '{colors.muted-slate}'
    rounded: '{rounded.md}'
    padding: '0 10px'
    height: '32px'
  button-ghost-hover:
    backgroundColor: '{colors.surface-sunken}'
    textColor: '{colors.ink}'
  button-danger:
    backgroundColor: '{colors.vermilion}'
    textColor: '{colors.vermilion-fg}'
    rounded: '{rounded.md}'
    padding: '0 16px'
    height: '40px'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: '0 12px'
    height: '40px'
  badge:
    textColor: '{colors.muted-slate}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    padding: '0 6px'
    height: '20px'
  segmented-track:
    backgroundColor: '{colors.surface-sunken}'
    rounded: '{rounded.md}'
    padding: '2px'
  segmented-on:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    height: '28px'
  nav-item:
    textColor: '{colors.shell-fg}'
    rounded: '{rounded.md}'
    padding: '0 10px'
    height: '32px'
  nav-item-active:
    backgroundColor: '{colors.shell-2}'
    textColor: '{colors.surface}'
  panel:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.md}'
    padding: '16px'
  sheet:
    backgroundColor: '{colors.surface-raised}'
    rounded: '{rounded.md}'
    padding: '20px'
  time-cell:
    textColor: '{colors.ink}'
    typography: '{typography.meta}'
    width: '64px'
---

# Design System: Personal OS

## Overview

**Creative North Star: "The Course Timetable"**

Personal OS is set as a university course timetable and attendance register. The page is a cool ruled sheet in ink; the shell around it (sidebar on desktop, tab bar on the phone) is a solid ink-blue binding. Every item has a period and an area code: each task row opens with its own time column ruled in its area colour, the day's periods sit on a time axis, and habits sit in a register where each day is marked rather than filled. Rank comes from weight and rules, not from size or colour, so long daily sessions stay calm and the owner's own areas carry what colour there is.

Density is that of a working document: body text at 14px on desktop (15px on the phone), rows separated by hairlines, block heads over a stronger rule, and the page title and day heads over a 2px ink rule. Bordered panels hold only a single object or a table (the schedule axis, the check-in, a form, the section map, the register); prompts and nudges are ruled blocks, not boxes. Both a dark night theme and a light sheet ship, with dark as the default. The world replaced the earlier graphite card dashboard and refuses it: no stacked cards, no brand accent hue, no glows.

Motion only answers an action, exits are faster than entrances, and reduced motion is honoured. There is no backdrop blur anywhere.

**Key Characteristics:**

- A ruled sheet in ink with an ink-blue shell
- Rules instead of cards; panels only for one object or a table
- One family (Public Sans) with tabular figures everywhere
- Every task row has a time column, ruled in its area colour
- Colour means life area; status is a mark or a word first
- Done is an ink tick, never a green fill
- Near-square corners: 4px everywhere, 2px and 3px only on small marks
- Phone targets of at least 44px; denser pointer sizes from 768px

## Colors

Ink on a cool sheet, an ink-blue shell, four area colours that only ever name a part of life, and a small status set chosen so it never collides with an area hue. Dark (the default) and light both ship; every role has a night counterpart in the frontmatter.

### Primary

- **Ink** (`ink`): primary text, the 2px rule under every page title, day head and table head, done ticks, progress fills, and the primary button. The primary action is ink, not a brand hue.
- **Ink-Blue Shell** (`shell`, with `shell-2` for the lit row): the sidebar and the phone tab bar. The New task button sits on it in reversed light ink (`shell-fg` ground, `shell` text).

### Secondary

- **Area colours** (`area-work` indigo, `area-self` green, `area-personal` magenta, `area-misc` ochre): which part of life something belongs to. They appear as 8px square chips (sidebar sections, habit rows, period blocks, section labels in task meta), as thin rules (the right rule of a task's time column, a short period's tick, the rule under a section-map head), and as a section page's header icon. A task or habit with no area takes a strong-rule mark instead. They never mean status and never fill a surface.

### Tertiary

- **Vermilion** (`vermilion`): overdue (the word in a task's meta line and the Overdue day head and its rule), missed, destructive actions, and the now-line on the time axis.
- **Amber** (`warning-amber`): needs a look; why Save is off.
- **Teal** (`success-teal`): saved, on time, a weekly target met.
- **Slate** (`info-slate`): neutral notices.

### Neutral

- **Cool Sheet** (`sheet`): the page ground, cool rather than cream. Task rows sit directly on it.
- **Surface** (`surface`): tables, panels, inputs.
- **Sunken Track** (`surface-sunken`): segmented-control tracks, row hover, skeletons, period blocks.
- **Raised Surface** (`surface-raised`): menus, sheets, dialogs, the command palette, the reminder stack.
- **Hairline** (`hairline`): between rows and around panels.
- **Strong Rule** (`rule-strong`): under block heads, above and below a nudge band, around inputs and secondary buttons.
- **Ink 2** (`ink-2`) and **Muted Slate** (`muted-slate`): secondary text, then meta, labels, placeholders, and untimed entries in the time column.
- **Focus Blue** (`focus-blue`): focus outlines, focused input borders, and text selection at 28%.

### Named Rules

**The Colour Means Area Rule.** Area colour marks which part of life something is in (a square chip, a thin rule, a section's header icon) and nothing else. If a colour is answering "how is it going", it must be a status colour, paired with a mark or a word.

**The Ink Tick Rule.** Done is an ink tick. Never fill a completed thing with green, and never let a status colour stand alone without its word or mark.

**The No Brand Hue Rule.** The primary action is ink on the sheet. The product's colour is the owner's life areas.

## Typography

**Display Font:** none; titles use the body family
**Body Font:** Public Sans Variable (self-hosted, with ui-sans-serif, system-ui, Segoe UI fallbacks)

**Character:** One plain, institutional grotesque, as on a printed course schedule. Tabular figures are switched on for the whole body, so times, dates and counts line up in columns.

### Hierarchy

- **Headline** (700, 21px desktop / 22px phone, 1.2, -0.01em): the page title, over a 2px ink rule drawn beneath it. One per screen. The page's subtitle, Today's date included, sits below the rule in muted body text.
- **Title** (700, 14px desktop / 15px phone, 1.4): block heads, day heads, and sheet and confirm titles. There is no separate dialog size.
- **Body** (400 to 500, 14px desktop / 15px phone, about 1.45): rows, descriptions, controls.
- **Meta** (400, 12.5px desktop / 13px phone, 1.4): the line under a title or row, the task time column, and the schedule's hour labels.
- **Label** (600, 11.5px): badge text. Fixed-height controls (keyboard hints, the phone tab labels, date-picker weekday heads) use 11px.
- **Prose** (400, 15px, 1.65): Journal, Notes and pages, at a measure of 70 to 75ch.

### Named Rules

**The Weight and Rule Rule.** Rank comes from weight (700, 600, 500) and from the rule under a heading, not from more sizes. There are two title sizes, page and block; dialogs use the block size. Do not add a third.

**The Tabular Rule.** Figures are tabular everywhere. Never switch a time or count column to proportional figures.

## Layout

The desktop shell is an ink-blue sidebar (236px by default, resizable from 200 to 420px, a 64px icon rail below 1024px or when collapsed) beside a page column. Reading pages (Today, Home, Tasks, Habits, sections) are centred at a maximum of 1040px; wide pages (Calendar, lists and boards, Analytics) open to 1600px. Gutters are 16px on the phone and 32px from 768px. Below 768px the sidebar gives way to a fixed 64px tab bar: Home, Today, a central New task key, Tasks, More.

Spacing follows a 4px scale: 4 to 6px from icon to label, 8 to 12px inside rows and between controls, 16px panel padding, 24 to 32px under the page header, and 24 to 40px between major blocks. A block head sits 8px above its rows, with more space above it than below.

**The task row** is the timetable's period line: a 64px time column (the time in semibold ink; otherwise "Any time", a short day such as "Thu 26", or "No date" in muted), closed on its right by a 2px rule in the task's area colour, then the check, then the title and a meta line. A timed task on another day adds the day as a second line, and an AoE deadline says "AoE". The meta line carries priority, "Overdue", progress and labels, never the date itself.

**Day groups.** All Tasks sets open tasks under day heads (Overdue, Today, Tomorrow, Next 7 days, Later, No date), each a block title over a 2px ink rule with a count on the right; the Overdue head and its rule are vermilion.

**The time axis** (signature): from 768px, Today's schedule lays the day's periods on an 08:00 to 21:00 axis (stretched for earlier or later items) with hairline hour rules, lanes 34px apart, and a 2px vermilion now-line painted beneath the periods so it never strikes through a label. Items under 75 minutes draw as a thin area-coloured tick with the label beside it. On phones the same periods become a ruled list: time in a 56px column, then the title and meta.

**The reminder stack** floats at the bottom right (above the tab bar on phones). While it is open the page reserves its height at its foot (`--reminders-h`), so every row can scroll clear of it.

Phone targets are at least 44px (buttons 44px, rows 44 to 48px, segmented keys 44px); from 768px controls tighten to 28 to 40px.

## Elevation & Depth

The sheet is flat. Rows and blocks separate by rules; panels separate by a hairline border on the surface colour. Shadow appears only on things that float above the sheet: menus, popovers, toasts and the reminder stack, then modal sheets and dialogs over a 50% black scrim. One in-place lift exists, the selected key of a segmented control. There is no backdrop blur and no glow.

### Shadow Vocabulary

- **Key lift** (`box-shadow: 0 1px 1px rgb(15 21 28 / 0.05)` plus a 1px strong-rule ring): the selected segmented key.
- **Floating** (`box-shadow: 0 12px 28px -8px rgb(15 21 28 / 0.28)`): menus, popovers, toasts, the reminder stack.
- **Modal** (`box-shadow: 0 18px 44px -10px rgb(15 21 28 / 0.38)`): sheets, dialogs, the command palette.

### Named Rules

**The Ruled Sheet Rule.** At rest nothing on the page casts a shadow. Separate with a rule first, a bordered panel second, and a shadow only when the thing actually floats.

## Shapes

Corners are near-square and nearly uniform: 4px on buttons, inputs, segmented controls, nav rows, panels, the schedule, dialogs, sheets (the phone sheet's top included), menus and the reminder stack. Two smaller steps exist only for small marks: 3px on badges, checkboxes, register and day cells, and period blocks; 2px on progress bars and area chips, so an 8px chip stays square. Area marks are square chips (8px) or thin rules (2 to 4px wide), like course codes, never round dots. Full circles are reserved for the "due" ring in the register, avatars and the sheet grab handle.

Rules are the main form device: a 2px ink rule under the page title, day heads and table heads; a 1px strong rule under block heads, above and below a nudge band, and around inputs; hairlines between rows. A selected list item in a two-pane view (Notes, Journal, Vault) is marked with a 2px inset ink rail on its left edge.

## Components

### Buttons

Plain, ink-led keys that press in slightly.

- **Shape:** near-square (4px).
- **Primary:** ink ground, white text, 500 weight; 44px tall on the phone, 40px from 768px (small size 36 / 32px). Hover lightens to 88% ink, press to 80%.
- **Secondary (default):** surface ground, strong-rule border, ink text; hover and press to the sunken track.
- **Ghost:** no ground, muted text; hover to the sunken track with ink text.
- **Danger:** vermilion ground, white text, for destructive confirmations only.
- **Press / Focus:** every button scales to 0.97 on press (150ms); focus is the global 2px focus-blue outline at a 2px offset. Disabled drops to 50% opacity.

### Badges

- **Style:** outlined, never filled: 20px tall, 3px corners, 11.5px semibold. Neutral is a strong-rule border with muted text; status tones use the status colour for text and at 50% for the border.
- **State:** the word carries the meaning ("Overdue", "Private"); tone only adds to it.

### Segmented control

One control for every pick-one switch (Open/Completed/Skipped/All, Week/Month/Year, Table/Board, theme). A sunken track with 2px padding; the selected key is a surface key with a strong-rule ring and the key lift, others are muted text. Keys are 44px on the phone and 28px from 768px.

### Panels and tables

- **Corner Style:** 4px.
- **Background:** surface, with a hairline border.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 16px; table cells 14 to 16px horizontally.
- **Use:** only for one object or a table (the schedule axis, the check-in, the section map, the habit register, a form). Never to wrap each block on a page.

### Block header and day head

A block's title (700) over a 1px strong rule, 6px padding below, an optional muted count beside it and an optional action on the right in meta text. A day head is the same title over a 2px ink rule with its count at the right (vermilion title and rule for Overdue). Together they replace cards as the way a page is divided.

### Ruled blocks (nudges)

Setup, backup, new-week and priorities prompts are never boxes. Setup and This week's priorities are a block header with ruled rows beneath; the backup and new-week prompts are a band between two strong rules (12px vertical padding) holding a line of text and one action.

### Habit rows

Each habit row leads with its area as an 8px square chip (a hollow strong-rule square when it has no area), then the title, then the register cells.

### Inputs / Fields

- **Style:** surface ground, strong-rule border, 4px corners, 44px tall on the phone and 40px from 768px; labels above in muted 12 to 13px medium.
- **Selects:** the browser chevron is replaced in the base layer by a drawn 14px chevron-down, 8px from the right edge.
- **Focus:** the border turns focus blue with a 1px focus ring on top of it.
- **Error / Disabled:** invalid fields take a vermilion border; disabled fields drop to 60%.

### Navigation

- **Sidebar:** ink-blue, rows 32px tall at 13.5px in shell text. Hover lights the row to shell-2 at 70%; the current screen is a solid shell-2 row in bold white. Group labels are 12px semibold shell-muted. Sections show their area as an 8px square chip. New task sits at the top as a reversed light key with its N shortcut, beside a bordered search key.
- **Phone tab bar:** solid ink-blue, 64px, labels 11px medium; the current tab is white with a heavier icon stroke, others shell-muted. The centre New task key is a 48px reversed light square (4px corners).
- **Page header:** the title over its 2px ink rule; only a section page shows an icon beside it, in that section's area colour. Other pages carry no header icon.

### Sheets, dialogs and menus

Sheets are bottom sheets on the phone (4px top corners, grab handle, rising 340ms) and become a centred 4px dialog or a right side panel from 768px. Headers carry a block-size title and a ghost close key; footers sit over a hairline. Menus are raised surfaces with 4px corners, the floating shadow, and 3px highlighted items on the sunken track; destructive items are vermilion text.

### Reminder stack

One ruled unit, not a pile of cards: a raised 4px surface with a hairline border and the floating shadow, reminder rows divided by hairlines, and "+N more" and Fold along its foot as quiet text keys. Times read in 24-hour form; a task reminder shows the task's due time.

### The register (signature)

The habit register is a table: a strong-ruled head row of day initials and dates (today in bold ink), then one ruled row per habit with a cell per day. Each state has its own shape, readable without colour: done is an ink tick, skipped "S" and rest "R" in muted, missed an en dash in vermilion, due a small muted ring, nothing blank. A key under the table shows every mark.

### The time axis (signature)

See Layout. Period blocks are sunken-track bars with a strong-rule border, 3px corners and an 8px area chip; past periods dim by colour to muted text rather than fading; the now-line is a 2px vermilion rule beneath the periods.

### Motion

Sheets rise 340ms (side panel 320ms) and leave in 180ms; dialogs and menus settle from 97% in 220ms and leave in 120ms; the scrim fades 200 / 150ms; a task check pops in 260ms; toasts and the reminder stack rise 6px in 240ms. All use an expo ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`) in and ease-in out. Hover and press transitions are 150ms. Nothing animates on page load or scroll.

## Do's and Don'ts

### Do:

- **Do** put every page title and day head over a 2px ink rule, and every other block title over a 1px strong rule.
- **Do** divide a page with rules and block headers; keep bordered 4px panels for a single object or a table.
- **Do** set prompts and nudges as ruled blocks: a block header with ruled rows, or a band between two strong rules.
- **Do** give every task row its time column (the time, "Any time", a day, or "No date"), closed by a rule in its area colour, and keep the date out of the meta line.
- **Do** show area with a square chip or a thin rule in the area colour, and status with a mark or word first.
- **Do** mark done with the ink tick, and give every register state its own shape.
- **Do** keep figures tabular and 24-hour times in their own column.
- **Do** keep phone targets at 44px or more, and let controls tighten only from 768px.
- **Do** animate only in answer to an action, with exits faster than entrances, and respect reduced motion.

### Don't:

- **Don't** wrap blocks or nudges in cards, or stack panels to build a dashboard; that is the graphite world this replaced.
- **Don't** use an area colour to mean status, or fill a surface with it.
- **Don't** fill done items green or let colour alone carry a state.
- **Don't** add a brand accent hue; the primary action is ink.
- **Don't** add a third title size or a display face; dialogs use the block title.
- **Don't** use backdrop blur, glows or hard offset shadows; shadows are only for things that float.
- **Don't** round corners past 4px, or draw area marks as round dots.
