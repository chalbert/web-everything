import { describe, it, expect, beforeEach } from 'vitest';
import { renderAuditTimeline, auditTimelineHTML } from '../../../renderers/audit-timeline/renderAuditTimeline';
import type { AuditEvent } from '../../../audit/AuditProvider';

const evs: AuditEvent[] = [
  { target: { type: 'loan', id: 'L1' }, action: 'created', actor: { role: 'system' }, at: '2026-06-11T09:00:00Z' },
  { target: { type: 'loan', id: 'L1' }, action: 'lifecycle.transition', actor: { role: 'underwriter' },
    at: '2026-06-12T14:30:00Z', after: [{ path: '/state', op: 'replace', oldValue: 'underwriting', newValue: 'approved-with-conditions' }] },
];

describe('renderAuditTimeline', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('renders a labelled list, chronological, with machine-readable times', () => {
    const el = renderAuditTimeline(evs);
    expect(el.getAttribute('role')).toBe('list');
    const items = el.querySelectorAll('.audit-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('.audit-action')?.textContent).toBe('created'); // sorted by `at`
    expect(items[0].querySelector('time')?.getAttribute('datetime')).toBe('2026-06-11T09:00:00Z');
  });

  it('summary detail hides the change set; expanded shows it', () => {
    expect(renderAuditTimeline(evs, { detail: 'summary' }).querySelector('.audit-detail')).toBeNull();
    const exp = renderAuditTimeline(evs, { detail: 'expanded' });
    expect(exp.querySelector('.audit-detail')).toBeTruthy();
    expect(exp.textContent).toContain('underwriting');
    expect(exp.textContent).toContain('approved-with-conditions');
  });

  it('by-actor grouping partitions under actor headers', () => {
    const el = renderAuditTimeline(evs, { grouping: 'by-actor' });
    const keys = [...el.querySelectorAll('.audit-group-key')].map((k) => k.textContent);
    expect(keys).toEqual(['system', 'underwriter']);
  });

  it('empty history renders an empty-state, not a broken list', () => {
    const el = renderAuditTimeline([]);
    expect(el.querySelector('.audit-empty')).toBeTruthy();
    expect(el.querySelector('.audit-item')).toBeNull();
  });

  it('auditTimelineHTML returns the markup string form', () => {
    const html = auditTimelineHTML(evs);
    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('audit-timeline');
  });
});
