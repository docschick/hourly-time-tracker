/* Shared record calculations, also used by the dependency-free Node tests. */
(function (root) {
  "use strict";
  const dateKey = (value) => {
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  function manualFields(timestamp) {
    if (!Number.isFinite(timestamp)) return { date: "", time: "" };
    const d = new Date(timestamp);
    return { date: dateKey(d), time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` };
  }
  function manualTimestamp(date, time, original) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
    // Editing notes or a break type must not round an existing timer's timestamps.
    const previous = manualFields(original);
    if (previous.date === date && previous.time === time) return original;
    const value = new Date(`${date}T${time}:00`).getTime();
    const parsed = manualFields(value);
    return parsed.date === date && parsed.time === time ? value : NaN;
  }
  function unpaid(period, now = Date.now()) {
    return period.kind === "meal" && period.dutyFree === true && (period.end ?? now) - period.start >= 30 * 60000;
  }
  function paidMs(entry, now = Date.now()) {
    return entry.periods.reduce((sum, period) => sum + (unpaid(period, now) ? 0 : Math.max(0, (period.end ?? now) - period.start)), 0);
  }
  function validate(periods) {
    if (!periods.length) return "Add at least one work period.";
    const sorted = [...periods].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (!["work", "rest", "meal"].includes(p.kind) || !Number.isFinite(p.start) || !Number.isFinite(p.end) || p.end <= p.start) return "Each period needs valid start and end times, with end after start.";
      if (i && p.start < sorted[i - 1].end) return "Periods cannot overlap. Split work around each break.";
    }
    if (!sorted.some((p) => p.kind === "work")) return "Include at least one work period.";
    if (sorted[0].kind !== "work") return "The first period must be work.";
    return "";
  }
  function migrate(saved) {
    const days = new Map();
    const add = (date, notes, periods, id) => {
      if (!days.has(date)) days.set(date, { id: id || date, date, notes: "", periods: [] });
      const day = days.get(date);
      if (notes) day.notes += (day.notes ? "\n" : "") + notes;
      day.periods.push(...periods);
      day.periods.sort((a, b) => a.start - b.start);
    };
    for (const entry of saved.entries || []) {
      if (Array.isArray(entry.periods)) {
        add(entry.date, entry.notes, entry.periods, entry.id);
      } else {
        const start = new Date(`${entry.date}T${entry.start}`).getTime();
        let end = new Date(`${entry.endDate || entry.date}T${entry.end}`).getTime();
        if (Number.isFinite(entry.exactDurationMs)) end = start + entry.exactDurationMs;
        else if (end < start) { const next = new Date(end); next.setDate(next.getDate() + 1); end = next.getTime(); }
        if (Number.isFinite(start) && Number.isFinite(end)) add(entry.date, entry.description, [{ kind: "work", start, end }], entry.id);
      }
    }
    if (saved.activeTimer && Number.isFinite(saved.activeTimer.startedAt)) {
      const active = saved.activeTimer;
      add(dateKey(active.startedAt), active.description, [{ kind: "work", start: active.startedAt, end: null }]);
    }
    return [...days.values()];
  }
  const api = { dateKey, manualFields, manualTimestamp, unpaid, paidMs, validate, migrate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TimeRecords = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
