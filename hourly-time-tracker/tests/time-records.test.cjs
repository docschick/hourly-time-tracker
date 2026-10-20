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
