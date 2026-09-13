#!/usr/bin/env node
/**
 * @file scripts/operations/ci-heal-dispatch-wrapper.mjs
 * @description THE CI-HEAL DISPATCH WRAPPER (#3642, under epic #3383) — the mechanical arc a `ci-heal`
 * dispatch runs instead of handing a `claude --bg` agent the 200-line
 * `we:skills-src/conveyor/fix-agent-ci-brief.md` and trusting it to run its own lifecycle.
 *
 * THE SIXTH AND LAST LAUNCH KIND TO GET ONE, and deliberately the SAME shape as `fix`'s
 * (`we:scripts/operations/fix-dispatch-wrapper.mjs`, #3640), because the two ARE the same shape: both are
 * PR-keyed repair dispatches, both reconstitute an existing PR's pushed `lane/*` ref rather than rebuilding,
 * both re-push HEAD to that same ref, and both are grouped as one in
 * `we:scripts/operations/dispatch-lane.mjs#BRIEF_REQUIRED_BY_KIND`.
 *
 * ── A SEPARATE WRAPPER THAT IMPORTS, NOT A SHARED "REPAIR CORE" WITH TWO ARMS (the design call #3642 left to
 *    this build, and the reasoning, since the card explicitly asks for it) ────────────────────────────────────
 *
 * The card offers three options: copy `fix`'s wrapper near-verbatim, extract a shared core, or write a fresh
 * one. This file is the SECOND-AND-A-HALF: a separate module whose reusable half is IMPORTED from
 * `fix-dispatch-wrapper.mjs` rather than copied, and whose genuinely-different half is written here.
 *
 * WHY NOT A SHARED CORE WITH TWO THIN ARMS. That is the shape you would choose if the two arcs differed only
 * in their edges. They do not — checked step by step against `dispatchFix`, four of its nine steps differ:
 *
 *   1. THE FINDING. A `fix` reads the reviewer's latest changes-requested COMMENT off `gh pr view`
 *      ({@link ../fix-dispatch-wrapper.mjs#resolveFixTarget}). A CI failure is not a comment at all — it is
 *      `gh pr checks` plus, for a non-obvious break, a failing run's log. Nothing of that resolver carries.
 *   2. THE REBASE. A `ci-heal` has a mechanical step a `fix` does not have at all: `git fetch origin main` +
 *      `git rebase origin/main`, which for the MOST COMMON cause of a post-open red check (main advanced
 *      under the branch) is the entire repair. {@link rebaseOntoMain} is new code with no `fix` analogue.
 *   3. THE PUSH. A rebase rewrites the lane's history, so the re-push must be `--force-with-lease`. `fix`'s
 *      {@link ../fix-dispatch-wrapper.mjs#pushLaneRef} pushed plain. It now takes an OPTIONAL
 *      `forceWithLease` (default `false`, so every existing caller is byte-identical) — the one genuinely
 *      shared helper that needed widening rather than replacing.
 *   4. THE HAND-BACK. A `fix` re-arms the review (`review:changes` → `review:pending`). A `ci-heal` must
 *      NEVER go near a review label — that is the single hardest rule in `fix-agent-ci-brief.md`, stated in
 *      its guardrails and again in `ci-heal-mark.mjs`'s own header. Its hand-back is a durable COMMENT whose
 *      count binds the restart-surviving retry cap ({@link ciHealMark}).
 *
 * A "core" spanning that would be a function taking four strategy callbacks, which is a worse `fix` wrapper
 * and a worse `ci-heal` wrapper than two files that share the eight things below. And restructuring
 * `fix-dispatch-wrapper.mjs` — a sibling's work landed one commit ago — to host it would have been the more
 * damaging half of the trade. So: import the shared half, write the different half, state which is which.
 *
 * WHAT IS IMPORTED FROM `fix-dispatch-wrapper.mjs`, VERBATIM (the list its own header hands over, checked
 * against its code rather than taken on trust):
 *   • {@link ../fix-dispatch-wrapper.mjs#buildFixAgentEnv} — its `WE_DISPATCH_KIND: 'repair'` stamp is ALREADY
 *     the shared wrapper-agent kind (`dispatch-lane.mjs#REPAIR_AGENT_KIND`, whose own docblock says it covers
 *     both PR-keyed repair kinds), so this item introduces NO new kind and needs NO `guard-bash.mjs` change.
 *     `guard-bash.mjs#WRAPPER_OWNED_AGENTS.repair` already reads `agent: 'repair (fix / ci-heal)'`.
 *   • {@link ../fix-dispatch-wrapper.mjs#FIX_HOOKS_SETTINGS} — the four `PreToolUse` hooks, reused as a VALUE.
 *   • {@link ../fix-dispatch-wrapper.mjs#runFixGateWithOneRetry} — kind-agnostic: it takes the provider and
 *     the slug, and reads a fix report. Reused unmodified, with THIS file's provider handed in.
 *   • {@link ../fix-dispatch-wrapper.mjs#pushLaneRef} — widened by one optional flag, see 3 above.
 *   • {@link ../fix-dispatch-wrapper.mjs#standDown} — verbatim.
 *   • `minimal-context-provider.mjs#acquireLane`'s `--base=<headRefName>` shape — verbatim.
 *   • `deliver-item-wrapper.mjs#runConverge` with `dispatchKind: REPAIR_AGENT_KIND` — verbatim.
 *   • the whole `fix-report-*` family — see {@link runCiHealAgentToCompletion}'s docblock for why a third
 *     report triple was NOT created.
 *
 * ONE HANDED-OVER ITEM THAT DOES **NOT** GENERALIZE, reported rather than quietly worked around:
 * {@link ../fix-dispatch-wrapper.mjs#ensureFixHooksSettingsFile}. Its SETTINGS generalize; the WRITER does
 * not. That export is `createHooksSettingsWriter('fix-agent-hooks-settings.json', …)` — a writer bound to ONE
 * on-disk path — and the fix wrapper's own docblock states the rule it would break: the file is "never shared
 * with the delivery wrapper's own file — two dispatch kinds writing the SAME sidecar path would race under
 * concurrent dispatch". `fix` and `ci-heal` are concurrently dispatchable by construction (they are keyed on
 * DIFFERENT PRs, and a tick can surface one of each), and `createHooksSettingsWriter` does a plain
 * non-atomic `writeFileSync` on every call, so a concurrent `ci-heal` reusing that binding would be exactly
 * the race that note forbids. {@link ensureCiHealHooksSettingsFile} is therefore its own writer over the SAME
 * frozen settings object — the value is shared, the path is not.
 *
 * ── RESTART SURVIVAL (the parent epic's cross-cutting clause, and this item's "Done when" 2) ────────────────
 *
 * NOTHING IN THIS FILE RUNS INSIDE THE RESIDENT RUNNER. This arc BLOCKS (a `gh` read, a rebase, one agent
 * turn budgeted at an hour, a 150-350s gate, a converge pass), and the dispatch path it sits on is
 * `we:skills-src/conveyor/runner.mjs`'s `makeCliDispatchPass` — a SYNCHRONOUS `execFileSync` inside the
 * runner's own tick. So the block lives in a separate, DETACHED process:
 * `we:scripts/operations/ci-heal-run.mjs` is this file's only production caller and
 * `we:scripts/operations/dispatch-providers/ci-heal.mjs` spawns it `detached: true` / `.unref()`'d, returning
 * a `pid:<n>` handle the KERNEL answers liveness for. See `ci-heal-run.mjs`'s header for the full account —
 * it is #3645's and #3640's, unchanged.
 *
 * ── HONESTY LABEL (`we:docs/agent/prototype-based-dev.md`) ──────────────────────────────────────────────────
 *
 * NOT LIVE-EXERCISED. Every CLI surface below was read from the live source it shells (`gh pr view`,
 * `gh pr checks`, `gh run view`, `we:scripts/lane-pool.mjs`, `we:scripts/conveyor/ci-heal-mark.mjs`,
 * `we:scripts/conveyor/stand-down.mjs`, `we:scripts/operations/completion-cli.mjs`), and every process
 * boundary is injected so the whole arc is assertable — but "the code is real" and "the pipeline has run end
 * to end against a real red PR" are different claims, and only the first holds today. Per the card, this path
 * stays parked until a real driver+observer run proves it. No runner, supervisor or conveyor was started at
 * any point while building it.
 *
 * IMPURE: `node:child_process` (via the shared `run`), `node:crypto` (session ids), `node:fs` (the diagnosis
 * scratch write/cleanup). Every impure call is injectable, mirroring all four sibling wrappers' convention.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REPO_ROOT, run, acquireLane, releaseAllPools, buildRestrictedProviderArgv, createHooksSettingsWriter,
  persistSpawnFailure,
} from './minimal-context-provider.mjs';
import {
  runConverge, DELIVERY_AGENT_PROVIDER_NAMES, DEFAULT_DELIVERY_AGENT_PROVIDER_NAME,
} from './deliver-item-wrapper.mjs';
// #3383 — delivery telemetry; see `telemetry-store.mjs`. Never throws, never alters control flow.
import { activeRecorder, recorderFor, setActiveRecorder, spanAroundAsyncWithCpu, recordChildResourceUsage } from './telemetry-store.mjs';
import { spawnAgentToCompletion } from './dispatch-lane-io.mjs';
import { REPAIR_AGENT_KIND } from './dispatch-lane.mjs';
import {
  FIX_AGENT_SPAWN_TIMEOUT_MS, FIX_HOOKS_SETTINGS, buildFixAgentEnv, pushLaneRef, runFixGateWithOneRetry,
  standDown,
} from './fix-dispatch-wrapper.mjs';
import { tryReadFixReport, resolveFixReportsDir, deleteFixReport } from './fix-report-store.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';
// mechanical-dispatcher (epic #3383, Part 1) — REUSED verbatim from `fix-dispatch-wrapper.mjs`'s own Codex
// provider, which itself reuses these from `codex-delivery-provider.mjs`; see that file's own header for the
// live-verification trail. `CI_HEAL_CODEX_PROVIDER` below only differs from `FIX_CODEX_PROVIDER` in the ENV it
// builds (`buildCiHealAgentEnv`, which carries `reason` alongside everything `buildFixAgentEnv` already does).
import {
  buildCodexDeliveryArgv, defaultSpawnCodexAgent, parseCodexThreadId, readCodexThreadId, writeCodexThreadId,
  defaultDeliveryDenyPaths, assertDenyPathsUsable, recordCodexTurnUsage,
} from './codex-delivery-provider.mjs';

/** The lane-pool `--purpose` this wrapper's acquire carries — the SAME string
 *  `we:skills-src/conveyor/fix-agent-ci-brief.md` step 1 already used, so a lane's purpose field keeps meaning
 *  what it meant before the lifecycle moved out of the brief. Deliberately DISTINCT from
 *  `fix-dispatch-wrapper.mjs#FIX_LANE_PURPOSE` (`conveyor-fix`): the two repair kinds must stay tellable apart
 *  in a lane lease, because a `/finish` taking one over needs to know which axis was being repaired. */
