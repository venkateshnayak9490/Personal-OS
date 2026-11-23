# Responsive design guidelines

Personal OS is used on an Android phone (Chrome, installed) and a desktop (Chrome). Tablets and laptops have to work too.

The rule is **change the structure, not the size**. Each breakpoint gets the layout that fits how that device is held and used. Type uses fixed rem sizes, not fluid scaling.

## Breakpoints

| Name        | Width               | Navigation                                                                           | Content                                                                         |
| ----------- | ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Phone**   | < 768px (`max-md:`) | Bottom tab bar Home · Today · ＋ · Tasks · More, and a search button in page headers | One column, 16px gutters, 44px targets, bottom sheets                           |
| **Tablet**  | 768–1023px (`md:`)  | Sidebar as a 64px icon rail (labels in tooltips)                                     | One column or two, 32px gutters                                                 |
| **Laptop**  | 1024–1439px (`lg:`) | Full sidebar (resizable, 200–420px, collapsible to the rail)                         | Reading width 1024px, wide pages full width                                     |
| **Desktop** | ≥ 1440px            | Same as laptop                                                                       | The same, with more room either side of reading pages; wide pages use the width |

These come from `Sidebar.tsx` (`min-width: 1024px` for the full sidebar), `BottomNav.tsx` (hidden from `md`) and `AppShell.tsx` (content up to `max-w-5xl`).

## Navigation

- **Phone:**
  - The fixed tab bar sits on the ink-blue shell, with a safe-area inset. ＋ opens quick add.
  - More lists every other screen in the same groups as the sidebar, with 44px rows.
  - Pages leave room at the bottom for the tab bar and the reminder bar.
- **Tablet:** the icon rail keeps every destination one tap away without taking width from the content.
- **Laptop and desktop:** the full sidebar, with the user's width and collapsed state remembered.
- **Keyboard:** N opens a new task, and ⌘K / Ctrl K opens search on every size that has a keyboard.

## Page header

- **Phone:** the title is 22px over its rule. Actions shrink to icon buttons on the right, and secondary actions go into a "⋯" `Menu`.
- **Tablet and up:** actions are labelled buttons. Subtitles are one line.

## Lists and tables

- **Lists** are the same component everywhere. On phones the meta line wraps under the title, and the right-hand time moves into the meta line when space runs out.
- **Tables** (Collections, Analytics):
  - **Phone:** each row becomes a stacked block (title, then label–value pairs), or, where the comparison matters, the table scrolls sideways inside its card with the first column sticky.
  - **Tablet:** show the 3–4 most important columns and put the rest in the row's sheet.
  - **Laptop and up:** all columns, with sortable headers.
- **Boards** (list board views) scroll sideways with whole columns snapping into place, and columns are at least 260px wide. On phones a board becomes a status Segmented control above a single list.

## Calendars

- **Phone:** a 3-day time grid by default, with a Month view, swipe to move, and 44px toolbar buttons. Events open in a bottom sheet.
- **Tablet:** a week view.
- **Laptop and desktop:** week or month at full width, with the calendar layers (gym, health) toggled in the toolbar.
- The Occasions calendar follows the same rules.

## Forms

- **Phone:** one column. Inputs are 44px tall with 16px text (so iOS doesn't zoom), and labels sit above the inputs. The sheet footer, with Cancel and the main action, stays visible above the keyboard.
- **Tablet and up:** two columns where fields pair naturally (date and time, start and end). Labels stay above.
- Validation messages appear under the field or in the footer, never only by greying out the button.

## Dialogs and drawers

- **Phone:** always a bottom sheet with a grab handle, up to 92% of the height. The body scrolls and the footer is pinned.
- **Tablet and up:** a centred dialog (max 512px) or a right-hand side panel (max 576px, for the task editor). Escape closes it.
- Confirmations are centred dialogs at every size.

## Timelines

- The Today timetable strip runs from 08:00 to 21:00 on a horizontal axis on tablet and up.
- **On phones** it becomes a vertical list of periods: time on the left, item on the right. A blank 13-hour axis would not fit.
- Items shorter than 75 minutes show a tick mark with the label beside it (decisions log #3).

## Analytics and charts

- **Phone:** one chart per row at full width, legends below the chart, and value labels on bars instead of tooltips.
- **Tablet:** two per row.
- **Laptop and up:** two to three per row, with hover tooltips. Every chart also has a text summary line ("Slept 7 h 05 m on average, up 20 m").
- Charts use the area colours for area series, and `fg` / `muted` for single series.

## Touch targets and spacing

- **Phone:** every target is at least 44×44px. That covers Segmented options, habit cells, checks (with padding) and toolbar buttons, and is enforced in `index.css` and the components.
- **Pointer devices:** targets may be 32px, with 4px or more between neighbours.
- **Gutters:** 16px on phones, 32px on tablets, 32–40px on laptops and desktops.

## Testing sizes

Check every redesigned screen at:

- 390×844 (phone)
- 768×1024 (tablet)
- 1280×800 (laptop)
- 1440×900 (desktop)

At each size, look for horizontal overflow, clipped text, controls hidden behind the tab bar or the reminder bar, and focus order.
