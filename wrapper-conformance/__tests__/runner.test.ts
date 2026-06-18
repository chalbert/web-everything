/**
 * Proves the #891 runner both PASSES a conformant wrapper and DETECTS non-conformance — using
 * hand-written reference subjects (no generator, no framework dep), so the runner itself is the thing
 * under test. The conformant subject mimics what a correct generated React/Vue wrapper does to the host
 * element; the broken subjects each violate one contract behaviour.
 */
import { describe, it, expect } from 'vitest';
import { WRAPPER_VECTORS } from '../vectors.js';
import { runVector, runVectors, type WrapperSubject } from '../runner.js';

/** A reference wrapper that satisfies the full contract: forwards attrs, assigns props, wires events, projects slots. */
const conformant: WrapperSubject = {
  render({ container, vector, handlers }) {
    const el = document.createElement(vector.tagName);
    for (const [k, v] of Object.entries(vector.attributes ?? {})) el.setAttribute(k, v);
    for (const [k, v] of Object.entries(vector.properties ?? {})) (el as Record<string, unknown>)[k] = v;
    for (const ev of vector.events ?? []) el.addEventListener(ev.event, (e) => handlers[ev.handlerProp]?.(e));
    for (const slot of vector.slots ?? []) {
      if (slot.name) {
        const w = document.createElement('div');
        w.setAttribute('slot', slot.name);
        w.innerHTML = slot.html;
        el.appendChild(w);
      } else {
        el.insertAdjacentHTML('beforeend', slot.html);
      }
    }
    container.appendChild(el);
    return el;
  },
};

describe('runVectors — a conformant wrapper passes the whole corpus', () => {
  const report = runVectors(conformant, WRAPPER_VECTORS);

  it('passes every vector', () => {
    const failed = report.reports.filter((r) => !r.passed);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('emits at least one check per vector', () => {
    for (const r of report.reports) expect(r.checks.length).toBeGreaterThan(0);
  });
});

describe('runVector — detects each non-conformance', () => {
  it('fails when a rich property is serialized to an attribute instead of assigned', () => {
    const broken: WrapperSubject = {
      render({ container, vector }) {
        const el = document.createElement(vector.tagName);
        // WRONG: serialize the property to an attribute (the classic incorrect-wrapper bug).
        for (const [k, v] of Object.entries(vector.properties ?? {})) el.setAttribute(k, JSON.stringify(v));
        container.appendChild(el);
        return el;
      },
    };
    const r = runVector(broken, WRAPPER_VECTORS.find((v) => v.name === 'rich-property-assigned')!);
    expect(r.passed).toBe(false);
    expect(r.checks.some((c) => /assigns property/.test(c.label) && !c.ok)).toBe(true);
  });

  it('fails when the host event is not bridged to the handler prop', () => {
    const broken: WrapperSubject = {
      render({ container, vector }) {
        const el = document.createElement(vector.tagName); // no event wiring
        container.appendChild(el);
        return el;
      },
    };
    const r = runVector(broken, WRAPPER_VECTORS.find((v) => v.name === 'event-bridged')!);
    expect(r.passed).toBe(false);
    expect(r.checks.some((c) => /bridges/.test(c.label) && !c.ok)).toBe(true);
  });

  it('fails when the wrong tag is rendered', () => {
    const broken: WrapperSubject = {
      render({ container }) {
        const el = document.createElement('div');
        container.appendChild(el);
        return el;
      },
    };
    const r = runVector(broken, WRAPPER_VECTORS.find((v) => v.name === 'attributes-forwarded')!);
    expect(r.passed).toBe(false);
    expect(r.checks[0].label).toMatch(/renders </);
    expect(r.checks[0].ok).toBe(false);
  });

  it('fails gracefully when render throws', () => {
    const broken: WrapperSubject = {
      render() {
        throw new Error('boom');
      },
    };
    const r = runVector(broken, WRAPPER_VECTORS[0]);
    expect(r.passed).toBe(false);
    expect(r.checks[0].detail).toMatch(/render threw/);
  });
});
