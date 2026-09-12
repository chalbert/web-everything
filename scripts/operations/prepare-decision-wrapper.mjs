#!/usr/bin/env node
/**
 * @file scripts/operations/prepare-decision-wrapper.mjs
 * @description THE `prepare-decision` LAUNCH KIND'S MECHANICAL ARC (#3644) — the wrapper a MINIMAL
 * decision-authoring agent (`we:skills-src/conveyor/prepare-decision-agent-brief-v2.md`) runs under, wired
 * into the live `prepare-decision` dispatch path through
 * {@link ./dispatch-providers/prepare-decision.mjs} and ONE row in
 * {@link ./dispatch-provider-registry.mjs}.
 *
 * Follows #3645's `build` wiring (`we:scripts/operations/deliver-item-wrapper.mjs` +
 * `deliver-item-run.mjs` + `dispatch-providers/build.mjs`) as its template, in the shape the registry's own
 * "REGISTERING A NEW KIND" section names. Mechanical by DEFAULT; the prose brief it replaces
 * (`we:skills-src/conveyor/prepare-decision-agent-brief.md`) stays reachable behind an explicit opt-out,
 * `WE_PREPARE_DECISION_DISPATCH_MODE=agent`.
 *
 * ── WHAT A PREPARE-DECISION IS, AND WHY THAT CHANGES THE ARC ────────────────────────────────────────────────
 *
 * A prepare-decision NEVER EDITS CODE. Its whole output is authoring: survey the prior art, publish a
 * `/research/` topic, state each fork's options + tradeoffs + a BOLD DEFAULT with a `Skeptic:` and a `Screen:`
 * line, and then stamp `preparedDate` so readiness ranks the decision `✓ ready to ratify`. The call itself
 * stays human (MEMORY #39 — never take an unprepared decision); this arc only brings the forks to the
 * Definition of Ready. Three consequences run through every step below:
 *
 *   1. **IT HOLDS, IT NEVER CLAIMS.** `backlog.mjs prepare-hold` (a HARD LOCAL lease, #2219/#2264) replaces
 *      the build wrapper's `claimItem`. A prepared decision is still `open` — claiming it would mark it as
 *      being BUILT, and `resolve` belongs to the ratify turn, never to prepare.
 *   2. **THE `preparedDate` STAMP IS THE WRAPPER'S, NOT THE AGENT'S.** `prepare-stamp` is a deterministic
 *      frontmatter splice; WHETHER to stamp is the only judgment in it, and that judgment arrives as the
 *      agent's reported outcome. So the agent authors, and this wrapper stamps + commits the splice — the
 *      same division #3645 drew between "build it" (agent) and "gate/converge/PR it" (wrapper).
 *   3. **A `blocked` OUTCOME OPENS NO PR AT ALL.** The prose brief's Escalation case 1 (`could-not-prepare`)
 *      is a hard stop with no stamp and no PR — a half-prepared decision that lands is a FALSE `✓ ready to
 *      ratify` the next ratify turn will trust. Unlike a build's `blocked`, partial work in the lane is never
 *      a reason to open anything; see {@link prepareDecision}'s own branch for why `filesTouched` plays no
 *      part in the decision here.
 *
 * ── THE OUTCOME ENUM: NO NEW ONE. THE ITEM ASKED; THIS IS THE ANSWER ────────────────────────────────────────
 *
 * `we:backlog/3644-*.md` explicitly leaves open "whether a prepare-decision report needs its own outcome enum
 * distinct from build's done/blocked/needs-human-judgment shape given it never edits code". It does NOT, and
 * the reason is that the existing three already carry this kind's three real endings with nothing stretched:
 *
 *   `done`                 → PREPARED. Every fork reached DoR. The wrapper stamps `preparedDate`, gates,
 *                            converges, and opens a `ready-to-merge` PR (the brief's own default and expected
 *                            outcome — a prepare PR auto-lands).
 *   `blocked`              → COULD-NOT-PREPARE (the prose brief's Escalation case 1, verbatim): the decision
 *                            is too vague to research honestly, or a fork turns on human judgment no research
 *                            resolves. No stamp, no PR, hold and lane released.
 *   `needs-human-judgment` → the prose brief's Escalation case 4: the forks ARE authored and stampable, but
 *                            one specific call needs a human before this lands. Stamp + PR, PARKED
 *                            `review:human` — which is exactly what {@link decideParkMode} already does with
 *                            this outcome, unchanged, for a build.
 *
 * A fourth value would have to be one of those three under another name. Reusing
 * `we:scripts/operations/delivery-report-record.mjs` also means no second schema, no second report CLI and no
 * second sidecar store — the report channel is PROVIDER- AND KIND-AGNOSTIC by design (see
 * `deliver-item-wrapper.mjs#DeliveryAgentProvider`), which is the property being used here rather than
 * stretched. THE ONE REAL DIFFERENCE, stated rather than hidden: the build wrapper reads `filesTouched` to
 * tell a pre-build `blocked` from a mid-build one and picks a different result string for each. This wrapper
 * does not, because both collapse to the same action — never stamp, never open a PR — and a second
 * distinction the agent cannot get wrong is worth more than a finer result string.
 *
 * ── WHAT IS REUSED VERBATIM, AND WHAT IS NOT (the item leaves this to judgment; here is the judgment) ───────
 *
 * REUSED, IMPORTED, NOT RE-IMPLEMENTED:
 *   • `acquireLane` (`./minimal-context-provider.mjs`) — generalises EXACTLY: its `purpose` is already a
 *     parameter, so a prepare acquires with `--purpose=conveyor-prepare-decision` through the identical
 *     `--adopt` + stale-verify-marker-reset path. Nothing else differs.
 *   • `runGateWithOneRetry` (`./deliver-item-wrapper.mjs`) — generalises EXACTLY, and its `provider`/
 *     `readReport` seams are why: the one resume it performs goes through THIS file's provider, and its
 *     resume prompt names only `$LANE` and "send a fresh `done` report", both of which are true of a
 *     decision-authoring agent. Its three-valued `green`/`red`/`gate-blocked` reading is the same discipline
 *     a red prepare gate needs (a malformed `/research/` topic is a real red; a stale marker is `unrun`).
 *   • `runConverge` + `decideParkMode` (`./deliver-item-wrapper.mjs`) — the #2629 operator invariant is
 *     KIND-INDEPENDENT: no PR reaches a human review gate without an AI convergence pass first, and the prose
 *     brief's step 5 says so for a prepare in as many words. `runConverge` takes the lane and drives
 *     `converge-cli.mjs`; nothing in it is build-shaped. `decideParkMode` already reads
 *     `needs-human-judgment` and the statute/policy-core rubric, which is precisely the prose brief's
 *     Escalation cases 3 and 4.
 *   • `releaseLane` (`./minimal-context-provider.mjs`), `resolveLanePath`, `resolveItemSpecPathBasename`,
 *     `fillBrief`, `dropLearning`, `findItem`/`defaultLoadItems`, and the whole `--restricted` argv +
 *     hooks-settings + spawn-failure-capture stack.
 *
 * NOT REUSED, WITH THE REASON:
 *   • `claimItem` → {@link prepareHold}. A different CLI verb for a different lifecycle (see consequence 1).
 *   • `openPr` → {@link openPreparePr}. THE REF SHAPE IS LOAD-BEARING, not cosmetic.
 *     `dispatch-lane-io.mjs#NON_IMPLEMENTING_REF_RE` (`/^lane\/\d+[a-z]?-(scope|prepare)-/i`) is what stops
 *     the #3457/#3460 already-done guard from reading a prepare's own authoring PR as evidence the ITEM was
 *     implemented. `openPr` mints `lane/<num><attempt>-<slug>`, which that regex does not match — reusing it
 *     would make every prepared decision look already-done to the next tick. So this file mints
 *     `lane/<num><attempt>-prepare-<slug>`, the shape the prose brief already documents (and the shape that
 *     regex's own docblock cites at `prepare-decision-agent-brief.md:176`). The PR BODY differs for the same
 *     reason a body always does — it describes what this PR contains.
 *   • `releaseClaimAndLane` → {@link releaseHoldAndLane}. `backlog.mjs release` drops a CLAIM this arc never
 *     takes; `prepare-release` drops the HOLD it does. The lane half is the shared `releaseLane`.
 *
 * ── RESTART SURVIVAL IS AN ACCEPTANCE CLAUSE (`we:backlog/3644-*.md` "Done when" 2) ──────────────────────────
 *
 * NOTHING IN THIS FILE RUNS INSIDE THE RUNNER'S TICK. {@link prepareDecision} blocks for the agent's whole
 * turn (up to {@link PREPARE_DECISION_AGENT_SPAWN_TIMEOUT_MS}) plus a gate and a converge loop, and the
 * dispatch path it sits on is `runner.mjs#makeCliDispatchPass`'s SYNCHRONOUS `execFileSync` of `run.mjs
 * dispatch-lane`. So the block moves out, exactly as #3645 moved a build's: the only production caller of
 * {@link prepareDecision} is `we:scripts/operations/prepare-decision-run.mjs`, ONE DISPATCH = ONE DETACHED
 * PROCESS, spawned by {@link ./dispatch-providers/prepare-decision.mjs}. See `prepare-decision-run.mjs`'s own
 * header for the full account and for what the dispatcher keeps to find it again (`pid:<n>`, answered by the
 * kernel, so a RESTARTED runner still reads the dispatch as live).
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import { defaultSpawnAgent, findItem, defaultLoadItems } from './dispatch-lane-io.mjs';
import { fillBrief } from './dispatch-lane.mjs';
import { tryReadDeliveryReport, resolveDeliveryReportsDir } from './delivery-report-store.mjs';
import {
  REPO_ROOT, run, buildRestrictedProviderArgv, persistSpawnFailure, acquireLane, releaseLane,
  resolveLanePath,
} from './minimal-context-provider.mjs';
// REUSED WHOLESALE from the `build` wiring — see the "WHAT IS REUSED" section above for why each one
// generalises. `ensureDeliveryHooksSettingsFile` included: the trimmed hooks file a decision-authoring agent
// needs is byte-identical to a delivery agent's (`guard-lane` + `lint-locus-prefix` + `backlog-guard` on
// Edit|Write, `guard-bash` on Bash, and `permissions.allow` = the same six tools), and `lint-locus-prefix` /
// `backlog-guard` matter MORE here, not less: this agent's entire output is `backlog/*.md` and
// `src/_includes/research-descriptions/` writes, which is exactly what those two hooks police.
import {
  DELIVERY_HOOKS_SETTINGS, ensureDeliveryHooksSettingsFile, runGateWithOneRetry, runConverge, decideParkMode,
  resolveItemSpecPathBasename, dropLearning,
} from './deliver-item-wrapper.mjs';

/**
 * THE `WE_DISPATCH_KIND` VALUE THIS WRAPPER'S OWN AGENT IS STAMPED WITH — deliberately NOT the launch kind
 * `prepare-decision`, and that distinction is the whole reason `we:scripts/guard-bash.mjs` can carry a deny
 * table for it at all.
 *
 * `dispatch-lane-io.mjs#defaultClaudeProvider` stamps `WE_DISPATCH_KIND=<launchKind>` on the AGENT-path spawn
 * — the full prose brief (`prepare-decision-agent-brief.md`), which runs its OWN lifecycle: `lane-pool
 * acquire`, `prepare-hold`, `verify-lane request`/`check`, `run.mjs open-pr`, `prepare-release`. That agent
 * MUST keep being allowed those commands, and `we:scripts/__tests__/guard-bash.test.mjs`'s `#xu2pp2m` block
 * asserts exactly that for `dispatchKind: 'prepare-decision'`. An agent run by THIS wrapper must be denied
 * every one of them, because the wrapper runs them itself.
 *
 * One env value cannot mean both. That is the collision `guard-bash.mjs`'s own note calls "A REAL AMBIGUITY
 * TO SETTLE BEFORE ANY `'fix'` ARM IS ADDED" — `WE_DISPATCH_KIND=fix` is stamped by two spawners for two
 * incompatible contracts, so no `'fix'` arm can be written. This wrapper settles it the way #3645 already
 * did for `build`: the build wrapper stamps `'delivery'`, NOT `'build'`, and the guard's table keys on
 * `'delivery'`. `'decision-authoring'` is the same move, named for what the agent actually does.
 */
