import { describe, it, expect } from 'vitest';
import ModuleInjector from '../../ModuleInjector';

const createMeta = (url = 'file:///test.ts'): ImportMeta => ({ url } as ImportMeta);

describe('ModuleInjector', () => {
  describe('construction', () => {
    it('should construct with ImportMeta target', () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      expect(injector.target).toBe(meta);
    });

    it('should accept a parent injector', () => {
      const parentMeta = createMeta('file:///parent.ts');
      const childMeta = createMeta('file:///child.ts');
      const parent = new ModuleInjector(parentMeta);
      const child = new ModuleInjector(childMeta, parent);

      expect(child.parentInjector).toBe(parent);
    });

    it('should reject null target', () => {
      expect(() => new ModuleInjector(null as any)).toThrow('Injector target must be provided');
    });
  });

  describe('isQuerierValid', () => {
    it('should return true for any querier', () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      const otherMeta = createMeta('file:///other.ts');

      expect(injector.isQuerierValid(otherMeta)).toBe(true);
    });

    it('should return true for the same module', () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);

      expect(injector.isQuerierValid(meta)).toBe(true);
    });
  });

  describe('provider operations', () => {
    it('should get and set providers', () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      const service = { name: 'test-service' };

      injector.set('customContexts:test', service);
      expect(injector.get('customContexts:test')).toBe(service);
    });

    it('should delete providers', () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);

      injector.set('customContexts:test', { name: 'test' });
      expect(injector.delete('customContexts:test')).toBe(true);
      expect(injector.get('customContexts:test')).toBeUndefined();
    });

    it('should iterate entries', () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      const service1 = { id: 1 };
      const service2 = { id: 2 };

      injector.set('customContexts:a', service1);
      injector.set('customContexts:b', service2);

      const entries = Array.from(injector.entries());
      expect(entries).toHaveLength(2);
    });
  });

  describe('consume', () => {
    it('should return loaded provider immediately', async () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      const service = { hello: 'world' };

      injector.set('customContexts:test', service);

      const result = await injector.consume('customContexts:test', meta);
      expect(result).toBe(service);
    });

    it('should throw for unknown provider', async () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);

      await expect(
        injector.consume('customContexts:missing', meta),
      ).rejects.toThrow('Unknown provider: customContexts:missing');
    });

    it('should resolve from parent injector', async () => {
      const parentMeta = createMeta('file:///parent.ts');
      const childMeta = createMeta('file:///child.ts');
      const parent = new ModuleInjector(parentMeta);
      const child = new ModuleInjector(childMeta, parent);
      const service = { source: 'parent' };

      parent.set('customContexts:shared', service);

      const result = await child.consume('customContexts:shared', childMeta);
      expect(result).toBe(service);
    });

    it('should lazy-load a registered provider', async () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      const service = { lazy: true };

      injector.register('customContexts:lazy' as any, async () => service);

      const result = await injector.consume('customContexts:lazy' as any, meta);
      expect(result).toBe(service);
    });
  });
});
