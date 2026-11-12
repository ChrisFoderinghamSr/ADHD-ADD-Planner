/*
 * Browser controller. Data is local, text is escaped before rendering, and all
 * calendar views use the same scheduling engine so they show the same plan.
 */
(function () {
  'use strict';
  const D = window.Daylight, $ = selector => document.querySelector(selector);
  const STORAGE = 'daylight.planner.v1';
  const icons = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    inbox: '<path d="M4 4h16l2 12v4H2v-4L4 4Zm-2 12h6l2 3h4l2-3h6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-13 4h1m6 0h1m-8 3h1"/>',
    chart: '<path d="M4 3v17h17M8 15v-3m5 3V7m5 8v-6"/>',
    settings: '<path d="m9 3 1-1h4l1 3 3 1 3 2-1 3 1 3-2 3-3 1-1 3h-4l-1-3-3-1-2-3 1-3-1-3 2-3 3-1Z"/><circle cx="12" cy="11" r="3"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    spark: '<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z"/>',
    leaf: '<path d="M20 3C8 1 2 7 4 15s15 8 16-12ZM4 20 15 9"/>',
    play: '<path d="m8 4 12 8L8 20V4Z"/>',
    reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
    list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1"/>',
    print: '<path d="M6 8V2h12v6M6 17H3V8h18v9h-3M6 14h12v8H6v-8Zm11-3h1"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 3 5 5"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.sun) + '</svg>'; }
  function hydrateIcons() { document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute('data-icon'); }); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  const duration = n => n < 60 ? n + ' min' : Math.floor(n / 60) + 'h' + (n % 60 ? ' ' + n % 60 + 'm' : '');
  const today = () => D.localDate(new Date());
  const shortDate = date => D.dateObject(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const fullDate = date => D.dateObject(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const categoryClass = category => String(category || '').toLowerCase() + '-category';
  let state, storageOkay = true, recoveryMessage = '';
  try { const stored = localStorage.getItem(STORAGE); state = stored ? D.validateState(JSON.parse(stored)) : D.freshState(); if (stored) { const raw = JSON.parse(stored); if (raw.timer && Number.isFinite(raw.timer.duration) && raw.timer.duration > 0 && raw.timer.duration <= 1800 && Number.isFinite(raw.timer.remaining) && raw.timer.remaining >= 0 && raw.timer.remaining <= raw.timer.duration && (raw.timer.startedAt === null || Number.isFinite(raw.timer.startedAt)) && typeof raw.timer.title === 'string' && typeof raw.timer.blockId === 'string') state.timer = raw.timer; } }
  catch (error) { state = D.freshState(); storageOkay = false; recoveryMessage = 'Saved data could not be opened. Import a valid backup or set up a new day. The existing saved data has not been overwritten.'; }
  let selectedDate = today(), view = 'day', minuteOpen = false, minuteHour = 7, search = '', filter = 'all';
  let detailTaskId = null, confirmAction = null, toastId, planCache = new Map(), revision = 0;
  function save() {
    revision++; planCache.clear();
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); storageOkay = true; recoveryMessage = ''; }
    catch { storageOkay = false; toast('This browser could not save. Download a JSON backup to keep your changes.'); }
    $('#save-dot').style.background = storageOkay ? '#709566' : '#c58951';
  }
  function plan(date = selectedDate) { if (!planCache.has(date)) planCache.set(date, D.buildPlan(state, date)); return planCache.get(date); }
  function toast(message) { clearTimeout(toastId); const el = $('#toast'); el.textContent = message; el.classList.add('show'); toastId = setTimeout(() => el.classList.remove('show'), 4800); }
  function showDialog(id) { const el = $('#' + id); if (!el.open) el.showModal(); }
  function closeDialog(el) { const dlg = el && el.closest('dialog'); if (dlg) dlg.close(); }
  function confirm(message, action) { confirmAction = action; $('#confirm-message').textContent = message; showDialog('confirm-dialog'); }
  function periodDates() {
    const d = D.dateObject(selectedDate);
    if (view === 'week') { const start = D.addDays(selectedDate, -((d.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => D.addDays(start, i)); }
    if (view === 'month' || view === 'quarter') {
      const startMonth = view === 'quarter' ? Math.floor(d.getMonth() / 3) * 3 : d.getMonth();
      const count = view === 'quarter' ? 3 : 1;
      const first = new Date(d.getFullYear(), startMonth, 1, 12), last = new Date(d.getFullYear(), startMonth + count, 0, 12);
      return Array.from({ length: Math.round((last - first) / 86400000) + 1 }, (_, i) => D.addDays(D.localDate(first), i));
    }
    return [selectedDate];
  }
  function viewSwitch() { return '<div class="view-switch" aria-label="Calendar view">' + [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter']].map(([id, label]) => '<button data-action="view" data-view="' + id + '" aria-pressed="' + (view === id) + '" class="' + (view === id ? 'active' : '') + '">' + label + '</button>').join('') + '</div>'; }
  function dateControls() { return '<div class="date-controls"><button class="icon-button" data-action="prev" aria-label="Previous period">‹</button><button class="today-button" data-action="today">Today</button><input type="date" id="selected-date" min="1901-01-01" max="2199-12-31" aria-label="Selected date" value="' + selectedDate + '"><button class="icon-button" data-action="next" aria-label="Next period">›</button></div>'; }
  function heading(title, subtitle, controls = true) { return '<div class="page-heading"><div><div class="eyebrow">YOUR DAY, IN SMALL STEPS</div><h1>' + esc(title) + '</h1><p>' + esc(subtitle) + '</p></div>' + (controls ? dateControls() : '<button class="button secondary" data-action="settings">' + icon('settings') + ' My daily rhythm</button>') + '</div>'; }
  function empty(title, copy, action, label) { return '<div class="empty">' + icon('leaf') + '<strong>' + esc(title) + '</strong><p>' + esc(copy) + '</p>' + (action ? '<button class="button secondary" data-action="' + action + '">' + esc(label) + '</button>' : '') + '</div>'; }
  function stats(p) {
    const done = p.blocks.filter(b => D.isDone(state, b)).length;
    const rows = [
      ['Focus time', duration(p.focus), 'in small, manageable blocks', 'clock'],
      ['Blocks completed', done + '<span>/ ' + p.blocks.length + '</span>', done ? 'Every little step counts' : 'A fresh start is enough', 'check'],
      ['Room to breathe', duration(p.free), 'unfilled waking time', 'leaf'],
      ['Day accounted for', '1,440<span>min</span>', '00:00 → 24:00, including rest', 'calendar']
    ];
    return '<div class="stats-row">' + rows.map(([title, value, sub, ic]) => '<div class="stat-card"><div class="stat-head">' + title + icon(ic) + '</div><div class="stat-value">' + value + '</div><div class="stat-foot">' + sub + '</div></div>').join('') + '</div>';
  }
  function warning(p) {
    let out = '';
    if (p.conflicts.length) out += '<div class="warning"><strong>Some commitments overlap.</strong>' + p.conflicts.map(esc).join('<br>') + '<br>Open Task inbox to edit the fixed times. Conflicting minutes keep the first commitment.</div>';
    if (p.overflow.length || p.waiting.length) {
      out += '<div class="warning"><strong>There’s only so much room in a day.</strong><div class="waiting-list">';
      for (const { task, minutes } of p.overflow) out += '<span>' + esc(task.title) + ' · ' + duration(minutes) + ' still needs space <button class="text-button" data-action="edit-task" data-id="' + task.id + '">Adjust</button></span>';
      for (const task of p.waiting) out += '<span>' + esc(task.title) + ' · waiting for requirements <button class="text-button" data-action="detail" data-id="' + task.id + '">Check what’s needed</button></span>';
      out += '</div></div>';
    }
    return out;
  }
  function blockRow(s) {
    const task = s.taskId ? state.tasks.find(t => t.id === s.taskId) : null, done = task && D.isDone(state, s);
    let meta = '<span class="time-range">' + D.time(s.start) + ' – ' + D.time(s.end) + '</span><span>·</span><span>' + duration(s.end - s.start) + '</span>';
    if (task) meta += '<span class="category-label">' + esc(task.category) + '</span><span>' + (s.offset + (s.end - s.start) < task.minutes ? 'Part ' + (Math.floor(s.offset / task.block) + 1) : 'Final block') + '</span>';
    const text = '<span class="timeline-title">' + esc(s.title) + '</span><span class="timeline-meta">' + meta + '</span>';
    const action = task ? '<div class="block-actions"><button class="round-check ' + (done ? 'done' : '') + '" data-action="toggle-block" data-id="' + s.id + '" aria-label="' + (done ? 'Reopen ' : 'Complete ') + esc(s.title) + ' at ' + D.time(s.start) + '" aria-pressed="' + !!done + '">' + (done ? '✓' : '') + '</button>' + (!done ? '<button class="play-button" data-action="focus" data-id="' + s.id + '" aria-label="Start focus on ' + esc(s.title) + '">' + icon('play') + '</button>' : '') + '</div>' : s.kind === 'event' ? '<button class="icon-button" data-action="edit-event" data-id="' + s.eventId + '" aria-label="Edit ' + esc(s.title) + '">' + icon('edit') + '</button>' : '';
    return '<div class="timeline-row"><span class="time-mark">' + D.time(s.start) + '</span><div class="timeline-card ' + s.kind + ' ' + (task ? categoryClass(task.category) : '') + (done ? ' completed' : '') + '">' + (task ? '<button class="task-link" data-action="detail" data-id="' + task.id + '">' + text + '</button>' : '<div>' + text + '</div>') + action + '</div></div>';
  }
  function stepDone(task, index) { const k = D.key(selectedDate, task.id, 'step-' + index); return Object.hasOwn(state.stepChecks, k) ? !!state.stepChecks[k] : !!task.steps[index].done; }
  function nextStep(task) { return task.steps.find((s, i) => !stepDone(task, i)); }
  function nextBlock(p) { return p.blocks.find(b => !D.isDone(state, b)); }
  function rightColumn(p) {
    const next = nextBlock(p), task = next && state.tasks.find(t => t.id === next.taskId), progress = p.focus ? p.completed / p.focus * 100 : 0;
    const step = task && nextStep(task);
    return '<aside class="right-stack"><div class="focus-card"><div class="eyebrow">' + icon('spark') + ' YOUR NEXT LITTLE STEP</div><h3>' + (task ? esc(task.title) : 'A little space to begin.') + '</h3><p>' + (step ? esc(step.text) : task ? 'Everything you need is ready. Start with just this block.' : 'Add one task, or enjoy the breathing room.') + '</p>' + (next ? '<div class="focus-mini-meta"><span>' + D.time(next.start) + ' – ' + D.time(next.end) + '</span><span>' + duration(next.end - next.start) + ' focus</span></div><button class="button primary" data-action="focus" data-id="' + next.id + '">' + icon('play') + ' Start this block</button>' : '<button class="button primary" data-action="add-task">＋ Add a small task</button>') + '<div class="progress-track"><i style="width:' + progress + '%"></i></div><div class="focus-mini-meta"><span>Today’s small steps</span><span>' + Math.round(progress) + '%</span></div></div><div class="panel"><div class="panel-header"><h3>On your list</h3><span class="pill">' + p.tasks.length + ' TASKS</span></div><div class="inbox-list">' + (p.tasks.slice(0, 5).map(t => {
      const taskBlocks = p.blocks.filter(b => b.taskId === t.id), complete = !!state.doneBlocks[D.key(selectedDate, t.id, 'all')] || taskBlocks.length && !p.overflow.some(o => o.task.id === t.id) && taskBlocks.every(b => D.isDone(state, b));
      return '<div class="mini-task"><button class="round-check ' + (complete ? 'done' : '') + '" data-action="complete-task" data-id="' + t.id + '" aria-label="' + (complete ? 'Reopen ' : 'Complete ') + esc(t.title) + '">' + (complete ? '✓' : '') + '</button><button class="task-link" data-action="detail" data-id="' + t.id + '"><strong>' + esc(t.title) + '</strong><p>' + duration(t.minutes) + ' · ' + esc(t.category) + '</p></button><i class="dot ' + t.category.toLowerCase() + '"></i></div>';
    }).join('') || empty('One task is plenty.', 'Capture something small to get started.', '', '')) + '</div><div class="timeline-footer"><button class="text-button" data-action="view" data-view="tasks">See all tasks →</button><button class="text-button" data-action="add-task">＋ Add</button></div></div><div class="gentle-note">' + icon('leaf') + '<p>Your schedule is a guide, not a test. Adjust a block, take a break, and begin again.</p></div></aside>';
  }
  function minuteTable(p) {
    const start = minuteHour * 60;
    return '<div class="panel minute-card" id="minute-view"><div class="panel-header"><div><h3>Every minute, made visible</h3><p>All 1,440 minutes are accounted for. Browse one hour at a time.</p></div><div class="minute-tools"><label for="minute-hour">Hour</label><select id="minute-hour">' + Array.from({ length: 24 }, (_, i) => '<option value="' + i + '" ' + (i === minuteHour ? 'selected' : '') + '>' + D.time(i * 60) + '</option>').join('') + '</select></div></div><table class="minute-table"><thead><tr><th scope="col">24-hour time</th><th scope="col">Activity</th><th scope="col">Type</th></tr></thead><tbody>' + Array.from({ length: 60 }, (_, i) => {
      const n = start + i, s = p.slots[n]; return '<tr><td>' + D.time(n) + ' – ' + D.time(n + 1) + '</td><td>' + esc(s.title) + '</td><td>' + esc({ focus: 'Focus', sleep: 'Rest', open: 'Open', work: 'Work capacity', event: 'Commitment', buffer: 'Reset' }[s.kind]) + '</td></tr>';
    }).join('') + '</tbody></table><div class="timeline-footer"><span>' + D.time(start) + ' – ' + D.time(start + 60) + ' · 60 of 1,440 minutes</span><button class="text-button" data-action="download-minutes">Export all minutes</button></div></div>';
  }
  function dailyView() {
    const p = plan(), isToday = selectedDate === today(), name = state.profile.name ? ', ' + state.profile.name : '';
    return heading(isToday ? 'A little more clarity' + name + '.' : fullDate(selectedDate), isToday ? fullDate(selectedDate) + ' · A fresh day. A few small steps.' : 'Your plan, one manageable block at a time.') + '<section class="welcome-banner"><div><div class="eyebrow">LESS OVERWHELM. MORE MOMENTUM.</div><h2>You don’t need to do it all.<br>Just the next small thing.</h2><p>Your tasks, your time, and space to breathe in between.</p></div><div class="banner-art" aria-hidden="true"></div></section>' + stats(p) + warning(p) + '<div class="schedule-toolbar"><div><h3>Your daily plan</h3><p class="schedule-note">' + icon('lock') + ' Sleep and fixed commitments come first.</p></div>' + viewSwitch() + '</div><div class="day-layout"><section class="panel"><div class="panel-header"><div><h3>Today, in little blocks</h3><p>Every minute has a place. Open time is a place, too.</p></div><button class="text-button" data-action="add-event">＋ Fixed time</button></div><div class="timeline">' + p.segments.map(blockRow).join('') + '<div class="timeline-end">24:00 · A whole day, with room for you.</div></div><div class="timeline-footer"><span>' + p.blocks.length + ' focus blocks · ' + duration(p.resets) + ' reset time</span><button class="text-button" data-action="toggle-minutes">' + (minuteOpen ? 'Hide minute view' : 'See every minute') + '</button></div></section>' + rightColumn(p) + '</div>' + (minuteOpen ? minuteTable(p) : '');
  }
  function repeatLabel(t) { return ({ none: 'Once', daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' })[t.repeat] || 'Once'; }
  function tasksView() {
    const tasks = state.tasks.filter(t => (!search || (t.title + ' ' + t.notes + ' ' + t.category).toLowerCase().includes(search.toLowerCase())) && (filter === 'all' || (filter === 'waiting' ? t.requirements.some(r => !r.done) : filter === 'today' ? D.occurs(t, selectedDate) : t.category === filter)));
    const starter = D.TEMPLATES.map((t, i) => '<button class="template-card" data-action="template" data-index="' + i + '"><b>＋</b><strong>' + esc(t.title) + '</strong><span>' + t.minutes + ' min starting estimate · ' + esc(t.category) + '</span></button>').join('');
    return heading('Get it out of your head.', 'Capture it first. Break it down. Make room when you’re ready.', false) + '<div class="section-label">Start with something small <span>Editable starting estimates, matched to your pace</span></div><div class="template-grid">' + starter + '</div><div class="toolbar"><h3>My tasks <span class="pill">' + tasks.length + '</span></h3><div class="filter-group"><input type="search" id="task-search" placeholder="Find a task…" aria-label="Search tasks" value="' + esc(search) + '"><select id="task-filter" aria-label="Filter tasks">' + [['all', 'All tasks'], ['today', 'On selected day'], ['waiting', 'Waiting for requirements'], ...D.CATEGORIES.map(c => [c, c])].map(([v, text]) => '<option value="' + v + '" ' + (filter === v ? 'selected' : '') + '>' + text + '</option>').join('') + '</select></div></div><div class="panel table-wrap">' + (tasks.length ? '<table class="task-table"><thead><tr><th scope="col">TASK / NEXT STEP</th><th scope="col">TIME & PACE</th><th scope="col">SCHEDULE</th><th scope="col">READY?</th><th scope="col"><span class="optional">Actions</span></th></tr></thead><tbody>' + tasks.map(t => {
      const avg = D.average(state.logs, t.title), step = nextStep(t), ready = t.requirements.every(r => r.done);
      return '<tr><td><button class="task-link" data-action="detail" data-id="' + t.id + '"><span class="task-name">' + esc(t.title) + '</span><span class="task-sub" style="display:block">' + (step ? esc(step.text) : esc(t.category)) + '</span></button></td><td><span class="nowrap">' + duration(t.minutes) + ' · ' + t.block + ' min blocks</span><p class="task-sub">' + (avg ? 'Your average: ' + avg.minutes + ' min (' + avg.count + ' logs)' : 'Your estimate') + '</p></td><td>' + shortDate(t.date) + '<p class="task-sub">' + repeatLabel(t) + ' · ' + ({ work: 'Work time', personal: 'Personal time', any: 'Any free time' })[t.context] + '</p></td><td><span class="pill ' + (ready ? '' : 'warn') + '">' + (ready ? 'Ready' : 'Waiting') + '</span></td><td><div class="task-actions"><button class="icon-button" data-action="edit-task" data-id="' + t.id + '" aria-label="Edit ' + esc(t.title) + '">' + icon('edit') + '</button><button class="icon-button danger" data-action="delete-task" data-id="' + t.id + '" aria-label="Delete ' + esc(t.title) + '">' + icon('trash') + '</button></div></td></tr>';
    }).join('') + '</tbody></table>' : empty('A little space for your next task.', search ? 'Try another search or filter.' : 'Add a task or choose a starting point above.', 'add-task', '＋ New task')) + '</div><p class="field-hint" style="margin-top:12px">One-time tasks stay on their planned date until you move them. Select a task to move it, check requirements, or record the full task’s actual duration.</p><div class="section-label"><h3>Fixed commitments</h3><button class="text-button" data-action="add-event">＋ Add fixed time</button></div><div class="commitment-list">' + (state.events.length ? state.events.map(e => '<div class="commitment"><div><strong>' + esc(e.title) + '</strong><p>' + e.start + ' – ' + e.end + ' · ' + repeatLabel(e) + ' · from ' + shortDate(e.date) + '</p></div><div class="panel-actions"><button class="icon-button" data-action="edit-event" data-id="' + e.id + '" aria-label="Edit ' + esc(e.title) + '">' + icon('edit') + '</button><button class="icon-button danger" data-action="delete-event" data-id="' + e.id + '" aria-label="Delete ' + esc(e.title) + '">' + icon('trash') + '</button></div></div>').join('') : empty('Protect your everyday anchors.', 'Add meals, appointments, commutes, or family time.', 'add-event', '＋ Add fixed time')) + '</div>';
  }
  function weekView() {
    const dates = periodDates();
    return heading('A week with breathing room.', shortDate(dates[0]) + ' – ' + fullDate(dates[6])) + '<div class="calendar-top"><p class="muted" style="font-size:12px">Choose a date for the full minute-by-minute plan.</p>' + viewSwitch() + '</div><div class="week-grid">' + dates.map(date => {
      const p = plan(date), d = D.dateObject(date);
      return '<section class="week-day ' + (date === today() ? 'today' : '') + '"><button class="week-heading" data-action="open-date" data-date="' + date + '"><span>' + d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase() + '</span><strong>' + d.getDate() + '</strong></button><div class="week-load">' + duration(p.focus) + ' focus · ' + duration(p.free) + ' free' + (p.overflow.length || p.waiting.length || p.conflicts.length ? '<br><span class="pill warn">Needs a look</span>' : '') + '</div>' + p.segments.filter(s => ['focus', 'event'].includes(s.kind)).map(s => '<button class="week-block ' + s.kind + ' ' + (s.taskId ? categoryClass(s.category) : '') + '" data-action="' + (s.taskId ? 'calendar-detail' : 'open-date') + '" data-date="' + date + '" data-id="' + (s.taskId || '') + '"><small>' + D.time(s.start) + ' – ' + D.time(s.end) + '</small><strong>' + esc(s.title) + '</strong></button>').join('') + (!p.tasks.length ? '<p class="week-open">Room for something small.</p>' : '') + '</section>';
    }).join('') + '</div>';
  }
  function monthView() {
    const d = D.dateObject(selectedDate), first = D.localDate(new Date(d.getFullYear(), d.getMonth(), 1, 12));
    const start = D.addDays(first, -((D.dateObject(first).getDay() + 6) % 7)), cells = [];
    for (let i = 0; i < 42; i++) {
      const date = D.addDays(start, i), dt = D.dateObject(date), p = plan(date), taskList = p.tasks.slice(0, 2), events = p.segments.filter(s => s.kind === 'event');
      cells.push('<button class="month-cell ' + (dt.getMonth() !== d.getMonth() ? 'outside ' : '') + (date === today() ? 'today ' : '') + (date === selectedDate ? 'selected' : '') + '" data-action="open-date" data-date="' + date + '" aria-label="' + esc(fullDate(date) + ', ' + p.tasks.length + ' tasks') + '"><span class="month-date">' + dt.getDate() + '</span>' + taskList.map(t => '<span class="calendar-task ' + t.category.toLowerCase() + '">' + esc(t.title) + '</span>').join('') + (p.tasks.length > 2 ? '<span class="calendar-event">＋' + (p.tasks.length - 2) + ' more tasks</span>' : events[0] ? '<span class="calendar-event">' + D.time(events[0].start) + ' ' + esc(events[0].title) + '</span>' : '') + ((p.overflow.length || p.waiting.length || p.conflicts.length) ? '<span class="calendar-overflow">Needs a look</span>' : p.focus ? '<span class="calendar-event">' + duration(p.focus) + ' focus</span>' : '') + '</button>');
    }
    return heading(d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), 'See the bigger picture. Keep the next step small.') + '<div class="calendar-top"><p class="muted" style="font-size:12px">Recurring tasks and fixed commitments appear automatically.</p>' + viewSwitch() + '</div><div class="calendar-grid">' + ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => '<div class="weekday-label">' + day + '</div>').join('') + cells.join('') + '</div>';
  }
  function quarterKey(date) { const d = D.dateObject(date); return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1); }
  function quarterView() {
    const d = D.dateObject(selectedDate), q = Math.floor(d.getMonth() / 3), dates = periodDates();
    let planned = 0, attention = 0, active = 0;
    for (const date of dates) { const p = plan(date); planned += p.focus; if (p.overflow.length || p.waiting.length || p.conflicts.length) attention++; if (p.tasks.length) active++; }
    const months = Array.from({ length: 3 }, (_, m) => {
      const first = new Date(d.getFullYear(), q * 3 + m, 1, 12), end = new Date(d.getFullYear(), q * 3 + m + 1, 0, 12).getDate(), offset = (first.getDay() + 6) % 7;
      return '<section class="mini-month"><h3>' + first.toLocaleDateString(undefined, { month: 'long' }) + '</h3><div class="mini-grid">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => '<span>' + day + '</span>').join('') + '<span></span>'.repeat(offset) + Array.from({ length: end }, (_, i) => {
        const date = D.localDate(new Date(d.getFullYear(), q * 3 + m, i + 1, 12)), p = plan(date), needs = p.overflow.length || p.waiting.length || p.conflicts.length;
        return '<button class="mini-date ' + (p.tasks.length ? 'busy ' : '') + (needs ? 'warn ' : '') + (date === today() ? 'today' : '') + '" data-action="open-date" data-date="' + date + '" aria-label="' + esc(fullDate(date) + ', ' + p.tasks.length + ' tasks' + (needs ? ', needs attention' : '')) + '">' + (i + 1) + '</button>';
      }).join('') + '</div></section>';
    }).join('');
    const goals = state.goals.filter(g => g.quarter === quarterKey(selectedDate));
    return heading('Quarter ' + (q + 1) + ' · ' + d.getFullYear(), shortDate(dates[0]) + ' – ' + shortDate(dates[dates.length - 1]) + ' · A little progress, over time.') + '<div class="calendar-top"><div class="quarter-summary"><span><strong>' + active + '</strong> days with tasks</span><span><strong>' + duration(planned) + '</strong> planned focus</span><span><strong>' + attention + '</strong> days to review</span></div>' + viewSwitch() + '</div><div class="quarter-months">' + months + '</div><p class="field-hint" style="margin-top:12px">Green = tasks planned · Amber = requirements, overlaps, or tasks that need room. A date opens its daily plan.</p><section class="panel goals-box"><div class="panel-header"><div><h3>A few intentions for this quarter</h3><p>Keep the big picture gentle. Use tasks for the next action.</p></div><span class="pill">' + goals.filter(g => g.done).length + ' / ' + goals.length + '</span></div><div class="goal-list">' + (goals.length ? goals.map(g => '<div class="goal-item ' + (g.done ? 'done' : '') + '"><button class="round-check ' + (g.done ? 'done' : '') + '" data-action="goal-toggle" data-id="' + g.id + '" aria-label="' + (g.done ? 'Reopen ' : 'Complete ') + esc(g.title) + '">' + (g.done ? '✓' : '') + '</button><span>' + esc(g.title) + '</span><button class="icon-button danger" data-action="goal-delete" data-id="' + g.id + '" aria-label="Delete goal">' + icon('trash') + '</button></div>').join('') : empty('One intention is a good place to start.', 'What would make this quarter feel a little easier?', '', '')) + '</div><form id="goal-form" class="goal-form"><input name="goal" maxlength="160" required placeholder="Something I’d like to make space for…" aria-label="New quarterly intention"><button class="button primary" type="submit">＋ Add</button></form></section>';
  }
  function insightsView() {
    const titles = [...new Map(state.logs.map(l => [l.title.trim().toLowerCase(), l.title])).values()];
    const averages = titles.map(title => ({ title, ...D.average(state.logs, title) }));
    const max = Math.max(30, ...averages.map(a => a.minutes));
    return heading('Learn your own pace.', 'A useful estimate comes from your real life, not someone else’s stopwatch.', false) + '<div class="pace-grid"><section class="panel"><div class="panel-header"><h3>Your average active task time</h3><span class="pill">LAST 20 PER TASK</span></div>' + (averages.length ? '<div class="pace-chart">' + averages.map(a => '<div class="pace-row"><span>' + esc(a.title) + '<small class="field-hint" style="display:block">' + a.count + ' complete-task logs</small></span><div class="bar-track"><i style="width:' + a.minutes / max * 100 + '%"></i></div><b>' + a.minutes + ' min</b></div>').join('') + '</div>' : empty('Your own average starts here.', 'Open a task and record its full active duration after you finish it.', 'view-tasks', 'Open task inbox')) + '</section><section class="panel"><div class="panel-header"><h3>Make time visible, without pressure.</h3>' + icon('leaf') + '</div><div class="pace-info"><p><strong>Estimate active time.</strong> Include the time you spend doing the task. Give waiting time its own reminder or fixed commitment.</p><p><strong>Start with a small block.</strong> Pick 10, 15, 20, or 30 minutes. A final block can be shorter to match the estimate exactly.</p><p><strong>Record the whole task.</strong> Log the total active minutes for one completed task, across all its blocks. Timer blocks are not added to this average automatically.</p><p><strong>Adjust gently.</strong> Your latest 20 logged completions of a task with the same name become its suggested estimate. Existing tasks change only when you choose.</p></div></section></div><div class="section-label"><h3>Recent time logs</h3><span>' + state.logs.length + ' records</span></div><div class="panel">' + (state.logs.length ? state.logs.slice().reverse().slice(0, 30).map(l => '<div class="history-row"><div><strong>' + esc(l.title) + '</strong><br><small>' + esc(l.date || '') + ' · full task duration</small></div><span>' + duration(l.minutes) + ' <button class="text-button danger" data-action="log-delete" data-id="' + l.id + '">Remove</button></span></div>').join('') : empty('No time logs yet.', 'Your estimates can grow with your experience.', '', '')) + '</div>';
  }
  function render() {
    const names = { day: 'My daily plan', tasks: 'My task inbox', week: 'Weekly calendar', month: 'Monthly calendar', quarter: 'Quarterly calendar', insights: 'My pace' };
    $('#view-breadcrumb').textContent = names[view];
    document.querySelectorAll('#main-nav .nav-item').forEach(el => { const active = el.dataset.view === view || (['month', 'quarter'].includes(view) && el.dataset.view === 'week'); el.classList.toggle('active', active); if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    $('#profile-name').textContent = state.profile.name || 'Your space'; $('#avatar').textContent = (state.profile.name || 'Y').slice(0, 1).toUpperCase(); $('#inbox-count').textContent = state.tasks.length;
    const views = { day: dailyView, tasks: tasksView, week: weekView, month: monthView, quarter: quarterView, insights: insightsView };
    try { $('#content').innerHTML = (!storageOkay ? '<div class="storage-alert">' + esc(recoveryMessage || 'Your changes are in memory. Export a backup; browser storage is unavailable.') + ' <button class="text-button" data-action="export">Export & backup</button></div>' : '') + views[view](); }
    catch (error) { $('#content').innerHTML = heading('Let’s adjust your day.', error.message, false) + empty('Your daily rhythm needs a quick check.', 'Open settings to adjust your schedule.', 'settings', 'Open settings'); }
    hydrateIcons(); updateClock();
  }
  function openSettings() {
    const f = $('#setup-form'), p = state.profile;
    for (const name of ['name', 'wake', 'sleep', 'workStart', 'workEnd', 'block', 'buffer']) f.elements[name].value = p[name];
    $('#setup-weekdays').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((day, i) => '<label><input type="checkbox" name="workDays" value="' + day + '" ' + (p.workDays.includes(day) ? 'checked' : '') + '><span>' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] + '</span></label>').join('');
    $('#setup-error').textContent = ''; $('#demo-button').classList.toggle('hidden', state.configured); $('#setup-title').textContent = state.configured ? 'Your daily rhythm' : 'What does your day look like?'; showDialog('setup-dialog');
  }
  function openTask(id, templateIndex) {
    const f = $('#task-form'); f.reset();
    const original = id && state.tasks.find(t => t.id === id), template = templateIndex != null ? D.TEMPLATES[Number(templateIndex)] : null;
    const t = original || (template ? { ...template, requirements: template.requirements.map(text => ({ text, done: true })), steps: template.steps.map(text => ({ text, done: false })) } : {});
    const defaults = { id: '', title: '', category: 'Personal', context: 'any', minutes: 15, block: state.profile.block, date: selectedDate, due: '', priority: 2, repeat: 'none', notes: '' };
    Object.keys(defaults).forEach(name => { f.elements[name].value = t[name] == null ? defaults[name] : t[name]; });
    f.elements.requirements.value = (t.requirements || []).map(r => r.text).join('\n'); f.elements.steps.value = (t.steps || []).map(r => r.text).join('\n'); f.elements.ready.checked = !t.requirements || t.requirements.every(r => r.done);
    $('#task-title').textContent = original ? 'A small adjustment' : 'Make room for a task'; $('#task-error').textContent = ''; updateAverageHint(); showDialog('task-dialog');
  }
  function updateAverageHint() {
    const title = $('#task-form').elements.title.value, avg = D.average(state.logs, title);
    $('#average-hint').innerHTML = avg ? 'Your average: <strong>' + avg.minutes + ' minutes</strong> from ' + avg.count + ' complete-task logs. <button type="button" class="text-button" data-action="use-average">Use this estimate</button>' : 'Start with your best guess. Record actual task times to learn your own average.';
  }
  function openEvent(id) {
    const f = $('#event-form'); f.reset(); const e = state.events.find(e => e.id === id) || { id: '', title: '', start: '12:00', end: '12:30', date: selectedDate, repeat: 'none', category: 'Personal' };
    for (const name of ['id', 'title', 'start', 'end', 'date', 'repeat', 'category']) f.elements[name].value = e[name];
    $('#event-error').textContent = ''; showDialog('event-dialog');
  }
  function openDetail(id) {
    const t = state.tasks.find(t => t.id === id); if (!t) return; detailTaskId = id;
    const p = plan(), blocks = p.blocks.filter(b => b.taskId === id), completed = blocks.filter(b => D.isDone(state, b)).reduce((sum, b) => sum + b.end - b.start, 0), avg = D.average(state.logs, t.title);
    const checklist = (type, caption) => '<div class="detail-section">' + caption + '</div><div class="checklist">' + (t[type].length ? t[type].map((r, index) => '<label class="' + ((type === 'steps' ? stepDone(t, index) : r.done) ? 'checked' : '') + '"><input type="checkbox" data-checklist="' + type + '" data-index="' + index + '" ' + ((type === 'steps' ? stepDone(t, index) : r.done) ? 'checked' : '') + '> ' + esc(r.text) + '</label>').join('') : '<p class="field-hint">' + (type === 'requirements' ? 'No special requirements. You’re ready to begin.' : 'Add a few tiny steps when you edit this task.') + '</p>') + '</div>';
    $('#detail-content').innerHTML = '<div class="dialog-header"><div><div class="eyebrow">ONE SMALL THING</div><h2 id="detail-title">' + esc(t.title) + '</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close task details">×</button></div><div class="detail-meta"><span class="pill">' + esc(t.category) + '</span><span class="pill">' + duration(t.minutes) + ' estimate</span><span class="pill">' + t.block + ' min blocks</span><span class="pill">' + repeatLabel(t) + '</span></div><p class="detail-copy">' + esc(t.notes || 'Make a little progress. A small step counts.') + '</p><p class="field-hint">Selected day: ' + shortDate(selectedDate) + ' · ' + completed + ' / ' + t.minutes + ' estimated minutes completed' + (!D.occurs(t, selectedDate) ? '<br>This task is planned from ' + shortDate(t.date) + ', and does not occur on the selected day.' : '') + '</p>' + checklist('requirements', 'WHAT I NEED TO START') + checklist('steps', 'MY TINY STEPS') + '<div class="detail-section">LEARN MY ACTUAL PACE</div><p class="field-hint">Log the full task’s active duration once per completion, across all blocks. ' + (avg ? 'Your average is ' + avg.minutes + ' min from ' + avg.count + ' logs.' : 'This builds your own average for tasks with this name.') + '</p><form id="log-form" class="log-form"><label for="actual-minutes" class="optional">Total minutes</label><input id="actual-minutes" name="minutes" type="number" min="1" max="1440" step="1" value="' + t.minutes + '" required><button type="submit" class="button secondary">Record time</button></form><div class="detail-actions">' + (blocks.find(b => !D.isDone(state, b)) ? '<button class="button primary" data-action="focus" data-id="' + blocks.find(b => !D.isDone(state, b)).id + '">' + icon('play') + ' Focus on a block</button>' : '') + '<button class="button secondary" data-action="edit-task" data-id="' + id + '">Edit task</button>' + (!D.occurs(t, selectedDate) ? '<button class="button secondary" data-action="move-task" data-id="' + id + '">Move to selected day</button>' : '') + '</div>';
    showDialog('detail-dialog');
  }
  function completeBlock(id) {
    const block = plan().blocks.find(b => b.id === id); if (!block) return;
    const allKey = D.key(block.date, block.taskId, 'all');
    if (state.doneBlocks[allKey]) {
      delete state.doneBlocks[allKey];
      plan().blocks.filter(b => b.taskId === block.taskId && b.id !== id).forEach(b => { state.doneBlocks[b.id] = { minutes: b.end - b.start }; });
    } else if (state.doneBlocks[id]) delete state.doneBlocks[id]; else state.doneBlocks[id] = { minutes: block.end - block.start };
    if (state.timer && state.timer.blockId === id) state.timer = null;
    save(); render(); toast('Your progress is saved.');
  }
  function startFocus(id) {
    const b = plan().blocks.find(b => b.id === id); if (!b) { toast('Add a ready task to find your next focus block.'); return; }
    function begin() {
      if (!state.timer || state.timer.blockId !== id) { state.timer = { blockId: b.id, taskId: b.taskId, title: b.title, date: selectedDate, duration: (b.end - b.start) * 60, remaining: (b.end - b.start) * 60, startedAt: null }; save(); }
      if ($('#detail-dialog').open) $('#detail-dialog').close();
      $('#focus-title').textContent = b.title; $('#focus-subtitle').textContent = duration(b.end - b.start) + ' · ' + D.time(b.start) + ' – ' + D.time(b.end) + ' planned';
      const t = state.tasks.find(t => t.id === b.taskId), step = t && nextStep(t);
      $('#focus-step').innerHTML = '<strong>JUST THE NEXT STEP</strong>' + esc(step ? step.text : 'Settle in. Start with the smallest part of this task.');
      showDialog('focus-dialog'); updateTimer();
    }
    if (state.timer && state.timer.blockId !== id && (state.timer.startedAt || state.timer.remaining !== state.timer.duration)) confirm('Switch to this block? The current timer will be reset. Completed blocks stay saved.', begin); else begin();
  }
  function secondsLeft() { const t = state.timer; return t ? Math.max(0, t.remaining - (t.startedAt ? Math.max(0, Date.now() - t.startedAt) / 1000 : 0)) : 0; }
  function updateTimer() {
    if (!state.timer) return;
    const t = state.timer, secs = Math.ceil(secondsLeft());
    if (secs <= 0 && t.startedAt) { t.remaining = 0; t.startedAt = null; save(); toast('Your focus block is finished. Take a breath and mark it complete when you’re ready.'); }
    $('#timer-digits').textContent = String(Math.floor(secs / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
    $('#timer-toggle').textContent = t.startedAt ? 'Pause focus' : secs ? (secs < t.duration ? 'Resume focus' : 'Start focus') : 'Block finished'; $('#timer-toggle').disabled = secs === 0;
    $('#timer-state').textContent = t.startedAt ? 'One task. One block. You’re here.' : secs ? 'You can begin when you’re ready.' : 'A small step is done. Your reset can start now.';
  }
  function download(name, content, mime) { const url = URL.createObjectURL(new Blob([content], { type: mime })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Download prepared: ' + name); }
  function navigate(amount) {
    const d = D.dateObject(selectedDate);
    if (view === 'month' || view === 'quarter') {
      const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + amount * (view === 'quarter' ? 3 : 1)); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      selectedDate = D.localDate(d);
    } else selectedDate = D.addDays(selectedDate, amount * (view === 'week' ? 7 : 1));
    if (selectedDate < '1901-01-01') selectedDate = '1901-01-01'; if (selectedDate > '2199-12-31') selectedDate = '2199-12-31'; render();
  }
  // Event delegation keeps buttons working after any calendar rerender.
  document.addEventListener('click', event => {
    const el = event.target.closest('[data-action]'); if (!el) return; event.preventDefault();
    const a = el.dataset.action, id = el.dataset.id;
    if (a === 'view') { view = el.dataset.view; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
    else if (a === 'view-tasks') { view = 'tasks'; render(); }
    else if (a === 'prev') navigate(-1);
    else if (a === 'next') navigate(1);
    else if (a === 'today') { selectedDate = today(); render(); }
    else if (a === 'open-date') { selectedDate = el.dataset.date; view = 'day'; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
    else if (a === 'calendar-detail') { selectedDate = el.dataset.date; render(); openDetail(id); }
    else if (a === 'settings') openSettings();
    else if (a === 'close-dialog') { if (el.closest('dialog').id === 'setup-dialog' && !state.configured) { toast('Set your rhythm or explore an example when you’re ready.'); } closeDialog(el); }
    else if (a === 'add-task') openTask();
    else if (a === 'template') openTask(null, el.dataset.index);
    else if (a === 'edit-task') { if ($('#detail-dialog').open) $('#detail-dialog').close(); openTask(id); }
    else if (a === 'detail') openDetail(id);
    else if (a === 'add-event') openEvent();
    else if (a === 'edit-event') openEvent(id);
    else if (a === 'delete-task') confirm('Delete this task and its repeating schedule? Completed time logs will remain in My pace.', () => { state.tasks = state.tasks.filter(t => t.id !== id); Object.keys(state.doneBlocks).filter(k => k.split('|')[1] === id).forEach(k => delete state.doneBlocks[k]); if (state.timer && state.timer.taskId === id) state.timer = null; save(); render(); toast('Task removed.'); });
    else if (a === 'delete-event') confirm('Remove this commitment, including future repeats? That time will be available for tasks.', () => { state.events = state.events.filter(e => e.id !== id); save(); render(); });
    else if (a === 'toggle-block') completeBlock(id);
    else if (a === 'complete-task') {
      const p = plan(), t = state.tasks.find(t => t.id === id); if (!t) return;
      const k = D.key(selectedDate, id, 'all'), blocks = p.blocks.filter(b => b.taskId === id), allDone = state.doneBlocks[k] || (blocks.length && !p.overflow.some(o => o.task.id === id) && blocks.every(b => D.isDone(state, b)));
      Object.keys(state.doneBlocks).filter(k => k.startsWith(selectedDate + '|' + id + '|')).forEach(k => delete state.doneBlocks[k]);
      if (!allDone) state.doneBlocks[k] = { minutes: t.minutes };
      if (state.timer && state.timer.taskId === id) state.timer = null;
      save(); render(); toast(allDone ? 'Task reopened.' : 'A small win. Record its actual time from task details if you’d like.');
    }
    else if (a === 'toggle-minutes') { minuteOpen = !minuteOpen; render(); if (minuteOpen) $('#minute-view').scrollIntoView({ block: 'start' }); }
    else if (a === 'focus') startFocus(id);
    else if (a === 'focus-next') { view = 'day'; render(); const next = nextBlock(plan()); if (next) startFocus(next.id); else toast('Add a ready task to find your next focus block.'); }
    else if (a === 'timer-toggle' && state.timer) { const t = state.timer; if (t.startedAt) { t.remaining = secondsLeft(); t.startedAt = null; } else t.startedAt = Date.now(); save(); updateTimer(); }
    else if (a === 'timer-reset' && state.timer) { state.timer.remaining = state.timer.duration; state.timer.startedAt = null; save(); updateTimer(); }
    else if (a === 'timer-finish' && state.timer) { state.doneBlocks[state.timer.blockId] = { minutes: state.timer.duration / 60 }; state.timer = null; save(); $('#focus-dialog').close(); render(); toast('One block done. Take a little reset.'); }
    else if (a === 'use-average') { const avg = D.average(state.logs, $('#task-form').elements.title.value); if (avg) $('#task-form').elements.minutes.value = avg.minutes; }
    else if (a === 'move-task') { const t = state.tasks.find(t => t.id === id); if (t) confirm('Move this task’s first planned date to ' + shortDate(selectedDate) + '? Repeating tasks will use this new starting date.', () => { Object.keys(state.doneBlocks).filter(k => k.split('|')[1] === id).forEach(k => delete state.doneBlocks[k]); t.date = selectedDate; if (t.due && t.due < selectedDate) t.due = selectedDate; save(); render(); openDetail(id); }); }
    else if (a === 'export') showDialog('export-dialog');
    else if (a === 'download-backup') download('Daylight-Backup-' + today() + '.json', JSON.stringify({ ...state, timer: null }, null, 2), 'application/json');
    else if (a === 'download-csv') download('Daylight-Plan-' + selectedDate + '.csv', D.csv(plan(), false), 'text/csv;charset=utf-8');
    else if (a === 'download-minutes') download('Daylight-Every-Minute-' + selectedDate + '.csv', D.csv(plan(), true), 'text/csv;charset=utf-8');
    else if (a === 'download-ics') download('Daylight-Calendar-' + selectedDate + '.ics', D.ics(periodDates().map(date => plan(date))), 'text/calendar;charset=utf-8');
    else if (a === 'print') { $('#export-dialog').close(); window.print(); }
    else if (a === 'demo') { state = D.demoState(today()); save(); $('#setup-dialog').close(); selectedDate = today(); render(); toast('You’re exploring an example. Change the rhythm and tasks to make it yours.'); }
    else if (a === 'confirm-cancel') { $('#confirm-dialog').close(); confirmAction = null; }
    else if (a === 'confirm-yes') { const callback = confirmAction; confirmAction = null; $('#confirm-dialog').close(); if (callback) callback(); }
    else if (a === 'goal-toggle') { const goal = state.goals.find(g => g.id === id); if (goal) { goal.done = !goal.done; save(); render(); } }
    else if (a === 'goal-delete') confirm('Remove this quarterly intention?', () => { state.goals = state.goals.filter(g => g.id !== id); save(); render(); });
    else if (a === 'log-delete') confirm('Remove this time log? Your personal average will be recalculated.', () => { state.logs = state.logs.filter(l => l.id !== id); save(); render(); });
  });
  document.addEventListener('change', async event => {
    const el = event.target;
    if (el.id === 'selected-date') { try { D.dateObject(el.value); selectedDate = el.value; render(); } catch { toast('Choose a valid date.'); } }
    else if (el.id === 'task-filter') { filter = el.value; render(); }
    else if (el.id === 'minute-hour') { minuteHour = Number(el.value); const scroll = window.scrollY; render(); window.scrollTo(0, scroll); $('#minute-hour').focus(); }
    else if (el.dataset.checklist) { const t = state.tasks.find(t => t.id === detailTaskId); if (t) { if (el.dataset.checklist === 'steps') state.stepChecks[D.key(selectedDate, t.id, 'step-' + el.dataset.index)] = el.checked; else t.requirements[Number(el.dataset.index)].done = el.checked; save(); render(); openDetail(t.id); } }
    else if (el.id === 'import-file' && el.files[0]) {
      try {
        const file = el.files[0]; if (file.size > 5 * 1024 * 1024) throw new Error('Use a backup smaller than 5 MB.');
        const imported = D.validateState(JSON.parse(await file.text()));
        confirm('Restore this backup? It will replace your current tasks, commitments, settings, progress, and time history.', () => { state = imported; save(); $('#export-dialog').close(); render(); toast('Your planner has been restored.'); if (!state.configured) openSettings(); });
      } catch (error) { toast('Backup could not be restored. ' + error.message); }
      el.value = '';
    }
  });
  let searchDelay;
  document.addEventListener('input', event => {
    if (event.target.id === 'task-search') { search = event.target.value; clearTimeout(searchDelay); searchDelay = setTimeout(() => { const selection = event.target.selectionStart; render(); $('#task-search').focus(); $('#task-search').setSelectionRange(selection, selection); }, 180); }
    if (event.target.form && event.target.form.id === 'task-form' && event.target.name === 'title') updateAverageHint();
  });
  document.addEventListener('submit', event => {
    const f = event.target; event.preventDefault();
    if (f.id === 'setup-form') {
      try {
        const profile = { name: f.elements.name.value.trim(), wake: f.elements.wake.value, sleep: f.elements.sleep.value, workStart: f.elements.workStart.value, workEnd: f.elements.workEnd.value, workDays: [...f.querySelectorAll('[name=workDays]:checked')].map(el => Number(el.value)), block: Number(f.elements.block.value), buffer: Number(f.elements.buffer.value) };
        D.validateProfile(profile); state.profile = profile; state.configured = true; save(); $('#setup-dialog').close(); render(); toast('Your daily rhythm is ready. Add tasks and fixed commitments to make it yours.');
      } catch (error) { $('#setup-error').textContent = error.message; }
    } else if (f.id === 'task-form') {
      try {
        const existing = state.tasks.find(t => t.id === f.elements.id.value), ready = f.elements.ready.checked;
        function lines(name) { return f.elements[name].value.split('\n').map(s => s.trim()).filter(Boolean).map(text => { if (text.length > 300) throw new Error('Keep each requirement and step under 300 characters.'); const old = existing && existing[name].find(r => r.text === text); return { text, done: name === 'requirements' ? ready : old ? old.done : false }; }); }
        const task = { id: existing ? existing.id : D.uid(), title: f.elements.title.value.trim(), category: f.elements.category.value, context: f.elements.context.value, minutes: Number(f.elements.minutes.value), block: Number(f.elements.block.value), date: f.elements.date.value, due: f.elements.due.value, priority: Number(f.elements.priority.value), repeat: f.elements.repeat.value, requirements: lines('requirements'), steps: lines('steps'), notes: f.elements.notes.value.trim() };
        D.validateTask(task);
        if (existing) state.tasks[state.tasks.indexOf(existing)] = task; else state.tasks.push(task);
        if (existing && (existing.minutes !== task.minutes || existing.block !== task.block || existing.date !== task.date || existing.repeat !== task.repeat)) Object.keys(state.doneBlocks).filter(k => k.split('|')[1] === task.id).forEach(k => delete state.doneBlocks[k]);
        if (existing && JSON.stringify(existing.steps) !== JSON.stringify(task.steps)) Object.keys(state.stepChecks).filter(k => k.split('|')[1] === task.id).forEach(k => delete state.stepChecks[k]);
        if (state.timer && state.timer.taskId === task.id) state.timer = null;
        save(); $('#task-dialog').close(); render(); toast(task.requirements.some(r => !r.done) ? 'Task captured. Check off its requirements when you’re ready.' : 'Task saved. Compatible free time has been planned.');
      } catch (error) { $('#task-error').textContent = error.message; }
    } else if (f.id === 'event-form') {
      try {
        const existing = state.events.find(e => e.id === f.elements.id.value), commitment = { id: existing ? existing.id : D.uid(), title: f.elements.title.value.trim(), start: f.elements.start.value, end: f.elements.end.value, date: f.elements.date.value, repeat: f.elements.repeat.value, category: f.elements.category.value };
        D.validateEvent(commitment); if (existing) state.events[state.events.indexOf(existing)] = commitment; else state.events.push(commitment);
        save(); $('#event-dialog').close(); render(); toast('Fixed time saved. Any overlaps are flagged on the affected day.');
      } catch (error) { $('#event-error').textContent = error.message; }
    } else if (f.id === 'goal-form') {
      const title = f.elements.goal.value.trim(); if (title) { state.goals.push({ id: D.uid(), title, quarter: quarterKey(selectedDate), done: false }); save(); render(); toast('A little intention, saved.'); }
    } else if (f.id === 'log-form') {
      const t = state.tasks.find(t => t.id === detailTaskId), minutes = Number(f.elements.minutes.value);
      if (t && Number.isInteger(minutes) && minutes > 0 && minutes <= 1440) { state.logs.push({ id: D.uid(), title: t.title, minutes, date: selectedDate }); if (state.logs.length > 5000) state.logs.shift(); save(); render(); openDetail(t.id); toast('Full task time recorded. Your own average has been updated.'); }
    }
  });
  function updateClock() { const now = new Date(); $('#clock').textContent = D.time(now.getHours() * 60 + now.getMinutes()); }
  document.addEventListener('keydown', event => { if (event.key.toLowerCase() === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,dialog')) { event.preventDefault(); openTask(); } });
  // Concurrent tabs are detected before a stale tab can quietly keep its view.
  window.addEventListener('storage', event => { if (event.key === STORAGE && event.newValue) { try { state = D.validateState(JSON.parse(event.newValue)); revision++; planCache.clear(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); render(); toast('Planner updated from another tab.'); } catch { toast('Another tab changed saved data. Export a backup before refreshing.'); } } });
  hydrateIcons(); render(); if (!state.configured) openSettings(); setInterval(() => { updateClock(); updateTimer(); }, 500);
})();
