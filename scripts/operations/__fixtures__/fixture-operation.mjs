/**
 * @file scripts/operations/__fixtures__/fixture-operation.mjs
 * @description THE FIXTURE OPERATION #3032's acceptance names — one declaration exercising all four step
 *   kinds, in a module (not inline in a test) so a SECOND PROCESS can load the same declaration and resume
 *   a run this one started.
 *
 * IT IS NOT A REAL OPERATION. #3032 builds the machine and declares nothing onto it — the first real
 * declaration is #3035 (`review-pr`). This fixture is shaped LIKE that one, deliberately: its effect step
 * declares the #2964 pair (the durable comment, then the label swap) so the executor's ordering and replay
 * guarantees are exercised against the actual defect they subsume.
 *
 * PURE. No fs, no clock, no process. The sinks that would apply its effects live in the caller.
 */

import { op, createRegistry } from '../registry.mjs';
import { compute, confirm, effect, judge } from '../step-kinds.mjs';

/** The fixture's operation name. */
export const FIXTURE_OP = 'fixture-review';

/** The JSON Schema the fixture's judge step would enforce on a juror (never spawned in tests). */
export const FIXTURE_JUDGE_SHAPE = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['verdict'],
  properties: {
    verdict: { type: 'string', enum: ['accept', 'changes'] },
    reasons: { type: 'array', items: { type: 'string' } },
  },
});

/** The four-kind declaration. Built fresh per call so no test can leak state into another. */
export function fixtureOperation() {
  return op(FIXTURE_OP, {
    input: {
      pr: 'number',
      note: { type: 'string', required: false, default: '' },
    },
    // The panel's answer IS the run's verdict — declared, not inferred.
    verdictFrom: 'panel',

    // 1. compute — a pure fn over its declared reads. Stands in for `gh pr diff`.
    diff: compute({
      reads: ['input.pr'],
      fn: (view) => `--- a/pr-${view.input.pr}\n+++ b/pr-${view.input.pr}\n+one changed line\n`,
    }),

    // 2. judge — DECLARES the juror call (`judgeSpawn`'s option shape, #3028). Spawns nothing.
    panel: judge({
      reads: ['findings.diff'],
      request: (view) => ({
        mandate: 'You are a reviewer. Return a verdict on the diff on stdin.',
        input: view.findings.diff,
        shape: FIXTURE_JUDGE_SHAPE,
        model: 'sonnet',
        effort: 'medium',
      }),
    }),

    // 3. confirm — the human stop, as machinery. Suspends recording what is asked and of whom.
    humanOk: confirm({
      reads: ['verdict'],
      asks: (view) => `The panel returned "${view.verdict?.verdict}". Accept it?`,
      of: 'operator',
      options: ['accept', 'changes'],
    }),

    // 4. effect — DECLARES two effects and applies neither. The #2964 pair, in the safe order: the durable
    //    record first, the label the drain acts on second. The label swap is idempotent (setting a label
    //    twice is the same label); posting a comment is not.
    land: effect({
      reads: ['input.pr', 'verdict', 'findings.humanOk'],
      effects: (view) => [
        { type: 'comment.post', payload: { pr: view.input.pr, body: `verdict: ${view.verdict?.verdict}` } },
        { type: 'label.swap', payload: { pr: view.input.pr, label: view.findings.humanOk === 'accept' ? 'review:accepted' : 'review:changes' }, idempotent: true },
      ],
    }),
  });
}

/** An isolated registry holding just the fixture — what tests and the child-process helper both use. */
export function fixtureRegistry() {
  const registry = createRegistry();
  registry.register(fixtureOperation());
  return registry;
}

/** A canned juror answer, so no test ever needs a model. Shaped to {@link FIXTURE_JUDGE_SHAPE}. */
export const FIXTURE_JUDGE_ANSWER = Object.freeze({ verdict: 'accept', reasons: ['the one changed line is fine'] });
