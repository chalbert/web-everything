/**
 * design-pixels-adapter.mjs — the DESIGN-PIXELS subject adapter (#2657, S5 of epic #2649).
 *
 * WHY: the jury METHOD lives once in the subject-agnostic core (`jury-core.mjs`, the #2656 F2 seam); each SUBJECT
 * plugs in through a THIN adapter that satisfies `SUBJECT_ADAPTER_CONTRACT`. The reference adapter is
 * `PR_DIFF_ADAPTER` (`review-core.mjs`) — the PR-diff subject. THIS module adds the DESIGN-PIXELS subject: judging
 * a RENDERED design (screenshots / DOM), not a code diff. It declares the #2576 design-review lens-set
 * (usability / visual / a11y / design-systems) and the grounding methods that ground each lens in evidence, then
 * wraps them in a contract-conforming `DESIGN_PIXELS_ADAPTER` that snaps into `resolveAdapterRoster` exactly like
 * the reference adapter does — the core needs to know nothing about pixels.
 *
 * THE #2576 LENS-SET. The jury-refinement method proven on the icon grammar (#2576) judges a UI/design decision
 * under four perspectives: `usability` (is it usable / low-friction?), `visual` (does it match the target design?),
 * `a11y` (is it accessible?), and `design-systems` (does it conform to the system's tokens / patterns?). These are
 * the extra PERSPECTIVE lenses this subject earns (returned by `extractTouchSet`) — the abstract `touchLenses`
 * signal `resolveRoster` merges onto the care band, the same mechanism the PR-diff subject uses for its a11y /
 * visual-vs-target / perf lenses.
 *
 * THE GROUNDING METHODS — and the KNOWN GAP (the DEFERRED screenshot grounding). Each lens is grounded by a tool:
 *   • `usability` + `design-systems` → `design-heuristic-review` — a reviewer subagent judges the rendered design
 *     against usability / design-system heuristics (the callable, ships-now grounding).
 *   • `a11y` → `axe-scan` — an automated accessibility scan over the rendered UI (callable; the same tool id the
 *     PR-diff subject's a11y lens uses, so a runner keys on ONE consistent method-id string across subjects).
 *   • `visual` → `screenshot-vs-target` — a screenshot of the rendered design compared against a target/baseline
 *     image. Per the ratified record + spec, the screenshot-vs-target primitive HAS NO CALLABLE FORM YET: it lives
 *     in the unbuilt visual-diff protocol. So this method is registered here as **DEFERRED** (`deferred: true`) —
 *     the roster still records that the visual lens WOULD be grounded by it (so provenance is complete), but a
 *     runner MUST check `isDesignPixelMethodDeferred` and NOT try to call it. The real screenshot grounding wires
 *     in when the visual-diff primitive lands — a ~size-2 follow-up, out of scope for this slice.
 *
 * Pure — no I/O, no model calls. Unit-tested in `scripts/lib/__tests__/design-pixels-adapter.test.mjs`.
 */
import { buildSubjectMandate } from './jury-core.mjs';

/** The #2576 design-review lenses this subject judges under. A frozen enum so every consumer names them once. */
export const DESIGN_PIXEL_LENSES = Object.freeze({
  USABILITY: 'usability',
  VISUAL: 'visual',
  A11Y: 'a11y',
  DESIGN_SYSTEMS: 'design-systems',
});

/** The full #2576 design lens-set, in the canonical usability / visual / a11y / design-systems order. */
export const DESIGN_PIXEL_LENS_SET = Object.freeze([
  DESIGN_PIXEL_LENSES.USABILITY,
  DESIGN_PIXEL_LENSES.VISUAL,
  DESIGN_PIXEL_LENSES.A11Y,
  DESIGN_PIXEL_LENSES.DESIGN_SYSTEMS,
]);

