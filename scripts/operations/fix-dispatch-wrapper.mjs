#!/usr/bin/env node
/**
 * @file scripts/operations/fix-dispatch-wrapper.mjs
 * @description THE FIX-DISPATCH WRAPPER (#xu2pp2m, downstream of #3627/#3628) — the SECOND HALF of the
 * minimal-context dispatch pair `we:backlog/3629-*.md` designs (the FIRST half,
 * `we:scripts/operations/review-dispatch-wrapper.mjs`, is purely mechanical — no Claude spawn anywhere in its
 * critical path). This half is genuinely different in shape: a fix agent performs REAL code-editing judgment
 * (reads a reviewer's finding, applies a repair) the SAME way a build/delivery agent does, so — per the
 * ratified design card — this wrapper is closer in shape to `we:scripts/operations/deliver-item-wrapper.mjs`
 * (#3627) than to its own sibling `review-dispatch-wrapper.mjs`: it spawns a genuinely minimal, tool-bearing
 * Claude agent through the SAME `CLAUDE_RESTRICTED_PROVIDER`-shaped argv `deliver-item-wrapper.mjs` already
 * proved (`--restricted --tools=Bash,Edit,Write,Read,Glob,Grep --strict-mcp-config --disable-slash-commands
 * --settings=<trimmed hooks file>`, a real UUID session id, a long, no-polling blocking spawn), reused here
 * via the shared `we:scripts/operations/minimal-context-provider.mjs` primitives extracted for exactly this
 * second consumer.
 *
 * ================================================================================================
 * HONESTY LABEL, SAME CONVENTION `deliver-item-wrapper.mjs`/`review-dispatch-wrapper.mjs` USE. This file is
 * NOT wired into any live dispatch decision, is NOT imported by production code, and has NOT been run against
 * a real PR end to end — per `we:docs/agent/prototype-based-dev.md`'s "park until genuinely exercised" rule,
 * that live run (a driver + observer pair, against a real bounced PR) is EXPLICITLY the NEXT, SEPARATE phase,
 * not this one. Every function below is REAL — every CLI surface it shells was read directly from the live
 * source it calls (`gh pr view`, `we:scripts/conveyor/rearm-review.mjs`, `we:scripts/conveyor/stand-down.mjs`,
 * `we:scripts/operations/completion-cli.mjs`, `we:scripts/lane-pool.mjs`) — but "the code is real" and "the
 * pipeline has been proven end to end" are different claims; only the second is what graduation requires.
 *
 * THE RATIFIED DESIGN THIS FILE IMPLEMENTS (`we:backlog/3629-*.md`, operator-ratified — not re-litigated
 * here):
 *   1. TWO separate wrapper mechanisms sharing `minimal-context-provider.mjs` — this is the second.
 *   2. SELF-REVIEW MOVES OUT OF THE FIXER'S OWN DISPATCHED TURN. The CURRENT, full-context fixer
 *      (`we:skills-src/conveyor/fix-agent-brief.md` step 5) has the fix agent spawn its OWN adversarial
 *      code-review subagent on its own diff before pushing — the exact self-review-inside-the-agent's-own-turn
 *      anti-pattern #3627 already removed from the build agent (a build agent never initiates its own
 *      `/converge`). `we:skills-src/conveyor/fix-agent-brief-v2.md` (this wrapper's brief) has NO such step.
 *      What replaces it: THIS WRAPPER drives ONE converge pass on the fix itself (`runConverge`, below,
 *      re-imported UNCHANGED from `deliver-item-wrapper.mjs` — see that function's own header), mirroring
 *      `deliverItem` step 4 exactly. This wrapper does not invent a SECOND self-review mechanism anywhere else
 *      either — the one converge pass IS the ratified replacement, not an addition on top of it.
 *   3. A small closed outcome contract (`we:scripts/operations/fix-report-cli.mjs`'s four outcomes — `fixed`/
 *      `blocked`/`escalated-needs-judgment`/`escalated-conflict`) stands in for the agent itself shelling
 *      `gh pr view`, `stand-down.mjs`, and `rearm-review.mjs` — all three now live HERE, in the wrapper's own
 *      mechanical layer, driven off the agent's reported outcome.
 *
 * AGENTIC VS MECHANICAL — THE CONCRETE DIFFERENCE FROM `review-dispatch-wrapper.mjs`. That sibling's own
 * critical path needs NO Claude spawn at all (`review-loop-cli.mjs` already does the judging, unattended, via
 * its own independently-spawned jurors). This wrapper's critical path spawns a real, tool-bearing Claude agent
 * exactly ONCE per dispatch (plus, rarely, one resume — see `runFixGateWithOneRetry`) to perform the one thing
 * that IS genuine judgment: reading a reviewer's finding and writing the code that repairs it. Everything
 * AROUND that one spawn — resolving the finding text, acquiring/releasing the lane, running the gate, driving
 * the converge pass, re-pushing, re-arming/standing-down — is exactly as mechanical as
 * `review-dispatch-wrapper.mjs`'s entire flow, and is driven by this wrapper's own process, never by the
 * agent.
 *
 * ONE NAMED, NOT PAPERED-OVER GAP (mirrors `we:scripts/operations/deliver-item-wrapper.mjs`'s own honesty
 * notes on `DELIVERY_HOOKS_SETTINGS` and `we:scripts/operations/review-dispatch-wrapper.mjs`'s "one narrower
 * residual" section — the #2895 discipline). `we:scripts/guard-bash.mjs` DOES today carry a real
 * `dispatchKind === 'delivery'` deny arm (stamped via `WE_DISPATCH_KIND`) that blocks a delivery agent from
 * running the mechanical lifecycle commands its own wrapper drives — but that arm checks the LITERAL string
 * `'delivery'`, not `'fix'`. This wrapper stamps `WE_DISPATCH_KIND: 'fix'` on the agent's own spawn (see
 * `buildFixAgentEnv`) and threads `dispatchKind: 'fix'` into the reused `runConverge`'s converge-editor
 * sub-spawns (a small, additive, backward-compatible parameter this item added to `deliver-item-wrapper.mjs`
 * — its default stays `'delivery'`, so every existing caller is unchanged) — but until `guard-bash.mjs` grows
 * a MATCHING `dispatchKind === 'fix'` arm, that hook enforces NOTHING extra for a fix-dispatched agent beyond
 * what `--restricted`'s own `--tools` allowlist already does (the agent literally cannot invoke a non-Bash
 * tool it wasn't granted, but nothing stops it from shelling `gh`/`lane-pool.mjs`/etc. via the Bash tool it
 * DOES have). Building that `guard-bash.mjs` arm is real, valuable follow-up work — flagged here loudly,
 * exactly as `deliver-item-wrapper.mjs` already flagged the identical gap for `'delivery'` before its own
 * matching arm was later built — and deliberately NOT attempted in this pass (out of this item's own declared
 * scope, and `guard-bash.mjs` is a heavily-tested, security-relevant file this pass does not touch).
 *
 * IMPURE: `node:child_process` (via the shared module's `run`), `node:crypto` (fresh session ids), `node:fs`
 * (the finding-file scratch write/cleanup). Every impure call is injectable, mirroring
 * `we:scripts/operations/review-dispatch-wrapper.mjs`/`we:scripts/operations/deliver-item-wrapper.mjs`'s own
 * convention.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REPO_ROOT, RESTRICTED_PROVIDER_TOOLS, run, acquireLane, releaseAllPools, buildRestrictedProviderArgv,
  createHooksSettingsWriter, persistSpawnFailure, runVerifyOperation,
} from './minimal-context-provider.mjs';
import { runConverge, DELIVERY_AGENT_SPAWN_TIMEOUT_MS } from './deliver-item-wrapper.mjs';
import { defaultSpawnAgent } from './dispatch-lane-io.mjs';
import { tryReadFixReport, resolveFixReportsDir } from './fix-report-store.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

/** The lane-pool `--purpose` this wrapper's acquire carries — matches
 *  `we:skills-src/conveyor/fix-agent-brief.md` step 1's own `--purpose=conveyor-fix`. */
