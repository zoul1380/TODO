# Things To Do — GTD Focus App

A minimalist, browser-based task manager built around the GTD (Getting Things Done) principle: **focus on one task at a time**. No server, no login, no install — runs entirely in your browser from a single HTML file.

---

## Features

### One Task at a Time
Only one task can be active at a time. While a task is in progress, the queue is locked — finish or return it before moving on.

### Reminder Schedule
Instead of a single fixed interval, you define a **custom reminder schedule** as a comma-separated list of minutes (e.g. `3, 8, 15, 30`). The app cycles through them in order, then repeats the last value. When a reminder fires you get:
- An in-app toast notification
- A browser push notification (if permission is granted)
- A configurable alert sound

### Alert Sounds
Choose from four built-in Web Audio sounds — no external files required:
| Option | Description |
|--------|-------------|
| **Beep** | Short 880 Hz tone |
| **Chime** | Descending three-note sequence |
| **Bell** | Sustained C5 with fade |
| **Silent** | No sound |

### Per-Task Start Interval
The dropdown next to the **Add** button lets you choose which step in the reminder schedule to start from. Your last-used selection is remembered across adds. If the schedule changes and the saved step no longer exists, it falls back to the first interval.

### Queue & Drag-to-Reorder
Pending tasks are listed in priority order. Drag and drop any row to reprioritize.

### History — Grouped by Date
Completed tasks are grouped under collapsible date headers. Each date group can be:
- **Collapsed / expanded** by clicking the header
- **Cleared** with the Clear button (removes all completions for that date)

### Persistence
All tasks and settings are saved to `localStorage` — data survives page reloads on the same device and browser.

---

## Getting Started

No build step, no dependencies.

1. Clone or download the repository:
   ```bash
   git clone https://github.com/zoul1380/TODO.git
   ```
2. Open `index.html` in any modern browser.
3. That's it.

---

## Usage

### Adding a Task
1. Type a task title in the **"What needs doing?"** field.
2. Press **Enter** or the first line of notes will expand automatically if you tab into the notes field.
3. Pick a starting reminder interval from the dropdown.
4. Click **Add**.

### Starting a Task
Click the **▶** (play) button on any queued task to make it the active task. A countdown to the next reminder appears on the task card.

### Completing a Task
- Click **Done** beneath the active task card, or
- Hover over the card and click the ✓ circle that appears.

### Returning a Task to the Queue
Click **Back to queue** beneath the active task to pause it and send it back to the top of the queue.

### Settings (⚙)
Click the gear icon in the top-right corner to open settings.

| Setting | Description |
|---------|-------------|
| **Reminder schedule** | Comma-separated list of minute intervals, e.g. `3, 8, 15, 30` |
| **Alert sound** | Sound played on each reminder: Beep, Chime, Bell, or Silent |
| **Enable notifications** | Requests browser permission for push notifications |

Click **Save** to apply. Changes to the schedule take effect immediately, including for the currently active task.

---

## File Structure

```
index.html   — App shell and markup
app.js       — All application logic (no framework, vanilla JS)
styles.css   — All styles (CSS variables, responsive)
GTD.MD       — Internal design notes and data model reference
```

---

## Browser Support

Works in any modern browser that supports:
- `localStorage`
- `Web Audio API`
- `Notification` API (optional — in-app toasts always work)
- CSS custom properties

---

## License

MIT
