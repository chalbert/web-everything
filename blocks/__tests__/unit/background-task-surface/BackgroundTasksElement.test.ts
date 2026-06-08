import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BackgroundTasksElement from '../../../background-task-surface/BackgroundTasksElement';
import {
  withBatchAggregation,
  withStickyEntries,
  withNavigationGuard,
  withCompletionToast,
  withPerTaskRetry,
} from '../../../background-task-surface/index';
import {
  MockLoaderHandle,
  registerTask,
} from '../../../background-task-surface/__fixtures__/mock-loader';

if (!customElements.get('background-tasks')) {
  customElements.define('background-tasks', BackgroundTasksElement);
}

/** Mount a fresh surface in the document so connectedCallback runs. */
function mount(): BackgroundTasksElement {
  const el = document.createElement('background-tasks') as BackgroundTasksElement;
  el.autoClearDelayMs = 0; // deterministic auto-clear
  document.body.appendChild(el);
  return el;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

const rows = (el: Element) => el.querySelectorAll('.bt-entry');
const row = (el: Element, id: string) => el.querySelector(`.bt-entry[data-task-id="${id}"]`);
const live = (el: Element) => el.querySelector('.bt-status')!.textContent;

describe('BackgroundTasksElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('scaffold', () => {
    it('builds a list and a polite status live region', () => {
      const el = mount();
      expect(el.querySelector('ol.bt-list')).not.toBeNull();
      const status = el.querySelector('.bt-status')!;
      expect(status.getAttribute('role')).toBe('status');
      expect(status.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('registration handoff', () => {
    it('adopts a bubbling register event from a descendant (nearest-ancestor)', () => {
      const el = mount();
      const child = document.createElement('div');
      el.appendChild(child);
      const handle = new MockLoaderHandle({ state: 'active', progress: 0.2 });

      registerTask(el, { id: 't1', label: 'Upload', progress: 'determinate', handle, source: child });

      expect(rows(el).length).toBe(1);
      expect(el.tasks[0]).toMatchObject({ id: 't1', label: 'Upload', state: 'active' });
    });

    it('stops propagation so an outer surface does not double-adopt', () => {
      const outer = mount();
      const inner = document.createElement('background-tasks') as BackgroundTasksElement;
      outer.appendChild(inner);
      const source = document.createElement('div');
      inner.appendChild(source);

      registerTask(inner, {
        id: 't1',
        label: 'Task',
        handle: new MockLoaderHandle(),
        source,
      });

      expect(rows(inner).length).toBe(1);
      expect(rows(outer).length).toBe(1); // only the inner surface's own row
      expect(outer.tasks.find((t) => t.id === 't1' && t !== inner.tasks[0])).toBeUndefined();
    });

    it('renders native <progress> with value for a determinate task', () => {
      const el = mount();
      const handle = new MockLoaderHandle({ state: 'active', progress: 0.5 });
      registerTask(el, { id: 't1', label: 'DL', progress: 'determinate', handle });
      const p = row(el, 't1')!.querySelector('progress') as HTMLProgressElement;
      expect(p.value).toBe(0.5);
      handle.emit({ state: 'active', progress: 0.9 });
      expect((row(el, 't1')!.querySelector('progress') as HTMLProgressElement).value).toBe(0.9);
    });
  });

  describe('state machine + events', () => {
    it('re-emits background-task-state-change on transitions', () => {
      const el = mount();
      const seen: string[] = [];
      el.addEventListener('background-task-state-change', (e) => {
        const d = (e as CustomEvent).detail;
        seen.push(`${d.from}->${d.to}`);
      });
      const handle = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 't1', label: 'X', handle });
      handle.emit({ state: 'success' });
      expect(seen).toContain('registered->active');
      expect(seen).toContain('active->success');
    });

    it('announces completion and failure in the live region', () => {
      const el = mount();
      const ok = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 'a', label: 'Export', handle: ok });
      ok.emit({ state: 'success' });
      expect(live(el)).toBe('Export complete');

      const bad = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 'b', label: 'Sync', handle: bad });
      bad.emit({ state: 'error', error: new Error('boom') });
      expect(live(el)).toBe('Sync failed');
    });
  });

  describe('persistence', () => {
    it('auto-clears a transient success (default)', async () => {
      const el = mount();
      const h = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 't1', label: 'X', handle: h });
      h.emit({ state: 'success' });
      await tick();
      expect(rows(el).length).toBe(0);
    });

    it('keeps a sticky success until dismissed', async () => {
      const el = mount();
      withStickyEntries(el);
      const h = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 't1', label: 'X', handle: h });
      h.emit({ state: 'success' });
      await tick();
      expect(row(el, 't1')!.getAttribute('data-state')).toBe('success');
    });

    it('keeps an error entry even when transient (sticky regardless)', async () => {
      const el = mount();
      const h = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 't1', label: 'X', handle: h });
      h.emit({ state: 'error', error: new Error('nope') });
      await tick();
      expect(row(el, 't1')!.getAttribute('data-state')).toBe('error');
    });
  });

  describe('aggregation', () => {
    it('single (default) shows one entry at a time', () => {
      const el = mount();
      registerTask(el, { id: 'a', label: 'A', handle: new MockLoaderHandle() });
      registerTask(el, { id: 'b', label: 'B', handle: new MockLoaderHandle() });
      expect(rows(el).length).toBe(1);
      expect(row(el, 'b')).not.toBeNull(); // most recent
    });

    it('batch shows all concurrent entries; one failure leaves the other active', () => {
      const el = mount();
      withBatchAggregation(el);
      const a = new MockLoaderHandle({ state: 'active' });
      const b = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 'a', label: 'A', handle: a });
      registerTask(el, { id: 'b', label: 'B', handle: b });
      expect(rows(el).length).toBe(2);
      a.emit({ state: 'error', error: new Error('x') });
      expect(row(el, 'a')!.getAttribute('data-state')).toBe('error');
      expect(row(el, 'b')!.getAttribute('data-state')).toBe('active');
    });
  });

  describe('retry', () => {
    it('shows a retry button on error only when enabled, and delegates to the handle', () => {
      const el = mount();
      withPerTaskRetry(el);
      withStickyEntries(el);
      const h = new MockLoaderHandle({ state: 'active' });
      const fired: string[] = [];
      el.addEventListener('background-task-retry', (e) => fired.push((e as CustomEvent).detail.id));
      registerTask(el, { id: 't1', label: 'X', handle: h });
      h.emit({ state: 'error', error: new Error('fail') });

      const btn = row(el, 't1')!.querySelector('.bt-retry') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      btn.click();
      expect(fired).toEqual(['t1']);
      expect(h.retried).toBe(1);
      expect(row(el, 't1')!.getAttribute('data-state')).toBe('active');
    });

    it('does not delegate when a host cancels the retry event', () => {
      const el = mount();
      withPerTaskRetry(el);
      const h = new MockLoaderHandle({ state: 'active' });
      el.addEventListener('background-task-retry', (e) => e.preventDefault());
      registerTask(el, { id: 't1', label: 'X', handle: h });
      h.emit({ state: 'error', error: new Error('fail') });
      (row(el, 't1')!.querySelector('.bt-retry') as HTMLButtonElement).click();
      expect(h.retried).toBe(0);
      expect(row(el, 't1')!.getAttribute('data-state')).toBe('error');
    });
  });

  describe('dismiss', () => {
    it('a user dismiss removes the entry and fires background-task-dismiss', () => {
      const el = mount();
      withStickyEntries(el);
      const detail: any[] = [];
      el.addEventListener('background-task-dismiss', (e) => detail.push((e as CustomEvent).detail));
      const h = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 't1', label: 'X', handle: h });
      h.emit({ state: 'success' });
      (row(el, 't1')!.querySelector('.bt-dismiss') as HTMLButtonElement).click();
      expect(rows(el).length).toBe(0);
      expect(detail).toEqual([{ id: 't1', reason: 'user' }]);
    });

    it('a host can keep a transient success by canceling the auto-clear dismiss', async () => {
      const el = mount();
      el.addEventListener('background-task-dismiss', (e) => {
        if ((e as CustomEvent).detail.reason === 'auto-clear') e.preventDefault();
      });
      const h = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 't1', label: 'X', handle: h });
      h.emit({ state: 'success' });
      await tick();
      expect(row(el, 't1')).not.toBeNull(); // kept despite transient
    });
  });

  describe('completion toast', () => {
    it('emits a feedback-toast on success when enabled', () => {
      const el = mount();
      withCompletionToast(el);
      withStickyEntries(el);
      const toasts: any[] = [];
      el.addEventListener('feedback-toast', (e) => toasts.push((e as CustomEvent).detail));
      const h = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 't1', label: 'Export', handle: h });
      h.emit({ state: 'success' });
      expect(toasts).toEqual([{ id: 't1', tone: 'success', message: 'Export complete' }]);
    });
  });

  describe('navigation guard', () => {
    it('arms beforeunload while a task is in flight and disarms when it resolves', () => {
      const add = vi.spyOn(window, 'addEventListener');
      const remove = vi.spyOn(window, 'removeEventListener');
      const el = mount();
      withNavigationGuard(el);
      const h = new MockLoaderHandle({ state: 'active' });
      registerTask(el, { id: 't1', label: 'X', handle: h });
      expect(add.mock.calls.some((c) => c[0] === 'beforeunload')).toBe(true);
      h.emit({ state: 'success' });
      expect(remove.mock.calls.some((c) => c[0] === 'beforeunload')).toBe(true);
    });
  });

  describe('traits', () => {
    it('cleanup reverts the attribute to its prior value', () => {
      const el = mount();
      const handle = withBatchAggregation(el);
      expect(el.getAttribute('aggregation')).toBe('batch');
      handle.cleanup();
      expect(el.hasAttribute('aggregation')).toBe(false);
      expect(el.config.aggregation).toBe('single');
    });
  });
});
