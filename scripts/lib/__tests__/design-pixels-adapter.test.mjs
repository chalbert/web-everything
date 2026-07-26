/**
 * @file design-pixels-adapter.test.mjs — proof of the #2657 design-pixels subject adapter (S5 of epic #2649):
 *   the #2576 design lens-set (usability / visual / a11y / design-systems), the grounding-method registry with
 *   the DEFERRED screenshot-vs-target method, the touch-set classifier, and that the adapter conforms to the
 *   #2656 F2 `SUBJECT_ADAPTER_CONTRACT` and drives `resolveAdapterRoster` exactly like the reference adapter.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DESIGN_PIXEL_LENSES,
  DESIGN_PIXEL_LENS_SET,
  DESIGN_PIXEL_MANDATORY_LENSES,
  DESIGN_PIXEL_METHODS,
  DESIGN_PIXEL_METHOD_REGISTRY,
  DESIGN_PIXEL_DEFERRED_METHODS,
  DESIGN_PIXEL_LENS_DEFAULT_METHOD,
  DESIGN_PIXEL_METHOD_RUNNERS,
  isDesignPixelMethodDeferred,
  classifyDesignTouchSet,
  designMethodsForLens,
  groundVisualLens,
  runnerForDesignMethod,
  buildDesignMandate,
  DESIGN_PIXELS_ADAPTER,
} from '../design-pixels-adapter.mjs';
import { validateSubjectAdapter, resolveAdapterRoster } from '../jury-core.mjs';
import { writePng } from '../png-io.mjs';

/** Build a solid-colour RGBA image of a given size — a minimal fixture the comparator can diff. */
function solid(width, height, [r, g, b, a = 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  }
  return { width, height, data };
}

describe('the #2576 design lens-set (#2657)', () => {
  it('is exactly usability / visual / a11y / design-systems', () => {
    expect(DESIGN_PIXEL_LENS_SET).toEqual(['usability', 'visual', 'a11y', 'design-systems']);
    expect(DESIGN_PIXEL_LENSES).toEqual({
      USABILITY: 'usability',
      VISUAL: 'visual',
      A11Y: 'a11y',
      DESIGN_SYSTEMS: 'design-systems',
    });
  });

  it('makes usability + a11y (the grounded invariants) mandatory — never the deferred-grounded visual', () => {
    expect(DESIGN_PIXEL_MANDATORY_LENSES).toEqual(['usability', 'a11y']);
    expect(DESIGN_PIXEL_MANDATORY_LENSES).not.toContain(DESIGN_PIXEL_LENSES.VISUAL);
  });
});

