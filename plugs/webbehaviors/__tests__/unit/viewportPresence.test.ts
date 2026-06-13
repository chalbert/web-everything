/**
 * @file viewportPresence.test.ts
 * @description Unit tests for the shared viewport-presence trigger (#320/#321) — the one home both
 *   the prefetch behavior and the visibility-gated trait compose. Proves option-defaulting, the
 *   enter/leave dispatch routing, and the no-IntersectionObserver null fallback.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createViewportPresenceObserver } from '../../viewportPresence';

/** A controllable IntersectionObserver stub — captures its options + callback so a test can fire records. */
class FakeIO {
  static instances: FakeIO[] = [];
  cb: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observed: Element[] = [];
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.cb = cb;
    this.options = options;
    FakeIO.instances.push(this);
  }
  observe(el: Element) { this.observed.push(el); }
  unobserve() {}
  disconnect() {}
  /** Simulate the browser delivering records. */
  fire(records: Array<Partial<IntersectionObserverEntry>>) {
    this.cb(records as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

describe('createViewportPresenceObserver', () => {
  const realIO = (globalThis as any).IntersectionObserver;

  beforeEach(() => {
    FakeIO.instances = [];
    (globalThis as any).IntersectionObserver = FakeIO as unknown as typeof IntersectionObserver;
  });
  afterEach(() => {
    (globalThis as any).IntersectionObserver = realIO;
  });

  it('applies the native option defaults (root null, rootMargin 0px, threshold 0)', () => {
    createViewportPresenceObserver({});
    expect(FakeIO.instances[0].options).toEqual({ root: null, rootMargin: '0px', threshold: 0 });
  });

  it('passes through caller overrides (e.g. prefetch rootMargin)', () => {
    createViewportPresenceObserver({ rootMargin: '50px', threshold: [0, 1] });
    expect(FakeIO.instances[0].options).toMatchObject({ rootMargin: '50px', threshold: [0, 1] });
  });

  it('routes an intersecting record to onEnter and a non-intersecting one to onLeave', () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const obs = createViewportPresenceObserver({ onEnter, onLeave })!;
    (obs as unknown as FakeIO).fire([{ isIntersecting: true }, { isIntersecting: false }]);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('is enter-only safe — a leave record with no onLeave does not throw', () => {
    const onEnter = vi.fn();
    const obs = createViewportPresenceObserver({ onEnter })!;
    expect(() => (obs as unknown as FakeIO).fire([{ isIntersecting: false }])).not.toThrow();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('hands onEnter the entry and the observer', () => {
    const onEnter = vi.fn();
    const obs = createViewportPresenceObserver({ onEnter })!;
    const entry = { isIntersecting: true, target: document.createElement('div') };
    (obs as unknown as FakeIO).fire([entry]);
    expect(onEnter).toHaveBeenCalledWith(entry, obs);
  });

  it('returns null when IntersectionObserver is unavailable (caller owns the no-IO fallback)', () => {
    (globalThis as any).IntersectionObserver = undefined;
    expect(createViewportPresenceObserver({ onEnter: () => {} })).toBeNull();
  });
});
