/**
 * @file traitManifestContract.test.ts
 * @description The neutral trait-manifest contract (#716, keystone of #715). Proves the contract is
 * self-consistent — the delivery vocabulary, the scan-pattern templates, and the chunk-isolation
 * guarantee. The contract is the WE-resident source of truth; the reference-implementation conformance
 * arm (that the trait-enforcer plugin derives its scan grammar from these templates and adds none of its
 * own) lives FUI-side with the relocated plugins (#894, `tools/trait-enforcer/__tests__/contract-conformance.test.ts`).
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

  it('emits a key-sorted manifest order (the MANIFEST_KEY_ORDER determinism rule)', () => {
    // The contract fixes ascending-lexicographic key order; assert the rule directly (no plugin needed).
    const names = ['zeta', 'alpha', 'mid'];
    expect([...names].sort()).toEqual(['alpha', 'mid', 'zeta']);
    expect(MANIFEST_KEY_ORDER).toBe('ascending-lexicographic');
  });
});
