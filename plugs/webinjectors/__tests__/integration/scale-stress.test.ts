/**
 * Integration tests: Scale and stress
 *
 * Tests system behavior under load: many providers, deep chains,
 * concurrent lazy loads, wide trees, and complex dependency graphs.
 *
 * @module webinjectors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Injector from '../../Injector';

class TestInjector extends Injector<any, HTMLElement, HTMLElement> {
  isQuerierValid(querier: HTMLElement): boolean {
    return this.target.contains(querier);
  }
}

describe('Scale and stress', () => {
  let root: HTMLElement;
  let child: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    child = document.createElement('span');
    root.appendChild(child);
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('many providers', () => {
    it('should handle 25 providers on a single injector', () => {
      const injector = new TestInjector(root);

      for (let i = 0; i < 25; i++) {
        injector.set(`customContexts:provider-${i}` as any, { id: i });
      }

      for (let i = 0; i < 25; i++) {
        expect(injector.get(`customContexts:provider-${i}`)).toEqual({ id: i });
      }

      expect(Array.from(injector.entries())).toHaveLength(25);
      expect(Array.from(injector.values())).toHaveLength(25);
    });
  });

  describe('deep chain with providers at each level', () => {
    it('should resolve providers from a 5-level chain with providers at each level', async () => {
      const elements: HTMLElement[] = [];
      for (let i = 0; i < 5; i++) {
        elements.push(document.createElement('div'));
        if (i > 0) elements[i - 1].appendChild(elements[i]);
      }
      document.body.appendChild(elements[0]);

      const injectors: TestInjector[] = [];
      for (let i = 0; i < 5; i++) {
        injectors.push(new TestInjector(elements[i], i > 0 ? injectors[i - 1] : null));
        injectors[i].set(`customContexts:level-${i}` as any, { level: i });
      }

      const leaf = injectors[4];
      const leafEl = elements[4];

      // Each level's unique provider is accessible from leaf
      for (let i = 0; i < 5; i++) {
        const result = await leaf.consume(`customContexts:level-${i}` as any, leafEl);
        expect(result).toEqual({ level: i });
      }

      // Same key at each level — leaf gets the closest (its own)
      for (let i = 0; i < 5; i++) {
        injectors[i].set('customContexts:shared' as any, { source: i });
      }

      const shared = await leaf.consume('customContexts:shared' as any, leafEl);
      expect(shared).toEqual({ source: 4 });
    });
  });

  describe('concurrent lazy loads', () => {
    it('should resolve 10 concurrent lazy loads without interference', async () => {
      const injector = new TestInjector(root);
      const loaders: ReturnType<typeof vi.fn>[] = [];

      for (let i = 0; i < 10; i++) {
        const delay = (i + 1) * 5; // 5ms to 50ms
        const loader = vi.fn(async () => {
          await new Promise((r) => setTimeout(r, delay));
          return { id: i, delay };
        });
        loaders.push(loader);
        injector.register(`customContexts:service-${i}` as any, loader);
      }

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          injector.consume(`customContexts:service-${i}` as any, child),
        ),
      );

      for (let i = 0; i < 10; i++) {
        expect(results[i]).toEqual({ id: i, delay: (i + 1) * 5 });
        expect(loaders[i]).toHaveBeenCalledOnce();
      }
    });
  });

  describe('wide tree', () => {
    it('should serve provider to 10 children from a single parent', async () => {
      const parentEl = document.createElement('div');
      document.body.appendChild(parentEl);

      const parent = new TestInjector(parentEl);
      const sharedConfig = { shared: true };
      parent.set('customContexts:config', sharedConfig);

      const results: any[] = [];
      for (let i = 0; i < 10; i++) {
        const el = document.createElement('div');
        parentEl.appendChild(el);
        const childInj = new TestInjector(el, parent);
        const result = await childInj.consume('customContexts:config', el);
        results.push(result);
      }

      // All 10 get the exact same reference
      for (const result of results) {
        expect(result).toBe(sharedConfig);
      }

      expect(parent.childInjectors.size).toBe(10);
    });
  });

  describe('complex dependency graph', () => {
    it('should handle 5-deep chain with shared diamond leaf', async () => {
      const injector = new TestInjector(root);

      const leafLoader = vi.fn(async () => ({ id: 'leaf' }));
      injector.register('customContexts:leaf' as any, leafLoader);

      // Level 4a and 4b both depend on leaf
      injector.register('customContexts:4a' as any, async () => {
        const leaf = await injector.consume('customContexts:leaf' as any, child);
        return { id: '4a', leaf };
      });
      injector.register('customContexts:4b' as any, async () => {
        const leaf = await injector.consume('customContexts:leaf' as any, child);
        return { id: '4b', leaf };
      });

      // Level 3 depends on 4a + 4b
      injector.register('customContexts:3' as any, async () => {
        const [a, b] = await Promise.all([
          injector.consume('customContexts:4a' as any, child),
          injector.consume('customContexts:4b' as any, child),
        ]);
        return { id: '3', a, b };
      });

      // Level 2 depends on 3
      injector.register('customContexts:2' as any, async () => {
        const dep = await injector.consume('customContexts:3' as any, child);
        return { id: '2', dep };
      });

      // Level 1 depends on 2
      injector.register('customContexts:1' as any, async () => {
        const dep = await injector.consume('customContexts:2' as any, child);
        return { id: '1', dep };
      });

      const result = await injector.consume('customContexts:1' as any, child);

      expect(result.id).toBe('1');
      expect(result.dep.id).toBe('2');
      expect(result.dep.dep.id).toBe('3');
      expect(result.dep.dep.a.leaf).toBe(result.dep.dep.b.leaf); // Same ref
      expect(leafLoader).toHaveBeenCalledOnce();
    });
  });
});
