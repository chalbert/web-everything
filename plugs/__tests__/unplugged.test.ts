import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  register,
  unregister,
  upgrade,
  downgrade,
  attach,
  detach,
  getPlug,
  hasPlug,
  getPlugs,
  getPlugNames,
  getRoots,
  isUpgraded,
  reset,
} from '../unplugged';
import type { Plug } from '../core/Plug';

// Mock plug implementation for testing
class MockPlug implements Plug {
  localName: string;
  upgradeCalls: RootNode[] = [];
  downgradeCalls: RootNode[] = [];

  constructor(localName: string) {
    this.localName = localName;
  }

  upgrade(root: RootNode): void {
    this.upgradeCalls.push(root);
  }

  downgrade(root: RootNode): void {
    this.downgradeCalls.push(root);
  }
}

describe('unplugged', () => {
  let mockPlug: MockPlug;

  beforeEach(() => {
    reset(); // Clean state between tests
    mockPlug = new MockPlug('mockPlug');
  });

  describe('register', () => {
    it('should register a plug', () => {
      register(mockPlug);
      expect(hasPlug('mockPlug')).toBe(true);
      expect(getPlug('mockPlug')).toBe(mockPlug);
    });

    it('should throw if plug does not implement Plug interface', () => {
      expect(() => register({} as Plug)).toThrow();
    });

    it('should replace existing plug with warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const newPlug = new MockPlug('mockPlug');

      register(mockPlug);
      register(newPlug);

      expect(warnSpy).toHaveBeenCalled();
      expect(getPlug('mockPlug')).toBe(newPlug);
      warnSpy.mockRestore();
    });
  });

  describe('unregister', () => {
    it('should unregister a plug by reference', () => {
      register(mockPlug);
      unregister(mockPlug);
      expect(hasPlug('mockPlug')).toBe(false);
    });

    it('should unregister a plug by name', () => {
      register(mockPlug);
      unregister('mockPlug');
      expect(hasPlug('mockPlug')).toBe(false);
    });

    it('should downgrade all roots when unregistering', () => {
      attach(document);
      register(mockPlug);
      upgrade();
      unregister(mockPlug);

      expect(mockPlug.downgradeCalls).toContain(document);
    });
  });

  describe('attach/detach', () => {
    it('should attach to a root node', () => {
      attach(document);
      expect(getRoots()).toContain(document);
    });

    it('should detach from a root node', () => {
      attach(document);
      detach(document);
      expect(getRoots()).not.toContain(document);
    });
  });

  describe('upgrade', () => {
    it('should upgrade all registered plugs for a root', () => {
      const plug1 = new MockPlug('plug1');
      const plug2 = new MockPlug('plug2');

      register(plug1);
      register(plug2);
      attach(document);
      upgrade();

      expect(plug1.upgradeCalls).toContain(document);
      expect(plug2.upgradeCalls).toContain(document);
    });

    it('should upgrade specific root when provided', () => {
      const shadowHost = document.createElement('div');
      const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

      attach(document);
      attach(shadowRoot);
      register(mockPlug);
      upgrade(shadowRoot);

      expect(mockPlug.upgradeCalls).toContain(shadowRoot);
      expect(mockPlug.upgradeCalls).not.toContain(document);
    });

    it('should auto-attach root if not already attached', () => {
      register(mockPlug);
      upgrade(document);

      expect(getRoots()).toContain(document);
    });
  });

  describe('downgrade', () => {
    it('should downgrade all registered plugs for a root', () => {
      const plug1 = new MockPlug('plug1');
      const plug2 = new MockPlug('plug2');

      register(plug1);
      register(plug2);
      attach(document);
      upgrade();
      downgrade();

      expect(plug1.downgradeCalls).toContain(document);
      expect(plug2.downgradeCalls).toContain(document);
    });

    it('should downgrade in reverse registration order', () => {
      const order: string[] = [];
      const plug1 = new MockPlug('plug1');
      const plug2 = new MockPlug('plug2');

      plug1.downgrade = () => order.push('plug1');
      plug2.downgrade = () => order.push('plug2');

      register(plug1);
      register(plug2);
      attach(document);
      upgrade();
      downgrade();

      expect(order).toEqual(['plug2', 'plug1']);
    });
  });

  describe('isUpgraded', () => {
    it('should return true for upgraded roots', () => {
      attach(document);
      upgrade();
      expect(isUpgraded(document)).toBe(true);
    });

    it('should return false for non-upgraded roots', () => {
      attach(document);
      expect(isUpgraded(document)).toBe(false);
    });
  });

  describe('getPlugNames/getPlugs', () => {
    it('should return all plug names', () => {
      register(new MockPlug('a'));
      register(new MockPlug('b'));
      expect(getPlugNames()).toEqual(['a', 'b']);
    });

    it('should return all plugs', () => {
      const plug1 = new MockPlug('a');
      const plug2 = new MockPlug('b');
      register(plug1);
      register(plug2);
      expect(getPlugs()).toEqual([plug1, plug2]);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      register(mockPlug);
      attach(document);
      upgrade();

      reset();

      expect(hasPlug('mockPlug')).toBe(false);
      expect(getRoots()).toEqual([]);
      expect(isUpgraded(document)).toBe(false);
    });
  });
});
