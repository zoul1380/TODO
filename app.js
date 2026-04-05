const STORAGE_KEY = "gtd-focus-tasks-v1";
const SETTINGS_KEY = "gtd-focus-settings-v1";
const DEFAULT_REMINDER_MINUTES = 10;
const VALID_SOUNDS = ["beep", "chime", "bell", "none"];

const taskForm = document.querySelector("#taskForm");
const settingsForm = document.querySelector("#settingsForm");
const titleInput = document.querySelector("#taskTitle");
const notesInput = document.querySelector("#taskNotes");
const reminderScheduleInput = document.querySelector("#reminderScheduleInput");
const notificationSoundSelect = document.querySelector("#notificationSoundSelect");
const taskList = document.querySelector("#taskList");
const taskCount = document.querySelector("#taskCount");
const historyList = document.querySelector("#historyList");
const historyCount = document.querySelector("#historyCount");
const currentTaskCard = document.querySelector("#currentTaskCard");
const currentTaskActions = document.querySelector("#currentTaskActions");
const currentDoneButton = document.querySelector("#currentDoneButton");
const currentQueueButton = document.querySelector("#currentQueueButton");
const notificationButton = document.querySelector("#notificationButton");
const settingsStatus = document.querySelector("#settingsStatus");
const settingsToggle = document.querySelector("#settingsToggle");
const settingsPanel = document.querySelector("#settingsPanel");
const taskItemTemplate = document.querySelector("#taskItemTemplate");
const historyItemTemplate = document.querySelector("#historyItemTemplate");
const taskReminderSelect = document.querySelector("#taskReminderSelect");
const toastContainer = document.querySelector("#toastContainer");

let tasks = loadTasks();
let settings = loadSettings();
let reminderTimerId = null;
let draggedTaskId = null;
let reminderTickId = null;
let lastReminderSelectIndex = 0;
let collapsedDates = new Set();

syncSettingsPanel();
render();
startReminderLoop();
syncNotificationButton();

window.addEventListener("beforeunload", (event) => {
  if (getActiveTask()) {
    event.preventDefault();
  }
});

settingsToggle.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
  settingsToggle.classList.toggle("active");
  if (!settingsPanel.classList.contains("hidden")) {
    syncSettingsPanel();
  }
});

syncReminderSelect();

taskReminderSelect.addEventListener("change", () => {
  lastReminderSelectIndex = Number(taskReminderSelect.value) || 0;
});

titleInput.addEventListener("input", () => {
  if (titleInput.value.trim()) {
    notesInput.classList.remove("collapsed");
  } else if (!notesInput.value.trim()) {
    notesInput.classList.add("collapsed");
  }
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const notes = notesInput.value.trim();

  if (!title) {
    titleInput.focus();
    return;
  }

  const startIndex = Number(taskReminderSelect.value) || 0;

  tasks.unshift({
    id: crypto.randomUUID(),
    title,
    notes,
    status: "pending",
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    initialScheduleIndex: startIndex,
  });

  persistAndRender();
  taskForm.reset();
  notesInput.classList.add("collapsed");
  syncReminderSelect();
  titleInput.focus();
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const rawSchedule = reminderScheduleInput.value;
  const parsedSchedule = rawSchedule
    .split(/[\s,]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 240);

  if (parsedSchedule.length === 0) {
    showToast("Enter at least one valid interval between 1 and 240 minutes.", "error");
    reminderScheduleInput.focus();
    return;
  }

  settings = {
    reminderSchedule: parsedSchedule,
    notificationSound: notificationSoundSelect.value,
  };

  const activeTask = getActiveTask();

  if (activeTask) {
    tasks = tasks.map((task) => {
      if (task.id !== activeTask.id) {
        return task;
      }
      const idx = Math.min(task.reminderScheduleIndex ?? 0, parsedSchedule.length - 1);
      return {
        ...task,
        reminderScheduleIndex: idx,
        nextReminderAt: Date.now() + parsedSchedule[idx] * 60 * 1000,
      };
    });
  }

  persistSettings();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  startReminderLoop();
  render();
  syncReminderSelect();
  showToast("Settings saved.", "info");
});