export const FIX_LANE_PURPOSE = 'conveyor-fix';

/** How long the acquire tolerates a momentary "no free lane" before genuinely giving up — same reasoning as
 *  `review-dispatch-wrapper.mjs#REVIEW_LOOP_ACQUIRE_WAIT_MS` (`#x3jmao3`). */
export const FIX_LOOP_ACQUIRE_WAIT_MS = 30000;

/** The scratch path, RELATIVE TO THE LANE, the wrapper writes the reviewer's finding to before spawning the
 *  agent, and deletes right after the agent's turn ends (never committed — the agent commits explicit paths
 *  only, and this file is gone by the time it would matter anyway). `we:skills-src/conveyor/
 *  fix-agent-brief-v2.md` names this exact path in its own prose. */
export const FIX_FINDING_SCRATCH_FILENAME = '.fix-review-finding.md';

/** The two markers a `review:changes` verdict comment starts with — read directly from
 *  `we:scripts/review-detail.mjs#HUMAN_MARKERS` (`'🔁 human review'`, always paired with the word "review" in
 *  the full header) and `we:scripts/review-set-label.mjs`'s own AI-review verdict text (`'🔁 review — changes
 *  requested'`) — the SAME two shapes `we:skills-src/conveyor/fix-agent-brief.md` step 2's own prose already
 *  names ("header `🔁 human review — changes requested` or `🔁 review — changes requested`"), not guessed. */
