/**
 * @file dispatch-kind-axes.test.mjs — THE `WE_DISPATCH_KIND=fix` TWO-SPAWNER COLLISION, AND ITS RESOLUTION
 *   (#3640). This is the regression file for the blocker `we:backlog/3640-*.md` says must be resolved rather
 *   than worked around; every other test in this lane's diff is ordinary wiring coverage.
 *
 * ── THE DEFECT, STATED SO THE TESTS BELOW CAN BE CHECKED AGAINST IT ─────────────────────────────────────────
 *
 * `WE_DISPATCH_KIND` is stamped on a spawned agent's environment by two spawners that disagreed about what the
 * value MEANS, and `we:scripts/guard-bash.mjs` keys a deny table on it:
 *
 *   * `dispatch-lane-io.mjs#defaultClaudeProvider` stamps the LAUNCH kind (`fix`) on the full-brief agent.
 *     That agent runs its own lifecycle — `we:skills-src/conveyor/fix-agent-brief.md` step 1 is `lane-pool.mjs
 *     acquire`, step 2 is `gh pr view`, step 4 is `verify-lane`. Denying those denies it its own first step.
 *   * `fix-dispatch-wrapper.mjs#buildFixAgentEnv` stamped the SAME value (`fix`) on a RESTRICTED agent whose
 *     wrapper runs every one of those commands for it, and whose own brief
 *     (`we:skills-src/conveyor/fix-agent-brief-v2.md`) forbids it from running them.
 *
 * One value, two opposite correct answers. Wiring the wrapper behind it would mis-harness whichever spawner
 * was not the one being wired, in EITHER direction — which is why the fix is not "add a `dispatchKind ===
 * 'fix'` arm": that arm breaks the agent path, and its absence leaves the wrapper path unguarded.
 *
 * ── WHY THESE TESTS FAIL AGAINST THE PRE-RESOLUTION CODE ────────────────────────────────────────────────────
 *
 * {@link it}('the two fix spawners cannot be told apart …') is the load-bearing one. It takes the stamp each
 * spawner actually produces — not a literal typed into the test — and asserts that ONE command
 * (`lane-pool.mjs acquire`, which the agent-path brief requires and the wrapper-path brief forbids) gets
 * OPPOSITE guard verdicts under them. Before this item both stamps were the string `fix`, so no possible guard
 * table could satisfy both halves and the test fails whichever way `guard-bash.mjs` is written. It also fails
 * against the naive "resolution" of adding a `'fix'` deny arm, because the agent-path half then goes red.
 *
 * NOTHING HERE SPAWNS A PROCESS, shells `gh`, or reads the ambient environment for a decision.
 */

import { describe, it, expect } from 'vitest';

import { decide, reason, WRAPPER_OWNED_AGENTS } from '../../guard-bash.mjs';
import {
  LAUNCH_KINDS,
  REPAIR_AGENT_KIND,
  WRAPPER_AGENT_KINDS,
  assertDispatchKindAxesDisjoint,
} from '../dispatch-lane.mjs';
import { buildFixAgentEnv } from '../fix-dispatch-wrapper.mjs';
import { createDispatchSinks } from '../dispatch-lane-io.mjs';
import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
import { DISPATCH_PROVIDER_REGISTRY } from '../dispatch-provider-registry.mjs';

/** Every registered mechanical kind forced onto the AGENT path — how a test reaches `defaultClaudeProvider`. */
const AGENT_MODES = Object.fromEntries(Object.keys(DISPATCH_PROVIDER_REGISTRY).map((k) => [k, 'agent']));

/**
 * THE STAMP THE AGENT PATH ACTUALLY PRODUCES for a launch kind — recovered by running the real sink over a real
 * payload and reading the env `defaultClaudeProvider` handed the spawn. Deliberately NOT a literal: a test that
 * typed `'fix'` here would keep passing if the production stamp changed, which is the whole failure mode.
 */
async function agentPathStampFor(launchKind) {
  const calls = [];
  const sinks = createDispatchSinks({
    modes: AGENT_MODES,
    root: '/primary/webeverything',
    spawnAgent: (argv, opts) => { calls.push(opts); return 'backgrounded · a9a9a9a9 · x\n'; },
    mintSessionId: () => 'sess-1',
  });
  await sinks[DISPATCH_EFFECT]({
    num: '3629', pr: 2108, lane: 5, sessionSlug: `${launchKind}-2108`, prompt: '# go', launchKind,
  });
  return calls[0].env.WE_DISPATCH_KIND;
}

