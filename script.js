/**
 * ============================================================
 * TaskFlow – script.js
 * Professional To-Do Application – Main JavaScript Logic
 *
 * Sections:
 *   1. State & Constants
 *   2. Utility Helpers
 *   3. LocalStorage (Persistence)
 *   4. UI – Stats & Counters
 *   5. UI – Render Task Item
 *   6. UI – Render All Tasks
 *   7. UI – Hero / DateTime
 *   8. UI – Empty States
 *   9. Task CRUD Operations
 *  10. Search & Filter
 *  11. Edit Modal
 *  12. Toast Notifications
 *  13. Theme Toggle
 *  14. Event Listeners
 *  15. Init
 * ============================================================
 */

'use strict';

/* ============================================================
   1. STATE & CONSTANTS
   ============================================================ */

/** @type {Task[]} In-memory task array (synced with localStorage) */
let tasks = [];

/** Currently active filter: 'all' | 'pending' | 'completed' */
let activeFilter = 'all';

/** Currently selected priority for the new-task form */
let selectedPriority = 'low';

/** ID of the task currently being edited */
let editingTaskId = null;

/** The storage key used for localStorage persistence */
const STORAGE_KEY = 'taskflow_tasks_v2';

/** Theme storage key */
const THEME_KEY = 'taskflow_theme';

/**
 * @typedef {Object} Task
 * @property {string}  id          – Unique identifier (UUID)
 * @property {string}  text        – Task description
 * @property {boolean} completed   – Whether the task is done
 * @property {'low'|'medium'|'high'} priority – Priority level
 * @property {string}  createdAt   – ISO string: when task was added
 * @property {string|null} completedAt – ISO string: when task was completed
 */

/* ============================================================
   2. UTILITY HELPERS
   ============================================================ */

/**
 * Generate a pseudo-UUID (sufficient for client-side IDs).
 * @returns {string}
 */
function generateId() {
  return 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

/**
 * Format an ISO date string to a readable format.
 * @param {string} isoString
 * @returns {string}
 */
function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month:  'short',
    day:    'numeric',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Escape HTML to prevent XSS when setting innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Get the current theme ('dark' | 'light').
 * @returns {string}
 */
function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

/* ============================================================
   3. LOCALSTORAGE (PERSISTENCE)
   ============================================================ */

/**
 * Load tasks from localStorage into the in-memory `tasks` array.
 */
function loadTasksFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('TaskFlow: Could not parse stored tasks.', err);
    tasks = [];
  }
}

/**
 * Save the current in-memory `tasks` array to localStorage.
 */
function saveTasksToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('TaskFlow: Failed to save tasks.', err);
  }
}

/**
 * Load and apply saved theme preference.
 */
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
}

/**
 * Apply a theme to the document.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  if (icon) {
    // In light mode → show moon icon (click to go dark)
    // In dark mode  → show sun icon  (click to go light)
    icon.className = theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }
  localStorage.setItem(THEME_KEY, theme);
}

/* ============================================================
   4. UI – STATS & COUNTERS
   ============================================================ */

/**
 * Recalculate and update all stat counters in the stats bar.
 */
function updateStats() {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending   = total - completed;
  const pct       = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Update DOM
  document.getElementById('totalCount').textContent     = total;
  document.getElementById('pendingCount').textContent   = pending;
  document.getElementById('completedCount').textContent = completed;
  document.getElementById('progressPct').textContent    = pct + '%';

  // Update section badges
  document.getElementById('pendingBadge').textContent   = pending;
  document.getElementById('completedBadge').textContent = completed;
}

/* ============================================================
   5. UI – RENDER TASK ITEM
   ============================================================ */

/**
 * Build and return an <li> DOM element for a given task.
 * @param {Task} task
 * @returns {HTMLLIElement}
 */
