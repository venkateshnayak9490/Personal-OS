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

<!-- impeccable:design-map -->

Name: Personal OS
Colors: primary: ink #17202b; secondary: area-work #3b4fc8; tertiary: vermilion #c4401a; neutral: ink-2 #364250; primary: accent #17202b; primary: accent-fg #ffffff; primary: shell #1b2735 (+43 more in the sidecar)
Fonts: Public Sans Variable (headline, title, body, meta, label, prose)
Spacing: 1 4px, 2 8px, 3 12px, 4 16px, 6 24px, 8 32px, 10 40px
Radius: xs 2px (chips, marks), sm 3px (badges, cells, periods), md 4px (everything else)
Layout: sidebar 236px (200 to 420px), reading sheet 1040px, wide pages 1600px
North Star: "The Course Timetable"
Rules:

- The Colour Means Area Rule. Area colour marks which part of life something is in (a square chip, a thin rule, a section's header icon) and nothing else.
- The Ink Tick Rule. Done is an ink tick.
- The No Brand Hue Rule. The primary action is ink on the sheet.
- The Weight and Rule Rule. Rank comes from weight (700, 600, 500) and from the rule under a heading; two title sizes, and dialogs use the block size.
- The Tabular Rule. Figures are tabular everywhere.
- The Ruled Sheet Rule. At rest nothing on the page casts a shadow.
  Elevation:
- Key lift: 0 1px 1px rgb(15 21 28 / 0.05)
- Floating (menus, toasts, reminder stack): 0 12px 28px -8px rgb(15 21 28 / 0.28)
- Modal: 0 18px 44px -10px rgb(15 21 28 / 0.38)
  Don't:
- Don't wrap blocks or nudges in cards, or stack panels to build a dashboard; that is the graphite world this replaced.
- Don't use an area colour to mean status, or fill a surface with it.
- Don't fill done items green or let colour alone carry a state.
- Don't add a brand accent hue; the primary action is ink.
- Don't add a third title size or a display face; dialogs use the block title.
- Don't use backdrop blur, glows or hard offset shadows; shadows are only for things that float.
- Don't round corners past 4px, or draw area marks as round dots.
  Do:
- Do put every page title and day head over a 2px ink rule, and every other block title over a 1px strong rule.
- Do divide a page with rules and block headers; keep bordered 4px panels for a single object or a table.
- Do set prompts and nudges as ruled blocks: a block header with ruled rows, or a band between two strong rules.
- Do give every task row its time column (the time, "Any time", a day, or "No date"), closed by a rule in its area colour, and keep the date out of the meta line.
- Do show area with a square chip or a thin rule in the area colour, and status with a mark or word first.
- Do mark done with the ink tick, and give every register state its own shape.
- (+3 more)
  Full: .impeccable/design-full.md (read a section when you need its detail)
