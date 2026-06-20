/**
 * Webprocess conformance demo (#1072, slice C of #1026) — the runnable proof of the Self-Driven Project
 * Artefact contract + runtime (#1070 contract, #1071 runtime) in a real browser.
 *
 * The application knows only the contract surface (`Step`/`ProcessRecipe`/`ArtefactRef` + the driving
 * loop): the OPEN meta-schema registries, default-recipe resolution, the dependency-graph frontier, and
 * the tolerance→autonomy throttle. The conformance section asserts each invariant live against the
 * shipped `we:process/` runtime and `setPlaygroundReady` reports the pass count the e2e smoke reads.
 */
import {
  createDefaultSeam,
  DEFAULT_RECIPE_ID,
  AutonomyLevelRegistry,
  assertStep,
  assertProcessRecipe,
  ArtefactContractError,
  BrokenStepGraphError,
  indexSteps,
  runnableSteps,
  isRunComplete,
  effectiveCeiling,
  defaultToleranceThrottle,
  type Step,
} from '/process/index.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

/** A minimal SDLC step graph: design → code → test(final), used by the frontier/completion checks. */
function sdlc(): Step[] {
  return [
    { id: 'design', after: [], gates: [], autonomyCeiling: 'L3', final: false },
    { id: 'code', after: ['design'], gates: ['lint'], autonomyCeiling: 'L4', final: false },
    { id: 'test', after: ['code'], gates: ['unit'], autonomyCeiling: 'L2', final: true },
  ];
}

/** One conformance invariant of the webprocess contract+runtime — a green badge means it holds live. */
interface Check {
  title: string;
  run: () => boolean;
}

const CHECKS: Check[] = [
  {
    title: 'createDefaultSeam ships the L0–L5 ladder + the webprocess/default recipe',
    run: () => {
      const seam = createDefaultSeam();
      const ladder = seam.autonomyLevels.values();
      return (
        ladder.join(',') === 'L0,L1,L2,L3,L4,L5' &&
        seam.recipe.extends === DEFAULT_RECIPE_ID &&
        seam.toleranceDimensions.has('correctness')
      );
    },
  },
  {
    title: 'assertStep rejects a malformed step at the seam (contract enforcement, never silent)',
    run: () => {
      try {
        assertStep({ id: 'x', after: [], gates: [], autonomyCeiling: 'L3' /* missing final */ });
        return false;
      } catch (e) {
        return e instanceof ArtefactContractError;
      }
    },
  },
  {
    title: 'assertProcessRecipe requires `extends` (config-extends-platform-default)',
    run: () => {
      try {
        assertProcessRecipe({ ceilings: {} }); // no `extends`
        return false;
      } catch (e) {
        return e instanceof ArtefactContractError;
      }
    },
  },
  {
    title: 'indexSteps throws BrokenStepGraphError on a dangling `after` edge',
    run: () => {
      try {
        indexSteps([{ id: 'a', after: ['ghost'], gates: [], autonomyCeiling: 'L1', final: true }]);
        return false;
      } catch (e) {
        return e instanceof BrokenStepGraphError;
      }
    },
  },
  {
    title: 'runnableSteps yields only the dependency frontier (deps complete, not yet done)',
    run: () => {
      const steps = sdlc();
      const atStart = runnableSteps(steps, []).map((s) => s.id);
      const afterDesign = runnableSteps(steps, ['design']).map((s) => s.id);
      return atStart.join() === 'design' && afterDesign.join() === 'code';
    },
  },
  {
    title: 'isRunComplete is true only once a final step is complete',
    run: () => {
      const steps = sdlc();
      return (
        !isRunComplete(steps, ['design', 'code']) && isRunComplete(steps, ['design', 'code', 'test'])
      );
    },
  },
  {
    title: 'effectiveCeiling throttles the nominal ceiling DOWN one rung per low-tolerance dimension',
    run: () => {
      const ladder = new AutonomyLevelRegistry();
      const step: Step = { id: 'code', after: [], gates: [], autonomyCeiling: 'L4', final: false };
      const nominal = effectiveCeiling(step, { extends: DEFAULT_RECIPE_ID }, ladder);
      const throttled = effectiveCeiling(
        step,
        { extends: DEFAULT_RECIPE_ID, tolerance: { correctness: 'low', security: 'low' } },
        ladder,
      );
      return nominal === 'L4' && throttled === 'L2'; // L4 dropped 2 rungs → L2
    },
  },
  {
    title: 'throttle only restricts, never grants — the ceiling floors at L0',
    run: () => {
      const ladder = new AutonomyLevelRegistry();
      const step: Step = { id: 's', after: [], gates: [], autonomyCeiling: 'L1', final: false };
      const floored = effectiveCeiling(
        step,
        { extends: DEFAULT_RECIPE_ID, tolerance: { correctness: 'low', security: 'low', 'blast-radius': 'low' } },
        ladder,
      );
      return floored === 'L0'; // L1 dropped 3 → floored at L0, never below
    },
  },
  {
    title: 'a recipe per-step ceiling override replaces the nominal BEFORE the throttle applies',
    run: () => {
      const ladder = new AutonomyLevelRegistry();
      const step: Step = { id: 'ship', after: [], gates: [], autonomyCeiling: 'L5', final: false };
      const overridden = effectiveCeiling(
        step,
        { extends: DEFAULT_RECIPE_ID, ceilings: { ship: 'L2' }, tolerance: { correctness: 'low' } },
        ladder,
      );
      return overridden === 'L1'; // override L2, then throttle drops 1 → L1
    },
  },
  {
    title: 'the autonomy ladder is OPEN — define() appends a higher rung, rank/min stay coherent',
    run: () => {
      const ladder = new AutonomyLevelRegistry();
      ladder.define('L6');
      return (
        ladder.has('L6') &&
        ladder.rank('L6') === 6 &&
        ladder.min('L6', 'L2') === 'L2' &&
        defaultToleranceThrottle({ correctness: 'low', security: 'medium' }) === 1
      );
    },
  },
];

function runConformance(host: HTMLElement): number {
  const summary = el('div', { class: 'summary' });
  host.append(summary);
  let pass = 0;
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = check.run();
    } catch {
      ok = false;
    }
    if (ok) pass += 1;
    const card = el('div', { class: 'play-card wp-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'wp-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} webprocess contract invariants hold`;
  return pass;
}

function main(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  const conformance = el('section', { class: 'wp-card' });
  conformance.append(el('h2', {}, 'Runtime conformance — self-driven artefact contract + driver'));
  const passCount = runConformance(conformance);
  root.append(conformance);

  setPlaygroundReady(passCount);
}

main();
