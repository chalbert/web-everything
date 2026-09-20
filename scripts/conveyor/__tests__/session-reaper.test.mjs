/**
 * @file scripts/conveyor/__tests__/session-reaper.test.mjs
 * @description The RE-EXPORT CONTRACT of `session-reaper.mjs`. That file was split into `session-reap-plan.mjs` (pure
 *   planner), `session-reap-evidence.mjs` (ground-truth reads) and `session-reap-stop.mjs` (stop mechanics) and stays as the
 *   thin CLI; `skills-src/conveyor/runner.mjs`, `wip-agents.test`, `session-verdicts.test` and others still import every
 *   name from it. The unit cases that used to live here moved with their code, name for name, to `session-reap-plan.test.mjs`,
 *   `session-reap-evidence.test.mjs` and `session-reap-stop.test.mjs`; the real-CLI cases stay in `session-reaper-cli.test.mjs`
 *   (and its `session-reap-*-cli.test.mjs` siblings). This one case is new: it pins that no name was lost in the move.
 */
import { describe, it, expect } from 'vitest';
import * as reaper from '../session-reaper.mjs';
import * as plan from '../session-reap-plan.mjs';
import * as evidence from '../session-reap-evidence.mjs';
import * as stop from '../session-reap-stop.mjs';

/** Every name `session-reaper.mjs` exported before the split, and the module each now lives in. */
const MOVED = {
  plan: ['TERMINAL_REAP_STATES', 'ALREADY_STOPPED_STATES', 'classifySessionReap', 'sessionTarget', 'classifySessionReapWithGroundTruth', 'classifySessionReapWithVerdict', 'sessionReapPlan', 'attentionRows', 'REDISPATCH_ACTIONS', 'hasHandler'],
  evidence: ['MAX_GH_PR_VIEW_CALLS_PER_TICK', 'groundTruthForItem', 'groundTruthForPr', 'makeGroundTruthResolver'],
  stop: ['STOP_RETRY_ATTEMPTS', 'STOP_RETRY_BACKOFF_MS', 'stopSessionWithRetry', 'clearStuckSessionAutoConfirm', 'attemptClearStuckSession'],
};
const MODULES = { plan, evidence, stop };

describe('session-reaper.mjs — the re-export facade over the split modules', () => {
  it('exports exactly the 19 names it always did, each the SAME binding as in the module it moved to', () => {
    const expected = Object.values(MOVED).flat().sort();
    expect(expected).toHaveLength(19);
    expect(Object.keys(reaper).sort()).toEqual(expected);
    for (const [mod, names] of Object.entries(MOVED)) {
      for (const name of names) expect(reaper[name], `${name} from ${mod}`).toBe(MODULES[mod][name]);
    }
  });
});
