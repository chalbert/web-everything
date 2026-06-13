/**
 * @file traitManifest.test.ts
 * @description Tests for The Map — the standalone trait manifest and its
 *   `registerTraits` bootstrap wiring (gap 1 of the Web Traits "Scale without
 *   Weight" plan). Proves the manifest → `defineLazy` → lazy-load path end to end.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CustomAttributeRegistry from '../../CustomAttributeRegistry';
import CustomAttribute from '../../CustomAttribute';
import { registerTraits, traitManifest, type TraitManifest } from '../../traitManifest';
import type { ImplementedAttribute } from '../../CustomAttribute';

/** Flush the loader/MutationObserver turn. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('traitManifest / registerTraits', () => {
  class SortableTrait extends CustomAttribute {
    callbackLog: string[] = [];
    attachedCallback() {
      this.callbackLog.push('attached');
    }
  }

  class ExportTrait extends CustomAttribute {}

  let registry: CustomAttributeRegistry;
  let container: HTMLDivElement;

  beforeEach(() => {
    registry = new CustomAttributeRegistry();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    registry.downgrade(container);
    container.remove();
  });

  it('ships an empty default manifest', () => {
    expect(traitManifest).toEqual({});
  });

  it('is a no-op for an empty manifest', () => {
    expect(() => registerTraits(registry, {})).not.toThrow();
    container.innerHTML = '<div sortable></div>';
    expect(() => registry.upgrade(container)).not.toThrow();
  });

  it('registers each manifest entry as a lazily-loaded attribute', async () => {
    const sortableLoader = vi.fn(() => Promise.resolve(SortableTrait));
    const manifest: TraitManifest = { sortable: sortableLoader };

    registerTraits(registry, manifest);

    // Nothing loaded until the attribute appears.
    expect(sortableLoader).not.toHaveBeenCalled();

    container.innerHTML = '<div sortable></div>';
    const element = container.firstElementChild as HTMLElement;
    registry.upgrade(container);
    await tick();

    expect(sortableLoader).toHaveBeenCalledTimes(1);
    const instance = registry.getInstance(element, SortableTrait) as SortableTrait;
    expect(instance).toBeInstanceOf(SortableTrait);
    expect(instance.callbackLog).toContain('attached');
  });

  it('only loads the traits whose attributes actually appear', async () => {
    const sortableLoader = vi.fn(() => Promise.resolve(SortableTrait));
    const exportLoader = vi.fn(() => Promise.resolve(ExportTrait));
    registerTraits(registry, { sortable: sortableLoader, 'export-csv': exportLoader });

    container.innerHTML = '<div sortable></div>'; // no export-csv anywhere
    registry.upgrade(container);
    await tick();

    expect(sortableLoader).toHaveBeenCalledTimes(1);
    expect(exportLoader).not.toHaveBeenCalled();
  });

  it('supports loaders returning a module with a default export', async () => {
    const manifest: TraitManifest = { sortable: () => Promise.resolve({ default: SortableTrait }) };
    registerTraits(registry, manifest);

    container.innerHTML = '<div sortable></div>';
    const element = container.firstElementChild as HTMLElement;
    registry.upgrade(container);
    await tick();

    expect(registry.getInstance(element, SortableTrait)).toBeInstanceOf(SortableTrait);
  });

  describe('delivery: eager', () => {
    class HighlightTrait extends CustomAttribute {
      callbackLog: string[] = [];
      attachedCallback() {
        this.callbackLog.push('attached');
      }
    }

    it('define()s an eager entry up front — applied synchronously, no async tick', () => {
      registerTraits(registry, {
        highlight: { delivery: 'eager', attribute: HighlightTrait as ImplementedAttribute },
      });

      container.innerHTML = '<div highlight></div>';
      const element = container.firstElementChild as HTMLElement;
      registry.upgrade(container);

      // No `await tick()` — the eager trait applies during upgrade(), synchronously.
      const instance = registry.getInstance(element, HighlightTrait) as HighlightTrait;
      expect(instance).toBeInstanceOf(HighlightTrait);
      expect(instance.callbackLog).toContain('attached');
    });

    it('does not invoke a loader for an eager entry (no on-demand import)', () => {
      const lazyLoader = vi.fn(() => Promise.resolve(SortableTrait));
      registerTraits(registry, {
        highlight: { delivery: 'eager', attribute: HighlightTrait as ImplementedAttribute },
        sortable: lazyLoader,
      });

      container.innerHTML = '<div highlight></div>'; // sortable absent
      registry.upgrade(container);

      expect(lazyLoader).not.toHaveBeenCalled();
    });

    it('mixes eager and lazy entries — eager sync, lazy after a tick', async () => {
      const lazyLoader = vi.fn(() => Promise.resolve(SortableTrait));
      registerTraits(registry, {
        highlight: { delivery: 'eager', attribute: HighlightTrait as ImplementedAttribute },
        sortable: lazyLoader,
      });

      container.innerHTML = '<div highlight></div><div sortable></div>';
      const [eager, lazy] = Array.from(container.children) as HTMLElement[];
      registry.upgrade(container);

      // Eager is already applied; lazy has not loaded yet.
      expect(registry.getInstance(eager, HighlightTrait)).toBeInstanceOf(HighlightTrait);
      expect(registry.getInstance(lazy, SortableTrait)).toBeUndefined();

      await tick();
      expect(registry.getInstance(lazy, SortableTrait)).toBeInstanceOf(SortableTrait);
    });
  });

  describe('delivery: lazy with preload (#202 per-usage override)', () => {
    it('defineLazy()s an object-form lazy entry the same as the bare shorthand', async () => {
      const loader = vi.fn(() => Promise.resolve(SortableTrait));
      registerTraits(registry, { sortable: { delivery: 'lazy', load: loader } });

      // No preload → nothing loads until the attribute appears.
      expect(loader).not.toHaveBeenCalled();

      container.innerHTML = '<div sortable></div>';
      const element = container.firstElementChild as HTMLElement;
      registry.upgrade(container);
      await tick();

      expect(loader).toHaveBeenCalledTimes(1);
      expect(registry.getInstance(element, SortableTrait)).toBeInstanceOf(SortableTrait);
    });

    it('warms the chunk at bootstrap when preload is set — before any element appears', async () => {
      const loader = vi.fn(() => Promise.resolve(SortableTrait));
      registerTraits(registry, { sortable: { delivery: 'lazy', preload: true, load: loader } });

      // preload fires immediately at register time — no DOM, no upgrade() yet.
      expect(loader).toHaveBeenCalledTimes(1);
    });

    it('applies a preloaded trait to an element that mounts later, with no extra load', async () => {
      const loader = vi.fn(() => Promise.resolve(SortableTrait));
      registerTraits(registry, { sortable: { delivery: 'lazy', preload: true, load: loader } });
      registry.upgrade(container);
      await tick(); // let the preload resolve and define()

      // Element appears only now — the class is already cached, applied with no reload.
      container.innerHTML = '<div sortable></div>';
      const element = container.firstElementChild as HTMLElement;
      await tick();

      expect(loader).toHaveBeenCalledTimes(1); // warmed once, never re-fetched
      expect(registry.getInstance(element, SortableTrait)).toBeInstanceOf(SortableTrait);
    });
  });
});

describe('CustomAttributeRegistry.preload (#202)', () => {
  class SortableTrait extends CustomAttribute {}

  let registry: CustomAttributeRegistry;

  beforeEach(() => {
    registry = new CustomAttributeRegistry();
  });

  it('runs a pending lazy loader immediately, without a DOM appearance', async () => {
    const loader = vi.fn(() => Promise.resolve(SortableTrait));
    registry.defineLazy('sortable', loader);

    await registry.preload('sortable');
    expect(loader).toHaveBeenCalledTimes(1);
    // After preload, the class is defined (cached) — no longer "pending lazy".
    expect(registry.getDefinition('sortable')?.constructor).toBe(SortableTrait);
  });

  it('is a no-op for an unknown / non-lazy name', async () => {
    await expect(registry.preload('does-not-exist')).resolves.toBeUndefined();
  });

  it('dedups with a concurrent first-sighting load (one fetch total)', async () => {
    const loader = vi.fn(() => Promise.resolve(SortableTrait));
    registry.defineLazy('sortable', loader);

    const container = document.createElement('div');
    container.innerHTML = '<div sortable></div>';
    document.body.appendChild(container);

    // Kick a preload and an upgrade-driven sighting in the same turn.
    const p = registry.preload('sortable');
    registry.upgrade(container);
    await p;
    await new Promise((r) => setTimeout(r, 10));

    expect(loader).toHaveBeenCalledTimes(1);
    registry.downgrade(container);
    container.remove();
  });
});
