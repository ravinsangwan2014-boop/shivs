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

## Run locally

No build step or dependencies are required.

1. Open `/home/runner/work/shivs/shivs/index.html` in any modern browser.
2. Start using the app.

## Limitations

- Data is stored only in the current browser on the current device/profile.
- Clearing browser storage or using a different browser/device will not carry over tasks.
