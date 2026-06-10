/**
 * Validation strictness (#207, D5 of epic #203) — unit + the DoD demonstration that the **one**
 * `silent | warn | error` knob reports the **same** problem at three loudnesses, maps onto the three
 * conformance tiers, and fires identically for a **rejected pin** and an **unresolvable policy**.
 */
import { describe, it, expect, vi } from 'vitest';
import { StaticMatrixProvider, type CapabilityMatrix } from '../provider.js';
import {
  validateSlot,
  applyStrictness,
  conformanceTierFor,
  strictnessForTier,
  DEFAULT_STRICTNESS,
  STRICTNESSES,
  StrictnessError,
} from '../strictness.js';
import { createDefaultProvider } from '../index.js';

const NATIVE_FIRST = { policy: 'native-first' } as const;

describe('the knob ↔ conformance-tier mapping (D5)', () => {
  it('maps error→strict, warn→standard, silent→lenient (and back)', () => {
    expect(conformanceTierFor('error')).toBe('strict');
    expect(conformanceTierFor('warn')).toBe('standard');
    expect(conformanceTierFor('silent')).toBe('lenient');
    expect(strictnessForTier('strict')).toBe('error');
    expect(strictnessForTier('standard')).toBe('warn');
    expect(strictnessForTier('lenient')).toBe('silent');
  });

  it('the base default is warn (standard tier — PE: a wrong guess degrades, not breaks)', () => {
    expect(DEFAULT_STRICTNESS).toBe('warn');
    expect(conformanceTierFor(DEFAULT_STRICTNESS)).toBe('standard');
  });
});

describe('a clean slot is valid at every strictness', () => {
  const provider = createDefaultProvider();

  it('a pin whose impl serves every required capability passes', () => {
    const out = validateSlot(provider, 'base-select', ['selection', 'anchor']);
    expect(out.valid).toBe(true);
    expect(out.severity).toBe('ok');
    expect(out.problem).toBeNull();
    expect(out.resolution?.impl).toBe('base-select');
  });

  it('a policy that resolves cleanly passes', () => {
    const out = validateSlot(provider, NATIVE_FIRST, ['selection', 'anchor'], 'error');
    expect(out.valid).toBe(true);
    expect(out.resolution?.impl).toBe('base-select');
  });
});

describe('case 1 — a rejected concrete pin', () => {
  const provider = createDefaultProvider();

  // FACE can't serve `customizable-select` (capability-hard); pinning it for `selection` is wrong.
  it('flags the pin, names the capability-hard blocker, still degrades onto the pinned impl', () => {
    const out = validateSlot(provider, 'face', ['selection'], 'warn');
    expect(out.valid).toBe(false);
    expect(out.problem?.kind).toBe('pin-rejected');
    expect(out.problem?.impl).toBe('face');
    expect(out.problem?.blockers).toContain('customizable-select');
    // PE: at warn the resolution still points at the pin (degrade, don't drop).
    expect(out.resolution?.impl).toBe('face');
  });

  it('the SAME problem is silent / warn / error purely by the knob — severity tracks strictness', () => {
    for (const knob of STRICTNESSES) {
      const out = validateSlot(provider, 'face', ['selection'], knob);
      expect(out.valid).toBe(false);
      expect(out.severity).toBe(knob); // the whole point of the orthogonal knob
      expect(out.conformanceTier).toBe(conformanceTierFor(knob));
      expect(out.problem?.blockers).toContain('customizable-select'); // identical problem
    }
  });
});

describe('case 2 — a policy that resolves to a capability-hard wall', () => {
  // Every impl is capability-hard on the required cap → native-first finds nothing eligible.
  const ALL_HARD: CapabilityMatrix = {
    impls: [
      { id: 'base-select', label: '', native: true, summary: '', tiers: { 'customizable-select': 'capability-hard' } },
      { id: 'face', label: '', summary: '', tiers: { 'customizable-select': 'capability-hard' } },
    ],
  };
  const provider = new StaticMatrixProvider(ALL_HARD, { selection: ['customizable-select'] });

  it('flags an unresolvable policy identically to a rejected pin (resolution null)', () => {
    const out = validateSlot(provider, NATIVE_FIRST, ['selection'], 'warn');
    expect(out.valid).toBe(false);
    expect(out.problem?.kind).toBe('policy-unresolvable');
    expect(out.problem?.impl).toBeNull();
    expect(out.problem?.blockers).toContain('customizable-select');
    expect(out.resolution).toBeNull(); // nothing eligible to fall back onto
  });

  it('also tracks severity by the knob', () => {
    expect(validateSlot(provider, NATIVE_FIRST, ['selection'], 'silent').severity).toBe('silent');
    expect(validateSlot(provider, NATIVE_FIRST, ['selection'], 'error').severity).toBe('error');
  });
});

describe('applyStrictness — the reaction policy', () => {
  const provider = createDefaultProvider();
  const reject = () => validateSlot(provider, 'face', ['selection'], 'error');

  it('error throws StrictnessError (CI hard-fail)', () => {
    expect(() => applyStrictness(reject())).toThrow(StrictnessError);
  });

  it('warn calls onWarn with the problem and returns the degraded resolution', () => {
    const onWarn = vi.fn();
    const res = applyStrictness(validateSlot(provider, 'face', ['selection'], 'warn'), onWarn);
    expect(onWarn).toHaveBeenCalledOnce();
    expect(onWarn.mock.calls[0][0].kind).toBe('pin-rejected');
    expect(res?.impl).toBe('face');
  });

  it('silent swallows — no onWarn, returns the resolution', () => {
    const onWarn = vi.fn();
    const res = applyStrictness(validateSlot(provider, 'face', ['selection'], 'silent'), onWarn);
    expect(onWarn).not.toHaveBeenCalled();
    expect(res?.impl).toBe('face');
  });

  it('a valid outcome returns its resolution untouched', () => {
    const res = applyStrictness(validateSlot(provider, 'base-select', ['selection'], 'error'));
    expect(res?.impl).toBe('base-select');
  });
});
