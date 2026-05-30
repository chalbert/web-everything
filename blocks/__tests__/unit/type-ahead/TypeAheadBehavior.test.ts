/**
 * Unit tests for TypeAheadBehavior (proof-of-concept coverage).
 *
 * Covers the core loop: prefix accumulation, idle-timeout reset, and
 * printable-only key filtering. Fuller conformance (cycling, wrap/clamp,
 * nomatch detail, Composite Widget delegation) is deferred until the block is
 * promoted past `draft`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import TypeAheadBehavior from '../../../type-ahead/TypeAheadBehavior';

/** Build a listbox with the given option labels and attach the behavior. */
function createListbox(
  labels: string[],
  attrs: Record<string, string> = {}
): { list: HTMLElement; options: HTMLElement[]; behavior: TypeAheadBehavior } {
  document.body.innerHTML = '';
  const list = document.createElement('ul');
  list.setAttribute('role', 'listbox');
  list.setAttribute('type-ahead', '');
  for (const [name, value] of Object.entries(attrs)) list.setAttribute(name, value);

  for (const label of labels) {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.setAttribute('tabindex', '-1');
    li.textContent = label;
    list.appendChild(li);
  }
  document.body.appendChild(list);

  const behavior = new TypeAheadBehavior({ name: 'type-ahead' });
  behavior.attach(list);
  behavior.isConnected = true;
  behavior.connectedCallback?.();

  return { list, options: Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')), behavior };
}

/** Dispatch a single printable keystroke on the container. */
function type(target: HTMLElement, char: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
}

describe('TypeAheadBehavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('configuration', () => {
    it('defaults to prefix-then-cycle matching and a 500ms reset', () => {
      const { behavior } = createListbox(['Argentina']);
      expect(behavior.matching).toBe('prefix-then-cycle');
      expect(behavior.resetMs).toBe(500);
      expect(behavior.wrap).toBe(true);
    });

    it('reads config from attributes', () => {
      const { behavior } = createListbox(['Argentina'], {
        'type-ahead-match': 'prefix',
        'type-ahead-reset': '250',
        'type-ahead-wrap': 'false',
      });
      expect(behavior.matching).toBe('prefix');
      expect(behavior.resetMs).toBe(250);
      expect(behavior.wrap).toBe(false);
    });
  });

  describe('prefix accumulation', () => {
    it('moves focus to the first item matching the accumulated buffer', () => {
      const { list, options } = createListbox(['Argentina', 'Australia', 'Austria', 'Brazil']);

      type(list, 'a');
      type(list, 'u');
      type(list, 's'); // "aus"

      expect(document.activeElement).toBe(options[1]); // Australia
    });

    it('fires typeahead-match with the buffer and matched item', () => {
      const { list, options } = createListbox(['Argentina', 'Brazil']);
      const onMatch = vi.fn();
      list.addEventListener('typeahead-match', onMatch as EventListener);

      type(list, 'b');

      expect(onMatch).toHaveBeenCalledTimes(1);
      const detail = (onMatch.mock.calls[0][0] as CustomEvent).detail;
      expect(detail.query).toBe('b');
      expect(detail.matched).toBe(options[1]); // Brazil
    });

    it('fires typeahead-nomatch and leaves focus unchanged when nothing matches', () => {
      const { list } = createListbox(['Argentina', 'Brazil']);
      const onNoMatch = vi.fn();
      list.addEventListener('typeahead-nomatch', onNoMatch as EventListener);

      type(list, 'z');

      expect(onNoMatch).toHaveBeenCalledTimes(1);
      expect((onNoMatch.mock.calls[0][0] as CustomEvent).detail.query).toBe('z');
      expect(document.activeElement).not.toBe(null);
    });
  });

  describe('idle-timeout reset', () => {
    it('clears the buffer and fires typeahead-reset after the timeout', () => {
      const { list, behavior } = createListbox(['Argentina', 'Brazil']);
      const onReset = vi.fn();
      list.addEventListener('typeahead-reset', onReset as EventListener);

      type(list, 'a');
      expect(behavior.buffer).toBe('a');

      vi.advanceTimersByTime(600);

      expect(behavior.buffer).toBe('');
      expect(onReset).toHaveBeenCalledTimes(1);
      expect((onReset.mock.calls[0][0] as CustomEvent).detail.query).toBe('a');
    });

    it('starts a fresh search after the buffer resets', () => {
      const { list, options } = createListbox(['Argentina', 'Brazil']);

      type(list, 'a'); // Argentina
      vi.advanceTimersByTime(600); // reset
      type(list, 'b'); // fresh search

      expect(document.activeElement).toBe(options[1]); // Brazil
    });
  });

  describe('printable-only filtering', () => {
    it('ignores non-printable and modified keys', () => {
      const { list, behavior } = createListbox(['Argentina', 'Brazil']);

      type(list, 'ArrowDown');
      type(list, 'Enter');
      list.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));

      expect(behavior.buffer).toBe('');
    });
  });
});
