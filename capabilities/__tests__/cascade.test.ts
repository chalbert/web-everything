/**
 * Scoped binding cascade (#207, D6 of epic #203) — unit + the DoD demonstration:
 *   - **nearest-scope-wins** per field across base → app → view → fragment;
 *   - an **un-overriding child inherits the slot as written** (a policy stays a policy) and
 *     **re-resolves it in its own context** — the SAME inherited `native-first` lands on the *native*
 *     impl in a Chrome-context view and a *custom* impl in a Safari-context view (not frozen);
 *   - a more specific scope can **override the inherited policy with a pin**;
 *   - the cascade composes with the D5 strictness knob.
 */
import { describe, it, expect } from 'vitest';
import { StaticMatrixProvider, type Capability, type CapabilityMatrix } from '../provider.js';
import {
  cascade,
  resolveScoped,
  resolveScopedSlot,
  SCOPES,
  UnboundSlotError,
  MalformedCascadeError,
  type ScopeBinding,
} from '../cascade.js';
import type { PlatformSupport, VenueConfig } from '../venues.js';

const NATIVE_FIRST = { policy: 'native-first' } as const;
const INTENT_MAP = { anchor: ['anchor-positioning', 'popover'] };

// Two providers that differ ONLY in whether the native substrate can serve anchor-positioning —
// a Chrome-class context (native-ok) vs a Safari-class context (capability-hard on native).
const CHROME: CapabilityMatrix = {
  impls: [
    { id: 'base-select', label: 'base-select', native: true, summary: '', tiers: { 'anchor-positioning': 'native-ok', popover: 'native-ok' } },
    { id: 'face', label: 'FACE', summary: '', tiers: { 'anchor-positioning': 'polyfill-ok', popover: 'native-ok' } },
  ],
};
const SAFARI: CapabilityMatrix = {
  impls: [
    { id: 'base-select', label: 'base-select', native: true, summary: '', tiers: { 'anchor-positioning': 'capability-hard', popover: 'native-ok' } },
    { id: 'face', label: 'FACE', summary: '', tiers: { 'anchor-positioning': 'polyfill-ok', popover: 'native-ok' } },
  ],
};
const chromeProvider = new StaticMatrixProvider(CHROME, INTENT_MAP);
const safariProvider = new StaticMatrixProvider(SAFARI, INTENT_MAP);

describe('scope order', () => {
  it('is broad→specific: base, app, view, fragment', () => {
    expect(SCOPES).toEqual(['base', 'app', 'view', 'fragment']);
  });
});

describe('cascade — nearest-scope-wins per field', () => {
  it('the most specific scope that sets a field wins; an unset field inherits', () => {
    const chain: ScopeBinding[] = [
      { scope: 'base', slot: NATIVE_FIRST, strictness: 'warn' },
      { scope: 'app', strictness: 'error' }, // overrides strictness only
      { scope: 'view', slot: 'face' }, // overrides slot
      { scope: 'fragment', slot: 'base-select' }, // overrides slot again — fragment is nearest
    ];
    const eff = cascade(chain);
    expect(eff.slot).toBe('base-select');
    expect(eff.slotSource).toBe('fragment');
    expect(eff.strictness).toBe('error');
    expect(eff.strictnessSource).toBe('app');
  });

  it('an unset strictness anywhere falls to the warn default (strictnessSource null)', () => {
    const eff = cascade([{ scope: 'base', slot: NATIVE_FIRST }]);
    expect(eff.strictness).toBe('warn');
    expect(eff.strictnessSource).toBeNull();
  });

  it('a child that sets nothing inherits the slot AS WRITTEN — a policy stays a policy', () => {
    const eff = cascade([
      { scope: 'app', slot: NATIVE_FIRST },
      { scope: 'view' }, // sets nothing
    ]);
    expect(eff.slot).toEqual(NATIVE_FIRST); // still the policy object, not a resolved impl id
    expect(eff.slotSource).toBe('app');
  });
});

