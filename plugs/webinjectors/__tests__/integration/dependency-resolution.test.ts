/**
 * Integration tests: Dependency resolution chains
 *
 * Tests deep lazy chains, diamond dependencies, circular detection,
 * mixed eager/lazy, cross-injector lazy loading, and shadowing.
 *
 * @module webinjectors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Injector from '../../Injector';
import CustomRegistry from '../../../core/CustomRegistry';

class TestInjector extends Injector<any, HTMLElement, HTMLElement> {
  isQuerierValid(querier: HTMLElement): boolean {
    return this.target.contains(querier);
  }
}

describe('Dependency resolution chains', () => {
  let root: HTMLElement;
  let child: HTMLElement;
  let injector: TestInjector;

  beforeEach(() => {
    root = document.createElement('div');
    child = document.createElement('span');
    root.appendChild(child);
    document.body.appendChild(root);
    injector = new TestInjector(root);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('deep lazy chains', () => {
    it('should resolve a 4-level deep lazy dependency chain', async () => {
      const dLoader = vi.fn(async () => ({ id: 'd' }));
      const cLoader = vi.fn(async () => {
        const d = await injector.consume('customContexts:d' as any, child);
        return { id: 'c', dep: d };
      });
      const bLoader = vi.fn(async () => {
        const c = await injector.consume('customContexts:c' as any, child);
        return { id: 'b', dep: c };
      });
      const aLoader = vi.fn(async () => {
        const b = await injector.consume('customContexts:b' as any, child);
        return { id: 'a', dep: b };
      });

      injector.register('customContexts:d' as any, dLoader);
      injector.register('customContexts:c' as any, cLoader);
      injector.register('customContexts:b' as any, bLoader);
      injector.register('customContexts:a' as any, aLoader);

      const result = await injector.consume('customContexts:a' as any, child);

      expect(result.id).toBe('a');
      expect(result.dep.id).toBe('b');
      expect(result.dep.dep.id).toBe('c');
      expect(result.dep.dep.dep.id).toBe('d');

      // Each loader called exactly once
      expect(dLoader).toHaveBeenCalledOnce();
      expect(cLoader).toHaveBeenCalledOnce();
      expect(bLoader).toHaveBeenCalledOnce();
      expect(aLoader).toHaveBeenCalledOnce();

      // All providers now available synchronously
      expect(injector.get('customContexts:a')).toBe(result);
      expect(injector.get('customContexts:d')).toEqual({ id: 'd' });
    });
  });

  describe('diamond dependencies', () => {
    it('should load shared dependency D only once when both B and C depend on it', async () => {
      const dValue = { id: 'd' };
      const dLoader = vi.fn(async () => dValue);

      injector.register('customContexts:d' as any, dLoader);
      injector.register('customContexts:b' as any, async () => {
        const d = await injector.consume('customContexts:d' as any, child);
        return { id: 'b', d };
      });
      injector.register('customContexts:c' as any, async () => {
        const d = await injector.consume('customContexts:d' as any, child);
        return { id: 'c', d };
      });
      injector.register('customContexts:a' as any, async () => {
        const [b, c] = await Promise.all([
          injector.consume('customContexts:b' as any, child),
          injector.consume('customContexts:c' as any, child),
        ]);
        return { id: 'a', b, c };
      });

      const result = await injector.consume('customContexts:a' as any, child);

      expect(result.b.d).toBe(result.c.d); // Same reference
      expect(dLoader).toHaveBeenCalledOnce();
    });
  });

  describe('circular dependencies', () => {
    it('should not stack-overflow on circular dependency (deadlock like ES module import)', async () => {
      injector.register('customContexts:a' as any, async () => {
        return await injector.consume('customContexts:b' as any, child);
      });
      injector.register('customContexts:b' as any, async () => {
        return await injector.consume('customContexts:a' as any, child);
      });

      // True A↔B deadlock: both promises wait on each other, neither resolves.
      // Like a circular import() — no crash, just hangs. Verify with a timeout race.
      const TIMEOUT = Symbol('timeout');
      const result = await Promise.race([
        injector.consume('customContexts:a' as any, child),
        new Promise((r) => setTimeout(() => r(TIMEOUT), 100)),
      ]);

      expect(result).toBe(TIMEOUT);
    });

    it('should resolve circular dependency when one side is eager', async () => {
      // A is eager, B is lazy and depends on A — like an ES module with hoisted export
      injector.set('customContexts:a' as any, { id: 'a' });
      injector.register('customContexts:b' as any, async () => {
        const a = await injector.consume('customContexts:a' as any, child);
        return { id: 'b', a };
      });

      const result = await injector.consume('customContexts:b' as any, child);
      expect(result.id).toBe('b');
      expect(result.a).toEqual({ id: 'a' });
    });
  });

  describe('mixed eager and lazy', () => {
    it('should resolve chain mixing eager (set) and lazy (register) providers', async () => {
      const config = { url: 'https://api.example.com' };
      injector.set('customContexts:config', config);

      injector.register('customContexts:service' as any, async () => {
        const cfg = await injector.consume('customContexts:config', child);
        return { name: 'ApiService', config: cfg };
      });

      const result = await injector.consume('customContexts:service' as any, child);
      expect(result.config).toBe(config);
      expect(result.name).toBe('ApiService');
    });
  });

  describe('cross-injector lazy resolution', () => {
    it('should lazy-load from parent when child consumes unregistered key', async () => {
      const parentEl = document.createElement('div');
      const childEl = document.createElement('span');
      parentEl.appendChild(childEl);
      document.body.appendChild(parentEl);

      const parent = new TestInjector(parentEl);
      const childInj = new TestInjector(childEl, parent);

      const loader = vi.fn(async () => ({ user: 'admin' }));
      parent.register('customContexts:auth' as any, loader);

      const result = await childInj.consume('customContexts:auth' as any, childEl);

      expect(result).toEqual({ user: 'admin' });
      expect(loader).toHaveBeenCalledOnce();
      // Provider cached on parent, not child
      expect(parent.get('customContexts:auth')).toEqual({ user: 'admin' });
      expect(childInj.get('customContexts:auth')).toBeUndefined();
    });

    it('should prefer child registered loader over parent registered loader', async () => {
      const parentEl = document.createElement('div');
      const childEl = document.createElement('span');
      parentEl.appendChild(childEl);
      document.body.appendChild(parentEl);

      const parent = new TestInjector(parentEl);
      const childInj = new TestInjector(childEl, parent);

      const parentLoader = vi.fn(async () => ({ mode: 'light' }));
      const childLoader = vi.fn(async () => ({ mode: 'dark' }));

      parent.register('customContexts:theme' as any, parentLoader);
      childInj.register('customContexts:theme' as any, childLoader);

      const result = await childInj.consume('customContexts:theme' as any, childEl);

      expect(result).toEqual({ mode: 'dark' });
      expect(childLoader).toHaveBeenCalledOnce();
      expect(parentLoader).not.toHaveBeenCalled();
    });
  });
});