/**
 * The lenses that must UNANIMOUSLY accept for a design to be judged "ships" (the design analogue of the PR-diff
 * subject's correctness + security). `usability` and `a11y` are the two design invariants that (a) have a CALLABLE
 * grounding today and (b) a design must not fail: an unusable or inaccessible design does not ship regardless of
 * how well it matches the target or the system. `visual` is deliberately NOT mandatory — its `screenshot-vs-target`
 * grounding is DEFERRED (no primitive yet), so gating a land on a lens that cannot be grounded would be unsound;
 * `design-systems` is advisory (conformance is a judgment call a reasonable reviewer can weigh). A tuning knob.
 *
 * INVARIANT (mandatory lenses ride the TOUCH-SET, not the static care band). Unlike the reference `PR_DIFF_ADAPTER`
 * — whose mandatory lenses (correctness / security) are members of the subject-neutral `PANEL_LENSES` that
 * `resolveRoster` ALWAYS prepends, so they are present in every non-`none` roster — this subject's mandatory lenses
 * are its OWN perspective lenses, earned via `extractTouchSet`. They are therefore present exactly when there is a
 * design under review (a non-empty `surfaces` input). A downstream `derivePanelVerdict({ mandatoryLenses })` is only
 * valid over a roster resolved for a REAL review (non-empty touch-set); deriving a panel verdict for an empty input
 * (no surfaces → no design → no jury) is a caller error and `derivePanelVerdict` will surface it as a loud
 * "missing verdict for mandatory lens" throw, never a silent pass — a runner (S6+) must resolve the roster from an
 * actual design before asking for a verdict.
 */
export const DESIGN_PIXEL_MANDATORY_LENSES = Object.freeze([
  DESIGN_PIXEL_LENSES.USABILITY,
  DESIGN_PIXEL_LENSES.A11Y,
]);

/** The methods that can GROUND a design-pixels lens (#2657). A frozen enum so every consumer names a method once. */
export const DESIGN_PIXEL_METHODS = Object.freeze({
  HEURISTIC_REVIEW: 'design-heuristic-review', // a reviewer subagent judges the rendered design against heuristics
  AXE_SCAN: 'axe-scan',                         // an automated accessibility scan over the rendered UI
  SCREENSHOT_VS_TARGET: 'screenshot-vs-target', // a screenshot compared against a target/baseline — DEFERRED (below)
});

/**
 * The design-pixels method registry (#2657) — each method declares WHICH lenses it grounds, a human label, and
 * whether it is DEFERRED. Pure data. `design-heuristic-review` grounds usability + design-systems; `axe-scan`
 * grounds a11y; `screenshot-vs-target` grounds visual but is DEFERRED — its callable primitive (the visual-diff
 * protocol) is not built yet, so a runner registers it for provenance but never calls it (guard with
 * `isDesignPixelMethodDeferred`). `DESIGN_PIXEL_LENS_DEFAULT_METHOD` (below) is the inverted lens→method index
 * derived from this, so the two never drift.
 */
export const DESIGN_PIXEL_METHOD_REGISTRY = Object.freeze([
  Object.freeze({
    id: DESIGN_PIXEL_METHODS.HEURISTIC_REVIEW,
    label: 'design heuristic reviewer (judges the rendered design)',
    grounds: Object.freeze([DESIGN_PIXEL_LENSES.USABILITY, DESIGN_PIXEL_LENSES.DESIGN_SYSTEMS]),
    deferred: false,
  }),
  Object.freeze({
    id: DESIGN_PIXEL_METHODS.AXE_SCAN,
    label: 'axe accessibility scan',
    grounds: Object.freeze([DESIGN_PIXEL_LENSES.A11Y]),
    deferred: false,
  }),
  Object.freeze({
    id: DESIGN_PIXEL_METHODS.SCREENSHOT_VS_TARGET,
    label: 'screenshot compared against a target/baseline',
    grounds: Object.freeze([DESIGN_PIXEL_LENSES.VISUAL]),
    // DEFERRED (#2657): no callable primitive yet — the screenshot-vs-target grounding lives in the unbuilt
    // visual-diff protocol. Registered for provenance; a runner MUST NOT call it until the primitive lands.
    deferred: true,
    deferredReason: 'the screenshot-vs-target grounding primitive (visual-diff protocol) is not built yet',
    unblock: 'a follow-up wires the real screenshot grounding in when the visual-diff primitive lands',
  }),
]);

