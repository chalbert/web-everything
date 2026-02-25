import { describe, it, expect, beforeEach } from 'vitest';
import InjectorRoot from '../../InjectorRoot';
import ModuleInjector from '../../ModuleInjector';

const createMeta = (url = 'file:///test.ts'): ImportMeta => ({ url } as ImportMeta);

describe('Provider lifecycle', () => {
  describe('dispose()', () => {
    it('should clear all providers on dispose', () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      injector.set('customContexts:a', { name: 'a' });
      injector.set('customContexts:b', { name: 'b' });

      injector.dispose();

      expect(injector.get('customContexts:a')).toBeUndefined();
      expect(injector.get('customContexts:b')).toBeUndefined();
    });

    it('should throw on consume after dispose', async () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      injector.set('customContexts:a', { name: 'a' });

      injector.dispose();

      await expect(
        injector.consume('customContexts:a', meta),
      ).rejects.toThrow('Unknown provider');
    });

    it('should disconnect from parent', () => {
      const parentMeta = createMeta('file:///parent.ts');
      const childMeta = createMeta('file:///child.ts');
      const parent = new ModuleInjector(parentMeta);
      const child = new ModuleInjector(childMeta, parent);

      expect(parent.childInjectors.has(child)).toBe(true);

      child.dispose();

      expect(parent.childInjectors.has(child)).toBe(false);
    });

    it('should clear lazy registrations on dispose', async () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      injector.register('customContexts:lazy' as any, async () => ({ lazy: true }));

      injector.dispose();

      await expect(
        injector.consume('customContexts:lazy' as any, meta),
      ).rejects.toThrow('Unknown provider');
    });
  });

  describe('delete()', () => {
    it('should remove a specific provider', () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      injector.set('customContexts:temp', { value: 'temp' });

      injector.delete('customContexts:temp');

      expect(injector.get('customContexts:temp')).toBeUndefined();
    });

    it('should not affect other providers', () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      injector.set('customContexts:keep', { name: 'keep' });
      injector.set('customContexts:remove', { name: 'remove' });

      injector.delete('customContexts:remove');

      expect(injector.get('customContexts:keep')).toEqual({ name: 'keep' });
      expect(injector.get('customContexts:remove')).toBeUndefined();
    });

    it('should clear lazy registration on delete', async () => {
      const meta = createMeta();
      const injector = new ModuleInjector(meta);
      injector.register('customContexts:lazy' as any, async () => ({ lazy: true }));

      injector.delete('customContexts:lazy');

      await expect(
        injector.consume('customContexts:lazy' as any, meta),
      ).rejects.toThrow('Unknown provider');
    });
  });

  describe('full lifecycle: create → provide → consume → dispose', () => {
    it('should transition through all states', async () => {
      let injectorRoot: InjectorRoot | undefined;

      try {
        const meta = createMeta();
        const moduleInjector = new ModuleInjector(meta);

        // Create: set initial provider
        moduleInjector.set('customContexts:counter', { count: 0 });

        injectorRoot = new InjectorRoot();
        injectorRoot.attach(document, moduleInjector);

        const rootInjector = injectorRoot.getInjectorOf(document);

        // Consume: get the value
        const counter = await rootInjector?.consume('customContexts:counter', document.body);
        expect(counter).toEqual({ count: 0 });

        // Update: set new value
        moduleInjector.set('customContexts:counter', { count: 1 });
        const updated = await rootInjector?.consume('customContexts:counter', document.body);
        expect(updated).toEqual({ count: 1 });

        // Dispose: clear everything
        moduleInjector.dispose();
        expect(moduleInjector.get('customContexts:counter')).toBeUndefined();
      } finally {
        injectorRoot?.detach(document);
      }
    });
  });
});