describe('DoD demo — inherited native-first re-resolves per context (not frozen)', () => {
  // app binds native-first; each view supplies only its own provider context and inherits the policy.
  const chromeView: ScopeBinding[] = [
    { scope: 'app', slot: NATIVE_FIRST },
    { scope: 'view', provider: chromeProvider },
  ];
  const safariView: ScopeBinding[] = [
    { scope: 'app', slot: NATIVE_FIRST },
    { scope: 'view', provider: safariProvider },
  ];

  it('Chrome view: inherited native-first → the native base-select impl', () => {
    const { effective, outcome } = resolveScoped(chromeView, ['anchor']);
    expect(effective.slotSource).toBe('app'); // inherited, not set on the view
    expect(outcome.valid).toBe(true);
    expect(outcome.resolution?.impl).toBe('base-select');
  });

  it('Safari view: the SAME inherited native-first → the custom face impl', () => {
    const { effective, outcome } = resolveScoped(safariView, ['anchor']);
    expect(effective.slot).toEqual(NATIVE_FIRST); // same slot value as the Chrome view
    expect(outcome.resolution?.impl).toBe('face'); // re-resolved in Safari's context
  });

  it('proves it is not frozen: identical inherited slot, divergent resolution by context', () => {
    const a = resolveScoped(chromeView, ['anchor']);
    const b = resolveScoped(safariView, ['anchor']);
    expect(a.effective.slot).toEqual(b.effective.slot); // same as-written policy
    expect(a.outcome.resolution?.impl).not.toBe(b.outcome.resolution?.impl); // different leaf result
  });
});

describe('a specific scope overrides the inherited policy with a pin', () => {
  it('fragment pins face over the inherited native-first; the pin short-circuits resolution', () => {
    const chain: ScopeBinding[] = [
      { scope: 'app', slot: NATIVE_FIRST },
      { scope: 'view', provider: safariProvider },
      { scope: 'fragment', slot: 'face' }, // explicit pin beats the inherited policy
    ];
    const { effective, outcome } = resolveScoped(chain, ['anchor']);
    expect(effective.slot).toBe('face');
    expect(effective.slotSource).toBe('fragment');
    expect(outcome.resolution?.pinned).toBe(true);
    expect(outcome.valid).toBe(true); // face serves anchor-positioning via polyfill on Safari
  });
});

describe('cascade ∘ strictness — a pin rejected in the leaf context, at the inherited knob', () => {
  it('pinning base-select in Safari (capability-hard on anchor-positioning) flags pin-rejected', () => {
    const chain: ScopeBinding[] = [
      { scope: 'base', strictness: 'error' },
      { scope: 'app', slot: NATIVE_FIRST },
      { scope: 'view', provider: safariProvider },
      { scope: 'fragment', slot: 'base-select' }, // wrong pin for this context
    ];
    const { outcome } = resolveScoped(chain, ['anchor']);
    expect(outcome.valid).toBe(false);
    expect(outcome.problem?.kind).toBe('pin-rejected');
    expect(outcome.problem?.blockers).toContain('anchor-positioning');
    expect(outcome.severity).toBe('error'); // the inherited strictness from the base
  });
});

describe('resolveScopedSlot + fallback provider', () => {
  it('resolves the inherited slot against a fallback provider when no scope set one', () => {
    const chain: ScopeBinding[] = [{ scope: 'base', slot: NATIVE_FIRST }];
    const { resolution } = resolveScopedSlot(chain, ['anchor'], chromeProvider);
    expect(resolution.impl).toBe('base-select');
  });
});

describe('malformed cascades throw', () => {
  it('no scope binds a slot → UnboundSlotError (no magic-on-absence)', () => {
    expect(() => cascade([{ scope: 'app', strictness: 'warn' }])).toThrow(UnboundSlotError);
  });

  it('out-of-order or duplicated scopes → MalformedCascadeError', () => {
    expect(() => cascade([{ scope: 'view', slot: 'face' }, { scope: 'app', slot: 'face' }])).toThrow(
      MalformedCascadeError,
    );
    expect(() => cascade([{ scope: 'app', slot: 'face' }, { scope: 'app', slot: 'face' }])).toThrow(
      MalformedCascadeError,
    );
  });

  it('no provider in the cascade and no fallback → cannot resolve', () => {
    expect(() => resolveScoped([{ scope: 'base', slot: NATIVE_FIRST }], ['anchor'])).toThrow(
      MalformedCascadeError,
    );
  });
});