export const CHANGES_REQUESTED_MARKERS = Object.freeze(['🔁 human review — changes requested', '🔁 review — changes requested']);

// ================================================================================================
// 0. Plan + shape one dispatch request — PURE, mirrors `review-dispatch-wrapper.mjs#planReviewDispatchWrapper`.
// ================================================================================================

/**
 * @param {{pr: number|string, repo: string, item?: (number|string|null)}} o
 * @returns {{pr: number, repo: string, item: (string|null), sessionSlug: string}}
 */
export function planFixDispatchWrapper({ pr, repo, item = null } = {}) {
  const prNum = Number(pr);
  if (!Number.isInteger(prNum) || prNum <= 0) {
    throw new Error(`fix-dispatch-wrapper: --pr must be a positive integer, got ${JSON.stringify(pr)}`);
  }
  const repoStr = String(repo ?? '').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repoStr)) {
    throw new Error(`fix-dispatch-wrapper: --repo must be an \`owner/repo\` slug, got ${JSON.stringify(repo)}`);
  }
  const itemStr = item === null || item === undefined || String(item).trim() === '' ? null : String(item).trim();
  // `fix-<pr>` — the SAME grammar `we:scripts/operations/completion-cli.mjs#sessionSlugForCompletion` and
  // `we:scripts/conveyor/rearm-review.mjs`'s own callers already mint for a fix dispatch (#3436), re-derived
  // here rather than imported — the same "re-derive, never share the binding" choice
  // `we:scripts/conveyor/review-session-slug.mjs`'s own header documents for its sibling.
  return { pr: prNum, repo: repoStr, item: itemStr, sessionSlug: `fix-${prNum}` };
}

// ================================================================================================
// 1. Resolve the bounced PR's own lane ref + the reviewer's finding — REAL, mechanical `gh pr view` read. This
//    is the piece the ratified design moves OUT of the agent's own turn: the wrapper fetches the PR's
//    `headRefName` (to reconstitute the ~done work via `acquireLane`'s `base`) and the LATEST changes-
//    requested comment (the finding text), and hands the finding to the agent as a plain scratch FILE in its
//    lane — never as a `gh` command the agent runs itself.
// ================================================================================================

/**
 * PURE — the SAME "take the latest changes-requested comment as the authoritative ask" rule
 * `we:skills-src/conveyor/fix-agent-brief.md` step 2 already states in prose, made deterministic: scans
 * `comments` (as `gh pr view --json comments` returns them, chronological) from the END, and returns the
 * first one whose body starts with either shape in {@link CHANGES_REQUESTED_MARKERS}. `null` when none match
 * — the wrapper reads that as "nothing to repair" (see `dispatchFix`'s own handling).
 * @param {Array<{body?:string}>|null|undefined} comments
 * @returns {{body: string}|null}
 */
export function findLatestChangesRequestedComment(comments) {
  if (!Array.isArray(comments)) return null;
  for (let i = comments.length - 1; i >= 0; i -= 1) {
    const body = typeof comments[i]?.body === 'string' ? comments[i].body : '';
    if (CHANGES_REQUESTED_MARKERS.some((m) => body.trimStart().startsWith(m))) return comments[i];
  }
  return null;
}

/**
 * REAL — `gh pr view <pr> --json headRefName,comments --repo <repo>`. Returns the PR's own lane ref (for
 * `acquireLane`'s `base`) and the latest changes-requested finding's body text, or `null` when the PR carries
 * no such comment (a PR reached this wrapper without ever being bounced — nothing for a fixer to do).
 * @param {{pr: number, repo: string}} o
 * @param {{run?: Function}} [io]
 * @returns {{headRefName: string, findingBody: (string|null)}}
 */