function createTaskElement(task) {
  const li = document.createElement('li');
  li.className   = 'task-item' + (task.completed ? ' completed' : '');
  li.dataset.id  = task.id;
  li.dataset.priority = task.priority;
  li.setAttribute('role', 'listitem');

  // Timestamps HTML
  const addedHtml = `
    <span class="task-timestamp" title="Added on ${formatDateTime(task.createdAt)}">
      <i class="fa-regular fa-calendar"></i> Added: ${formatDateTime(task.createdAt)}
    </span>`;

  const completedHtml = task.completed && task.completedAt ? `
    <span class="task-timestamp" title="Completed on ${formatDateTime(task.completedAt)}">
      <i class="fa-solid fa-check"></i> Done: ${formatDateTime(task.completedAt)}
    </span>` : '';

  li.innerHTML = `
    <!-- Checkbox -->
    <button
      class="task-checkbox"
      data-action="toggle"
      aria-label="${task.completed ? 'Mark as pending' : 'Mark as completed'}"
      title="${task.completed ? 'Mark as pending' : 'Mark as completed'}"
    >
      ${task.completed ? '<i class="fa-solid fa-check"></i>' : ''}
    </button>

    <!-- Body -->
    <div class="task-body">
      <p class="task-text">${escapeHtml(task.text)}</p>
      <div class="task-meta">
        <span class="task-priority-tag ${task.priority}">${task.priority}</span>
        ${addedHtml}
        ${completedHtml}
      </div>
    </div>

    <!-- Action buttons -->
    <div class="task-actions" role="group" aria-label="Task actions">
      ${!task.completed ? `
      <button class="task-action-btn edit-btn" data-action="edit" title="Edit task" aria-label="Edit task">
        <i class="fa-solid fa-pen"></i>
      </button>` : ''}
      <button class="task-action-btn delete-btn" data-action="delete" title="Delete task" aria-label="Delete task">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `;

  return li;
}

/* ============================================================
   6. UI – RENDER ALL TASKS
   ============================================================ */

/**
 * Filter and render all tasks into their respective lists.
 * Respects the current `activeFilter` and search query.
 */
function renderTasks() {
  const searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();

  // Filter tasks
  let filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchQuery || task.text.toLowerCase().includes(searchQuery);
    const matchesFilter =
      activeFilter === 'all'       ||
      (activeFilter === 'pending'   && !task.completed) ||
      (activeFilter === 'completed' && task.completed);
    return matchesSearch && matchesFilter;
  });

  // Separate pending and completed
  const pendingTasks   = filteredTasks.filter(t => !t.completed);
  const completedTasks = filteredTasks.filter(t =>  t.completed);

  // Render pending list
  const pendingList = document.getElementById('pendingList');
  pendingList.innerHTML = '';
  pendingTasks.forEach(task => pendingList.appendChild(createTaskElement(task)));

  // Render completed list
  const completedList = document.getElementById('completedList');
  completedList.innerHTML = '';
  completedTasks.forEach(task => completedList.appendChild(createTaskElement(task)));

  // Update stats
  updateStats();

  // Toggle empty states
  toggleEmptyStates(pendingTasks.length, completedTasks.length);

  // Show/hide sections based on filter
  const pendingSection   = document.getElementById('pendingSection');
  const completedSection = document.getElementById('completedSection');

  pendingSection.style.display   = (activeFilter === 'completed') ? 'none' : '';
  completedSection.style.display = (activeFilter === 'pending')   ? 'none' : '';
}

/* ============================================================
   7. UI – HERO / DATETIME
   ============================================================ */

/**
 * Set the hero section greeting and date string.
 */
function updateHeroDateTime() {
  const now     = new Date();
  const hours   = now.getHours();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  let greeting = 'Good morning! ☀️';
  if (hours >= 12 && hours < 17) greeting = 'Good afternoon! 🌤️';
  else if (hours >= 17 && hours < 21) greeting = 'Good evening! 🌆';
  else if (hours >= 21 || hours < 5)  greeting = 'Good night! 🌙';

  document.getElementById('heroGreeting').textContent = greeting;
  document.getElementById('heroDate').textContent     = dateStr;
}

/* ============================================================
   8. UI – EMPTY STATES
   ============================================================ */

/**
 * Show or hide the empty-state messages for each section.
 * @param {number} pendingCount
 * @param {number} completedCount
 */
function toggleEmptyStates(pendingCount, completedCount) {
  const pendingEmpty   = document.getElementById('pendingEmpty');
  const completedEmpty = document.getElementById('completedEmpty');

  pendingEmpty.style.display   = pendingCount === 0   ? 'block' : 'none';
  completedEmpty.style.display = completedCount === 0 ? 'block' : 'none';
}

/* ============================================================
   9. TASK CRUD OPERATIONS
   ============================================================ */

/**
 * Add a new task from the input field.
 */
function addTask() {
  const input = document.getElementById('taskInput');
  const text  = input.value.trim();

  // Validate
  if (!text) {
    showToast('Please enter a task first!', 'error');
    input.focus();
    shakeElement(input.parentElement);
    return;
  }

  // Create task object
  const newTask = {
    id:          generateId(),
    text:        text,
    completed:   false,
    priority:    selectedPriority,
    createdAt:   new Date().toISOString(),
    completedAt: null,
  };

  // Prepend to array (newest first)
  tasks.unshift(newTask);
  saveTasksToStorage();
  renderTasks();

  // Reset input
  input.value = '';
  updateCharCounter(input);
  input.focus();

  showToast('Task added successfully! ✨', 'success');
}