taskList.addEventListener("click", (event) => {
  const actionButton = event.target.closest("button[data-action]");

  if (!actionButton) {
    return;
  }

  const { action, taskId } = actionButton.dataset;
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  if (action === "start") {
    startTask(taskId);
    return;
  }

  if (action === "done") {
    markTaskDone(taskId);
    return;
  }

  if (action === "delete") {
    removeTask(taskId);
    return;
  }

  if (action === "edit") {
    editTask(taskId);
  }
});

taskList.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".task-row[data-task-id]");

  if (!card) {
    event.preventDefault();
    return;
  }

  draggedTaskId = card.dataset.taskId;
  card.classList.add("dragging");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedTaskId);
  }
});

taskList.addEventListener("dragover", (event) => {
  const card = event.target.closest(".task-row[data-task-id]");

  if (!draggedTaskId || !card || card.dataset.taskId === draggedTaskId) {
    return;
  }

  event.preventDefault();
  clearDropTargets();
  card.classList.add("drop-target");
});

taskList.addEventListener("drop", (event) => {
  const card = event.target.closest(".task-row[data-task-id]");

  if (!draggedTaskId || !card || card.dataset.taskId === draggedTaskId) {
    clearDropTargets();
    return;
  }

  event.preventDefault();
  movePendingTask(draggedTaskId, card.dataset.taskId);
});

taskList.addEventListener("dragend", () => {
  draggedTaskId = null;
  clearDropTargets();
  clearDraggingState();
});

notificationButton.addEventListener("click", async () => {
  if (!"Notification" in window) {
    showToast("This browser does not support notifications.", "error");
    return;
  }

  if (Notification.permission === "granted") {
    syncNotificationButton();
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission === "denied") {
    showToast("Notification permission denied. In-app reminders still work.", "info");
  }

  syncNotificationButton();
});

currentDoneButton.addEventListener("click", () => {
  const activeTask = getActiveTask();

  if (!activeTask) {
    return;
  }

  markTaskDone(activeTask.id);
});

currentQueueButton.addEventListener("click", () => {
  const activeTask = getActiveTask();

  if (!activeTask) {
    return;
  }

  moveActiveTaskToQueue();
});

function loadTasks() {
  try {
    const savedTasks = window.localStorage.getItem(STORAGE_KEY);
    const parsedTasks = savedTasks ? JSON.parse(savedTasks) : [];

    return parsedTasks.map((task) => ({
      ...task,
      reminderScheduleIndex: task.reminderScheduleIndex ?? 0,
      nextReminderAt:
        task.nextReminderAt ||
        (task.lastReminderAt
          ? task.lastReminderAt + DEFAULT_REMINDER_MINUTES * 60 * 1000
          : task.startedAt
            ? task.startedAt + DEFAULT_REMINDER_MINUTES * 60 * 1000
            : null),
    }));
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    const savedSettings = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}");

    // Migrate legacy single reminderMinutes value
    let schedule = Array.isArray(savedSettings.reminderSchedule)
      ? savedSettings.reminderSchedule.filter((n) => Number.isInteger(n) && n >= 1 && n <= 240)
      : [];

    if (schedule.length === 0 && savedSettings.reminderMinutes) {
      const legacy = Number(savedSettings.reminderMinutes);
      if (Number.isInteger(legacy) && legacy >= 1 && legacy <= 240) {
        schedule = [legacy];
      }
    }

    const notificationSound = VALID_SOUNDS.includes(savedSettings.notificationSound)
      ? savedSettings.notificationSound
      : "beep";

    return {
      reminderSchedule: schedule.length > 0 ? schedule : [DEFAULT_REMINDER_MINUTES],
      notificationSound,
    };
  } catch {
    return { reminderSchedule: [DEFAULT_REMINDER_MINUTES], notificationSound: "beep" };
  }
}

function persistAndRender() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  render();
}

