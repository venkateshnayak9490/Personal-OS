# Design reference analysis

This note covers what Personal OS should learn from seven references. They are used as a quality bar, not as looks to copy. None of the three proposed directions borrows any product's visual identity.

Each section answers two questions: what does the product get right, and what does that mean for Personal OS specifically?

## Summary

| Reference | Take | Leave |
|---|---|---|
| **Linear** | <ul><li>Keyboard-first speed</li><li>One compact row per item</li><li>A quiet chrome around dense lists</li><li>Instant optimistic updates</li></ul> | <ul><li>The graphite-and-violet look: it is now the category default, and the current app already sits close to it</li></ul> |
| **Notion** | <ul><li>Content outranks chrome</li><li>A page is a page</li><li>Progressive disclosure of structure</li></ul> | <ul><li>The blank-canvas freedom: a daily tool needs opinions about where things go</li></ul> |
| **Things 3** | <ul><li>Calm</li><li>Generous rows on touch</li><li>Today, Upcoming and Anytime as plain-language buckets</li><li>Completion that feels good without confetti</li></ul> | <ul><li>Its signature look (blue checkboxes, soft cards): too recognisable</li></ul> |
| **Sunsama** | <ul><li>The day as a plan with a time axis</li><li>Tasks and calendar events in one list</li><li>A realistic sense of how full the day is</li></ul> | <ul><li>The guided rituals (the user dropped the evening wrap-up)</li><li>Its two-pane board on phones</li></ul> |
| **Apple HIG** | <ul><li>Hierarchy through weight and spacing, not size jumps</li><li>44 pt targets</li><li>Clear primary actions</li><li>Respect for reduced motion</li></ul> | <ul><li>iOS-native costume in a web app used on Android</li></ul> |
| **Material Design 3** | <ul><li>Design tokens as a system</li><li>Explicit component states (hover, focus, pressed, disabled)</li><li>Colour roles</li><li>Dark theme as its own palette, not an inversion</li></ul> | <ul><li>The Material look (tonal surfaces, big FAB shapes everywhere)</li></ul> |
| **Nielsen Norman Group** | <ul><li>The usability heuristics as the review checklist</li><li>Recognition over recall</li><li>Visible system status</li><li>Error prevention</li><li>Consistency</li></ul> | — |

## Linear

**What it gets right**
- **Density without strain.** Each issue is one 32–36 px row: a status glyph, the title, then right-aligned metadata. Metadata is quiet (muted, small, tabular) and the title carries the row.
- **Navigation.** A narrow sidebar of grouped views, plus a command palette (⌘K) that reaches everything. Most actions have one-key shortcuts that are shown in menus, so they are learnable.
- **Speed is a design feature.** Optimistic updates, no spinners on common actions, and transitions under 200 ms.
- **Restraint.** Chrome is close to monochrome. Colour appears where it means something, such as status, priority or a label.

**What it means for Personal OS**
- Personal OS already has a command palette, the `N` shortcut and a grouped sidebar. Keep all three, and make shortcuts discoverable in menus and tooltips.
- Task rows should follow the same order: check, title, then a quiet meta line. The audit found that meta lines currently vary from screen to screen.
- **Don't copy the look.** Graphite, Inter, a violet accent and 6 px radii are what most new productivity apps ship. The current app is "graphite and paper" with Bricolage titles, which is the main reason it reads as generic. Linear sets the speed and density bar; the identity has to come from somewhere else.

## Notion

**What it gets right**
- **Content first.** The interface nearly disappears around the page. The sidebar is a tree of the user's own pages, and the user owns the structure.
- **Progressive disclosure.** Block handles, page menus and properties appear on hover or focus, so a page at rest is mostly text.
- **One editor everywhere.** Pages, databases and comments share one editing model.

**What it means for Personal OS**
- Section pages, Notes, the Journal and the Thesis outline are Notion-like surfaces, and the TipTap editor is already there. Each section is a page whose body is its own content. Tools such as lists and outlines sit above that body, and empty notes collapse to a header (audit UI §2).
- The sidebar's Sections group is the user's tree. It should feel like their own structure (the area colour and name), not a fixed menu.
- **Leave the blank canvas.** Personal OS is a daily operating tool with opinions: Today first, one place for habits, and a known destination for every new task. Freedom belongs inside sections, not in the daily loop.

## Things 3

**What it gets right**
- **Calm.** It uses a lot of white, a single accent and soft motion, and it never shouts.
- **Plain-language time buckets.** Today, This Evening, Upcoming, Anytime and Someday. People think in buckets, not in dates.
- **Touch ergonomics.** Large rows, swipe gestures and a "magic plus" that can be dragged to where the task should go.
- **Completion.** A check animates, then the row leaves after a short pause, so you can see what you just did and undo it.