export function resolveFixTarget({ pr, repo }, { run: runFn = run } = {}) {
  const out = runFn('gh', ['pr', 'view', String(pr), '--json', 'headRefName,comments', '--repo', repo]);
  const parsed = JSON.parse(out);
  const comment = findLatestChangesRequestedComment(parsed.comments);
  return { headRefName: parsed.headRefName, findingBody: comment ? comment.body : null };
}

// ================================================================================================
// 2. Minimal-context hooks settings — REUSES `minimal-context-provider.mjs#createHooksSettingsWriter`, the
//    SAME factory `review-dispatch-wrapper.mjs`'s header names as existing for exactly this future consumer.
//    Content mirrors `deliver-item-wrapper.mjs#DELIVERY_HOOKS_SETTINGS` — the fixer's own Edit/Write calls
//    need the identical four safety hooks a delivery agent's do (it may touch `backlog/*.md` too, e.g. if a
//    finding asks it to update a card's own nuance section), so this is not a narrower set, just a separately
//    named on-disk file (`fix-agent-hooks-settings.json`, never shared with the delivery wrapper's own file —
//    two dispatch kinds writing the SAME sidecar path would race under concurrent dispatch).
// ================================================================================================

export const FIX_HOOKS_SETTINGS = Object.freeze({
  hooks: {
    PreToolUse: [
      {
        matcher: 'Edit|Write',
        hooks: [
          { type: 'command', command: 'node scripts/guard-lane.mjs' },
          { type: 'command', command: 'node scripts/lint-locus-prefix.mjs --pre' },
          { type: 'command', command: 'node scripts/backlog-guard.mjs --pre' },
        ],
      },
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'node scripts/guard-bash.mjs' }] },
    ],
  },
  permissions: {
    allow: RESTRICTED_PROVIDER_TOOLS.split(','),
  },
});

export const ensureFixHooksSettingsFile = createHooksSettingsWriter('fix-agent-hooks-settings.json', FIX_HOOKS_SETTINGS);

// ================================================================================================
// 3. Spawn + get the structured fix report — mirrors `deliver-item-wrapper.mjs`'s own
//    `CLAUDE_RESTRICTED_PROVIDER`/`runAgentToCompletion`, simplified: this wrapper already resolved the real
//    lane PATH itself (via `acquireLane`'s unnumbered-branch return — see `dispatchFix` below), so unlike
//    `deliver-item-wrapper.mjs` (which resolves a bare lane NUMBER into a path inside its own provider), this
//    provider is handed the path directly and never calls `resolveLanePath` itself.
// ================================================================================================

/** Same reasoning as `deliver-item-wrapper.mjs#DELIVERY_AGENT_SPAWN_TIMEOUT_MS` (re-imported, not
 *  re-derived): a fixer's one blocking spawn covers a real code repair + potentially a gate-failure resume,
 *  the SAME "build+gate" shape a delivery agent's spawn covers, never `dispatch-lane-io.mjs`'s
 *  fire-and-forget `SPAWN_TIMEOUT_MS` (60s). */
export const FIX_AGENT_SPAWN_TIMEOUT_MS = DELIVERY_AGENT_SPAWN_TIMEOUT_MS;

/** PURE — the real env vars `we:skills-src/conveyor/fix-agent-brief-v2.md` reads directly (`$LANE`,
 *  `$FIX_SESSION`, `$FIX_PR`, `$FIX_ITEM`), mirroring `deliver-item-wrapper.mjs#buildDeliveryAgentEnv`'s own
 *  real-env-vars fix (#3627 bug 7) from day one rather than repeating that bug's text-footer mistake.
 *  `OPERATION_FIX_REPORTS_DIR` resolved ONCE in the WRAPPER's own process (mirrors bug 9's fix) so the
 *  spawned agent's `fix-report-cli.mjs` — running out of a SEPARATE lane clone, a different `git clone`, not
 *  a worktree — writes to the SAME directory this wrapper's own `tryReadFixReport` call reads back. */
export function buildFixAgentEnv({ sessionSlug, pr, item, lanePath, reportsDir }) {
  return {
    WE_DISPATCH_KIND: 'fix',
    FIX_SESSION: sessionSlug,
    FIX_PR: String(pr),
    FIX_ITEM: item ?? '',
    LANE: lanePath,
    OPERATION_FIX_REPORTS_DIR: reportsDir,
  };
}

