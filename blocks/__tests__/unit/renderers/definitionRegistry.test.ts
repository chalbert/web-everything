/**
 * Unit tests for the MaaS id→definition resolver + registry + caching (backlog #311). Proves the
 * production hardening of v1's per-request fixture scan: O(1) indexed lookup, a fallback resolver chain,
 * a memoizing definition cache (positive + negative), and a served-artifact cache keyed by (id, form,
 * target) — all over the SAME `serve()` core, indexing the SAME component-cases the v1 plugin scanned.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  componentName,
  CustomDefinitionRegistry,
  indexDefinitions,
  UnnamedDefinitionError,
  DefinitionCache,
  ServedArtifactCache,
  type DefinitionResolver,
} from '../../../renderers/module-service/definitionRegistry';
import { componentCases } from '../../../renderers/component/__fixtures__/component-cases';
import { serve } from '../../../renderers/module-service/moduleService';

describe('componentName', () => {
  it('extracts the declared element name, or null', () => {
    expect(componentName('<component name="user-card" shadow="open"></component>')).toBe('user-card');
    expect(componentName('<component shadow="open"></component>')).toBeNull();
  });
});

describe('CustomDefinitionRegistry / indexDefinitions', () => {
  it('indexes the component-cases by name for O(1) lookup (the v1 source, now a real registry)', () => {
    const registry = indexDefinitions(componentCases.map((c) => c.def));
    expect(registry.has('user-card')).toBe(true);
    expect(registry.resolve('user-card')).toContain('<component name="user-card"');
    expect(registry.keys().length).toBe(componentCases.length);
  });

  it('returns null for an unknown id and never throws on resolve', () => {
    const registry = indexDefinitions(componentCases.map((c) => c.def));
    expect(registry.resolve('no-such-element')).toBeNull();
  });

  it('throws on an unnamed definition (strict) but can skip it', () => {
    const defs = ['<component shadow="open"></component>'];
    expect(() => indexDefinitions(defs)).toThrow(UnnamedDefinitionError);
    expect(indexDefinitions(defs, { skipUnnamed: true }).keys()).toEqual([]);
  });

  it('consults a fallback resolver on a local miss (registry fronts a production source)', () => {
    const fallback: DefinitionResolver = { resolve: (id) => (id === 'remote-el' ? '<component name="remote-el"></component>' : null) };
    const registry = new CustomDefinitionRegistry(fallback).define('local-el', '<component name="local-el"></component>');
    expect(registry.resolve('local-el')).toContain('local-el'); // local wins, fallback not consulted
    expect(registry.resolve('remote-el')).toContain('remote-el'); // miss → fallback answers
    expect(registry.resolve('nobody')).toBeNull();
  });
});

describe('DefinitionCache', () => {
  it('memoizes hits and misses, and reports stats', () => {
    const inner = { resolve: vi.fn((id: string) => (id === 'a' ? 'DEF-A' : null)) };
    const cache = new DefinitionCache(inner);

    expect(cache.resolve('a')).toBe('DEF-A');
    expect(cache.resolve('a')).toBe('DEF-A'); // served from cache
    expect(cache.resolve('missing')).toBeNull();
    expect(cache.resolve('missing')).toBeNull(); // negative cache — not re-queried

    expect(inner.resolve).toHaveBeenCalledTimes(2); // 'a' once, 'missing' once
    expect(cache.stats).toEqual({ hits: 2, misses: 2, size: 2 });
  });

  it('invalidate() drops one id or the whole table', () => {
    const inner = { resolve: vi.fn(() => 'X') };
    const cache = new DefinitionCache(inner);
    cache.resolve('a');
    cache.invalidate('a');
    cache.resolve('a'); // re-queried after invalidation
    expect(inner.resolve).toHaveBeenCalledTimes(2);
    cache.resolve('b');
    cache.invalidate();
    expect(cache.stats.size).toBe(0);
  });
});

describe('ServedArtifactCache', () => {
  it('memoizes the served artifact by (id, form, target) and never re-runs serve for a hit', () => {
    const registry = indexDefinitions(componentCases.map((c) => c.def));
    const serveSpy = vi.fn(serve);
    const cache = new ServedArtifactCache(registry, serveSpy);

    const first = cache.serve('user-card', { form: 'wc-class' });
    const second = cache.serve('user-card', { form: 'wc-class' });
    expect(first).toBe(second); // same memoized ServeResult instance
    expect(first!.code).toBe(serve(registry.resolve('user-card')!, { form: 'wc-class' }).code);
    expect(serveSpy).toHaveBeenCalledTimes(1); // second call was a cache hit

    // A different form is a different key → a fresh serve.
    cache.serve('user-card', { form: 'html' });
    expect(serveSpy).toHaveBeenCalledTimes(2);
    expect(cache.stats).toEqual({ hits: 1, misses: 2, size: 2 });
  });

  it('returns null for an unknown id without serving', () => {
    const registry = indexDefinitions(componentCases.map((c) => c.def));
    const serveSpy = vi.fn(serve);
    const cache = new ServedArtifactCache(registry, serveSpy);
    expect(cache.serve('ghost', { form: 'html' })).toBeNull();
    expect(serveSpy).not.toHaveBeenCalled();
  });

  it('invalidate(id) drops every cached form of that id', () => {
    const registry = indexDefinitions(componentCases.map((c) => c.def));
    const cache = new ServedArtifactCache(registry);
    cache.serve('user-card', { form: 'wc-class' });
    cache.serve('user-card', { form: 'html' });
    expect(cache.stats.size).toBe(2);
    cache.invalidate('user-card');
    expect(cache.stats.size).toBe(0);
  });
});
