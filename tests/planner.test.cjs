/* Run with `node --test tests/planner.test.cjs`. No packages or downloads. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../planner.js');
const DATE = '2026-11-11'; // Wednesday
function state() { const s = D.freshState(); s.configured = true; return s; }
function task(s, overrides = {}) {
  const t = { id: D.uid(), title: 'One small task', category: 'Personal', context: 'any', minutes: 45, block: 20, priority: 2, date: DATE, due: '', repeat: 'none', requirements: [], steps: [], notes: '', ...overrides };
  D.validateTask(t); s.tasks.push(t); return t;
}
function event(s, overrides = {}) { const e = { id: D.uid(), title: 'Lunch', start: '12:00', end: '12:30', date: DATE, repeat: 'none', ...overrides }; D.validateEvent(e); s.events.push(e); return e; }
function coverage(p) {
  assert.equal(p.slots.length, 1440);
  assert.equal(p.segments[0].start, 0);
  assert.equal(p.segments.at(-1).end, 1440);
  assert.equal(p.segments.reduce((n, s) => n + s.end - s.start, 0), 1440);
  p.segments.forEach((s, i) => { assert.ok(s.end > s.start); if (i) assert.equal(p.segments[i - 1].end, s.start); });
  for (const b of p.blocks) for (let i = b.start; i < b.end; i++) assert.equal(p.slots[i].token, b.id);
}
test('24-hour clock strictly parses input and supports 24:00 only as an end', () => {
  assert.equal(D.parseTime('00:00'), 0); assert.equal(D.parseTime('23:59'), 1439);
  assert.equal(D.parseTime('24:00', true), 1440); assert.equal(D.time(1440), '24:00');
  for (const t of ['7:00', '07:60', '12:00 PM', '24:01', '-1:00', '00:000', '24:00']) assert.throws(() => D.parseTime(t));
});
test('empty day accounts for every minute including sleep and work capacity', () => {
  const p = D.buildPlan(state(), DATE); coverage(p);
  assert.equal(p.sleep, 480); assert.equal(p.capacity, 960); assert.equal(p.free, 960);
  assert.equal(p.slots[539].kind, 'open'); assert.equal(p.slots[540].kind, 'work'); assert.equal(p.slots[1020].kind, 'open');
});
test('all four block sizes preserve exact task duration and final remainders', () => {
  for (const block of D.BLOCKS) { const s = state(); task(s, { block, minutes: 47 }); const p = D.buildPlan(s, DATE); coverage(p); assert.equal(p.focus, 47); assert.equal(p.blocks.length, Math.ceil(47 / block)); assert.ok(p.blocks.every(b => b.end - b.start <= block)); }
});
test('work and personal tasks stay in compatible windows around protected commitments', () => {
  const s = state(); task(s, { title: 'Work', context: 'work', minutes: 65, block: 30 }); task(s, { title: 'Home', context: 'personal', minutes: 40 }); event(s, { start: '09:15', end: '10:00' });
  const base = state(), noTasks = D.buildPlan(base, DATE), p = D.buildPlan(s, DATE); coverage(p);
  for (const b of p.blocks) for (let n = b.start; n < b.end; n++) { assert.ok(n < 555 || n >= 600); assert.equal(noTasks.slots[n].kind, b.title === 'Work' ? 'work' : 'open'); }
  assert.equal(p.focus, 105); assert.equal(p.conflicts.length, 0);
});
test('requirements hold a task until every requirement is ready', () => {
  const s = state(), t = task(s, { requirements: [{ text: 'Get access', done: false }] });
  let p = D.buildPlan(s, DATE); assert.equal(p.focus, 0); assert.equal(p.waiting.length, 1);
  t.requirements[0].done = true; p = D.buildPlan(s, DATE); assert.equal(p.focus, 45); assert.equal(p.waiting.length, 0);
});
test('overflow is visible, never silently spilled into rest or another date', () => {
  const s = state(); task(s, { context: 'work', minutes: 600, block: 30 }); const p = D.buildPlan(s, DATE);
  coverage(p); assert.equal(p.overflow.length, 1); assert.equal(p.focus + p.overflow[0].minutes, 600); assert.ok(p.focus <= 480);
  assert.equal(D.buildPlan(s, D.addDays(DATE, 1)).focus, 0);
});
test('tiny free gaps do not become focus blocks shorter than the chosen block', () => {
  const s = state(); s.profile.workStart = '09:00'; s.profile.workEnd = '09:15'; s.profile.buffer = 0;
  task(s, { context: 'work', minutes: 30, block: 20 }); const p = D.buildPlan(s, DATE);
  assert.equal(p.focus, 0); assert.equal(p.overflow[0].minutes, 30);
});
test('due date, then priority, then insertion order determine task placement', () => {
  const s = state(); task(s, { title: 'Later', due: '2026-11-15', priority: 1 }); task(s, { title: 'Due today', due: DATE, priority: 3 }); task(s, { title: 'Also today', due: DATE, priority: 1 });
  const p = D.buildPlan(s, DATE); assert.deepEqual(p.tasks.map(t => t.title), ['Also today', 'Due today', 'Later']);
});
test('resets protect time after blocks and never replace appointments', () => {
  const s = state(); s.profile.buffer = 10; task(s, { context: 'work', minutes: 20, block: 20 }); event(s, { start: '09:23', end: '10:00' });
  const p = D.buildPlan(s, DATE); assert.equal(p.slots[560].kind, 'buffer'); assert.equal(p.slots[562].kind, 'buffer'); assert.equal(p.slots[563].kind, 'event'); coverage(p);
});
test('fixed commitment conflicts are flagged and first ownership is preserved', () => {
  const s = state(); event(s, { title: 'First', start: '12:00', end: '13:00' }); event(s, { title: 'Second', start: '12:30', end: '13:30' }); event(s, { title: 'During sleep', start: '01:00', end: '01:30' });
  const p = D.buildPlan(s, DATE); assert.equal(p.conflicts.length, 2); assert.equal(p.slots[755].title, 'First'); assert.equal(p.slots[60].kind, 'sleep'); coverage(p);
});
test('overnight working hours continue from the previous working weekday', () => {
  const s = state(); Object.assign(s.profile, { wake: '17:00', sleep: '09:00', workStart: '22:00', workEnd: '06:00', workDays: [1] });
  D.validateProfile(s.profile);
  const monday = D.buildPlan(s, '2026-11-09'), tuesday = D.buildPlan(s, '2026-11-10');
  assert.equal(monday.slots[60].kind, 'open'); assert.equal(monday.slots[1380].kind, 'work'); assert.equal(tuesday.slots[60].kind, 'work'); assert.equal(tuesday.slots[1380].kind, 'open'); coverage(tuesday);
});
test('overnight commitments split across midnight without losing minutes', () => {
  const s = state(); s.profile.wake = '17:00'; s.profile.sleep = '09:00'; s.profile.workDays = [];
  event(s, { start: '23:30', end: '00:30' });
  assert.equal(D.buildPlan(s, DATE).slots[1439].kind, 'event'); assert.equal(D.buildPlan(s, D.addDays(DATE, 1)).slots[0].kind, 'event'); assert.equal(D.buildPlan(s, D.addDays(DATE, 1)).slots[30].kind, 'open');
});
test('recurrence handles weekdays, weekly, monthly month-ends, leap years and quarters', () => {
  assert.equal(D.occurs({ date: DATE, repeat: 'weekdays' }, '2026-11-14'), false);
  assert.equal(D.occurs({ date: DATE, repeat: 'weekly' }, '2026-11-18'), true);
  assert.equal(D.occurs({ date: '2027-01-31', repeat: 'monthly' }, '2027-02-28'), true);
  assert.equal(D.occurs({ date: '2028-01-31', repeat: 'monthly' }, '2028-02-29'), true);
  assert.equal(D.occurs({ date: '2026-11-30', repeat: 'quarterly' }, '2027-02-28'), true);
  assert.equal(D.occurs({ date: '2026-11-30', repeat: 'quarterly' }, '2027-01-30'), false);
  assert.equal(D.occurs({ date: DATE, repeat: 'daily' }, '2026-11-10'), false);
});
test('task completion is scoped to an occurrence and survives rebuilds', () => {
  const s = state(), t = task(s, { repeat: 'daily' }); let p = D.buildPlan(s, DATE);
  s.doneBlocks[p.blocks[0].id] = { minutes: 20 }; assert.equal(D.buildPlan(s, DATE).completed, 20);
  s.doneBlocks[D.key(DATE, t.id, 'all')] = { minutes: 45 }; assert.equal(D.buildPlan(s, DATE).completed, 45);
  assert.equal(D.buildPlan(s, D.addDays(DATE, 1)).completed, 0);
  const manual = state(), big = task(manual, { context: 'work', minutes: 600, requirements: [{ text: 'No longer needed after completion', done: false }] });
  manual.doneBlocks[D.key(DATE, big.id, 'all')] = { minutes: 600 };
  const finished = D.buildPlan(manual, DATE); assert.equal(finished.waiting.length, 0); assert.equal(finished.overflow.length, 0); coverage(finished);
});
test('personal averages use the latest 20 full-task logs with matching names', () => {
  const logs = Array.from({ length: 25 }, (_, i) => ({ title: '  Clean desk ', minutes: i + 1 })); logs.push({ title: 'Other', minutes: 100 });
  assert.deepEqual(D.average(logs, 'clean DESK'), { minutes: 16, count: 20 }); assert.equal(D.average(logs, 'Unknown'), null);
});
test('CSV minute export has exactly 1,440 data rows and neutralizes spreadsheet formulas', () => {
  const s = state(); task(s, { title: '=HYPERLINK("bad")' }); const p = D.buildPlan(s, DATE), csv = D.csv(p, true);
  assert.equal(csv.split('\r\n').length, 1441); assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('"23:59","24:00"')); assert.ok(csv.startsWith('\ufeff'));
});
test('ICS uses floating local time, escaped text, next-day midnight and UTF-8 folding', () => {
  const s = state(); s.profile.workDays = []; event(s, { title: 'Unicode café, ' + '学'.repeat(60), start: '22:30', end: '23:00' });
  // Use a waking endpoint at midnight to test midnight DTSTART/DTEND conversion.
  s.profile.wake = '08:00'; s.profile.sleep = '00:00'; event(s, { title: 'End of day', start: '23:30', end: '24:00' });
  const text = D.ics([D.buildPlan(s, DATE)]);
  assert.ok(text.includes('DTEND:20261112T000000')); assert.ok(text.includes('café\\,')); assert.ok(!text.includes('TZID='));
  text.split('\r\n').forEach(line => assert.ok(Buffer.byteLength(line) <= 75));
});
test('malformed dates, profiles, tasks and imported IDs are rejected', () => {
  assert.throws(() => D.dateObject('2026-02-30')); assert.throws(() => D.dateObject('2026-13-01'));
  const s = state(); s.profile.workStart = '06:00'; assert.throws(() => D.validateProfile(s.profile), /sleep/);
  assert.throws(() => task(state(), { minutes: 1.5 })); assert.throws(() => task(state(), { due: '2026-10-01' }));
  const malicious = state(); malicious.logs.push({ id: '" onclick="bad', title: 'Task', minutes: 10, date: DATE }); assert.throws(() => D.validateState(malicious));
});
test('backups round-trip user records, progress and occurrence-specific steps', () => {
  const s = D.demoState(DATE); s.stepChecks[D.key(DATE, s.tasks[0].id, 'step-0')] = true;
  const copy = D.validateState(JSON.parse(JSON.stringify(s))); assert.deepEqual(copy, s); coverage(D.buildPlan(copy, DATE));
});
test('generated mixed schedules never overlap, exceed a day, or use incompatible time', () => {
  let seed = 87231; function rand(n) { seed = (seed * 16807) % 2147483647; return seed % n; }
  for (let round = 0; round < 40; round++) {
    const s = state(); s.profile.buffer = [0, 5, 10][rand(3)];
    event(s, { start: '12:00', end: '12:45' }); event(s, { start: '18:00', end: '19:00' });
    const base = D.buildPlan(s, DATE);
    for (let i = 0; i < 12; i++) task(s, { context: ['work', 'personal', 'any'][rand(3)], minutes: 1 + rand(150), block: D.BLOCKS[rand(4)], priority: 1 + rand(3) });
    const p = D.buildPlan(s, DATE); coverage(p);
    for (const b of p.blocks) {
      const t = s.tasks.find(t => t.id === b.taskId);
      for (let n = b.start; n < b.end; n++) { const kind = base.slots[n].kind; assert.ok(['open', 'work'].includes(kind)); if (t.context === 'work') assert.equal(kind, 'work'); if (t.context === 'personal') assert.equal(kind, 'open'); }
    }
    for (const t of s.tasks) assert.equal(p.blocks.filter(b => b.taskId === t.id).reduce((n, b) => n + b.end - b.start, 0) + (p.overflow.find(o => o.task.id === t.id)?.minutes || 0), t.minutes);
  }
});