const FIX_AGENT_PROVIDER = {
  name: 'claude-restricted-fix',
  spawn(
    { sessionId, prompt, resumeSessionId = null, lanePath, sessionSlug, pr, item } = {},
    {
      ensureSettingsFile = ensureFixHooksSettingsFile,
      spawnAgent = defaultSpawnAgent,
      persistFailure = persistSpawnFailure,
      resolveReportsDir = resolveFixReportsDir,
    } = {},
  ) {
    const settingsFile = ensureSettingsFile();
    const argv = buildRestrictedProviderArgv({ sessionId, prompt, resumeSessionId, settingsFile });
    const reportsDir = resolveReportsDir();
    const fixEnv = buildFixAgentEnv({ sessionSlug, pr, item, lanePath, reportsDir });
    try {
      spawnAgent(argv, { cwd: lanePath, env: { ...process.env, ...fixEnv }, timeout: FIX_AGENT_SPAWN_TIMEOUT_MS }); // BLOCKS.
    } catch (e) {
      persistFailure('fix-spawn-failures', sessionSlug, e, { resumeSessionId });
      throw e;
    }
  },
};

/**
 * Reads the static brief template + spawns the agent through the provider, BLOCKING until it exits — no
 * placeholder substitution (unlike `deliver-item-wrapper.mjs#fillMinimalBrief`'s one `{{ITEM_SPEC_PATH_BASENAME}}`):
 * every value this brief needs is a real env var (`buildFixAgentEnv`), so the template is read and used
 * verbatim. A design simplification versus the delivery brief's one placeholder, noted rather than silently
 * chosen differently for no stated reason — nothing in this brief needs a value unsafe to carry as an env var.
 * @returns {object} the agent's own `done` fix report.
 */
export async function runFixAgentToCompletion(
  { pr, item, sessionSlug, lanePath, provider = FIX_AGENT_PROVIDER, claudeSessionId },
  {
    // The explicit `/` (never `${REPO_ROOT}skills-src/...`, relying on REPO_ROOT's own trailing slash) mirrors
    // `deliver-item-wrapper.mjs#runAgentToCompletion`'s own default `readBrief` exactly — REPO_ROOT's trailing
    // slash does not resolve reliably under vitest's SSR transform (see `minimal-context-provider.test.mjs`'s
    // own documented note on this), and a redundant `//` collapses harmlessly on a real POSIX read either way.
    readBrief = () => readFileSync(`${REPO_ROOT}/skills-src/conveyor/fix-agent-brief-v2.md`, 'utf8'),
    readReport = tryReadFixReport,
  } = {},
) {
  const prompt = readBrief();
  provider.spawn({ sessionId: claudeSessionId, prompt, lanePath, sessionSlug, pr, item }); // BLOCKS.
  const report = readReport(sessionSlug);
  if (!report || report.status !== 'done') {
    throw new Error(`fix-dispatch-wrapper: agent for ${sessionSlug} exited with no done report (crash or refused effect)`);
  }
  return report;
}

// ================================================================================================
// 4. The gate, with one resume-and-retry — REUSES `minimal-context-provider.mjs#runVerifyOperation` (shared,
//    unmodified), mirrors `deliver-item-wrapper.mjs#runGateWithOneRetry`'s own shape but reads a FIX report on
//    the resumed turn (`outcome !== 'fixed'` is the "honest self-diagnosis, not a code fix" branch, the fix
//    analogue of that function's own `retryReport.outcome === 'blocked'` check).
// ================================================================================================

function resumeFixAgentWithGateFailure({
  sessionSlug, lanePath, pr, item, failureOutput, gateOutcome = 'fail', provider = FIX_AGENT_PROVIDER, claudeSessionId,
}) {
  const prompt = gateOutcome === 'unrun'
    ? `The verification gate could not RUN for your commit in $LANE (this looks like a wrapper/environment `
      + `problem, not necessarily a problem in your own repair):\n\n${failureOutput}\n\nIf you can see something `
      + `genuinely wrong in your own change, fix it, commit again, and send a fresh \`done\` report exactly as `
      + `before. If you cannot find anything wrong in your own diff, do not guess at a code change — send a `
      + `report with \`outcome: 'blocked'\` and a precise \`reason\` describing what you observed instead.`
    : `Your gate failed:\n\n${failureOutput}\n\nFix it in $LANE, commit again, then send a fresh `
      + `\`done\` report exactly as before.`;
  provider.spawn({ sessionId: claudeSessionId, prompt, resumeSessionId: claudeSessionId, lanePath, sessionSlug, pr, item }); // BLOCKS.
}

