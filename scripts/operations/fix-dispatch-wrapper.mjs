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
 * HONESTY LABEL, SAME CONVENTION `deliver-item-wrapper.mjs`/`review-dispatch-wrapper.mjs` USE — UPDATED BY
 * #3640, WHICH WIRED IT. This file is no longer unwired: a `fix` dispatch now routes
 * `dispatch-lane-io.mjs#createDispatchSinks` → `dispatch-provider-registry.mjs` (the `fix` row) →
 * `dispatch-providers/fix.mjs` → a DETACHED `we:scripts/operations/fix-run.mjs` → `dispatchFix` below, by
 * DEFAULT, with the old full-brief agent path kept reachable behind `WE_FIX_DISPATCH_MODE=agent`. What has
 * STILL not happened is the thing that actually graduates it: it has NOT been run against a real PR end to end.
 * Per `we:docs/agent/prototype-based-dev.md`'s "park until genuinely exercised" rule, that live run (a driver +
 * observer pair, against a real bounced PR) is EXPLICITLY the NEXT, SEPARATE phase, not this one. Every
 * function below is REAL — every CLI surface it shells was read directly from the live source it calls (`gh pr
 * view`, `we:scripts/conveyor/rearm-review.mjs`, `we:scripts/conveyor/stand-down.mjs`,
 * `we:scripts/operations/completion-cli.mjs`, `we:scripts/lane-pool.mjs`) — but "the code is real" and "the
 * pipeline has been proven end to end" are different claims; only the second is what graduation requires.
 *
 * ── WHAT `ci-heal` (#3642) REUSES FROM HERE, VERBATIM ───────────────────────────────────────────────────────
 *
 * `ci-heal` is the OTHER PR-keyed repair kind and its own card says the two "likely share most of a wrapper".
 * The pieces below are deliberately kind-agnostic and are meant to be imported, not copied:
 *
 * SETTLED BY #3642, which landed `we:scripts/operations/ci-heal-dispatch-wrapper.mjs` as a SEPARATE module
 * that IMPORTS this list rather than a shared core with two arms — see that file's own header for the four
 * steps that genuinely differ and why a strategy-callback core would have been the worse shape. Two
 * amendments to the handover below, both verified there against this code rather than assumed:
 *   * {@link ensureFixHooksSettingsFile} did NOT generalize — the SETTINGS object does, the WRITER does not,
 *     because it is bound to one sidecar path and this file's own §2 note forbids two concurrently
 *     dispatchable kinds sharing one. `ci-heal` writes its own file over {@link FIX_HOOKS_SETTINGS}.
 *   * {@link pushLaneRef} needed one optional flag (`forceWithLease`) rather than being reusable as-is — a
 *     `ci-heal` rebases before repairing, so its re-push is not a fast-forward. Default unchanged.
 * {@link FIX_LANE_PURPOSE}-shaped acquire via `minimal-context-provider.mjs#acquireLane`,
 * {@link FIX_HOOKS_SETTINGS}/{@link ensureFixHooksSettingsFile}, {@link buildFixAgentEnv} (whose
 * `WE_DISPATCH_KIND: 'repair'` stamp is ALREADY the shared value — see its docblock),
 * {@link runFixGateWithOneRetry}, {@link pushLaneRef}, {@link standDown}, and the `runConverge` call shape with
 * `dispatchKind: REPAIR_AGENT_KIND`. What `ci-heal` must supply ITSELF: its own finding resolver (a CI failure
 * is read from `gh pr checks`/run logs, not from a changes-requested COMMENT — so
 * {@link findLatestChangesRequestedComment}/{@link resolveFixTarget} do NOT carry over), its own brief, and its
 * own hand-back step (a healed CI run is not a `rearm-review`).
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
 * THAT GAP IS NOW CLOSED (#3640), AND THE WAY IT WAS CLOSED IS THE INTERESTING PART. The note that used to sit
 * here said `we:scripts/guard-bash.mjs`'s wrapper-owned deny table checked the LITERAL string `'delivery'`, not
 * `'fix'`, so the hook enforced nothing extra on a fix-dispatched agent, and called a matching `'fix'` arm
 * "real, valuable follow-up work". Writing that arm would have been a BUG, not a follow-up: `WE_DISPATCH_KIND
 * =fix` is ALSO what `dispatch-lane-io.mjs#defaultClaudeProvider` stamps on the full-brief fix agent, whose own
 * brief (`we:skills-src/conveyor/fix-agent-brief.md`) requires `lane-pool.mjs acquire`, `gh pr view` and
 * `verify-lane` of the agent ITSELF — a `'fix'` arm would deny that agent its own step 1. `guard-bash.mjs`'s
 * own note had spotted the same collision from the other side and refused to write the arm until it was
 * resolved.
 *
 * THE RESOLUTION, and the reason nothing here needed a second env var: `WE_DISPATCH_KIND`'s value space ALREADY
 * had two halves and the delivery wrapper had already used them — it stamps `delivery` (not a launch kind), not
 * `build`. So a wrapper-spawned restricted agent is stamped with a WRAPPER-AGENT kind and this wrapper now
 * stamps `repair` (see `buildFixAgentEnv`), covering `ci-heal` as well. The guard table keys on that half only,
 * every deny in it is now true of this wrapper command-for-command, and the agent path is untouched.
 * `we:scripts/operations/dispatch-lane.mjs#assertDispatchKindAxesDisjoint` makes the split machine-checked.
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
import {
  runConverge, DELIVERY_AGENT_SPAWN_TIMEOUT_MS, DELIVERY_AGENT_PROVIDER_NAMES,
  DEFAULT_DELIVERY_AGENT_PROVIDER_NAME,
} from './deliver-item-wrapper.mjs';
// #3383 — delivery telemetry; see `telemetry-store.mjs`. Never throws, never alters control flow.
import { activeRecorder, recorderFor, setActiveRecorder, spanAroundAsync } from './telemetry-store.mjs';
import { defaultSpawnAgent } from './dispatch-lane-io.mjs';
import { REPAIR_AGENT_KIND } from './dispatch-lane.mjs';
import { tryReadFixReport, resolveFixReportsDir, deleteFixReport } from './fix-report-store.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';
// mechanical-dispatcher (epic #3383, Part 1) — the REAL Codex spawn primitives, REUSED verbatim from the
// `build` kind's own provider (`deliver-item-wrapper.mjs#CODEX_PROVIDER`) rather than re-derived: every one of
// these is already live-verified against `codex exec` (see that file's own header for the evidence trail), and
// none of it is delivery-specific — only the ENV a spawned agent gets and the reports dir it reads back from
// are, which `FIX_CODEX_PROVIDER` below supplies via `buildFixAgentEnv`/`resolveFixReportsDir`, unchanged.
import {
  buildCodexDeliveryArgv, defaultSpawnCodexAgent, parseCodexThreadId, readCodexThreadId, writeCodexThreadId,
  defaultDeliveryDenyPaths, assertDenyPathsUsable,
} from './codex-delivery-provider.mjs';

/**
 * ABSOLUTE path to THIS CHECKOUT's own `fix-report-cli.mjs` (bug #xu2pp2m/1, confirmed live on real PR #2027,
 * 2026-09-09). `dispatchFix` resets the spawned agent's `$LANE`/cwd to the TARGET PR's own `headRefName` (via
 * `acquireLane`'s `base` — correct, that's how it edits the right code), but that ref is based on ordinary
 * `main`, which — PRE-MERGE of this very branch — does not yet contain `fix-report-cli.mjs`/
 * `fix-report-store.mjs`/`fix-report-record.mjs` at all: they exist ONLY on this unmerged
 * `lane/xu2pp2m-review-dispatch-wrapper` branch. `we:skills-src/conveyor/fix-agent-brief-v2.md` told the
 * dispatched agent to invoke `node scripts/operations/fix-report-cli.mjs` relative to `$LANE` — a path that is
 * structurally ABSENT from the target PR's own lane clone until this branch merges. One real live attempt got
 * lucky finding it via a fragile absolute-path workaround it invented on the spot; a second attempt correctly
 * concluded the file was genuinely missing and gave up on reporting at all, which is exactly the false-negative
 * `runFixAgentToCompletion`'s `!report` branch below then reports as a crash.
 *
 * THE FIX: same class of problem `we:scripts/operations/deliver-item-wrapper.mjs` already solved for
 * `OPERATION_DELIVERY_REPORTS_DIR` (bug 9, live #3371 attempt 4) — resolve the real, absolute path ONCE in the
 * WRAPPER's own process (this checkout, which — unlike the target PR's lane — DOES have every file this branch
 * added, because it IS this branch) and hand it down as a real env var (`buildFixAgentEnv`, below) rather than
 * a lane-relative path the agent has to guess at or invent a workaround for. `fix-agent-brief-v2.md` now reads
 * `$FIX_REPORT_CLI_PATH` instead of the lane-relative literal.
 */
export const FIX_REPORT_CLI_PATH = resolve(REPO_ROOT, 'scripts/operations/fix-report-cli.mjs');

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
 * `acquireLane`'s `base`) and the finding text a fixer should act on, or `null` findingBody when there is
 * nothing to repair.
 *
 * `findingOverride` (#Part-3 autofix — `we:scripts/conveyor/autofix-review-findings.mjs`) SKIPS the
 * changes-requested comment scan and uses the supplied text verbatim instead. This is what lets a caller with
 * ONE ALREADY-CLASSIFIED advisory-panel finding (never a `review:changes` bounce — a `review:human` PR's
 * advisory note is posted before any human ceremony and sets no label at all, so it never carries the
 * `CHANGES_REQUESTED_MARKERS` shape {@link findLatestChangesRequestedComment} scans for) hand this wrapper a
 * narrowly-scoped brief directly, while still fetching the real `headRefName` a lane needs to reconstitute the
 * PR's own branch. `headRefName` is ALWAYS read for real — only the finding-text source branches.
 * @param {{pr: number, repo: string, findingOverride?: (string|null)}} o
 * @param {{run?: Function}} [io]
 * @returns {{headRefName: string, findingBody: (string|null)}}
 */
export function resolveFixTarget({ pr, repo, findingOverride = null } = {}, { run: runFn = run } = {}) {
  const out = runFn('gh', ['pr', 'view', String(pr), '--json', 'headRefName,comments', '--repo', repo]);
  const parsed = JSON.parse(out);
  if (findingOverride) return { headRefName: parsed.headRefName, findingBody: findingOverride };
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
 *  `$FIX_SESSION`, `$FIX_PR`, `$FIX_ITEM`, `$FIX_REPORT_CLI_PATH`), mirroring
 *  `deliver-item-wrapper.mjs#buildDeliveryAgentEnv`'s own real-env-vars fix (#3627 bug 7) from day one rather
 *  than repeating that bug's text-footer mistake. `OPERATION_FIX_REPORTS_DIR` resolved ONCE in the WRAPPER's
 *  own process (mirrors bug 9's fix) so the spawned agent's `fix-report-cli.mjs` — running out of a SEPARATE
 *  lane clone, a different `git clone`, not a worktree — writes to the SAME directory this wrapper's own
 *  `tryReadFixReport` call reads back. `FIX_REPORT_CLI_PATH` (bug #xu2pp2m/1 — see that constant's own
 *  docblock) is the ABSOLUTE path to THIS checkout's `fix-report-cli.mjs`, handed down because the target PR's
 *  own lane clone — reset to its `headRefName`, based on ordinary `main` — does not contain that file at all
 *  pre-merge; a lane-relative invocation is structurally unreachable. */
export function buildFixAgentEnv({ sessionSlug, pr, item, lanePath, reportsDir }) {
  return {
    // `repair`, NOT `fix` (#3640 — the two-spawner collision, resolved). This stamp used to carry the LAUNCH
    // kind, which is also what `dispatch-lane-io.mjs#defaultClaudeProvider` stamps on the FULL-BRIEF fix agent
    // that runs its own lifecycle — one env value naming two incompatible contracts, and the reason
    // `we:scripts/guard-bash.mjs` could not write a `'fix'` deny arm at all (see its own note). A
    // wrapper-spawned restricted agent is stamped with a WRAPPER-AGENT kind
    // (`we:scripts/operations/dispatch-lane.mjs#WRAPPER_AGENT_KINDS`), exactly as
    // `deliver-item-wrapper.mjs#buildDeliveryAgentEnv` has always stamped `delivery` rather than `build`.
    // `repair` rather than a fix-only value because `ci-heal` (#3642) is the same wrapper shape and the guard
    // table asserts the same ownership for both.
    WE_DISPATCH_KIND: REPAIR_AGENT_KIND,
    FIX_SESSION: sessionSlug,
    FIX_PR: String(pr),
    FIX_ITEM: item ?? '',
    LANE: lanePath,
    OPERATION_FIX_REPORTS_DIR: reportsDir,
    FIX_REPORT_CLI_PATH,
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
    // #3383 mechanical-dispatcher fix — lane-aware: `resolveReportsDir()` called with no argument named the
    // primary checkout regardless of `lanePath` (see `deliver-item-wrapper.mjs`'s own comment on the same fix
    // for the full root-cause account — same bug, same shape, this wrapper's own copy of it).
    const reportsDir = resolveReportsDir(lanePath);
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
 * FIX_CODEX_PROVIDER — mechanical-dispatcher (epic #3383) Part 1: the `fix` kind's OWN Codex implementation of
 * the `DeliveryAgentProvider` port, structurally identical to `deliver-item-wrapper.mjs#CODEX_PROVIDER` (same
 * resolve-lane-path-already-done → build-argv → BLOCK → capture-failure order, same thread-id sidecar keyed by
 * `sessionSlug`) but supplying FIX's own env (`buildFixAgentEnv`, not `buildDeliveryAgentEnv`) and FIX's own
 * reports dir/failure-sidecar name, exactly as `FIX_AGENT_PROVIDER` above parallels `CLAUDE_RESTRICTED_PROVIDER`
 * for the Claude half. Every CLI-specific detail — which flags, why no `-s`, what replaces the Claude-only
 * hooks — is NOT restated here; it lives once, in `codex-delivery-provider.mjs`'s own header, and every
 * function this spawns is imported from there unchanged.
 *
 * `lanePath` arrives ALREADY RESOLVED (unlike the `build` kind's `CODEX_PROVIDER`, which takes a bare lane
 * NUMBER and resolves it itself) — `dispatchFix`/`runFixAgentToCompletion` already hand every provider a real
 * path, so this one does not call `resolveLanePath` at all.
 */
const FIX_CODEX_PROVIDER = {
  name: 'codex',
  spawn(
    { sessionId, prompt, resumeSessionId = null, lanePath, sessionSlug, pr, item } = {},
    {
      spawnAgent = defaultSpawnCodexAgent,
      persistFailure = persistSpawnFailure,
      resolveReportsDir = resolveFixReportsDir,
      readThreadId = readCodexThreadId,
      writeThreadId = writeCodexThreadId,
      denyPaths = null,
    } = {},
  ) {
    // #3383 mechanical-dispatcher fix — same lane-aware resolution as `FIX_AGENT_PROVIDER` above.
    const reportsDir = resolveReportsDir(lanePath);
    const fixEnv = buildFixAgentEnv({ sessionSlug, pr, item, lanePath, reportsDir });
    const deny = assertDenyPathsUsable(denyPaths ?? defaultDeliveryDenyPaths(), lanePath);
    // Same resume contract as `CODEX_PROVIDER`: Codex mints its own thread id, so `resumeSessionId` (the
    // CLAUDE-side UUID every provider is handed) is only the SIGNAL that this is a resume; the real id comes
    // from this provider's own sidecar map, keyed by `sessionSlug` (here, `fix-<PR>`).
    const resumeThreadId = resumeSessionId ? readThreadId(sessionSlug) : null;
    if (resumeSessionId && !resumeThreadId) {
      throw new Error(
        `fix-dispatch-wrapper: FIX_CODEX_PROVIDER cannot resume session ${sessionSlug} — no Codex thread id was `
        + 'recorded for it (the fresh spawn never reached `thread.started`, or its sidecar was removed). '
        + 'Refusing to silently start a NEW session, which would lose the repair context the resume exists to carry.',
      );
    }
    const argv = buildCodexDeliveryArgv({ prompt, cwd: lanePath, denyPaths: deny, resumeThreadId });
    let stdout;
    try {
      stdout = spawnAgent(argv, { cwd: lanePath, env: { ...process.env, ...fixEnv }, timeout: FIX_AGENT_SPAWN_TIMEOUT_MS }); // BLOCKS.
    } catch (e) {
      persistFailure('fix-spawn-failures', sessionSlug, e, { resumeSessionId });
      throw e;
    }
    if (!resumeThreadId) {
      const threadId = parseCodexThreadId(stdout);
      if (threadId) writeThreadId(sessionSlug, threadId);
    }
    void sessionId; // unused — Codex mints its own id (see above).
  },
};

/** The `fix` provider registry — same keys as `deliver-item-wrapper.mjs#DELIVERY_AGENT_PROVIDERS`
 *  (`DELIVERY_AGENT_PROVIDER_NAMES`), so an operator (or a `deliveryAgent:` item marker) who has learned the
 *  `build` kind's vocabulary needs no second one for `fix`. */
export const FIX_AGENT_PROVIDERS = Object.freeze({
  'claude-restricted': FIX_AGENT_PROVIDER,
  codex: FIX_CODEX_PROVIDER,
});

/**
 * Name → `fix` provider, refusing an unknown name by NAME — mirrors
 * `deliver-item-wrapper.mjs#resolveDeliveryAgentProvider` down to the error wording, because an operator who
 * has met one selection seam should not have to learn a second shape for this one.
 * @param {string} [name] - one of {@link DELIVERY_AGENT_PROVIDER_NAMES}.
 * @returns {object}
 */
export function resolveFixAgentProvider(name = DEFAULT_DELIVERY_AGENT_PROVIDER_NAME) {
  const provider = FIX_AGENT_PROVIDERS[String(name).trim()];
  if (provider) return provider;
  throw new Error(
    `fix-dispatch-wrapper: unknown delivery agent provider ${JSON.stringify(name)} — one of `
    + `${DELIVERY_AGENT_PROVIDER_NAMES.join('|')}`,
  );
}

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
    resolveReportsDir = resolveFixReportsDir,
  } = {},
) {
  const prompt = readBrief();
  provider.spawn({ sessionId: claudeSessionId, prompt, lanePath, sessionSlug, pr, item }); // BLOCKS.
  // #3383 mechanical-dispatcher fix — read back from the SAME lane-scoped directory the provider just used,
  // never this process's own script-location default (see `deliver-item-wrapper.mjs`'s equivalent fix).
  const report = readReport(sessionSlug, resolveReportsDir(lanePath));
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
  {
    run: runFn = run, readReport = tryReadFixReport, resolveReportsDir = resolveFixReportsDir,
  } = {},
) {
  const first = runVerifyOperation(lanePath, { run: runFn });
  if (first.outcome === 'pass') return { status: 'green', lanePath };

  resumeFixAgentWithGateFailure({
    sessionSlug, lanePath, pr, item, failureOutput: first.detail, gateOutcome: first.outcome, provider, claudeSessionId,
  });
  // #3383 mechanical-dispatcher fix — same lane-aware read-back as `runFixAgentToCompletion` above.
  const retryReport = readReport(sessionSlug, resolveReportsDir(lanePath));
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
 *  never `pr-land`) — the same shape `we:skills-src/conveyor/fix-agent-brief.md` step 6 already uses.
 *
 *  `forceWithLease` (#3642) — DEFAULT `false`, so this caller and every existing test are byte-identical. The
 *  OTHER PR-keyed repair kind needs it: `ci-heal-dispatch-wrapper.mjs` rebases the lane onto current `main`
 *  before repairing, which REWRITES the lane's history, so a plain push is rejected as non-fast-forward.
 *  `--force-with-lease` and never a bare `--force` — the lease refuses if someone else advanced the ref since
 *  the fetch, which is the safety net against clobbering a concurrent human `/finish`
 *  (`we:skills-src/conveyor/fix-agent-ci-brief.md` step 6's own rule). A `fix` never rebases, so it never
 *  passes this and never needs the lease. */
export function pushLaneRef({ lanePath, laneRef, forceWithLease = false }, { run: runFn = run } = {}) {
  const args = ['push'];
  if (forceWithLease) args.push('--force-with-lease');
  args.push('origin', `HEAD:refs/heads/${laneRef}`);
  runFn('git', args, { cwd: lanePath });
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
 * `findingOverride` (#Part-3 autofix) supplies the finding text directly instead of scanning the PR's
 * changes-requested comments — see {@link resolveFixTarget}'s own docblock. `rearmReview`'s label swap is a
 * safe no-op on a PR that never carried `review:changes` in the first place (`decideRearm`'s own INVARIANT:
 * only a `review:changes` PR is re-armed) — exactly the case a `review:human` advisory-driven auto-fix lands
 * on, so this function needs no separate hand-back branch for that caller.
 *
 * @param {{pr: number|string, repo: string, item?: (number|string|null), findingOverride?: (string|null)}} o
 * @param {DeliveryAgentProvider} [provider]
 * `ensureSettingsFile` is injectable for the same reason every other impure call in this file is (see the
 * header's own IMPURE note): it is an `mkdirSync`+`writeFileSync` into `${REPO_ROOT}.operations`, and it is the
 * one impure call on this arc a caller could not previously reach — which made the converge EDIT branch (the
 * only branch that calls it) untestable, and an untestable branch is one nothing holds. Default unchanged.
 *
 * @param {{pr: number|string, repo: string, item?: (number|string|null)}} o
 * @param {DeliveryAgentProvider} [provider]
 * @param {{newSessionId?: () => string, run?: Function, waitMs?: number, ensureSettingsFile?: Function}} [deps]
 */
export async function dispatchFix(
  { pr, repo, item, findingOverride = null } = {},
  provider = FIX_AGENT_PROVIDER,
  {
    newSessionId = randomUUID, run: runFn = run, waitMs = FIX_LOOP_ACQUIRE_WAIT_MS,
    ensureSettingsFile = ensureFixHooksSettingsFile,
  } = {},
) {
  const planned = planFixDispatchWrapper({ pr, repo, item });

  // #3383 — the root `dispatch` span for this whole fix dispatch. Keyed on the ITEM when this wrapper was
  // given one (so it joins the build's own trace for the same backlog item) and on the PR otherwise; see
  // `deriveTraceId`. Installed as the ambient recorder so the shared `acquireLane`/`runVerifyOperation`
  // helpers emit `lane.acquire`/`verify.gate` into this trace without being passed anything. Closed at the
  // `reportDone` chokepoint below, which also self-uninstalls the ambient recorder.
  const tel = recorderFor({
    kind: 'fix', item: planned.item ?? null, pr: planned.pr,
    attributes: { pr: planned.pr, repo: planned.repo, sessionSlug: planned.sessionSlug, ...(planned.item != null ? { item: String(planned.item) } : {}) },
  });
  setActiveRecorder(tel);
  tel.startRoot({ pr: planned.pr, repo: planned.repo, ...(planned.item != null ? { item: String(planned.item) } : {}) });
  const claudeSessionId = String(newSessionId());

  // Bug #xu2pp2m/2 (confirmed live on real PR #2027, 2026-09-09): `sessionSlug` is `fix-<pr>` — IDENTICAL
  // across EVERY dispatch attempt at the same PR (there is no per-attempt suffix in this grammar). A fix
  // report is keyed purely by that slug (`fix-report-store.mjs#fixReportPath`), so if a PRIOR attempt left a
  // report on disk and the CURRENT attempt's agent fails to write a fresh one (crash, or — see bug 1's fix,
  // above — an agent that could not even find the reporting CLI), `runFixAgentToCompletion`'s
  // `readReport(sessionSlug)` call below would silently read the prior attempt's stale, unrelated outcome and
  // the wrapper would act on it as if it were fresh. Confirmed exactly this way: a real wrong stand-down
  // comment landed on PR #2027 describing attempt 2 using attempt 1's actual (unrelated) outcome. Deleting any
  // pre-existing report for THIS session slug before this attempt ever spawns the agent makes a missing fresh
  // report unambiguously "no report" — the existing `!report` branch in `runFixAgentToCompletion` already
  // throws correctly for that case — never "whichever attempt happened to run last". `deleteFixReport` is a
  // no-op when nothing is there yet (a genuine first attempt), so this is safe on every call.
  deleteFixReport(planned.sessionSlug);

  // Durable trace BEFORE anything else can fail (mirrors review-dispatch-wrapper.mjs's own step-0 reasoning).
  reportStarted(planned, { run: runFn });

  let target;
  try {
    target = resolveFixTarget({ pr: planned.pr, repo: planned.repo, findingOverride }, { run: runFn });
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
    // #3383 — THE EXPENSIVE SPAN. A fixer agent turn shares the delivery agent's 60-minute ceiling
    // (`FIX_AGENT_SPAWN_TIMEOUT_MS === DELIVERY_AGENT_SPAWN_TIMEOUT_MS`) and, until now, was timed by nothing.
    // `spanAroundAsync` closes it `ok` on return and `error` on throw and rethrows the original untouched, so
    // the `catch` below — which owns the real report/release contract — runs exactly as it did before.
    agentReport = await spanAroundAsync('agent.turn', { attributes: { pr: planned.pr, item: planned.item ?? null } }, () =>
      runFixAgentToCompletion(
        { pr: planned.pr, item: planned.item, sessionSlug: planned.sessionSlug, lanePath, provider, claudeSessionId },
        { run: runFn },
      ));
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
      // `repair` for the same reason `buildFixAgentEnv` stamps it (#3640): the converge EDITOR is another
      // restricted agent this wrapper spawns outside the fixer's own turn, so it is a wrapper-owned agent, not
      // a `fix` LAUNCH. Passing the launch kind here would put the editor under a guard contract written for
      // an agent that runs its own lifecycle. `provider` threaded through (mechanical-dispatcher follow-up to
      // #3580) — was resolved above for `runFixGateWithOneRetry` and silently never reached the converge round;
      // see `deliver-item-wrapper.mjs#runConvergeEdit`'s docblock for why this is visibility only, not a real
      // Codex converge editor.
      { run: runFn, ensureSettingsFile, dispatchKind: REPAIR_AGENT_KIND, provider },
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