export const PREPARE_DECISION_DISPATCH_KIND = 'decision-authoring';

/** The `lane-pool acquire --purpose=` this arc acquires under — the prose brief's own value
 *  (`prepare-decision-agent-brief.md` step 1), kept so a lane's recorded purpose still reads the same. */
export const PREPARE_DECISION_LANE_PURPOSE = 'conveyor-prepare-decision';

/**
 * The timeout budget for the ONE blocking `execFileSync` this file's provider performs — the SAME 60 minutes
 * and the SAME reasoning as `deliver-item-wrapper.mjs#DELIVERY_AGENT_SPAWN_TIMEOUT_MS` (#3627 bug 6): a real
 * research + authoring turn cannot finish inside `dispatch-lane-io.mjs#SPAWN_TIMEOUT_MS`'s 60 SECONDS, which
 * is correctly sized for that file's fire-and-forget `claude --bg` caller and for nothing else. Declared here
 * rather than imported so this kind's budget can move without moving a build's; they are equal today and that
 * is a coincidence of sizing, not a shared constant.
 */
export const PREPARE_DECISION_AGENT_SPAWN_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

/** Where the v2 brief lives. Resolved by SCRIPT LOCATION (`REPO_ROOT`), never cwd. */
export const PREPARE_DECISION_BRIEF_V2 = `${REPO_ROOT}skills-src/conveyor/prepare-decision-agent-brief-v2.md`;

