/**
 * @file blocks/background-task-surface/BackgroundTasksElement.ts
 * @description The `<background-tasks>` custom element — the persistent app-shell
 * surface that hosts long-running work after it goes async (the receiving end of a
 * Loader's `escalation:async` handoff). Placed once in the shell as a Layout rail.
 *
 * It listens for the bubbling `background-task-register` event (nearest-ancestor
 * resolution), adopts the carried live Loader state handle, and renders one entry
 * per task — subscribing to the Loader's own state machine off-view rather than
 * reimplementing progress. A polite `role="status"` live region announces off-view
 * completion/failure. The default behaviour is the route-only baseline; the opt-in
 * `durability: reload` tier (#134) derives the navigation-guard default and degrades
 * observably to route-only when Background Fetch is unavailable, with the durable
 * transfer registration + rehydration delegated to `reloadDurabilityAdapter`.
 *
 * Default tag name: background-tasks
 */

import type {
  BackgroundTaskRegisterDetail,
  BackgroundTaskStateChangeDetail,
  BackgroundTaskRetryDetail,
  BackgroundTaskDismissDetail,
  BackgroundTaskState,
  BackgroundTasksConfig,
  BackgroundTasksTrait,
  LoaderStateHandle,
  LoaderSnapshot,
  ProgressMode,
  TraitHandle,
} from './types';
import { DEFAULT_CONFIG, FEEDBACK_TOAST_EVENT } from './types';
import { isBackgroundFetchAvailable } from './reloadDurabilityAdapter';

interface TaskEntry {
  id: string;
  label: string;
  progressMode: ProgressMode;
  state: BackgroundTaskState;
  progress?: number;
  error?: Error;
  handle: LoaderStateHandle;
  unsubscribe: () => void;
  autoClearTimer: ReturnType<typeof setTimeout> | null;
}

export default class BackgroundTasksElement extends HTMLElement {
  static observedAttributes = [
    'aggregation',
    'persistence',
    'navigation-guard',
    'completion-toast',
    'retry',
    'durability',
  ];

  /** Delay before a transient success auto-clears. Settable for deterministic tests. */
  autoClearDelayMs = 5000;

  #config: BackgroundTasksConfig = { ...DEFAULT_CONFIG };
  #entries = new Map<string, TaskEntry>();
  #traitHandles: TraitHandle[] = [];
  #built = false;

  #listEl: HTMLElement | null = null;
  #liveRegion: HTMLElement | null = null;

  #registerHandler: ((e: Event) => void) | null = null;
  #guardArmed = false;
  #beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
  #navigateHandler: ((e: Event) => void) | null = null;

  // ---- Public API ----

  /** Resolved behavior (read-only; flip via attributes or traits). */
  get config(): BackgroundTasksConfig {
    return this.#config;
  }

  /** A read-only snapshot of the tracked tasks (excludes dismissed). */
  get tasks(): ReadonlyArray<{
    id: string;
    label: string;
    state: BackgroundTaskState;
    progressMode: ProgressMode;
    progress?: number;
  }> {
    return [...this.#entries.values()]
      .filter((e) => e.state !== 'dismissed')
      .map(({ id, label, state, progressMode, progress }) => ({
        id,
        label,
        state,
        progressMode,
        progress,
      }));
  }

  /** True while at least one task is `registered` or `active`. */
  hasActiveTasks(): boolean {
    for (const e of this.#entries.values()) {
      if (e.state === 'registered' || e.state === 'active') return true;
    }
    return false;
  }

  /** Apply trait factories (the programmatic counterpart to the attributes). */
  applyTraits(traits: BackgroundTasksTrait[]): void {
    for (const trait of traits) this.#traitHandles.push(trait(this));
    this.refreshBehavior();
  }

  /** Re-evaluate live behavior (guard arming, rendering) after config changes. */
  refreshBehavior(): void {
    this.#syncGuard();
    this.#render();
  }

  // ---- Lifecycle ----

  connectedCallback(): void {
    this.#readAttributes();
    this.#build();

    this.#registerHandler = (e: Event) => this.#onRegister(e as CustomEvent);
    this.addEventListener('background-task-register', this.#registerHandler);

    this.refreshBehavior();
  }

  disconnectedCallback(): void {
    if (this.#registerHandler) {
      this.removeEventListener('background-task-register', this.#registerHandler);
      this.#registerHandler = null;
    }
    for (const entry of this.#entries.values()) {
      entry.unsubscribe();
      if (entry.autoClearTimer) clearTimeout(entry.autoClearTimer);
    }
    for (const handle of this.#traitHandles) handle.cleanup();
    this.#traitHandles = [];
    this.#disarmGuard();
  }

  attributeChangedCallback(name: string, _old: string | null, _value: string | null): void {
    this.#readAttributes();
    this.refreshBehavior();
  }

  // ---- Config from attributes ----

  // Attributes are the single source of truth for the dimensions; traits set them.
  #readAttributes(): void {
    this.#config = {
      aggregation: this.getAttribute('aggregation') === 'batch' ? 'batch' : 'single',
      persistence: this.getAttribute('persistence') === 'sticky' ? 'sticky' : 'transient',
      navigationGuard: this.hasAttribute('navigation-guard'),
      completionToast: this.hasAttribute('completion-toast'),
      retry: this.hasAttribute('retry'),
      durability: this.getAttribute('durability') === 'reload' ? 'reload' : 'route',
    };
  }

  // ---- DOM scaffold ----

  #build(): void {
    if (this.#built) return;
    this.#built = true;

    const list = document.createElement('ol');
    list.className = 'bt-list';
    list.setAttribute('role', 'list');
    this.#listEl = list;

    const status = document.createElement('div');
    status.className = 'bt-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    this.#liveRegion = status;

    this.replaceChildren(list, status);
  }

  // ---- Registration handoff ----

  #onRegister(event: CustomEvent<BackgroundTaskRegisterDetail>): void {
    const detail = event.detail;
    if (!detail || !detail.id || !detail.loaderState) return;

    // Nearest-ancestor resolution: this surface adopts it; an outer surface must not.
    event.stopPropagation();

    // Replace an existing entry with the same id (idempotent re-register).
    const existing = this.#entries.get(detail.id);
    if (existing) {
      existing.unsubscribe();
      if (existing.autoClearTimer) clearTimeout(existing.autoClearTimer);
    }

    const entry: TaskEntry = {
      id: detail.id,
      label: detail.label,
      progressMode: detail.progress,
      state: 'registered',
      handle: detail.loaderState,
      unsubscribe: () => {},
      autoClearTimer: null,
    };
    this.#entries.set(detail.id, entry);

    entry.unsubscribe = detail.loaderState.subscribe((snapshot) =>
      this.#onSnapshot(entry.id, snapshot),
    );

    // Seed from the current snapshot so an already-active handle shows immediately.
    this.#onSnapshot(entry.id, detail.loaderState.getSnapshot());

    this.refreshBehavior();
  }

  #onSnapshot(id: string, snapshot: LoaderSnapshot): void {
    const entry = this.#entries.get(id);
    if (!entry || entry.state === 'dismissed') return;

    entry.progress = snapshot.progress;
    if (snapshot.error) entry.error = snapshot.error;

    if (entry.state !== snapshot.state) {
      this.#transition(entry, snapshot.state);
    } else {
      this.#render();
    }
  }