**What it means for Personal OS**
- The Tasks page already groups by Overdue, Today, Tomorrow and Later. Keep those words.
- The app already has swipe on task rows, a check that animates before leaving, and Undo toasts (audit: "what not to redesign"). The redesign keeps them and gives them one consistent rhythm.
- The phone ＋ is the right primary action. It opens quick add, and the default destination is shown before saving (audit #11).
- **Leave the look.** Things' visual identity (blue rounded checkboxes, soft grey cards) is distinctive enough that copying it would read as copying.

## Sunsama

**What it gets right**
- **The day as a plan.** Tasks and calendar events sit in one column with a time axis, and the day visibly fills up.
- **Realism.** Time estimates add up against the hours you actually have.
- **Rituals.** Guided daily planning and shutdown.

**What it means for Personal OS**
- Today already merges tasks and events. A time axis makes it more honest: timed items sit at their times, and "Any time" items sit below. Direction A makes this its signature, and Direction C draws the day as a line.
- Time estimates and a load hint are on the roadmap (#28, "Later") and fit any direction.
- **Leave the evening wrap-up.** The user dropped it on 2026-11-19. Morning planning stays light: a check-in, then next up.

## Apple Human Interface Guidelines

**What it gets right**
- **Hierarchy.** Few type sizes; rank comes from weight, colour and spacing. Large titles exist, but body text is never small.
- **Touch targets.** At least 44 × 44 pt, with spacing that prevents mis-taps.
- **Clarity and deference.** The interface serves the content. Primary actions are obvious, and destructive actions are separated.
- **Accessibility.** Dynamic Type, reduced motion and sufficient contrast.

**What it means for Personal OS**
- Keep two title sizes: an H1 for screens and an H2 for blocks. This is already shipped in commit `9220cb9`, and every direction keeps it.
- The 44 px targets are already enforced on phones and must stay in every direction. That includes the habit cells, which are 40–44 px tall in all three prototypes.
- **No iOS costume.** The primary phone is Android Chrome, so platform-neutral web controls are right.

## Material Design 3

**What it gets right**
- **Tokens.** Colour roles (primary, surface, on-surface, outline, error) map to semantic jobs, not hex values. Light and dark are generated as separate palettes.
- **States.** Every component specifies enabled, hovered, focused, pressed, dragged and disabled, with state layers of fixed opacity.
- **Shape and elevation scales.** A few named steps, used consistently.

**What it means for Personal OS**
- The redesign starts from a token set with roles:
  - background, surface, surface-2, rule, foreground, muted, focus
  - status: danger and (where used) warning, kept apart from the four area colours
  - the four area colours
- Each direction in the proposals is written as such a set.
- Every interactive component gets the full state set. The current shared `Button` has hover and disabled, but focus and pressed vary across about 80 raw buttons (audit).
- **Leave the Material look.** Tonal surfaces and big expressive shapes would be a costume on a calm desktop tool.

## Nielsen Norman Group: the 10 heuristics applied

| Heuristic | Where Personal OS stands | What the redesign must do |
|---|---|---|
| Visibility of system status | Good. Saved times, undo toasts and counts are shown | Keep "Saved 08:24" style feedback. Show the offline/sync state once sync exists |
| Match with the real world | Good: plain words (I'm up, Ate breakfast) | Keep the vocabulary. Don't rename features for style |
| User control and freedom | Strong: Undo everywhere, Trash | Keep a single toast at a time, and never cover actions with it |
| Consistency and standards | Weakest area: 80+ raw buttons, mixed radii, two section-colour systems | One token set and one component kit (Phase 2) |
| Error prevention | Habit cells now toggle on tap, with long press for the rest | Keep it, and draw the four states with non-colour marks |
| Recognition rather than recall | The destination is shown on quick add (#11) | Area colour plus name everywhere a task appears |
| Flexibility and efficiency | Command palette, `N`, swipe | Show shortcuts in menus. Keep app-icon shortcuts |
| Aesthetic and minimalist design | Improved after Phases 1–4 | Fewer containers. Rules and spacing instead of card-in-card |
| Help users recover from errors | Inline save hints exist | Use them everywhere (#25) |
| Help and documentation | Inline hints exist, for example on Habits | Show hints once, then hide them |

## The bar this sets

A direction passes if:
1. A Linear user finds every action where they expect it. The navigation and controls are standard.
2. It is as calm as Things over a long session.
3. It shows the day as honestly as Sunsama.
4. Every state is visible without relying on colour (NN/g, WCAG).
5. It has one identity that no reference above could claim.
