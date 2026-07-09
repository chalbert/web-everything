/**
 * webprocess conformance-vector suite (#1800/#1816 pattern, cascade #1294 slice #2295) — the Self-Driven
 * Project Artefact protocol's behavioral corpus. Third slice of the process cascade: the contract
 * (`@webeverything/contracts/webprocess`, #2293) and the FUI runtime (`fui:webprocess/{driver,registry,
 * provider,index}.ts`, #2294) are already relocated; this suite is the build-agnostic proof that ANY
 * conforming driving loop — WE's own, or a foreign PM/CI tool — resolves the same frontier, completion,
 * and throttled-ceiling answers, however it is built (the #506/#899 golden-vectors model).
 *
 * A **synchronous** (clock-free, #1789/#1790) suite: every step is order-only (no `atMs`) — the candidate
 * is a pure step-graph + tolerance-throttle engine, not a temporal one. The vectors judge only the
 * **observable** outcome read through the binding's surfaces — the dependency-graph `runnable` frontier,
 * whether the run is `complete`, the throttled `ceiling` a step is permitted to run at, the OPEN autonomy
 * `ladder`, and that a malformed artefact is rejected at the seam (`error`) — never an impl internal (the
 * registry's private rung array, the driver's `Map` index). Invariants are sourced from the shipped
 * runtime conformance demo (`we:demos/webprocess-conformance-demo.ts`), which asserts the same claims
 * live against `we:process/` in a real browser; this module is the portable, build-agnostic version of
 * that same corpus. The runtime engine impl is FUI's (#1071/#2294, statute #1282); the contract it judges
 * stays WE's `@webeverything/contracts/webprocess`.
 *
 * The runtime *driver* (the #1790-style plateau runner) dispatches each step to FUI's synchronous binding
 * (`fui:webprocess/webprocessConformance.ts`) and grades the trace; this module is the build-agnostic data.
 */
import type { ProcessRecipe, Step } from '../process/contract.js';
import type { ConformanceVectorSuite } from './schema.js';

const CONTRACT = '@webeverything/contracts/webprocess';

/** The default recipe id every project recipe `extends` (config-extends-platform-default, #1071). */
const DEFAULT_RECIPE_ID = 'webprocess/default';

/** A minimal SDLC step graph: design → code(gated) → test(final) — the same shape the demo drives. */
const sdlc: Step[] = [
  { id: 'design', after: [], gates: [], autonomyCeiling: 'L3', final: false },
  { id: 'code', after: ['design'], gates: ['lint'], autonomyCeiling: 'L4', final: false },
  { id: 'test', after: ['code'], gates: ['unit'], autonomyCeiling: 'L2', final: true },
];

const defaultRecipe: ProcessRecipe = { extends: DEFAULT_RECIPE_ID };