describe('the grounding-method registry + the DEFERRED screenshot method (#2657)', () => {
  it('grounds each lens: heuristic-review → usability + design-systems, axe → a11y, screenshot → visual', () => {
    expect(DESIGN_PIXEL_LENS_DEFAULT_METHOD).toEqual({
      usability: DESIGN_PIXEL_METHODS.HEURISTIC_REVIEW,
      'design-systems': DESIGN_PIXEL_METHODS.HEURISTIC_REVIEW,
      a11y: DESIGN_PIXEL_METHODS.AXE_SCAN,
      visual: DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET,
    });
  });

  it('registers screenshot-vs-target as CALLABLE — no longer deferred once the comparator wired in (#2671)', () => {
    const screenshot = DESIGN_PIXEL_METHOD_REGISTRY.find((m) => m.id === DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET);
    expect(screenshot.deferred).toBe(false);
    expect(screenshot).not.toHaveProperty('deferredReason');
    expect(DESIGN_PIXEL_DEFERRED_METHODS.has(DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET)).toBe(false);
    expect(isDesignPixelMethodDeferred(DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET)).toBe(false);
  });

  it('no method is deferred today — every registered method is callable (#2671)', () => {
    expect(DESIGN_PIXEL_DEFERRED_METHODS.size).toBe(0);
    for (const m of DESIGN_PIXEL_METHOD_REGISTRY) expect(m.deferred).toBe(false);
    expect(isDesignPixelMethodDeferred(DESIGN_PIXEL_METHODS.HEURISTIC_REVIEW)).toBe(false);
    expect(isDesignPixelMethodDeferred(DESIGN_PIXEL_METHODS.AXE_SCAN)).toBe(false);
    expect(isDesignPixelMethodDeferred('bogus')).toBe(false);
  });

  it('designMethodsForLens returns the lens default (incl. the deferred one for visual), [] for an unknown lens', () => {
    expect(designMethodsForLens('usability')).toEqual([DESIGN_PIXEL_METHODS.HEURISTIC_REVIEW]);
    expect(designMethodsForLens('a11y')).toEqual([DESIGN_PIXEL_METHODS.AXE_SCAN]);
    expect(designMethodsForLens('visual')).toEqual([DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET]);
    expect(designMethodsForLens('design-systems')).toEqual([DESIGN_PIXEL_METHODS.HEURISTIC_REVIEW]);
    // an unknown lens (e.g. a subject-neutral care-band lens the design subject does not ground) → []
    expect(designMethodsForLens('correctness')).toEqual([]);
    // fresh array — never reaches back into the default index
    const m = designMethodsForLens('usability');
    m.push('x');
    expect(DESIGN_PIXEL_LENS_DEFAULT_METHOD.usability).toBe(DESIGN_PIXEL_METHODS.HEURISTIC_REVIEW);
  });
});

describe('classifyDesignTouchSet — the design touch-set classifier (#2657)', () => {
  it('a design with surfaces earns usability + a11y + design-systems (visual only WITH a target)', () => {
    expect(classifyDesignTouchSet({ surfaces: ['home'] }).lenses).toEqual(['usability', 'a11y', 'design-systems']);
    expect(classifyDesignTouchSet({ surfaces: ['home'], hasTarget: true }).lenses)
      .toEqual(['usability', 'a11y', 'design-systems', 'visual']);
  });

  it('accepts a bare surfaces array as input', () => {
    expect(classifyDesignTouchSet(['card', 'modal']).lenses).toEqual(['usability', 'a11y', 'design-systems']);
  });

  it('no surface → no design under review → no lenses (empty-input posture)', () => {
    expect(classifyDesignTouchSet({}).lenses).toEqual([]);
    expect(classifyDesignTouchSet().lenses).toEqual([]);
    expect(classifyDesignTouchSet({ surfaces: [] }).lenses).toEqual([]);
    // a target with no surface is still nothing to review
    expect(classifyDesignTouchSet({ hasTarget: true }).lenses).toEqual([]);
  });

  it('returns the raw signals alongside the lenses', () => {
    expect(classifyDesignTouchSet({ surfaces: ['a', ''], hasTarget: true }))
      .toEqual({ surfaces: ['a'], hasTarget: true, lenses: ['usability', 'a11y', 'design-systems', 'visual'] });
  });
});

describe('buildDesignMandate — framed on the shared subject-neutral skeleton (#2657)', () => {
  it('frames the rendered design and anchors findings to a region', () => {
    const m = buildDesignMandate({ lens: 'usability' });
    expect(m).toContain('reviewing a rendered design');
    expect(m).toContain('usability');
    expect(m).toContain('region');
    expect(m).toContain('RENDERED design');
  });

  it('the visual lens notes the automated grounding + the by-eye fallback on a missing baseline (#2671)', () => {
    const m = buildDesignMandate({ lens: 'visual' });
    expect(m).toMatch(/automated screenshot-vs-target diff grounds this lens/i);
    expect(m).toMatch(/by eye/i);
    expect(m).toMatch(/skip/i);
  });

  it('the visual-grounding note fires when the lens is named via `mandate` too (reference-adapter shape)', () => {
    // buildMandate/buildPanelMandate carry the lens as `mandate` — the note must not be silently dropped.
    expect(buildDesignMandate({ mandate: 'visual' })).toMatch(/automated screenshot-vs-target diff grounds/i);
    expect(buildDesignMandate({ mandate: ['visual'] })).toMatch(/automated screenshot-vs-target diff grounds/i);
    // a non-visual lens named either way carries NO such note
    expect(buildDesignMandate({ mandate: 'usability' })).not.toMatch(/automated screenshot-vs-target diff grounds/i);
  });
});