/** The v2 brief's ONE conveyor-injected placeholder — the same single-name list the delivery v2 brief uses,
 *  filled through the SAME `fillBrief` every other launch kind's fill already goes through. */
const V2_BRIEF_REQUIRED_NAMES = Object.freeze(['ITEM_SPEC_PATH_BASENAME']);
const V2_BRIEF_OPTIONAL_NAMES = Object.freeze([]);

/**
 * THE TOP-LEVEL ARC. One call = one decision = one attempt.
 *
 * @param {{item: string, lane: number|string, scope: string, sessionSlug: string, attemptTag: string}} launch
 *   the SAME launch shape `dispatch-lane.mjs`'s `spawnPrepareDecision` list already carries — this wrapper
 *   changes what is DONE with it, never what feeds it.
 * @param {{name: string, spawn: Function}} [provider] - the minimal-context spawn PORT (#3627 firm
 *   requirement 6). Defaults to {@link CLAUDE_RESTRICTED_PREPARE_PROVIDER}.
 * @param {object} [io] - `newSessionId` mints the Claude CLI's own `--session-id` (a real UUID; the CLI
 *   rejects a human-readable slug — #3627 bug 5), minted ONCE and reused by the fresh spawn and by
 *   `runGateWithOneRetry`'s single resume so the resume targets the same CLI session.
 *
 *   EVERY OTHER SEAM HERE IS THE SAME `{ run: runFn = run }` CONVENTION this file and
 *   `deliver-item-wrapper.mjs` use throughout, one level up: each step of the arc defaults to the real
 *   function beside it and is injectable, so THE ORDER OF THE STEPS AND THE RELEASE DISCIPLINE — the two
 *   things a caller actually depends on, and the two a per-function test structurally cannot see — are
 *   assertable end to end without a lane, a `claude`, a gate run or a `gh` token. Nothing here is a
 *   production knob; the defaults ARE the arc.
 * @returns {Promise<{item: string, result: string}>}
 */