/** @returns {{status: ('green'|'red'|'gate-blocked'), lanePath: string, reason?: (string|null)}} */
export function runFixGateWithOneRetry(
  { lanePath, pr, item, sessionSlug, provider = FIX_AGENT_PROVIDER, claudeSessionId },
  { run: runFn = run, readReport = tryReadFixReport } = {},
) {
  const first = runVerifyOperation(lanePath, { run: runFn });
  if (first.outcome === 'pass') return { status: 'green', lanePath };

  resumeFixAgentWithGateFailure({
    sessionSlug, lanePath, pr, item, failureOutput: first.detail, gateOutcome: first.outcome, provider, claudeSessionId,
  });
  const retryReport = readReport(sessionSlug);
  const second = runVerifyOperation(lanePath, { run: runFn });
  if (second.outcome === 'pass') return { status: 'green', lanePath, retryReport };

  if (retryReport && retryReport.outcome !== 'fixed') {
    return { status: 'gate-blocked', lanePath, retryReport, reason: retryReport.reason || null };
  }
  return { status: 'red', lanePath, retryReport };
}

// ================================================================================================
// 5. Hand-back mechanics — REAL CLI surfaces, lifted from `we:skills-src/conveyor/fix-agent-brief.md`'s own
//    steps 6/7, `we:scripts/conveyor/stand-down.mjs`, `we:scripts/conveyor/rearm-review.mjs`. These are the
//    THREE calls the ratified design card names as moving OUT of the agent's own turn (`gh pr view` — see
//    `resolveFixTarget` above — plus these two).
// ================================================================================================

/** REAL — `git push origin HEAD:refs/heads/<laneRef>`, updating the EXISTING PR in place (never a new PR,
 *  never `pr-land`) — the same shape `we:skills-src/conveyor/fix-agent-brief.md` step 6 already uses. */
export function pushLaneRef({ lanePath, laneRef }, { run: runFn = run } = {}) {
  runFn('git', ['push', 'origin', `HEAD:refs/heads/${laneRef}`], { cwd: lanePath });
}

/** REAL — `we:scripts/conveyor/rearm-review.mjs <pr> --repo=<repo>` (`review:changes → review:pending`; never
 *  `review:accepted`, never clears `review:human` — see that script's own header for the enforced invariant). */
export function rearmReview({ pr, repo }, { run: runFn = run } = {}) {
  runFn('node', ['scripts/conveyor/rearm-review.mjs', String(pr), `--repo=${repo}`]);
}

/** REAL — `we:scripts/conveyor/stand-down.mjs <pr> --repo=<repo> --reason=<reason> [--detail=<detail>]` — posts
 *  the durable stand-down marker and changes NO label (see that script's own header). `reason` must be one of
 *  `we:scripts/conveyor/stand-down.mjs#STAND_DOWN_REASONS`' own keys. */
export function standDown({ pr, repo, reason, detail }, { run: runFn = run } = {}) {
  const args = ['scripts/conveyor/stand-down.mjs', String(pr), `--repo=${repo}`, `--reason=${reason}`];
  if (detail) args.push(`--detail=${detail}`);
  runFn('node', args);
}

/** Forwards the agent's optional learning, mirroring `deliver-item-wrapper.mjs`'s own module-private
 *  `dropLearning` (re-derived here rather than imported — that one is not exported). */
function dropLearning({ sessionSlug, learning }, { run: runFn = run } = {}) {
  runFn('node', [
    'scripts/conveyor/learnings-drop.mjs', `--kind=${learning.kind}`, `--summary=${learning.summary}`,
    `--area=${learning.area}`, `--suggestion=${learning.suggestion}`, `--session=${sessionSlug}`,
  ]);
}

// ================================================================================================
// 6. Durable dispatch trace — `we:scripts/operations/completion-cli.mjs report ...` (#3436), the SAME
//    mechanism `review-dispatch-wrapper.mjs`'s own `reportStarted`/`reportDone` use, `--kind=fix` instead of
//    `--kind=review`.
// ================================================================================================

