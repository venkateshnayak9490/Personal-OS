# Component guidelines

**The rule:** there is one component per purpose. Before building a control, use the one below. If it doesn't fit, extend it instead of writing a second one.

You can see every component live at **`/dev/design`** (development builds only).

| Purpose | Use | File |
|---|---|---|
| Action | `Button` | `components/ui.tsx` |
| Text input, multi-line text, native select | `Input`, `Textarea`, `Select` | `components/ui.tsx` |
| Label + control + hint | `Field` | `components/ui.tsx` |
| Why Save is off | `SaveHint` | `components/ui.tsx` |
| One-of-few switch, view tabs | `Segmented` (`as="tabs"` when it changes what the page shows) | `components/ui.tsx` |
| Date | `DatePicker` + `DateButton` | `components/DatePicker.tsx` |
| Time | `Input type="time"` (native, styled by `Input`) | — |
| "⋯" actions, dropdown menus | `Menu` | `components/Menu.tsx` |
| Dialog, side panel, bottom sheet | `Sheet` (`variant="center"` or `"side"`) | `components/Sheet.tsx` |
| Destructive or irreversible confirmation | `Confirm` | `components/Sheet.tsx` |
| Messages, undo, errors | `toast()`, `toastError()`, `attempt()` | `app/toast.tsx` |
| Screen title | `PageHeader` | `components/PageHeader.tsx` |
| Block title inside a page | `BlockHeader` | `components/ui.tsx` |
| One bordered object (form, table, the check-in) | `Card` | `components/PageHeader.tsx` |
| Small label or count | `Badge` | `components/ui.tsx` |
| Habit or plan state (done, skipped, rest, missed, due) | `StatusMark` | `components/ui.tsx` |
| Progress | `ProgressBar` | `components/ui.tsx` |
| Nothing here yet | `EmptyState` | `components/ui.tsx` |
| Loading | `Loading` (a skeleton after 250 ms, a reload offer after 6 s) | `components/ui.tsx` |
| Search and quick navigation | `CommandPalette` (⌘K / Ctrl K, phone search) | `app/CommandPalette.tsx` |
| Navigation | `Sidebar` (desktop and tablet), `BottomNav` (phone) | `app/` |

## Buttons

**Variants**

| Variant | Look | Use |
|---|---|---|
| `primary` | Ink fill | The one main action on a screen or sheet ("New task", "Save") |
| `secondary` (default) | Outlined with `line-strong` | Everything else |
| `ghost` | Text only, with a tint on hover | Toolbar and row actions, "Close" |
| `danger` | Vermilion fill | Only inside `Confirm`, or for a delete that is already confirmed |

**Sizes**

| Size | Phone | Desktop | Use |
|---|---|---|---|
| `md` | 44px | 40px | Forms and page actions |
| `sm` | 36px | 32px | Inline actions |
| `icon` | 44px square | 40px square | Icon buttons |
| `icon-sm` | 40px square | 32px square | Icon buttons in rows |

**States**
- Hover darkens the fill or tints the background.
- Pressed scales to 0.97 and darkens further.
- Focus shows the 2px focus ring.
- Disabled is 50% opacity with no pointer events.
- Loading: put a short verb in the label ("Saving…") and disable the button. There is no spinner inside buttons.

**Icons** inside buttons are 16px (`size-4`). An icon-only button needs an `aria-label`.

**Copy** names the action: "Save changes", not "Submit". The same verb follows through to the toast ("Saved").

## Inputs, textareas, selects

- **Look:** square and ruled, with a `line-strong` border. On focus, the border and a 1px ring turn the focus colour.
- **Height:** 44px on phones and 40px on desktop. Text is 16px on phones (this stops iOS from zooming in) and 14px on desktop.
- **Errors:** set `aria-invalid="true"`, which turns the border vermilion. Say what's wrong in `Field`'s `hint`, or with `SaveHint` beside the buttons. Keep Save disabled, but always say why.
- **Selects:** use `Select` for native lists of fewer than about 10 options. Use `Menu` when the options are actions.

## Segmented and tabs

- **Look:** a sunken track (`surface-2`). The selected option is a raised key: `surface`, a 1px `line-strong` ring and `shadow-xs`.
- **`as="tabs"`** when it changes what the page shows: Week/Month, Open/Completed. Otherwise it renders radio buttons.
- **Counts** sit inside the option ("Open 11").
- **On phones**, options are at least 44px tall, and `full` stretches the control to the screen width.

## Dates and times

- **Dates:** `DatePicker` gives quick choices (Today, Tomorrow, This weekend, Next week) and a month grid. It opens from a `DateButton`, and picking a day applies it at once.
- **Times:** native `type="time"` through `Input`. Phones show their own wheel.
- **Display:** relative where it helps ("Today", "Tomorrow", "Thu"), absolute otherwise ("Wed 25 Nov"). Times are 24-hour, as you set them, and always tabular.