  // ---- State machine ----

  #transition(entry: TaskEntry, to: BackgroundTaskState): void {
    const from = entry.state;
    if (from === to) return;
    entry.state = to;

    this.dispatchEvent(
      new CustomEvent<BackgroundTaskStateChangeDetail>('background-task-state-change', {
        bubbles: true,
        cancelable: false,
        detail: { id: entry.id, from, to },
      }),
    );

    if (to === 'success') this.#onSuccess(entry);
    else if (to === 'error') this.#onError(entry);

    this.refreshBehavior();
  }

  #onSuccess(entry: TaskEntry): void {
    this.#announce(`${entry.label} complete`);

    if (this.#config.completionToast) {
      this.dispatchEvent(
        new CustomEvent(FEEDBACK_TOAST_EVENT, {
          bubbles: true,
          cancelable: false,
          detail: { id: entry.id, tone: 'success', message: `${entry.label} complete` },
        }),
      );
    }

    // Transient (default) auto-clears; sticky keeps the resolved entry.
    if (this.#config.persistence === 'transient') {
      entry.autoClearTimer = setTimeout(
        () => this.#dismiss(entry.id, 'auto-clear'),
        this.autoClearDelayMs,
      );
    }
  }

  #onError(entry: TaskEntry): void {
    // Errors are sticky regardless of persistence — an off-view failure stays reviewable.
    this.#announce(`${entry.label} failed`);
  }

  #announce(message: string): void {
    if (this.#liveRegion) this.#liveRegion.textContent = message;
  }

  // ---- Retry (affordance only; recovery delegated out) ----

  #retry(id: string): void {
    const entry = this.#entries.get(id);
    if (!entry || entry.state !== 'error') return;

    const evt = new CustomEvent<BackgroundTaskRetryDetail>('background-task-retry', {
      bubbles: true,
      cancelable: true,
      detail: { id },
    });
    const proceed = this.dispatchEvent(evt);
    if (!proceed) return; // a host intercepted and ran its own recovery

    entry.error = undefined;
    // Delegate recovery to the Reliability-backed handle, if it offers one.
    entry.handle.retry?.();
    // Optimistically return to active; subsequent snapshots drive the truth.
    this.#transition(entry, 'active');
  }

  // ---- Dismiss / auto-clear ----

  #dismiss(id: string, reason: 'user' | 'auto-clear'): void {
    const entry = this.#entries.get(id);
    if (!entry || entry.state === 'dismissed') return;

    const evt = new CustomEvent<BackgroundTaskDismissDetail>('background-task-dismiss', {
      bubbles: true,
      cancelable: true,
      detail: { id, reason },
    });
    const proceed = this.dispatchEvent(evt);
    if (!proceed) return; // host kept the entry (e.g. made a transient success sticky)

    if (entry.autoClearTimer) {
      clearTimeout(entry.autoClearTimer);
      entry.autoClearTimer = null;
    }
    entry.unsubscribe();
    this.#transition(entry, 'dismissed');
    this.#entries.delete(id);
    this.refreshBehavior();
  }

  // ---- Navigation guard (route-only baseline) ----
  // Forward-ref: this beforeunload + Navigation-API pair is the same paradigm
  // being harvested as the navigation-guard intent (#129); once that contract
  // lands this should delegate to it rather than arm the primitives inline.

  // `durability` derives the guard default, never merges with it (#450 ruling 2):
  //
  // - `route` baseline → guard is the author's explicit `navigation-guard` opt-in.
  // - `reload` + Background Fetch available → the durable tier means a reload won't lose
  //   work, so the warn is *relaxed* by default; the author may still force it on (the
  //   explicit attribute is honoured).
  // - `reload` but Background Fetch unavailable → the tier degrades to route-only, so the
  //   guard *re-arms* (fixed mechanic). The re-arm is feature-detected at arm-time (#450
  //   ruling 3) and made observable via `data-durability-fallback`.
  #syncGuard(): void {
    const degraded = this.#config.durability === 'reload' && !isBackgroundFetchAvailable();
    if (degraded) this.setAttribute('data-durability-fallback', '');
    else this.removeAttribute('data-durability-fallback');

    const guardWanted = degraded ? true : this.#config.navigationGuard;
    const shouldArm = guardWanted && this.hasActiveTasks();
    if (shouldArm && !this.#guardArmed) this.#armGuard();
    else if (!shouldArm && this.#guardArmed) this.#disarmGuard();
  }

  #armGuard(): void {
    this.#guardArmed = true;

    // Cross-document: close / hard reload.
    this.#beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', this.#beforeUnloadHandler);

    // Same-document: SPA route-leave confirm via the Navigation API (when present).
    const nav = (window as unknown as { navigation?: EventTarget }).navigation;
    if (nav) {
      this.#navigateHandler = (e: Event) => {
        const ev = e as Event & {
          canIntercept?: boolean;
          hashChange?: boolean;
          preventDefault: () => void;
        };
        if (ev.canIntercept === false || ev.hashChange) return;
        const ok = typeof confirm === 'function'
          ? confirm('A background task is still running. Leave anyway?')
          : true;
        if (!ok) ev.preventDefault();
      };
      nav.addEventListener('navigate', this.#navigateHandler);
    }
  }

  #disarmGuard(): void {
    this.#guardArmed = false;
    if (this.#beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.#beforeUnloadHandler);
      this.#beforeUnloadHandler = null;
    }
    if (this.#navigateHandler) {
      const nav = (window as unknown as { navigation?: EventTarget }).navigation;
      nav?.removeEventListener('navigate', this.#navigateHandler);
      this.#navigateHandler = null;
    }
  }

  // ---- Rendering ----

  #render(): void {
    if (!this.#listEl) return;

    const visible = [...this.#entries.values()].filter((e) => e.state !== 'dismissed');
    // Single aggregation shows one entry at a time (the most recent); batch shows all.
    const rows = this.#config.aggregation === 'batch' ? visible : visible.slice(-1);

    this.#listEl.replaceChildren(...rows.map((e) => this.#renderRow(e)));
    this.setAttribute('data-aggregation', this.#config.aggregation);
    if (visible.length === 0) this.setAttribute('data-empty', '');
    else this.removeAttribute('data-empty');
  }

  #renderRow(entry: TaskEntry): HTMLElement {
    const li = document.createElement('li');
    li.className = 'bt-entry';
    li.setAttribute('data-task-id', entry.id);
    li.setAttribute('data-state', entry.state);
    li.setAttribute('data-progress-mode', entry.progressMode);

    const label = document.createElement('span');
    label.className = 'bt-label';
    label.textContent = entry.label;
    li.append(label);

    li.append(this.#renderProgress(entry));

    if (entry.state === 'error') {
      const err = document.createElement('span');
      err.className = 'bt-error';
      err.textContent = entry.error?.message ?? 'Failed';
      li.append(err);
      if (this.#config.retry) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'bt-retry';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => this.#retry(entry.id));
        li.append(retry);
      }
    }

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'bt-dismiss';
    dismiss.setAttribute('aria-label', `Dismiss ${entry.label}`);
    dismiss.textContent = '×';
    dismiss.addEventListener('click', () => this.#dismiss(entry.id, 'user'));
    li.append(dismiss);

    return li;
  }

  #renderProgress(entry: TaskEntry): HTMLElement {
    if (entry.state === 'success' || entry.state === 'error') {
      const done = document.createElement('span');
      done.className = 'bt-result';
      done.textContent = entry.state === 'success' ? '✓' : '✗';
      return done;
    }
    // Native <progress>: determinate carries value/max; indeterminate omits value.
    const progress = document.createElement('progress');
    progress.className = 'bt-progress';
    if (entry.progressMode === 'determinate' && typeof entry.progress === 'number') {
      progress.max = 1;
      progress.value = entry.progress;
    }
    return progress;
  }
}
