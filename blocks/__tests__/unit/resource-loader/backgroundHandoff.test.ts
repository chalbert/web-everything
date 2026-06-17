/**
 * Unit tests for the Loader → off-view-receiver handoff (producer side).
 *
 * Drives a REAL ResourceLoader through `backgroundLoad` into the WE **reference
 * receiver** (`__fixtures__/reference-receiver`) — proving the producer half wires
 * up end to end against the wire contract alone: a slow load escalates and
 * registers, a fast load never does, the handle drives state/progress, the retry
 * affordance re-runs the real loader, and a non-vetoed dismiss disposes the handle.
 *
 * It deliberately does NOT import Frontier UI's `<background-tasks>` surface (impl,
 * across the iframe boundary). The receiver is the smallest thing that honors the
 * contract; the surface's own behaviors (aggregation, persistence, toast, reload
 * durability) are verified on FUI's hosted demo, not here. Scenarios are the shared
 * fixtures the conformance playground renders, so badges and CI can't drift.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ResourceLoader from '../../../resource-loader/ResourceLoader';
import { backgroundLoad } from '../../../resource-loader/backgroundHandoff';
import { createDeferred } from '../../../resource-loader/__fixtures__/handoff-scenarios';
import {
  ReferenceTaskReceiver,
  defineReferenceReceiver,
} from '../../../resource-loader/__fixtures__/reference-receiver';
import type {
  LoaderStateHandle,
  BackgroundTaskRegisterDetail,
} from '../../../resource-loader/handoffContract';

defineReferenceReceiver();

/** Mount a receiver with a loader target inside it (so the register bubbles up). */
function mount(): {
  receiver: ReferenceTaskReceiver;
  target: HTMLDivElement;
  loader: ResourceLoader;
  intent?: never;
} {
  const receiver = document.createElement('reference-task-receiver') as ReferenceTaskReceiver;
  document.body.appendChild(receiver);
  const target = document.createElement('div');
  receiver.appendChild(target);
  const loader = new ResourceLoader({ target });
  return { receiver, target, loader };
}

/** Capture the live handle the producer registers, from the bubbling event. */
function captureHandle(receiver: Element): () => LoaderStateHandle | undefined {
  let handle: LoaderStateHandle | undefined;
  receiver.addEventListener('background-task-register', (e) => {
    handle = (e as CustomEvent<BackgroundTaskRegisterDetail>).detail.loaderState;
  });
  return () => handle;
}

const retryBtn = (r: Element, id: string) =>
  r.querySelector(`.rr-entry[data-task-id="${id}"] .rr-retry`) as HTMLButtonElement | null;
const dismissBtn = (r: Element, id: string) =>
  r.querySelector(`.rr-entry[data-task-id="${id}"] .rr-dismiss`) as HTMLButtonElement | null;

/** Flush pending microtasks (promise continuations) under fake timers. */
const flush = () => Promise.resolve().then(() => Promise.resolve());