/** The stamp the WRAPPER path actually produces — likewise read off the production function, not typed. */
function wrapperPathStamp() {
  return buildFixAgentEnv({
    sessionSlug: 'fix-2108', pr: 2108, item: '3629', lanePath: '/pool/lane-3', reportsDir: '/r',
  }).WE_DISPATCH_KIND;
}

/** The commands the AGENT-path fix brief requires of the agent ITSELF, and the wrapper-path brief forbids.
 *  Read off the two briefs rather than invented — see this file's header. */
const CONTESTED_COMMANDS = Object.freeze([
  'node scripts/lane-pool.mjs acquire --purpose=conveyor-fix --session=fix-2108',
  'gh pr view 2108 --json headRefName,comments',
  'node scripts/verify-lane.mjs request',
]);

describe('#3640 — the WE_DISPATCH_KIND=fix collision', () => {
  it('THE REGRESSION: the two fix spawners produce DIFFERENT stamps, so one command can get opposite verdicts', async () => {
    const agentStamp = await agentPathStampFor('fix');
    const wrapperStamp = wrapperPathStamp();

    // Half 1 — they are distinguishable at all. Before #3640 both were `'fix'` and this line alone fails.
    expect(agentStamp).not.toBe(wrapperStamp);

    for (const command of CONTESTED_COMMANDS) {
      // Half 2 — the AGENT-path fixer is ALLOWED its own brief's steps. A `dispatchKind === 'fix'` deny arm
      // (the naive "resolution") makes this half fail instead of the first.
      expect(decide(command, { dispatchKind: agentStamp }), `agent path: ${command}`).toBeNull();
      // Half 3 — the WRAPPER-path fixer is DENIED the very same commands, because its wrapper runs them.
      expect(decide(command, { dispatchKind: wrapperStamp }), `wrapper path: ${command}`).not.toBeNull();
    }
  });

  it('the wrapper stamp is a WRAPPER-AGENT kind and never a launch kind — the shape of the resolution', async () => {
    const wrapperStamp = wrapperPathStamp();
    expect(WRAPPER_AGENT_KINDS).toContain(wrapperStamp);
    expect(LAUNCH_KINDS).not.toContain(wrapperStamp);
    // And symmetrically: the agent path never stamps a wrapper-agent kind, for ANY launch kind.
    for (const kind of LAUNCH_KINDS) {
      const stamp = await agentPathStampFor(kind);
      expect(stamp).toBe(kind);
      expect(WRAPPER_AGENT_KINDS).not.toContain(stamp);
    }
  });

  it('`delivery` is the PRECEDENT this follows, not a new idea — the build wrapper already did it', () => {
    // #3627 chose `delivery` over `build` for the wrapper-spawned build agent and never wrote down why. That
    // choice is the entire resolution, generalised: assert it is still the shape, so a future "simplification"
    // that re-stamps the delivery agent with its launch kind trips here rather than in production.
    expect(WRAPPER_AGENT_KINDS).toEqual(['delivery', 'repair']);
    expect(LAUNCH_KINDS.some((k) => WRAPPER_AGENT_KINDS.includes(k))).toBe(false);
  });

  it('the disjointness invariant is CHECKED, not merely documented', () => {
    expect(assertDispatchKindAxesDisjoint()).toBe(true);
    // The failure it exists to catch: a wrapper-agent kind that is also a launch kind.
    expect(() => assertDispatchKindAxesDisjoint(['build', 'fix'], ['delivery', 'fix']))
      .toThrow(/both a LAUNCH kind and a WRAPPER-AGENT kind/);
  });
});

