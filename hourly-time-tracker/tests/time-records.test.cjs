const { test } = require('node:test');
const assert = require('node:assert/strict');
const { paidMs, unpaid, validate, migrate } = require('../src/time-records.js');
const min = 60000;
const p = (kind, start, end, dutyFree = false) => ({ kind, start: start * min, end: end === null ? null : end * min, dutyFree });
test('paid rest breaks and interrupted or short meals remain paid', () => {
  for (const period of [p('rest', 0, 5), p('rest', 0, 20), p('meal', 0, 29, true), p('meal', 0, 45, false)]) {
    assert.equal(unpaid(period), false);
    assert.equal(paidMs({ periods: [period] }), period.end);
  }
  assert.equal(unpaid(p('meal', 0, 30, true)), true);
  assert.equal(paidMs({ periods: [p('meal', 0, 30, true)] }), 0);
});
test('split workday counts all work and paid breaks, excludes off-clock gaps and eligible meals', () => {
  assert.equal(paidMs({ periods: [p('work', 0, 120), p('rest', 120, 135), p('work', 135, 240), p('meal', 240, 270, true), p('work', 270, 480), p('work', 540, 600)] }), 510 * min);
});
test('live work survives persisted state, including open breaks', () => {
  const entry = JSON.parse(JSON.stringify({ periods: [p('work', 0, 60), p('meal', 60, null, true)] }));
  assert.equal(paidMs(entry, 89 * min), 89 * min);
  assert.equal(paidMs(entry, 90 * min), 60 * min);
});
test('migration groups legacy sessions, preserves notes, precise durations, and active timer', () => {
  const start = new Date('2026-10-20T13:00').getTime();
  const days = migrate({ entries: [
    { id: 'a', date: '2026-10-20', description: 'First task', start: '09:00', end: '10:00', exactDurationMs: 3600123 },
    { id: 'b', date: '2026-10-20', description: 'Second task', start: '11:00', end: '12:00' }
  ], activeTimer: { startedAt: start, description: 'Third task' } });
  assert.equal(days.length, 1); assert.equal(days[0].periods.length, 3);
  assert.equal(days[0].notes, 'First task\nSecond task\nThird task');
  assert.equal(paidMs(days[0], start + min), 7260123);
  assert.deepEqual(migrate({ entries: days }), days);
});
test('overnight and multiday legacy records retain end dates', () => {
  const [day] = migrate({ entries: [{ date: '2026-10-20', description: '', start: '23:00', end: '01:00' }] });
  assert.equal(paidMs(day), 120 * min);
  const [long] = migrate({ entries: [{ date: '2026-10-20', endDate: '2026-10-22', description: '', start: '09:00', end: '09:00' }] });
  assert.equal(paidMs(long), 48 * 60 * min);
});
test('manual corrections reject missing work, reversed times, and overlaps', () => {
  assert.ok(validate([])); assert.ok(validate([p('work', 30, 10)]));
  assert.ok(validate([p('work', 0, 60), p('rest', 50, 70)]));
  assert.ok(validate([p('meal', 0, 30)]));
  assert.equal(validate([p('work', 0, 60), p('rest', 60, 75), p('work', 75, 120)]), '');
});

const { manualFields, manualTimestamp } = require('../src/time-records.js');
test('manual fields use local dates and hours/minutes without seconds', () => {
  const timestamp = new Date(2026, 9, 21, 9, 7, 42, 123).getTime();
  assert.deepEqual(manualFields(timestamp), { date: '2026-10-21', time: '09:07' });
  assert.deepEqual(manualFields(undefined), { date: '', time: '' });
  assert.deepEqual(manualFields(null), { date: '', time: '' });
});
test('unchanged minute fields preserve exact timer durations and meal eligibility', () => {
  const start = new Date(2026, 9, 21, 12, 0, 50, 123).getTime();
  const end = new Date(2026, 9, 21, 12, 30, 10, 456).getTime();
  const restore = value => { const f = manualFields(value); return manualTimestamp(f.date, f.time, value); };
  const meal = { kind: 'meal', start: restore(start), end: restore(end), dutyFree: true };
  assert.equal(meal.start, start);
  assert.equal(meal.end, end);
  assert.equal(unpaid(meal), false);
  assert.equal(paidMs({ periods: [meal] }), end - start);
});
test('changed and new manual times use minute precision, including overnight work', () => {
  const original = new Date(2026, 9, 21, 9, 7, 42, 123).getTime();
  assert.equal(manualTimestamp('2026-10-21', '09:08', original), new Date(2026, 9, 21, 9, 8).getTime());
  assert.equal(manualTimestamp('2026-10-22', '09:07', original), new Date(2026, 9, 22, 9, 7).getTime());
  const work = { kind: 'work', start: manualTimestamp('2026-10-21', '23:30'), end: manualTimestamp('2026-10-22', '01:15') };
  assert.equal(validate([work]), '');
  assert.equal(paidMs({ periods: [work] }), 105 * min);
});
test('manual input rejects missing fields, invalid dates, and second precision', () => {
  for (const [date, time] of [['', '09:00'], ['2026-10-21', ''], ['2026-02-30', '09:00'], ['2026-10-21', '25:00'], ['2026-10-21', '09:00:10']]) {
    assert.ok(Number.isNaN(manualTimestamp(date, time)));
  }
});