describe('backgroundLoad — Loader → off-view-receiver handoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('escalate-on-async: a slow load registers an active entry, then succeeds', async () => {
    const { receiver, loader } = mount();
    const d = createDeferred<string>();

    const p = backgroundLoad(loader, () => d.promise, { id: 'export', label: 'Export' });
    // Before the debounce threshold: still pending, nothing registered.
    expect(receiver.entryCount).toBe(0);

    // Cross the threshold → loading → escalation → register.
    vi.advanceTimersByTime(400);
    expect(receiver.entryCount).toBe(1);
    expect(receiver.stateOf('export')).toBe('active');

    // Resolve the work → success reflected off-view.
    d.resolve('data');
    const result = await p;
    await flush();
    expect(result.state).toBe('success');
    expect(receiver.stateOf('export')).toBe('success');
  });

  it('fast-load-no-escalate: resolving before the threshold never registers', async () => {
    const { receiver, loader } = mount();
    const d = createDeferred<string>();

    const p = backgroundLoad(loader, () => d.promise, { id: 'fast', label: 'Quick' });
    // Resolve immediately, before advancing past the debounce.
    d.resolve('x');
    const result = await p;
    await flush();

    expect(result.state).toBe('success');
    expect(receiver.entryCount).toBe(0);
  });

  it('error-then-retry: failure is reflected and retry re-runs the real load', async () => {
    const { receiver, loader } = mount();

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
    expect(receiver.stateOf('sync')).toBe('active');

    deferreds[0].reject(new Error('network'));
    const result = await p;
    await flush();
    expect(result.state).toBe('error');
    expect(receiver.stateOf('sync')).toBe('error');
    expect(attempts).toBe(1);

    // The receiver's retry affordance delegates to the handle → re-runs load().
    const btn = retryBtn(receiver, 'sync');
    expect(btn).toBeTruthy();
    btn!.click();
    expect(attempts).toBe(2);

    // The re-run escalates again and the entry returns to active.
    vi.advanceTimersByTime(400);
    expect(receiver.stateOf('sync')).toBe('active');
  });

  it("dispose-on-dismiss: dismissing the entry detaches the handle's loader listeners", async () => {
    const { receiver, target, loader } = mount();
    const d = createDeferred<string>();
    const handleOf = captureHandle(receiver);

    const p = backgroundLoad(loader, () => d.promise, { id: 'export', label: 'Export' });
    vi.advanceTimersByTime(400);
    expect(receiver.stateOf('export')).toBe('active');
    expect(handleOf()).toBeDefined();

    d.resolve('data');
    await p;
    await flush();
    expect(receiver.stateOf('export')).toBe('success');

    // While registered, the handle still reflects the loader's event stream.
    const live = vi.fn();
    const unsub = handleOf()!.subscribe(live);
    target.dispatchEvent(new CustomEvent('resource-load-end'));
    expect(live).toHaveBeenCalled();
    unsub();

    // User dismisses the entry → bubbles to the shared root → producer disposes.
    const btn = dismissBtn(receiver, 'export');
    expect(btn).toBeTruthy();
    btn!.click();
    expect(receiver.entryCount).toBe(0);

    // The handle's loader listeners are now detached: a fresh loader event on the
    // target no longer reaches the handle (no leak across many loads).
    const after = vi.fn();
    handleOf()!.subscribe(after);
    target.dispatchEvent(new CustomEvent('resource-load-end'));
    target.dispatchEvent(
      new CustomEvent('resource-load-error', { detail: { error: new Error('late') } }),
    );
    expect(after).not.toHaveBeenCalled();
  });

  it('determinate-progress: reportProgress forwards a clamped 0..1 fraction to the snapshot + bar', async () => {
    const receiver = document.createElement('reference-task-receiver') as ReferenceTaskReceiver;
    document.body.appendChild(receiver);
    const target = document.createElement('div');
    receiver.appendChild(target);
    // Determinate intent → the register carries `progress: 'determinate'`, so the
    // receiver renders a value-bearing <progress>.
    const loader = new ResourceLoader({ target, intent: { progress: 'determinate' } });
    const d = createDeferred<string>();
    const handleOf = captureHandle(receiver);

    const p = backgroundLoad(loader, () => d.promise, { id: 'upload', label: 'Upload' });
    vi.advanceTimersByTime(400);
    expect(receiver.stateOf('upload')).toBe('active');

    // loaded/total normalizes to a fraction; state is preserved (still active).
    loader.reportProgress(256, 1024);
    expect(handleOf()!.getSnapshot()).toMatchObject({ state: 'active', progress: 0.25 });
    const bar = receiver.querySelector(
      '.rr-entry[data-task-id="upload"] .rr-progress',
    ) as HTMLProgressElement;
    expect(bar.value).toBe(0.25);

    // Single-arg form reports the fraction directly.
    loader.reportProgress(0.5);
    expect(handleOf()!.getSnapshot().progress).toBe(0.5);

    // Over-100% input clamps to 1.
    loader.reportProgress(2048, 1024);
    expect(handleOf()!.getSnapshot().progress).toBe(1);

    d.resolve('done');
    await p;
    await flush();
    expect(receiver.stateOf('upload')).toBe('success');
  });

  it('dispose skips a cancelable dismiss the host kept sticky', async () => {
    const { receiver, target, loader } = mount();
    const d = createDeferred<string>();
    const handleOf = captureHandle(receiver);

    const p = backgroundLoad(loader, () => d.promise, { id: 'keep', label: 'Keep' });
    vi.advanceTimersByTime(400);
    d.resolve('data');
    await p;
    await flush();

    // A host on the receiver vetoes the dismiss (keeps the entry) → the producer
    // must NOT dispose, since the handle is still live off-view.
    receiver.addEventListener('background-task-dismiss', (e) => e.preventDefault());
    dismissBtn(receiver, 'keep')!.click();
    expect(receiver.entryCount).toBe(1); // entry kept

    // Listeners survive: the handle still reacts to the loader.
    const live = vi.fn();
    handleOf()!.subscribe(live);
    target.dispatchEvent(new CustomEvent('resource-load-end'));
    expect(live).toHaveBeenCalled();
  });
});
