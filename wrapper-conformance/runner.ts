/**
 * Behavioral wrapper conformance runner (#891). A headless-DOM harness that drives a candidate wrapper
 * against the {@link WrapperVector} corpus and checks the five contract behaviours. It is
 * generator-AGNOSTIC: it never imports or assumes a generator — the wrapper-under-test plugs in via a
 * thin {@link WrapperSubject} adapter (one per framework: React, Vue, …). FUI owns the generator and
 * its per-framework subjects; WE owns this runner + the vectors (the #855 B2 boundary). Mirrors the
 * #506 MaaS golden-vectors *runner* — the gate that makes any generation mechanism safe.
 */
import type { WrapperVector } from './vectors.js';

/** One asserted behaviour and its outcome. */
export interface CheckResult {
  label: string;
  ok: boolean;
  detail?: string;
}

/** The result of driving one vector through a subject. */
export interface VectorReport {
  vector: string;
  passed: boolean;
  checks: CheckResult[];
}

/** The aggregate over a corpus run. */
export interface ConformanceReport {
  passed: boolean;
  reports: VectorReport[];
}

/**
 * A wrapper-under-test. The runner asks the subject to render the wrapper for a vector — assigning the
 * vector's string attributes and rich properties and wiring the supplied event handlers — and to return
 * the host custom element it produced (or `null` if it rendered none). A framework binding implements
 * this once (e.g. mount a React element into `container` and return `container.firstElementChild`).
 */
export interface WrapperSubject {
  render(opts: {
    container: HTMLElement;
    vector: WrapperVector;
    /** Keyed by the vector's `handlerProp`; the wrapper must invoke the matching handler on each event. */
    handlers: Record<string, (e: Event) => void>;
  }): Element | null;
  /** Optional teardown between vectors (unmount / detach). */
  cleanup?(): void;
}

/** Structural deep-equality good enough for vector property payloads (plain JSON-shaped values). */
const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/**
 * Drive one vector through a subject and report each behaviour. Pure w.r.t. the subject: it creates a
 * detached container, renders, dispatches events, and reads the resulting DOM — no global state.
 */
export function runVector(subject: WrapperSubject, vector: WrapperVector): VectorReport {
  const checks: CheckResult[] = [];
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Record handler invocations so the event-bridge behaviour is observable.
  const calls: Record<string, Event[]> = {};
  const handlers: Record<string, (e: Event) => void> = {};
  for (const ev of vector.events ?? []) {
    calls[ev.handlerProp] = [];
    handlers[ev.handlerProp] = (e: Event) => calls[ev.handlerProp].push(e);
  }

  let host: Element | null = null;
  try {
    host = subject.render({ container, vector, handlers });
  } catch (e) {
    checks.push({ label: 'renders the host element', ok: false, detail: `render threw: ${(e as Error).message}` });
    finish(subject, container);
    return { vector: vector.name, passed: false, checks };
  }

  // 1 — renders the host custom element.
  const renderedTag = host?.tagName?.toLowerCase();
  const rendersTag = !!host && renderedTag === vector.tagName;
  checks.push({
    label: `renders <${vector.tagName}>`,
    ok: rendersTag,
    detail: rendersTag ? undefined : `got ${host ? `<${renderedTag}>` : 'no element'}`,
  });

  if (host) {
    // 2 — string attributes forwarded verbatim.
    for (const [name, value] of Object.entries(vector.attributes ?? {})) {
      const got = host.getAttribute(name);
      checks.push({
        label: `forwards attribute ${name}="${value}"`,
        ok: got === value,
        detail: got === value ? undefined : `getAttribute returned ${JSON.stringify(got)}`,
      });
    }

    // 3 — rich properties assigned as DOM properties, NOT serialized to an attribute.
    for (const [name, value] of Object.entries(vector.properties ?? {})) {
      const assigned = sameValue((host as Record<string, unknown>)[name], value);
      const notSerialized = host.getAttribute(name) === null;
      checks.push({
        label: `assigns property ${name} (as a property, not an attribute)`,
        ok: assigned && notSerialized,
        detail: assigned
          ? notSerialized
            ? undefined
            : `property serialized to attribute ${name}=${JSON.stringify(host.getAttribute(name))}`
          : `property not assigned (el.${name} = ${JSON.stringify((host as Record<string, unknown>)[name])})`,
      });
    }

    // 5 — slotted children projected into the host's light DOM.
    for (const slot of vector.slots ?? []) {
      const inHost = host.innerHTML.includes(slot.html);
      const targetOk = slot.name
        ? !!host.querySelector(`[slot="${slot.name}"]`)
        : true;
      checks.push({
        label: `projects ${slot.name ? `slot="${slot.name}"` : 'default slot'}`,
        ok: inHost && targetOk,
        detail: inHost ? (targetOk ? undefined : `no element carries slot="${slot.name}"`) : 'slotted markup absent',
      });
    }

    // 4 — host CustomEvents bridged to handler props with the detail intact.
    for (const ev of vector.events ?? []) {
      host.dispatchEvent(new CustomEvent(ev.event, { detail: ev.detail, bubbles: true }));
      const received = calls[ev.handlerProp] ?? [];
      const firedOnce = received.length === 1;
      const detailOk = firedOnce && sameValue((received[0] as CustomEvent).detail, ev.detail);
      checks.push({
        label: `bridges ${ev.event} → ${ev.handlerProp}`,
        ok: firedOnce && detailOk,
        detail: firedOnce
          ? detailOk
            ? undefined
            : 'handler called but detail differs'
          : `handler called ${received.length}× (expected 1)`,
      });
    }
  }

  finish(subject, container);
  return { vector: vector.name, passed: checks.every((c) => c.ok), checks };
}

function finish(subject: WrapperSubject, container: HTMLElement): void {
  try {
    subject.cleanup?.();
  } finally {
    container.remove();
  }
}

/** Drive an entire corpus through a subject. `passed` is true only when every vector passes. */
export function runVectors(subject: WrapperSubject, vectors: WrapperVector[]): ConformanceReport {
  const reports = vectors.map((v) => runVector(subject, v));
  return { passed: reports.every((r) => r.passed), reports };
}