export async function prepareDecision(launch, provider = CLAUDE_RESTRICTED_PREPARE_PROVIDER, {
  newSessionId = randomUUID,
  acquire = acquireLane,
  hold = prepareHold,
  runAgent = runPrepareAgentToCompletion,
  resolveLane = resolveLanePath,
  stamp = stampPreparedDate,
  commitStamp = commitPreparedStamp,
  gate: runGate = runGateWithOneRetry,
  converge = runConverge,
  park = decideParkMode,
  openPr = openPreparePr,
  forwardLearning = dropLearning,
  releaseBoth = releaseHoldAndLane,
  releaseHold = prepareRelease,
  lookupItem = (num) => findItem(String(num), () => defaultLoadItems(REPO_ROOT)),
} = {}) {
  const { item, lane, scope, sessionSlug, attemptTag } = launch;
  const claudeSessionId = newSessionId();

  // ---- 1. Acquire the lane (REUSED verbatim; only `purpose` differs) --------------------------------------
  acquire({ lane, sessionSlug, scope, item, claudeSessionId, purpose: PREPARE_DECISION_LANE_PURPOSE });
  try {
    // ---- 2. HOLD, never claim — see consequence 1 in this file's header ----------------------------------
    hold({ item, sessionSlug });

    // ---- 3. THE ONE AGENT TURN. Research + author the forks. Everything else on this page is mechanical. --
    const report = await runAgent({ item, sessionSlug, lane, attemptTag, provider, claudeSessionId });

    // ---- 4. `blocked` → could-not-prepare. NO stamp, NO PR, at any amount of partial authoring. -----------
    // `filesTouched` is deliberately NOT consulted (unlike the build wrapper's two-way `blocked` split): a
    // partially-authored decision is not a smaller version of a prepared one, it is an UNPREPARED one, and
    // the only safe thing to do with it is leave the item un-stamped so the operator shapes it.
    if (report.outcome === 'blocked') {
      releaseBoth({ item, lane, sessionSlug });
      return { item, result: `could-not-prepare (${report.reason || 'no reason reported'})` };
    }

    // ---- 5. Stamp `preparedDate` — THE WRAPPER'S SPLICE, in the lane, committed here ----------------------
    // `prepare-stamp` is blocked from a primary cwd by design (guard-bash #2302) and allowed in a `.lanes/`
    // clone, so this runs with `cwd: lanePath` against the LANE's own copy of `backlog.mjs`. The agent never
    // runs it and never hand-edits `preparedDate`; it reported `done`, and that report IS the judgment the
    // stamp encodes.
    const lanePath = resolveLane(lane);
    stamp({ item, lanePath });
    commitStamp({ item, lanePath });

    // ---- 6. Gate, with exactly one retry (REUSED — see the header for why it generalises exactly) ---------
    const gate = runGate({ lane, item, sessionSlug, attemptTag, provider, claudeSessionId });
    if (gate.status === 'red') {
      releaseBoth({ item, lane, sessionSlug });
      return { item, result: 'gate-red' };
    }
    if (gate.status === 'gate-blocked') {
      releaseBoth({ item, lane, sessionSlug });
      return { item, result: `gate-blocked (${gate.reason || 'no reason reported'})` };
    }

    // ---- 7. Converge BEFORE the PR — the #2629 operator invariant, driven by the WRAPPER (REUSED) ---------
    const convergeVerdict = converge(
      { lane: gate.lanePath, item, goal: `bring decision #${item}'s forks to the Definition of Ready` },
      { dispatchKind: PREPARE_DECISION_DISPATCH_KIND },
    );

    // ---- 8. Park mode from the SAME deterministic rubric a build uses (REUSED) ----------------------------
    // A prepare PR normally auto-lands (`label-on-green` → `ready-to-merge`). It parks `review:human` for
    // exactly the two reasons the prose brief's Escalations 3 and 4 name, and both are already terms in this
    // function: a statute-touching decision, and a `needs-human-judgment` report.
    const parkDecision = park({
      report, convergeVerdict, filesTouched: report.filesTouched, lanePath: gate.lanePath,
    });

    // ---- 9. Open the PR through the canonical producer, on the PREPARE ref shape -------------------------
    const found = lookupItem(item);
    if (!found) {
      throw new Error(`prepare-decision-wrapper: could not resolve a slug for item #${item} — findItem returned nothing`);
    }
    const prResult = openPr({ item, attemptTag, lane: gate.lanePath, park: parkDecision, report, slug: found.slug });

    // ---- 10. Forward the optional learning (REUSED — the same drop-box call a build makes) ----------------
    if (report.learning) forwardLearning({ sessionSlug, learning: report.learning });

    // ---- 11. Drop the HOLD — never the lane. The drain lands the PR out of that lane. ---------------------
    // This is the one place this arc releases on a SUCCESS path, and it is the prose brief's own step 7:
    // `prepare-release` clears the item so it is selectable again, while the lane stays held for the drain.
    releaseHold({ item, sessionSlug });
    return { item, result: `PR #${prResult.pr} (${parkDecision.label})` };
  } catch (e) {
    // A wrapper-side failure (acquire refused, hold refused, the gate script itself threw) is not the agent's
    // outcome. Release what was taken, best-effort, and surface the raw error.
    releaseBoth({ item, lane, sessionSlug, bestEffort: true });
    throw e;
  }
}