export const CI_HEAL_LANE_PURPOSE = 'conveyor-ci-heal';

/** Same bound, same reasoning, as `fix-dispatch-wrapper.mjs#FIX_LOOP_ACQUIRE_WAIT_MS` — re-exported through an
 *  import rather than re-typed so the two repair kinds cannot drift on it. */
export const CI_HEAL_LOOP_ACQUIRE_WAIT_MS = 30000;

/** The scratch path, RELATIVE TO THE LANE, this wrapper writes the CI diagnosis to before spawning the agent,
 *  and deletes right after the agent's turn ends. The CI analogue of
 *  `fix-dispatch-wrapper.mjs#FIX_FINDING_SCRATCH_FILENAME`, and named in
 *  `we:skills-src/conveyor/ci-heal-agent-brief-v2.md`'s own prose. Never committed: the agent commits explicit
 *  paths only, and this file is gone before the gate or converge could see it as a stray touched path. */
export const CI_HEAL_DIAGNOSIS_SCRATCH_FILENAME = '.ci-heal-failure.md';

/** The two `--reason` values `we:scripts/conveyor/ci-heal-mark.mjs`'s own CLI understands, read off its
 *  `buildCiHealComment` rather than invented. Anything else is passed through as "unknown" — the marker CLI
 *  has its own generic fallback clause for that, so an unrecognised reason degrades to a vaguer comment and
 *  never to a crash. */
export const CI_HEAL_REASONS = Object.freeze(['red-ci', 'behind']);

/** `gh pr checks --json`'s own `bucket` values that mean THIS CHECK IS RED. Read from `gh pr checks --help`'s
 *  documented buckets (`pass`/`fail`/`pending`/`skipping`/`cancel`) rather than from a `state` enum, because
 *  `bucket` is the field that already collapses GitHub's several failure states into one. `cancel` is counted
 *  as red deliberately: a cancelled required check is not green, and the drain will not land on it. */
export const CI_FAILED_BUCKETS = Object.freeze(['fail', 'cancel']);

/** How much of a failing run's log is handed to the agent. A `gh run view --log-failed` can be megabytes; the
 *  agent is spawned with a prompt, not a file budget, and the TAIL is where a failing step's actual error
 *  lives. Truncated from the FRONT (the tail is kept) for that reason. */