/**
 * Toggle completed status of a task.
 * @param {string} taskId
 */
function toggleTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  saveTasksToStorage();
  renderTasks();

  showToast(
    task.completed ? 'Great work! Task completed. 🎉' : 'Task moved back to pending.',
    task.completed ? 'success' : 'info'
  );
}

/**
 * Delete a task by ID.
 * @param {string} taskId
 */
function deleteTask(taskId) {
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;

  tasks.splice(idx, 1);
  saveTasksToStorage();
  renderTasks();
  showToast('Task deleted.', 'warning');
}

/**
 * Remove all completed tasks.
 */
function clearCompletedTasks() {
  const completedCount = tasks.filter(t => t.completed).length;
  if (completedCount === 0) {
    showToast('No completed tasks to clear!', 'info');
    return;
  }

  tasks = tasks.filter(t => !t.completed);
  saveTasksToStorage();
  renderTasks();
  showToast(`Cleared ${completedCount} completed task${completedCount > 1 ? 's' : ''}.`, 'info');
}

/* ============================================================
   10. SEARCH & FILTER
   ============================================================ */

/**
 * Handle search input changes.
 */
function handleSearch() {
  const searchInput    = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  clearSearchBtn.style.display = searchInput.value ? 'flex' : 'none';
  renderTasks();
}

/**
 * Clear the search field.
 */
function clearSearch() {
  const searchInput    = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  searchInput.value    = '';
  clearSearchBtn.style.display = 'none';
  renderTasks();
  searchInput.focus();
}

/**
 * Set the active filter and re-render tasks.
 * @param {'all'|'pending'|'completed'} filter
 */
function setFilter(filter) {
  activeFilter = filter;

  // Update tab UI
  document.querySelectorAll('.filter-tab').forEach(btn => {
    const isActive = btn.dataset.filter === filter;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });

  renderTasks();
}

/* ============================================================
   11. EDIT MODAL
   ============================================================ */

/**
 * Open the edit modal for a specific task.
 * @param {string} taskId
 */
function openEditModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  editingTaskId = taskId;

  const textarea = document.getElementById('editTaskInput');
  textarea.value = task.text;

  // Set priority buttons in modal
  document.querySelectorAll('.modal-priority .priority-btn').forEach(btn => {
    const isActive = btn.dataset.priority === task.priority;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
  });

  // Show modal using .open class
  document.getElementById('editModalOverlay').classList.add('open');

  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

/**
 * Close the edit modal without saving.
 */
function closeEditModal() {
  document.getElementById('editModalOverlay').classList.remove('open');
  editingTaskId = null;
}

/**
 * Save changes from the edit modal.
 */
function saveEdit() {
  if (!editingTaskId) return;

  const textarea = document.getElementById('editTaskInput');
  const newText  = textarea.value.trim();

  if (!newText) {
    showToast('Task text cannot be empty!', 'error');
    shakeElement(textarea);
    return;
  }

  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) return;

  // Find selected priority in modal
  const activePriorityBtn = document.querySelector('.modal-priority .priority-btn.active');
  task.priority = activePriorityBtn ? activePriorityBtn.dataset.priority : task.priority;
  task.text     = newText;

  saveTasksToStorage();
  renderTasks();
  closeEditModal();
  showToast('Task updated! ✅', 'success');
}

/* ============================================================
   12. TOAST NOTIFICATIONS
   ============================================================ */

/**
 * Display a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration  – ms before auto-dismiss
 */