/** The DEFERRED method ids (#2657) — the methods registered for provenance but with no callable primitive yet.
 *  Derived from the registry so it never drifts. A runner checks this before attempting to invoke a method. */
export const DESIGN_PIXEL_DEFERRED_METHODS = Object.freeze(
  new Set(DESIGN_PIXEL_METHOD_REGISTRY.filter((m) => m.deferred).map((m) => m.id)),
);

/** Is this design-pixels method DEFERRED — registered for provenance but not yet callable (#2657)? Pure. The guard
 *  a runner uses so it records the intended grounding method on the roster seat but never tries to invoke the
 *  screenshot-vs-target primitive before the visual-diff protocol ships. */
export function isDesignPixelMethodDeferred(methodId) {
  return DESIGN_PIXEL_DEFERRED_METHODS.has(methodId);
}

/** lens → its DEFAULT grounding method id, inverted from `DESIGN_PIXEL_METHOD_REGISTRY` so the two are
 *  single-sourced. Every design lens the adapter attaches has a default here. */
export const DESIGN_PIXEL_LENS_DEFAULT_METHOD = Object.freeze(
  DESIGN_PIXEL_METHOD_REGISTRY.reduce((acc, m) => {
    for (const lens of m.grounds) acc[lens] = m.id;
    return acc;
  }, {}),
);

/**
 * Classify a design-pixels review INPUT into the perspective lenses it earns (#2657) — the touch-set analogue of
 * the PR-diff subject's `classifyTouchSet`. Pure. The input DESCRIBES the design under review:
 *   • `surfaces` — the rendered regions / screens being judged (an array; also accepted as the bare array input).
 *   • `hasTarget` — whether a target / baseline design is supplied to compare against.
 * A design with at least one surface earns `usability` + `a11y` + `design-systems` — the three perspectives you can
 * judge from the rendered pixels alone. `visual` (matches-the-target) is earned ONLY when a target is supplied,
 * because the visual lens is a comparison AGAINST that target — mirroring the PR-diff subject's "a page diff
 * additionally earns perf" conditional shape. No surface → no design under review → no lenses (empty), the same
 * empty-input → empty-lenses posture the PR-diff classifier takes.
 * @param {{surfaces?: string[], hasTarget?: boolean}|string[]} [input]
 * @returns {{surfaces: string[], hasTarget: boolean, lenses: string[]}}
 */
export function classifyDesignTouchSet(input = {}) {
  const desc = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const rawSurfaces = Array.isArray(input) ? input : Array.isArray(desc.surfaces) ? desc.surfaces : [];
  const surfaces = rawSurfaces.filter(Boolean).map(String);
  const hasTarget = desc.hasTarget === true;
  const lenses = [];
  if (surfaces.length) {
    lenses.push(DESIGN_PIXEL_LENSES.USABILITY, DESIGN_PIXEL_LENSES.A11Y, DESIGN_PIXEL_LENSES.DESIGN_SYSTEMS);
    if (hasTarget) lenses.push(DESIGN_PIXEL_LENSES.VISUAL);
  }
  return { surfaces, hasTarget, lenses };
}

/**
 * The grounding method(s) for one design-pixels lens (#2657) — the subject's `resolveMethods`. Pure. Returns a
 * FRESH single-element array with the lens's default grounding method, or an EMPTY array for a lens the design
 * registry does not know (e.g. one of the subject-neutral care-band lenses `resolveRoster` prepends — the design
 * subject grounds only its OWN perspective lenses, never the generic panel's). The returned method id may be a
 * DEFERRED one (`screenshot-vs-target` for `visual`) — that is intentional: the roster seat records the intended
 * grounding for provenance, and the runner guards with `isDesignPixelMethodDeferred` before invoking.
 * @param {string} lens
 * @returns {string[]}
 */
