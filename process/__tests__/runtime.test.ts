/**
 * Self-Driven Project Artefact protocol runtime (#1026/#1071): the OPEN meta-schema registries
 * (autonomy ladder, tolerance dimensions), the trust-boundary artefact guards, the driving loop
 * (runnable frontier + tolerance-throttled effective ceiling), and the default seam wiring. Mirrors
 * `reliability/__tests__/registry.test.ts`. Pins the contract the future foreign-tool conformance must
 * not drift from.
 */
import { describe, it, expect } from 'vitest';
import {
  // registries
  AutonomyLevelRegistry,
  ToleranceDimensionRegistry,
  UnknownMetaSchemaMemberError,
  DEFAULT_AUTONOMY_LADDER,
  DEFAULT_TOLERANCE_DIMENSIONS,
  // provider guards
  assertArtefactRef,
  assertGateDefinition,
  assertStep,
  assertProcessRecipe,
  assertToleranceProfile,
  ArtefactContractError,
  ARTEFACT_KINDS,
  GATE_SEVERITIES,
  TOLERANCE_LEVELS,
  // driver
  runnableSteps,
  isRunComplete,
  effectiveCeiling,
  indexSteps,
  defaultLadder,
  defaultToleranceThrottle,
  BrokenStepGraphError,
  // default wiring
  createDefaultSeam,
  DEFAULT_RECIPE,
  DEFAULT_RECIPE_ID,
  type Step,
} from '../index.js';

const step = (id: string, after: string[] = [], ceiling = 'L3', final = false): Step => ({
  id,
  after,
  gates: [],
  autonomyCeiling: ceiling,
  final,
});

describe('AutonomyLevelRegistry (open ladder)', () => {
  it('seeds the default L0–L5 flavor in ascending-permission order', () => {
    expect(new AutonomyLevelRegistry().values()).toEqual([...DEFAULT_AUTONOMY_LADDER]);
  });

  it('has the autonomyLevels localName', () => {
    expect(new AutonomyLevelRegistry().localName).toBe('autonomyLevels');
  });

  it('ranks levels by ascending permission', () => {
    const r = new AutonomyLevelRegistry();
    expect(r.rank('L0')).toBe(0);
    expect(r.rank('L5')).toBe(5);
  });

  it('define() appends a custom level as the highest permission (open registry)', () => {
    const r = new AutonomyLevelRegistry();
    r.define('L6-superuser');
    expect(r.values().at(-1)).toBe('L6-superuser');
    expect(r.rank('L6-superuser')).toBe(6);
  });

  it('define() is a no-op for an already-registered level (preserves the slot)', () => {
    const r = new AutonomyLevelRegistry();
    r.define('L2');
    expect(r.values()).toEqual([...DEFAULT_AUTONOMY_LADDER]);
  });

  it('insertAfter() splices a mid-ladder rung', () => {
    const r = new AutonomyLevelRegistry();
    r.insertAfter('L2', 'L2.5');
    expect(r.values()).toEqual(['L0', 'L1', 'L2', 'L2.5', 'L3', 'L4', 'L5']);
  });

  it('insertAfter() throws for an unknown anchor', () => {
    expect(() => new AutonomyLevelRegistry().insertAfter('LX', 'LY')).toThrow(UnknownMetaSchemaMemberError);
  });

  it('rank() throws for an unregistered level', () => {
    expect(() => new AutonomyLevelRegistry().rank('LX')).toThrow(UnknownMetaSchemaMemberError);
  });

  it('min() returns the more conservative (lower-permission) level', () => {
    const r = new AutonomyLevelRegistry();
    expect(r.min('L4', 'L1')).toBe('L1');
    expect(r.min('L0', 'L0')).toBe('L0');
  });
});

describe('ToleranceDimensionRegistry (open dial)', () => {
  it('seeds the default dimension flavor', () => {
    expect(new ToleranceDimensionRegistry().values()).toEqual([...DEFAULT_TOLERANCE_DIMENSIONS]);
  });

  it('has the toleranceDimensions localName', () => {
    expect(new ToleranceDimensionRegistry().localName).toBe('toleranceDimensions');
  });

  it('define() registers a custom dimension; no-op when already present', () => {
    const r = new ToleranceDimensionRegistry();
    r.define('cost');
    r.define('security'); // already present
    expect(r.has('cost')).toBe(true);
    expect(r.values().filter((d) => d === 'security')).toHaveLength(1);
  });
});