export const webprocessSuite: ConformanceVectorSuite = {
  standard: 'webprocess',
  contract: CONTRACT,
  vectors: [
    {
      // The dependency-graph frontier at run start: only the step with no `after` deps is runnable.
      id: 'webprocess/frontier/initial-frontier-is-the-no-dependency-step',
      contract: CONTRACT,
      description: 'runnableSteps yields only the step whose `after` deps are all satisfied (none, at start).',
      steps: [{ do: 'defineSteps', steps: sdlc }],
      expect: { runnable: 'design' },
      observeVia: ['runnable'],
    },
    {
      // Completing the frontier step advances the frontier to the next step whose deps are now satisfied.
      id: 'webprocess/frontier/frontier-advances-once-its-dependency-completes',
      contract: CONTRACT,
      description: 'Completing `design` moves the frontier to `code` (deps complete, not yet done).',
      steps: [{ do: 'defineSteps', steps: sdlc }, { do: 'complete', stepId: 'design' }],
      expect: { runnable: 'code' },
      observeVia: ['runnable'],
    },
    {
      // The loop's stop condition is gated on a *final* step, not merely "no more runnable steps".
      id: 'webprocess/completion/run-is-not-complete-before-a-final-step-completes',
      contract: CONTRACT,
      description: 'isRunComplete is false while every completed step so far is non-final.',
      steps: [
        { do: 'defineSteps', steps: sdlc },
        { do: 'complete', stepId: 'design' },
        { do: 'complete', stepId: 'code' },
      ],
      expect: { complete: false },
      observeVia: ['complete'],
    },
    {
      id: 'webprocess/completion/run-is-complete-once-a-final-step-completes',
      contract: CONTRACT,
      description: 'isRunComplete flips true once the `final: true` step is among the completed ids.',
      steps: [
        { do: 'defineSteps', steps: sdlc },
        { do: 'complete', stepId: 'design' },
        { do: 'complete', stepId: 'code' },
        { do: 'complete', stepId: 'test' },
      ],
      expect: { complete: true },
      observeVia: ['complete'],
    },
    {
      // With no tolerance dial, effectiveCeiling is just the step's nominal ceiling (most-flexible-default).
      id: 'webprocess/ceiling/nominal-ceiling-holds-with-no-tolerance-dial',
      contract: CONTRACT,
      description: 'effectiveCeiling returns the nominal `autonomyCeiling` unchanged when no tolerance is dialed.',
      steps: [
        { do: 'defineSteps', steps: [{ id: 'code', after: [], gates: [], autonomyCeiling: 'L4', final: false }] },
        { do: 'setRecipe', recipe: defaultRecipe },
        { do: 'ceilingFor', stepId: 'code' },
      ],
      expect: { ceiling: 'L4' },
      observeVia: ['ceiling'],
    },
    {
      // The operational-design-domain rule: a `low` tolerance on a dimension drops the ceiling one rung —
      // two low dimensions drop it two rungs (the default throttle, #1071).
      id: 'webprocess/ceiling/low-tolerance-throttles-the-ceiling-down',
      contract: CONTRACT,
      description: 'Two dimensions dialed `low` drop the ceiling two rungs (L4 → L2).',
      steps: [
        { do: 'defineSteps', steps: [{ id: 'code', after: [], gates: [], autonomyCeiling: 'L4', final: false }] },
        {
          do: 'setRecipe',
          recipe: { extends: DEFAULT_RECIPE_ID, tolerance: { correctness: 'low', security: 'low' } },
        },
        { do: 'ceilingFor', stepId: 'code' },
      ],
      expect: { ceiling: 'L2' },
      observeVia: ['ceiling'],
    },
    {
      // The throttle only restricts, never grants — it floors at the least-permission rung, never below.
      id: 'webprocess/ceiling/throttle-floors-at-the-least-permission-rung',
      contract: CONTRACT,
      description: 'Three low dimensions on an L1 step floor the ceiling at L0, never negative.',
      steps: [
        { do: 'defineSteps', steps: [{ id: 's', after: [], gates: [], autonomyCeiling: 'L1', final: false }] },
        {
          do: 'setRecipe',
          recipe: {
            extends: DEFAULT_RECIPE_ID,
            tolerance: { correctness: 'low', security: 'low', 'blast-radius': 'low' },
          },
        },
        { do: 'ceilingFor', stepId: 's' },
      ],
      expect: { ceiling: 'L0' },
      observeVia: ['ceiling'],
    },
    {
      // config-extends-platform-default: a recipe's per-step ceiling override replaces the nominal ceiling
      // BEFORE the tolerance throttle applies, not after.
      id: 'webprocess/ceiling/per-step-override-applies-before-the-throttle',
      contract: CONTRACT,
      description: 'A recipe `ceilings` override (L5→L2) is throttled afterward (one low dimension: L2→L1).',
      steps: [
        { do: 'defineSteps', steps: [{ id: 'ship', after: [], gates: [], autonomyCeiling: 'L5', final: false }] },
        {
          do: 'setRecipe',
          recipe: { extends: DEFAULT_RECIPE_ID, ceilings: { ship: 'L2' }, tolerance: { correctness: 'low' } },
        },
        { do: 'ceilingFor', stepId: 'ship' },
      ],
      expect: { ceiling: 'L1' },
      observeVia: ['ceiling'],
    },
    {
      // Standardize the shape, not a fixed process: the autonomy ladder is an OPEN registry a recipe widens.
      id: 'webprocess/ladder/autonomy-ladder-is-open-for-recipe-extension',
      contract: CONTRACT,
      description: 'defineLevel appends a higher rung; the ladder reports it in ascending-permission order.',
      steps: [{ do: 'defineLevel', level: 'L6' }],
      expect: { ladder: 'L0,L1,L2,L3,L4,L5,L6' },
      observeVia: ['ladder'],
    },
    {
      // Trust-crossing seam guard: a step graph with a dangling `after` edge is rejected, never silently
      // stalling the loop on a dependency that does not exist.
      id: 'webprocess/contract/broken-step-graph-is-rejected-at-the-seam',
      contract: CONTRACT,
      description: 'A step depending on a non-existent step id is caught as a broken graph, never silently driven.',
      steps: [
        {
          do: 'defineSteps',
          steps: [{ id: 'a', after: ['ghost'], gates: [], autonomyCeiling: 'L1', final: true }],
        },
      ],
      expect: { error: 'BrokenStepGraphError' },
      observeVia: ['error'],
    },
    {
      // Trust-crossing seam guard: a malformed artefact (missing a required field) is rejected before it
      // can drive the loop with a bad shape — never silently accepted.
      id: 'webprocess/contract/malformed-artefact-is-rejected-at-the-seam',
      contract: CONTRACT,
      description: 'A step missing its required `final` marker is rejected as a broken artefact contract.',
      steps: [
        {
          do: 'defineSteps',
          steps: [{ id: 'x', after: [], gates: [], autonomyCeiling: 'L3' } as unknown as Step],
        },
      ],
      expect: { error: 'ArtefactContractError' },
      observeVia: ['error'],
    },
  ],
};

export default webprocessSuite;