function persistSettings() {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function render() {
  renderCurrentTask();
  renderTaskList();
  renderHistory();
  updateTaskCount();
  updateSettingsStatus();
}

function renderCurrentTask() {
  const activeTask = getActiveTask();

  if (!activeTask) {
    currentTaskCard.className = "current-card empty";
    currentTaskCard.innerHTML = "<p>Nothing in focus — start a task from the queue.</p>";
    currentTaskActions.classList.add("hidden");
    return;
  }

  currentTaskCard.className = "current-card";
  currentTaskActions.classList.remove("hidden");

  const startedLabel = activeTask.startedAt
    ? formatDateTime(activeTask.startedAt)
    : "just now";

  currentTaskCard.innerHTML = `
    <h3 class="current-title" style="padding-right:48px">${escapeHtml(activeTask.title)}</h3>
    ${activeTask.notes ? `<p class="current-notes" style="padding-right:48px">${escapeHtml(activeTask.notes)}</p>` : ""}
    <p class="current-meta">Next reminder in ${escapeHtml(formatDuration(getRemainingReminderMs(activeTask)))} &middot; Started ${escapeHtml(startedLabel)}</p>
    <button class="current-done-hover" id="currentDoneHover" type="button" title="Mark done" aria-label="Mark done">✓</button>
  `;

  document.querySelector("#currentDoneHover").addEventListener("click", () => {
    markTaskDone(activeTask.id);
  });
}

function renderTaskList() {
  taskList.innerHTML = "";
  const pendingTasks = getPendingTasks();

  if (pendingTasks.length === 0) {
    taskList.innerHTML = '<p class="task-notes">No queued tasks. Add one when you need it.</p>';
    return;
  }

  for (const task of pendingTasks) {
    const fragment = taskItemTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".task-row");
    const title = fragment.querySelector(".task-title");
    const notes = fragment.querySelector(".task-notes");
    const startButton = fragment.querySelector(".start-button");
    const editButton = fragment.querySelector(".edit-button");
    const doneButton = fragment.querySelector(".done-button");
    const deleteButton = fragment.querySelector(".delete-button");

    title.textContent = task.title;
    notes.textContent = task.notes || "";
    card.dataset.taskId = task.id;
    card.draggable = true;

    if (getActiveTask()) {
      startButton.disabled = true;
      startButton.title = "Finish or complete the current task first.";
    }

    for (const [button, action] of [
      [startButton, "start"],
      [editButton, "edit"],
      [doneButton, "done"],
      [deleteButton, "delete"],
    ]) {
      button.dataset.action = action;
      button.dataset.taskId = task.id;
    }

    taskList.append(fragment);
  }
}

function renderHistory() {
  historyList.innerHTML = "";
  const completedTasks = tasks
    .filter((task) => task.status === "done")
    .sort((left, right) => (right.completedAt || 0) - (left.completedAt || 0));

  historyCount.textContent = String(completedTasks.length);

  if (completedTasks.length === 0) {
    historyList.innerHTML = '<p class="task-notes">Completed tasks will appear here.</p>';
    return;
  }

  const groups = new Map();
  for (const task of completedTasks) {
    const label = getDateLabel(task.completedAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(task);
  }

  for (const [dateLabel, groupTasks] of groups) {
    const isCollapsed = collapsedDates.has(dateLabel);

    const groupEl = document.createElement("div");
    groupEl.className = "history-group";

    const header = document.createElement("div");
    header.className = "history-group-header";

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "history-collapse-btn";
    collapseBtn.setAttribute("aria-expanded", String(!isCollapsed));
    collapseBtn.innerHTML = `<span class="history-chevron">${isCollapsed ? "\u25B6" : "\u25BC"}</span><span class="history-date-label">${escapeHtml(dateLabel)}</span><span class="badge">${groupTasks.length}</span>`;

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "history-clear-btn";
    clearBtn.textContent = "Clear";

    collapseBtn.addEventListener("click", () => {
      if (collapsedDates.has(dateLabel)) {
        collapsedDates.delete(dateLabel);
      } else {
        collapsedDates.add(dateLabel);
      }
      renderHistory();
    });

    clearBtn.addEventListener("click", () => {
      if (!window.confirm(`Remove all completed tasks from ${dateLabel}?`)) return;
      tasks = tasks.filter((task) => task.status !== "done" || getDateLabel(task.completedAt) !== dateLabel);
      persistAndRender();
    });

    header.append(collapseBtn, clearBtn);

    const body = document.createElement("div");
    body.className = "history-group-body" + (isCollapsed ? " hidden" : "");

    for (const task of groupTasks) {
      const fragment = historyItemTemplate.content.cloneNode(true);
      fragment.querySelector(".history-title").textContent = task.title;
      fragment.querySelector(".history-notes").textContent = task.notes || "No notes";
      fragment.querySelector(".history-meta").textContent =
        `Started: ${formatDateTime(task.startedAt)}  |  Finished: ${formatDateTime(task.completedAt)}`;
      body.append(fragment);
    }

    groupEl.append(header, body);
    historyList.append(groupEl);
  }
}

function updateTaskCount() {
  taskCount.textContent = String(getPendingTasks().length);
}

function updateSettingsStatus() {
  const scheduleStr = settings.reminderSchedule.join(", ");
  settingsStatus.textContent = `Schedule: ${scheduleStr} min · Sound: ${settings.notificationSound}`;
}

function startTask(taskId) {
  const currentTask = getActiveTask();

  if (currentTask && currentTask.id !== taskId) {
    showToast("Finish the current task before starting another one.", "error");
    return;
  }

  tasks = tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    const startIdx = task.initialScheduleIndex ?? 0;
    return {
      ...task,
      status: "active",
      startedAt: Date.now(),
      reminderScheduleIndex: startIdx,
      nextReminderAt: Date.now() + settings.reminderSchedule[startIdx] * 60 * 1000,
    };
  });

  persistAndRender();
}