export const CI_HEAL_LOG_TAIL_BYTES = 8000;

// ================================================================================================
// 0. Plan + shape one dispatch request — PURE, mirrors `fix-dispatch-wrapper.mjs#planFixDispatchWrapper`.
// ================================================================================================

/**
 * @param {{pr: number|string, repo: string, item?: (number|string|null), reason?: (string|null)}} o
 * @returns {{pr: number, repo: string, item: (string|null), reason: (string|null), sessionSlug: string}}
 */
export function planCiHealDispatchWrapper({ pr, repo, item = null, reason = null } = {}) {
  const prNum = Number(pr);
  if (!Number.isInteger(prNum) || prNum <= 0) {
    throw new Error(`ci-heal-dispatch-wrapper: --pr must be a positive integer, got ${JSON.stringify(pr)}`);
  }
  const repoStr = String(repo ?? '').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repoStr)) {
    throw new Error(`ci-heal-dispatch-wrapper: --repo must be an \`owner/repo\` slug, got ${JSON.stringify(repo)}`);
  }
  const itemStr = item === null || item === undefined || String(item).trim() === '' ? null : String(item).trim();
  const reasonStr = reason === null || reason === undefined || String(reason).trim() === '' ? null : String(reason).trim();
  // `ci-heal-<pr>` — the SAME grammar `dispatch-lane.mjs#sessionSlugFor(num, 'ci-heal', pr)` mints, and the
  // same grammar `fix-agent-ci-brief.md`'s own `{{SESSION_SLUG}}` row already named. RE-DERIVED here rather
  // than imported, the same "re-derive, never share the binding" choice `planFixDispatchWrapper` makes — and
  // `ci-heal-run.mjs#assertSessionSlugAgrees` asserts the two agree on every dispatch rather than trusting it.
  return { pr: prNum, repo: repoStr, item: itemStr, reason: reasonStr, sessionSlug: `ci-heal-${prNum}` };
}

// ================================================================================================
// 1. Resolve the red PR's own lane ref + WHAT ACTUALLY FAILED — the piece that does NOT carry over from
//    `fix`. A CI failure is not a changes-requested comment: it is `gh pr checks`, plus (for a non-obvious
//    break) the failing run's own log. Everything here is new code with no `fix` analogue.
// ================================================================================================

/** PURE. The checks that are RED, as `gh pr checks --json` returns them. Keyed on `bucket` (see
 *  {@link CI_FAILED_BUCKETS}); a row with no `bucket` at all falls back to its `state`, so a `gh` old enough
 *  not to emit buckets still yields something rather than silently reporting "nothing failed".
 *  @param {Array<object>|null|undefined} checks */
export function findFailingChecks(checks) {
  if (!Array.isArray(checks)) return [];
  return checks.filter((c) => {
    const bucket = String(c?.bucket ?? '').toLowerCase();
    if (bucket) return CI_FAILED_BUCKETS.includes(bucket);
    const state = String(c?.state ?? '').toUpperCase();
    return state === 'FAILURE' || state === 'ERROR' || state === 'TIMED_OUT' || state === 'CANCELLED';
  });
}

/** PURE. The Actions RUN id inside a check's `link`
 *  (`https://github.com/<owner>/<repo>/actions/runs/<runId>/job/<jobId>`), or `null` for a check whose link is
 *  not an Actions run at all (an external status check has an arbitrary target URL). `null` is not an error —
 *  it means "no log to fetch for this one", and {@link resolveCiHealTarget} simply skips the log read. */
