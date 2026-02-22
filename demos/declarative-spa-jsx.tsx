/**
 * Declarative SPA Demo - JSX Version
 *
 * This demo shows how to use the Web Everything JSX renderer alongside
 * the declarative custom attributes system.
 */
import { SimpleStore } from '/blocks/stores/simple';

// JSX is auto-injected by vite.config.mts
declare const jsx: typeof import('/blocks/renderers/jsx').default;

// Get globals from bootstrap (plugged mode)
const { CustomAttribute, injectors, attributes } = window as any;

// Get document injector for providing handlers
const documentInjector = injectors.getInjectorOf(document);

// === STORES ===

const counterStore = new SimpleStore({ count: 0 });

const todoStore = new SimpleStore(
  { todos: [] as Array<{ id: number; text: string; completed: boolean }>, newTodoText: '', totalTodos: 0, activeTodos: 0, completedTodos: 0 },
  (state) => {
    const todos = state.todos || [];
    state.totalTodos = todos.length;
    state.activeTodos = todos.filter(t => !t.completed).length;
    state.completedTodos = todos.filter(t => t.completed).length;
  }
);

const formStore = new SimpleStore({ formData: { name: '', email: '', role: '' } });

// Helper to get store by path
function getStoreForPath(path: string) {
  if (path.startsWith('formData.')) return formStore;
  if (['newTodoText', 'totalTodos', 'activeTodos', 'completedTodos', 'todos'].includes(path)) return todoStore;
  return counterStore;
}

// === RENDER FUNCTIONS ===

function renderHeader() {
  return (
    <header>
      <h1>Declarative SPA Demo (JSX)</h1>
      <nav>
        <button data-view="counter" data-active="true" on:click="navigate($event)">Counter</button>
        <button data-view="todos" data-active="false" on:click="navigate($event)">Todo List</button>
        <button data-view="form" data-active="false" on:click="navigate($event)">Form</button>
      </nav>
    </header>
  );
}

function renderCounterView() {
  return (
    <section className="view" data-view="counter" data-active="true">
      <div className="counter">
        <h2>Counter Demo</h2>
        <div className="counter-value" bind-text="count">0</div>
        <div className="counter-controls">
          <button on:click="decrement($event)">Decrement</button>
          <button className="secondary" on:click="reset($event)">Reset</button>
          <button on:click="increment($event)">Increment</button>
        </div>
      </div>
    </section>
  );
}

