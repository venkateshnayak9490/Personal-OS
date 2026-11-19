# Decisions log (overnight redesign run)

These are choices I made without you, following your rule "decide, keep going, log it". Each entry gives the phase, the question, the decision and the reason. Reverse any of them in the morning.

| # | Phase | Question | Decision | Why |
|---|---|---|---|---|
| 1 | Setup | Where does the work go? | Branch `redesign/timetable`, one commit per phase, never pushed | Your answer. main deploys the live site. |
| 2 | 3 | The Phase 3 brief asks for "habit progress" on Today, but on 2026-11-19 you decided habits appear **only on the Habits page** | Today shows one read-only line, "Habits: 2 of 5 done today", which links to Habits. You can't tick habits on Today, and Home shows nothing about habits | This keeps the reason behind your earlier decision (one place to track habits) while giving Today the context the new brief asks for |
| 3 | 2 | Timetable items shorter than 45 minutes on the time axis | The label sits outside the block, after a tick mark; full details show on hover and in the accessible name | Short items stay readable without making blocks wider than their time |
