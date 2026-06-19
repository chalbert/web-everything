/**
 * `<validity-merge-field>` L1 observable data-* reflection (#1110): merged validity → data-validity /
 * data-severity, and interaction state → data-dirty / data-touched / data-focused. happy-dom provides
 * the element + events (attachInternals polyfilled like the sibling test); this is the in-DOM analogue
 * of the spec's "data-* flip on input" e2e, which native :user-invalid styling can't be modeled by JSDOM.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import ValidityMergeField from '../ValidityMergeField';
import { createDefaultValidityMergeRegistry } from '../CustomValidityMergeRegistry';

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
});

function mountField(): { field: ValidityMergeField; input: HTMLInputElement } {
  const field = document.createElement('validity-merge-field') as ValidityMergeField;
  const input = document.createElement('input');
  field.append(input);
  document.body.append(field); // connectedCallback wires listeners + interaction tracking
  return { field, input };
}

describe('data-* interaction reflection', () => {
  it('reflects dirty + touched on input', () => {
    const { field, input } = mountField();
    expect(field.getAttribute('data-dirty')).toBe('false');
    expect(field.getAttribute('data-touched')).toBe('false');

    input.value = 'x';
    input.dispatchEvent(new Event('input'));

    expect(field.getAttribute('data-dirty')).toBe('true');
    expect(field.getAttribute('data-touched')).toBe('true');
  });

  it('reflects focused on focus/blur', () => {
    const { field, input } = mountField();
    input.dispatchEvent(new Event('focus'));
    expect(field.getAttribute('data-focused')).toBe('true');
    input.dispatchEvent(new Event('blur'));
    expect(field.getAttribute('data-focused')).toBe('false');
  });
});

describe('data-* validity reflection', () => {
  it('reflects an invalid merged state as data-validity=invalid + data-severity=error', () => {
    const { field } = mountField();
    field.setSource('manual', { state: 'invalid', message: 'No' });
    expect(field.getAttribute('data-validity')).toBe('invalid');
    expect(field.getAttribute('data-severity')).toBe('error');
  });

  it('reflects a pending state as data-validity=pending + data-severity=info', () => {
    const { field } = mountField();
    field.setSource('async', { state: 'pending' });
    expect(field.getAttribute('data-validity')).toBe('pending');
    expect(field.getAttribute('data-severity')).toBe('info');
  });

  it('reflects a valid state as data-validity=valid and clears data-severity', () => {
    const { field } = mountField();
    field.setSource('manual', { state: 'valid' });
    expect(field.getAttribute('data-validity')).toBe('valid');
    expect(field.hasAttribute('data-severity')).toBe(false);
  });
});
