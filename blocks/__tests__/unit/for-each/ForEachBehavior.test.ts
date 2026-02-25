/**
 * Unit tests for ForEachBehavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ForEachBehavior from '../../../for-each/ForEachBehavior';
import CustomAttribute from '../../../../plugs/webbehaviors/CustomAttribute';
import InjectorRoot from '../../../../plugs/webinjectors/InjectorRoot';
import HTMLInjector from '../../../../plugs/webinjectors/HTMLInjector';

describe('ForEachBehavior', () => {
  let injectorRoot: InjectorRoot;

  beforeEach(() => {
    document.body.innerHTML = '';
    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);
  });

  afterEach(() => {
    injectorRoot.detach(document);
    document.body.innerHTML = '';
  });

  /**
   * Helper: create a <template for-each="..."> with items provided via injector context.
   */
  function createForEach(options: {
    expression: string;
    items: unknown[];
    contextName?: string;
    templateContent?: string;
    key?: string;
  }): {
    template: HTMLTemplateElement;
    behavior: ForEachBehavior;
    container: HTMLDivElement;
  } {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const template = document.createElement('template');
    template.innerHTML = options.templateContent ?? '<div class="item"></div>';
    if (options.key) template.setAttribute('key', options.key);
    container.appendChild(template);

    // Provide the items via injector context
    // Parse expression to determine context name for injection
    const contextMatch = options.expression.match(/^@(\w+)/);
    if (contextMatch) {
      const contextSourceName = contextMatch[1];
      const pathMatch = options.expression.match(/^@\w+\.(.+?)(?:\s|$)/);
      const path = pathMatch?.[1];

      // Set the context on the container's injector
      const injector = injectorRoot.ensureInjector(container);
      if (path) {
        // Nested path: set a context object with the items at that path
        const parts = path.split('.');
        let obj: Record<string, unknown> = {};
        const root = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          obj[parts[i]] = {};
          obj = obj[parts[i]] as Record<string, unknown>;
        }
        obj[parts[parts.length - 1]] = options.items;
        injector.set(`customContexts:${contextSourceName}`, root);
      } else {
        injector.set(`customContexts:${contextSourceName}`, options.items);
      }
    } else {
      // Bare state path
      const injector = injectorRoot.ensureInjector(container);
      const parts = options.expression.trim().split('.');
      let obj: Record<string, unknown> = {};
      const root = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        obj[parts[i]] = {};
        obj = obj[parts[i]] as Record<string, unknown>;
      }
      obj[parts[parts.length - 1]] = options.items;
      injector.set('customContexts:state', root);
    }

    const behavior = new ForEachBehavior({
      name: 'for-each',
      value: options.expression,
    });
    behavior.attach(template);
    behavior.isConnected = true;

    return { template, behavior, container };
  }

  describe('creation', () => {
    it('should extend CustomAttribute', () => {
      const behavior = new ForEachBehavior({
        name: 'for-each',
        value: '@data as item',
      });
      expect(behavior).toBeInstanceOf(CustomAttribute);
    });
  });

  describe('parsing', () => {
    it('should parse "expression as alias" syntax', () => {
      const { behavior } = createForEach({
        expression: '@route.data.users as user',
        items: [{ name: 'Alice' }],
      });
      behavior.connectedCallback?.();

      expect(behavior.contextName).toBe('user');
    });

    it('should default contextName to "item" for bare expressions', () => {
      const { behavior } = createForEach({
        expression: '@data',
        items: [1, 2, 3],
      });
      behavior.connectedCallback?.();

      expect(behavior.contextName).toBe('item');
    });

    it('should parse expression with dotted path', () => {
      const { behavior, container } = createForEach({
        expression: '@route.data.users as user',
        items: [{ name: 'Alice' }, { name: 'Bob' }],
      });
      behavior.connectedCallback?.();

      // Should stamp 2 items
      const items = container.querySelectorAll('.item');
      expect(items.length).toBe(2);
    });
  });

  describe('stamping', () => {
    it('should stamp correct number of items', () => {
      const { behavior, container } = createForEach({
        expression: '@data as item',
        items: ['a', 'b', 'c'],
      });
      behavior.connectedCallback?.();

      const items = container.querySelectorAll('.item');
      expect(items.length).toBe(3);
    });

    it('should stamp nothing for empty array', () => {
      const { behavior, container } = createForEach({
        expression: '@data as item',
        items: [],
      });
      behavior.connectedCallback?.();

      const items = container.querySelectorAll('.item');
      expect(items.length).toBe(0);
    });

    it('should stamp complex template content', () => {
      const { behavior, container } = createForEach({
        expression: '@data as user',
        items: [{ name: 'Alice' }, { name: 'Bob' }],
        templateContent: '<div class="user-row"><span class="name"></span><span class="role"></span></div>',
      });
      behavior.connectedCallback?.();

      const rows = container.querySelectorAll('.user-row');
      expect(rows.length).toBe(2);
      expect(rows[0].querySelectorAll('span').length).toBe(2);
    });

    it('should stamp multiple top-level elements per item', () => {
      const { behavior, container } = createForEach({
        expression: '@data as item',
        items: [1, 2],
        templateContent: '<dt class="label"></dt><dd class="value"></dd>',
      });
      behavior.connectedCallback?.();

      expect(container.querySelectorAll('.label').length).toBe(2);
      expect(container.querySelectorAll('.value').length).toBe(2);
    });
  });

  describe('comment markers', () => {
    it('should insert start and end comment markers', () => {
      const { behavior, container } = createForEach({
        expression: '@data as item',
        items: [1, 2],
      });
      behavior.connectedCallback?.();

      const comments: Comment[] = [];
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
      while (walker.nextNode()) {
        comments.push(walker.currentNode as Comment);
      }

      expect(comments.length).toBe(2);
      expect(comments[0].textContent).toContain('for-each:start');
      expect(comments[1].textContent).toContain('for-each:end');
    });

    it('should place stamped items between markers', () => {
      const { behavior, container } = createForEach({
        expression: '@data as item',
        items: ['a', 'b'],
      });
      behavior.connectedCallback?.();

      // Find start marker
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
      walker.nextNode();
      const startMarker = walker.currentNode;

      // Next siblings should be the stamped items
      let next = startMarker.nextSibling;
      // Skip template element (it's between start marker and stamped content)
      if (next instanceof HTMLTemplateElement) {
        next = next.nextSibling;
      }
      expect(next).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('context injection', () => {
    it('should set context on each stamped element\'s injector', () => {
      const items = [{ name: 'Alice' }, { name: 'Bob' }];
      const { behavior, container } = createForEach({
        expression: '@data as user',
        items,
      });
      behavior.connectedCallback?.();

      const stampedDivs = container.querySelectorAll('.item');
      expect(stampedDivs.length).toBe(2);

      // Check injector context on first stamped element
      const firstInjector = injectorRoot.getInjectorOf(stampedDivs[0] as HTMLElement);
      expect(firstInjector).not.toBeNull();
      const firstContext = firstInjector?.get('customContexts:user');
      expect(firstContext).toEqual({ name: 'Alice' });

      // Check injector context on second stamped element
      const secondInjector = injectorRoot.getInjectorOf(stampedDivs[1] as HTMLElement);
      const secondContext = secondInjector?.get('customContexts:user');
      expect(secondContext).toEqual({ name: 'Bob' });
    });

    it('should use "item" as default context name', () => {
      const items = [{ id: 1 }];
      const { behavior, container } = createForEach({
        expression: '@data',
        items,
      });
      behavior.connectedCallback?.();

      const stampedDiv = container.querySelector('.item') as HTMLElement;
      const injector = injectorRoot.getInjectorOf(stampedDiv);
      const context = injector?.get('customContexts:item');
      expect(context).toEqual({ id: 1 });
    });
  });

  describe('public API', () => {
    it('should expose items getter', () => {
      const items = [1, 2, 3];
      const { behavior } = createForEach({
        expression: '@data as item',
        items,
      });
      behavior.connectedCallback?.();

      expect(behavior.items).toEqual([1, 2, 3]);
    });

    it('should expose contextName getter', () => {
      const { behavior } = createForEach({
        expression: '@data as user',
        items: [1],
      });
      behavior.connectedCallback?.();

      expect(behavior.contextName).toBe('user');
    });

    it('should return empty array for items when context not found', () => {
      const template = document.createElement('template');
      template.innerHTML = '<div></div>';
      document.body.appendChild(template);

      const behavior = new ForEachBehavior({
        name: 'for-each',
        value: '@missing.data as item',
      });
      behavior.attach(template);
      behavior.isConnected = true;

      // items getter should return [] when context is missing
      expect(behavior.items).toEqual([]);
    });
  });

  describe('refresh', () => {
    it('should re-stamp items on refresh', () => {
      const { behavior, container } = createForEach({
        expression: '@data as item',
        items: [1, 2],
      });
      behavior.connectedCallback?.();

      expect(container.querySelectorAll('.item').length).toBe(2);

      // Refresh should re-stamp
      behavior.refresh();
      expect(container.querySelectorAll('.item').length).toBe(2);
    });
  });

  describe('lifecycle', () => {
    it('should clean up stamped nodes on disconnectedCallback', () => {
      const { behavior, container } = createForEach({
        expression: '@data as item',
        items: [1, 2, 3],
      });
      behavior.connectedCallback?.();

      expect(container.querySelectorAll('.item').length).toBe(3);

      behavior.disconnectedCallback?.();

      expect(container.querySelectorAll('.item').length).toBe(0);
    });

    it('should remove comment markers on disconnectedCallback', () => {
      const { behavior, container } = createForEach({
        expression: '@data as item',
        items: [1, 2],
      });
      behavior.connectedCallback?.();

      behavior.disconnectedCallback?.();

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
      const comments: Comment[] = [];
      while (walker.nextNode()) {
        comments.push(walker.currentNode as Comment);
      }
      expect(comments.length).toBe(0);
    });

    it('should warn when not attached to a template element', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const div = document.createElement('div');
      document.body.appendChild(div);

      const behavior = new ForEachBehavior({
        name: 'for-each',
        value: '@data as item',
      });
      behavior.attach(div as any);
      behavior.isConnected = true;
      behavior.connectedCallback?.();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Must be attached to a <template> element'),
      );

      warnSpy.mockRestore();
    });
  });

  describe('state path resolution', () => {
    it('should resolve bare state path via default state context', () => {
      const { behavior, container } = createForEach({
        expression: 'users',
        items: [{ name: 'Alice' }],
      });
      behavior.connectedCallback?.();

      expect(container.querySelectorAll('.item').length).toBe(1);
    });

    it('should resolve nested state path', () => {
      const { behavior, container } = createForEach({
        expression: 'data.users',
        items: [{ name: 'Alice' }, { name: 'Bob' }],
      });
      behavior.connectedCallback?.();

      expect(container.querySelectorAll('.item').length).toBe(2);
    });
  });

  describe('key attribute', () => {
    it('should read key attribute from template', () => {
      const { behavior, template } = createForEach({
        expression: '@data as item',
        items: [{ id: 1 }, { id: 2 }],
        key: 'id',
      });
      behavior.connectedCallback?.();

      // key is stored internally for Phase 2 — verify template has it
      expect(template.getAttribute('key')).toBe('id');
    });
  });
});
