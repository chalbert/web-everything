import { describe, it, expect, beforeEach } from 'vitest';
import { renderStatusIndicator, statusIndicatorHTML } from '../../../renderers/status-indicator/renderStatusIndicator';

describe('renderStatusIndicator', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('projects tone + shape onto classes and marks the standing status (not colour-only)', () => {
    const el = renderStatusIndicator({ label: 'Underwriting', tone: 'progress', shape: 'pill' });
    expect(el.className).toBe('status-indicator status-pill tone-progress');
    expect(el.dataset.tone).toBe('progress');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.textContent).toBe('Underwriting'); // label carries the meaning
    expect(el.getAttribute('aria-label')).toBe('Underwriting');
  });

  it('defaults to a neutral badge', () => {
    const el = renderStatusIndicator({ label: 'Draft' });
    expect(el.className).toBe('status-indicator status-badge tone-neutral');
  });

  it('dot shape adds an aria-hidden dot before the label', () => {
    const el = renderStatusIndicator({ label: 'Declined', tone: 'critical', shape: 'dot' });
    const dot = el.querySelector('.status-dot');
    expect(dot).toBeTruthy();
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    expect(el.textContent).toBe('Declined');
  });

  it('actionable affordance records the available next transitions', () => {
    const el = renderStatusIndicator({ label: 'Submitted', actions: ['approve', 'decline'] });
    expect(el.dataset.actions).toBe('approve,decline');
  });

  it('statusIndicatorHTML returns the markup string form', () => {
    const html = statusIndicatorHTML({ label: 'Approved', tone: 'positive' });
    expect(html).toContain('tone-positive');
    expect(html).toContain('Approved');
    expect(html.startsWith('<span')).toBe(true);
  });
});
