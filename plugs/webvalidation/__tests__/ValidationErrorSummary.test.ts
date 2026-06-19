/**
 * `<validation-error-summary>` element tests (#1114) — the GOV.UK error summary. Proves the slice-2
 * control-event wiring (became-invalid adds, became-valid removes), DOM-ordered rendering, role=alert,
 * focus-on-blocked, and the entry→field focus link. happy-dom provides the elements + events.
 *
 * The demo case: a submit with 2 invalid fields lists both; clicking an entry focuses its field.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import ValidationErrorSummary from '../ValidationErrorSummary';

beforeAll(() => {
  if (!customElements.get('validation-error-summary')) {
    customElements.define('validation-error-summary', ValidationErrorSummary);
  }
});

beforeEach(() => {
  document.body.innerHTML = '';
});

function invalidEvent(message: string) {
  return new CustomEvent('validation.control.became-invalid', {
    detail: { merged: { messages: [{ source: 'native', message }] } },
    bubbles: true,
  });
}

function setup() {
  const form = document.createElement('form');
  const summary = document.createElement('validation-error-summary') as ValidationErrorSummary;
  const fieldA = document.createElement('div');
  fieldA.id = 'field-a';
  const inputA = document.createElement('input');
  fieldA.append(inputA);
  const fieldB = document.createElement('div');
  fieldB.id = 'field-b';
  const inputB = document.createElement('input');
  fieldB.append(inputB);
  form.append(summary, fieldA, fieldB);
  document.body.append(form);
  return { form, summary, fieldA, fieldB, inputA, inputB };
}

describe('<validation-error-summary> (#1114)', () => {
  it('is role=alert and hidden when empty', () => {
    const { summary } = setup();
    expect(summary.getAttribute('role')).toBe('alert');
    expect(summary.hidden).toBe(true);
  });

  it('lists both fields on a submit with 2 invalid fields (the demo)', () => {
    const { summary, fieldA, fieldB } = setup();
    fieldB.dispatchEvent(invalidEvent('B is required'));
    fieldA.dispatchEvent(invalidEvent('A is required'));
    expect(summary.hidden).toBe(false);
    const items = summary.querySelectorAll('li a');
    expect(items).toHaveLength(2);
    // DOM-ordered: field-a appears before field-b in the document, so A leads despite later insertion.
    expect(items[0].textContent).toContain('A is required');
    expect(items[1].textContent).toContain('B is required');
  });

  it('removes an entry when its field becomes valid', () => {
    const { summary, fieldA, fieldB } = setup();
    fieldA.dispatchEvent(invalidEvent('A bad'));
    fieldB.dispatchEvent(invalidEvent('B bad'));
    fieldA.dispatchEvent(new CustomEvent('validation.control.became-valid', { detail: {}, bubbles: true }));
    expect(summary.querySelectorAll('li a')).toHaveLength(1);
    expect(summary.textContent).toContain('B bad');
  });

  it('clicking an entry focuses the linked field control', () => {
    const { summary, fieldA, inputA } = setup();
    fieldA.dispatchEvent(invalidEvent('A bad'));
    const link = summary.querySelector('li a') as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(inputA);
  });

  it('moves focus to the summary on submit-blocked', () => {
    const { summary, fieldA } = setup();
    fieldA.dispatchEvent(invalidEvent('A bad'));
    summary.dispatchEvent(new CustomEvent('validation.form.submit-blocked', { detail: {}, bubbles: true }));
    expect(document.activeElement).toBe(summary);
  });
});
