/**
 * Self-Driven Project Artefact protocol — the **driving loop** (#1026, slice #1071).
 *
 * The runtime that *reads and drives* the everything-as-code artefact structure: given a run's steps (the
 * webworkflows dependency graph), the set of completed step ids, and the effective recipe, it answers the
 * two questions a conforming tool (WE's own loop, or a foreign PM/CI tool) asks each tick —
 *  1. **What is runnable now?** A step whose `after` dependencies are all complete and that is not yet
 *     complete — the dependency-graph frontier (`runnableSteps`).
 *  2. **How much autonomy is permitted on it?** The step's nominal `autonomyCeiling`, throttled DOWN by the
 *     recipe's tolerance dial (`effectiveCeiling`) — the operational-design-domain rule: autonomy is
 *     permitted only inside the domain the tolerance defines, so a low tolerance on any dimension caps the
 *     ceiling more conservatively.
 *
 * This is the impl half of the contract, so it is the home of the **default tolerance→ceiling mapping**
 * (the shipped `webprocess/default` policy): each `low` tolerance on a dimension drops the autonomy ceiling
 * by one rung (floored at the least-permission level). A recipe overrides the mapping by registering a
 * custom `ToleranceThrottle`; the default is the most-conservative-safe flavor. The driver never *runs* the
 * work — it computes the frontier + the ceiling; a consumer (an agent loop) acts within that envelope.
 */
import type { ProcessRecipe, Step, ToleranceLevel, ToleranceProfile } from './contract.js';
import { assertStep } from './provider.js';
import { AutonomyLevelRegistry } from './registry.js';

/** The run referenced a dependency / step that does not exist among the run's steps (broken graph edge). */
export class BrokenStepGraphError extends Error {
  constructor(stepId: string, missing: string) {
    super(`Step "${stepId}" depends on "${missing}", which is not a step in the run`);
    this.name = 'BrokenStepGraphError';
  }
}

/**
 * Maps a tolerance profile to how many autonomy rungs to drop. The default throttle drops one rung per
 * dimension dialed to `low` (the most-conservative-safe flavor). A recipe may register a custom throttle.
 */
export type ToleranceThrottle = (profile: ToleranceProfile) => number;

/** The shipped default throttle: each dimension at `low` tolerance drops the autonomy ceiling one rung. */
export const defaultToleranceThrottle: ToleranceThrottle = (profile) => {
  const dropPerLevel: Record<ToleranceLevel, number> = { low: 1, medium: 0, high: 0 };
  let drop = 0;
  for (const level of Object.values(profile)) {
    if (level) drop += dropPerLevel[level];
  }
  return drop;
};

/**
 * Validate the step graph is internally consistent: every `after` edge points at a real step. Returns the
 * steps keyed by id. Throws `BrokenStepGraphError` on a dangling edge — caught before the loop drives, so a
 * malformed run never silently stalls (a step waiting on a non-existent dependency).
 */
export function indexSteps(steps: readonly Step[]): Map<string, Step> {
  const byId = new Map<string, Step>();
  for (const raw of steps) {
    const step = assertStep(raw);
    byId.set(step.id, step);
  }
  for (const step of byId.values()) {
    for (const dep of step.after) {
      if (!byId.has(dep)) throw new BrokenStepGraphError(step.id, dep);
    }
  }
  return byId;
}

/**
 * The dependency-graph frontier: steps that are **runnable now** — not yet complete, with every `after`
 * dependency already in `completed`. The order mirrors the input order (stable, reviewable). A run is
 * **done** when this is empty and a `final` step is complete.
 */
export function runnableSteps(steps: readonly Step[], completed: Iterable<string>): Step[] {
  const byId = indexSteps(steps);
  const done = new Set(completed);
  const runnable: Step[] = [];
  for (const step of byId.values()) {
    if (done.has(step.id)) continue;
    if (step.after.every((dep) => done.has(dep))) runnable.push(step);
  }
  return runnable;
}

/** Whether the run has reached a completed terminal step — the loop's stop condition. */
export function isRunComplete(steps: readonly Step[], completed: Iterable<string>): boolean {
  const done = new Set(completed);
  return steps.some((s) => s.final && done.has(s.id));
}

/**
 * The **effective autonomy ceiling** for a step: its nominal `autonomyCeiling` throttled DOWN by the
 * recipe's tolerance dial. The default throttle drops one rung per `low`-tolerance dimension; the result is
 * floored at the least-permission level (never below `L0`/index 0 — the throttle only restricts, never
 * grants). A recipe's per-step `ceilings` override the nominal ceiling *before* the throttle applies.
 *
 * @param ladder the autonomy registry (open ladder) supplying the rung order + the conservative `min`.
 * @param throttle the tolerance→rungs-dropped policy (defaults to the shipped `webprocess/default`).
 */
export function effectiveCeiling(
  step: Step,
  recipe: ProcessRecipe,
  ladder: AutonomyLevelRegistry,
  throttle: ToleranceThrottle = defaultToleranceThrottle,
): Step['autonomyCeiling'] {
  // A recipe per-step ceiling override replaces the nominal ceiling first (config-extends-platform-default).
  const nominal = recipe.ceilings?.[step.id] ?? step.autonomyCeiling;
  const order = ladder.values();
  const nominalRank = ladder.rank(nominal);
  const drop = recipe.tolerance ? throttle(recipe.tolerance) : 0;
  const flooredRank = Math.max(0, nominalRank - drop);
  return order[flooredRank];
}

/** A fresh autonomy ladder seeded with the default flavor — the driver's default rung order. */
export function defaultLadder(): AutonomyLevelRegistry {
  return new AutonomyLevelRegistry();
}
