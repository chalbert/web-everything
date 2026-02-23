/**
 * Integration tests for AutoHeading with InjectorRoot context
 *
 * Tests the AutoHeading transient component working with the injector system
 * to resolve heading levels from `customContexts:headingLevel` providers.
 * Uses happy-dom which is configured as the vitest environment.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import AutoHeading from '../../transient/AutoHeading';
import InjectorRoot from '../../../plugs/webinjectors/InjectorRoot';

// Register once
if (!customElements.get('auto-heading')) {
  customElements.define('auto-heading', AutoHeading);
}

/**
 * Flush microtask queue so queueMicrotask callbacks run.
 */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('AutoHeading + InjectorRoot integration', () => {
  let injectorRoot: InjectorRoot;

  beforeEach(() => {
    document.body.innerHTML = '';

    // Setup injector system
    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('injector context resolution', () => {
    it('should resolve heading level from customContexts:headingLevel provider', async () => {
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:headingLevel', 3);

      const el = document.createElement('auto-heading');
      el.textContent = 'Section Title';
      document.body.appendChild(el);

      await flushMicrotasks();

      const h = document.body.querySelector('h3');
      expect(h).not.toBeNull();
      expect(h!.textContent).toBe('Section Title');
    });

    it('should resolve h1 from injector when level is 1', async () => {
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:headingLevel', 1);

      const el = document.createElement('auto-heading');
      document.body.appendChild(el);

      await flushMicrotasks();

      expect(document.body.querySelector('h1')).not.toBeNull();
    });

    it('should resolve h6 from injector when level is 6', async () => {
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:headingLevel', 6);

      const el = document.createElement('auto-heading');
      document.body.appendChild(el);

      await flushMicrotasks();

      expect(document.body.querySelector('h6')).not.toBeNull();
    });

    it('should clamp injected level above 6', async () => {
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:headingLevel', 10);

      const el = document.createElement('auto-heading');
      document.body.appendChild(el);

      await flushMicrotasks();

      expect(document.body.querySelector('h6')).not.toBeNull();
    });
  });

  describe('resolution priority', () => {
    it('should prefer explicit level attribute over injector context', async () => {
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:headingLevel', 4);

      const el = document.createElement('auto-heading');
      el.setAttribute('level', '2');
      el.textContent = 'Explicit Wins';
      document.body.appendChild(el);

      await flushMicrotasks();

      // Should be h2 (explicit), not h4 (injector)
      expect(document.body.querySelector('h2')).not.toBeNull();
      expect(document.body.querySelector('h4')).toBeNull();
      expect(document.body.querySelector('h2')!.textContent).toBe('Explicit Wins');
    });

    it('should prefer injector context over DOM traversal', async () => {
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:headingLevel', 5);

      // Place inside <section> — DOM traversal would give h2
      const section = document.createElement('section');
      const el = document.createElement('auto-heading');
      el.textContent = 'Injector Wins';
      section.appendChild(el);
      document.body.appendChild(section);

      await flushMicrotasks();

      // Should be h5 (injector), not h2 (DOM traversal)
      expect(document.body.querySelector('h5')).not.toBeNull();
      expect(document.body.querySelector('h2')).toBeNull();
    });

    it('should fall back to DOM traversal when no injector provider', async () => {
      // No headingLevel provider set on injector

      const section = document.createElement('section');
      const el = document.createElement('auto-heading');
      el.textContent = 'Fallback';
      section.appendChild(el);
      document.body.appendChild(section);

      await flushMicrotasks();

      // section ancestor → h2
      expect(document.body.querySelector('h2')).not.toBeNull();
      expect(document.body.querySelector('h2')!.textContent).toBe('Fallback');
    });
  });

  describe('nested injector scopes', () => {
    it('should resolve from nearest ancestor injector', async () => {
      // Document-level: headingLevel = 1
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:headingLevel', 1);

      // Create nested container with its own injector scope via ensureInjector
      const container = document.createElement('div');
      document.body.appendChild(container);

      const containerInjector = injectorRoot.ensureInjector(container, docInjector!);
      containerInjector.set('customContexts:headingLevel', 3);

      const el = document.createElement('auto-heading');
      el.textContent = 'Nested';
      container.appendChild(el);

      await flushMicrotasks();

      // Should resolve from container's injector (3), not document's (1)
      expect(document.body.querySelector('h3')).not.toBeNull();
      expect(document.body.querySelector('h3')!.textContent).toBe('Nested');
    });
  });

  describe('attribute and child transfer with injector', () => {
    it('should transfer attributes and children after injector resolution', async () => {
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:headingLevel', 2);

      const el = document.createElement('auto-heading');
      el.setAttribute('class', 'page-title');
      el.setAttribute('id', 'main-heading');
      el.innerHTML = '<span>Rich</span> Content';
      document.body.appendChild(el);

      await flushMicrotasks();

      const h = document.body.querySelector('h2');
      expect(h).not.toBeNull();
      expect(h!.getAttribute('class')).toBe('page-title');
      expect(h!.getAttribute('id')).toBe('main-heading');
      expect(h!.querySelector('span')!.textContent).toBe('Rich');
      expect(h!.textContent).toBe('Rich Content');
    });

    it('should exclude level attribute from replacement even with injector', async () => {
      const docInjector = injectorRoot.getInjectorOf(document);
      docInjector?.set('customContexts:headingLevel', 4);

      const el = document.createElement('auto-heading');
      el.setAttribute('level', '2');
      el.setAttribute('class', 'title');
      document.body.appendChild(el);

      await flushMicrotasks();

      const h = document.body.querySelector('h2');
      expect(h).not.toBeNull();
      expect(h!.hasAttribute('level')).toBe(false);
      expect(h!.getAttribute('class')).toBe('title');
    });
  });

  describe('section component pattern', () => {
    it('should support parent providing incremented heading level', async () => {
      // Simulate a section component that provides an incremented level
      const section = document.createElement('div');
      document.body.appendChild(section);

      const docInjector = injectorRoot.getInjectorOf(document);
      const sectionInjector = injectorRoot.ensureInjector(section, docInjector!);
      sectionInjector.set('customContexts:headingLevel', 2);

      const el = document.createElement('auto-heading');
      el.textContent = 'Sub-section';
      section.appendChild(el);

      await flushMicrotasks();

      expect(document.body.querySelector('h2')).not.toBeNull();
      expect(document.body.querySelector('h2')!.textContent).toBe('Sub-section');
    });

    it('should support deeply nested section components', async () => {
      const docInjector = injectorRoot.getInjectorOf(document);

      // Outer section provides level 2
      const outer = document.createElement('div');
      document.body.appendChild(outer);
      const outerInjector = injectorRoot.ensureInjector(outer, docInjector!);
      outerInjector.set('customContexts:headingLevel', 2);

      // Inner section provides level 3
      const inner = document.createElement('div');
      outer.appendChild(inner);
      const innerInjector = injectorRoot.ensureInjector(inner, outerInjector);
      innerInjector.set('customContexts:headingLevel', 3);

      const el = document.createElement('auto-heading');
      el.textContent = 'Deep Nested';
      inner.appendChild(el);

      await flushMicrotasks();

      // Should get level 3 from nearest ancestor
      expect(document.body.querySelector('h3')).not.toBeNull();
      expect(document.body.querySelector('h3')!.textContent).toBe('Deep Nested');
    });
  });
});
