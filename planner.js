/*
 * Daylight's planning engine has no browser dependencies. Every plan owns exactly
 * 1,440 wall-clock minute slots. Fixed commitments are placed first; focus blocks
 * can only use the remaining compatible slots. Nothing is silently double-booked.
 * A calendar day is a planning grid, not a claim about elapsed time on DST days.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Daylight = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const BLOCKS = [10, 15, 20, 30];
  const CATEGORIES = ['Work', 'Home', 'Personal', 'Learning', 'Health'];
  const DEFAULT_PROFILE = Object.freeze({ name: '', wake: '07:00', sleep: '23:00', workStart: '09:00', workEnd: '17:00', workDays: [1, 2, 3, 4, 5], block: 15, buffer: 5 });
  // These are editable starting points, never clinical or population averages.
  const TEMPLATES = [
    { title: 'Clear my desk', category: 'Home', context: 'personal', minutes: 15, requirements: ['A bin and a place for loose items'], steps: ['Put rubbish in the bin', 'Return five items to their homes', 'Clear one working surface'] },
    { title: 'Reply to important messages', category: 'Work', context: 'work', minutes: 20, requirements: ['Inbox access'], steps: ['Find three messages that need a reply', 'Write a short response to each', 'Flag anything that needs more time'] },
    { title: 'Laundry reset', category: 'Home', context: 'personal', minutes: 20, requirements: ['Laundry basket', 'Detergent'], steps: ['Collect one load', 'Sort and load the machine', 'Set a separate reminder to move it later'] },
    { title: 'Plan tomorrow', category: 'Personal', context: 'personal', minutes: 10, requirements: ['Calendar and task list'], steps: ['Check fixed commitments', 'Choose one priority', 'Prepare the first thing I need'] },
    { title: 'Study one concept', category: 'Learning', context: 'any', minutes: 30, requirements: ['Lesson or learning material'], steps: ['Choose one small topic', 'Practice one example', 'Write a three-line recap'] },
    { title: 'Quick kitchen reset', category: 'Home', context: 'personal', minutes: 15, requirements: ['Cleaning cloth', 'Space for dishes'], steps: ['Move dishes to the sink', 'Wipe one surface', 'Return five items to their places'] },
    { title: 'Prepare a meal', category: 'Home', context: 'personal', minutes: 30, requirements: ['Ingredients', 'Cooking tools'], steps: ['Gather ingredients', 'Prepare one simple meal', 'Put ingredients away'] },
    { title: 'Walk or stretch', category: 'Health', context: 'personal', minutes: 15, requirements: ['Comfortable clothing'], steps: ['Choose a short route or a clear space', 'Move at my own pace', 'Get some water'] }
  ];
  function uid() { return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function parseTime(value, allowEnd) {
    if (value === '24:00' && allowEnd) return 1440;
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Use 24-hour HH:MM time, such as 07:00 or 17:30.');
    const [h, m] = value.split(':').map(Number); return h * 60 + m;
  }
  function time(value) { const n = Math.max(0, Math.min(1440, Math.round(value))); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  function localDate(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
  function dateObject(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid calendar date.');
    const [y, m, d] = value.split('-').map(Number);
    const result = new Date(y, m - 1, d, 12);
    if (y < 1900 || y > 2200 || localDate(result) !== value) throw new Error('Choose a date between 1900 and 2200.');
    return result;
  }
  function addDays(value, amount) { const d = dateObject(value); d.setDate(d.getDate() + amount); return localDate(d); }
  function occurs(item, date) {
    if (date < item.date) return false;
    if (!item.repeat || item.repeat === 'none') return date === item.date;
    const d = dateObject(date), base = dateObject(item.date);
    if (item.repeat === 'daily') return true;
    if (item.repeat === 'weekdays') return d.getDay() > 0 && d.getDay() < 6;
    if (item.repeat === 'weekly') return d.getDay() === base.getDay();
    const monthOffset = (d.getFullYear() - base.getFullYear()) * 12 + d.getMonth() - base.getMonth();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return (item.repeat === 'monthly' || (item.repeat === 'quarterly' && monthOffset % 3 === 0)) && d.getDate() === Math.min(base.getDate(), last);
  }
  function inRange(n, start, end) { return start < end ? n >= start && n < end : n >= start || n < end; }
  function workAt(profile, date, minute) {
    if (!profile.workDays.length) return false;
    const start = parseTime(profile.workStart), end = parseTime(profile.workEnd);
    const day = dateObject(date).getDay(), prev = dateObject(addDays(date, -1)).getDay();
    if (start < end) return profile.workDays.includes(day) && minute >= start && minute < end;
    return (profile.workDays.includes(day) && minute >= start) || (profile.workDays.includes(prev) && minute < end);
  }
  function validateProfile(profile) {
    const w = parseTime(profile.wake), s = parseTime(profile.sleep);
    if (w === s) throw new Error('Wake and sleep times must be different. Overnight waking hours are supported.');
    const a = parseTime(profile.workStart), b = parseTime(profile.workEnd);
    if (!Array.isArray(profile.workDays) || profile.workDays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Choose valid working days.');
    if (profile.workDays.length && a === b) throw new Error('Work start and finish must be different.');
    if (profile.workDays.length) for (let n = 0; n < 1440; n++) {
      if (inRange(n, a, b) && !inRange(n, w, s)) throw new Error('Work hours overlap your sleep. Adjust wake, sleep, or work times.');
    }
    if (!BLOCKS.includes(profile.block)) throw new Error('Choose a 10, 15, 20, or 30 minute focus block.');
    if (![0, 5, 10].includes(profile.buffer)) throw new Error('Choose a 0, 5, or 10 minute reset.');
    return true;
  }
  function validateTask(task) {
    if (typeof task.title !== 'string' || !task.title.trim() || task.title.length > 120) throw new Error('Give your task a name of 1–120 characters.');
    if (!Number.isInteger(task.minutes) || task.minutes < 1 || task.minutes > 1440) throw new Error('Estimated active time must be 1–1,440 whole minutes.');
    if (!BLOCKS.includes(task.block)) throw new Error('Choose a 10, 15, 20, or 30 minute block.');
    if (!['work', 'personal', 'any'].includes(task.context)) throw new Error('Choose when this task can happen.');
    if (!CATEGORIES.includes(task.category)) throw new Error('Choose a valid task category.');
    if (![1, 2, 3].includes(task.priority)) throw new Error('Choose a valid priority.');
    if (!['none', 'daily', 'weekdays', 'weekly', 'monthly', 'quarterly'].includes(task.repeat)) throw new Error('Choose a valid repeat option.');
    dateObject(task.date);
    if (task.due) { dateObject(task.due); if (task.due < task.date) throw new Error('The due date must be on or after the first planned date.'); }
    if (!Array.isArray(task.requirements) || !Array.isArray(task.steps) || task.requirements.length > 30 || task.steps.length > 30) throw new Error('Use up to 30 requirements and 30 small steps.');
    return true;
  }
  function validateEvent(event) {
    if (typeof event.title !== 'string' || !event.title.trim() || event.title.length > 120) throw new Error('Name the commitment using 1–120 characters.');
    if (parseTime(event.start) === parseTime(event.end, true)) throw new Error('Commitments must have different start and end times.');
    dateObject(event.date);
    if (!['none', 'daily', 'weekdays', 'weekly', 'monthly', 'quarterly'].includes(event.repeat)) throw new Error('Choose a valid repeat option.');
  }
  function eventSpans(event, date) {
    const a = parseTime(event.start), b = parseTime(event.end, true), spans = [];
    if (a < b) { if (occurs(event, date)) spans.push([a, b]); }
    else {
      if (occurs(event, date)) spans.push([a, 1440]);
      if (occurs(event, addDays(date, -1))) spans.push([0, b]);
    }
    return spans;
  }
  function key(date, taskId, offset) { return date + '|' + taskId + '|' + offset; }
  function isDone(state, block) { return !!state.doneBlocks[block.id] || !!state.doneBlocks[key(block.date, block.taskId, 'all')]; }
  function buildPlan(state, date) {
    dateObject(date); validateProfile(state.profile);
    const p = state.profile, wake = parseTime(p.wake), sleep = parseTime(p.sleep);
    const slots = Array.from({ length: 1440 }, (_, n) => {
      if (!inRange(n, wake, sleep)) return { kind: 'sleep', title: 'Sleep & rest', token: 'sleep' };
      return workAt(p, date, n) ? { kind: 'work', title: 'Work · flexible time', token: 'work' } : { kind: 'open', title: 'Open time · room to breathe', token: 'open' };
    });
    const conflicts = new Set();
    for (const event of state.events) {
      for (const [a, b] of eventSpans(event, date)) {
        const token = 'event-' + event.id;
        for (let n = a; n < b; n++) {
          if (slots[n].kind === 'sleep' || slots[n].kind === 'event') { conflicts.add(event.title + ' overlaps ' + slots[n].title + '.'); continue; }
          slots[n] = { kind: 'event', title: event.title, eventId: event.id, category: event.category || 'Personal', token };
        }
      }
    }
    const capacity = slots.filter(s => s.kind === 'work' || s.kind === 'open').length;
    const tasks = state.tasks.filter(t => occurs(t, date)).slice().sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.priority - b.priority || state.tasks.indexOf(a) - state.tasks.indexOf(b));
    const blocks = [], overflow = [], waiting = [];
    function compatible(s, task) { return task.context === 'work' ? s.kind === 'work' : task.context === 'personal' ? s.kind === 'open' : s.kind === 'work' || s.kind === 'open'; }
    for (const task of tasks) {
      // A task waits until its required materials/access are checked off.
      const completedTask = !!state.doneBlocks[key(date, task.id, 'all')];
      if (task.requirements.some(r => !r.done) && !completedTask) { waiting.push(task); continue; }
      let remaining = task.minutes, offset = 0, searchFrom = 0;
      while (remaining > 0) {
        const length = Math.min(task.block, remaining);
        let start = -1;
        for (let n = searchFrom; n + length <= 1440; n++) {
          if (!compatible(slots[n], task)) continue;
          let fits = true;
          for (let j = n; j < n + length; j++) if (!compatible(slots[j], task)) { fits = false; n = j; break; }
          if (fits) { start = n; break; }
        }
        if (start < 0) break;
        const id = key(date, task.id, offset), end = start + length;
        const block = { id, date, taskId: task.id, kind: 'focus', title: task.title, category: task.category, start, end, offset, token: id };
        for (let n = start; n < end; n++) slots[n] = block;
        blocks.push(block); remaining -= length; offset += length; searchFrom = end;
        // Reset time can be shorter before a fixed appointment. It never replaces
        // sleep, an appointment, or another task, and may cross work/open space.
        if (p.buffer) {
          const reset = { kind: 'buffer', title: 'Reset · water, stretch, breathe', token: 'reset-' + id };
          let n = end;
          while (n < Math.min(1440, end + p.buffer) && ['open', 'work'].includes(slots[n].kind)) slots[n++] = reset;
          searchFrom = n;
        }
      }
      if (remaining > 0 && !completedTask) overflow.push({ task, minutes: remaining, scheduled: task.minutes - remaining });
    }
    const segments = [];
    for (let n = 0; n < 1440;) {
      let end = n + 1; while (end < 1440 && slots[end].token === slots[n].token) end++;
      segments.push({ ...slots[n], start: n, end }); n = end;
    }
    const focus = blocks.reduce((n, b) => n + b.end - b.start, 0);
    const completed = blocks.filter(b => isDone(state, b)).reduce((n, b) => n + b.end - b.start, 0);
    return { date, slots, segments, blocks, tasks, overflow, waiting, conflicts: [...conflicts], capacity, focus, completed, free: slots.filter(s => ['open', 'work'].includes(s.kind)).length, resets: slots.filter(s => s.kind === 'buffer').length, sleep: slots.filter(s => s.kind === 'sleep').length };
  }
  function average(logs, title) {
    const same = logs.filter(l => l.title.trim().toLowerCase() === title.trim().toLowerCase()).slice(-20);
    return same.length ? { minutes: Math.round(same.reduce((sum, l) => sum + l.minutes, 0) / same.length), count: same.length } : null;
  }
  function csv(plan, perMinute) {
    const quote = value => { const s = String(value); return '"' + (/^\s*[=+@-]|^[\t\r\n]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'; };
    const rows = [['Date', 'Start (24h)', 'End (24h)', 'Minutes', 'Activity', 'Type']];
    if (perMinute) for (let n = 0; n < 1440; n++) rows.push([plan.date, time(n), time(n + 1), 1, plan.slots[n].title, plan.slots[n].kind]);
    else for (const s of plan.segments) rows.push([plan.date, time(s.start), time(s.end), s.end - s.start, s.title, s.kind]);
    return '\ufeff' + rows.map(r => r.map(quote).join(',')).join('\r\n');
  }
  function ics(plans) {
    const escape = value => String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
    function stamp(date, minute) { return (minute === 1440 ? addDays(date, 1) : date).replace(/-/g, '') + 'T' + time(minute === 1440 ? 0 : minute).replace(':', '') + '00'; }
    // Fold at 75 UTF-8 bytes, keeping multibyte characters intact (RFC 5545).
    function fold(line) {
      let out = '', part = '', count = 0;
      for (const character of line) {
        const bytes = new TextEncoder().encode(character).length;
        if (count + bytes > 75) { out += part + '\r\n'; part = ' '; count = 1; }
        part += character; count += bytes;
      }
      return out + part;
    }
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daylight//Block Planner//EN', 'CALSCALE:GREGORIAN'];
    for (const plan of plans) for (const s of plan.segments.filter(s => s.kind === 'focus' || s.kind === 'event')) {
      lines.push('BEGIN:VEVENT', 'UID:' + plan.date + '-' + s.start + '-' + s.token.replace(/[^\w-]/g, '') + '@daylight.local', 'DTSTAMP:' + now, 'DTSTART:' + stamp(plan.date, s.start), 'DTEND:' + stamp(plan.date, s.end), 'SUMMARY:' + escape(s.title), 'DESCRIPTION:' + escape('Daylight planned block. Local wall-clock time; no timezone conversion.'), 'END:VEVENT');
    }
    lines.push('END:VCALENDAR'); return lines.map(fold).join('\r\n') + '\r\n';
  }
  function freshState() { return { version: 1, configured: false, profile: { ...DEFAULT_PROFILE, workDays: [...DEFAULT_PROFILE.workDays] }, tasks: [], events: [], doneBlocks: {}, stepChecks: {}, logs: [], goals: [], timer: null }; }
  function demoState(date) {
    const state = freshState(); state.configured = true; state.profile.name = 'Alex';
    state.events = [
      { id: uid(), title: 'Breakfast & a slow start', start: '07:00', end: '07:30', date, repeat: 'daily', category: 'Personal' },
      { id: uid(), title: 'Lunch away from the desk', start: '12:00', end: '12:30', date, repeat: 'daily', category: 'Personal' },
      { id: uid(), title: 'Dinner & family time', start: '18:00', end: '19:00', date, repeat: 'daily', category: 'Personal' }
    ];
    const picks = [0, 1, 4, 5, 7];
    state.tasks = picks.map((i, index) => ({ ...TEMPLATES[i], id: uid(), date, repeat: index === 0 ? 'daily' : 'none', block: [15, 20, 30, 15, 15][index], priority: index < 2 ? 1 : 2, due: '', notes: '', requirements: TEMPLATES[i].requirements.map(text => ({ text, done: true })), steps: TEMPLATES[i].steps.map(text => ({ text, done: false })) }));
    state.goals = [{ id: uid(), title: 'Make space for a calmer morning', quarter: date.slice(0, 4) + '-Q' + (Math.floor(dateObject(date).getMonth() / 3) + 1), done: false }];
    return state;
  }
  function validateState(data) {
    if (!data || data.version !== 1) throw new Error('This is not a supported Daylight backup.');
    validateProfile(data.profile);
    if (!Array.isArray(data.tasks) || data.tasks.length > 1000 || !Array.isArray(data.events) || data.events.length > 500 || !Array.isArray(data.logs) || data.logs.length > 5000 || !Array.isArray(data.goals) || data.goals.length > 500 || !data.doneBlocks || typeof data.doneBlocks !== 'object' || Array.isArray(data.doneBlocks) || Object.keys(data.doneBlocks).length > 50000) throw new Error('The backup has invalid or oversized records.');
    const ids = new Set();
    function id(value) { if (typeof value !== 'string' || !/^[\w-]{1,100}$/.test(value) || ids.has(value)) throw new Error('The backup contains invalid or duplicate record IDs.'); ids.add(value); }
    for (const t of data.tasks) {
      id(t.id); validateTask(t);
      if (typeof t.notes !== 'string' || t.notes.length > 2000) throw new Error('Invalid task notes.');
      for (const r of [...t.requirements, ...t.steps]) if (typeof r.text !== 'string' || r.text.length > 300 || typeof r.done !== 'boolean') throw new Error('Invalid checklist.');
    }
    for (const e of data.events) { id(e.id); validateEvent(e); }
    for (const l of data.logs) { id(l.id); if (typeof l.title !== 'string' || l.title.length > 120 || !Number.isFinite(l.minutes) || l.minutes <= 0 || l.minutes > 1440 || typeof l.date !== 'string') throw new Error('Invalid time history.'); dateObject(l.date); }
    for (const g of data.goals) { id(g.id); if (typeof g.title !== 'string' || g.title.length > 160 || !/^\d{4}-Q[1-4]$/.test(g.quarter) || typeof g.done !== 'boolean') throw new Error('Invalid quarterly goal.'); }
    if (data.stepChecks && (typeof data.stepChecks !== 'object' || Array.isArray(data.stepChecks) || Object.keys(data.stepChecks).length > 50000)) throw new Error('Invalid step progress.');
    // Rebuild only known fields; never merge arbitrary imported properties.
    return { version: 1, configured: !!data.configured, profile: { name: String(data.profile.name || '').slice(0, 60), wake: data.profile.wake, sleep: data.profile.sleep, workStart: data.profile.workStart, workEnd: data.profile.workEnd, workDays: [...data.profile.workDays], block: data.profile.block, buffer: data.profile.buffer }, tasks: data.tasks, events: data.events, doneBlocks: { ...data.doneBlocks }, stepChecks: { ...(data.stepChecks || {}) }, logs: data.logs, goals: data.goals, timer: null };
  }
  return { BLOCKS, CATEGORIES, DEFAULT_PROFILE, TEMPLATES, uid, parseTime, time, localDate, dateObject, addDays, occurs, validateProfile, validateTask, validateEvent, eventSpans, key, isDone, buildPlan, average, csv, ics, freshState, demoState, validateState };
});