function reportStarted({ sessionSlug, pr, item }, { run: runFn = run } = {}) {
  const args = ['scripts/operations/completion-cli.mjs', 'report', `--session=${sessionSlug}`, '--kind=fix', `--pr=${pr}`, '--status=started'];
  if (item) args.push(`--item=${item}`);
  runFn('node', args);
}

function reportDone({ sessionSlug, classified }, { run: runFn = run } = {}) {
  const args = ['scripts/operations/completion-cli.mjs', 'report', `--session=${sessionSlug}`, '--status=done', `--outcome=${classified.outcome}`];
  if (classified.label) args.push(`--label=${classified.label}`);
  runFn('node', args);
}

/** Best-effort stringify+truncate of a caught error for a completion record's `label` — mirrors
 *  `review-dispatch-wrapper.mjs#dispatchReviewMechanical`'s own acquire-failure branch. */
function describeError(e) {
  return String((e && (e.stderr || e.message)) || e).slice(0, 500);
}

// ================================================================================================
// THE ENTRY POINT
// ================================================================================================

/**
 * Dispatch ONE fix round for `repo#pr`: resolve the bounced PR's own lane ref + finding, acquire a lane
 * reconstituted at that ref, spawn the minimal fix agent exactly once (plus, rarely, one gate-failure resume),
 * drive ONE converge pass on the repair, then re-push + re-arm (or stand down), release, return.
 *
 * @param {{pr: number|string, repo: string, item?: (number|string|null)}} o
 * @param {DeliveryAgentProvider} [provider]
 * @param {{newSessionId?: () => string, run?: Function, waitMs?: number}} [deps]
 */