// ================================================================================================
// 1. Hold / stamp / release — the three `backlog.mjs` verbs that make this a PREPARE and not a build.
//
//    None of the three is routed through `run.mjs`: `claim` is the only backlog verb with a declared
//    operation, and `prepare-hold`/`prepare-stamp`/`prepare-release` have none. Same honesty note
//    `deliver-item-wrapper.mjs` already carries for `release`/`lane-pool` — declaring them is its own item,
//    out of scope for this wiring.
// ================================================================================================

/**
 * `backlog.mjs prepare-hold <num> --session=<slug>` — a HARD LOCAL hold (#2219/#2264): `--select` skips a held
 * item and `claim` REFUSES it until `prepare-release`, so a concurrent session cannot select or steal the fork
 * being researched. It writes no frontmatter — the item stays `open`, which is the whole point (a prepared
 * decision is still open; the call has not been made).
 *
 * RUNS FROM THE WRAPPER'S OWN CWD, not the lane, and that is correct rather than incidental: the hold registry
 * is a LOCAL, never-pushed token (`backlog.mjs`'s own docblock, read directly) keyed to the checkout the
 * SELECTOR reads — the primary. A hold written into a throwaway lane clone would be invisible to the tick that
 * is supposed to respect it.
 */
export function prepareHold({ item, sessionSlug }, { run: runFn = run } = {}) {
  runFn('node', ['scripts/backlog.mjs', 'prepare-hold', String(item), `--session=${sessionSlug}`]);
}

