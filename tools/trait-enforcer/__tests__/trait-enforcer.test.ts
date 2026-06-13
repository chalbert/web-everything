/**
 * @file trait-enforcer.test.ts
 * @description Tests for The Enforcer (gap 3) — template scanning, manifest
 *   codegen, and the Vite plugin glue.
 */

import { describe, it, expect } from 'vitest';
import {
  scanTraitsInHtml,
  scanTraitDeliveryOverrides,
  generateManifestModule,
  traitEnforcer,
  type TraitMap,
} from '../vite-plugin';

const MAP: TraitMap = {
  sortable: '/blocks/data-grid/traits/Sortable',
  'export-csv': '/blocks/data-grid/traits/ExportCsv',
  'nav:list': '/blocks/navigation/NavListBehavior',
};
const NAMES = Object.keys(MAP);

describe('scanTraitsInHtml', () => {
  it('finds a bare boolean attribute', () => {
    expect(scanTraitsInHtml('<data-grid sortable></data-grid>', NAMES)).toEqual(new Set(['sortable']));
  });

  it('finds a valued attribute', () => {
    expect(scanTraitsInHtml('<data-grid sortable="asc"></data-grid>', NAMES)).toEqual(new Set(['sortable']));
  });

  it('finds attributes on self-closing and multi-line tags', () => {
    const html = `<data-grid\n  sortable\n  export-csv\n/>`;
    expect(scanTraitsInHtml(html, NAMES)).toEqual(new Set(['sortable', 'export-csv']));
  });

  it('finds namespaced (colon) attribute names', () => {
    expect(scanTraitsInHtml('<ul nav:list></ul>', NAMES)).toEqual(new Set(['nav:list']));
  });

  it('does not match a longer attribute that contains the name', () => {
    expect(scanTraitsInHtml('<div sortableness data-export-csv></div>', NAMES)).toEqual(new Set());
  });

  it('returns empty when no trait attributes appear', () => {
    expect(scanTraitsInHtml('<div class="plain"></div>', NAMES)).toEqual(new Set());
  });
});

describe('scanTraitDeliveryOverrides (#202 per-usage delivery="eager")', () => {
  it('finds a <trait>-delivery="eager" override', () => {
    expect(scanTraitDeliveryOverrides('<ul sortable sortable-delivery="eager">', NAMES))
      .toEqual(new Set(['sortable']));
  });

  it('accepts single quotes and unquoted values', () => {
    expect(scanTraitDeliveryOverrides(`<ul sortable-delivery='eager'>`, NAMES)).toEqual(new Set(['sortable']));
    expect(scanTraitDeliveryOverrides('<ul sortable-delivery=eager>', NAMES)).toEqual(new Set(['sortable']));
  });

  it('ignores delivery="lazy" and other values (eager-only override)', () => {
    expect(scanTraitDeliveryOverrides('<ul sortable sortable-delivery="lazy">', NAMES)).toEqual(new Set());
    expect(scanTraitDeliveryOverrides('<ul sortable-delivery="eagerly">', NAMES)).toEqual(new Set());
  });

  it('finds overrides for namespaced and hyphenated trait names', () => {
    const html = `<ul nav:list-delivery="eager"></ul><table export-csv-delivery=eager>`;
    expect(scanTraitDeliveryOverrides(html, NAMES)).toEqual(new Set(['nav:list', 'export-csv']));
  });

  it('does not treat the bare trait attribute as an override', () => {
    expect(scanTraitDeliveryOverrides('<ul sortable></ul>', NAMES)).toEqual(new Set());
  });
});