describe('venue — the authored where/when field (#220)', () => {
  // A vocabulary + matrix where the venue *flips the winner*: on `build` the native substrate wins;
  // under a degrading venue that finds the UA-privileged `customizable-select` absent, the native cell
  // walls (capability class → capability-hard), so native-first falls through to the custom impl.
  const VOCAB: Capability[] = [
    { id: 'customizable-select', label: '', webFeaturesKey: 'customizable-select', baseline: false, polyfill: 'capability', summary: '' },
    { id: 'popover', label: '', webFeaturesKey: 'popover', baseline: '2024', polyfill: 'polyfillable', summary: '' },
  ];
  const MATRIX: CapabilityMatrix = {
    impls: [
      { id: 'base-select', label: 'base-select', native: true, summary: '', tiers: { 'customizable-select': 'native-ok', popover: 'native-ok' } },
      { id: 'face', label: 'FACE', summary: '', tiers: { 'customizable-select': 'polyfill-ok', popover: 'native-ok' } },
    ],
  };
  const VENUE_INTENTS = { selection: ['customizable-select', 'popover'] };
  const buildBase = new StaticMatrixProvider(MATRIX, VENUE_INTENTS);
  // The degraded reality this venue reports: the privileged select isn't actually there.
  const support: PlatformSupport = (id) => (id === 'customizable-select' ? false : undefined);
  const venueConfig: VenueConfig = { base: buildBase, vocabulary: VOCAB, support };

  describe('cascades nearest-scope-wins, defaulting to build', () => {
    it('a nearer scope overrides the venue; the source is tracked', () => {
      const eff = cascade([
        { scope: 'base', slot: NATIVE_FIRST, venue: 'build' },
        { scope: 'app', venue: 'edge' },
      ]);
      expect(eff.venue).toBe('edge');
      expect(eff.venueSource).toBe('app');
    });

    it('an unset venue anywhere falls to the build default (venueSource null, no magic-on-absence)', () => {
      const eff = cascade([{ scope: 'base', slot: NATIVE_FIRST }]);
      expect(eff.venue).toBe('build');
      expect(eff.venueSource).toBeNull();
    });
  });

  describe('an authored venue is turned into the provider via providerForVenue (no code change)', () => {
    it('venue: build → resolves against the static matrix → the native base-select impl', () => {
      const { effective, outcome } = resolveScoped(
        [{ scope: 'base', slot: NATIVE_FIRST, venue: 'build' }],
        ['selection'],
        undefined,
        venueConfig,
      );
      expect(effective.venue).toBe('build');
      expect(outcome.resolution?.impl).toBe('base-select');
    });

    it('venue: edge → routes through the degrading provider → native walls, falls to face', () => {
      const { effective, outcome } = resolveScoped(
        [{ scope: 'base', slot: NATIVE_FIRST, venue: 'edge' }],
        ['selection'],
        undefined,
        venueConfig,
      );
      expect(effective.venue).toBe('edge');
      expect(outcome.resolution?.impl).toBe('face'); // base-select's customizable-select degraded to capability-hard
    });
  });

  it('an explicit provider overrides the venue (the escape hatch)', () => {
    // The view pins an explicit build-context provider; the inherited venue: edge is ignored for resolution.
    const { effective, outcome } = resolveScoped(
      [
        { scope: 'base', slot: NATIVE_FIRST, venue: 'edge' },
        { scope: 'view', provider: buildBase },
      ],
      ['selection'],
      undefined,
      venueConfig,
    );
    expect(effective.venue).toBe('edge'); // the venue value still cascades…
    expect(effective.providerSource).toBe('view'); // …but the explicit provider produced the context
    expect(outcome.resolution?.impl).toBe('base-select'); // build-context result, not the edge-degraded one
  });

  it('a venue with no VenueConfig is not realized — it falls to the given fallback (no magic)', () => {
    const { outcome } = resolveScoped(
      [{ scope: 'base', slot: NATIVE_FIRST, venue: 'edge' }],
      ['selection'],
      buildBase, // fallback provider, but no venueConfig to realize the venue
    );
    expect(outcome.resolution?.impl).toBe('base-select'); // fallback used; venue stayed declarative
  });
});
