/**
 * @file design-pixels-adapter.test.mjs — proof of the #2657 design-pixels subject adapter (S5 of epic #2649):
 *   the #2576 design lens-set (usability / visual / a11y / design-systems), the grounding-method registry with
 *   the DEFERRED screenshot-vs-target method, the touch-set classifier, and that the adapter conforms to the
 *   #2656 F2 `SUBJECT_ADAPTER_CONTRACT` and drives `resolveAdapterRoster` exactly like the reference adapter.
 */
import { describe, it, expect } from 'vitest';
import {
  DESIGN_PIXEL_LENSES,
  DESIGN_PIXEL_LENS_SET,
  DESIGN_PIXEL_MANDATORY_LENSES,
  DESIGN_PIXEL_METHODS,
  DESIGN_PIXEL_METHOD_REGISTRY,
  DESIGN_PIXEL_DEFERRED_METHODS,
  DESIGN_PIXEL_LENS_DEFAULT_METHOD,
  isDesignPixelMethodDeferred,
  classifyDesignTouchSet,
  designMethodsForLens,
  buildDesignMandate,
  DESIGN_PIXELS_ADAPTER,
} from '../design-pixels-adapter.mjs';
import { validateSubjectAdapter, resolveAdapterRoster } from '../jury-core.mjs';

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

  it('registers screenshot-vs-target as DEFERRED (registered for provenance, not callable yet)', () => {
    const screenshot = DESIGN_PIXEL_METHOD_REGISTRY.find((m) => m.id === DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET);
    expect(screenshot.deferred).toBe(true);
    expect(screenshot.deferredReason).toMatch(/visual-diff/i);
    expect(DESIGN_PIXEL_DEFERRED_METHODS.has(DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET)).toBe(true);
    expect(isDesignPixelMethodDeferred(DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET)).toBe(true);
  });

  it('the callable methods (heuristic-review, axe-scan) are NOT deferred', () => {
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

  it('the visual lens notes the DEFERRED screenshot grounding (judge by eye, no automated diff)', () => {
    const m = buildDesignMandate({ lens: 'visual' });
    expect(m).toMatch(/screenshot-vs-target grounding is NOT available/i);
    expect(m).toMatch(/by eye/i);
  });

  it('the deferred-visual note fires when the lens is named via `mandate` too (reference-adapter shape)', () => {
    // buildMandate/buildPanelMandate carry the lens as `mandate` — the note must not be silently dropped.
    expect(buildDesignMandate({ mandate: 'visual' })).toMatch(/screenshot-vs-target grounding is NOT available/i);
    expect(buildDesignMandate({ mandate: ['visual'] })).toMatch(/screenshot-vs-target grounding is NOT available/i);
    // a non-visual lens named either way carries NO such note
    expect(buildDesignMandate({ mandate: 'usability' })).not.toMatch(/screenshot-vs-target grounding is NOT/i);
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
    // the visual seat's recorded method is deferred — provenance is complete, the runner must guard before calling
    expect(isDesignPixelMethodDeferred(bySeat.visual.methods[0])).toBe(true);
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
