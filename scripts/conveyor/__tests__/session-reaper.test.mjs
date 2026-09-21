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
// CATCH-UP MERGE (2026-09-21): `main`'s repo-aware ground-truth cases came in on this file (they predate the
// split). They are kept verbatim and driven through the FACADE's own re-exports, which is also a second, live
// proof that the re-export contract above really does bind the split modules' behaviour, not just their names.
import { sessionTarget, makeGroundTruthResolver, groundTruthForPr, sessionReapPlan } from '../session-reaper.mjs';

const bg = (over = {}) => ({ id: 'abc12345', cwd: '/repo', kind: 'background', startedAt: 1, sessionId: 'abc12345-0000-0000-0000-000000000000', name: 'conveyor-1', ...over });

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

describe('repo-aware ground truth', () => {
  // CATCH-UP MERGE (2026-09-21): these three cases came from `main`. What is kept unchanged is the REPO axis
  // they exist for — a tagged slug names its repo, and every `gh pr view` carries an explicit `--repo`. What is
  // ADAPTED is their reap/keep and call-count expectations: `main`'s reaper upgraded a `working` row to `reap`
  // on a resolver answer alone and cached one answer across repos, while THIS branch's `sessionReapPlan` routes
  // the same question through `classifySessionReapWithVerdict` (the #3383 verdict axis) and resolves per row.
  // The differing half is recorded as UNRESOLVED-BY-JUDGMENT in this merge's own report, not silently dropped.
  it('parses a repo-TAGGED PR slug, and leaves an untagged one repo-less', () => {
    expect(sessionTarget('review-fui-49')).toEqual({ kind: 'pr', id: '49', repo: 'frontierui' });
    expect(sessionTarget('review-49')).toEqual({ kind: 'pr', id: '49' });
    expect(sessionTarget('review-nope-49')).toBeNull();
  });

  it('sends an EXPLICIT --repo on every lookup, derived from the slug\'s own tag', () => {
    const calls = [];
    const groundTruthFor = makeGroundTruthResolver({ exec: (file, args) => {
      calls.push([file, args]);
      return JSON.stringify({ state: args.includes('chalbert/frontierui') ? 'OPEN' : 'MERGED' });
    } });
    const listing = ['review-49', 'review-fui-49', 'fix-fui-49'].map((name) => bg({ name, sessionId: name, state: 'working' }));
    sessionReapPlan(listing, { groundTruthFor });
    expect(calls.map(([, args]) => args[args.indexOf('--repo') + 1]))
      .toEqual(['chalbert/web-everything', 'chalbert/frontierui', 'chalbert/frontierui']);
    expect(calls.every(([file, args]) => file === 'gh' && args[0] === 'pr' && args[1] === 'view' && args[2] === '49')).toBe(true);
  });

  it('keeps sessions on unknown repo or gh failure', () => {
    const listing = [bg({ name: 'review-fui-49', state: 'working' })];
    const exec = () => { throw new Error('gh failed'); };
    expect(groundTruthForPr(49, { repo: 'unknown', exec: () => { throw new Error('must not call'); } })).toBeNull();
    for (const groundTruthFor of [makeGroundTruthResolver({ exec }), () => groundTruthForPr(49, { repo: 'unknown', exec })]) {
      const plan = sessionReapPlan(listing, { groundTruthFor });
      expect(plan.reap).toEqual([]);
      expect(plan.keep).toHaveLength(1);
    }
  });

  it('shares the lookup cap across repos', () => {
    let calls = 0;
    const groundTruthFor = makeGroundTruthResolver({ maxPrViewCalls: 1, exec: () => {
      calls += 1; return '{"state":"MERGED"}';
    } });
    const sessions = ['review-49', 'review-fui-49'].map((name) => bg({ name, state: 'working' }));
    sessionReapPlan(sessions, { groundTruthFor });
    // ONE `gh` call total across BOTH repos — the cap is global, not per repo.
    expect(calls).toBe(1);
  });
});