/**
 * `backlog.mjs prepare-stamp <num>` IN THE LANE — writes `status: open` + `preparedDate: <today>` into the
 * item's frontmatter, the one flag readiness ranks `✓ ready to ratify`.
 *
 * `cwd: lanePath` is load-bearing twice over: `prepare-stamp` is BLOCKED from a primary cwd (guard-bash
 * #2302 — an item-file mutation must land via the one PR, never as a primary-tree splice), and a lane is a
 * `git clone`, not a worktree, so `scripts/backlog.mjs` resolved from that cwd is the lane's own copy editing
 * the lane's own `backlog/` directory.
 */
export function stampPreparedDate({ item, lanePath }, { run: runFn = run } = {}) {
  runFn('node', ['scripts/backlog.mjs', 'prepare-stamp', String(item)], { cwd: lanePath });
}

/**
 * Commit the `preparedDate` splice — explicit path, one commit, message written to a FILE rather than a bash
 * heredoc (the same backtick-runs-as-a-subshell footgun the prose brief's step 6 calls out, and a decision
 * body is full of `## Fork N` backticks).
 *
 * NO-OPS when the splice changed nothing (`{committed: false}`), mirroring
 * `deliver-item-wrapper.mjs#commitConvergeRound`'s own guard: `prepare-stamp` is idempotent, so an item that
 * was somehow already stamped in this lane leaves a clean tree, and an empty `git commit` would fail the whole
 * arc over a no-op.
 */
export function commitPreparedStamp(
  { item, lanePath },
  { run: runFn = run, writeFile = writeFileSync, itemBasename = resolveItemSpecPathBasename } = {},
) {
  const specPath = `backlog/${itemBasename(item)}`;
  const porcelain = String(runFn('git', ['status', '--porcelain', '--', specPath], { cwd: lanePath }) || '').trim();
  if (!porcelain) return { committed: false, path: specPath };
  const msgFile = `${lanePath}/.prepare-stamp-msg.txt`;
  writeFile(msgFile, `WE #${item}: stamp preparedDate for the prepared decision\n\n`
    + 'Written by the #3644 mechanical prepare-decision wrapper after the authoring agent reported every fork '
    + 'at the Definition of Ready. The decision stays `open` — ratifying it is a later, human turn.\n');
  runFn('git', ['commit', '-F', msgFile, '--', specPath], { cwd: lanePath });
  return { committed: true, path: specPath };
}

/** `backlog.mjs prepare-release <num>` — drops the hold; the item is selectable again. Local-token write, so
 *  from the wrapper's own cwd for the same reason {@link prepareHold} is. */
export function prepareRelease({ item, sessionSlug }, { run: runFn = run } = {}) {
  runFn('node', ['scripts/backlog.mjs', 'prepare-release', String(item), `--session=${sessionSlug}`]);
}

/**
 * Release BOTH things this arc took — the item HOLD and the lane lease. Called on every non-PR outcome and in
 * the catch, never on the PR path (the drain lands the PR out of that lane, so the lane stays held; the hold
 * is dropped separately at step 11).
 *
 * `backlog.mjs release` is NOT called: that drops a CLAIM, and this arc never takes one.
 */
export function releaseHoldAndLane({ item, lane, sessionSlug, bestEffort = false }, { run: runFn = run } = {}) {
  try {
    prepareRelease({ item, sessionSlug }, { run: runFn });
  } catch { /* best-effort on every path — a stuck hold must not mask the outcome being reported */ }
  releaseLane({ lane, sessionSlug, bestEffort }, { run: runFn });
}

// ================================================================================================
// 2. The ONE agent turn, through the minimal-context provider PORT.
// ================================================================================================

/** Best-effort capture of a spawn failure, in this kind's own `.operations/` subdirectory so a prepare's
 *  failure never lands in the delivery pipeline's folder. Same shared writer, different `dirName`. */
function persistPrepareSpawnFailure(sessionSlug, error, opts = {}) {
  return persistSpawnFailure('prepare-decision-spawn-failures', sessionSlug, error, opts);
}

/**
 * PURE. The real shell environment variables the v2 brief references. Same construction and same reasoning as
 * `deliver-item-wrapper.mjs#buildDeliveryAgentEnv` (#3627 bug 7: the brief says `$LANE` is a real directory to
 * `cd` into, so it has to BE one), with this kind's own names and its own `WE_DISPATCH_KIND` value.
 *
 * `OPERATION_DELIVERY_REPORTS_DIR` is resolved ONCE in the WRAPPER's process and handed down (#3627 bug 9):
 * the lane is a separate clone with its own physical copy of `delivery-report-store.mjs`, whose
 * script-location-relative default would otherwise resolve to the LANE's root — the agent would write its
 * report where this process never looks, and a genuinely finished run would read as a crash.
 */