describe('#3640 — guard-bash keys on the wrapper half, and only on it', () => {
  it('its wrapper-owned table has NOT drifted from `WRAPPER_AGENT_KINDS`', () => {
    // `guard-bash.mjs` is an import-free `PreToolUse` hook and restates these keys as literals (its own note
    // explains why, and cites `BUILD_DISPATCH_MODE_ENV`'s identical trade). This is the assertion that buys
    // the no-drift guarantee back.
    expect(Object.keys(WRAPPER_OWNED_AGENTS).sort()).toEqual([...WRAPPER_AGENT_KINDS].sort());
  });

  it('fires every deny for the `repair` stamp — the table is LIVE for fix, not merely present', () => {
    const denied = [
      ['node scripts/lane-pool.mjs acquire --lane=3', /lane-pool\.mjs/],
      ['node scripts/backlog.mjs claim 1234 --session=x', /backlog\.mjs claim/],
      ['node scripts/backlog.mjs release 1234 --session=x', /backlog\.mjs release/],
      ['gh pr view 2108', /gh pr/],
      ['node scripts/operations/open-pr.mjs', /open-pr/],
      ['node scripts/pr-land.mjs --pr=1234', /pr-land\.mjs/],
      ['node scripts/conveyor/learnings-drop.mjs --kind=friction', /learnings-drop\.mjs/],
      ['node scripts/converge-cli.mjs step --state=/lane-3/.converge-state.json', /converge-cli\.mjs/],
      ['node scripts/verify-lane.mjs check', /verify-lane\.mjs/],
      ['node scripts/review-core-cli.mjs invite --file=x.json', /review-core-cli\.mjs/],
    ];
    for (const [command, why] of denied) {
      expect(reason(command, { dispatchKind: REPAIR_AGENT_KIND }), command).toMatch(why);
    }
  });

  it('every deny it fires NAMES the fix wrapper, never the delivery one — a message true of the other kind is a stale note', () => {
    // The exact class of defect `d1c2d8ed6` had to come back and correct in this same table: text that was
    // true when written and quietly false afterwards. A repair agent told "the wrapper claims the item before
    // you are spawned" would be told something no fix dispatch ever does.
    const r = reason('node scripts/lane-pool.mjs acquire --lane=3', { dispatchKind: REPAIR_AGENT_KIND });
    expect(r).toContain('fix-dispatch-wrapper.mjs');
    expect(r).not.toContain('deliver-item-wrapper.mjs');
    expect(reason('node scripts/backlog.mjs claim 1 --session=x', { dispatchKind: REPAIR_AGENT_KIND }))
      .toMatch(/never claims a backlog item/);
    expect(reason('node scripts/operations/open-pr.mjs', { dispatchKind: REPAIR_AGENT_KIND }))
      .toMatch(/never opens a PR/);
    expect(reason('node scripts/verify-lane.mjs check', { dispatchKind: REPAIR_AGENT_KIND }))
      .toContain('runFixGateWithOneRetry');
  });

  it('leaves the delivery table byte-identical in behaviour — #3627\'s agent is unaffected', () => {
    for (const command of [
      'node scripts/lane-pool.mjs acquire --lane=3', 'gh pr merge 1234', 'node scripts/verify-lane.mjs check',
    ]) {
      expect(reason(command, { dispatchKind: 'delivery' }), command).not.toBeNull();
    }
    expect(reason('node scripts/lane-pool.mjs acquire --lane=3', { dispatchKind: 'delivery' }))
      .toContain('deliver-item-wrapper.mjs');
  });

  it('denies NOTHING extra for any LAUNCH kind — the six briefs still run their own first step', () => {
    for (const kind of LAUNCH_KINDS) {
      for (const command of CONTESTED_COMMANDS) {
        expect(decide(command, { dispatchKind: kind }), `${kind}: ${command}`).toBeNull();
      }
    }
    // …and for an interactive session with no stamp at all.
    for (const command of CONTESTED_COMMANDS) expect(decide(command, {}), command).toBeNull();
  });

  it('an env value that is only an Object prototype member is not a registered wrapper kind', () => {
    // `dispatchKind` arrives straight off `process.env`. A bare index would make `WE_DISPATCH_KIND=toString`
    // deny with an `undefined` message — the same hole `dispatchProviderEntry` uses `Object.hasOwn` to close.
    for (const bogus of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(reason('node scripts/lane-pool.mjs acquire --lane=3', { dispatchKind: bogus }), bogus).toBeNull();
    }
  });

  it('the kind-agnostic #3105 verification deny is UNCHANGED by all of this', () => {
    // It fires for any non-null stamp, wrapper-agent kinds included — and the wrapper table's own stricter
    // verify-lane deny sits in front of it for those. Both halves still answer.
    expect(decide('npm run check:standards', { dispatchKind: 'fix' })).toMatch(/mechanically-dispatched/);
    expect(decide('npm run check:standards', { dispatchKind: REPAIR_AGENT_KIND })).toMatch(/mechanically-dispatched/);
    expect(decide('npm run check:standards', {})).toBeNull();
  });
});