describe('groundVisualLens — the callable form wiring in the shared comparator (#2671)', () => {
  it('a matching shot vs baseline → grounded, match true, no findings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dp-visual-'));
    try {
      const img = solid(32, 32, [10, 120, 200]);
      const shotPath = join(dir, 'shot.png');
      const baselinePath = join(dir, 'baseline.png');
      writePng(shotPath, img);
      writePng(baselinePath, img);
      const g = groundVisualLens({ shotPath, baselinePath });
      expect(g.method).toBe(DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET);
      expect(g.grounded).toBe(true);
      expect(g.byEye).toBe(false);
      expect(g.skipped).toBe(false);
      expect(g.match).toBe(true);
      expect(g.delta).toBe(0);
      expect(g.findings).toEqual([]);
      expect(g.dimensions).toEqual({ shot: [32, 32], baseline: [32, 32] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a drifted shot → grounded, match false, carries the comparator findings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dp-visual-'));
    try {
      const shotPath = join(dir, 'shot.png');
      const baselinePath = join(dir, 'baseline.png');
      writePng(baselinePath, solid(32, 32, [10, 120, 200]));
      writePng(shotPath, solid(32, 32, [220, 40, 40])); // a whole-canvas recolour
      const g = groundVisualLens({ shotPath, baselinePath });
      expect(g.grounded).toBe(true);
      expect(g.byEye).toBe(false);
      expect(g.match).toBe(false);
      expect(g.delta).toBeGreaterThan(0);
      expect(g.findings.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a MISSING baseline → documented skip → ungrounded, by-eye fallback preserved (never a fail)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dp-visual-'));
    try {
      const shotPath = join(dir, 'shot.png');
      writePng(shotPath, solid(16, 16, [0, 0, 0]));
      const g = groundVisualLens({ shotPath, baselinePath: join(dir, 'nope.png') });
      expect(g.grounded).toBe(false); // no baseline → the automated diff could not run
      expect(g.byEye).toBe(true);     // the juror falls back to a by-eye judgment
      expect(g.skipped).toBe(true);
      expect(g.match).toBeNull();     // a skip makes NO claim — not a false-fail
      expect(g.findings.some((f) => f.kind === 'baseline-missing')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('threshold options pass straight through to the comparator', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dp-visual-'));
    try {
      const shotPath = join(dir, 'shot.png');
      const baselinePath = join(dir, 'baseline.png');
      writePng(baselinePath, solid(32, 32, [10, 120, 200]));
      writePng(shotPath, solid(32, 32, [220, 40, 40]));
      // a wide-open tolerance + threshold makes even a full recolour a match — proving opts reach the engine
      const g = groundVisualLens({ shotPath, baselinePath, pixelTolerance: 255, cellThreshold: 1000 });
      expect(g.grounded).toBe(true);
      expect(g.match).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('runnerForDesignMethod resolves ONLY the in-process method; out-of-process methods → null', () => {
    expect(runnerForDesignMethod(DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET)).toBe(groundVisualLens);
    expect(DESIGN_PIXEL_METHOD_RUNNERS[DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET]).toBe(groundVisualLens);
    // heuristic-review + axe-scan are grounded out of process (subagent / axe tool) — no in-process runner
    expect(runnerForDesignMethod(DESIGN_PIXEL_METHODS.HEURISTIC_REVIEW)).toBeNull();
    expect(runnerForDesignMethod(DESIGN_PIXEL_METHODS.AXE_SCAN)).toBeNull();
    expect(runnerForDesignMethod('bogus')).toBeNull();
    expect(Object.isFrozen(DESIGN_PIXEL_METHOD_RUNNERS)).toBe(true);
  });
});

describe('DESIGN_PIXELS_ADAPTER — conforms to the F2 contract + drives the seam (#2657)', () => {
  it('conforms to the subject-adapter contract and is frozen', () => {
    expect(validateSubjectAdapter(DESIGN_PIXELS_ADAPTER)).toEqual({ valid: true, errors: [] });
    expect(DESIGN_PIXELS_ADAPTER.subject).toBe('design-pixels');
    expect(Object.isFrozen(DESIGN_PIXELS_ADAPTER)).toBe(true);
  });

  it('declares usability + a11y as the mandatory lenses', () => {
    expect(DESIGN_PIXELS_ADAPTER.mandatoryLenses).toEqual(['usability', 'a11y']);
  });

  it('extractTouchSet re-homes classifyDesignTouchSet; resolveMethods re-homes designMethodsForLens', () => {
    expect(DESIGN_PIXELS_ADAPTER.extractTouchSet({ surfaces: ['home'], hasTarget: true }))
      .toEqual(['usability', 'a11y', 'design-systems', 'visual']);
    expect(DESIGN_PIXELS_ADAPTER.resolveMethods('a11y')).toEqual([DESIGN_PIXEL_METHODS.AXE_SCAN]);
    expect(DESIGN_PIXELS_ADAPTER.resolveMethods('visual')).toEqual([DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET]);
  });

  it('resolveAdapterRoster builds a design roster whose seats carry the design lenses + their (deferred) methods', () => {
    const plan = resolveAdapterRoster({
      adapter: DESIGN_PIXELS_ADAPTER,
      careLevel: 'low',
      input: { surfaces: ['home'], hasTarget: true },
    });
    const bySeat = Object.fromEntries(plan.lenses.map((s) => [s.lens, s]));
    // the design lenses ride in as touch-set seats with their grounding methods attached
    expect(bySeat.a11y.methods).toEqual([DESIGN_PIXEL_METHODS.AXE_SCAN]);
    expect(bySeat.a11y.attachedBy).toBe('touch-set');
    expect(bySeat.visual.methods).toEqual([DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET]);
    expect(bySeat.usability.methods).toEqual([DESIGN_PIXEL_METHODS.HEURISTIC_REVIEW]);
    // the visual seat's recorded method is CALLABLE (#2671) — the runner resolves an in-process runner for it
    expect(isDesignPixelMethodDeferred(bySeat.visual.methods[0])).toBe(false);
    expect(runnerForDesignMethod(bySeat.visual.methods[0])).toBe(groundVisualLens);
  });

  it('INVARIANT: every mandatory lens is present in the roster resolved for a REAL design review', () => {
    // the mandatory lenses ride the touch-set, so they must appear whenever there is a design under review —
    // otherwise a downstream derivePanelVerdict over adapter.mandatoryLenses would throw "missing verdict".
    for (const careLevel of ['low', 'elevated', 'high']) {
      const plan = resolveAdapterRoster({
        adapter: DESIGN_PIXELS_ADAPTER,
        careLevel,
        input: { surfaces: ['home'] },
      });
      const seated = new Set(plan.lenses.map((s) => s.lens));
      for (const lens of DESIGN_PIXELS_ADAPTER.mandatoryLenses) expect(seated.has(lens)).toBe(true);
    }
  });

  it('care `none` → empty roster regardless of the design input (nothing escalated, no jury)', () => {
    const plan = resolveAdapterRoster({
      adapter: DESIGN_PIXELS_ADAPTER,
      careLevel: 'none',
      input: { surfaces: ['home'], hasTarget: true },
    });
    expect(plan.lenses).toEqual([]);
  });
});