export function buildPrepareAgentEnv({ sessionSlug, item, lanePath, attemptTag, reportsDir }) {
  return {
    WE_DISPATCH_KIND: PREPARE_DECISION_DISPATCH_KIND,
    PREPARE_SESSION: sessionSlug,
    PREPARE_ITEM: String(item),
    LANE: lanePath,
    ATTEMPT_TAG: attemptTag ?? '',
    OPERATION_DELIVERY_REPORTS_DIR: reportsDir,
  };
}

/**
 * CLAUDE_RESTRICTED_PREPARE_PROVIDER — the real implementation of the minimal-context spawn port for this
 * kind. The argv, the flag combination and the entire verification trail behind it (`--restricted` over
 * `--bare`/`--safe-mode`, the explicit `--tools` allowlist, `--strict-mcp-config`, `--disable-slash-commands`,
 * the trimmed `--settings` file that keeps `guard-lane.mjs`/`guard-bash.mjs` firing) are
 * `deliver-item-wrapper.mjs#CLAUDE_RESTRICTED_PROVIDER`'s, imported rather than restated — see that docblock
 * for the evidence. What is this kind's own: the env stamp, the failure-capture directory, and the timeout.
 */
export const CLAUDE_RESTRICTED_PREPARE_PROVIDER = {
  name: 'claude-restricted',
  spawn(
    { sessionId, prompt, resumeSessionId = null, lane, sessionSlug, item, attemptTag } = {},
    {
      ensureSettingsFile = ensureDeliveryHooksSettingsFile,
      spawnAgent = defaultSpawnAgent,
      resolveLane = resolveLanePath,
      run: runFn = run,
      persistFailure = persistPrepareSpawnFailure,
      resolveReportsDir = resolveDeliveryReportsDir,
    } = {},
  ) {
    const settingsFile = ensureSettingsFile();
    const argv = buildRestrictedProviderArgv({ sessionId, prompt, resumeSessionId, settingsFile });
    const lanePath = resolveLane(lane, { run: runFn });
    const reportsDir = resolveReportsDir();
    const prepareEnv = buildPrepareAgentEnv({ sessionSlug, item, lanePath, attemptTag, reportsDir });
    try {
      spawnAgent(argv, {
        cwd: lanePath,
        env: { ...process.env, ...prepareEnv },
        timeout: PREPARE_DECISION_AGENT_SPAWN_TIMEOUT_MS,
      }); // BLOCKS — the only "wait" in this arc. No polling, anywhere (#3627 firm requirement 4).
    } catch (e) {
      persistFailure(sessionSlug, e, { resumeSessionId });
      throw e;
    }
  },
};

/** REAL. Substitutes the v2 brief's ONE placeholder through the SAME `fillBrief` every other launch kind's
 *  fill goes through, then appends this kind's env footer (plain text, never itself a `{{TOKEN}}`). */
export function fillPrepareBrief(template, { item, sessionSlug, lane, attemptTag }, { loadItems } = {}) {
  const basename = resolveItemSpecPathBasename(item, loadItems);
  const { prompt } = fillBrief(template, { ITEM_SPEC_PATH_BASENAME: basename }, V2_BRIEF_REQUIRED_NAMES, V2_BRIEF_OPTIONAL_NAMES);
  return `${prompt}\n\n[env: PREPARE_SESSION=${sessionSlug} PREPARE_ITEM=${item} LANE=${lane} ATTEMPT_TAG=${attemptTag ?? ''}]`;
}

/**
 * Spawn the minimal-brief authoring agent and BLOCK until it exits, then read its structured report. There is
 * no separate wait step and no poll: the blocking call IS the wait.
 *
 * A process that exited with no `done` report is a crash, and it THROWS rather than being read as `blocked` —
 * the distinction matters here more than for a build, because `blocked` is a legitimate, reasoned outcome
 * (`could-not-prepare`) that releases cleanly, while a crash left the lane in an unknown state and must reach
 * the catch in {@link prepareDecision}.
 */
export async function runPrepareAgentToCompletion(
  { item, sessionSlug, lane, attemptTag, provider = CLAUDE_RESTRICTED_PREPARE_PROVIDER, claudeSessionId },
  {
    readBrief = () => readFileSync(PREPARE_DECISION_BRIEF_V2, 'utf8'),
    readReport = tryReadDeliveryReport,
    loadItems,
  } = {},
) {
  const prompt = fillPrepareBrief(readBrief(), { item, sessionSlug, lane, attemptTag }, { loadItems });
  provider.spawn({ sessionId: claudeSessionId, prompt, lane, sessionSlug, item, attemptTag }); // BLOCKS.
  const report = readReport(sessionSlug);
  if (!report || report.status !== 'done') {
    throw new Error(`prepare-decision-wrapper: agent for ${sessionSlug} exited with no done report (crash or refused effect)`);
  }
  return report;
}

