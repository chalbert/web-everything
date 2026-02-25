import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import InjectorRoot from '../../InjectorRoot';
import ModuleInjector from '../../ModuleInjector';
import InjectableModule from '../../InjectableModule';

const createMeta = (url = 'file:///app.ts'): ImportMeta => ({ url } as ImportMeta);

describe('Cross-scope bridging', () => {
  let injectorRoot: InjectorRoot;

  beforeEach(() => {
    document.body.innerHTML = '';
    injectorRoot = new InjectorRoot();
  });

  afterEach(() => {
    injectorRoot.detach(document);
  });

  describe('ModuleInjector as parent of HTMLInjector', () => {
    it('should set ModuleInjector as parent of root HTMLInjector', () => {
      const meta = createMeta();
      const moduleInjector = new ModuleInjector(meta);

      injectorRoot.attach(document, moduleInjector);

      const rootInjector = injectorRoot.getInjectorOf(document);
      expect(rootInjector?.parentInjector).toBe(moduleInjector);
    });

    it('should work without a ModuleInjector (backwards compatible)', () => {
      injectorRoot.attach(document);

      const rootInjector = injectorRoot.getInjectorOf(document);
      expect(rootInjector?.parentInjector).toBeNull();
    });
  });

  describe('provider resolution across scopes', () => {
    it('should resolve module provider from DOM element', async () => {
      const meta = createMeta();
      const moduleInjector = new ModuleInjector(meta);
      moduleInjector.set('customContexts:config', { theme: 'dark' });

      injectorRoot.attach(document, moduleInjector);

      const element = document.createElement('div');
      document.body.appendChild(element);

      // Consume from DOM context — should traverse up to ModuleInjector
      const rootInjector = injectorRoot.getInjectorOf(document);
      const config = await rootInjector?.consume('customContexts:config', element);

      expect(config).toEqual({ theme: 'dark' });
    });

    it('should shadow module provider with DOM provider', async () => {
      const meta = createMeta();
      const moduleInjector = new ModuleInjector(meta);
      moduleInjector.set('customContexts:config', { level: 'module' });

      injectorRoot.attach(document, moduleInjector);

      // Override at DOM level
      const rootInjector = injectorRoot.getInjectorOf(document);
      rootInjector?.set('customContexts:config', { level: 'dom' });

      const element = document.createElement('div');
      document.body.appendChild(element);

      // Should get DOM-level provider (closer in chain)
      const config = await rootInjector?.consume('customContexts:config', element);
      expect(config).toEqual({ level: 'dom' });
    });

    it('should resolve unmatched providers from module when DOM has none', async () => {
      const meta = createMeta();
      const moduleInjector = new ModuleInjector(meta);
      moduleInjector.set('customContexts:api', { url: 'https://api.example.com' });
      moduleInjector.set('customContexts:version', '1.0.0');

      injectorRoot.attach(document, moduleInjector);

      // DOM injector only has one provider
      const rootInjector = injectorRoot.getInjectorOf(document);
      rootInjector?.set('customContexts:local', { name: 'dom-only' });

      const element = document.createElement('div');
      document.body.appendChild(element);

      // Module providers accessible
      const api = await rootInjector?.consume('customContexts:api', element);
      expect(api).toEqual({ url: 'https://api.example.com' });

      // DOM provider accessible
      const local = await rootInjector?.consume('customContexts:local', element);
      expect(local).toEqual({ name: 'dom-only' });
    });
  });

  describe('InjectableModule integration', () => {
    it('should support full InjectableModule → InjectorRoot flow', async () => {
      const meta = createMeta();
      const appModule = new InjectableModule('app', meta, (m) => {
        m.provide('customContexts:api', 'https://api.example.com');
        m.provide('customContexts:version', '2.0.0');
      });
      appModule.bootstrap();

      injectorRoot.attach(document, appModule.injector);

      const rootInjector = injectorRoot.getInjectorOf(document);
      const api = await rootInjector?.consume('customContexts:api', document.body);
      expect(api).toBe('https://api.example.com');

      const version = await rootInjector?.consume('customContexts:version', document.body);
      expect(version).toBe('2.0.0');
    });
  });
});
