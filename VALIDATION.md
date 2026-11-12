# Release validation

## Automated checks

The project includes 20 scheduling and data-integrity tests. They cover:

- Strict 24-hour parsing and the special 24:00 endpoint.
- Complete 1,440-minute coverage with contiguous, non-overlapping segments.
- All four block sizes and shorter final remainders.
- Work/personal compatibility around fixed commitments.
- Required-material readiness and visible overflow.
- Unschedulable short gaps and due-date/priority ordering.
- Reset time at appointment boundaries.
- Conflicting commitments without double-booking.
- Overnight workdays and commitments spanning midnight.
- Recurrence at weekdays, month ends, leap years, and quarter changes.
- Date-scoped completion and backup round-trips.
- Personal mean estimates from the latest 20 full-task logs.
- A 1,440-row minute CSV with formula-neutralized text.
- ICS midnight conversion, escaping, and Unicode line folding.
- Invalid profile, task, date, and imported-ID rejection.
- Forty generated mixed schedules, checking ownership, context, and duration.

JavaScript syntax checks are run for the application and planning engine.

## Browser verification limit

The local preview server started, but the environment’s in-app browser could
not reach the local address. A subsequent Windows browser access check stopped
Computer Use because it could not confidently determine the current URL.
Interactive visual verification was therefore not completed. Automated tests
verify the engine, not actual browser rendering, keyboard focus, responsive
layout, downloads, or timer interactions.

## Suggested manual acceptance check

1. Extract all files and open `index.html`.
2. Complete the first-run form using 24-hour clock times; try an invalid time.
3. Add lunch and a work task, checking that blocks avoid lunch.
4. Add a personal task, checking that it stays outside work hours.
5. Add an unchecked requirement, then mark it ready in task details.
6. Complete a block and refresh to verify saved progress.
7. Start a timer, pause, resume, reset, and complete it.
8. Inspect the week, month, quarter, and minute-by-minute views.
9. Add a quarterly intention and a full-task actual-duration log.
10. Export CSV, every-minute CSV, ICS, and JSON; restore the JSON backup.
11. Narrow the window and use Tab / Shift+Tab / Escape through dialogs.
12. Print the current view or save it as a PDF.
