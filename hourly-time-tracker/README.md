# Hourly Time Tracker

A personal tracker for daily work records, built with plain HTML, CSS, and JavaScript. No dependencies, backend, account, or build step.

## Daily workflow

- **Start / resume work** immediately, with optional activity and task notes. Stop when work ends. Restarting on the same local date adds another work period to the same row; off-clock gaps are excluded.
- **Start paid rest break**, then end it to resume work. Rest breaks remain paid, including short breaks of 5–20 minutes.
- **Start meal break**, then end it to resume work. A meal is deducted only if it lasts at least 30 minutes and you check that the entire meal is free of work duties. Interrupted meals and shorter meals remain paid. There is no automatic break deduction.
- Notes save as you type. One daily row contains all work and break start/end timestamps. Expand its times column to inspect every period.
- Use **Add or correct a daily record**, or **Edit**, to record missed work, correct times, update notes, or add breaks. Enter separate work periods around breaks. Periods cannot overlap. Stop an active day before editing or deleting it.
- Review weeks starting Monday and export CSV. Each CSV row is one daily record, with all work and break timestamps, meal duty-free status, paid hours, and estimated earnings. An active record is marked in progress.

Record all hours worked. Off-the-clock work and inaccurate reporting are prohibited by the supplied company policy. State-specific rules may also apply. The app implements the supplied break policy without jurisdiction-specific rules or overtime calculations. Earnings are estimates at a single configurable rate (default $100/hour).

An overnight workday stays on the date its first period began until stopped. Full dates are retained for every timestamp. Starting again after midnight creates or resumes the new calendar date's row. The browser clock continues through sleep or reload; the app never automatically stops time or caps hours. Review and correct forgotten timers.

## Run locally

From this directory, open `index.html`, or run:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

From the repository root, run `python3 -m http.server 8000 --directory hourly-time-tracker` instead. For GitHub Pages, publish the contents of `hourly-time-tracker/`, or access that subdirectory when serving the repository root.

## Data and migration

Records and the current work/break state are saved to localStorage in this browser and origin. They do not sync across browsers or devices. Changing the server port or switching between a local file and a server changes the storage origin. Export CSV periodically; clearing site data erases records. CSV is a readable timesheet, not a supported restore/import format.

The first run automatically groups v1 sessions by their start date, retaining task descriptions as daily notes, each session's times and exact elapsed duration, and any running timer. The original `hourly-time-tracker-v1` data remains untouched; new saves use `hourly-time-tracker-v2`. Existing overlapping legacy sessions are preserved for review; corrections require nonoverlapping periods. Manual edits keep millisecond precision in recorded timestamps.

## Tests

Requires Node.js with the built-in test runner; no packages to install:

```sh
node --test tests/*.test.cjs
```

Tests cover paid breaks, duty-free meal eligibility, split days, active timers, legacy migration, overnight work, and correction validation.
