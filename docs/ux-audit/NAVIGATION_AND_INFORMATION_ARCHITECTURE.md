# Navigation and information architecture

## 1. What's there today

Verified in the walk-through (Researcher profile).

| Surface                | Contents                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop sidebar**    | <ul><li>New task, Search</li><li>10 screens: Home, Today, All Tasks, Inbox, Projects, Goals, Habits, Focus, Calendar, People</li><li>the Sections tree (4 areas, 20 subsections)</li><li>Tools: Reviews, Analytics</li><li>Private: Notes, Journal, Vault</li><li>Settings, Trash</li></ul>About 17 screens plus 24 sections, in one long scrolling column. |
| **Phone bottom bar**   | <ul><li>3 tabs you can choose (Home, Today, Tasks by default)</li><li>a fixed ＋</li><li>More</li></ul>                                                                                                                                                                                                                                                     |
| **More (phone)**       | <ul><li>Search</li><li>10 primary screens</li><li>Tools and private</li><li>Settings, Trash</li></ul>                                                                                                                                                                                                                                                       |
| **Ways into sections** | <ul><li>the sidebar tree (desktop)</li><li>the Home map</li><li>`/sections` (from More)</li><li>subsection chips on area pages</li></ul>                                                                                                                                                                                                                    |
| **Start screens**      | <ul><li>the installed app opens on **Home**</li><li>a browser tab opens on **Today**</li><li>after onboarding you land on **Today**</li></ul>                                                                                                                                                                                                               |

## 2. Home and Today

| Question                                              | Answer                                                                                                                                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Do they have different purposes?                      | **Partly.**<ul><li>Today is now clearly "work": tasks, overdue, events, Coming up, projects.</li><li>Home is "structure + wellbeing", but its first screen is the structure, and wellbeing is split with Health and Habits (A1, A2).</li></ul> |
| Is information duplicated?                            | **The section map** duplicates the sidebar, More and `/sections`. The **check-in** is duplicated between Home and Health (RD1). Otherwise little.                                                                                              |
| Is the important thing visible immediately?           | **Not on a phone:**<ul><li>Home's first screen is the map.</li><li>Today's first screen is the greeting, a motivational line and the setup checklist (A4, A5).</li></ul>                                                                       |
| Is the dashboard overloaded?                          | **Today:** no, but the order puts nudges above tasks. **Health and Gym pages:** long (2–2.4 screens).                                                                                                                                          |
| Can users customise it?                               | **Partly.** Today's widgets can be hidden and reordered. Home can't be customised. The bottom tabs can.                                                                                                                                        |
| Is navigation intuitive?                              | **Desktop:** yes, but the sidebar is long and mixes screens with sections. **Phone:** sections are 2 taps deep through Home or More, which is acceptable.                                                                                      |
| Are frequent actions easy to reach?                   | **Yes:** ＋ everywhere, search on Home and More, swipe on tasks. **No:** "I'm up", water and Start workout need navigating (see GP1, GP5).                                                                                                     |
| Does the phone have the same capabilities as desktop? | **Now yes.** Search was the last gap and is fixed. The remaining difference is drag-and-drop on boards; the phone uses "Move…" instead, which is fine.                                                                                         |

## 3. Problems, ranked

1. **The morning needs three screens**, and the first one shows navigation instead of today's state (A1, A2, A6). **P1.**
2. **Sections are reachable four ways**, one of them a redundant page (RD2). **P1.**
3. **Day one has 24 sections**, about half empty (RD11). This makes the sidebar, More and Home all long from the start. **P1.**
4. **The sidebar mixes screen types:** planning (Today, Tasks, Inbox, Calendar), tracking (Habits, Focus, Analytics), people and private, with Sections in the middle. It's hard to scan. **P2.**
5. **Settings is one long page** (RD19). **P2.**
6. **Two start screens** (Home when installed, Today in a browser). **Decided:** the app opens on Today everywhere (the manifest's start URL changes from `/home` to `/`). **P1.**

## 4. Recommended structure

The structure keeps everything you asked for: the section map on Home, check-ins on Home, Today without habits, and habits only on the Habits page. The app opens on Today on desktop and phone. It reorders and groups the rest.

### Home: "How am I doing today"

1. A one-line greeting and the date.
2. **Check-in** (merged, compact): I'm up · meals · water + · mood · energy. Wake and bed times come from Health. Undo and Reset as now.
3. **Next up:** the next event or appointment, with a link to Today.
4. **Your sections** map, collapsible, remembering its state, with open-task counts as now.

Habits, including the Gym row's Start/End/Skip, stay on the Habits page only.

### Today: "What do I need to do"

1. The overdue bar (when there is something overdue).
2. Today's tasks.
3. Events today.
4. Coming up.
5. Active projects.

The setup checklist, review nudge and backup reminder move **below** today's tasks, or collapse into one dismissible line ("3 setup steps left").

### Desktop sidebar, in groups

| Group        | Items                                   |
| ------------ | --------------------------------------- |
| (top)        | New task, Search                        |
| **Plan**     | Home, Today, All Tasks, Inbox, Calendar |
| **Build**    | Projects, Goals                         |
| **Track**    | Habits, Focus, Reviews, Analytics       |
| **Sections** | the tree (collapsed areas by default)   |
| **Personal** | People, Notes, Journal, Vault           |
| (bottom)     | Settings, Trash                         |

The 17 screens stay the same. They're grouped by what you're doing, which makes the column scannable.

### Phone

- **Bottom bar default:** unchanged (Home · Today · ＋ · Tasks · More), and the app opens on the Today tab. Habits stays reachable from More, and the bar stays customisable as now.
- **More:**
  - Search
  - the same groups as the sidebar
  - "Sections", which opens the Home map
- **Remove** the `/sections` page.

### Sections (seeding)

- Seed the four areas plus the sections that have their own tools.
- Offer the generic ones as one-tap suggestions, e.g. "Add Updates, Household, Documents?".
- Area pages show a summary of their subsections (open tasks, next deadlines) rather than an empty outline.

### Settings (sub-pages)

| Sub-page           | Contents                                                |
| ------------------ | ------------------------------------------------------- |
| **Personalise**    | Theme, bottom tabs, Today widgets, messages             |
| **Notifications**  | Reminder interval, quiet hours, permissions             |
| **Data & privacy** | Backup and restore, storage, App lock, Vault link, sync |
| **Workspace**      | Profile, sections editor, tags                          |

## 5. What should not change

- **＋ on every screen and swipe on tasks.**
- **Plain-language capture everywhere.**
- **Search on Home and More (phone) and Ctrl+K (desktop).**
- **One-click hide of a section from the sidebar.**
