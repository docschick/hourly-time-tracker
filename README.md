# Hourly Time Tracker

A personal daily time tracker built with plain HTML, CSS, and JavaScript. Each workday has one row containing all work periods, paid rest breaks, meal start/end times, and activity notes.

Start and stop work repeatedly without creating extra daily entries. Meals are unpaid only when at least 30 minutes and explicitly marked entirely free of work duties. Record and correct all hours worked.

See [the app documentation](hourly-time-tracker/README.md) for the workflow, policy behavior, migration, storage, CSV export, and tests.

From this repository root:

```sh
python3 -m http.server 8000 --directory hourly-time-tracker
```

Open <http://localhost:8000>, or open `hourly-time-tracker/index.html` directly. No dependencies or build step are required.

Run tests with Node.js:

```sh
node --test hourly-time-tracker/tests/*.test.cjs
```
