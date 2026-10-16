(() => {
  "use strict";

  const STORAGE_KEY = "hourly-time-tracker-v1";
  const $ = (id) => document.getElementById(id);
  const state = {
    entries: [],
    hourlyRate: 100,
    activeTimer: null,
    deleteId: null,
    tickHandle: null,
    toastHandle: null
  };

  const els = {
    hourlyRate: $("hourlyRate"),
    weekHours: $("weekHours"),
    weekEarnings: $("weekEarnings"),
    weekSessions: $("weekSessions"),
    timerForm: $("timerForm"),
    timerDescription: $("timerDescription"),
    timerDisplay: $("timerDisplay"),
    timerButton: $("timerButton"),
    timerStatus: $("timerStatus"),
    timerHelp: $("timerHelp"),
    weekStart: $("weekStart"),
    exportButton: $("exportButton"),
    entryForm: $("entryForm"),
    editId: $("editId"),
    entryDate: $("entryDate"),
    entryDescription: $("entryDescription"),
    entryStart: $("entryStart"),
    entryEnd: $("entryEnd"),
    saveEntryButton: $("saveEntryButton"),
    cancelEditButton: $("cancelEditButton"),
    entriesBody: $("entriesBody"),
    emptyState: $("emptyState"),
    entryCount: $("entryCount"),
    tableWeekTotal: $("tableWeekTotal"),
    confirmDialog: $("confirmDialog"),
    confirmDeleteButton: $("confirmDeleteButton"),
    toast: $("toast")
  };

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function mondayOf(date) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = result.getDay();
    result.setDate(result.getDate() - ((day + 6) % 7));
    return result;
  }

  function weekDateString(date = new Date()) {
    return localDateString(mondayOf(date));
  }

  function dateFromString(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function shiftDateString(value, days) {
    const date = dateFromString(value);
    date.setDate(date.getDate() + days);
    return localDateString(date);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  }

  function durationLabel(minutes) {
    const safeMinutes = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    return `${hours}h ${String(mins).padStart(2, "0")}m`;
  }

  function durationClock(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
  }

  function timeToMinutes(value) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function entryDuration(entry) {
    // Timer-created entries retain their exact elapsed duration, including short sessions.
    if (Number.isFinite(entry.exactDurationMs)) return Math.max(0, entry.exactDurationMs / 60000);
    let end = timeToMinutes(entry.end);
    const start = timeToMinutes(entry.start);
    if (end < start) end += 24 * 60;
    return end - start;
  }

  function formatDate(value) {
    return dateFromString(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTime(value) {
    const [hours, minutes] = value.split(":").map(Number);
    const date = new Date(2000, 0, 1, hours, minutes);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        entries: state.entries,
        hourlyRate: state.hourlyRate,
        activeTimer: state.activeTimer
      }));
    } catch (error) {
      showToast("Could not save data in this browser.");
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.entries)) {
        state.entries = saved.entries.filter((entry) =>
          entry && typeof entry.id === "string" &&
          typeof entry.date === "string" &&
          typeof entry.description === "string" &&
          typeof entry.start === "string" &&
          typeof entry.end === "string"
        );
      }
      if (Number.isFinite(Number(saved.hourlyRate)) && Number(saved.hourlyRate) >= 0) {
        state.hourlyRate = Number(saved.hourlyRate);
      }
      if (saved.activeTimer && typeof saved.activeTimer.startedAt === "number" &&
          typeof saved.activeTimer.description === "string") {
        state.activeTimer = saved.activeTimer;
      }
    } catch (error) {
      showToast("Saved data could not be read. You can start a fresh timesheet.");
    }
  }

  function selectedWeek() {
    return els.weekStart.value || weekDateString();
  }

  function entriesForSelectedWeek() {
    const start = selectedWeek();
    const end = shiftDateString(start, 7);
    return state.entries
      .filter((entry) => entry.date >= start && entry.date < end)
      .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
  }

  function totalMinutes(entries) {
    return entries.reduce((sum, entry) => sum + entryDuration(entry), 0);
  }

  function renderSummary() {
    const entries = entriesForSelectedWeek();
    const minutes = totalMinutes(entries);
    els.weekHours.textContent = durationLabel(minutes);
    els.weekEarnings.textContent = money((minutes / 60) * state.hourlyRate);
    els.weekSessions.textContent = String(entries.length);
    els.tableWeekTotal.textContent = durationLabel(minutes);
    els.entryCount.textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  }

  function renderEntries() {
    const entries = entriesForSelectedWeek();
    els.emptyState.classList.toggle("hidden", entries.length > 0);
    els.entriesBody.innerHTML = entries.map((entry) => {
      const minutes = entryDuration(entry);
      const endDayOffset = timeToMinutes(entry.end) < timeToMinutes(entry.start) ? " (+1 day)" : "";
      return `<tr>
        <td class="muted-cell">${formatDate(entry.date)}</td>
        <td class="task-cell" title="${escapeHtml(entry.description)}">${escapeHtml(entry.description)}</td>
        <td class="muted-cell">${formatTime(entry.start)}–${formatTime(entry.end)}${endDayOffset}</td>
        <td class="duration-cell">${durationLabel(minutes)}</td>
        <td class="amount-cell">${money(minutes / 60 * state.hourlyRate)}</td>
        <td><div class="row-actions">
          <button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(entry.id)}" aria-label="Edit ${escapeHtml(entry.description)}" title="Edit entry">✎</button>
          <button class="icon-button" type="button" data-action="delete" data-id="${escapeHtml(entry.id)}" aria-label="Delete ${escapeHtml(entry.description)}" title="Delete entry">×</button>
        </div></td>
      </tr>`;
    }).join("");
    renderSummary();
  }

  function renderTimer() {
    if (state.activeTimer) {
      const elapsed = Date.now() - state.activeTimer.startedAt;
      els.timerDisplay.textContent = durationClock(elapsed);
      els.timerStatus.className = "pill active";
      els.timerStatus.innerHTML = '<span class="status-dot"></span> Tracking now';
      els.timerButton.textContent = "■ Stop & save";
      els.timerButton.classList.remove("primary");
      els.timerButton.classList.add("danger");
      els.timerDescription.value = state.activeTimer.description;
      els.timerDescription.readOnly = true;
      els.timerHelp.textContent = "Timer is running. Stop it to save this session to your timesheet.";
    } else {
      els.timerDisplay.textContent = "00:00:00";
      els.timerStatus.className = "pill idle";
      els.timerStatus.innerHTML = '<span class="status-dot"></span> Not tracking';
      els.timerButton.textContent = "▶ Start timer";
      els.timerButton.classList.remove("danger");
      els.timerButton.classList.add("primary");
      els.timerDescription.readOnly = false;
      els.timerHelp.textContent = "Start a timer when you begin. Stop it to save the session to your timesheet.";
    }
  }

  function render() {
    renderEntries();
    renderTimer();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(state.toastHandle);
    state.toastHandle = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function resetEntryForm() {
    els.entryForm.reset();
    els.editId.value = "";
    els.entryDate.value = localDateString();
    els.saveEntryButton.textContent = "Add entry";
    els.cancelEditButton.classList.add("hidden");
  }

  function startTimer(description) {
    state.activeTimer = {
      description: description.trim(),
      startedAt: Date.now(),
      startDate: localDateString(),
      startTime: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`
    };
    persist();
    renderTimer();
    showToast("Timer started.");
  }

  function stopTimer() {
    const active = state.activeTimer;
    if (!active) return;

    const endDate = localDateString();
    const now = new Date();
    const startDate = active.startDate || localDateString(new Date(active.startedAt));
    const startTime = active.startTime || `${String(new Date(active.startedAt).getHours()).padStart(2, "0")}:${String(new Date(active.startedAt).getMinutes()).padStart(2, "0")}`;
    const endTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Store sessions as one entry. Overnight work is represented with an end time earlier than start time.
    state.entries.push({
      id: makeId(),
      date: startDate,
      description: active.description,
      start: startTime,
      end: endTime,
      endDate,
      exactDurationMs: Math.max(1000, Date.now() - active.startedAt)
    });
    state.activeTimer = null;
    persist();
    // Show the week containing the session's start date.
    els.weekStart.value = weekDateString(dateFromString(startDate));
    render();
    showToast("Session saved to your timesheet.");
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function handleEntrySubmit(event) {
    event.preventDefault();
    const date = els.entryDate.value;
    const description = els.entryDescription.value.trim();
    const start = els.entryStart.value;
    const end = els.entryEnd.value;
    if (!date || !description || !start || !end) {
      showToast("Please complete all entry fields.");
      return;
    }
    if (start === end) {
      showToast("Start and end times can't be the same.");
      return;
    }

    const editId = els.editId.value;
    const updated = { id: editId || makeId(), date, description, start, end };
    if (editId) {
      state.entries = state.entries.map((entry) => entry.id === editId ? updated : entry);
      showToast("Entry updated.");
    } else {
      state.entries.push(updated);
      showToast("Entry added.");
    }
    persist();
    els.weekStart.value = weekDateString(dateFromString(date));
    resetEntryForm();
    render();
  }

  function beginEdit(id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    els.editId.value = entry.id;
    els.entryDate.value = entry.date;
    els.entryDescription.value = entry.description;
    els.entryStart.value = entry.start;
    els.entryEnd.value = entry.end;
    els.saveEntryButton.textContent = "Save changes";
    els.cancelEditButton.classList.remove("hidden");
    els.entryForm.scrollIntoView({ behavior: "smooth", block: "center" });
    els.entryDescription.focus();
  }

  function deleteEntry(id) {
    state.entries = state.entries.filter((entry) => entry.id !== id);
    persist();
    render();
    showToast("Entry deleted.");
  }

  function csvCell(value) {
    const string = String(value ?? "");
    return `"${string.replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    const entries = entriesForSelectedWeek();
    if (!entries.length) {
      showToast("There are no entries to export for this week.");
      return;
    }
    const rows = [
      ["Date", "Task / Project", "Start Time", "End Time", "Duration (hours)", "Hourly Rate (USD)", "Amount (USD)"],
      ...entries.map((entry) => {
        const minutes = entryDuration(entry);
        return [
          entry.date,
          entry.description,
          entry.start,
          entry.end,
          (minutes / 60).toFixed(2),
          state.hourlyRate.toFixed(2),
          (minutes / 60 * state.hourlyRate).toFixed(2)
        ];
      })
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesheet-${selectedWeek()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("CSV export downloaded.");
  }

  function initialize() {
    load();
    els.hourlyRate.value = state.hourlyRate.toFixed(2).replace(/\.00$/, "");
    els.weekStart.value = weekDateString();
    els.entryDate.value = localDateString();

    els.hourlyRate.addEventListener("change", () => {
      const parsed = Number(els.hourlyRate.value);
      state.hourlyRate = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
      els.hourlyRate.value = String(state.hourlyRate);
      persist();
      renderEntries();
    });

    els.timerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.activeTimer) {
        stopTimer();
        return;
      }
      const description = els.timerDescription.value.trim();
      if (!description) {
        els.timerDescription.focus();
        showToast("Add a task or project before starting.");
        return;
      }
      startTimer(description);
    });

    els.entryForm.addEventListener("submit", handleEntrySubmit);
    els.cancelEditButton.addEventListener("click", resetEntryForm);
    els.weekStart.addEventListener("change", () => {
      if (els.weekStart.value) {
        // Normalize any selected date to the Monday of that week.
        els.weekStart.value = weekDateString(dateFromString(els.weekStart.value));
      }
      renderEntries();
    });

    els.entriesBody.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const { action, id } = button.dataset;
      if (action === "edit") beginEdit(id);
      if (action === "delete") {
        state.deleteId = id;
        if (typeof els.confirmDialog.showModal === "function") els.confirmDialog.showModal();
        else if (window.confirm("Delete this entry?")) deleteEntry(id);
      }
    });

    els.confirmDialog.addEventListener("close", () => {
      if (els.confirmDialog.returnValue === "delete" && state.deleteId) deleteEntry(state.deleteId);
      state.deleteId = null;
    });

    els.exportButton.addEventListener("click", exportCsv);

    render();
    state.tickHandle = setInterval(() => {
      if (state.activeTimer) renderTimer();
    }, 1000);
  }

  initialize();
})();