// ================================================================================================
// 3. The PR — the canonical producer, on the PREPARE ref shape.
// ================================================================================================

/**
 * PURE. `lane/<num><attemptTag>-prepare-<slug>`.
 *
 * THE `-prepare-` INFIX IS NOT COSMETIC. `dispatch-lane-io.mjs#NON_IMPLEMENTING_REF_RE`
 * (`/^lane\/\d+[a-z]?-(scope|prepare)-/i`) is what tells the #3457/#3460 already-done guard that a merged PR
 * only AUTHORED an item's card and never implemented it. Mint a build-shaped ref here and every prepared
 * decision starts reading as "already done" to the next tick's dispatch guard the moment its PR lands. The
 * optional attempt letter is inside that regex's own `\d+[a-z]?`, so keeping the attempt tag (which keeps two
 * attempts at the same decision from colliding on one ref) stays inside the shape.
 */
export function preparePrRef({ item, attemptTag, slug }) {
  if (!slug) {
    throw new Error(`prepare-decision-wrapper: a prepare PR needs the item's real slug for #${item} — never a literal placeholder`);
  }
  return `lane/${item}${attemptTag ?? ''}-prepare-${slug}`;
}

/** The PR body. Minimal on purpose, for the same reason `deliver-item-wrapper.mjs#buildPrBody` is: `pr-land`
 *  applies its own author stamp and lane manifest to whatever body it is handed, so this supplies only the
 *  human-readable content it does not invent. */
export function buildPreparePrBody({ item, report }) {
  const summary = (report && typeof report.reason === 'string' && report.reason.trim())
    || `Brings decision #${item}'s forks to the Definition of Ready: prior-art research, each fork's options `
      + 'and tradeoffs, a bold default, a skeptic pass and a two-confusion screen.';
  const filesLine = (report && Array.isArray(report.filesTouched) && report.filesTouched.length)
    ? `\n\nFiles touched:\n${report.filesTouched.map((f) => `- ${f}`).join('\n')}`
    : '';
  return `## #${item} — prepared decision\n\n${summary}${filesLine}\n\n`
    + '`preparedDate` is stamped, so readiness now ranks this decision `✓ ready to ratify`. **The call itself '
    + 'is NOT made here** — the decision stays `open` until a human ratifies it.\n\n---\nPrepared by the #3644 '
    + 'mechanical prepare-decision pipeline (the wrapper drove the hold, the stamp, the gate, converge and the '
    + 'PR — the agent only researched and authored).\n';
}

/** Writes {@link buildPreparePrBody} to the exact path `--bodyFile` reads. `open-pr.mjs#planOpen` REFUSES a
 *  bodyless create, so this is not cosmetic. */
export function writePreparePrBody({ item, lane, report }, { writeFile = writeFileSync } = {}) {
  const bodyFile = `${lane}/.pr-body.md`;
  writeFile(bodyFile, buildPreparePrBody({ item, report }));
  return bodyFile;
}

/**
 * Open the PR through `run.mjs open-pr` — the SAME canonical producer, the SAME flags and the SAME park/
 * label-on-green branch `deliver-item-wrapper.mjs#openPr` uses. What differs is only the ref shape
 * ({@link preparePrRef}) and the body ({@link writePreparePrBody}); see this file's header for why that made a
 * sibling function the honest answer rather than a fourth parameter on `openPr`.
 *
 * PURE function of its params — the caller resolves the item's real slug once and passes it through.
 */
export function openPreparePr({ item, attemptTag, lane, park, report, slug }, { run: runFn = run, writeFile = writeFileSync } = {}) {
  const ref = preparePrRef({ item, attemptTag, slug });
  const bodyFile = writePreparePrBody({ item, lane, report }, { writeFile });
  const args = [
    'scripts/operations/run.mjs', 'open-pr', `--ref=${ref}`, '--sha=HEAD', '--base=main',
    `--bodyFile=${bodyFile}`, '--requireVerified=true', '--json',
    park.mode === 'park' ? '--mode=park' : '--mode=label-on-green',
  ];
  if (park.mode === 'park') args.push(`--parkLabel=${park.label}`);
  return JSON.parse(runFn('node', args, { cwd: lane }));
}

// Re-exported so a reader of THIS file can see the exact hooks-settings object its agent runs under without
// chasing the delivery wrapper, and so a test can assert the two have not silently diverged.
export { DELIVERY_HOOKS_SETTINGS as PREPARE_DECISION_HOOKS_SETTINGS };
