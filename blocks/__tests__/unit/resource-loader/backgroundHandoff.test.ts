/**
 * Unit tests for the Loader → Background Task Surface handoff (producer side).
 *
 * Drives a REAL ResourceLoader through `backgroundLoad` into a REAL
 * `<background-tasks>` surface — proving the producer half wires up end to end:
 * a slow load escalates and registers, a fast load never does, and the surface's
 * retry affordance re-runs the real loader. Scenarios are the shared fixtures the
 * conformance playground renders, so badges and CI can't drift.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ResourceLoader from '../../../resource-loader/ResourceLoader';
import { backgroundLoad } from '../../../resource-loader/backgroundHandoff';
import { createDeferred } from '../../../resource-loader/__fixtures__/handoff-scenarios';
import BackgroundTasksElement from '../../../background-task-surface/BackgroundTasksElement';

if (!customElements.get('background-tasks')) {
  customElements.define('background-tasks', BackgroundTasksElement);
}

/** Mount a surface with a loader target inside it (so the register bubbles up). */
function mount(attrs: Record<string, string> = {}): {
  surface: BackgroundTasksElement;
  target: HTMLDivElement;
  loader: ResourceLoader;
} {
  const surface = document.createElement('background-tasks') as BackgroundTasksElement;
  for (const [k, v] of Object.entries(attrs)) surface.setAttribute(k, v);
  surface.autoClearDelayMs = 0;
  document.body.appendChild(surface);
  const target = document.createElement('div');
  surface.appendChild(target);
  const loader = new ResourceLoader({ target });
  return { surface, target, loader };
}

const rows = (s: Element) => s.querySelectorAll('.bt-entry');
const stateOf = (s: Element, id: string) =>
  s.querySelector(`.bt-entry[data-task-id="${id}"]`)?.getAttribute('data-state') ?? null;

/** Flush pending microtasks (promise continuations) under fake timers. */
const flush = () => Promise.resolve().then(() => Promise.resolve());

describe('backgroundLoad — Loader → Background Task Surface handoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('escalate-on-async: a slow load registers an active entry, then succeeds', async () => {
    const { surface, loader } = mount({ persistence: 'sticky' });
    const d = createDeferred<string>();

    const p = backgroundLoad(loader, () => d.promise, { id: 'export', label: 'Export' });
    // Before the debounce threshold: still pending, nothing on the rail.
    expect(rows(surface).length).toBe(0);

    // Cross the threshold → loading → escalation → register.
    vi.advanceTimersByTime(400);
    expect(rows(surface).length).toBe(1);
    expect(stateOf(surface, 'export')).toBe('active');

    // Resolve the work → success reflected off-view.
    d.resolve('data');
    const result = await p;
    await flush();
    expect(result.state).toBe('success');
    expect(stateOf(surface, 'export')).toBe('success');
  });

  it('fast-load-no-escalate: resolving before the threshold never registers', async () => {
    const { surface, loader } = mount();
    const d = createDeferred<string>();

    const p = backgroundLoad(loader, () => d.promise, { id: 'fast', label: 'Quick' });
    // Resolve immediately, before advancing past the debounce.
    d.resolve('x');
    const result = await p;
    await flush();

    expect(result.state).toBe('success');
    expect(rows(surface).length).toBe(0);
  });

  it('error-then-retry: failure is sticky and retry re-runs the real load', async () => {
    const { surface, loader } = mount({ retry: '', persistence: 'sticky' });

    // fn hands out a fresh deferred per attempt so retry exercises a real re-run.
    const deferreds: Array<ReturnType<typeof createDeferred<string>>> = [];
    let attempts = 0;
    const fn = () => {
      attempts++;
      const d = createDeferred<string>();
      deferreds.push(d);
      return d.promise;
    };

    const p = backgroundLoad(loader, fn, { id: 'sync', label: 'Sync' });
    vi.advanceTimersByTime(400);
    expect(stateOf(surface, 'sync')).toBe('active');

    deferreds[0].reject(new Error('network'));
    const result = await p;
    await flush();
    expect(result.state).toBe('error');
    expect(stateOf(surface, 'sync')).toBe('error');
    expect(attempts).toBe(1);

    // The surface's retry affordance delegates to the handle → re-runs load().
    const btn = surface.querySelector(
      '.bt-entry[data-task-id="sync"] .bt-retry',
    ) as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    btn!.click();
    expect(attempts).toBe(2);

    // The re-run escalates again and the entry returns to active.
    vi.advanceTimersByTime(400);
    expect(stateOf(surface, 'sync')).toBe('active');
  });
});