export function designMethodsForLens(lens) {
  const method = DESIGN_PIXEL_LENS_DEFAULT_METHOD[lens];
  return method ? [method] : [];
}

/**
 * Build the design-pixels review mandate (#2657) — the subject's `buildMandate`, framed on the subject-neutral
 * `buildSubjectMandate` skeleton (the same skeleton the PR-diff `buildMandate` uses). Pure. Supplies the
 * design-specific parts: the `rendered design` subject noun, the isolation line (the reviewer sees the rendered
 * pixels / DOM, not the source), the `region` finding anchor (a design finding is anchored to a region of the
 * rendered surface, not a source file), and — for the `visual` lens — a body note that the screenshot-vs-target
 * grounding is DEFERRED, so the reviewer judges by eye rather than expecting an automated diff.
 *
 * The lens can be named EITHER as `lens` OR (matching the reference `buildMandate({ mandate: <lens> })` /
 * `buildPanelMandate` convention) as `mandate` — the deferred-`visual` note fires when EITHER names `visual`, so a
 * caller using the reference shape does not silently lose it.
 * @param {{lens?: string, mandate?: string|string[]}} [o]
 * @returns {string}
 */
export function buildDesignMandate({ lens, mandate } = {}) {
  const effectiveMandate = mandate ?? lens ?? DESIGN_PIXEL_LENSES.USABILITY;
  const namesVisual = lens === DESIGN_PIXEL_LENSES.VISUAL
    || mandate === DESIGN_PIXEL_LENSES.VISUAL
    || (Array.isArray(mandate) && mandate.includes(DESIGN_PIXEL_LENSES.VISUAL));
  const bodyLines = [];
  if (namesVisual) {
    bodyLines.push(
      'Automated screenshot-vs-target grounding is NOT available yet (the visual-diff primitive is unbuilt) —',
      'judge the visual match against the target by eye from the rendered design, and say so if no target is shown.',
    );
  }
  return buildSubjectMandate({
    subjectNoun: 'rendered design',
    mandate: effectiveMandate,
    defaultMandate: DESIGN_PIXEL_LENSES.USABILITY,
    isolationLine: 'You see the RENDERED design (screenshots / DOM) — not the source that produced it, no author framing.',
    findingAnchor: 'region',
    bodyLines,
  });
}

/**
 * THE DESIGN-PIXELS SUBJECT ADAPTER (#2657) — the plug that snaps the #2576 design lens-set into the #2656 F2 seam.
 * Conforms to `SUBJECT_ADAPTER_CONTRACT` (validated by `validateSubjectAdapter`), so `resolveAdapterRoster` builds a
 * design-review roster from it exactly as it does from `PR_DIFF_ADAPTER` — the core knows nothing about pixels.
 *   • `extractTouchSet` — the design input → the perspective lenses it earns (`classifyDesignTouchSet`).
 *   • `resolveMethods`  — the design lens → its grounding method (`designMethodsForLens`); `visual`'s method is
 *     DEFERRED (`screenshot-vs-target`), recorded for provenance but not callable yet.
 *   • `mandatoryLenses` — usability + a11y (the two grounded design invariants that gate a land).
 *   • `charterForLens`  — the design-specific juror charter text (passed to `materializeRoster`).
 *   • `buildMandate`    — the design-specific mandate framing (built on `buildSubjectMandate`).
 * Frozen so the adapter is a stable value other modules can import and compare against.
 */
export const DESIGN_PIXELS_ADAPTER = Object.freeze({
  subject: 'design-pixels',
  subjectNoun: 'rendered design',
  mandatoryLenses: DESIGN_PIXEL_MANDATORY_LENSES,
  extractTouchSet: (input) => classifyDesignTouchSet(input).lenses,
  resolveMethods: (lens) => designMethodsForLens(lens),
  charterForLens: (lens) => `judge the rendered design under the "${lens}" lens`,
  buildMandate: buildDesignMandate,
});
