const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp, MAX_TASK_LENGTH, STORAGE_KEY } = require('../app.js');

function createMemoryStorage(initialValue) {
  const store = {};
  if (typeof initialValue !== 'undefined') {
    store[STORAGE_KEY] = initialValue;
  }

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

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.type = '';
    this.htmlFor = '';
    this._className = '';
    this._id = '';
  }

  get id() {
    return this._id;
  }

  set id(value) {
    this._id = String(value);
    this.ownerDocument.nodesById[this._id] = this;
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this._className = String(value);
  }

  get classList() {
    const element = this;

    function tokens() {
      return element.className.split(/\s+/).filter(Boolean);
    }

    function update(nextTokens) {
      element.className = nextTokens.join(' ');
    }

    return {
      add(token) {
        if (!tokens().includes(token)) {
          update([...tokens(), token]);
        }
      },
      toggle(token, force) {
        const hasToken = tokens().includes(token);
        const shouldAdd = typeof force === 'boolean' ? force : !hasToken;

        if (shouldAdd && !hasToken) {
          update([...tokens(), token]);
        }

        if (!shouldAdd && hasToken) {
          update(tokens().filter((value) => value !== token));
        }
      },
      contains(token) {
        return tokens().includes(token);
      },
    };
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') {
      this.id = value;
    }
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  append(...nodes) {
    nodes.forEach((node) => {
      this.children.push(node);
    });
  }

  appendChild(node) {
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  addEventListener(type, handler) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(handler);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  reset() {
    if (this.ownerDocument.input) {
      this.ownerDocument.input.value = '';
    }
  }
}

class FakeDocument {
  constructor() {
    this.nodesById = {};
    this.activeElement = null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.nodesById[id] || null;
  }

  querySelectorAll(selector) {
    if (selector !== '.filter-btn') return [];

    return ['all', 'active', 'completed']
      .map((filter) => this.nodesById[`filter-${filter}`])
      .filter(Boolean);
  }
}

function createFixture() {
  const document = new FakeDocument();

  const form = document.createElement('form');
  form.id = 'task-form';

  const input = document.createElement('input');
  input.id = 'task-input';
  document.input = input;

  const validationMessage = document.createElement('p');
  validationMessage.id = 'validation-message';

  const statusMessage = document.createElement('p');
  statusMessage.id = 'status-message';

  const taskList = document.createElement('ul');
  taskList.id = 'task-list';

  const emptyState = document.createElement('p');
  emptyState.id = 'empty-state';

  const clearCompleted = document.createElement('button');
  clearCompleted.id = 'clear-completed';

  const filters = ['all', 'active', 'completed'].map((filter, index) => {
    const button = document.createElement('button');
    button.id = `filter-${filter}`;
    button.className = index === 0 ? 'filter-btn active' : 'filter-btn';
    button.dataset.filter = filter;
    return button;
  });

  return {
    document,
    form,
    input,
    validationMessage,
    statusMessage,
    taskList,
    emptyState,
    clearCompleted,
    filterButtons: filters,
  };
}

test('init safely returns false when required DOM is missing', () => {
  const app = createApp();

  assert.equal(app.init(), false);
});

test('loadTasks skips malformed data and normalizes task text safely', () => {
  const fixture = createFixture();
  const storage = createMemoryStorage(
    JSON.stringify([
      { id: '1', text: '  valid task  ', completed: false, createdAt: '2025-01-01T00:00:00.000Z' },
      { id: '2', text: '   ', completed: false, createdAt: '2025-01-01T00:00:00.000Z' },
      { id: '3', text: `<img src=x onerror=alert('xss')>${'a'.repeat(MAX_TASK_LENGTH)}`, completed: true, createdAt: 'bad-date' },
    ])
  );

  const app = createApp({ document: fixture.document, storage });

  assert.equal(app.init(), true);
  assert.equal(app.state.tasks.length, 2);
  assert.equal(fixture.validationMessage.textContent, 'Some saved tasks were skipped because stored data was invalid.');
  assert.equal(app.state.tasks[0].text, 'valid task');
  assert.equal(app.state.tasks[1].text.length, MAX_TASK_LENGTH);
  assert.equal(app.state.tasks[1].createdAt, '');

  const secondItem = fixture.taskList.children[1];
  const label = secondItem.children[1].children[0];
  const deleteButton = secondItem.children[2];

  assert.equal(label.textContent, app.state.tasks[1].text);
  assert.equal(deleteButton.getAttribute('aria-label'), `Delete task: ${app.state.tasks[1].text}`);
});

test('setFilter updates visible tasks and pressed state for filter buttons', () => {
  const fixture = createFixture();
  const storage = createMemoryStorage(
    JSON.stringify([
      { id: '1', text: 'active task', completed: false, createdAt: '2025-01-01T00:00:00.000Z' },
      { id: '2', text: 'done task', completed: true, createdAt: '2025-01-01T00:00:00.000Z' },
    ])
  );

  const app = createApp({ document: fixture.document, storage });
  app.init();

  assert.equal(app.setFilter('completed'), true);
  assert.equal(fixture.taskList.children.length, 1);
  assert.equal(fixture.filterButtons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(fixture.filterButtons[1].getAttribute('aria-pressed'), 'false');
  assert.equal(fixture.filterButtons[2].getAttribute('aria-pressed'), 'true');
  assert.equal(fixture.statusMessage.textContent, 'Showing completed tasks.');
});

test('failed saves revert state and keep the rendered UI consistent', () => {
  const fixture = createFixture();
  const storage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota exceeded');
    },
    removeItem() {},
  };

  const app = createApp({ document: fixture.document, storage });
  app.init();
  fixture.input.value = 'Buy milk';

  assert.equal(app.addTask({ preventDefault() {} }), false);
  assert.equal(app.state.tasks.length, 0);
  assert.equal(fixture.taskList.children.length, 0);
  assert.equal(fixture.validationMessage.textContent, 'Tasks could not be saved. Your last change was not applied.');
});

test('storage fallback keeps the app usable when browser storage is unavailable', () => {
  const fixture = createFixture();
  const app = createApp({ document: fixture.document });

  assert.equal(app.init(), true);
  assert.equal(app.isPersistentStorage(), false);
  assert.equal(
    fixture.validationMessage.textContent,
    'Browser storage is unavailable. Tasks will work for this session only.'
  );

  fixture.input.value = 'Session only task';

  assert.equal(app.addTask({ preventDefault() {} }), true);
  assert.equal(app.state.tasks.length, 1);
  assert.equal(fixture.taskList.children.length, 1);
  assert.equal(
    fixture.validationMessage.textContent,
    'Browser storage is unavailable. Tasks will work for this session only.'
  );
});