export async function dispatchFix(
  { pr, repo, item } = {},
  provider = FIX_AGENT_PROVIDER,
  { newSessionId = randomUUID, run: runFn = run, waitMs = FIX_LOOP_ACQUIRE_WAIT_MS } = {},
) {
  const planned = planFixDispatchWrapper({ pr, repo, item });
  const claudeSessionId = String(newSessionId());

  // Durable trace BEFORE anything else can fail (mirrors review-dispatch-wrapper.mjs's own step-0 reasoning).
  reportStarted(planned, { run: runFn });

  let target;
  try {
    target = resolveFixTarget(planned, { run: runFn });
  } catch (e) {
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'blocked-on-infra', label: describeError(e) } }, { run: runFn });
    throw e;
  }

  if (!target.findingBody) {
    // No changes-requested comment on the PR at all — nothing for a fixer to repair. Mirrors
    // `we:skills-src/conveyor/fix-agent-brief.md` step 1's own `not-applicable` shape for a gone lane ref,
    // extended to the symmetric case of a PR that was never actually bounced.
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'not-applicable', label: 'no changes-requested comment found on the PR' } }, { run: runFn });
    return { ...planned, lanePath: null, result: 'not-applicable (no changes-requested comment found)' };
  }

  let lanePath;
  try {
    lanePath = acquireLane(
      { sessionSlug: planned.sessionSlug, claudeSessionId, purpose: FIX_LANE_PURPOSE, base: target.headRefName, waitMs },
      { run: runFn },
    );
  } catch (e) {
    // `lane-pool.mjs acquire --base=<ref>` throws its OWN distinct, greppable text when the ref itself does not
    // resolve (`resolveBaseRef`: "--base=<ref> does not resolve in lane-N's clone") — that is the SAME
    // `not-applicable` (lane ref gone) shape `we:skills-src/conveyor/fix-agent-brief.md` step 1 already names,
    // never a generic infra failure. Any OTHER thrown acquire (the pool itself crashed/refused) is
    // `blocked-on-infra`, mirroring `review-dispatch-wrapper.mjs`'s own acquire-failure branch.
    const notApplicable = /does not resolve/.test(String((e && (e.stderr || e.message)) || e));
    const classified = { outcome: notApplicable ? 'not-applicable' : 'blocked-on-infra', label: describeError(e) };
    reportDone({ sessionSlug: planned.sessionSlug, classified }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    if (notApplicable) return { ...planned, lanePath: null, result: `not-applicable (lane ref ${target.headRefName} gone)` };
    throw e;
  }
  if (!lanePath) {
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'blocked-on-infra', label: 'no free lane after bounded wait' } }, { run: runFn });
    return { ...planned, lanePath: null, result: 'blocked-on-infra (no free lane)' };
  }

  writeFileSync(`${lanePath}/${FIX_FINDING_SCRATCH_FILENAME}`, `${target.findingBody}\n`);

  let agentReport;
  try {
    agentReport = await runFixAgentToCompletion(
      { pr: planned.pr, item: planned.item, sessionSlug: planned.sessionSlug, lanePath, provider, claudeSessionId },
      { run: runFn },
    );
  } catch (e) {
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'blocked-on-infra', label: describeError(e) } }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    throw e;
  } finally {
    // Never a real edit, never meant to be committed — see FIX_FINDING_SCRATCH_FILENAME's own docblock. Gone
    // before the gate/converge pass below can see it as a stray touched path.
    try { rmSync(`${lanePath}/${FIX_FINDING_SCRATCH_FILENAME}`, { force: true }); } catch { /* best-effort */ }
  }

  if (agentReport.outcome !== 'fixed') {
    // The agent's own outcome names ONE of the fix-report's three non-`fixed` shapes; map it onto
    // `stand-down.mjs`'s own reason vocabulary (`we:scripts/conveyor/stand-down.mjs#STAND_DOWN_REASONS`).
    const standDownReason = agentReport.outcome === 'escalated-conflict' ? 'conflict' : 'needs-judgment';
    standDown({ pr: planned.pr, repo: planned.repo, reason: standDownReason, detail: agentReport.reason || '' }, { run: runFn });
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: agentReport.outcome, label: agentReport.reason || null } }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    if (agentReport.learning) dropLearning({ sessionSlug: planned.sessionSlug, learning: agentReport.learning }, { run: runFn });
    return { ...planned, lanePath, result: `stood-down (${agentReport.outcome})` };
  }

  const gate = runFixGateWithOneRetry(
    { lanePath, pr: planned.pr, item: planned.item, sessionSlug: planned.sessionSlug, provider, claudeSessionId },
    { run: runFn },
  );
  if (gate.status !== 'green') {
    const reason = gate.reason || 'the verification gate stayed red after one resume-and-retry';
    standDown({ pr: planned.pr, repo: planned.repo, reason: 'gate-red', detail: reason }, { run: runFn });
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'gate-red', label: reason } }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    return { ...planned, lanePath, result: 'stood-down (gate-red)' };
  }

  // ONE converge pass on the repair — THE RATIFIED REPLACEMENT for the old brief's own step-5 agent-initiated
  // self-review subagent (see this file's own header). Reused UNCHANGED from `deliver-item-wrapper.mjs`
  // (`dispatchKind: 'fix'` is the one small, additive parameter this item added — see that function's own
  // docblock).
  let convergeVerdict;
  try {
    convergeVerdict = runConverge(
      { lane: lanePath, item: planned.pr, goal: `repair the review:changes finding on PR #${planned.pr}${planned.item ? ` (item #${planned.item})` : ''}` },
      { run: runFn, ensureSettingsFile: ensureFixHooksSettingsFile, dispatchKind: 'fix' },
    );
  } catch (e) {
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'blocked-on-infra', label: describeError(e) } }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    throw e;
  }

  if (convergeVerdict.verdict === 'escalate') {
    const reason = convergeVerdict.reason || 'the converge pass could not reach agreement on the repair';
    standDown({ pr: planned.pr, repo: planned.repo, reason: 'needs-judgment', detail: reason }, { run: runFn });
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'escalated-needs-judgment', label: reason } }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    return { ...planned, lanePath, result: 'stood-down (converge-escalated)' };
  }

  pushLaneRef({ lanePath, laneRef: target.headRefName }, { run: runFn });
  rearmReview({ pr: planned.pr, repo: planned.repo }, { run: runFn });

  reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 're-armed', label: null } }, { run: runFn });
  releaseAllPools(planned.sessionSlug, { run: runFn });
  if (agentReport.learning) dropLearning({ sessionSlug: planned.sessionSlug, learning: agentReport.learning }, { run: runFn });

  return { ...planned, lanePath, result: `PR #${planned.pr} (re-armed review:pending)` };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  dispatchFix({ pr: flag('pr'), repo: flag('repo'), item: flag('item') })
    .then((result) => writeAllSync(1, `${JSON.stringify(result, null, 2)}\n`))
    .catch((e) => {
      writeLineSync(2, `error: ${String(e?.message ?? e)}`);
      process.exitCode = 1;
    });
}
