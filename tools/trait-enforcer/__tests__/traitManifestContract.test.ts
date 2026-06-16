/**
 * @file traitManifestContract.test.ts
 * @description The neutral trait-manifest contract (#716, keystone of #715). Proves the contract is
 * self-consistent and that the Vite plugin — the reference implementation — derives its scan grammar
 * from the contract (so every per-bundler impl that does the same emits byte-identical results).
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DELIVERY,
  USED_TRAIT_PATTERN_TEMPLATE,
  DELIVERY_OVERRIDE_PATTERN_TEMPLATE,
  TRAIT_NAME_PLACEHOLDER,
  SCAN_FLAGS,
  DELIVERY_OVERRIDE_SUFFIX,
  PRELOAD_OVERRIDE_VALUE,
  CHUNK_ISOLATION,
  MANIFEST_KEY_ORDER,
} from '../traitManifestContract.js';
import { scanTraitsInHtml, scanTraitDeliveryOverrides, generateManifestModule } from '../vite-plugin';

/** Compile a contract pattern template the way a conformant implementation must (escape → substitute). */
const compile = (template: string, name: string) =>
  new RegExp(template.replace(TRAIT_NAME_PLACEHOLDER, name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), SCAN_FLAGS);

describe('trait-manifest contract — neutral SoT (#716)', () => {
  it('fixes the delivery default and the override vocabulary', () => {
    expect(DEFAULT_DELIVERY).toBe('lazy');
    expect(DELIVERY_OVERRIDE_SUFFIX).toBe('-delivery');
    expect(PRELOAD_OVERRIDE_VALUE).toBe('eager');
    expect(MANIFEST_KEY_ORDER).toBe('ascending-lexicographic');
  });

  it('the used-trait pattern matches an attribute token but not a superstring', () => {
    const re = compile(USED_TRAIT_PATTERN_TEMPLATE, 'sortable');
    expect(re.test('<div sortable>')).toBe(true);
    expect(re.test('<div sortable="">')).toBe(true);
    expect(re.test('<div sortableness>')).toBe(false);
  });

  it('the delivery-override pattern matches <trait>-delivery="eager" only', () => {
    const re = compile(DELIVERY_OVERRIDE_PATTERN_TEMPLATE, 'sortable');
    expect(re.test('<ul sortable sortable-delivery="eager">')).toBe(true);
    expect(re.test('<ul sortable sortable-delivery="lazy">')).toBe(false);
  });

  it('encodes the chunk-isolation guarantee (unused → zero bytes; lazy split; eager baked)', () => {
    expect(CHUNK_ISOLATION).toMatchObject({
      unusedEmitsNothing: true, lazyIsCodeSplit: true, preloadStaysSplit: true, eagerIsBakedIn: true,
    });
  });
});

describe('the Vite plugin is the reference implementation of the contract', () => {
  // The plugin's exported scanners must agree, name-for-name, with a scanner compiled straight from the
  // contract templates — i.e. the plugin adds no grammar of its own. This is the equality every other
  // bundler implementation must also satisfy.
  const NAMES = ['sortable', 'export-csv', 'nav:list'];
  const HTML = '<ul sortable nav:list><tr export-csv export-csv-delivery="eager"><div sortable-delivery="eager">';

  it('scanTraitsInHtml == contract-compiled used-trait scan', () => {
    const fromContract = new Set(NAMES.filter((n) => compile(USED_TRAIT_PATTERN_TEMPLATE, n).test(HTML)));
    expect(scanTraitsInHtml(HTML, NAMES)).toEqual(fromContract);
  });

  it('scanTraitDeliveryOverrides == contract-compiled override scan', () => {
    const fromContract = new Set(NAMES.filter((n) => compile(DELIVERY_OVERRIDE_PATTERN_TEMPLATE, n).test(HTML)));
    expect(scanTraitDeliveryOverrides(HTML, NAMES)).toEqual(fromContract);
  });

  it('emits a key-sorted manifest (the MANIFEST_KEY_ORDER determinism rule)', () => {
    const src = generateManifestModule(
      { zeta: '/z', alpha: '/a', mid: '/m' },
      ['zeta', 'alpha', 'mid'],
    );
    const keys = [...src.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
    expect(keys).toEqual([...keys].sort());
  });
});
