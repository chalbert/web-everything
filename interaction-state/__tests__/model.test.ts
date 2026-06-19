/**
 * Unit test for the interaction-state model (#1110, webvalidation #1090). happy-dom provides the input
 * element + events, so the derive logic is exercised without a real browser.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InteractionStateTracker } from '../model';

describe('InteractionStateTracker', () => {
  let input: HTMLInputElement;
  let tracker: InteractionStateTracker;

  beforeEach(() => {
    input = document.createElement('input');
    input.value = 'base';
    document.body.append(input);
    tracker = new InteractionStateTracker();
    tracker.attach(input);
  });

  it('starts idle (all flags false)', () => {
    expect(tracker.state).toEqual({ dirty: false, touched: false, focused: false, submitted: false });
  });

  it('input that differs from baseline → dirty + touched', () => {
    input.value = 'changed';
    input.dispatchEvent(new Event('input'));
    expect(tracker.state).toMatchObject({ dirty: true, touched: true });
  });

  it('input back to the baseline value → not dirty (but still touched)', () => {
    input.value = 'changed';
    input.dispatchEvent(new Event('input'));
    input.value = 'base';
    input.dispatchEvent(new Event('input'));
    expect(tracker.state).toMatchObject({ dirty: false, touched: true });
  });

  it('focus → focused; blur → not focused + touched', () => {
    input.dispatchEvent(new Event('focus'));
    expect(tracker.state.focused).toBe(true);
    input.dispatchEvent(new Event('blur'));
    expect(tracker.state).toMatchObject({ focused: false, touched: true });
  });

  it('markSubmitted sets submitted; reset re-baselines (clears dirty)', () => {
    input.value = 'changed';
    input.dispatchEvent(new Event('input'));
    tracker.markSubmitted();
    expect(tracker.state.submitted).toBe(true);
    tracker.reset();
    expect(tracker.state.dirty).toBe(false);
  });

  it('notifies subscribers on change and stops after detach', () => {
    const seen: boolean[] = [];
    tracker.subscribe((s) => seen.push(s.touched));
    input.dispatchEvent(new Event('input'));
    expect(seen.at(-1)).toBe(true);
    tracker.detach();
    const count = seen.length;
    input.dispatchEvent(new Event('input'));
    expect(seen.length).toBe(count); // no further notifications
  });
});