describe('generateManifestModule', () => {
  it('emits a key-sorted table of literal import() thunks for all entries by default', () => {
    const src = generateManifestModule(MAP);
    expect(src).toContain('export const traitManifest = {');
    expect(src).toContain('"export-csv": () => import("/blocks/data-grid/traits/ExportCsv"),');
    expect(src).toContain('"nav:list": () => import("/blocks/navigation/NavListBehavior"),');
    expect(src).toContain('"sortable": () => import("/blocks/data-grid/traits/Sortable"),');
    expect(src).toContain('export default traitManifest;');
    // sorted: export-csv < nav:list < sortable
    expect(src.indexOf('export-csv')).toBeLessThan(src.indexOf('nav:list'));
    expect(src.indexOf('nav:list')).toBeLessThan(src.indexOf('"sortable"'));
  });

  it('includes only the used subset', () => {
    const src = generateManifestModule(MAP, new Set(['sortable']));
    expect(src).toContain('"sortable": () => import("/blocks/data-grid/traits/Sortable"),');
    expect(src).not.toContain('export-csv');
    expect(src).not.toContain('nav:list');
  });

  it('emits an empty manifest when nothing is used', () => {
    const src = generateManifestModule(MAP, new Set());
    expect(src).toContain('export const traitManifest = {');
    expect(src).not.toContain('import(');
  });

  describe('delivery dimension', () => {
    const MIXED: TraitMap = {
      sortable: '/blocks/traits/Sortable', // string → default lazy
      highlight: { module: '/blocks/traits/Highlight', delivery: 'eager' },
      tooltip: { module: '/blocks/traits/Tooltip', delivery: 'lazy' }, // explicit lazy
    };

    it('emits a hoisted static import + eager entry for delivery: eager', () => {
      const src = generateManifestModule(MIXED);
      // Static import (baked into the main bundle — no split chunk).
      expect(src).toContain('import __traitEager0 from "/blocks/traits/Highlight";');
      // Entry references the statically-imported class, not an import() thunk.
      expect(src).toContain('"highlight": { delivery: "eager", attribute: __traitEager0 },');
      expect(src).not.toContain('import("/blocks/traits/Highlight")');
    });

    it('emits an import() thunk for lazy entries (string and explicit)', () => {
      const src = generateManifestModule(MIXED);
      expect(src).toContain('"sortable": () => import("/blocks/traits/Sortable"),');
      expect(src).toContain('"tooltip": () => import("/blocks/traits/Tooltip"),');
    });

    it('hoists eager imports above the manifest table', () => {
      const src = generateManifestModule(MIXED);
      expect(src.indexOf('import __traitEager0')).toBeLessThan(src.indexOf('export const traitManifest'));
    });

    it('only emits eager imports for used eager traits', () => {
      const src = generateManifestModule(MIXED, new Set(['sortable']));
      expect(src).not.toContain('__traitEager');
      expect(src).not.toContain('Highlight');
      expect(src).toContain('"sortable": () => import("/blocks/traits/Sortable"),');
    });

    it('scans eager-trait usage through the plugin like any other entry', () => {
      const plugin = traitEnforcer({
        traitMap: MIXED,
        include: [],
        templates: ['<p highlight></p>'], // only the eager trait is used
      });
      const src = (plugin.load as (id: string) => string)('\0virtual:trait-manifest');
      expect(src).toContain('"highlight": { delivery: "eager", attribute: __traitEager0 },');
      expect(src).not.toContain('Sortable');
    });
  });

  describe('per-usage preload override (#202)', () => {
    it('emits a { delivery: "lazy", preload: true, load } entry for a preloaded lazy trait', () => {
      const src = generateManifestModule(MAP, new Set(['sortable']), new Set(['sortable']));
      expect(src).toContain(
        '"sortable": { delivery: "lazy", preload: true, load: () => import("/blocks/data-grid/traits/Sortable") },',
      );
    });

    it('leaves non-preloaded lazy traits as the bare import() thunk', () => {
      const src = generateManifestModule(MAP, new Set(['sortable', 'export-csv']), new Set(['sortable']));
      expect(src).toContain(
        '"sortable": { delivery: "lazy", preload: true, load: () => import("/blocks/data-grid/traits/Sortable") },',
      );
      expect(src).toContain('"export-csv": () => import("/blocks/data-grid/traits/ExportCsv"),');
    });

    it('preload implies emitted — a trait used only via its override is still in the manifest', () => {
      // `used` is empty, but the override warms it: it must still be emitted.
      const src = generateManifestModule(MAP, new Set(), new Set(['sortable']));
      expect(src).toContain('"sortable": { delivery: "lazy", preload: true');
    });

    it('ignores preload for eager traits — already in the main bundle, nothing to warm', () => {
      const MIXED: TraitMap = { highlight: { module: '/blocks/traits/Highlight', delivery: 'eager' } };
      const src = generateManifestModule(MIXED, new Set(['highlight']), new Set(['highlight']));
      expect(src).toContain('"highlight": { delivery: "eager", attribute: __traitEager0 },');
      expect(src).not.toContain('preload');
    });

    it('scans <trait>-delivery="eager" usage through the plugin and emits preload', () => {
      const plugin = traitEnforcer({
        traitMap: MAP,
        include: [],
        templates: ['<ul sortable sortable-delivery="eager"></ul>'],
      });
      const src = (plugin.load as (id: string) => string)('\0virtual:trait-manifest');
      expect(src).toContain('"sortable": { delivery: "lazy", preload: true, load: () => import(');
      expect(src).not.toContain('export-csv'); // unused → tree-shaken out
    });

    it('a plain (no-override) usage stays an on-demand thunk through the plugin', () => {
      const plugin = traitEnforcer({
        traitMap: MAP,
        include: [],
        templates: ['<ul sortable></ul>'],
      });
      const src = (plugin.load as (id: string) => string)('\0virtual:trait-manifest');
      expect(src).toContain('"sortable": () => import("/blocks/data-grid/traits/Sortable"),');
      expect(src).not.toContain('preload');
    });
  });
});

describe('traitEnforcer plugin', () => {
  const call = (fn: unknown, ...args: unknown[]) => (fn as (...a: unknown[]) => unknown)(...args);

  it('resolves only its virtual id', () => {
    const plugin = traitEnforcer({ traitMap: MAP });
    expect(call(plugin.resolveId, 'virtual:trait-manifest')).toBe('\0virtual:trait-manifest');
    expect(call(plugin.resolveId, './something-else')).toBeUndefined();
  });

  it('loads a manifest scanned from injected templates', () => {
    const plugin = traitEnforcer({
      traitMap: MAP,
      include: [], // no FS scan
      templates: ['<data-grid sortable></data-grid>'],
    });
    const src = call(plugin.load, '\0virtual:trait-manifest') as string;
    expect(src).toContain('"sortable": () => import("/blocks/data-grid/traits/Sortable"),');
    expect(src).not.toContain('export-csv'); // unused → tree-shaken out
  });

  it('returns undefined for non-virtual ids', () => {
    const plugin = traitEnforcer({ traitMap: MAP });
    expect(call(plugin.load, '/real/module.ts')).toBeUndefined();
  });

  it('emits every entry when scanUsage is false', () => {
    const plugin = traitEnforcer({ traitMap: MAP, scanUsage: false, include: [] });
    const src = call(plugin.load, '\0virtual:trait-manifest') as string;
    expect(src).toContain('"sortable"');
    expect(src).toContain('"export-csv"');
    expect(src).toContain('"nav:list"');
  });

  it('honors a custom virtual id', () => {
    const plugin = traitEnforcer({ traitMap: MAP, virtualId: 'virtual:my-traits' });
    expect(call(plugin.resolveId, 'virtual:my-traits')).toBe('\0virtual:my-traits');
    expect(call(plugin.resolveId, 'virtual:trait-manifest')).toBeUndefined();
  });
});