function renderTodoView() {
  return (
    <section className="view" data-view="todos" data-active="false">
      <div className="todo-section">
        <h2>Todo List</h2>

        <form className="todo-form" on:submit="addTodo($event)">
          <input
            type="text"
            placeholder="Add a new todo..."
            bind-value="newTodoText"
            required
          />
          <button type="submit">Add</button>
        </form>

        <ul className="todo-list" data-list="todos">
          {/* Todos rendered dynamically */}
        </ul>

        <div className="todo-stats">
          <div className="stat">
            <div className="stat-value" bind-text="totalTodos">0</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat">
            <div className="stat-value" bind-text="activeTodos">0</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat">
            <div className="stat-value" bind-text="completedTodos">0</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function renderFormView() {
  return (
    <section className="view" data-view="form" data-active="false">
      <div className="form-section">
        <h2>User Form</h2>

        <form>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              bind-value="formData.name"
              placeholder="Enter your name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              bind-value="formData.email"
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select id="role" bind-value="formData.role">
              <option value="">Select a role</option>
              <option value="developer">Developer</option>
              <option value="designer">Designer</option>
              <option value="manager">Manager</option>
              <option value="other">Other</option>
            </select>
          </div>
        </form>

        <div className="form-preview">
          <div className="preview-title">Form Preview</div>
          <div className="preview-item">
            <span className="preview-label">Name:</span>
            <span className="preview-value" bind-text="formData.name">-</span>
          </div>
          <div className="preview-item">
            <span className="preview-label">Email:</span>
            <span className="preview-value" bind-text="formData.email">-</span>
          </div>
          <div className="preview-item">
            <span className="preview-label">Role:</span>
            <span className="preview-value" bind-text="formData.role">-</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// Render a single todo item using JSX
function renderTodoItem(todo: { id: number; text: string; completed: boolean }) {
  return (
    <li className="todo-item" data-completed={String(todo.completed)}>
      <input
        type="checkbox"
        className="todo-checkbox"
        checked={todo.completed}
        on:change={`toggleTodo($event, ${todo.id})`}
      />
      <span className="todo-text">{todo.text}</span>
      <button className="todo-delete" on:click={`deleteTodo($event, ${todo.id})`}>Delete</button>
    </li>
  );
}

// Render all todos into the list
function renderTodos() {
  const list = document.querySelector('[data-list="todos"]');
  if (!list) return;

  const todos = todoStore.getItem('todos') || [];
  list.innerHTML = '';

  todos.forEach(todo => {
    const item = renderTodoItem(todo);
    list.appendChild(item);
  });

  // Upgrade newly added elements
  attributes.upgrade(list);
}

// === EVENT HANDLERS ===

const handlers = {
  increment: (e: Event) => {
    e.preventDefault();
    counterStore.setItem('count', counterStore.getItem('count') + 1);
  },
  decrement: (e: Event) => {
    e.preventDefault();
    counterStore.setItem('count', counterStore.getItem('count') - 1);
  },
  reset: (e: Event) => {
    e.preventDefault();
    counterStore.setItem('count', 0);
  },

  navigate: (e: Event) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const viewName = target.getAttribute('data-view');
    if (viewName) {
      document.querySelectorAll('nav button').forEach(btn => btn.setAttribute('data-active', 'false'));
      target.setAttribute('data-active', 'true');
      document.querySelectorAll('.view').forEach(view => view.setAttribute('data-active', 'false'));
      document.querySelector(`.view[data-view="${viewName}"]`)?.setAttribute('data-active', 'true');
    }
  },

  addTodo: (e: Event) => {
    e.preventDefault();
    const text = todoStore.getItem('newTodoText');
    if (text?.trim()) {
      const todos = todoStore.getItem('todos') || [];
      todoStore.setItem('todos', [...todos, { id: Date.now(), text: text.trim(), completed: false }]);
      todoStore.setItem('newTodoText', '');
    }
  },

  toggleTodo: (e: Event, id: number) => {
    const target = e.target as HTMLInputElement;
    const todos = todoStore.getItem('todos');
    const updated = todos.map(t => t.id === id ? { ...t, completed: target.checked } : t);
    todoStore.setItem('todos', updated);
  },

  deleteTodo: (e: Event, id: number) => {
    e.preventDefault();
    const todos = todoStore.getItem('todos');
    todoStore.setItem('todos', todos.filter(t => t.id !== id));
  }
};

// Provide handlers via injector system
documentInjector.set('customContexts:handlers', handlers);

// Subscribe to todo changes
todoStore.subscribe(renderTodos);

// === BINDING ATTRIBUTES ===

class BindTextAttribute extends CustomAttribute {
  _updateText?: () => void;
  _unsubscribe?: () => void;

  connectedCallback() {
    const path = this.value;
    if (!path) return;

    const store = getStoreForPath(path);
    this._updateText = () => {
      if (this.target) this.target.textContent = store.getItem(path) ?? '';
    };
    this._updateText();
    this._unsubscribe = store.subscribe(this._updateText);
  }

  disconnectedCallback() {
    this._unsubscribe?.();
  }
}

class BindValueAttribute extends CustomAttribute {
  _handleInput?: (e: Event) => void;
  _unsubscribe?: () => void;

  connectedCallback() {
    const path = this.value;
    if (!path) return;

    const store = getStoreForPath(path);
    const value = store.getItem(path);
    if (this.target && value !== undefined) (this.target as HTMLInputElement).value = value;

    this._handleInput = (e: Event) => store.setItem(path, (e.target as HTMLInputElement).value);
    this.target?.addEventListener('input', this._handleInput);

    this._unsubscribe = store.subscribe(() => {
      const newValue = store.getItem(path);
      const target = this.target as HTMLInputElement;
      if (target && target.value !== newValue) {
        target.value = newValue ?? '';
      }
    });
  }

  disconnectedCallback() {
    this.target?.removeEventListener('input', this._handleInput!);
    this._unsubscribe?.();
  }
}

// Register binding attributes
attributes.define('bind-text', BindTextAttribute);
attributes.define('bind-value', BindValueAttribute);

// === BUILD AND MOUNT THE APP ===

const appMain = document.querySelector('.app-main main');
if (appMain) {
  // Clear placeholder content
  appMain.innerHTML = '';

  // Build and append JSX-rendered views
  appMain.appendChild(renderCounterView());
  appMain.appendChild(renderTodoView());
  appMain.appendChild(renderFormView());

  // Replace header with JSX version
  const header = document.querySelector('.app-main header');
  if (header) {
    const newHeader = renderHeader();
    header.replaceWith(newHeader);
  }
}

// Upgrade document to activate custom attributes
attributes.upgrade(document.body);

// Signal ready
(window as any).demoReady = true;
(window as any).demoMode = 'plugged-jsx';
