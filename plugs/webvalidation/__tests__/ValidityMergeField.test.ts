/**
 * `<validity-merge-field>` (#215): the form-associated control resolves its strategy per-scope,
 * feeds named sources to the orchestrator, and pushes every merged result onto the platform via
 * `ElementInternals.setValidity`.
 *
 * happy-dom has no `attachInternals`, so we polyfill a recording stub — enough to exercise the
 * element's real resolution / recompute / event logic without a live form-associated element (the
 * demo + e2e prove the native `:user-invalid` styling, which no JS-DOM can model anyway).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import ValidityMergeField from '../ValidityMergeField';
import { createDefaultValidityMergeRegistry } from '../CustomValidityMergeRegistry';
import type { MergedValidity } from '../../../validity-merge/provider.js';

const setValidityCalls: Array<[ValidityStateFlags, string | undefined, HTMLElement | undefined]> = [];

beforeAll(() => {
  // Minimal ElementInternals stub: records setValidity calls, nothing else.
  (HTMLElement.prototype as unknown as { attachInternals: () => ElementInternals }).attachInternals =
    function attachInternals(): ElementInternals {
      return {
        setValidity(flags: ValidityStateFlags, message?: string, anchor?: HTMLElement) {
          setValidityCalls.push([flags, message, anchor]);
        },
      } as unknown as ElementInternals;
    };
  if (!customElements.get('validity-merge-field')) {
    customElements.define('validity-merge-field', ValidityMergeField);
  }
});

afterAll(() => {
  delete (HTMLElement.prototype as unknown as { attachInternals?: unknown }).attachInternals;
});

beforeEach(() => {
  setValidityCalls.length = 0;
  // The element falls back to the global registry when no injector scope provides one.
  window.customValidityMerge = createDefaultValidityMergeRegistry();
});

function makeField(strategy?: string): ValidityMergeField {
  const el = document.createElement('validity-merge-field') as ValidityMergeField;
  if (strategy) el.setAttribute('strategy', strategy);
  return el;
}

describe('<validity-merge-field>', () => {
  it('resolves the default strategy from the global registry and drives setValidity', () => {
    const el = makeField();
    const merged = el.setSource('manual', { state: 'invalid', message: 'Email already taken' });
    expect(merged.state).toBe('invalid');
    expect(el.merged?.state).toBe('invalid');
    expect(setValidityCalls.at(-1)).toEqual([{ customError: true }, 'Email already taken', undefined]);
  });

  it('source-reduction is strictest-wins: a pending source beats valid ones', () => {
    const el = makeField();
    el.setSource('native', { state: 'valid' });
    const merged = el.setSource('async', { state: 'pending' });
    expect(merged.state).toBe('pending');
    expect(setValidityCalls.at(-1)).toEqual([{ customError: true }, 'Validating…', undefined]);
  });

  it('clearing a source recomputes (a cleared async check drops back to valid)', () => {
    const el = makeField();
    el.setSource('native', { state: 'valid' });
    el.setSource('async', { state: 'pending' });
    const merged = el.clearSource('async');
    expect(merged.state).toBe('valid');
    expect(setValidityCalls.at(-1)).toEqual([{}, undefined, undefined]);
  });

  it('dispatches a bubbling validity-merge event carrying the merged result', () => {
    const el = makeField();
    const onMerge = vi.fn();
    el.addEventListener('validity-merge', (e) => onMerge((e as CustomEvent<MergedValidity>).detail));
    el.setSource('manual', { state: 'invalid', message: 'No' });
    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onMerge.mock.calls[0][0].state).toBe('invalid');
  });

  it('useStrategy swaps the merge policy with no source-feeding edits', () => {
    const el = makeField();
    el.setSource('native', { state: 'invalid', message: 'Native says no' });
    const before = el.setSource('manual', { state: 'valid' });
    expect(before.state).toBe('invalid'); // source-reduction: any invalid fails

    el.useStrategy('last-write-wins');
    // Re-resolving recomputes over the same sources; last write ('manual' valid) wins.
    expect(el.merged?.state).toBe('valid');
    expect(setValidityCalls.at(-1)).toEqual([{}, undefined, undefined]);
  });

  it('honours the strategy attribute on first resolution', () => {
    const el = makeField('last-write-wins');
    el.setSource('native', { state: 'invalid', message: 'no' });
    const merged = el.setSource('manual', { state: 'valid' });
    expect(merged.state).toBe('valid'); // last-write-wins, not strictest
  });

  it('throws a clear error when no registry is in scope or on window', () => {
    delete (window as { customValidityMerge?: unknown }).customValidityMerge;
    const el = makeField();
    expect(() => el.setSource('manual', { state: 'valid' })).toThrow(/no customValidityMerge registry/);
  });

  it('anchors setValidity to an inner form control when present', () => {
    const el = makeField();
    const input = document.createElement('input');
    el.appendChild(input);
    el.setSource('manual', { state: 'invalid', message: 'bad' });
    expect(setValidityCalls.at(-1)).toEqual([{ customError: true }, 'bad', input]);
  });
});

describe('<validity-merge-field> — native source auto-derive (#218)', () => {
  const mounted: HTMLElement[] = [];

  function mount(input: HTMLInputElement, strategy?: string): { el: ValidityMergeField; input: HTMLInputElement } {
    const el = makeField(strategy);
    el.appendChild(input);
    document.body.appendChild(el); // triggers connectedCallback → wires + derives
    mounted.push(el);
    return { el, input };
  }

  function requiredEmpty(): HTMLInputElement {
    const i = document.createElement('input');
    i.required = true;
    return i;
  }

  afterEach(() => {
    while (mounted.length) mounted.pop()!.remove();
  });

  it('stays idle until the control is touched, then derives invalid from ValidityState', () => {
    const { el, input } = mount(requiredEmpty());
    expect(el.merged?.state).toBe('idle'); // connected but untouched → no premature failure

    input.dispatchEvent(new Event('input')); // interaction → read validity
    expect(el.merged?.state).toBe('invalid');
    expect(el.merged?.blocking).toBe('native');
  });

  it('derives valid once a constraint is satisfied', () => {
    const input = document.createElement('input');
    input.type = 'email';
    input.value = 'a@b.com';
    const { el } = mount(input);
    input.dispatchEvent(new Event('input'));
    expect(el.merged?.state).toBe('valid');
  });

  it('the auto-derived native participates in the merge with the manually-fed sources', () => {
    const input = document.createElement('input');
    input.type = 'email';
    input.value = 'a@b.com';
    const { el } = mount(input);
    input.dispatchEvent(new Event('input')); // native → valid
    const merged = el.setSource('manual', { state: 'invalid', message: 'Email already taken' });
    expect(merged.state).toBe('invalid'); // source-reduction: any invalid fails
    expect(merged.blocking).toBe('manual'); // native is valid, manual blocks
  });

  it('an explicit setSource("native") wins over the auto-derive', () => {
    const { el, input } = mount(requiredEmpty());
    el.setSource('native', { state: 'valid' }); // hand-fed despite the empty required control
    input.dispatchEvent(new Event('input')); // would derive invalid — but manual is in force
    expect(el.merged?.state).toBe('valid');
  });

  it('clearSource("native") releases the hand-off and resumes auto-deriving', () => {
    const { el, input } = mount(requiredEmpty());
    el.setSource('native', { state: 'valid' });
    input.dispatchEvent(new Event('input')); // suppressed (manual wins)
    expect(el.merged?.state).toBe('valid');

    const merged = el.clearSource('native'); // resume auto-derive; control is touched + invalid
    expect(merged.state).toBe('invalid');
    expect(merged.blocking).toBe('native');
  });
});
