# Personal OS

An offline-first, installable PWA for managing work, research, health, learning and personal life.
The full product plan is in [build.md](build.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

## Scripts

| Command           | What it does                                                                           |
| ----------------- | -------------------------------------------------------------------------------------- |
| `npm run dev`     | Dev server with hot reload                                                             |
| `npm run build`   | Type-check + production build (with service worker) into `dist/`                       |
| `npm run preview` | Serve the production build at http://localhost:4173 (test install/offline here)        |
| `npm run check`   | Type-check, lint and unit tests                                                        |
| `npm test`        | Unit/component tests (Vitest)                                                          |
| `npm run e2e`     | End-to-end tests (Playwright; desktop + Android viewport) against the production build |
| `npm run format`  | Format all files with Prettier                                                         |
| `npm run icons`   | Regenerate PWA icons after editing `public/logo.svg`                                   |

## Layout

```
src/
  app/        shell: routes, sidebar, bottom nav, theme, toasts, quick capture, PWA install/update
  core/
    db/       Dexie schema (IndexedDB)
    domain/   types and pure logic (tasks/overdue/AoE, section tree, profile templates)
    repos/    the ONLY write path: every write also logs history + queues for sync
    backup.ts export / import / CSV
    hooks.ts  live (auto-updating) reads for React
  features/   tasks (list, editor), structure (section dialog), tags
  components/ shared UI (buttons, sheets, menus, confirm)
  pages/      screens
tests/e2e/    Playwright tests
docs/testing/ manual test checklists per milestone
```

## Deploying (Vercel)

Import the GitHub repo in Vercel; it reads `vercel.json` (build command, SPA rewrites, security headers).
No environment variables are needed until M5.