## Panels and the sheet

- **Rules before boxes.**
  - A page is a sheet. Group content under `BlockHeader`s and separate rows with `line` hairlines.
  - Use `Card` only for one thing with edges: a form, a table, the check-in.
  - Never put a card inside a card.
- **Rows:** check (or mark), then title, then a meta line in `text-meta text-muted`, then time or actions on the right. The area shows as a square chip in the area colour, beside the section name.

## Dialogs and drawers

**`Sheet`**
- Phones: a bottom sheet with a grab handle, filling up to 92% of the height.
- Desktop: a centred dialog (`center`, max 512px) or a right-hand panel (`side`, max 576px, used by the task editor).
- It has a title and an optional description, a scrolling body, and a footer for its buttons:
  - Cancel is secondary, on the left.
  - The main action is primary, on the right.

**`Confirm`** is only for destructive or irreversible actions.
- Prefer undo over confirm: delete first, then offer Undo in the toast.
- Its description says what happens and whether it can be restored.

## Toasts and notifications

**Toasts**
- One at a time; a newer toast replaces the older one.
- Inverted colours (ink on light, light on dark), at the bottom centre, above the phone tab bar.
- Info toasts last 4 s. Toasts with Undo last 6 s and include the "Undo" button.
- Errors use the danger fill, an alert icon, and the error's own message.
- Clicks on the toast's empty space pass through to the page; only its buttons catch taps.

**Reminders** are a slim bar that expands on tap (`features/reminders`). They never cover page actions: pages get extra bottom padding while the bar shows.

## Badges and status

**`Badge`**
- Outlined, 20px tall, 11.5px semibold.
- Tones: `neutral`, `danger`, `warning`, `success`, `info`.
- The word carries the meaning ("Overdue", "Private", "3 open").

**`StatusMark`**: the register marks, readable without colour.

| Mark | Look | Means |
|---|---|---|
| ✓ | Ink tick | Done |
| S | Muted letter | Skipped (with a reason) |
| R | Muted letter | Rest day |
| – | Vermilion | Missed |
| ○ | Hollow ring | Due, not yet done |
| (blank) | Nothing | Not scheduled, or in the future |

Each mark has an accessible name ("Done", "Missed"). Use it for habits, the health plan, and the gym week.

## Tables and lists

**Lists** are rows on hairlines:
- No zebra stripes.
- Hover tints the row `surface-2`.
- The selected row gets a `surface-2` fill and a 2px `fg` rule on its leading edge, which is a table rule, not a card bar.

**Tables** (Collections, Analytics, the check-in):
- Wrapped in a `Card` with `p-0`.
- The head row has a 2px `fg` rule under it, and body rows have `line` rules.
- Numbers are right-aligned and tabular.
- Sortable headers are buttons with `aria-sort`.

**On phones**, tables become stacked rows: title, then label–value pairs. Wide tables that must stay tables scroll sideways inside their card, with the first column sticky (see the responsive guidelines).

## Navigation items

- **Sidebar rows:** 32px tall on desktop, 44px in More.
  - An 18px icon and a 13–14px label, with an optional count on the right.
  - Active: `shell-2` fill and bold white text (no side bar: a one-sided bar on a rounded row is on the craft floor's refuse list).
- **Section rows:** a square chip in the area colour instead of an icon, plus the open count.
- **Phone tab bar:** Home · Today · ＋ · Tasks · More. Active tabs use the bright shell text, inactive tabs use `shell-muted`.

## Search

`CommandPalette` is the one search:
- ⌘K / Ctrl K on desktop, or the search button.
- The search tab on phones.
- It searches tasks, sections, notes, lists and people, plus "Go to" screens.
- Results list the type and the section.
- Arrow keys move through results and Enter opens one.

## Empty states

**Formula:** what will appear here, plus the one thing to do next.
- Title: "Inbox is empty".
- Line: "Anything you capture without a section lands here."
- Primary action: "Add a task".

The icon sits in a ruled square. Use `compact` inside blocks.

## Loading

- Nothing shows for the first 250 ms. Local data is usually faster than that.
- Then a skeleton of the page: a title bar, its rule, and three ruled rows, pulsing unless reduced motion is on.
- After 6 s it says so and offers Reload.
- There are no spinners in the middle of content.

## Confirmation and undo

| Situation | Pattern |
|---|---|
| Complete, move, archive, delete a task or row | Act immediately; toast with Undo |
| Delete something large (a list, a section, a project with tasks) | `Confirm`, saying where it goes (Trash) |
| Irreversible (empty Trash, reset Vault, erase data) | `Confirm` with `danger`; the button names the action ("Erase everything") |
| Leaving with unsaved text | The editor keeps a draft; no prompt |
