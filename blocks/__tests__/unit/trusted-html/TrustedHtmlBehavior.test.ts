/**
 * Unit tests for TrustedHtmlBehavior (#1140).
 *
 * Covers both platform conditions explicitly: Trusted Types present (assignments route through the
 * policy) and absent (native pass-through, graceful degradation). jsdom has no Trusted Types, so the
 * "present" case stubs a minimal `globalThis.trustedTypes` factory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import TrustedHtmlBehavior, { __resetPolicyCacheForTests } from '../../../trusted-html/TrustedHtmlBehavior';
import CustomAttribute from '@frontierui/plugs/webbehaviors/CustomAttribute';

/** A spying Trusted Types factory: createHTML wraps the input so we can prove the sink ran. */
function installFakeTrustedTypes() {
  const createHTML = vi.fn((input: string) => `TT(${input})`);
  const createPolicy = vi.fn(() => ({ createHTML }));
  (globalThis as Record<string, unknown>).trustedTypes = { createPolicy };
  return { createHTML, createPolicy };
}

function attach(value = ''): { el: HTMLDivElement; behavior: TrustedHtmlBehavior } {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const behavior = new TrustedHtmlBehavior({ name: 'trusted-html', value });
  behavior.attach(el);
  behavior.connectedCallback();
  return { el, behavior };
}

describe('TrustedHtmlBehavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (globalThis as Record<string, unknown>).trustedTypes;
    __resetPolicyCacheForTests();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).trustedTypes;
  });

  it('extends CustomAttribute', () => {
    expect(new TrustedHtmlBehavior({ name: 'trusted-html' })).toBeInstanceOf(CustomAttribute);
  });

  describe('without Trusted Types support (graceful degradation)', () => {
    it('is a native pass-through — not active, assignment still works', () => {
      const { el, behavior } = attach();
      expect(behavior.active).toBe(false);
      el.innerHTML = '<strong>hi</strong>';
      expect(el.querySelector('strong')?.textContent).toBe('hi');
    });
  });

  describe('with Trusted Types support', () => {
    it('routes innerHTML string assignments through the policy', () => {
      const { createHTML, createPolicy } = installFakeTrustedTypes();
      const { el, behavior } = attach();

      expect(behavior.active).toBe(true);
      expect(createPolicy).toHaveBeenCalledWith('trusted-html', expect.any(Object));

      el.innerHTML = '<em>x</em>';
      expect(createHTML).toHaveBeenCalledWith('<em>x</em>');
      // jsdom stringifies the returned value when assigning to its native sink.
      expect(el.innerHTML).toContain('TT(');
    });

    it('uses the attribute value as the policy name when present', () => {
      const { createPolicy } = installFakeTrustedTypes();
      attach('article-html');
      expect(createPolicy).toHaveBeenCalledWith('article-html', expect.any(Object));
    });

    it('restores the native innerHTML accessor on disconnect', () => {
      installFakeTrustedTypes();
      const { el, behavior } = attach();
      expect(Object.getOwnPropertyDescriptor(el, 'innerHTML')).toBeDefined();
      behavior.disconnectedCallback();
      expect(behavior.active).toBe(false);
      expect(Object.getOwnPropertyDescriptor(el, 'innerHTML')).toBeUndefined();
      // Native sink works again.
      el.innerHTML = '<b>plain</b>';
      expect(el.querySelector('b')?.textContent).toBe('plain');
    });
  });
});
