/**
 * Stable-id observable events (#1111, webvalidation completion #1090) — `validation.control.*`.
 *
 * Asserts the spec event surface (njk:184-196) fires with the correct detail: `validity-changed` +
 * `became-valid`/`became-invalid` on a `<validity-merge-field>` validity transition, `value-input` on a
 * control edit, and `validate-start`/`validate-end` (with source/version/result) on an
 * `<async-validator-field>` run. The legacy `validity-merge` event is asserted to still fire alongside.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import ValidityMergeField from '../ValidityMergeField';
import AsyncValidatorField, { type AsyncSourceTarget } from '../AsyncValidatorField';
import { createDefaultValidityMergeRegistry } from '../CustomValidityMergeRegistry';
import { createDefaultValidatorResolutionRegistry } from '../CustomValidatorResolutionRegistry';
import type { SourceUpdate } from '../../../validity-merge/registry.js';
import type { AsyncResult } from '../../../validator-resolution/provider.js';

beforeAll(() => {
  (HTMLElement.prototype as unknown as { attachInternals: () => ElementInternals }).attachInternals =
    function attachInternals(): ElementInternals {
      return { setValidity() {} } as unknown as ElementInternals;
    };
  if (!customElements.get('validity-merge-field')) customElements.define('validity-merge-field', ValidityMergeField);
  if (!customElements.get('async-validator-field')) customElements.define('async-validator-field', AsyncValidatorField);
});

beforeEach(() => {
  window.customValidityMerge = createDefaultValidityMergeRegistry();
  window.customValidatorResolution = createDefaultValidatorResolutionRegistry();
});

/** Record every `validation.control.*` event a node emits. */
function recordControlEvents(el: HTMLElement): Array<{ type: string; detail: any }> {
  const seen: Array<{ type: string; detail: any }> = [];
  const names = [
    'value-input', 'focus', 'blur', 'validity-changed', 'became-valid', 'became-invalid',
    'validate-start', 'validate-end',
  ];
  for (const n of names) el.addEventListener(`validation.control.${n}`, (e) => seen.push({ type: n, detail: (e as CustomEvent).detail }));
  return seen;
}

describe('validation.control.* stable-id events on <validity-merge-field>', () => {
  it('fires validity-changed + became-invalid on a transition to invalid, with the merged detail', () => {
    const el = document.createElement('validity-merge-field') as ValidityMergeField;
    const events = recordControlEvents(el);
    const legacy: unknown[] = [];
    el.addEventListener('validity-merge', (e) => legacy.push((e as CustomEvent).detail));

    el.setSource('manual', { state: 'invalid', message: 'Taken' });

    const changed = events.find((e) => e.type === 'validity-changed');
    expect(changed).toBeTruthy();
    expect(changed!.detail.merged.state).toBe('invalid');
    expect(events.some((e) => e.type === 'became-invalid')).toBe(true);
    // Legacy validity-merge event still fires alongside the stable-id one.
    expect(legacy.length).toBe(1);
  });

  it('fires became-valid when crossing to valid, and validity-changed only on a real transition', () => {
    const el = document.createElement('validity-merge-field') as ValidityMergeField;
    const events = recordControlEvents(el);

    el.setSource('manual', { state: 'invalid', message: 'x' }); // → invalid
    el.setSource('manual', { state: 'valid' }); // → valid (crossing)
    el.setSource('manual', { state: 'valid' }); // no transition (idempotent)

    expect(events.filter((e) => e.type === 'became-valid').length).toBe(1);
    expect(events.filter((e) => e.type === 'became-invalid').length).toBe(1);
    // validity-changed fired exactly twice: idle→invalid and invalid→valid, not on the repeat.
    expect(events.filter((e) => e.type === 'validity-changed').length).toBe(2);
  });

  it('fires value-input on a control input event', () => {
    const el = document.createElement('validity-merge-field') as ValidityMergeField;
    el.innerHTML = '<input type="text">';
    const events = recordControlEvents(el);
    document.body.appendChild(el); // connectedCallback wires the control listeners
    try {
      const input = el.querySelector('input')!;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const vi = events.find((e) => e.type === 'value-input');
      expect(vi).toBeTruthy();
      expect(vi!.detail.type).toBe('input');
    } finally {
      el.remove();
    }
  });
});

describe('validation.control.validate-start / validate-end on <async-validator-field>', () => {
  function makeTarget(): AsyncSourceTarget {
    return { setSource: (_s, u) => u, clearSource: () => undefined };
  }

  it('fires validate-start then validate-end with source/version/result', async () => {
    const el = document.createElement('async-validator-field') as AsyncValidatorField;
    el.useTargetField(makeTarget());
    const events = recordControlEvents(el);
    let resolveFn!: (r: AsyncResult) => void;
    el.useValidator(() => new Promise<AsyncResult>((res) => { resolveFn = res; }));

    const p = el.validate('foo@bar.com');
    const start = events.find((e) => e.type === 'validate-start');
    expect(start).toEqual({ type: 'validate-start', detail: { source: 'async', version: 1 } });

    resolveFn({ state: 'valid' });
    await p;
    const end = events.find((e) => e.type === 'validate-end');
    expect(end!.detail).toMatchObject({ source: 'async', version: 1, result: 'valid' });
  });

  it('reports a superseded generation as a stale result at validate-end', async () => {
    const el = document.createElement('async-validator-field') as AsyncValidatorField;
    el.useTargetField(makeTarget());
    const events = recordControlEvents(el);
    const resolvers: Array<(r: AsyncResult) => void> = [];
    el.useValidator(() => new Promise<AsyncResult>((res) => resolvers.push(res)));

    const p1 = el.validate('a'); // version 1
    const p2 = el.validate('b'); // version 2 supersedes 1
    resolvers[0]({ state: 'invalid' }); // first generation resolves but is stale
    resolvers[1]({ state: 'valid' });
    await Promise.all([p1, p2]);

    const ends = events.filter((e) => e.type === 'validate-end');
    expect(ends.find((e) => e.detail.version === 2)?.detail.result).toBe('valid');
    // The superseded run reports stale (the runner dropped it — resolved to null).
    expect(ends.some((e) => e.detail.result === 'stale')).toBe(true);
  });
});