function markTaskDone(taskId) {
  tasks = tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return {
      ...task,
      status: "done",
      completedAt: Date.now(),
      nextReminderAt: null,
    };
  });

  persistAndRender();
}

function moveActiveTaskToQueue() {
  const activeTask = getActiveTask();

  if (!activeTask) {
    return;
  }

  const updatedActiveTask = {
    ...activeTask,
    status: "pending",
    nextReminderAt: null,
  };

  tasks = [
    updatedActiveTask,
    ...tasks.filter((task) => task.id !== activeTask.id),
  ];

  persistAndRender();
}

function removeTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  const confirmed = window.confirm(`Remove "${task.title}"?`);
  if (!confirmed) {
    return;
  }

  tasks = tasks.filter((item) => item.id !== taskId);
  persistAndRender();
}

function editTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  const nextTitle = window.prompt("Edit task title", task.title);
  if (nextTitle === null) {
    return;
  }

  const trimmedTitle = nextTitle.trim();
  if (!trimmedTitle) {
    showToast("Task title cannot be empty.", "error");
    return;
  }

  const nextNotes = window.prompt("Edit notes", task.notes || "");
  if (nextNotes === null) {
    return;
  }

  tasks = tasks.map((item) => {
    if (item.id !== taskId) {
      return item;
    }

    return {
      ...item,
      title: trimmedTitle,
      notes: nextNotes.trim(),
    };
  });

  persistAndRender();
}

function getActiveTask() {
  return tasks.find((task) => task.status === "active") || null;
}

function getPendingTasks() {
  return tasks.filter((task) => task.status === "pending");
}

function startReminderLoop() {
  if (reminderTimerId) {
    window.clearInterval(reminderTimerId);
  }

  reminderTimerId = window.setInterval(checkReminderDue, 1000);

  if (reminderTickId) {
    window.clearInterval(reminderTickId);
  }

  reminderTickId = window.setInterval(() => {
    renderCurrentTask();
    updateActiveCountdownDisplays();
  }, 1000);
}

function checkReminderDue() {
  const activeTask = getActiveTask();

  if (!activeTask) {
    return;
  }

  if (getRemainingReminderMs(activeTask) > 0) {
    return;
  }

  fireReminder();
}

function fireReminder() {
  const activeTask = getActiveTask();

  if (!activeTask) {
    return;
  }

  const message = `Current task still in progress: ${activeTask.title}`;

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("GTD Focus Reminder", { body: message });
  }

  playNotificationSound();

  tasks = tasks.map((task) => {
    if (task.id !== activeTask.id) {
      return task;
    }
    const nextIndex = ((task.reminderScheduleIndex ?? 0) + 1) % settings.reminderSchedule.length;
    return {
      ...task,
      reminderScheduleIndex: nextIndex,
      nextReminderAt: Date.now() + settings.reminderSchedule[nextIndex] * 60 * 1000,
    };
  });

  persistAndRender();

  showToast(`⏰ Still in progress: ${activeTask.title}`, "reminder");
}