function showToast(message, type = 'info', duration = 3000) {
  const icons = {
    success: 'fa-solid fa-circle-check',
    error:   'fa-solid fa-circle-xmark',
    info:    'fa-solid fa-circle-info',
    warning: 'fa-solid fa-triangle-exclamation',
  };

  const container = document.getElementById('toastContainer');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <i class="toast-icon ${icons[type] || icons.info}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* ============================================================
   13. THEME TOGGLE
   ============================================================ */

/**
 * Toggle between dark and light themes.
 */
function toggleTheme() {
  const current = getCurrentTheme();
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  showToast(`Switched to ${next} mode.`, 'info', 1500);
}

/* ============================================================
   14. MISC UI HELPERS
   ============================================================ */

/**
 * Update the character counter display for the task input.
 * @param {HTMLInputElement} inputEl
 */
function updateCharCounter(inputEl) {
  const counter = document.getElementById('charCounter');
  const len     = inputEl.value.length;
  const max     = parseInt(inputEl.getAttribute('maxlength'), 10);
  counter.textContent = `${len}/${max}`;
  counter.classList.toggle('warn',  len >= max * 0.8);
  counter.classList.toggle('limit', len >= max);
}

/**
 * Apply a brief shake animation to an element (on validation error).
 * @param {HTMLElement} el
 */
function shakeElement(el) {
  el.style.animation = 'none';
  el.style.transform = 'translateX(0)';
  // Trigger reflow
  void el.offsetHeight;
  el.style.transition = 'transform 0.1s ease';

  const shakes = [8, -8, 6, -6, 4, -4, 2, -2, 0];
  let i = 0;

  function step() {
    if (i < shakes.length) {
      el.style.transform = `translateX(${shakes[i]}px)`;
      i++;
      setTimeout(step, 50);
    } else {
      el.style.transform = '';
      el.style.transition = '';
    }
  }
  step();
}

/**
 * Handle priority button selection in a given group.
 * @param {HTMLButtonElement} clickedBtn
 * @param {boolean} isModal – true if inside the edit modal
 */
function selectPriority(clickedBtn, isModal = false) {
  const group = isModal
    ? document.querySelectorAll('.modal-priority .priority-btn')
    : document.querySelectorAll('.input-meta .priority-btn');

  group.forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
  });

  clickedBtn.classList.add('active');
  clickedBtn.setAttribute('aria-pressed', 'true');

  if (!isModal) {
    selectedPriority = clickedBtn.dataset.priority;
  }
}

/* ============================================================
   15. EVENT LISTENERS
   ============================================================ */

/**
 * Attach all DOM event listeners.
 * Called once after DOMContentLoaded.
 */
function attachEventListeners() {

  /* ---- Add Task ---- */

  // Add button click
  document.getElementById('addTaskBtn').addEventListener('click', addTask);

  // Enter key in task input
  document.getElementById('taskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Character counter
  document.getElementById('taskInput').addEventListener('input', function () {
    updateCharCounter(this);
  });

  /* ---- Priority buttons (input form) ---- */
  document.querySelectorAll('.input-meta .priority-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPriority(btn, false));
  });

  /* ---- Task list delegation (toggle / edit / delete) ---- */
  document.getElementById('pendingList').addEventListener('click', handleTaskListClick);
  document.getElementById('completedList').addEventListener('click', handleTaskListClick);

  /* ---- Filter tabs ---- */
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => setFilter(tab.dataset.filter));
  });

  /* ---- Search ---- */
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);

  /* ---- Clear completed ---- */
  document.getElementById('clearCompletedBtn').addEventListener('click', clearCompletedTasks);

  /* ---- Theme toggle ---- */
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

  /* ---- Edit Modal ---- */
  document.getElementById('closeModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
  document.getElementById('saveEditBtn').addEventListener('click', saveEdit);

  // Save on Ctrl+Enter inside modal textarea
  document.getElementById('editTaskInput').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') closeEditModal();
  });

  // Close modal when clicking outside the card
  document.getElementById('editModalOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeEditModal();
  });

  // Priority buttons inside edit modal
  document.querySelectorAll('.modal-priority .priority-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPriority(btn, true));
  });

  /* ---- Global keyboard shortcut: Esc closes modal ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEditModal();
  });
}

/**
 * Delegated click handler for task list items.
 * Handles toggle, edit, and delete actions.
 * @param {MouseEvent} e
 */
function handleTaskListClick(e) {
  // Walk up from the clicked element to find a button with data-action
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const taskItem = btn.closest('.task-item');
  if (!taskItem) return;

  const taskId = taskItem.dataset.id;
  const action = btn.dataset.action;

  switch (action) {
    case 'toggle': toggleTask(taskId);         break;
    case 'edit':   openEditModal(taskId);      break;
    case 'delete': deleteTask(taskId);         break;
    default: break;
  }
}

/* ============================================================
   16. INIT
   ============================================================ */

/**
 * Initialize the application.
 * Runs after the DOM is fully loaded.
 */
function init() {
  // Load persisted theme
  loadTheme();

  // Load tasks from localStorage
  loadTasksFromStorage();

  // Attach all event listeners
  attachEventListeners();

  // Render initial task list
  renderTasks();

  // Set hero date/greeting
  updateHeroDateTime();

  // Keep hero date up-to-date (updates every minute)
  setInterval(updateHeroDateTime, 60_000);

  console.log('%cTaskFlow initialized! 🚀', 'color:#7c3aed;font-weight:bold;font-size:14px');
}

// Start the app when the DOM is ready
document.addEventListener('DOMContentLoaded', init);
