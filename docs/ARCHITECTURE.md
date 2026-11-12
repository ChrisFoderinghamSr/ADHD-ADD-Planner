# Daylight architecture

## Deliberately small stack

Semantic HTML, responsive CSS, and vanilla JavaScript. There are no framework or
network dependencies. The scheduling engine exports to CommonJS for Node tests
and to `window.Daylight` for the browser. Script files are loaded with `defer`
in dependency order, allowing the application to open from a local file.

## Source of truth

Every calendar view calls `buildPlan(state, date)` in `planner.js`.
It returns 1,440 minute slots, their contiguous visual segments, focus blocks,
waiting tasks, conflicts, unplaced time, and daily metrics. The browser caches
date plans and invalidates them whenever state changes. Calendar clicks change
the selected date, so the day and task details use the same occurrence.

## Scheduling logic

Slots begin as `sleep`, `open`, or `work` based on profile times and weekday.
Overnight work includes the early-morning continuation of the previous workday.
Fixed commitments claim compatible waking slots. Conflicts are reported instead
of replacing sleep or a preceding commitment.

Ready task occurrences are ordered by due date, priority, and insertion. The
engine scans compatible free slots for each block. Full blocks stay intact;
the final remainder may be smaller. Reset slots consume free waking time.
Unplaced task minutes are returned as overflow. No user task can claim an
already occupied minute, and no plan has gaps in its wall-clock representation.

This is an earliest-fit whole-day planner, not an optimization solver. A plan
can have a small free gap while a larger block remains unscheduled. It does not
reschedule an earlier day based on the current clock, infer prerequisites from
other tasks, or automatically move overflow across dates.

## Data shape, version 1

```javascript
{
  version: 1,
  configured: true,
  profile: {
    name: '', wake: '07:00', sleep: '23:00',
    workStart: '09:00', workEnd: '17:00',
    workDays: [1, 2, 3, 4, 5], block: 15, buffer: 5
  },
  tasks: [/* id, title, context, category, minutes, block, priority,
             date, due, repeat, requirements[], steps[], notes */],
  events: [/* id, title, start, end, date, repeat, category */],
  doneBlocks: { /* 'date|taskId|offset': completion record */ },
  stepChecks: { /* 'date|taskId|step-index': boolean */ },
  logs: [/* id, title, minutes, date: full task duration */],
  goals: [/* id, title, quarter: '2026-Q4', done */],
  timer: null // or a locally saved session, omitted from backups
}
```

Dates are local `YYYY-MM-DD` calendar values. Date arithmetic uses local noon to
avoid shifting dates across UTC offsets. Clock values are strictly parsed, and
the day-end marker is `24:00` for display and permitted event endpoints only.
ICS midnight endpoints are converted to the next date’s `00:00`.

## Progress and estimates

Block completion is keyed by occurrence date, task ID, and minute offset within
the task. Completing a whole task uses the `all` offset marker. Step checks are
date-scoped so a recurring task starts with fresh steps each day. Requirements
represent task-level readiness. Full-task actual-duration logs are separate
from the focus timer and block completion. Mean estimates use the most recent
20 normalized-name matches.

## Input and export boundaries

Form text is escaped before HTML rendering. Imported JSON is validated with
bounded record counts, known IDs, date formats, time formats, and task fields.
Only supported top-level state fields and known profile fields are copied.
CSV text is quoted and formula prefixes are neutralized. ICS text is escaped
and lines are folded at 75 UTF-8 bytes, preserving complete Unicode characters.
The optional server limits paths to its own folder and serves only web assets.

## Extending the project

Keep scheduling logic independent of rendering. Extend the state version and
migrations when changing the data contract. Use date/occurrence keys for any
new completion feature. Validate backups before writing them. If adding cloud
sync later, define authentication, conflict resolution, deletion/recovery, and
data-access rules before replacing browser-only persistence.

Preserve the schedule’s invariant: exactly one owner for every wall-clock
minute, with fixed time protected and overflow explicit.
