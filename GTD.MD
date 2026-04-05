# GTD Focus App

## Purpose

This is a simple GTD-style task app built to keep the user focused on one current task at a time.

The core rule is:

- only one task can be active at once
- queued tasks wait until the current task is finished or returned to the queue

## Current Features

### Task Management

- Add a task with:
  - title
  - optional notes
- Edit a queued task
- Remove a queued task
- Start a queued task
- Mark the current task as done
- Return the current task back to the queue

### Current Task Rules

- Only one task can be active at a time
- When a task is started, it becomes the current task
- While a current task exists, queued tasks cannot be started
- The current task is shown in a dedicated Current Task section
- The current task can be:
  - marked done
  - returned to queue

### Queue / Prioritization

- Pending tasks are shown in a Queue section
- The queue only shows pending tasks
- The active task is not shown in the queue
- Completed tasks are not shown in the queue
- Pending tasks can be reordered using drag and drop
- Queue position determines task priority
- The top queued task is the next task to be worked on

### Reminder System

- Reminder interval is customizable
- Default reminder interval is 10 minutes
- Reminder interval is stored in local storage
- When a task becomes active, the app schedules the next reminder
- The current task shows the time remaining until the next reminder
- When the reminder becomes due:
  - browser notification is sent if permission is granted
  - alert is shown in the app flow
- Changing the reminder interval updates the active task’s next reminder schedule

### Notification Support

- User can enable browser notifications
- The app detects whether the browser supports notifications
- The UI reflects notification availability / enabled state

### History

- Completed tasks are moved to History
- History only shows tasks marked as done
- Each history item shows:
  - title
  - notes
  - started timestamp
  - finished timestamp
- History is sorted by most recently completed first

### Persistence

- Tasks are stored in `localStorage`
- Reminder settings are stored in `localStorage`
- Data persists between browser sessions on the same device/browser

## Current UI Sections

- Hero / app header
- Quick Add
- Reminder settings
- Current Task
- Queue
- History

## Current Data Model

Each task currently stores:

- `id`
- `title`
- `notes`
- `status`
  - `pending`
  - `active`
  - `done`
- `createdAt`
- `startedAt`
- `completedAt`
- `nextReminderAt`

Settings currently store:

- `reminderMinutes`

## Behavior Summary

### Start Task

- User starts a queued task
- Task status changes from `pending` to `active`
- `startedAt` is recorded
- `nextReminderAt` is scheduled based on the selected reminder interval

### Mark Done

- User marks the current task as done
- Task status changes from `active` to `done`
- Task is removed from Current Task
- Task is removed from Queue
- `completedAt` is recorded
- Task appears in History

### Return To Queue

- User returns the current task to the queue
- Task status changes from `active` to `pending`
- Reminder schedule is cleared
- Task is inserted back at the top of the queue

## Design Direction

The current UI direction is minimalist:

- simple layout
- low visual noise
- separate focus area for the active task
- queue-based pending list
- light color palette

## Known Scope

This app is currently a lightweight GTD/focus app, not a full GTD system yet.

It does not currently include:

- projects
- tags or contexts
- due dates
- recurring tasks
- subtasks
- daily review
- weekly review
- cloud sync
- user accounts
