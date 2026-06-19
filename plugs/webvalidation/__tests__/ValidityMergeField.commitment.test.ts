/**
 * `<validity-merge-field>` commitment-staleness reflection (#1113): the field resolves a commitment policy
 * per-scope and reflects data-committed + the staleness observables (data-validation-sync / -generation /
 * -timestamp, spec njk:198-206). The load-bearing case: a deferred field shows `stale` after a value edit,
 * then `current` once validation settles. happy-dom provides the element + events (attachInternals
 * polyfilled like the sibling dataAttrs test).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import ValidityMergeField from '../ValidityMergeField';
import { createDefaultValidityMergeRegistry } from '../CustomValidityMergeRegistry';
import { createDefaultCommitmentPolicyRegistry } from '../CustomCommitmentPolicyRegistry';

beforeAll(() => {
  (HTMLElement.prototype as unknown as { attachInternals: () => ElementInternals }).attachInternals =
    function attachInternals(): ElementInternals {
      return { setValidity() {} } as unknown as ElementInternals;
    };
  if (!customElements.get('validity-merge-field')) {
    customElements.define('validity-merge-field', ValidityMergeField);
  }
});

afterAll(() => {
  delete (HTMLElement.prototype as unknown as { attachInternals?: unknown }).attachInternals;
});

beforeEach(() => {
  window.customValidityMerge = createDefaultValidityMergeRegistry();
  window.customCommitmentPolicy = createDefaultCommitmentPolicyRegistry();
});

function mountField(commitment?: string): { field: ValidityMergeField; input: HTMLInputElement } {
  const field = document.createElement('validity-merge-field') as ValidityMergeField;
  if (commitment) field.setAttribute('commitment', commitment);
  const input = document.createElement('input');
  field.append(input);
  document.body.append(field);
  return { field, input };
}

describe('<validity-merge-field> commitment staleness (#1113)', () => {
  it('reflects the resolved commitment policy as data-committed (default = full)', () => {
    const { field } = mountField();
    expect(field.getAttribute('data-committed')).toBe('full');
  });

  it('resolves the named commitment policy per the commitment attribute', () => {
    const { field } = mountField('deferred');
    expect(field.getAttribute('data-committed')).toBe('deferred');
  });

  it('a deferred field shows STALE after a value edit, then CURRENT once validity settles', () => {
    const { field, input } = mountField('deferred');
    // Initially current, generation 0.
    expect(field.getAttribute('data-validation-sync')).toBe('current');
    expect(field.getAttribute('data-validation-generation')).toBe('0');

    // A value edit bumps the generation and marks the displayed validation stale.
    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    expect(field.getAttribute('data-validation-sync')).toBe('stale');
    expect(Number(field.getAttribute('data-validation-generation'))).toBeGreaterThanOrEqual(1);

    // Settle validity (feed a settled native source) → the field becomes current again.
    field.setSource('schema', { state: 'valid' });
    expect(field.getAttribute('data-validation-sync')).toBe('current');
    expect(field.getAttribute('data-validation-timestamp')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('is a no-op (still works) when no commitment registry is in scope', () => {
    window.customCommitmentPolicy = undefined;
    const { field } = mountField('deferred');
    expect(field.hasAttribute('data-committed')).toBe(false);
    // The merge plane still works.
    expect(() => field.setSource('schema', { state: 'valid' })).not.toThrow();
  });
});
