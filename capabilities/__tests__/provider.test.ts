/**
 * Capability provider — unit + the #204 DoD demonstration:
 * a capability id tiered differently across two impls (customizable-select is capability-hard on the
 * FACE build-your-own impl, native-ok on the native base-select impl), and the droplist family's
 * required intents resolving their capability ids through the static build-matrix.
 */
import { describe, it, expect } from 'vitest';
import {
  StaticMatrixProvider,
  resolveIntent,
  intentMapFromIntents,
  UnknownImplError,
  UnknownCapabilityError,
  type CapabilityMatrix,
} from '../provider.js';
import { createDefaultProvider, capabilities } from '../index.js';

const FIXTURE: CapabilityMatrix = {
  impls: [
    { id: 'face', label: 'FACE', summary: '', tiers: { 'customizable-select': 'capability-hard', popover: 'native-ok', 'anchor-positioning': 'polyfill-ok' } },
    { id: 'base-select', label: 'base-select', summary: '', tiers: { 'customizable-select': 'native-ok', popover: 'native-ok', 'anchor-positioning': 'native-ok' } },
  ],
};

describe('StaticMatrixProvider', () => {
  const provider = new StaticMatrixProvider(FIXTURE, { selection: ['customizable-select'], anchor: ['anchor-positioning', 'popover'] });

  it('tiers a capability per impl', () => {
    expect(provider.tier('face', 'customizable-select')).toBe('capability-hard');
    expect(provider.tier('base-select', 'customizable-select')).toBe('native-ok');
  });

  it('enumerates impls for the resolver', () => {
    expect(provider.impls()).toEqual(['face', 'base-select']);
  });

  it('exposes the registered adapter rows (#206) for discovery surfaces', () => {
    const rows = provider.adapters();
    expect(rows.map((r) => r.id)).toEqual(['face', 'base-select']);
    // The row carries the human label/summary, not just the bare id.
    expect(rows[0]).toMatchObject({ id: 'face', label: 'FACE' });
  });

  it('returns the authored required capabilities for an intent, [] for an unmapped one', () => {
    expect(provider.requiredCapabilities('selection')).toEqual(['customizable-select']);
    expect(provider.requiredCapabilities('nonexistent')).toEqual([]);
  });

  it('throws on an unknown impl or an incomplete matrix cell', () => {
    expect(() => provider.tier('nope', 'popover')).toThrow(UnknownImplError);
    expect(() => provider.tier('face', 'not-a-capability')).toThrow(UnknownCapabilityError);
  });

  it('resolves an intent to per-capability tiers on a given impl', () => {
    expect(resolveIntent(provider, 'face', 'anchor')).toEqual([
      { capabilityId: 'anchor-positioning', tier: 'polyfill-ok' },
      { capabilityId: 'popover', tier: 'native-ok' },
    ]);
  });
});

describe('intentMapFromIntents', () => {
  it('keeps only intents that declare requiresCapabilities', () => {
    const map = intentMapFromIntents([
      { id: 'a', requiresCapabilities: ['popover'] },
      { id: 'b' },
      { id: 'c', requiresCapabilities: [] },
    ]);
    expect(map).toEqual({ a: ['popover'] });
  });
});

describe('default provider (shipped vocabulary + matrix + intent map)', () => {
  const provider = createDefaultProvider();

  it('DoD: customizable-select is capability-hard on FACE, native-ok on base-select', () => {
    expect(provider.tier('face', 'customizable-select')).toBe('capability-hard');
    expect(provider.tier('base-select', 'customizable-select')).toBe('native-ok');
  });

  it('DoD: cross-root-aria differs the same way (the genuine combobox a11y blocker)', () => {
    expect(provider.tier('face', 'cross-root-aria')).toBe('capability-hard');
    expect(provider.tier('base-select', 'cross-root-aria')).toBe('native-ok');
  });

  it('the droplist family intents resolve their capability ids through the matrix', () => {
    // The selection intent backs the droplist; it must resolve on at least one native impl.
    const onFace = resolveIntent(provider, 'face', 'selection');
    const onBaseSelect = resolveIntent(provider, 'base-select', 'selection');
    expect(onFace.length).toBeGreaterThan(0);
    // Same required capabilities, different tiers per impl — the whole point of the provider.
    expect(onFace.map((r) => r.capabilityId)).toEqual(onBaseSelect.map((r) => r.capabilityId));
    expect(onFace).not.toEqual(onBaseSelect);
    // base-select serves every selection capability natively; face hits a hard wall.
    expect(onBaseSelect.every((r) => r.tier === 'native-ok')).toBe(true);
    expect(onFace.some((r) => r.tier === 'capability-hard')).toBe(true);
  });

  it('every impl row tiers every capability in the vocabulary (matrix is a complete grid)', () => {
    for (const impl of provider.impls())
      for (const cap of capabilities as Array<{ id: string }>)
        expect(() => provider.tier(impl, cap.id)).not.toThrow();
  });
});

describe('registered adapter table (#206)', () => {
  // The DoD: ownership distributed, storage central — adding a new impl is a *single-row*
  // registration, queried by the provider with no other code change.
  const ONE_CAP: CapabilityMatrix = {
    impls: [{ id: 'base-select', label: 'base-select', native: true, summary: '', tiers: { popover: 'native-ok' } }],
  };

  it('registering one adapter row makes the provider enumerate + tier it — no other change', () => {
    const before = new StaticMatrixProvider(ONE_CAP);
    expect(before.impls()).toEqual(['base-select']);

    // The whole registration: append one row to the central table.
    const withFace: CapabilityMatrix = {
      impls: [...ONE_CAP.impls, { id: 'face', label: 'FACE', summary: '', tiers: { popover: 'polyfill-ok' } }],
    };
    const after = new StaticMatrixProvider(withFace);

    expect(after.impls()).toEqual(['base-select', 'face']);
    expect(after.adapters().map((r) => r.id)).toEqual(['base-select', 'face']);
    expect(after.tier('face', 'popover')).toBe('polyfill-ok'); // queryable straight away
    expect(after.isNative('face')).toBe(false);
    expect(after.isNative('base-select')).toBe(true); // the lone native substrate, unchanged
  });

  it('the shipped table registers the droplist family impls (face + base-select), provider-queried', () => {
    const ids = createDefaultProvider().adapters().map((r) => r.id);
    expect(ids).toContain('face');
    expect(ids).toContain('base-select');
  });
});
