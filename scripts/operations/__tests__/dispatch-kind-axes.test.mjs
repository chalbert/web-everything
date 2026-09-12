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
  SCOPE_AUTHORING_AGENT_KIND,
  WRAPPER_AGENT_KINDS,
  assertDispatchKindAxesDisjoint,
} from '../dispatch-lane.mjs';
import { buildFixAgentEnv } from '../fix-dispatch-wrapper.mjs';
import { buildPrepareAgentEnv } from '../prepare-scope-wrapper.mjs';
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
    //
    // FOUR, NOT TWO, SINCE #3642: `decision-authoring` (#3644's wrapper-spawned agent) and `scope-authoring`
    // (#3642's correction of #3641's launch-kind stamp) are wrapper-agent kinds by the same definition and
    // are now ON this list rather than beside it — which is what puts them under
    // `assertDispatchKindAxesDisjoint` at all. The literal is kept, rather than derived, precisely so adding
    // one is a deliberate edit here.
    expect(WRAPPER_AGENT_KINDS).toEqual(['delivery', 'repair', 'decision-authoring', 'scope-authoring']);
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
    //
    // RESTATED BEHAVIOURALLY BY #3642, and deliberately stronger than the key-equality it replaces. That
    // assertion read `Object.keys(WRAPPER_OWNED_AGENTS) === WRAPPER_AGENT_KINDS`, which silently encoded
    // "the shared parametrised table is the ONLY way a wrapper-agent kind gets guarded" — and #3644 had
    // already broken that by giving `decision-authoring` its own hand-written arm instead (correctly: its
    // denies genuinely differ). The invariant that actually matters is not which table a kind is in, it is
    // that EVERY wrapper-agent kind is guarded at all, so that is what is asserted now. `WRAPPER_OWNED_AGENTS`
    // still must not name anything that is not a wrapper-agent kind.
    expect(Object.keys(WRAPPER_OWNED_AGENTS).every((k) => WRAPPER_AGENT_KINDS.includes(k))).toBe(true);
    for (const kind of WRAPPER_AGENT_KINDS) {
      // The four commands EVERY wrapper owns for its agent, whichever table the kind's arm lives in.
      for (const command of [
        'node scripts/lane-pool.mjs acquire --lane=3',
        'node scripts/verify-lane.mjs check',
        'node scripts/operations/open-pr.mjs',
        'node scripts/conveyor/learnings-drop.mjs --kind=friction',
      ]) {
        expect(reason(command, { dispatchKind: kind }), `${kind}: ${command}`).not.toBeNull();
      }
    }
  });

  it('fires every deny for the `repair` stamp — the table is LIVE for fix, not merely present', () => {
    const denied = [
      ['node scripts/lane-pool.mjs acquire --lane=3', /lane-pool\.mjs/],
      ['node scripts/backlog.mjs claim 1234 --session=x', /backlog\.mjs claim/],
      ['node scripts/backlog.mjs release 1234 --session=x', /backlog\.mjs release/],
      ['gh pr view 2108', /gh pr/],
      ['node scripts/operations/open-pr.mjs', /open-pr/],
      // THE POSTURE FLAG IS NOT DECORATION, and it is not a way past a gate. `#3321`'s caller sweep
      // (`we:scripts/__tests__/lane-verify.test.mjs`) harvests every `pr-land` command string the TRACKED file
      // set ships and fails any that declares no verification posture — deliberately with exactly ONE
      // exclusion (pr-land's own `--help` banner), which that case says must be re-argued rather than silently
      // widened. A NEGATIVE fixture is still a shipped command string, so it declares a posture like every
      // other one instead of earning an exemption for being "only a test".
      //
      // `--no-require-verified` is the HONEST arm of the two, not the convenient one. The sweep's other arm
      // (`--require-verified`) additionally demands a real `verify-lane` / `run.mjs verify` within three lines
      // above, because that arm describes a lane-local landing arc where a fresh green marker is exactly what
      // the arc produced. This string is not an arc and lands nothing: it is a command handed to `reason()` to
      // assert the guard DENIES it. No marker is reachable for it, which is precisely the condition the
      // opt-out arm exists to express ("the marker is structurally unreachable, so declare the opt-out").
      //
      // FLAG ORDER IS LOAD-BEARING, and only for the sweep's benefit: `PR_LAND_CMD` consumes `--flag` runs to
      // end-of-match, so whichever flag is written LAST also swallows the string literal's closing `',` and
      // parses as `pr=1234',` rather than `pr`. A posture flag written last is therefore invisible to the
      // sweep. Written first it parses cleanly. Left here rather than "fixed" in the sweep, because that
      // trailing-delimiter artifact belongs to that test, not this one.
      ['node scripts/pr-land.mjs --no-require-verified --pr=1234', /pr-land\.mjs/],
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

/**
 * #3642 — THE SAME COLLISION, ONE PATH OVER: `WE_DISPATCH_KIND=prepare`.
 *
 * `prepare-scope-wrapper.mjs` (#3641) stamped the LAUNCH kind `prepare` on the RESTRICTED agent it spawns,
 * which is the identical defect #3640 resolved for `fix`. It was latent only because no `prepare` deny arm
 * existed; #3640's own note recorded it and said the stamp must move BEFORE anyone writes one. This block is
 * the regression for moving it, and it is written to FAIL against the pre-fix code:
 *
 *   * the first `it` reads the stamp the wrapper ACTUALLY produces (never a literal typed here) and asserts
 *     one command — `lane-pool.mjs acquire`, which the v1 prose brief REQUIRES of the agent at its step 1 and
 *     the v2 brief forbids — gets OPPOSITE verdicts under the two spawners' stamps. Against the pre-fix code
 *     both stamps are the string `prepare`, so the first assertion alone fails; against the naive "just add a
 *     `prepare` arm" resolution the AGENT-path half fails instead.
 *   * the second asserts the stamp is on the wrapper-agent axis at all, which is what makes
 *     `assertDispatchKindAxesDisjoint` cover it.
 */
describe('#3642 — the WE_DISPATCH_KIND=prepare collision', () => {
  /** The commands the AGENT-path (v1) prepare brief requires of the agent ITSELF, and the v2 brief forbids.
   *  Read off `we:skills-src/conveyor/prepare-scope-agent-brief.md` steps 1/4/6/7, not invented. */
  const CONTESTED_PREPARE_COMMANDS = Object.freeze([
    'node scripts/lane-pool.mjs acquire --lane=3 --purpose=conveyor-prepare-scope --session=prepare-2568',
    'node scripts/verify-lane.mjs request',
    'node scripts/operations/run.mjs open-pr --ref=lane/2568-scope-x --sha=HEAD',
    'node scripts/conveyor/learnings-drop.mjs --kind=friction',
  ]);

  /** The stamp the WRAPPER path actually produces — read off the production function, never typed. */
  const wrapperPrepareStamp = () => buildPrepareAgentEnv({
    sessionSlug: 'prepare-2568', item: '2568', lanePath: '/pool/lane-3', itemSpecPath: 'backlog/2568-x.md', reportsDir: '/r',
  }).WE_DISPATCH_KIND;

  it('THE REGRESSION: the two prepare spawners produce DIFFERENT stamps, so one command gets opposite verdicts', async () => {
    const agentStamp = await agentPathStampFor('prepare');
    const wrapperStamp = wrapperPrepareStamp();

    // Half 1 — they are distinguishable at all. Before #3642 both were `'prepare'` and this line alone fails.
    expect(agentStamp).not.toBe(wrapperStamp);

    for (const command of CONTESTED_PREPARE_COMMANDS) {
      // Half 2 — the AGENT-path (v1 brief) prepare agent is ALLOWED its own brief's steps.
      expect(decide(command, { dispatchKind: agentStamp }), `agent path: ${command}`).toBeNull();
      // Half 3 — the WRAPPER-path agent is DENIED the very same commands, because its wrapper runs them.
      expect(decide(command, { dispatchKind: wrapperStamp }), `wrapper path: ${command}`).not.toBeNull();
    }
  });

  it('the wrapper stamp is a WRAPPER-AGENT kind and never a launch kind', () => {
    const wrapperStamp = wrapperPrepareStamp();
    expect(wrapperStamp).toBe(SCOPE_AUTHORING_AGENT_KIND);
    expect(WRAPPER_AGENT_KINDS).toContain(wrapperStamp);
    expect(LAUNCH_KINDS).not.toContain(wrapperStamp);
  });

  it('every deny it fires NAMES the prepare-scope wrapper, and says what is TRUE of a prepare-scope arc', () => {
    // The stale-note class this whole axis exists to prevent: `delivery`'s table says the wrapper claims the
    // item before the agent is spawned, and `decision-authoring`'s talks about a decision's `preparedDate`.
    // Neither is true here, so neither kind's wording may leak in.
    const laneReason = reason('node scripts/lane-pool.mjs acquire --lane=3', { dispatchKind: SCOPE_AUTHORING_AGENT_KIND });
    expect(laneReason).toContain('prepare-scope-wrapper.mjs');
    expect(laneReason).not.toContain('deliver-item-wrapper.mjs');
    expect(laneReason).not.toContain('prepare-decision-wrapper.mjs');
    expect(reason('node scripts/backlog.mjs claim 2568 --session=x', { dispatchKind: SCOPE_AUTHORING_AGENT_KIND }))
      .toMatch(/never claims its item at all/);
    expect(reason('node scripts/verify-lane.mjs check', { dispatchKind: SCOPE_AUTHORING_AGENT_KIND }))
      .toContain('runPrepareGateWithOneRetry');
    // The converge denies say there is NO loop — not "the wrapper drives the loop", which would be false.
    expect(reason('node scripts/converge-cli.mjs step --state=/lane-3/.converge-state.json', { dispatchKind: SCOPE_AUTHORING_AGENT_KIND }))
      .toMatch(/runs NO converge pass at all/);
  });

  it('it is the ONLY wrapper-agent kind denied `git commit` — because its wrapper does the commit', () => {
    // Unique to this arc, and load-bearing rather than tidy: `assertOnlyItemSpecTouched` reads `git status
    // --porcelain` BEFORE `commitScopeEdit`, so an agent that committed first makes that read empty and the
    // wrapper aborts with "left the file unmodified". The other three kinds' agents DO commit their own work.
    expect(reason('git commit -m x -- backlog/2568-x.md', { dispatchKind: SCOPE_AUTHORING_AGENT_KIND }))
      .toMatch(/commitScopeEdit/);
    for (const kind of ['delivery', 'repair', 'decision-authoring']) {
      expect(reason('git commit -m x -- a.mjs', { dispatchKind: kind }), kind).toBeNull();
    }
    // …and an interactive session with no stamp is untouched.
    expect(decide('git commit -m x -- a.mjs', {})).toBeNull();
  });

  it('adds NOTHING to any LAUNCH kind, `prepare` included — the fallback brief stays fully runnable', () => {
    for (const kind of LAUNCH_KINDS) {
      for (const command of CONTESTED_PREPARE_COMMANDS) {
        expect(decide(command, { dispatchKind: kind }), `${kind}: ${command}`).toBeNull();
      }
    }
    for (const command of CONTESTED_PREPARE_COMMANDS) expect(decide(command, {}), command).toBeNull();
  });
});