function syncNotificationButton() {
  if (!("Notification" in window)) {
    notificationButton.textContent = "Browser notifications unavailable";
    notificationButton.disabled = true;
    return;
  }

  if (Notification.permission === "granted") {
    notificationButton.textContent = "Notifications enabled";
    notificationButton.disabled = true;
    return;
  }

  notificationButton.textContent = "Enable reminders";
  notificationButton.disabled = false;
}

function getDateLabel(timestamp) {
  if (!timestamp) return "Unknown date";
  return new Date(timestamp).toLocaleDateString([], {
    year: "numeric", month: "short", day: "numeric",
  });
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return "Not recorded";
  }

  return new Date(timestamp).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRemainingReminderMs(task) {
  if (!task.nextReminderAt) {
    return settings.reminderSchedule[0] * 60 * 1000;
  }

  return Math.max(0, task.nextReminderAt - Date.now());
}

function formatDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateActiveCountdownDisplays() {
  const activeTask = getActiveTask();

  document.querySelectorAll("[data-countdown-for]").forEach((element) => {
    if (!activeTask || element.dataset.countdownFor !== activeTask.id) {
      return;
    }

    element.textContent = `Next reminder in ${formatDuration(getRemainingReminderMs(activeTask))}.`;
  });
}

function movePendingTask(sourceTaskId, targetTaskId) {
  const sourceTask = tasks.find((task) => task.id === sourceTaskId);
  const targetTask = tasks.find((task) => task.id === targetTaskId);

  if (!sourceTask || !targetTask || sourceTask.status !== "pending" || targetTask.status !== "pending") {
    draggedTaskId = null;
    clearDropTargets();
    clearDraggingState();
    return;
  }

  const activeTask = getActiveTask();
  const pendingTasks = getPendingTasks();
  const doneTasks = tasks.filter((task) => task.status === "done");
  const sourceIndex = pendingTasks.findIndex((task) => task.id === sourceTaskId);
  const targetIndex = pendingTasks.findIndex((task) => task.id === targetTaskId);

  if (sourceIndex === -1 || targetIndex === -1) {
    draggedTaskId = null;
    clearDropTargets();
    clearDraggingState();
    return;
  }

  const [movedTask] = pendingTasks.splice(sourceIndex, 1);
  pendingTasks.splice(targetIndex, 0, movedTask);
  tasks = [
    ...(activeTask ? [activeTask] : []),
    ...pendingTasks,
    ...doneTasks,
  ];

  draggedTaskId = null;
  clearDropTargets();
  clearDraggingState();
  persistAndRender();
}

function clearDropTargets() {
  document.querySelectorAll(".task-row.drop-target").forEach((card) => {
    card.classList.remove("drop-target");
  });
}

function clearDraggingState() {
  document.querySelectorAll(".task-row.dragging").forEach((card) => {
    card.classList.remove("dragging");
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showToast(message, type = "default") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("toast-visible"));
  });

  const duration = type === "reminder" ? 7000 : 4500;
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, duration);
}

function syncReminderSelect() {
  taskReminderSelect.innerHTML = "";
  settings.reminderSchedule.forEach((minutes, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${minutes} min`;
    taskReminderSelect.appendChild(option);
  });
  const restoredIndex = lastReminderSelectIndex < settings.reminderSchedule.length
    ? lastReminderSelectIndex
    : 0;
  taskReminderSelect.value = String(restoredIndex);
  lastReminderSelectIndex = restoredIndex;
}

function syncSettingsPanel() {
  reminderScheduleInput.value = settings.reminderSchedule.join(", ");
  notificationSoundSelect.value = settings.notificationSound;
}

function playNotificationSound() {
  if (settings.notificationSound === "none") {
    return;
  }
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const ctx = new AudioContextClass();
    if (settings.notificationSound === "beep") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (settings.notificationSound === "chime") {
      [880, 660, 440].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    } else if (settings.notificationSound === "bell") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 523.25;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.5);
    }
  } catch {
    // Audio not available; fail silently
  }
}
