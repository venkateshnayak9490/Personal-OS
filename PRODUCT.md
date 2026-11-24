# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** the owner, an MS-by-Research student (research area Physical AI, one adviser, coursework, thesis ahead). They use the app every day on an Android phone (Chrome, installed PWA) and a desktop (Chrome).
- **Later:** other people who install it. The starter profiles (student, working professional, exam aspirant, freelancer, other) exist for them. Design for the owner first, but avoid choices that only make sense for one person.

## Product Purpose

One offline-first app that replaces a to-do app, a habit tracker, a calendar, a notes app and a handful of spreadsheets for a life spread across research, coursework, fitness, health and personal life. Success means the owner opens it in the morning, sees today's work, records what happened, and trusts the numbers.

## Positioning

- Everything lives on the device (IndexedDB) and works with no account and no connection.
- One structure of the owner's own sections (Work, Self, Personal, Misc), with section-specific tools that general apps don't have: Gym, Health, Thesis outline, Papers, Coursework and Adviser meetings.
- An honest data model: skipped and missed are never shown as done, and history is never rewritten.

## Operating Context

- **Daily loop:** open on Today, check in (sleep, mood, water), work through tasks, tick habits on the Habits page, log the gym and the health plan.
- **Weekly:** review the week and plan the next one.
- **Capture:** plain-language quick add (chrono-node dates), the command palette on desktop, and share-to-app on the phone.
- **Sessions:** long, repeated sessions on the desktop. Quick, one-handed visits on the phone.

## Capabilities and Constraints

- **Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, Dexie, zustand, Radix primitives, TipTap, FullCalendar, lucide icons.
- **Screens:**
  - Today, Home (section map), Tasks, Inbox, Projects, Goals, Habits, Focus, Calendar, People, Reviews, Analytics, Notes, Journal, Vault, Settings.
  - The user's sections, at `/s/:id`.
- **Decisions already made (2026-11-19):**
  - The app opens on Today.
  - Habits appear only on the Habits page.
  - The phone tabs are Home · Today · ＋ · Tasks · More.
  - There is no evening wrap-up.
- **Technical constraints:**
  - No backdrop blur (Android GPU cost).
  - Motion only in response to actions, and reduced motion is respected.
  - Touch targets are at least 44 px.
- **Open:** Supabase sync and Web Push (not yet switched on).

## Brand Commitments

- Name: **Personal OS** (working name, kept). There is no logo yet.
- **Colour means life area.** The four area colours (Work, Self, Personal, Misc) say which part of life something belongs to. Colour is not decoration, and status colours stay separate from area colours.
- Dark and light themes both ship.

## Evidence on Hand

- Real content: the Researcher default section tree (`src/core/domain/templates.ts`).
- 166 screenshots of every screen: `uiux-handover/uiux-screenshots/` and `docs/discovery/screenshots/`.
- Audits: `docs/ux-audit/`, `uiux-handover/EXISTING_UX_AUDIT.md`.
- There are no users other than the owner, and no testimonials or metrics. Don't invent any.

## Product Principles

1. Today's work comes first. Every entry point leads back to the day.
2. Tell the truth about progress: missed is missed, and numbers have one source.
3. Enter it once and reuse it everywhere (People and Occasions, Gym and Habits, Notes and sections).
4. Calm for long use. The interface recedes, and the owner's content and areas carry the colour.

## Accessibility & Inclusion

- WCAG 2.2 AA contrast in both themes.
- Visible keyboard focus.
- Never colour alone for status.
- 44 px touch targets and reduced motion.
