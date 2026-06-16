/**
 * Unit tests for trait chunks on the MaaS served path (backlog #719). Proves the framework-agnostic
 * integration that brings code-split traits onto the #461 origin: a trait rides the same #505
 * `<name>[@<pin>].js` route as a component artifact, and a #716 manifest is turned into the #462
 * eager-inline / lazy-default / preload-at-bootstrap fetch plan. Pure functions, no server, no DOM.
 */
import { describe, it, expect } from 'vitest';
import {
  traitServePath,
  planTraitDistribution,
} from '../../../renderers/module-service/traitServePath';
import { CACHE_POLICY, DEFAULT_BASE_PATH } from '../../../renderers/module-service/servePathIR';
import type { TraitManifest } from '../../../../tools/trait-enforcer/traitManifestContract';

describe('traitServePath', () => {
  it('builds an unpinned URL on the default /_maas/ route', () => {
    expect(traitServePath('sortable')).toBe(`${DEFAULT_BASE_PATH}sortable.js`);
  });

  it('fills the pin segment when a content hash is given', () => {
    expect(traitServePath('sortable', { pin: 'sha256-abc' })).toBe(
      `${DEFAULT_BASE_PATH}sortable@sha256-abc.js`,
    );
  });

  it('honours a custom base path', () => {
    expect(traitServePath('highlight', { basePath: '/cdn/' })).toBe('/cdn/highlight.js');
  });
});

describe('planTraitDistribution', () => {
  // A manifest spanning all three #716 delivery shapes.
  const manifest: TraitManifest = {
    highlight: { delivery: 'eager', attribute: {} },
    sortable: () => Promise.resolve({}),
    revealable: { delivery: 'lazy', preload: true, load: () => Promise.resolve({}) },
  };

  it('inlines eager traits (never fetched)', () => {
    const plan = planTraitDistribution(manifest);
    expect(plan.inlineEager).toEqual(['highlight']);
    // an eager trait appears in neither fetch bucket
    expect(plan.lazy.find((d) => d.trait === 'highlight')).toBeUndefined();
    expect(plan.preload.find((d) => d.trait === 'highlight')).toBeUndefined();
  });

  it('serves lazy traits on demand and preload traits at bootstrap', () => {
    const plan = planTraitDistribution(manifest);
    expect(plan.lazy.map((d) => d.trait)).toEqual(['sortable']);
    expect(plan.preload.map((d) => d.trait)).toEqual(['revealable']);
    expect(plan.lazy[0].url).toBe(`${DEFAULT_BASE_PATH}sortable.js`);
    expect(plan.preload[0].delivery).toBe('preload');
  });

  it('serves an unpinned chunk floating and a pinned chunk immutable (#505 cache policy)', () => {
    const plan = planTraitDistribution(manifest, { pins: { sortable: 'sha256-xyz' } });
    const sortable = plan.lazy.find((d) => d.trait === 'sortable')!;
    expect(sortable.url).toBe(`${DEFAULT_BASE_PATH}sortable@sha256-xyz.js`);
    expect(sortable.cache).toBe(CACHE_POLICY.immutable);
    // revealable has no pin → floating
    expect(plan.preload[0].cache).toBe(CACHE_POLICY.floating);
  });

  it('is deterministic — traits emit in ascending-lexicographic order', () => {
    const m: TraitManifest = {
      zebra: () => Promise.resolve({}),
      alpha: () => Promise.resolve({}),
      mango: () => Promise.resolve({}),
    };
    expect(planTraitDistribution(m).lazy.map((d) => d.trait)).toEqual(['alpha', 'mango', 'zebra']);
  });
});
