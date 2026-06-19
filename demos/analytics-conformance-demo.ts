/**
 * Analytics conformance demo (#1014, slice D of #1003) — the runnable proof of the webanalytics
 * contract+injector swap mechanic (#1012).
 *
 * One call site, the same `identify()/track()/page()/group()` calls, and the **resolved backend swapped**
 * underneath via the `CustomTrackerRegistry` — the core conformance claim: the application knows only the
 * `CustomTracker` contract, never a vendor. Backends here are in-demo **recording stubs** (honest for a
 * browser demo: a real GA4/Mixpanel/Segment backend needs network + credentials; the #1013 vendor adapters
 * are the impl). The conformance section asserts each invariant live and `setPlaygroundReady` reports the
 * pass count the e2e smoke reads.
 */
import {
  createDefaultTrackerRegistry,
  UnknownTrackerError,
  type CustomTracker,
} from '/plugs/webanalytics/index.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

/** A recording-stub backend: it records every routed call so the demo can assert what reached it. */
class RecordingTracker implements CustomTracker {
  readonly key: string;
  readonly calls: Array<{ method: string; args: unknown[] }> = [];
  constructor(key: string) {
    this.key = key;
  }
  identify(...args: unknown[]): void {
    this.calls.push({ method: 'identify', args });
  }
  track(...args: unknown[]): void {
    this.calls.push({ method: 'track', args });
  }
  page(...args: unknown[]): void {
    this.calls.push({ method: 'page', args });
  }
  group(...args: unknown[]): void {
    this.calls.push({ method: 'group', args });
  }
}

/** One conformance invariant of the webanalytics contract+registry — a green badge means it holds live. */
interface Check {
  title: string;
  run: () => boolean;
}

const CHECKS: Check[] = [
  {
    title: 'createDefaultTrackerRegistry ships the native-first no-op default (drops calls, never throws)',
    run: () => {
      const registry = createDefaultTrackerRegistry();
      const before = registry.defaultKey === 'noop';
      registry.track('App Opened'); // no backend wired → must be a silent no-op
      return before;
    },
  },
  {
    title: 'identify / track / page / group all route to the resolved backend',
    run: () => {
      const registry = createDefaultTrackerRegistry();
      const backend = new RecordingTracker('segment-stub');
      registry.define(backend, true);
      registry.identify('u-1', { plan: 'pro' });
      registry.track('Order Completed', { orderId: '50314b8e' });
      registry.page('Docs', 'Pricing');
      registry.group('acct-9', { name: 'Acme' });
      const methods = backend.calls.map((c) => c.method);
      return ['identify', 'track', 'page', 'group'].every((m) => methods.includes(m));
    },
  },
  {
    title: 'swapping the resolved backend reroutes subsequent calls (the core swap mechanic)',
    run: () => {
      const registry = createDefaultTrackerRegistry();
      const a = new RecordingTracker('backend-a');
      const b = new RecordingTracker('backend-b');
      registry.define(a, true);
      registry.track('First');
      registry.define(b, true); // swap the resolved default backend
      registry.track('Second');
      return a.calls.length === 1 && b.calls.length === 1 && (b.calls[0].args[0] as string) === 'Second';
    },
  },
  {
    title: 'page() honors the Segment SDK arg order — category, then name',
    run: () => {
      const registry = createDefaultTrackerRegistry();
      const backend = new RecordingTracker('segment-stub');
      registry.define(backend, true);
      registry.page('Docs', 'Pricing', { path: '/pricing' });
      const pageCall = backend.calls.find((c) => c.method === 'page');
      return pageCall?.args[0] === 'Docs' && pageCall?.args[1] === 'Pricing';
    },
  },
  {
    title: 'a per-call trackerKey routes to a named backend, leaving others untouched',
    run: () => {
      const registry = createDefaultTrackerRegistry();
      const a = new RecordingTracker('backend-a');
      const b = new RecordingTracker('backend-b');
      registry.define(a, true);
      registry.define(b);
      registry.track('Explicit', { v: 1 }, undefined, 'backend-b');
      return b.calls.length === 1 && a.calls.length === 0;
    },
  },
  {
    title: 'resolving an unregistered backend throws UnknownTrackerError (never a silent substitute)',
    run: () => {
      const registry = createDefaultTrackerRegistry();
      try {
        registry.resolve('nope');
        return false;
      } catch (error) {
        return error instanceof UnknownTrackerError;
      }
    },
  },
];

function runConformance(host: HTMLElement): number {
  const summary = el('div', { class: 'summary' });
  host.append(summary);
  let pass = 0;
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = check.run();
    } catch {
      ok = false;
    }
    if (ok) pass += 1;
    const card = el('div', { class: 'play-card an-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'an-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} webanalytics contract invariants hold`;
  return pass;
}

function main(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  const conformance = el('section', { class: 'an-card' });
  conformance.append(el('h2', {}, 'Runtime conformance — contract + registry swap'));
  const passCount = runConformance(conformance);
  root.append(conformance);

  setPlaygroundReady(passCount);
}

main();
