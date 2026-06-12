import { describe, it, expect, beforeEach } from 'vitest';
import { renderDecisionTrace, decisionTraceHTML, type DecisionRecord } from '../../../renderers/decision-trace/renderDecisionTrace';

const record: DecisionRecord = {
  subject: { type: 'loan', id: 'L-1042' },
  ruleSet: { id: 'aus', version: '2026.06.0' },
  outcome: 'refer',
  reasonCodes: ['DTI-HIGH'],
  criteria: [
    { id: 'dti', label: 'Back-end DTI', input: { name: 'backEndDTI', value: 0.49 }, operator: 'lte', threshold: 0.43, outcome: 'refer', reasonCode: 'DTI-HIGH' },
    { id: 'fico', label: 'Credit score', input: { name: 'fico', value: 712 }, operator: 'gte', threshold: 620, outcome: 'pass' },
    { id: 'ltv', label: 'LTV', input: { name: 'ltv', value: 0.95 }, operator: 'lte', threshold: 0.97, outcome: 'pass' },
  ],
};

describe('renderDecisionTrace', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders a labelled section, the ruleset version, and a row per criterion', () => {
    const el = renderDecisionTrace(record);
    expect(el.getAttribute('aria-label')).toContain('loan L-1042');
    expect(el.textContent).toContain('rule set aus v2026.06.0'); // reproducibility surfaced
    expect(el.querySelectorAll('.dt-row').length).toBe(3);
    expect(el.querySelector('.dt-reasons')?.textContent).toContain('DTI-HIGH');
  });

  it('composes the status-indicator block for the outcome + each criterion', () => {
    const el = renderDecisionTrace(record);
    // header outcome chip (pill) + one dot chip per criterion
    expect(el.querySelector('.dt-head .status-indicator.status-pill')).toBeTruthy();
    expect(el.querySelectorAll('.dt-row .status-indicator').length).toBe(3);
    // default tone heuristic: refer → caution, pass → positive
    expect(el.querySelector('.dt-head .status-indicator')?.className).toContain('tone-caution');
  });

  it('default tone heuristic: "ineligible" is critical, not positive (no "eligible" substring trap)', () => {
    const el = renderDecisionTrace({ ...record, outcome: 'ineligible' });
    expect(el.querySelector('.dt-head .status-indicator')?.className).toContain('tone-critical');
    const ok = renderDecisionTrace({ ...record, outcome: 'approve-eligible' });
    expect(ok.querySelector('.dt-head .status-indicator')?.className).toContain('tone-positive');
  });

  it('emphasis "deciding" shows only the non-pass criteria', () => {
    const el = renderDecisionTrace(record, { emphasis: 'deciding' });
    expect(el.querySelectorAll('.dt-row').length).toBe(1); // only the DTI refer
    expect(el.textContent).toContain('Back-end DTI');
    expect(el.textContent).not.toContain('Credit score');
  });

  it('layout "list" renders items instead of a table', () => {
    const el = renderDecisionTrace(record, { layout: 'list' });
    expect(el.querySelector('.dt-table')).toBeNull();
    expect(el.querySelectorAll('.dt-item').length).toBe(3);
  });

  it('escapes user values (kept as text, never live markup) and exposes a string form', () => {
    const evil: DecisionRecord = { ...record, criteria: [{ id: 'x', label: '<b>x</b>', input: { name: 'n', value: '<i>v</i>' }, operator: 'eq', threshold: 1, outcome: 'pass' }] };
    const el = renderDecisionTrace(evil);
    const cell = el.querySelector('.dt-row td');
    expect(cell?.textContent).toBe('<b>x</b>');     // preserved as text…
    expect(el.querySelector('.dt-row td b')).toBeNull(); // …not parsed into a live <b> element
    expect(decisionTraceHTML(evil).startsWith('<section')).toBe(true);
  });
});
