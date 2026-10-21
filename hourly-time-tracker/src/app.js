(() => {
  "use strict";
  const KEY = "hourly-time-tracker-v2", OLD_KEY = "hourly-time-tracker-v1";
  const { dateKey, manualFields, manualTimestamp, paidMs, unpaid, migrate, validate } = TimeRecords;
  const $ = (id) => document.getElementById(id);
  const state = { entries: [], hourlyRate: 100 };
  let deleteId = null, toastHandle;
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const clock = (ms) => { const s = Math.floor(Math.max(0, ms) / 1000); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, "0")).join(":"); };
  const duration = (ms) => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };
  const localInput = (ms) => { const d = new Date(ms); return `${dateKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`; };
  const timestamp = (ms) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
  const monday = (value = dateKey(Date.now())) => { const d = new Date(`${value}T12:00`); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dateKey(d); };
  const activeDay = () => state.entries.find(e => e.periods.some(p => p.end === null));
  const current = (day = activeDay()) => day?.periods.find(p => p.end === null);
  const selected = () => state.entries.filter(e => monday(e.date) === $("weekStart").value).sort((a, b) => b.date.localeCompare(a.date));
  function toast(message) { $("toast").textContent = message; $("toast").classList.add("show"); clearTimeout(toastHandle); toastHandle = setTimeout(() => $("toast").classList.remove("show"), 4500); }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast("Could not save. Keep this page open and export a backup."); } }
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || "{}");
      state.entries = migrate(saved);
      if (Number.isFinite(saved.hourlyRate) && saved.hourlyRate >= 0) state.hourlyRate = saved.hourlyRate;
      persist();
    } catch { toast("Saved data could not be read. Reload before making changes to avoid replacing it."); return false; }
    return true;
  }
  const periodLabel = (p) => p.kind === "work" ? "Work" : p.kind === "rest" ? "Rest · paid" : `Meal · ${unpaid(p) ? "unpaid" : "paid"}${p.dutyFree ? " · duty-free" : " · duties not excluded"}`;
  function renderEntries() {
    const expanded = new Set([...$("entriesBody").querySelectorAll("details[open]")].map(el => el.dataset.day));
    const entries = selected(), total = entries.reduce((sum, e) => sum + paidMs(e), 0);
    $("weekHours").textContent = $("tableWeekTotal").textContent = duration(total);
    $("weekEarnings").textContent = money(total / 3600000 * state.hourlyRate);
    $("weekSessions").textContent = entries.length;
    $("entryCount").textContent = `${entries.length} daily record${entries.length === 1 ? "" : "s"}`;
    $("emptyState").classList.toggle("hidden", entries.length > 0);
    $("entriesBody").innerHTML = entries.map(e => `<tr>
      <td class="muted-cell">${escape(e.date)}</td>
      <td class="task-cell"><span title="${escape(e.notes)}">${escape(e.notes || "No notes yet")}</span></td>
      <td><details data-day="${escape(e.id)}" ${expanded.has(e.id) ? "open" : ""}><summary>${e.periods.filter(p => p.kind === "work").length} work period(s) · ${e.periods.filter(p => p.kind !== "work").length} break(s)${current(e) ? " · active" : ""}</summary><ul class="period-list">${e.periods.map(p => `<li><strong>${periodLabel(p)}</strong><br>${timestamp(p.start)} → ${p.end === null ? "In progress" : timestamp(p.end)}</li>`).join("")}</ul></details></td>
      <td class="duration-cell">${duration(paidMs(e))}</td><td>${money(paidMs(e) / 3600000 * state.hourlyRate)}</td>
      <td><div class="row-actions"><button class="button secondary" data-action="edit" data-id="${escape(e.id)}" ${current(e) ? "disabled" : ""}>Edit</button><button class="icon-button" data-action="delete" data-id="${escape(e.id)}" aria-label="Delete ${escape(e.date)}" ${current(e) ? "disabled" : ""}>×</button></div></td></tr>`).join("");
  }
  function renderTimer() {
    const day = activeDay(), p = current(day);
    const displayDay = day || state.entries.find(e => e.date === dateKey(Date.now()));
    $("timerDisplay").textContent = clock(displayDay ? paidMs(displayDay) : 0);
    $("timerStatus").className = `pill ${p ? "active" : "idle"}`;
    $("timerStatus").textContent = p ? periodLabel(p) : "Off the clock";
    $("timerButton").textContent = p ? "■ Stop work" : "▶ Start / resume work";
    $("restButton").disabled = !p || p.kind === "meal";
    $("mealButton").disabled = !p || p.kind === "rest";
    $("restButton").textContent = p?.kind === "rest" ? "End rest / resume work" : "Start paid rest break";
    $("mealButton").textContent = p?.kind === "meal" ? "End meal / resume work" : "Start meal break";
    $("dutyFree").disabled = p?.kind !== "meal";
    $("dutyFree").checked = p?.kind === "meal" && p.dutyFree === true;
    $("timerHelp").textContent = p ? `${day.date} · Paid time today. ${p.kind === "meal" ? "Confirm duty-free only if the entire meal has no work duties. Meals under 30 minutes remain paid." : "Stop when work ends; resume to add another period to this day. Notes save as you type."}` : "Start work immediately; notes are optional. Stopping and restarting on the same date uses one daily record.";
  }
  function render() { renderEntries(); renderTimer(); }
  function closePeriod(now) {
    const p = current();
    if (p) p.end = Math.max(p.start, now);
  }
  function start() {
    const now = Date.now(), date = dateKey(now);
    let day = state.entries.find(e => e.date === date);
    if (day?.periods.some(p => p.end > now)) { toast("This day has a recorded period ending in the future. Correct it before starting."); return; }
    if (!day) { day = { id: crypto.randomUUID(), date, notes: $("timerDescription").value, periods: [] }; state.entries.push(day); }
    day.periods.push({ kind: "work", start: now, end: null });
    $("timerDescription").value = day.notes;
    $("weekStart").value = monday(date);
    persist(); render();
  }
  function changeBreak(kind) {
    const day = activeDay(), p = current(day);
    if (!p) return;
    const now = Date.now(), next = p.kind === kind ? "work" : kind;
    closePeriod(now);
    day.periods.push({ kind: next, start: now, end: null, dutyFree: false });
    persist(); render();
  }
  function addPeriod(p = {}) {
    const row = document.createElement("div"); row.className = "period-row";
    row.innerHTML = `<label class="field"><span>Type</span><select class="period-kind"><option value="work">Work</option><option value="rest">Paid rest</option><option value="meal">Meal</option></select></label>
      <div class="period-boundary">
        <label class="field"><span>Start date</span><input class="period-start-date" type="date" required></label>
        <label class="field"><span>Start time</span><input class="period-start-time" type="time" step="60" required></label>
      </div>
      <div class="period-boundary">
        <label class="field"><span>End date</span><input class="period-end-date" type="date" required></label>
        <label class="field"><span>End time</span><input class="period-end-time" type="time" step="60" required></label>
      </div>
      <label class="check-label"><input class="period-duty" type="checkbox"> Meal entirely duty-free</label>
      <button class="icon-button remove-period" type="button" aria-label="Remove period">×</button>`;
    row.querySelector("select").value = p.kind || "work";
    for (const boundary of ["start", "end"]) {
      const fields = manualFields(p[boundary]);
      row.querySelector(`.period-${boundary}-date`).value = fields.date;
      row.querySelector(`.period-${boundary}-time`).value = fields.time;
      if (Number.isFinite(p[boundary])) row.dataset[boundary] = String(p[boundary]);
    }
    row.querySelector(".period-duty").checked = p.dutyFree === true;
    const setDuty = () => { row.querySelector(".period-duty").disabled = row.querySelector("select").value !== "meal"; };
    row.querySelector("select").addEventListener("change", setDuty); setDuty();
    row.querySelector("button").addEventListener("click", () => row.remove());
    $("periodEditor").appendChild(row);
  }
  function resetEditor() { $("entryForm").reset(); $("editId").value = ""; $("periodEditor").replaceChildren(); addPeriod(); $("entryEditor").open = false; }
  function edit(id) {
    const day = state.entries.find(e => e.id === id); if (!day || current(day)) return;
    $("editId").value = id; $("entryDescription").value = day.notes;
    $("periodEditor").replaceChildren(); day.periods.forEach(addPeriod);
    $("entryEditor").open = true; $("entryEditor").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function save(event) {
    event.preventDefault();
    const id = $("editId").value;
    if (id && current(state.entries.find(e => e.id === id))) { toast("Stop this day before editing it."); return; }
    const periods = [...$("periodEditor").children].map(row => {
      const readTime = boundary => manualTimestamp(
        row.querySelector(`.period-${boundary}-date`).value,
        row.querySelector(`.period-${boundary}-time`).value,
        row.dataset[boundary] === undefined ? undefined : Number(row.dataset[boundary])
      );
      return { kind: row.querySelector("select").value, start: readTime("start"), end: readTime("end"), dutyFree: row.querySelector(".period-duty").checked };
    });
    const error = validate(periods); if (error) { toast(error); return; }
    periods.sort((a, b) => a.start - b.start);
    const date = dateKey(periods[0].start);
    if (state.entries.some(e => e.date === date && e.id !== id)) { toast("A record already exists for this date. Edit that daily record to add periods."); return; }
    const day = { id: id || crypto.randomUUID(), date, notes: $("entryDescription").value, periods };
    state.entries = state.entries.filter(e => e.id !== id); state.entries.push(day);
    persist(); resetEditor(); if (date === dateKey(Date.now())) $("timerDescription").value = day.notes; $("weekStart").value = monday(date); render(); toast("Daily record saved.");
  }
  function exportCsv() {
    const days = selected(); if (!days.length) { toast("No daily records to export."); return; }
    const rows = [["Workday", "Activities / tasks", "Work start/end records", "Break start/end records", "Paid hours", "Hourly rate (USD)", "Estimated amount (USD)", "Record status"], ...days.map(e => {
      const times = kind => e.periods.filter(p => (p.kind === "work") === kind).map(p => `${periodLabel(p)}: ${localInput(p.start)} / ${p.end === null ? "IN PROGRESS" : localInput(p.end)}`).join("; ");
      return [e.date, e.notes, times(true), times(false), (paidMs(e) / 3600000).toFixed(6), state.hourlyRate, (paidMs(e) / 3600000 * state.hourlyRate).toFixed(2), current(e) ? "In progress" : "Stopped"];
    })];
    const cell = v => { let s = String(v ?? ""); if (/^[\s]*[=+@-]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map(r => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `timesheet-${monday()}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (!load()) { document.querySelectorAll("button, input, textarea").forEach(el => { el.disabled = true; }); return; }
  $("hourlyRate").value = state.hourlyRate;
  $("weekStart").value = monday();
  $("timerDescription").value = (activeDay() || state.entries.find(e => e.date === dateKey(Date.now())))?.notes || "";
  $("timerForm").addEventListener("submit", event => { event.preventDefault(); if (activeDay()) { closePeriod(Date.now()); persist(); render(); } else start(); });
  $("timerDescription").addEventListener("input", () => { const day = activeDay() || state.entries.find(e => e.date === dateKey(Date.now())); if (day) { day.notes = $("timerDescription").value; persist(); renderEntries(); } });
  $("restButton").addEventListener("click", () => changeBreak("rest"));
  $("mealButton").addEventListener("click", () => changeBreak("meal"));
  $("dutyFree").addEventListener("change", () => { const p = current(); if (p?.kind === "meal") { p.dutyFree = $("dutyFree").checked; persist(); render(); } });
  $("hourlyRate").addEventListener("change", () => { if (!$("hourlyRate").checkValidity()) return; state.hourlyRate = Number($("hourlyRate").value); persist(); renderEntries(); });
  $("weekStart").addEventListener("change", () => { $("weekStart").value = monday($("weekStart").value || dateKey(Date.now())); renderEntries(); });
  $("addPeriodButton").addEventListener("click", () => addPeriod());
  $("entryForm").addEventListener("submit", save);
  $("cancelEditButton").addEventListener("click", resetEditor);
  $("entriesBody").addEventListener("click", event => { const button = event.target.closest("button[data-action]"); if (!button || button.disabled) return; if (button.dataset.action === "edit") edit(button.dataset.id); else { deleteId = button.dataset.id; $("confirmDialog").showModal(); } });
  $("confirmDialog").addEventListener("close", () => { if ($("confirmDialog").returnValue === "delete" && !current(state.entries.find(e => e.id === deleteId))) { state.entries = state.entries.filter(e => e.id !== deleteId); if ($("editId").value === deleteId) resetEditor(); persist(); render(); } deleteId = null; });
  $("exportButton").addEventListener("click", exportCsv);
  resetEditor(); render();
  setInterval(() => { if (activeDay()) { renderTimer(); renderEntries(); } }, 1000);
})();
