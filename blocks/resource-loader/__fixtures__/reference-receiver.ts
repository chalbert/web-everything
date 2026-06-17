/**
 * A minimal **reference receiver** for the Loader handoff contract.
 *
 * The production receiver — Frontier UI's `<background-tasks>` surface — is impl
 * and lives in `@frontierui/blocks`, reachable from WE only across the iframe
 * boundary. To prove the WE-standard *producer* half (`backgroundLoad` → bubbling
 * `background-task-register` → a live {@link LoaderStateHandle}) without importing
 * that impl, this fixture implements the receiving end at the smallest size that
 * honors the wire contract:
 *
 * - listens for `background-task-register` and adopts the carried handle,
 * - seeds from `getSnapshot()` and re-renders on every `subscribe()` update,
 * - exposes a `retry` affordance that calls `handle.retry?.()`,
 * - exposes a `dismiss` affordance that dispatches a cancelable, bubbling
 *   `background-task-dismiss` and removes the entry only when not vetoed —
 *   the same event the producer listens for to release its loader listeners.
 *
 * It renders just enough DOM to assert and visualize state: one `.rr-entry` per
 * task carrying `data-task-id` / `data-state`, an optional determinate
 * `<progress class="rr-progress">`, and `.rr-retry` / `.rr-dismiss` buttons. It is
 * NOT the surface: no aggregation, persistence, navigation guard, toast, or
 * reload-durability — those are receiver-impl concerns owned by Frontier UI.
 *
 * Imported by BOTH the producer unit suite and the conformance playground so the
 * invariants they exercise and the behavior they demo can never drift.
 *
 * @module blocks/resource-loader/__fixtures__
 */

import type {
  LoaderSnapshot,
  LoaderStateHandle,
  BackgroundTaskRegisterDetail,
} from '../handoffContract';
import { BACKGROUND_TASK_DISMISS_EVENT } from '../backgroundHandoff';

interface Entry {
  id: string;
  label: string;
  determinate: boolean;
  handle: LoaderStateHandle;
  snapshot: LoaderSnapshot;
  unsubscribe: () => void;
  node: HTMLElement;
}

/**
 * The reference receiving end of the `background-task-register` handoff. Adopt a
 * task by letting a `background-task-register` event bubble to it (or to a
 * descendant of it).
 */
export class ReferenceTaskReceiver extends HTMLElement {
  #entries = new Map<string, Entry>();

  connectedCallback(): void {
    this.addEventListener('background-task-register', this.#onRegister as EventListener);
  }

  disconnectedCallback(): void {
    this.removeEventListener('background-task-register', this.#onRegister as EventListener);
    for (const entry of this.#entries.values()) entry.unsubscribe();
    this.#entries.clear();
  }

  /** Current lifecycle state of a tracked task (null if not registered). */
  stateOf(id: string): LoaderSnapshot['state'] | null {
    return this.#entries.get(id)?.snapshot.state ?? null;
  }

  /** Live snapshot of a tracked task (null if not registered). */
  snapshotOf(id: string): LoaderSnapshot | null {
    return this.#entries.get(id)?.snapshot ?? null;
  }

  /** Number of tracked entries currently rendered. */
  get entryCount(): number {
    return this.#entries.size;
  }

  #onRegister = (e: Event): void => {
    const { id, label, progress, loaderState } = (
      e as CustomEvent<BackgroundTaskRegisterDetail>
    ).detail;

    // Idempotent re-register: replace an existing entry with the same id.
    this.#entries.get(id)?.unsubscribe();

    const node = this.#renderEntry(id, label, progress === 'determinate');
    const entry: Entry = {
      id,
      label,
      determinate: progress === 'determinate',
      handle: loaderState,
      snapshot: loaderState.getSnapshot(),
      unsubscribe: () => {},
      node,
    };
    entry.unsubscribe = loaderState.subscribe((snapshot) => {
      entry.snapshot = snapshot;
      this.#paint(entry);
    });
    this.#entries.set(id, entry);
    this.#paint(entry);
  };

  #renderEntry(id: string, label: string, determinate: boolean): HTMLElement {
    const node = document.createElement('div');
    node.className = 'rr-entry';
    node.dataset.taskId = id;

    const name = document.createElement('span');
    name.className = 'rr-label';
    name.textContent = label;
    node.append(name);

    if (determinate) {
      const bar = document.createElement('progress');
      bar.className = 'rr-progress';
      bar.max = 1;
      node.append(bar);
    }

    const retry = document.createElement('button');
    retry.className = 'rr-retry';
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => this.#entries.get(id)?.handle.retry?.());
    node.append(retry);

    const dismiss = document.createElement('button');
    dismiss.className = 'rr-dismiss';
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => this.#dismiss(id));
    node.append(dismiss);

    this.append(node);
    return node;
  }

  /**
   * Dispatch the cancelable, bubbling dismiss the producer listens for. If a host
   * vetoes it (`preventDefault`), keep the entry — the handle is still live; the
   * producer leaves its listeners attached too.
   */
  #dismiss(id: string): void {
    const entry = this.#entries.get(id);
    if (!entry) return;
    const ev = new CustomEvent(BACKGROUND_TASK_DISMISS_EVENT, {
      bubbles: true,
      cancelable: true,
      detail: { id, reason: 'user' },
    });
    entry.node.dispatchEvent(ev);
    if (ev.defaultPrevented) return;
    entry.unsubscribe();
    entry.node.remove();
    this.#entries.delete(id);
  }

  #paint(entry: Entry): void {
    entry.node.dataset.state = entry.snapshot.state;
    if (entry.snapshot.error) entry.node.dataset.error = entry.snapshot.error.message;
    const bar = entry.node.querySelector('.rr-progress') as HTMLProgressElement | null;
    if (bar) {
      if (entry.snapshot.progress == null) bar.removeAttribute('value');
      else bar.value = entry.snapshot.progress;
    }
  }
}

let defined = false;

/** Register `<reference-task-receiver>` once (idempotent across test files / demo cards). */
export function defineReferenceReceiver(): void {
  if (defined || customElements.get('reference-task-receiver')) {
    defined = true;
    return;
  }
  customElements.define('reference-task-receiver', ReferenceTaskReceiver);
  defined = true;
}
