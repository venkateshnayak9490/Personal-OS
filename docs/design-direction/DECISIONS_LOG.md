# Decisions log (overnight redesign run)

These are choices I made without you, following your rule "decide, keep going, log it". Each entry gives the phase, the question, the decision and the reason. Reverse any of them in the morning.

| # | Phase | Question | Decision | Why |
|---|---|---|---|---|
| 1 | Setup | Where does the work go? | Branch `redesign/timetable`, one commit per phase, never pushed | Your answer. main deploys the live site. |
| 2 | 3 | The Phase 3 brief asks for "habit progress" on Today, but on 2026-11-19 you decided habits appear **only on the Habits page** | Today shows one read-only line, "Habits: 2 of 5 done today", which links to Habits. You can't tick habits on Today, and Home shows nothing about habits | This keeps the reason behind your earlier decision (one place to track habits) while giving Today the context the new brief asks for |
| 3 | 3 | Timetable items too short to hold a label | Items under 75 minutes draw as a tick with the label beside it. The label reserves 2¼ hours of axis in its lane, and full details are in the tooltip and the accessible name | At 1440 px an hour is about 75 px, so a block under 75 minutes can't hold a readable label. Ticks keep the time honest |
| 4 | 3 | The prototype put the time axis on Home | It sits on **Today** as the "Schedule" widget. Home has "Next up" | Phase 3 asks Home and Today not to duplicate each other; the schedule is execution |
| 5 | 3 | Which screens fold in the sidebar | Reviews, Analytics and Vault fold into "Review and private" (remembered). Nothing else folds, and everything stays on More, the rail and ⌘K | They are used weekly or occasionally; see NAVIGATION_DECISIONS.md |
| 6 | 3 | How the active sidebar row is marked | A lit row in bold white, with no edge bar (unlike the prototype) | The craft floor bans a one-sided bar on a rounded box |
| 7 | 3 | Whether to add a new number to Home | One: "done this week" per area on the map | It gives context about the week without adding a metrics wall |