export function runIdFromCheckLink(link) {
  const m = String(link ?? '').match(/\/actions\/runs\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * REAL — `gh pr checks <pr> --repo <repo> --json …`.
 *
 * `gh pr checks` EXITS NON-ZERO WHEN ANY CHECK IS FAILING OR PENDING (exit 8), which is precisely the state
 * this wrapper is dispatched INTO — so the naive `run(...)` call throws on every single real CI-heal and the
 * JSON it printed on stdout is thrown away with it. Verified against `gh`'s own documented exit codes rather
 * than discovered in production. The output is recovered off the thrown error's `stdout` (what
 * `execFileSync` attaches), and only a throw carrying NO stdout at all is re-raised as a genuine failure.
 *
 * @param {{pr: number, repo: string}} o
 * @param {{run?: Function}} [io]
 * @returns {Array<object>} the checks, as `gh` returned them.
 */
export function readPrChecks({ pr, repo }, { run: runFn = run } = {}) {
  const argv = ['pr', 'checks', String(pr), '--repo', repo, '--json', 'name,state,bucket,link,workflow,description'];
  let out;
  try {
    out = runFn('gh', argv);
  } catch (e) {
    const recovered = e && typeof e.stdout === 'string' ? e.stdout : null;
    if (!recovered || !recovered.trim()) throw e;
    out = recovered;
  }
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed : [];
}

/** REAL, BEST-EFFORT — `gh run view <runId> --log-failed --repo <repo>`, tail-truncated to
 *  {@link CI_HEAL_LOG_TAIL_BYTES}. Returns `null` rather than throwing when the log cannot be read: a missing
 *  log makes the diagnosis thinner, it does not make the heal impossible (the check's own name and description
 *  are still handed over), and failing the whole dispatch over an unreadable log would be the wrong trade. */
export function readFailedRunLog({ runId, repo }, { run: runFn = run } = {}) {
  if (!runId) return null;
  try {
    const out = String(runFn('gh', ['run', 'view', String(runId), '--log-failed', '--repo', repo]) ?? '');
    if (!out.trim()) return null;
    return out.length > CI_HEAL_LOG_TAIL_BYTES
      ? `…(truncated — showing the last ${CI_HEAL_LOG_TAIL_BYTES} bytes)…\n${out.slice(-CI_HEAL_LOG_TAIL_BYTES)}`
      : out;
  } catch {
    return null;
  }
}

/**
 * PURE. The markdown this wrapper writes to {@link CI_HEAL_DIAGNOSIS_SCRATCH_FILENAME} — the ONLY place the CI
 * failure lives for the agent, exactly as `.fix-review-finding.md` is for a fixer. Written by the WRAPPER so
 * the agent never runs `gh` itself (which `guard-bash.mjs`'s `repair` arm denies it anyway).
 */
export function buildCiHealDiagnosis({ pr, reason, mergeStateStatus, failingChecks, log, rebase }) {
  const lines = [`# CI failure on PR #${pr}`, ''];
  lines.push(`- Dispatch reason: \`${reason || 'unknown'}\``);
  if (mergeStateStatus) lines.push(`- Merge state at dispatch: \`${mergeStateStatus}\``);
  if (rebase) lines.push(`- Rebase onto \`origin/main\`: **${rebase}**`);
  lines.push('');
  if (!failingChecks.length) {
    lines.push(
      'No required check is currently RED. This heal was dispatched because the branch had fallen BEHIND',
      '`main`; the rebase above is very likely the entire repair. Confirm nothing else is broken, then report',
      '`fixed` — with no files touched if the rebase alone did it.',
      '',
    );
  } else {
    lines.push('## Failing checks', '');
    for (const c of failingChecks) {
      const bits = [`**${c.name || '(unnamed check)'}**`];
      if (c.workflow) bits.push(`workflow: \`${c.workflow}\``);
      if (c.state) bits.push(`state: \`${c.state}\``);
      if (c.bucket) bits.push(`bucket: \`${c.bucket}\``);
      lines.push(`- ${bits.join(' — ')}`);
      if (c.description) lines.push(`  - ${c.description}`);
      if (c.link) lines.push(`  - ${c.link}`);
    }
    lines.push('');
  }
  if (log) lines.push('## Failing step log (tail)', '', '```', log, '```', '');
  return lines.join('\n');
}

/**
 * REAL — the whole CI-side read, in one call: the PR's own lane ref and merge state (`gh pr view`), which
 * required checks are red (`gh pr checks`), and the failing step's log for the first of those that names an
 * Actions run (`gh run view --log-failed`, best-effort).
 *
 * @param {{pr: number, repo: string}} o
 * @param {{run?: Function, readChecks?: Function, readLog?: Function}} [io]
 * @returns {{headRefName: string, mergeStateStatus: (string|null), failingChecks: object[], log: (string|null)}}
 */
export function resolveCiHealTarget({ pr, repo }, {
  run: runFn = run, readChecks = readPrChecks, readLog = readFailedRunLog,
} = {}) {
  const out = runFn('gh', ['pr', 'view', String(pr), '--json', 'headRefName,mergeStateStatus', '--repo', repo]);
  const parsed = JSON.parse(out);
  const failingChecks = findFailingChecks(readChecks({ pr, repo }, { run: runFn }));
  const runId = failingChecks.map((c) => runIdFromCheckLink(c.link)).find(Boolean) ?? null;
  return {
    headRefName: parsed.headRefName,
    mergeStateStatus: parsed.mergeStateStatus ?? null,
    failingChecks,
    log: readLog({ runId, repo }, { run: runFn }),
  };
}

// ================================================================================================
// 2. THE REBASE — the step `fix` has no analogue for at all, and the most common repair on this axis.
// ================================================================================================

/**
 * REAL — `git fetch origin main` then `git rebase origin/main` in the lane.
 *
 * THE CONFLICT BRANCH ABORTS RATHER THAN HANDING THE AGENT A HALF-REBASED LANE, and that is a DELIBERATE
 * NARROWING of `we:skills-src/conveyor/fix-agent-ci-brief.md` step 2, which asks the AGENT to resolve a
 * conflict "the `/finish` way" (regenerate derived artifacts, take-main for coordination JSON). Named rather
 * than silently dropped, with the reason:
 *
 *   * A lane left mid-`git rebase` is a state this wrapper cannot verify it handed over cleanly, and cannot
 *     verify the agent left cleanly either — the gate, the one-commit assumption and the force-push all read
 *     a working tree that a stalled `rebase --continue` would leave in a shape none of them check for. The
 *     agent is spawned `--restricted` with a brief that says nothing about rebase mechanics, precisely so it
 *     never has to reason about them.
 *   * `escalated-conflict` is ALREADY the ratified outcome for exactly this situation on the sibling repair
 *     kind (`fix-report-record.mjs#FIX_OUTCOMES`), and `stand-down.mjs#STAND_DOWN_REASONS.conflict` is
 *     already its durable marker. A human takes it over with `/finish` — which is what the prose brief's own
 *     escalation clause says happens anyway.
 *   * A conflict is the MINORITY case on this axis. The common one — `main` advanced and the branch simply
 *     needs replaying — is fully mechanical and is what this function exists for.
 *
 * Widening this to a wrapper-driven conflict resolution is real follow-up work; it is flagged here rather
 * than faked. `git rebase --abort` runs best-effort on the conflict path so the lane is released in a state
 * the next occupant's `acquire` can reset from cleanly.
 *
 * @returns {{status: ('rebased'|'already-current'|'conflict'), detail: (string|null)}}
 */
export function rebaseOntoMain({ lanePath }, { run: runFn = run } = {}) {
  runFn('git', ['fetch', 'origin', 'main'], { cwd: lanePath });
  const before = String(runFn('git', ['rev-parse', 'HEAD'], { cwd: lanePath }) ?? '').trim();
  try {
    runFn('git', ['rebase', 'origin/main'], { cwd: lanePath });
  } catch (e) {
    try { runFn('git', ['rebase', '--abort'], { cwd: lanePath }); } catch { /* best-effort — see docblock */ }
    return { status: 'conflict', detail: String((e && (e.stderr || e.message)) || e).slice(0, 500) };
  }
  const after = String(runFn('git', ['rev-parse', 'HEAD'], { cwd: lanePath }) ?? '').trim();
  return { status: after === before ? 'already-current' : 'rebased', detail: null };
}

// ================================================================================================
// 3. Minimal-context hooks settings — the SETTINGS are `fix`'s, imported; the WRITER is this kind's own.
//    See this file's header for why `ensureFixHooksSettingsFile` itself does NOT generalize.
// ================================================================================================

export const ensureCiHealHooksSettingsFile = createHooksSettingsWriter(
  'ci-heal-agent-hooks-settings.json', FIX_HOOKS_SETTINGS,
);

// ================================================================================================
// 4. Spawn + get the structured report.
// ================================================================================================

/** PURE — `buildFixAgentEnv`'s env VERBATIM (including its `WE_DISPATCH_KIND: 'repair'` stamp, which is
 *  already the shared wrapper-agent kind for both repair dispatches — see `REPAIR_AGENT_KIND`'s own docblock),
 *  plus the one variable a CI heal has and a review repair does not.
 *
 *  THE `FIX_*` NAMES ARE KEPT ON PURPOSE, not renamed to `CI_HEAL_*`. The report channel this brief uses IS
 *  the fix-report CLI (see {@link runCiHealAgentToCompletion}), so its env var names are that CLI's own and
 *  the brief's one reporting command comes out byte-identical to the fixer's. The same trade
 *  `prepare-scope-wrapper.mjs#buildPrepareAgentEnv` documents for reusing `$DELIVERY_SESSION`. */
export function buildCiHealAgentEnv({ sessionSlug, pr, item, lanePath, reportsDir, reason }) {
  return {
    ...buildFixAgentEnv({ sessionSlug, pr, item, lanePath, reportsDir }),
    CI_HEAL_REASON: reason ?? '',
  };
}

const CI_HEAL_AGENT_PROVIDER = {
  name: 'claude-restricted-ci-heal',
  async spawn(
    { sessionId, prompt, resumeSessionId = null, lanePath, sessionSlug, pr, item, reason } = {},
    {
      ensureSettingsFile = ensureCiHealHooksSettingsFile,
      spawnAgent = spawnAgentToCompletion,
      persistFailure = persistSpawnFailure,
      resolveReportsDir = resolveFixReportsDir,
      recordCpu = recordChildResourceUsage,
    } = {},
  ) {
    const settingsFile = ensureSettingsFile();
    const argv = buildRestrictedProviderArgv({ sessionId, prompt, resumeSessionId, settingsFile });
    // #3383 mechanical-dispatcher fix — lane-aware (see `deliver-item-wrapper.mjs`'s equivalent fix for the
    // full root-cause account): un-parameterized, `resolveReportsDir()` named the primary checkout regardless
    // of `lanePath`.
    const env = buildCiHealAgentEnv({ sessionSlug, pr, item, lanePath, reportsDir: resolveReportsDir(lanePath), reason });
    try {
      // `cwd: lanePath` is load-bearing: `--restricted` confines the file tools to the process's own working
      // directory, so a wrong cwd sandboxes the agent into the wrong repo entirely (#3627 bug 7(a), live).
      // #3383 mechanical-dispatcher follow-up — ASYNC now (was `execFileSync`); `await` is the only "wait".
      const { resourceUsage } = (await spawnAgent(argv, { cwd: lanePath, env: { ...process.env, ...env }, timeout: FIX_AGENT_SPAWN_TIMEOUT_MS })) || {};
      recordCpu(resourceUsage);
    } catch (e) {
      recordCpu(e && e.resourceUsage);
      persistFailure('ci-heal-spawn-failures', sessionSlug, e, { resumeSessionId });
      throw e;
    }
  },
};

/**
 * CI_HEAL_CODEX_PROVIDER — mechanical-dispatcher (epic #3383) Part 1: the `ci-heal` kind's own Codex
 * implementation of the `DeliveryAgentProvider` port. Structurally identical to
 * `fix-dispatch-wrapper.mjs#FIX_CODEX_PROVIDER` — same reused `codex-delivery-provider.mjs` primitives, same
 * resume-by-thread-id sidecar keyed on `sessionSlug` (here `ci-heal-<PR>`, so it can never collide with a
 * `fix-<PR>` sidecar on the same PR) — differing only in the env it builds (`buildCiHealAgentEnv`, which adds
 * `CI_HEAL_REASON` on top of everything `buildFixAgentEnv` already carries) and its own failure-sidecar name.
 */
const CI_HEAL_CODEX_PROVIDER = {
  name: 'codex',
  async spawn(
    { sessionId, prompt, resumeSessionId = null, lanePath, sessionSlug, pr, item, reason } = {},
    {
      spawnAgent = defaultSpawnCodexAgent,
      persistFailure = persistSpawnFailure,
      resolveReportsDir = resolveFixReportsDir,
      readThreadId = readCodexThreadId,
      writeThreadId = writeCodexThreadId,
      denyPaths = null,
      recordCpu = recordChildResourceUsage,
    } = {},
  ) {
    // #3383 mechanical-dispatcher fix — same lane-aware resolution as `CI_HEAL_AGENT_PROVIDER` above.
    const env = buildCiHealAgentEnv({ sessionSlug, pr, item, lanePath, reportsDir: resolveReportsDir(lanePath), reason });
    const deny = assertDenyPathsUsable(denyPaths ?? defaultDeliveryDenyPaths(), lanePath);
    const resumeThreadId = resumeSessionId ? readThreadId(sessionSlug) : null;
    if (resumeSessionId && !resumeThreadId) {
      throw new Error(
        `ci-heal-dispatch-wrapper: CI_HEAL_CODEX_PROVIDER cannot resume session ${sessionSlug} — no Codex thread `
        + 'id was recorded for it (the fresh spawn never reached `thread.started`, or its sidecar was removed). '
        + 'Refusing to silently start a NEW session, which would lose the heal context the resume exists to carry.',
      );
    }
    const argv = buildCodexDeliveryArgv({ prompt, cwd: lanePath, denyPaths: deny, resumeThreadId });
    let stdout;
    try {
      // #3383 mechanical-dispatcher follow-up — ASYNC now; `await` is the only "wait".
      const spawned = (await spawnAgent(argv, { cwd: lanePath, env: { ...process.env, ...env }, timeout: FIX_AGENT_SPAWN_TIMEOUT_MS })) || {};
      stdout = spawned.stdout;
      recordCpu(spawned.resourceUsage);
    } catch (e) {
      recordCpu(e && e.resourceUsage);
      persistFailure('ci-heal-spawn-failures', sessionSlug, e, { resumeSessionId });
      throw e;
    }
    // #3383 usage-ledger follow-up — best-effort, never throws; see that function's own header.
    recordCodexTurnUsage(stdout);
    if (!resumeThreadId) {
      const threadId = parseCodexThreadId(stdout);
      if (threadId) writeThreadId(sessionSlug, threadId);
    }
    void sessionId; // unused — Codex mints its own id (see `FIX_CODEX_PROVIDER`'s own docblock).
  },
};

/** The `ci-heal` provider registry — same keys as `deliver-item-wrapper.mjs#DELIVERY_AGENT_PROVIDERS` /
 *  `fix-dispatch-wrapper.mjs#FIX_AGENT_PROVIDERS`. */
export const CI_HEAL_AGENT_PROVIDERS = Object.freeze({
  'claude-restricted': CI_HEAL_AGENT_PROVIDER,
  codex: CI_HEAL_CODEX_PROVIDER,
});

/**
 * Name → `ci-heal` provider, refusing an unknown name by NAME — mirrors
 * `deliver-item-wrapper.mjs#resolveDeliveryAgentProvider`/`fix-dispatch-wrapper.mjs#resolveFixAgentProvider`.
 * @param {string} [name] - one of {@link DELIVERY_AGENT_PROVIDER_NAMES}.
 * @returns {object}
 */
export function resolveCiHealAgentProvider(name = DEFAULT_DELIVERY_AGENT_PROVIDER_NAME) {
  const provider = CI_HEAL_AGENT_PROVIDERS[String(name).trim()];
  if (provider) return provider;
  throw new Error(
    `ci-heal-dispatch-wrapper: unknown delivery agent provider ${JSON.stringify(name)} — one of `
    + `${DELIVERY_AGENT_PROVIDER_NAMES.join('|')}`,
  );
}

/**
 * Reads the static brief + spawns the agent through the provider, BLOCKING until it exits, then reads the
 * structured report.
 *
 * THE REPORT FAMILY IS REUSED, NOT CLONED — the same call `prepare-scope-wrapper.mjs` made for its own. A CI
 * heal's outcome vocabulary is `fix-report-record.mjs#FIX_OUTCOMES` exactly: `fixed` (the check is repaired),
 * `blocked` (something specific stopped it — e.g. the check turned out to be red for an infra reason nothing
 * in the diff can fix), `escalated-needs-judgment` (the diff itself is genuinely wrong and needs a design
 * call — `fix-agent-ci-brief.md` step 3's own "NOT a CI break" exit), `escalated-conflict` (a real same-line
 * overlap with `main`). Four exits, four outcomes, already named. A third identical report triple would have
 * been duplication for its own sake, and the SLUG (`ci-heal-<pr>` vs `fix-<pr>`) already keeps the two kinds'
 * sidecars from ever colliding on one PR.
 *
 * @returns {object} the agent's own `done` report.
 */
export async function runCiHealAgentToCompletion(
  { pr, item, reason, sessionSlug, lanePath, provider = CI_HEAL_AGENT_PROVIDER, claudeSessionId },
  {
    // The explicit `/` (never relying on REPO_ROOT's own trailing slash) mirrors all four sibling wrappers'
    // own default `readBrief` — REPO_ROOT's trailing slash does not resolve reliably under vitest's SSR
    // transform, and a redundant `//` collapses harmlessly on a real POSIX read.
    readBrief = () => readFileSync(`${REPO_ROOT}/skills-src/conveyor/ci-heal-agent-brief-v2.md`, 'utf8'),
    readReport = tryReadFixReport,
    resolveReportsDir = resolveFixReportsDir,
  } = {},
) {
  const prompt = readBrief();
  await provider.spawn({ sessionId: claudeSessionId, prompt, lanePath, sessionSlug, pr, item, reason }); // AWAITS.
  // #3383 mechanical-dispatcher fix — read back from the SAME lane-scoped directory the provider just used,
  // never this process's own script-location default (see `deliver-item-wrapper.mjs`'s equivalent fix).
  const report = readReport(sessionSlug, resolveReportsDir(lanePath));
  if (!report || report.status !== 'done') {
    throw new Error(`ci-heal-dispatch-wrapper: agent for ${sessionSlug} exited with no done report (crash or refused effect)`);
  }
  return report;
}

// ================================================================================================
// 5. Hand-back — THE ONE STEP THAT MUST NOT BE `fix`'s. A healed CI run is NEVER a `rearm-review`.
// ================================================================================================

/**
 * REAL — `we:scripts/conveyor/ci-heal-mark.mjs <pr> --repo=<repo> [--reason=<red-ci|behind>]`.
 *
 * THIS IS THE ONLY THING A CI HEAL WRITES TO THE PR, and it is a COMMENT, never a label. `review:human` /
 * `review:pending` / `review:changes` / `ready-to-merge` are ALL left exactly as they were — the hardest rule
 * in `fix-agent-ci-brief.md`, and the reason `rearmReview` is deliberately NOT imported into this file at all
 * (a `ci-heal` that re-armed a review would silently clear a human's own pending verdict). The comment is
 * load-bearing beyond the audit trail: `ci-heal-mark.mjs#countCiHealComments` counts these to bind the retry
 * cap ACROSS A CONVEYOR RESTART, which is the whole reason it is a durable comment and not a log line.
 *
 * `--actor` names the wrapper rather than defaulting to "conveyor CI-heal agent": the agent no longer drives
 * this arc, and a comment that said it did would be the stale-note class #3640 had to correct elsewhere.
 */
export function ciHealMark({ pr, repo, reason }, { run: runFn = run } = {}) {
  const args = [
    'scripts/conveyor/ci-heal-mark.mjs', String(pr), `--repo=${repo}`,
    '--actor=the #3642 mechanical CI-heal wrapper',
  ];
  if (reason && CI_HEAL_REASONS.includes(reason)) args.push(`--reason=${reason}`);
  runFn('node', args);
}

/** Forwards the agent's optional learning — mirrors both sibling wrappers' own module-private `dropLearning`
 *  (re-derived rather than imported: neither of theirs is exported). */
function dropLearning({ sessionSlug, learning }, { run: runFn = run } = {}) {
  runFn('node', [
    'scripts/conveyor/learnings-drop.mjs', `--kind=${learning.kind}`, `--summary=${learning.summary}`,
    `--area=${learning.area}`, `--suggestion=${learning.suggestion}`, `--session=${sessionSlug}`,
  ]);
}

// ================================================================================================
// 6. Durable dispatch trace — `completion-cli.mjs report …` (#3436), `--kind=ci-heal` (added to
//    `completion-record.mjs#COMPLETION_KINDS` by this item; its slug grammar `ci-heal-<pr>` is already
//    exactly what `sessionSlugForCompletion` derives).
// ================================================================================================

function reportStarted({ sessionSlug, pr, item }, { run: runFn = run } = {}) {
  const args = ['scripts/operations/completion-cli.mjs', 'report', `--session=${sessionSlug}`, '--kind=ci-heal', `--pr=${pr}`, '--status=started'];
  if (item) args.push(`--item=${item}`);
  runFn('node', args);
}

function reportDone({ sessionSlug, classified }, { run: runFn = run } = {}) {
  // #3383 — THE TERMINAL-OUTCOME CHOKEPOINT, reused as the telemetry close. Every exit branch in this
  // wrapper funnels its classified outcome through here, so closing the root `dispatch` span here catches
  // all of them — including branches a future edit adds — and guarantees the span's outcome and the
  // completion record's outcome are read from the SAME object at the SAME moment, so they can never
  // disagree. `closeRoot` is idempotent, never throws, and maps this wrapper's own outcome vocabulary onto
  // an OTel status via the shared `classifyOutcomeStatus` table (`telemetry.mjs#ERROR_OUTCOMES`).
  activeRecorder().closeRoot({ outcome: classified && classified.outcome, label: classified && classified.label });
  const args = ['scripts/operations/completion-cli.mjs', 'report', `--session=${sessionSlug}`, '--status=done', `--outcome=${classified.outcome}`];
  if (classified.label) args.push(`--label=${classified.label}`);
  runFn('node', args);
}

/** Best-effort stringify+truncate of a caught error for a completion record's `label`. */
function describeError(e) {
  return String((e && (e.stderr || e.message)) || e).slice(0, 500);
}

// ================================================================================================
// THE ENTRY POINT
// ================================================================================================

/**
 * Heal ONE red/BEHIND PR's CI: resolve its lane ref and what actually failed, acquire a lane reconstituted at
 * that ref, rebase onto current `main`, spawn the minimal CI-heal agent exactly once (plus, rarely, one
 * gate-failure resume), gate it, converge the repair when there IS one, force-with-lease the re-push to the
 * PR's own ref, post the durable CI-heal comment, release, return.
 *
 * NEVER TOUCHES A REVIEW LABEL ON ANY PATH. The only PR writes on this whole arc are
 * `ci-heal-mark.mjs`'s comment and `stand-down.mjs`'s (both of which change no label, by their own design).
 *
 * ONE AGENT TURN ON EVERY PATH, INCLUDING A CLEAN REBASE — noted because the prose brief allows skipping the
 * self-review for "a clean rebase with no code change" and one could read that as allowing a zero-agent path
 * too. It does not, here: `runFixGateWithOneRetry` RESUMES the agent's own session when the gate comes back
 * red, so a path that never spawned one has nothing to resume and would have to grow a second, differently
 * shaped gate handler. What the clean-rebase case DOES skip is the converge pass (step 12 below) — which is
 * the expensive half, and is exactly the proportionality the brief asks for.
 *
 * @param {{pr: number|string, repo: string, item?: (number|string|null), reason?: (string|null)}} o
 * @param {object} [provider] - the `DeliveryAgentProvider` the one judgment turn runs under.
 * @param {{newSessionId?: () => string, run?: Function, waitMs?: number, ensureSettingsFile?: Function,
 *   resolveTarget?: Function, rebase?: Function}} [deps] - every impure call injectable, for the same reason
 *   all four sibling wrappers' are: the whole arc must be assertable with no lane pool, no `claude`, no `gh`.
 */
export async function dispatchCiHeal(
  { pr, repo, item, reason } = {},
  provider = CI_HEAL_AGENT_PROVIDER,
  {
    newSessionId = randomUUID, run: runFn = run, waitMs = CI_HEAL_LOOP_ACQUIRE_WAIT_MS,
    ensureSettingsFile = ensureCiHealHooksSettingsFile,
    resolveTarget = resolveCiHealTarget, rebase = rebaseOntoMain,
  } = {},
) {
  const planned = planCiHealDispatchWrapper({ pr, repo, item, reason });

  // #3383 — the root `dispatch` span for this whole ci-heal dispatch. Keyed on the ITEM when this wrapper was
  // given one (so it joins the build's own trace for the same backlog item) and on the PR otherwise; see
  // `deriveTraceId`. Installed as the ambient recorder so the shared `acquireLane`/`runVerifyOperation`
  // helpers emit `lane.acquire`/`verify.gate` into this trace without being passed anything. Closed at the
  // `reportDone` chokepoint below, which also self-uninstalls the ambient recorder.
  const tel = recorderFor({
    kind: 'ci-heal', item: planned.item ?? null, pr: planned.pr,
    attributes: { pr: planned.pr, repo: planned.repo, sessionSlug: planned.sessionSlug, ...(planned.item != null ? { item: String(planned.item) } : {}) },
  });
  setActiveRecorder(tel);
  tel.startRoot({ pr: planned.pr, repo: planned.repo, ...(planned.item != null ? { item: String(planned.item) } : {}) });
  const claudeSessionId = String(newSessionId());

  // Same bug-#xu2pp2m/2 hazard the fix wrapper documents, and the same answer: `ci-heal-<pr>` is IDENTICAL
  // across every attempt at the same PR (no per-attempt suffix in this grammar — `dispatch-lane.mjs` mints an
  // attempt tag for `build` only), and a report is keyed purely by that slug. A stale report from a prior
  // attempt would be read as THIS attempt's outcome if this one's agent crashes before writing its own.
  // Deleting first makes "no fresh report" unambiguous; it is a no-op on a genuine first attempt.
  deleteFixReport(planned.sessionSlug);

  // Durable trace BEFORE anything else can fail.
  reportStarted(planned, { run: runFn });

  let target;
  try {
    target = resolveTarget(planned, { run: runFn });
  } catch (e) {
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'blocked-on-infra', label: describeError(e) } }, { run: runFn });
    throw e;
  }

  if (!target.failingChecks.length && String(target.mergeStateStatus ?? '').toUpperCase() !== 'BEHIND') {
    // Nothing red and not behind — the CI recovered on its own between the tick that surfaced this PR and
    // now (a flake that passed on re-run is the common way). There is nothing to heal, and rebasing +
    // force-pushing a healthy PR to prove it would be strictly destructive. The symmetric `not-applicable`
    // to the fix wrapper's own "no changes-requested comment found" branch.
    const label = `no failing check and merge state ${target.mergeStateStatus ?? 'unknown'} — nothing to heal`;
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'not-applicable', label } }, { run: runFn });
    return { ...planned, lanePath: null, result: `not-applicable (${label})` };
  }

  let lanePath;
  try {
    lanePath = acquireLane(
      { sessionSlug: planned.sessionSlug, claudeSessionId, purpose: CI_HEAL_LANE_PURPOSE, base: target.headRefName, waitMs },
      { run: runFn },
    );
  } catch (e) {
    // `lane-pool.mjs acquire --base=<ref>` throws its own greppable text when the ref does not resolve
    // (`resolveBaseRef`: "--base=<ref> does not resolve in lane-N's clone") — the SAME `not-applicable` (lane
    // ref gone) shape `fix-agent-ci-brief.md` step 1 already names. Any OTHER thrown acquire is infra.
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

  let rebased;
  try {
    rebased = rebase({ lanePath }, { run: runFn });
  } catch (e) {
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'blocked-on-infra', label: describeError(e) } }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    throw e;
  }
  if (rebased.status === 'conflict') {
    // See `rebaseOntoMain`'s own docblock for why this escalates rather than handing the agent a half-rebased
    // lane. The agent is never spawned at all on this path — there is nothing safe for it to work on.
    standDown({ pr: planned.pr, repo: planned.repo, reason: 'conflict', detail: rebased.detail || '' }, { run: runFn });
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'escalated-conflict', label: rebased.detail || null } }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    return { ...planned, lanePath, result: 'stood-down (rebase conflict with main)' };
  }

  writeFileSync(
    `${lanePath}/${CI_HEAL_DIAGNOSIS_SCRATCH_FILENAME}`,
    buildCiHealDiagnosis({
      pr: planned.pr, reason: planned.reason, mergeStateStatus: target.mergeStateStatus,
      failingChecks: target.failingChecks, log: target.log, rebase: rebased.status,
    }),
  );

  let agentReport;
  try {
    // #3383 — THE EXPENSIVE SPAN, same reasoning as the fix wrapper's: the agent turn is this dispatch's
    // dominant cost and was previously untimed. `spanAroundAsyncWithCpu` (per-process-attribution follow-on)
    // never alters the return value or the throw, and merges a `process.cpuUsage()` delta into the closing
    // attributes — see that function's own docblock in `telemetry-store.mjs` for exactly what `cpu*Ms` does and
    // does not measure.
    agentReport = await spanAroundAsyncWithCpu('agent.turn', {
      attributes: {
        pr: planned.pr, item: planned.item ?? null, reason: planned.reason ?? null,
        lane: lanePath, dispatchKind: 'ci-heal', provider: provider.name,
      },
    }, () =>
      runCiHealAgentToCompletion(
        { pr: planned.pr, item: planned.item, reason: planned.reason, sessionSlug: planned.sessionSlug, lanePath, provider, claudeSessionId },
        { run: runFn },
      ));
  } catch (e) {
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'blocked-on-infra', label: describeError(e) } }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    throw e;
  } finally {
    // Never a real edit, never meant to be committed — see the scratch constant's own docblock. Gone before
    // the gate/converge below could see it as a stray touched path.
    try { rmSync(`${lanePath}/${CI_HEAL_DIAGNOSIS_SCRATCH_FILENAME}`, { force: true }); } catch { /* best-effort */ }
  }

  if (agentReport.outcome !== 'fixed') {
    const standDownReason = agentReport.outcome === 'escalated-conflict' ? 'conflict' : 'needs-judgment';
    standDown({ pr: planned.pr, repo: planned.repo, reason: standDownReason, detail: agentReport.reason || '' }, { run: runFn });
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: agentReport.outcome, label: agentReport.reason || null } }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    if (agentReport.learning) dropLearning({ sessionSlug: planned.sessionSlug, learning: agentReport.learning }, { run: runFn });
    return { ...planned, lanePath, result: `stood-down (${agentReport.outcome})` };
  }

  // REUSED UNMODIFIED from `fix-dispatch-wrapper.mjs` — it takes the provider and the slug and reads a fix
  // report, none of which is fix-specific. A red gate is a HARD STOP on this axis exactly as it is on the
  // other: `fix-agent-ci-brief.md` step 4's own rule is "do NOT re-push, report `ci-heal gate-red`".
  const gate = await runFixGateWithOneRetry(
    { lanePath, pr: planned.pr, item: planned.item, sessionSlug: planned.sessionSlug, provider, claudeSessionId },
    { run: runFn },
  );
  if (gate.status !== 'green') {
    const gateReason = gate.reason || 'the verification gate stayed red after one resume-and-retry';
    standDown({ pr: planned.pr, repo: planned.repo, reason: 'gate-red', detail: gateReason }, { run: runFn });
    reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'gate-red', label: gateReason } }, { run: runFn });
    releaseAllPools(planned.sessionSlug, { run: runFn });
    return { ...planned, lanePath, result: 'stood-down (gate-red)' };
  }

  // ONE converge pass — PROPORTIONATE, which is `fix-agent-ci-brief.md` step 5's own rule and the one place
  // this arc is deliberately cheaper than the fixer's: "a trivial, obviously-correct heal (a clean rebase
  // with no code change) may skip the subagent". `filesTouched` is the agent's own structured answer to
  // "did you change any code", so the skip is read off data rather than guessed from the rebase status.
  const touched = Array.isArray(agentReport.filesTouched) ? agentReport.filesTouched : [];
  if (touched.length) {
    let convergeVerdict;
    try {
      convergeVerdict = runConverge(
        { lane: lanePath, item: planned.pr, goal: `repair the failing required check on PR #${planned.pr}${planned.item ? ` (item #${planned.item})` : ''}` },
        // `repair` for the same reason `buildFixAgentEnv` stamps it (#3640): the converge EDITOR is another
        // restricted agent this wrapper spawns outside the heal agent's own turn, so it is a wrapper-owned
        // agent, never a `ci-heal` LAUNCH. `provider` threaded through (mechanical-dispatcher follow-up to
        // #3580) — see `fix-dispatch-wrapper.mjs`'s identical note; this reuses the same shared function.
        { run: runFn, ensureSettingsFile, dispatchKind: REPAIR_AGENT_KIND, provider },
      );
    } catch (e) {
      reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'blocked-on-infra', label: describeError(e) } }, { run: runFn });
      releaseAllPools(planned.sessionSlug, { run: runFn });
      throw e;
    }
    if (convergeVerdict.verdict === 'escalate') {
      const convergeReason = convergeVerdict.reason || 'the converge pass could not reach agreement on the heal';
      standDown({ pr: planned.pr, repo: planned.repo, reason: 'needs-judgment', detail: convergeReason }, { run: runFn });
      reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'escalated-needs-judgment', label: convergeReason } }, { run: runFn });
      releaseAllPools(planned.sessionSlug, { run: runFn });
      return { ...planned, lanePath, result: 'stood-down (converge-escalated)' };
    }
  }

  // `--force-with-lease`, NOT a bare `--force` and NOT a plain push: the rebase rewrote this lane's history,
  // and the lease refuses if someone else advanced the ref since the fetch above — a safety net against
  // clobbering a concurrent human `/finish`. (`fix-agent-ci-brief.md` step 6's own rule.)
  pushLaneRef({ lanePath, laneRef: target.headRefName, forceWithLease: true }, { run: runFn });
  ciHealMark({ pr: planned.pr, repo: planned.repo, reason: planned.reason }, { run: runFn });

  reportDone({ sessionSlug: planned.sessionSlug, classified: { outcome: 'ci-healed', label: rebased.status } }, { run: runFn });
  releaseAllPools(planned.sessionSlug, { run: runFn });
  if (agentReport.learning) dropLearning({ sessionSlug: planned.sessionSlug, learning: agentReport.learning }, { run: runFn });

  return { ...planned, lanePath, result: `PR #${planned.pr} (ci-healed, re-pushed — review label untouched)` };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  dispatchCiHeal({ pr: flag('pr'), repo: flag('repo'), item: flag('item'), reason: flag('reason') })
    .then((result) => writeAllSync(1, `${JSON.stringify(result, null, 2)}\n`))
    .catch((e) => {
      writeLineSync(2, `error: ${String(e?.message ?? e)}`);
      process.exitCode = 1;
    });
}
