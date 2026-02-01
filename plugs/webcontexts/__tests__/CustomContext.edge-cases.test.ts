import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CustomContext from '../CustomContext';
import InjectorRoot from '../../webinjectors/InjectorRoot';

describe('CustomContext error paths and edge cases', () => {
  describe('detach', () => {
    it('should not error when detaching already detached context', () => {
      class TestContext extends CustomContext<{ value: string }> {}
      const context = new TestContext();

      expect(context.isAttached).toBe(false);
      expect(() => context.detach()).not.toThrow();
    });
  });
});
