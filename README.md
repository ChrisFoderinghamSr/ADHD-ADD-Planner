# Daylight — one block at a time

A calm, offline planning platform built for people who want clearer structure,
smaller next steps, and less to keep in their head. It supports ADHD/ADD-friendly
planning without assuming that everyone has the same routine or pace.

## Start in under a minute

1. Extract **all** files from the ZIP into one folder.
2. Open **index.html** in a current Chrome, Edge, Firefox, or Safari browser.
3. The first screen asks **“What does your day look like?”** Enter wake, sleep,
   work/school hours, and working weekdays. All clock inputs use **24-hour HH:MM**.
4. Choose a default **10, 15, 20, or 30 minute** focus block and a 0, 5, or 10 minute
   reset. A blank workweek means no separate work window.
5. Add **fixed time** for meals, commuting, appointments, pickups, or other anchors.
6. Add a task: estimate active minutes, choose when it fits, record what you need,
   and break it into small steps. Check requirements when you are ready.

You can choose **Explore an example** on the first screen instead. The example is
fictional and editable; it is not your actual schedule. No account, installation,
internet connection, API key, or dependency download is required.

If your browser restricts storage for local files, use the optional local server:

```powershell
cd "C:\path\to\daylight"
node server.cjs
```

Open **http://127.0.0.1:4173**. Keep that terminal open while using the server.
Use the same browser and address each time to return to the same saved planner.

## What is included

| Feature | How to use it |
| --- | --- |
| Full-day planning | Daily plan covers 00:00–24:00, including sleep, work capacity, commitments, focus, resets, and open time. |
| Small focus blocks | Choose 10, 15, 20, or 30 minutes per task. A final block may be shorter to match the exact task estimate. |
| Work and personal time | Give each task a work/school, personal, or any-free-time context. |
| Requirements | Materials, access, documents, and prerequisites are checklists. Tasks with unchecked requirements wait until they are ready. |
| Tiny steps | Break a task into the next few actions. Step completion is tracked separately for each selected date. |
| Task inbox | Search and filter by category, selected day, or waiting requirements. Edit, move, or delete tasks. |
| Recurrence | Once, daily, weekdays, weekly, monthly, or quarterly for tasks and fixed commitments. |
| Focus timer | Start, pause, resume, reset, and complete a selected block. Running sessions use elapsed wall time and survive a refresh on the same browser origin. |
| Daily calendar | Exact blocks, progress, estimates, open capacity, and fixed commitments. |
| Weekly calendar | A seven-day view with each planned task block and commitment. |
| Monthly calendar | Date grid with recurring tasks and days that need attention. |
| Quarterly calendar | Three months with workload indicators and quarterly intention checklists. |
| Every minute | Browse 60 one-minute rows at a time; export the entire 1,440-row day. |
| Your own averages | Record the complete task’s actual active minutes; see the mean of its latest 20 logs. |
| Backup and restore | Download JSON and restore it after confirming replacement. |
| CSV and calendar export | Download time blocks, every minute, or ICS for the current calendar period. |
| Print | Print the selected view or choose your browser’s Save as PDF destination. |

## How scheduling decisions work

1. **Protect rest.** Wake/sleep times define an awake window. Overnight waking and
   working schedules are supported, including work that finishes the next day.
2. **Label work time.** Work hours are capacity for work/school tasks, rather than
   a single immovable event. Personal tasks only use waking time outside work.
3. **Place fixed commitments.** Meals and appointments occupy time before tasks.
   Conflicts with sleep or another commitment are flagged. Sleep and the first
   commitment keep their minutes; an overlapping commitment is never double-booked.
   Edit the conflicting times in Task inbox. Work hours overlapping sleep are
   rejected in settings.
4. **Check readiness.** Tasks with any unchecked requirement remain visible as
   waiting and are not automatically scheduled.
5. **Choose task order.** Earliest due dates come first, then priority 1, 2, 3,
   then insertion order. Tasks without a due date come after tasks with due dates.
6. **Find compatible space.** Each task is split into its selected block size.
   Blocks are placed at the earliest compatible free time, with resets between
   them. A reset may be shorter at an appointment boundary. A full-sized block
   is not squeezed into a smaller gap; the final remainder may be shorter.
7. **Show what did not fit.** Unplaced minutes appear in an attention message.
   Choose a smaller block, reduce the estimate, change the context, or move the
   task to another date. It is never silently moved into sleep or another day.

Example: a **47-minute** work task in **20-minute** blocks becomes **20 + 20 + 7**
minutes, with the selected resets. A **90-minute** task can span separate free
work periods around lunch.

The planner builds a **whole-day plan**, including earlier hours when planning
today. It does not rewrite the past or automatically begin at the current time.
Completion marks reflect your own updates; the clock does not mark tasks done.
Changing an estimate, block size, starting date, or recurrence clears that task’s
completion marks so they cannot be misapplied to a different set of blocks.
Editing steps clears the task’s stored step checks.

