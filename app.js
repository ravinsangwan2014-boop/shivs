(function (global) {
  const STORAGE_KEY = 'todo-app-tasks-v1';
  const MAX_TASK_LENGTH = 200;
  const FILTERS = new Set(['all', 'active', 'completed']);
  let fallbackTaskId = 0;

  function createMemoryStorage(seed = {}) {
    const store = { ...seed };

    return {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem(key, value) {
        store[key] = String(value);
      },
      removeItem(key) {
        delete store[key];
      },
    };
  }

  function resolveStorage(providedStorage, storageOptions = {}) {
    if (providedStorage) {
      if (
        typeof storageOptions.persistent === 'boolean' ||
        typeof storageOptions.available === 'boolean'
      ) {
        return {
          storage: providedStorage,
          persistent:
            typeof storageOptions.persistent === 'boolean'
              ? storageOptions.persistent
              : Boolean(storageOptions.available),
          available:
            typeof storageOptions.available === 'boolean'
              ? storageOptions.available
              : Boolean(storageOptions.persistent),
        };
      }

      try {
        const probeKey = `${STORAGE_KEY}-probe`;
        providedStorage.setItem(probeKey, '1');
        providedStorage.removeItem(probeKey);
        return { storage: providedStorage, persistent: true, available: true };
      } catch {
        return { storage: providedStorage, persistent: false, available: false };
      }
    }

    try {
      if (!global.localStorage) throw new Error('localStorage unavailable');
      const probeKey = `${STORAGE_KEY}-probe`;
      global.localStorage.setItem(probeKey, '1');
      global.localStorage.removeItem(probeKey);
      return { storage: global.localStorage, persistent: true, available: true };
    } catch {
      return { storage: createMemoryStorage(), persistent: false, available: false };
    }
  }

  function normalizeTaskText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, MAX_TASK_LENGTH);
  }

  function createTask(text) {
    const normalizedText = normalizeTaskText(text);

    return {
      id:
        typeof global.crypto !== 'undefined' && typeof global.crypto.randomUUID === 'function'
          ? global.crypto.randomUUID()
          : `task-${Date.now()}-${fallbackTaskId++}`,
      text: normalizedText,
      completed: false,
      createdAt: new Date().toISOString(),
    };
  }

  function sanitizeTask(task) {
    if (!task || typeof task !== 'object') return null;
    if (typeof task.id !== 'string' || typeof task.completed !== 'boolean') return null;

    const normalizedText = normalizeTaskText(task.text);
    if (!normalizedText) return null;

    const createdAt =
      typeof task.createdAt === 'string' && !Number.isNaN(new Date(task.createdAt).getTime())
        ? task.createdAt
        : '';

    return {
      id: task.id,
      text: normalizedText,
      completed: task.completed,
      createdAt,
    };
  }

  function createApp(options = {}) {
    const documentRef = options.document || global.document || null;
    const storageRef = resolveStorage(options.storage, {
      persistent: options.storagePersistent,
      available: options.storageAvailable,
    });
    const state = {
      tasks: [],
      filter: 'all',
    };

    let elements = readElements();

    function readElements() {
      if (!documentRef) {
        return {
          filterButtons: [],
        };
      }

      return {
        form: documentRef.getElementById('task-form'),
        input: documentRef.getElementById('task-input'),
        taskList: documentRef.getElementById('task-list'),
        filterButtons: Array.from(documentRef.querySelectorAll('.filter-btn')),
        clearCompleted: documentRef.getElementById('clear-completed'),
        emptyState: documentRef.getElementById('empty-state'),
        validationMessage: documentRef.getElementById('validation-message'),
        statusMessage: documentRef.getElementById('status-message'),
      };
    }

    function hasRequiredElements() {
      return Boolean(
        documentRef &&
          elements.form &&
          elements.input &&
          elements.taskList &&
          elements.clearCompleted &&
          elements.emptyState &&
          elements.validationMessage &&
          elements.statusMessage &&
          elements.filterButtons.length
      );
    }

    function announceStatus(message) {
      if (!elements.statusMessage) return;
      elements.statusMessage.textContent = '';
      elements.statusMessage.textContent = message;
    }

    function showValidation(message) {
      if (elements.validationMessage) {
        elements.validationMessage.textContent = message;
      }

      if (elements.input) {
        elements.input.setAttribute('aria-invalid', message ? 'true' : 'false');
      }
    }

    function clearValidation() {
      showValidation('');
    }

    function showStorageFallbackMessage() {
      showValidation('Browser storage is unavailable. Tasks will work for this session only.');
      announceStatus('Browser storage is unavailable. Tasks will not persist after refresh.');
    }

    function showStorageError() {
      showValidation('Tasks could not be saved. Your last change was not applied.');
      announceStatus('Task changes were not saved.');
    }

    function saveTasks() {
      try {
        storageRef.storage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
        return true;
      } catch {
        showStorageError();
        return false;
      }
    }

    function loadTasks() {
      try {
        const raw = storageRef.storage.getItem(STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          showValidation('Saved tasks were reset because stored data was invalid.');
          return [];
        }

        const sanitizedTasks = parsed.map(sanitizeTask).filter(Boolean);
        if (sanitizedTasks.length !== parsed.length) {
          showValidation('Some saved tasks were skipped because stored data was invalid.');
        }

        return sanitizedTasks;
      } catch {
        showValidation('Saved tasks were reset because stored data could not be read.');
        return [];
      }
    }

    function filteredTasks() {
      if (state.filter === 'active') return state.tasks.filter((task) => !task.completed);
      if (state.filter === 'completed') return state.tasks.filter((task) => task.completed);
      return state.tasks;
    }

    function formatCreatedAt(createdAt) {
      if (!createdAt) return '';
      const date = new Date(createdAt);
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
    }

    function clearChildren(element) {
      if (!element) return;

      if (typeof element.replaceChildren === 'function') {
        element.replaceChildren();
        return;
      }

      if (Array.isArray(element.children)) {
        element.children.length = 0;
      }

      element.innerHTML = '';
      element.textContent = '';
    }

    function renderEmptyState(visibleTasks) {
      if (!elements.emptyState) return;

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
      if (!elements.taskList) return;

      const visibleTasks = filteredTasks();
      clearChildren(elements.taskList);

      visibleTasks.forEach((task) => {
        const item = documentRef.createElement('li');
        item.className = 'task-item';

        const checkbox = documentRef.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.id = `task-toggle-${task.id}`;
        checkbox.addEventListener('change', () => toggleTask(task.id));

        const textWrap = documentRef.createElement('div');
        textWrap.className = 'task-text';

        const label = documentRef.createElement('label');
        label.className = 'task-title';
        label.htmlFor = checkbox.id;
        label.id = `task-title-${task.id}`;
        label.textContent = task.text;
        if (task.completed) label.classList.add('completed');

        const meta = documentRef.createElement('div');
        meta.className = 'task-meta';
        meta.id = `task-meta-${task.id}`;
        meta.textContent = formatCreatedAt(task.createdAt);

        checkbox.setAttribute('aria-labelledby', label.id);
        if (meta.textContent) {
          checkbox.setAttribute('aria-describedby', meta.id);
        }

        textWrap.append(label, meta);

        const deleteButton = documentRef.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-btn';
        deleteButton.textContent = 'Delete';
        deleteButton.setAttribute('aria-label', `Delete task: ${task.text}`);
        deleteButton.addEventListener('click', () => deleteTask(task.id));

        item.append(checkbox, textWrap, deleteButton);
        elements.taskList.appendChild(item);
      });

      elements.filterButtons.forEach((button) => {
        const isActive = button.dataset.filter === state.filter;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      if (elements.clearCompleted) {
        const hasCompletedTasks = state.tasks.some((task) => task.completed);
        elements.clearCompleted.disabled = !hasCompletedTasks;
      }

      renderEmptyState(visibleTasks);
    }

    function commitTasks(nextTasks, successMessage) {
      const previousTasks = state.tasks;
      state.tasks = nextTasks;

      if (!saveTasks()) {
        state.tasks = previousTasks;
        renderTasks();
        return false;
      }

      renderTasks();
      if (!storageRef.available && !options.storage) {
        showStorageFallbackMessage();
      } else {
        clearValidation();
      }

      if (successMessage) {
        announceStatus(successMessage);
      }

      return true;
    }

    function addTask(event) {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }

      if (!elements.input) return false;

      const text = normalizeTaskText(elements.input.value);
      if (!text) {
        showValidation('Please enter a task before adding.');
        announceStatus('Task not added. Enter task text first.');
        return false;
      }

      const wasSaved = commitTasks([createTask(text), ...state.tasks], `Task added: ${text}`);
      if (!wasSaved) return false;

      if (elements.form && typeof elements.form.reset === 'function') {
        elements.form.reset();
      }

      if (typeof elements.input.focus === 'function') {
        elements.input.focus();
      }

      return true;
    }

    function toggleTask(id) {
      const existingTask = state.tasks.find((task) => task.id === id);
      if (!existingTask) return false;

      const nextTasks = state.tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      );

      return commitTasks(
        nextTasks,
        existingTask.completed ? `Task marked active: ${existingTask.text}` : `Task completed: ${existingTask.text}`
      );
    }

    function deleteTask(id) {
      const existingTask = state.tasks.find((task) => task.id === id);
      if (!existingTask) return false;

      const nextTasks = state.tasks.filter((task) => task.id !== id);
      return commitTasks(nextTasks, `Task deleted: ${existingTask.text}`);
    }

    function setFilter(filter) {
      if (!FILTERS.has(filter)) return false;

      state.filter = filter;
      renderTasks();
      announceStatus(`Showing ${filter} tasks.`);
      return true;
    }

    function clearCompletedTasks() {
      const completedTasks = state.tasks.filter((task) => task.completed);
      if (!completedTasks.length) return false;

      const nextTasks = state.tasks.filter((task) => !task.completed);
      const message =
        completedTasks.length === 1
          ? 'Cleared 1 completed task.'
          : `Cleared ${completedTasks.length} completed tasks.`;

      return commitTasks(nextTasks, message);
    }

    function bindEvents() {
      if (!hasRequiredElements()) return false;

      elements.form.addEventListener('submit', addTask);
      elements.filterButtons.forEach((button) => {
        button.addEventListener('click', () => setFilter(button.dataset.filter));
      });
      elements.clearCompleted.addEventListener('click', clearCompletedTasks);
      return true;
    }

    function init() {
      elements = readElements();

      if (!documentRef) return false;

      if (!hasRequiredElements()) {
        if (global.console && typeof global.console.warn === 'function') {
          global.console.warn('Todo app could not initialize because required DOM elements are missing.');
        }
        return false;
      }

      state.tasks = loadTasks();
      bindEvents();
      renderTasks();

      if (!storageRef.available && !options.storage) {
        showStorageFallbackMessage();
      }

      return true;
    }

    return {
      STORAGE_KEY,
      MAX_TASK_LENGTH,
      state,
      getElements() {
        return elements;
      },
      init,
      createTask,
      normalizeTaskText,
      sanitizeTask,
      loadTasks,
      saveTasks,
      filteredTasks,
      addTask,
      toggleTask,
      deleteTask,
      setFilter,
      clearCompletedTasks,
      commitTasks,
      isPersistentStorage() {
        return storageRef.persistent;
      },
    };
  }

  const api = {
    STORAGE_KEY,
    MAX_TASK_LENGTH,
    createApp,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  global.TodoApp = api;

  if (global.document) {
    const bootstrap = () => createApp().init();

    if (
      global.document.readyState === 'loading' &&
      typeof global.document.addEventListener === 'function'
    ) {
      global.document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
      bootstrap();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
