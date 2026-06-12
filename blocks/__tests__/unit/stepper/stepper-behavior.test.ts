import { describe, it, expect, beforeEach } from 'vitest';
import { StepperBehavior } from '../../../stepper/StepperBehavior';

function flowOf(n: number): HTMLElement {
  const host = document.createElement('div');
  const nav = document.createElement('ol');
  for (let i = 0; i < n; i++) {
    const li = document.createElement('li');
    li.setAttribute('data-step-indicator', '');
    li.dataset.step1 = String(i);
    nav.append(li);
    const panel = document.createElement('section');
    panel.setAttribute('data-step', '');
    panel.textContent = `Step ${i}`;
    host.append(panel);
  }
  host.prepend(nav);
  // controls
  const back = document.createElement('button'); back.setAttribute('data-step-prev', ''); back.textContent = 'Back';
  const next = document.createElement('button'); next.setAttribute('data-step-next', ''); next.textContent = 'Next';
  host.append(back, next);
  document.body.append(host);
  return host;
}

describe('StepperBehavior', () => {
  let host: HTMLElement;
  beforeEach(() => { document.body.innerHTML = ''; host = flowOf(3); });

  it('shows only the current step and marks it aria-current="step"', () => {
    new StepperBehavior(host);
    const panels = host.querySelectorAll<HTMLElement>('[data-step]');
    expect(panels[0].hidden).toBe(false);
    expect(panels[1].hidden).toBe(true);
    expect(panels[0].getAttribute('aria-current')).toBe('step');
    expect(host.getAttribute('aria-label')).toBe('Step 1 of 3');
  });

  it('Next advances and emits step-change; the indicator + panel follow', () => {
    const seen: Array<{ from: number; to: number }> = [];
    host.addEventListener('step-change', (e) => seen.push((e as CustomEvent).detail));
    const s = new StepperBehavior(host);
    host.querySelector<HTMLButtonElement>('[data-step-next]')!.click();
    expect(s.currentIndex).toBe(1);
    expect(host.querySelectorAll<HTMLElement>('[data-step]')[1].hidden).toBe(false);
    expect(seen).toEqual([{ from: 0, to: 1, trigger: expect.anything() }]);
  });

  it('locked progression: a failing gate blocks advance and emits step-advance-blocked', () => {
    let valid = false;
    const blocked: unknown[] = [];
    host.addEventListener('step-advance-blocked', (e) => blocked.push((e as CustomEvent).detail));
    const s = new StepperBehavior(host, { canAdvance: () => valid });
    expect(s.next()).toBe(false);
    expect(s.currentIndex).toBe(0);
    expect(blocked).toEqual([{ step: 0, reason: 'invalid' }]);
    valid = true;
    expect(s.next()).toBe(true);
    expect(s.currentIndex).toBe(1);
  });

  it('locked goTo forward past an incomplete step is blocked; back to a completed step is allowed', () => {
    const s = new StepperBehavior(host);
    expect(s.goTo(2)).toBe(false);      // can't jump ahead
    s.next(); // 0 completed → at 1
    expect(s.goTo(0)).toBe(true);       // back to completed
    expect(s.currentIndex).toBe(0);
  });

  it('free progression allows jumping to any step', () => {
    const s = new StepperBehavior(host, { progression: 'free' });
    expect(s.goTo(2)).toBe(true);
    expect(s.currentIndex).toBe(2);
  });

  it('completing the last step fires flow-complete', () => {
    let completed = 0;
    host.addEventListener('flow-complete', (e) => { completed = (e as CustomEvent).detail.steps; });
    const s = new StepperBehavior(host);
    s.next(); s.next(); // → step 2 (last)
    expect(s.currentIndex).toBe(2);
    s.next();           // complete
    expect(completed).toBe(3);
  });
});
