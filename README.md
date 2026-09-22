# shivs

A simple to-do list web app built with plain HTML, CSS, and JavaScript.

## Features

- Add a new task (button click or Enter key)
- Mark tasks as completed/uncompleted
- Delete tasks
- Filter tasks by **All**, **Active**, and **Completed**
- Clear all completed tasks
- Friendly empty states for each filter
- Basic validation to prevent empty tasks
- Safer recovery from malformed saved data
- Graceful fallback when browser storage is unavailable
- Improved keyboard and screen-reader announcements for filters and task actions
- Responsive, modern UI

## Data model and localStorage

Tasks are saved in browser `localStorage` under the key:

- `todo-app-tasks-v1`

Each task is stored as JSON with this shape:

- `id`: unique identifier
- `text`: task content
- `completed`: boolean status
- `createdAt`: ISO timestamp

On page load, the app reads saved tasks from `localStorage`, renders them, and writes updates back after each add/toggle/delete/clear action.

If `localStorage` is blocked or unavailable, the app falls back to an in-memory session so the UI still works, but tasks will not persist after refresh.

Malformed or partially invalid saved task data is ignored safely instead of crashing the app.

## Run locally

No build step or dependencies are required.

1. Open `index.html` in any modern browser.
2. Start using the app.

## Validate changes

This repository stays dependency-free. A lightweight Node test file covers the main runtime hardening and accessibility behaviors:

```bash
node --test tests/app.test.js
```

The test suite validates:

- malformed persisted data is skipped safely
- task text is normalized and capped to the same 200 character limit enforced by the UI
- filter buttons expose correct pressed state
- failed saves revert the pending UI change
- the app still works in session-only mode when browser storage is unavailable

For a quick manual browser check, open `index.html` directly and verify:

1. add a task
2. mark it complete and active again
3. switch between **All**, **Active**, and **Completed**
4. delete a task
5. clear completed tasks
6. reload the page to confirm persistence when browser storage is enabled

## Limitations

- Data is stored only in the current browser on the current device/profile.
- Clearing browser storage or using a different browser/device will not carry over tasks.
- When browser storage is unavailable, tasks work only for the current tab session and will not persist after refresh.