describe('trust-boundary artefact guards', () => {
  it('exposes the closed kind / severity / tolerance sets', () => {
    expect(ARTEFACT_KINDS).toContain('gate');
    expect(GATE_SEVERITIES).toEqual(['error', 'warning', 'info']);
    expect(TOLERANCE_LEVELS).toEqual(['low', 'medium', 'high']);
  });

  it('assertArtefactRef accepts a discoverable + metadata-bearing ref', () => {
    const ref = assertArtefactRef({ kind: 'gate', ref: 'gates/lint', metadata: { owner: 'ci' } });
    expect(ref.kind).toBe('gate');
    expect(ref.metadata).toEqual({ owner: 'ci' });
  });

  it('assertArtefactRef rejects an unknown kind and an empty ref', () => {
    expect(() => assertArtefactRef({ kind: 'bogus', ref: 'x' })).toThrow(ArtefactContractError);
    expect(() => assertArtefactRef({ kind: 'gate', ref: '' })).toThrow(ArtefactContractError);
    expect(() => assertArtefactRef(null)).toThrow(ArtefactContractError);
  });

  it('assertGateDefinition validates the binding shape + audited waiver', () => {
    const gate = assertGateDefinition({
      id: 'lint',
      command: 'npm run lint',
      severity: 'error',
      scope: 'code',
      waiver: { until: '2026-12-31', reason: 'flaky upstream' },
    });
    expect(gate.id).toBe('lint');
    expect(gate.waiver?.reason).toBe('flaky upstream');
  });

  it('assertGateDefinition rejects a waiver missing its audited reason', () => {
    expect(() =>
      assertGateDefinition({ id: 'g', command: 'c', severity: 'error', waiver: { until: '2026-01-01', reason: '' } }),
    ).toThrow(ArtefactContractError);
  });

  it('assertStep validates the webworkflows shape', () => {
    const s = assertStep({ id: 'test', after: ['code'], gates: ['lint'], autonomyCeiling: 'L3', final: false });
    expect(s.after).toEqual(['code']);
  });

  it('assertStep rejects a non-boolean final and non-string edges', () => {
    expect(() => assertStep({ id: 's', after: [], gates: [], autonomyCeiling: 'L3', final: 'no' })).toThrow(ArtefactContractError);
    expect(() => assertStep({ id: 's', after: [1], gates: [], autonomyCeiling: 'L3', final: false })).toThrow(ArtefactContractError);
  });

  it('assertProcessRecipe requires extends (config-extends-platform-default)', () => {
    expect(() => assertProcessRecipe({})).toThrow(ArtefactContractError);
    const r = assertProcessRecipe({ extends: DEFAULT_RECIPE_ID, ceilings: { ship: 'L1' }, tolerance: { security: 'low' } });
    expect(r.extends).toBe(DEFAULT_RECIPE_ID);
    expect(r.ceilings).toEqual({ ship: 'L1' });
  });

  it('assertToleranceProfile rejects an out-of-scale level but allows an open dimension key', () => {
    expect(assertToleranceProfile({ 'custom-dim': 'high' })).toEqual({ 'custom-dim': 'high' });
    expect(() => assertToleranceProfile({ correctness: 'extreme' })).toThrow(ArtefactContractError);
  });
});

describe('driving loop', () => {
  const steps: Step[] = [
    step('design'),
    step('code', ['design']),
    step('test', ['code']),
    step('ship', ['test'], 'L4', true),
  ];

  it('runnableSteps returns the dependency frontier', () => {
    expect(runnableSteps(steps, []).map((s) => s.id)).toEqual(['design']);
    expect(runnableSteps(steps, ['design']).map((s) => s.id)).toEqual(['code']);
    expect(runnableSteps(steps, ['design', 'code', 'test']).map((s) => s.id)).toEqual(['ship']);
  });

  it('runnableSteps excludes completed steps', () => {
    expect(runnableSteps(steps, ['design', 'code', 'test', 'ship'])).toEqual([]);
  });

  it('indexSteps throws BrokenStepGraphError on a dangling dependency', () => {
    expect(() => indexSteps([step('a', ['ghost'])])).toThrow(BrokenStepGraphError);
  });

  it('isRunComplete is true once a final step is done', () => {
    expect(isRunComplete(steps, ['design', 'code', 'test'])).toBe(false);
    expect(isRunComplete(steps, ['design', 'code', 'test', 'ship'])).toBe(true);
  });

  it('effectiveCeiling is the nominal ceiling with no tolerance dial', () => {
    expect(effectiveCeiling(step('ship', [], 'L4'), DEFAULT_RECIPE, defaultLadder())).toBe('L4');
  });

  it('effectiveCeiling throttles down one rung per low-tolerance dimension', () => {
    const recipe = { extends: DEFAULT_RECIPE_ID, tolerance: { security: 'low' as const } };
    expect(effectiveCeiling(step('ship', [], 'L4'), recipe, defaultLadder())).toBe('L3');
    const two = { extends: DEFAULT_RECIPE_ID, tolerance: { security: 'low' as const, 'blast-radius': 'low' as const } };
    expect(effectiveCeiling(step('ship', [], 'L4'), two, defaultLadder())).toBe('L2');
  });

  it('effectiveCeiling floors at the least-permission level (never below L0)', () => {
    const recipe = {
      extends: DEFAULT_RECIPE_ID,
      tolerance: { correctness: 'low' as const, security: 'low' as const, 'blast-radius': 'low' as const },
    };
    expect(effectiveCeiling(step('x', [], 'L1'), recipe, defaultLadder())).toBe('L0');
  });

  it('effectiveCeiling applies a recipe per-step ceiling override before the throttle', () => {
    const recipe = { extends: DEFAULT_RECIPE_ID, ceilings: { ship: 'L5' }, tolerance: { security: 'low' as const } };
    expect(effectiveCeiling(step('ship', [], 'L2'), recipe, defaultLadder())).toBe('L4'); // override L5 → throttle 1 → L4
  });

  it('defaultToleranceThrottle counts only low dimensions', () => {
    expect(defaultToleranceThrottle({ correctness: 'high', security: 'medium' })).toBe(0);
    expect(defaultToleranceThrottle({ correctness: 'low', security: 'low' })).toBe(2);
  });
});

describe('default seam wiring', () => {
  it('createDefaultSeam returns seeded registries + the default recipe', () => {
    const seam = createDefaultSeam();
    expect(seam.autonomyLevels.values()).toEqual([...DEFAULT_AUTONOMY_LADDER]);
    expect(seam.toleranceDimensions.values()).toEqual([...DEFAULT_TOLERANCE_DIMENSIONS]);
    expect(seam.recipe.extends).toBe(DEFAULT_RECIPE_ID);
  });

  it('DEFAULT_RECIPE is the fully-defined root flavor with no overrides', () => {
    expect(DEFAULT_RECIPE).toEqual({ extends: DEFAULT_RECIPE_ID });
  });

  it('createDefaultSeam returns independent recipe instances', () => {
    expect(createDefaultSeam().recipe).not.toBe(createDefaultSeam().recipe);
  });
});