## Recurring tasks and dates

- A one-time task remains on its first planned date. It does not automatically
  roll forward. Open it on a different selected day and choose **Move to selected
  day**, or edit its date.
- The due date orders tasks within the planned day. It does not search the whole
  week for a free slot or automatically move a task before its deadline.
- Weekly tasks use the weekday of their first date.
- Monthly tasks use the same day number, or the last day in shorter months.
  A task anchored on 31 January appears on 28 February (29 in a leap year), then
  on 31 March. Quarterly tasks use the same rule every three months.
- Requirements describe ongoing readiness. Tiny-step and block completion are
  separate for each calendar date; completing today does not complete tomorrow.
- An end time earlier than a fixed commitment’s start continues into the next
  day. **24:00** is allowed only as a commitment’s end. Every other clock input
  uses **00:00–23:59**, with leading zeroes.

## Estimates and actual averages

Starter task templates have **editable starting estimates**, not measured
population averages. People and tasks vary.

Open a task and record its **full active duration once per completed task**.
For a task split into three blocks, enter the total active minutes across all
three blocks, excluding breaks and passive waiting. Partial timer sessions do
not automatically change the average. You can remove incorrect logs in **My
pace**. Task names are compared without case or surrounding whitespace.

After logging time, type the same task name in the task form and choose **Use
this estimate**. Your latest 20 logs determine the suggested mean. Existing
estimates do not change until you choose to use that number.

## Data, backup, and exports

All application assets are local. There are no analytics, external fonts,
advertising, network services, or remote accounts. Settings, tasks, logs, and
progress are saved in this browser’s local storage when the browser permits it.
Other people using the same browser profile can access that data. Moving the
folder, changing the URL or browser, using a private window, or clearing browser
data may give you a different or empty planner.

Use **Export & backup → Full backup · JSON** regularly. Restore validates the
backup and asks before replacing the current planner. Backups do not contain a
running timer. Browser storage is not a cross-device sync service.

CSV clock columns use 24-hour strings. The per-minute file contains a header
plus **1,440 data rows**. CSV cells that could be interpreted as spreadsheet
formulas are neutralized. ICS exports include focus blocks and fixed
commitments for the current day, week, month, or quarter, using **floating local
time**. Check the destination calendar’s timezone when importing. Importing ICS
is a one-way copy, and repeated imports may create duplicates in some calendars.

The daily grid always has **1,440 wall-clock labels**. Daylight-saving transition
days can contain a different amount of actual elapsed time; the grid is a
planning representation, not payroll or timezone accounting. Timer countdowns
use elapsed time. A closed browser cannot deliver a live timer notification;
reopening calculates remaining time. Timers do not automatically complete tasks.

## Accessibility and keyboard

- Use Tab / Shift+Tab to move, Enter / Space to activate buttons, and Escape to
  close a dialog. Native dialogs contain focus while open.
- Press **N** outside a form or dialog to open a new task.
- The first keyboard link skips directly to the planner.
- Buttons have text or accessible names, checklists use native inputs, and
  color is supplemented with labels. Reduced-motion preferences are respected.
- The layout adapts to narrow screens. On mobile, use **My daily rhythm** from
  Task inbox / My pace, or **My day & settings** in the desktop sidebar.
- Timer values use **minutes:seconds** as a countdown; appointment and schedule
  clock times always use 24-hour HH:MM.

## Developer notes and validation

No dependency installation or build step is needed. Optional Node.js 18+ commands:

```powershell
node --check planner.js
node --check app.js
node --test tests/planner.test.cjs
node server.cjs
```

The included tests exercise scheduling invariants, protected time, exact
coverage, task context, all block sizes, overflow, requirements, overnight
work/events, recurrence, personal averages, completion, CSV safety, ICS format,
backup validation, and generated mixed schedules. See **VALIDATION.md** for the
checks performed on this release and the browser verification limit.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | App shell and accessible entry, task, commitment, timer, backup, and confirmation dialogs. |
| `styles.css` | Responsive visual design, focus styles, reduced motion, and print layouts. |
| `planner.js` | Documented pure scheduling and export engine, usable in browser or Node. |
| `app.js` | View rendering, forms, checklists, timer, persistence, backups, and exports. |
| `icon.svg` | Local Daylight app icon. |
| `server.cjs` | Optional local HTTP server, bound only to loopback. |
| `tests/planner.test.cjs` | Automated scheduling/export/data integrity checks. |
| `package.json` | Optional `npm start` and `npm test` shortcuts; no dependencies. |
| `docs/ARCHITECTURE.md` | Scheduling model, data shape, and extension notes. |

This is a complete standalone browser application. It does not include shared
accounts, cloud synchronization, external calendar login, SMS, or background
push notifications.
#   A D H D - A D D - P l a n n e r  
 