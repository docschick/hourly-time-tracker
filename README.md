Hourly Time Tracker

A small, single-user time tracker built with plain HTML, CSS, and JavaScript. Designed for tracking hourly contract work without a framework, backend, or account.
Features

    Start and stop a live timer for a task or project
    Add, edit, and delete manual work entries
    Review sessions by week
    Calculate tracked hours and estimated earnings using a configurable hourly rate
    Export the selected week's timesheet as CSV
    Persist entries and timer state in browser local storage
    Responsive layout for desktop and mobile

Run locally

No dependencies or build step are required.

    Clone or download this repository.
    Open index.html in a modern browser.

For a local web server, you can also run:

python3 -m http.server 8000

Then visit http://localhost:8000.
Deploy with GitHub Pages

    Push the repository to GitHub.
    Open the repository's Settings → Pages.
    Under build and deployment, select Deploy from a branch.
    Select the main branch and / (root) folder, then save.

Data and privacy

Entries are stored in localStorage in the current browser and on the current device. They are not automatically synced across devices or browsers. Clearing site data can erase them, so export CSV backups periodically. If deployed publicly, each visitor has their own local data in their own browser.
Notes

    The default hourly rate is $100; change it to your rate.
    Week views start on Monday.
    Manually entered times are interpreted as local time.
    If an end time is earlier than its start time, the entry is treated as an overnight session.
    The timer uses the browser's clock. If the browser or device sleeps, the displayed elapsed time catches up when it wakes.

Possible next steps

    Add client/project names and billable/non-billable flags
    Add break tracking
    Add weekly invoice summaries
    Add import from CSV or JSON backup
    Add tests for duration and weekly-total calculations

License

Choose a license before publishing if you want to specify how others may use, modify, or distribute the project.
