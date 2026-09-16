const STORAGE_KEY = 'todo-app-tasks-v1';

const state = {
  tasks: [],
  filter: 'all',
};

const elements = {
  form: document.getElementById('task-form'),
  input: document.getElementById('task-input'),
  taskList: document.getElementById('task-list'),
  filterButtons: document.querySelectorAll('.filter-btn'),
  clearCompleted: document.getElementById('clear-completed'),
  emptyState: document.getElementById('empty-state'),
  validationMessage: document.getElementById('validation-message'),
};

function createTask(text) {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

function showStorageError() {
  showValidation('Tasks could not be saved because local storage is unavailable.');
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    return true;
  } catch {
    showStorageError();
    return false;
  }
}

function sanitizeTask(task) {
  if (!task || typeof task !== 'object') return null;
  if (typeof task.id !== 'string' || typeof task.text !== 'string' || typeof task.completed !== 'boolean') {
    return null;
  }

  const normalizedText = task.text.trim();
  if (!normalizedText) return null;

  const createdAt = typeof task.createdAt === 'string' ? task.createdAt : new Date().toISOString();

  return {
    id: task.id,
    text: normalizedText,
    completed: task.completed,
    createdAt,
  };
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeTask).filter(Boolean);
  } catch {
    showStorageError();
    return [];
  }
}

function filteredTasks() {
  if (state.filter === 'active') return state.tasks.filter((task) => !task.completed);
  if (state.filter === 'completed') return state.tasks.filter((task) => task.completed);
  return state.tasks;
}

function formatCreatedAt(createdAt) {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function renderEmptyState(visibleTasks) {
  if (visibleTasks.length > 0) {
    elements.emptyState.textContent = '';
    return;
  }

  if (state.tasks.length === 0) {
    elements.emptyState.textContent = 'No tasks yet. Add one to get started!';
    return;
  }

  if (state.filter === 'active') {
    elements.emptyState.textContent = 'No active tasks. Nice work!';
  } else if (state.filter === 'completed') {
    elements.emptyState.textContent = 'No completed tasks yet.';
  } else {
    elements.emptyState.textContent = 'No tasks available.';
  }
}

function renderTasks() {
  const visibleTasks = filteredTasks();
  elements.taskList.innerHTML = '';

  visibleTasks.forEach((task) => {
    const item = document.createElement('li');
    item.className = 'task-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `Task: ${task.text}`);
    checkbox.addEventListener('change', () => toggleTask(task.id));

    const textWrap = document.createElement('div');
    textWrap.className = 'task-text';

    const text = document.createElement('div');
    text.textContent = task.text;
    if (task.completed) text.classList.add('completed');

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = formatCreatedAt(task.createdAt);

    textWrap.append(text, meta);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', `Delete ${task.text}`);
    deleteButton.addEventListener('click', () => deleteTask(task.id));

    item.append(checkbox, textWrap, deleteButton);
    elements.taskList.appendChild(item);
  });

  elements.filterButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === state.filter);
  });

  renderEmptyState(visibleTasks);
}

function clearValidation() {
  elements.validationMessage.textContent = '';
}

function showValidation(message) {
  elements.validationMessage.textContent = message;
}

function addTask(event) {
  event.preventDefault();
  const text = elements.input.value.trim();

  if (!text) {
    showValidation('Please enter a task before adding.');
    return;
  }

  state.tasks.unshift(createTask(text));
  const wasSaved = saveTasks();
  renderTasks();
  if (wasSaved) clearValidation();
  elements.form.reset();
  elements.input.focus();
}

function toggleTask(id) {
  state.tasks = state.tasks.map((task) =>
    task.id === id ? { ...task, completed: !task.completed } : task
  );
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  saveTasks();
  renderTasks();
}

function setFilter(filter) {
  state.filter = filter;
  renderTasks();
}

function clearCompletedTasks() {
  const hasCompleted = state.tasks.some((task) => task.completed);
  if (!hasCompleted) return;
  state.tasks = state.tasks.filter((task) => !task.completed);
  saveTasks();
  renderTasks();
}

function bindEvents() {
  elements.form.addEventListener('submit', addTask);
  elements.filterButtons.forEach((button) => {
    button.addEventListener('click', () => setFilter(button.dataset.filter));
  });
  elements.clearCompleted.addEventListener('click', clearCompletedTasks);
}

function init() {
  state.tasks = loadTasks();
  bindEvents();
  renderTasks();
}

init();
