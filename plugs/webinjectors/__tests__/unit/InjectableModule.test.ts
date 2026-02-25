import { describe, it, expect, vi } from 'vitest';
import InjectableModule from '../../InjectableModule';

const createMeta = (url = 'file:///test.ts'): ImportMeta => ({ url } as ImportMeta);

describe('InjectableModule', () => {
  describe('construction', () => {
    it('should store name and create injector', () => {
      const meta = createMeta();
      const mod = new InjectableModule('test-module', meta, () => {});

      expect(mod.name).toBe('test-module');
      expect(mod.injector).toBeDefined();
      expect(mod.injector.target).toBe(meta);
    });
  });

  describe('bootstrap', () => {
    it('should call setup function with self', () => {
      const setup = vi.fn();
      const meta = createMeta();
      const mod = new InjectableModule('test', meta, setup);

      mod.bootstrap();

      expect(setup).toHaveBeenCalledOnce();
      expect(setup).toHaveBeenCalledWith(mod);
    });

    it('should allow setup to register providers', () => {
      const meta = createMeta();
      const mod = new InjectableModule('test', meta, (m) => {
        m.provide('customContexts:config', { apiUrl: 'https://api.test.com' });
      });

      mod.bootstrap();

      expect(mod.get('customContexts:config')).toEqual({ apiUrl: 'https://api.test.com' });
    });
  });

  describe('provide / get', () => {
    it('should provide and retrieve a value', () => {
      const meta = createMeta();
      const mod = new InjectableModule('test', meta, () => {});
      const service = { name: 'logger' };

      mod.provide('customContexts:logger', service);

      expect(mod.get('customContexts:logger')).toBe(service);
    });

    it('should return undefined for missing provider', () => {
      const meta = createMeta();
      const mod = new InjectableModule('test', meta, () => {});

      expect(mod.get('customContexts:missing')).toBeUndefined();
    });
  });

  describe('set / get', () => {
    it('should set and get providers', () => {
      const meta = createMeta();
      const mod = new InjectableModule('test', meta, () => {});
      const service = { version: '1.0' };

      mod.set('customContexts:app', service);

      expect(mod.get('customContexts:app')).toBe(service);
    });
  });

  describe('consume', () => {
    it('should return loaded provider', async () => {
      const meta = createMeta();
      const mod = new InjectableModule('test', meta, (m) => {
        m.provide('customContexts:state', { count: 0 });
      });

      mod.bootstrap();

      const result = await mod.consume('customContexts:state', meta);
      expect(result).toEqual({ count: 0 });
    });

    it('should throw for unknown provider', async () => {
      const meta = createMeta();
      const mod = new InjectableModule('test', meta, () => {});

      mod.bootstrap();

      await expect(
        mod.consume('customContexts:missing', meta),
      ).rejects.toThrow('Unknown provider');
    });
  });

  describe('register', () => {
    it('should lazy-load registered provider on consume', async () => {
      const meta = createMeta();
      const mod = new InjectableModule('test', meta, () => {});
      const service = { lazy: true };

      mod.register('customContexts:lazy' as any, async () => service);

      const result = await mod.consume('customContexts:lazy' as any, meta);
      expect(result).toBe(service);
    });
  });

  describe('full lifecycle', () => {
    it('should support provide → bootstrap → consume flow', async () => {
      const meta = createMeta();
      const mod = new InjectableModule('app', meta, (m) => {
        m.provide('customContexts:config', { theme: 'dark' });
        m.provide('customContexts:version', '2.0.0');
      });

      mod.bootstrap();

      expect(mod.get('customContexts:config')).toEqual({ theme: 'dark' });
      expect(mod.get('customContexts:version')).toBe('2.0.0');

      const config = await mod.consume('customContexts:config', meta);
      expect(config).toEqual({ theme: 'dark' });
    });
  });
});
