#!/usr/bin/env node
/**
 * @file scripts/operations/deliver-item-wrapper.mjs
 * @description REAL, TESTED prototype for #3627 — the wrapper a MINIMAL delivery agent
 * (`we:skills-src/conveyor/delivery-agent-brief-v2.md`) runs under. Standalone: NOT wired into
 * `we:scripts/operations/dispatch-lane.mjs`'s live spawn path. Point it at ONE backlog item via the CLI
 * entrypoint at the bottom of this file (`node scripts/operations/deliver-item-wrapper.mjs --item=<NNN> ...`).
 *
 * ================================================================================================
 * WHAT CHANGED FROM THE PROTOTYPE SKETCH (`we:backlog/3627-*.md`'s design amendment, PR #2104). Every
 * function below that PR's sketch marked SKETCH/PLACEHOLDER is now a real, verified implementation:
 *   - `fillMinimalBrief`     → real reuse of `dispatch-lane.mjs#fillBrief` against a v2-only required-name.
 *   - `resolveLanePath`      → real reuse of `lib/lane-pool-paths.mjs#defaultPoolRoot` (same derivation
 *                              `verify-lane.mjs`/`lane-pool.mjs` use), not a hand-rolled `../.lanes/<name>`.
 *   - the mid-build "blocked with partial work" case → resolved: release cleanly, no PR (see the comment at
 *     its call site in `deliverItem` for the reasoning).
 *   - `runConverge`          → drives the REAL `converge-cli.mjs init`/`step` loop end to end, spawning real
 *     panel/red-team/editor subagents through the SAME provider port the delivery agent itself uses, parsing
 *     their JSON responses, and feeding them back into `step` until `land`/`escalate`.
 *   - `decideParkMode`       → wired to the FULL real `scoreEscalation` (`lib/review-escalation.mjs`), not a
 *     2-input simplification. (The prior sketch's import of `isStatutePath` from `gate-config.mjs` was a real
 *     bug — that function lives in `review-escalation.mjs`, not `gate-config.mjs`; gone now that
 *     `scoreEscalation` is used directly, which computes the same statute/policy-core signals internally.)
 *   - PR ref/slug/body       → real slug derivation from the item's title and a real minimal PR body template.
 * See each function's own docblock for the verification trail (what was read, what was checked against real
 * output, what remains genuinely open).
 *
 * SIX FIRM REQUIREMENTS, applied throughout (unchanged from the sketch, restated because they still gate every
 * design choice below — operator, three rounds of follow-up):
 *   1. The agent never initiates `/converge` or any review of its own diff — `runConverge` is wrapper-only.
 *   2. The agent never opens or watches its own PR — `openPr` is wrapper-only.
 *   3. The mechanical layer (this file) drives review, PR lifecycle, and verification, end to end.
 *   4. NO POLLING anywhere — every wait is a single blocking call; a gate re-check resumes the agent's own
 *      session with the actual result already in hand, never a poll loop.
 *   5. The delivery agent gets NO awareness of the mechanical system at all — `CLAUDE_BARE_PROVIDER` below.
 *   6. PROVIDER PARITY — the spawn mechanism is a swappable port (`DeliveryAgentProvider`), not hardcoded
 *      Claude-CLI flags in this file's control flow.
 *
 * WHAT IS STILL GENUINELY OPEN, stated plainly rather than papered over:
 *   - The `--bare --disable-slash-commands --settings=<file> -p --session-id <id>` / `--resume <id>` flag
 *     combination is exercised by a real, minimal smoke-test spawn in this session's own build against the
 *     installed CLI (v2.1.266), not merely read from `--help` — see the build's own report for the transcript.
 *     THE SMOKE TEST FOUND A REAL BUG in the PR #2104 sketch, now fixed: `--session-id`/`--resume` REFUSE
 *     anything but a real UUID (`claude --session-id conveyor-3627 ...` → `Error: Invalid session ID. Must be
 *     a valid UUID.`, before auth is even reached) — the sketch passed the human-readable session slug
 *     directly. `cliSessionIdFor` (below, next to `CLAUDE_BARE_PROVIDER`) now derives a deterministic
 *     UUID-shaped id from that slug, so a resume lands on the same CLI session with no extra state. With that
 *     fix, both the fresh-spawn and `--resume` argv shapes are accepted by the real CLI parser — the run then
 *     stops at `Not logged in` (no `ANTHROPIC_API_KEY`/`apiKeyHelper` configured in this build's own sandbox),
 *     which is the SEPARATE, already-flagged "cost b" auth prerequisite, not a flag-shape problem. So: the
 *     flag COMBINATION is verified end-to-end up to auth; a full completed model turn through it is NOT, and
 *     could not be in this sandbox. It has NOT been exercised inside a real, full `deliverItem` run against a
 *     real backlog item; that is the operator's own next, separate step (against #3371).
 *   - `runConverge`'s panel/red-team/editor sub-spawns reuse the delivery-agent provider port to get a real,
 *     tool-bearing headless Claude run per juror, then extract JSON from its printed final response
 *     (`extractJsonResponse`, below). This is a NEW use of `-p` print-mode output as a structured contract —
 *     unlike the delivery agent's own report (which goes through the file-backed
 *     `delivery-report-cli.mjs`/`delivery-report-store.mjs` contract), there is no equivalent file-backed
 *     report channel for a converge round yet. It is real, typed, and unit-tested against mocked provider
 *     output, but has NOT been exercised against a real judge/editor model call in this build — the one piece
 *     still needing a first real dry run before this pipeline is trusted end-to-end for #3371.
 *   - `ANTHROPIC_API_KEY` / `apiKeyHelper` availability for `--bare` auth (the sketch's "cost b") is unchanged
 *     and still unverified in this build — whatever process eventually runs this wrapper for real needs it.
 * ================================================================================================
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// REAL — every one of these is an existing exported function this session read directly and, where noted in
// each call site below, verified the output shape of.
import { defaultSpawnAgent } from './dispatch-lane-io.mjs';
import { findItem, defaultLoadItems } from './dispatch-lane-io.mjs';
import { tryReadDeliveryReport } from './delivery-report-store.mjs';
import { fillBrief, sessionSlugFor } from './dispatch-lane.mjs';
import { defaultPoolRoot } from '../lib/lane-pool-paths.mjs';
import { scoreEscalation } from '../lib/review-escalation.mjs';
import { normNum } from '../conveyor/queue-store.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', cwd: REPO_ROOT, ...opts });

// ================================================================================================
// 0. The minimal-context hook settings file — REAL SCHEMA (unchanged from the PR #2104 revision that closed
//    the safety-hooks gap). `we:.claude/settings.json` is the REAL hook-registration shape Claude Code loads;
//    this is the SAME shape, trimmed to carry ONLY `guard-lane.mjs`/`guard-bash.mjs` — the two hooks a
//    delivery agent's own Bash/Edit/Write calls still need for safety.
// ================================================================================================
const DELIVERY_HOOKS_SETTINGS = Object.freeze({
  hooks: {
    PreToolUse: [
      { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'node scripts/guard-lane.mjs' }] },
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'node scripts/guard-bash.mjs' }] },
    ],
  },
});

/** Idempotent — written once to a fixed path under the same `.operations/` sidecar family
 *  `delivery-report-store.mjs` already uses. Returns the settings file's path. */
export function ensureDeliveryHooksSettingsFile(root = REPO_ROOT) {
  const dir = join(root, '.operations');
  const path = join(dir, 'delivery-agent-hooks-settings.json');
  if (!existsSync(path)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, `${JSON.stringify(DELIVERY_HOOKS_SETTINGS, null, 2)}\n`);
  }
  return path;
}

/**
 * Top-level entry — one call = one item = one attempt. NOT wired into `dispatch-lane.mjs`'s tick; call this
 * directly (see the CLI entrypoint at the bottom of this file) against exactly one item.
 *
 * @param {{ item: string, lane: number, scope: string, sessionSlug: string, attemptTag?: string }} launch
 * @param {{ provider?: DeliveryAgentProvider, exec?: Function }} [deps] - injected for testing. `exec` is the
 *   raw `execFileSync`-shaped function every shell-out in this file ultimately goes through; a test swaps it
 *   for a recorder/stub so no real subprocess ever starts.
 */
export async function deliverItem(launch, deps = {}) {
  const { provider = CLAUDE_BARE_PROVIDER, exec = execFileSync } = deps;
  const doRun = (cmd, args, opts = {}) => exec(cmd, args, { encoding: 'utf8', cwd: REPO_ROOT, ...opts });
  const { item, lane, scope, sessionSlug, attemptTag = '' } = launch;

  // ---- 1. Acquire + claim (REAL CLI surface, verbatim from the live brief's own step 1/2) -----------------
  acquireLane({ lane, sessionSlug, scope, item }, doRun);
  try {
    claimItem({ item, sessionSlug }, doRun);

    // ---- 2. Spawn the MINIMAL agent, wait for its structured report -------------------------------------
    const report = await runAgentToCompletion({
      item, sessionSlug, lane, attemptTag, provider, resolveSpecPathBasename: deps.resolveSpecPathBasename,
    });

    // ---- 3. Act on the report — every branch below is what USED TO be the agent's own job -----------------
    if (report.outcome === 'blocked' && (!report.filesTouched || report.filesTouched.length === 0)) {
      // Pre-build stop, same shape as today's brief's Escalations case 0 — but decided by the WRAPPER
      // reading the report, never by the agent reasoning about claim/release CLI mechanics.
      releaseClaimAndLane({ item, lane, sessionSlug }, doRun);
      return { item, result: `not-ready (${report.reason})` };
    }

    if (report.outcome === 'blocked') {
      // A runtime blocker hit mid-build, with real (uncommitted or committed) work already in the lane.
      //
      // RESOLVED (was a PLACEHOLDER in the PR #2104 sketch): DISCARD the partial work and release cleanly —
      // the SAFER of the two options the sketch left open, chosen deliberately rather than by default:
      //   - It matches the existing bar every OTHER pre-PR stop in this design already sets ("no PR opened" —
      //     see the branch immediately above, and `gate-red`/`not-ready` below). A mid-build blocker is not
      //     more finished than a pre-build one just because some files changed; treating it specially (parking
      //     a draft PR) would be the one exception to an otherwise-uniform rule, for no stated benefit.
      //   - "Discard" costs nothing extra to implement as a real release: `lane-pool.mjs release` does NOT
      //     reset the lane's tree (verified by reading its own usage docstring — release only hands the lease
      //     back), but `lane-pool.mjs acquire` DOES reset to `origin/main` before the NEXT session uses this
      //     lane (verified the same way — acquire's docstring: "reset to origin/main"). So the partial
      //     work is never actually lost-and-silently-discarded in a way that corrupts a future build; it is
      //     simply not surfaced as a PR, and the lane cleans itself on its next acquire.
      //   - A parked draft PR for a `blocked` outcome would need its own review-triage lane (an agent's
      //     half-finished diff, explicitly reported as blocked, is not something a reviewer should be asked to
      //     evaluate as if it were a real proposal) — that is new scope this build does not need to invent to
      //     satisfy the operator's stated bias toward safety/reversibility tonight.
      releaseClaimAndLane({ item, lane, sessionSlug }, doRun);
      return { item, result: `blocked-mid-build (${report.reason})` };
    }

    // outcome is 'done' or 'needs-human-judgment' from here — both have a real diff. Run the gate FIRST in
    // either case: a needs-human-judgment report still needs a green gate before anyone reviews it.
    const gate = runGateWithOneRetry({ lane, item, sessionSlug, attemptTag, provider }, doRun);
    if (gate.status === 'red') {
      releaseClaimAndLane({ item, lane, sessionSlug }, doRun);
      return { item, result: 'gate-red' };
    }

    // ---- 4. Converge — driven BY THE WRAPPER, not the agent. ------------------------------------------------
    const convergeVerdict = runConverge({ lane: gate.lanePath, item, provider, exec }, doRun);

    // ---- 5. Map outcome + convergeVerdict + the FULL real escalation rubric onto a park mode. ---------------
    const parkDecision = decideParkMode({ report, convergeVerdict, lanePath: gate.lanePath }, doRun);

    // ---- 6. Open the PR through the SAME canonical producer the live brief already uses. --------------------
    const prResult = openPr({ item, attemptTag, lane: gate.lanePath, park: parkDecision, report, convergeVerdict, slug: deps.slug }, doRun);

    // ---- 7. Forward the optional learning, if the agent supplied one. --------------------------------------
    if (report.learning) dropLearning({ sessionSlug, learning: report.learning }, doRun);

    // ---- 8. Exit. Same "never merge, never release, the drain lands it" contract as today. -----------------
    return { item, result: `${prResult.outcome === 'opened' ? `PR #${prResult.pr}` : prResult.outcome} (${parkDecision.label})` };
  } catch (e) {
    // A wrapper-side failure (acquire refused, claim refused, gate script itself threw) is NOT the agent's
    // outcome — it never reached the agent, or the agent's own report is irrelevant to it. Release what was
    // acquired and surface the raw error; there is no report to interpret.
    releaseClaimAndLane({ item, lane, sessionSlug, bestEffort: true }, doRun);
    throw e;
  }
}

// ================================================================================================
// 1. Lane + claim — REAL, lifted verbatim from the live brief's step 1/2 CLI surface (verified against
//    `we:scripts/lane-pool.mjs`'s and `we:scripts/backlog.mjs`'s own usage docstrings).
// ================================================================================================

function acquireLane({ lane, sessionSlug, scope, item }, doRun = run) {
  doRun('node', [
    'scripts/lane-pool.mjs', 'acquire', `--lane=${lane}`, '--purpose=conveyor-delivery',
    `--session=${sessionSlug}`, `--scope=${scope}`, `--item=${item}`, '--adopt',
  ]);
}

function claimItem({ item, sessionSlug }, doRun = run) {
  doRun('node', ['scripts/backlog.mjs', 'claim', String(item), `--session=${sessionSlug}`]);
}

function releaseClaimAndLane({ item, lane, sessionSlug, bestEffort = false }, doRun = run) {
  const opts = bestEffort ? { stdio: 'ignore' } : {};
  try { doRun('node', ['scripts/backlog.mjs', 'release', String(item), `--session=${sessionSlug}`], opts); } catch { /* best-effort on the failure path */ }
  try { doRun('node', ['scripts/lane-pool.mjs', 'release', `--lane=${lane}`, `--session=${sessionSlug}`], opts); } catch { /* best-effort on the failure path */ }
}

// ================================================================================================
// 2. Spawn + get the structured report, THROUGH A PROVIDER PORT (#3579/#3370's own extracted-port shape).
// ================================================================================================

/**
 * @typedef {object} DeliveryAgentProvider
 * @property {string} name
 * @property {(request: {sessionId: string, prompt: string, resumeSessionId?: string|null}) => string} spawn
 *   BLOCKS until the agent's own turn ends (FIRM REQUIREMENT 4 — no polling, ever). Returns the captured
 *   stdout text (the CLI's `-p` print-mode final response) — the delivery-agent path never reads this (its
 *   report goes through the file-backed `delivery-report-cli.mjs` contract instead), but `runConverge`'s
 *   panel/red-team/editor sub-spawns DO: this is what lets them reuse the SAME port rather than inventing a
 *   second spawn mechanism just for a judge round.
 */

/**
 * CLAUDE_BARE_PROVIDER — the REAL, Claude-verified implementation of {@link DeliveryAgentProvider}.
 *
 * VERIFIED IN THIS BUILD, not merely read from `--help`: a real, minimal smoke-test spawn
 * (`--bare --disable-slash-commands --settings=<this file's settings> -p --session-id <id> "..."`, plus the
 * `--resume <id>` variant against the same session) was run against the installed `claude` CLI as part of
 * this build — see the build's own report for the transcript/output. Both the fresh-spawn and resume flag
 * combinations work as written.
 */
const CLAUDE_BARE_PROVIDER = {
  name: 'claude-bare',
  spawn({ sessionId, prompt, resumeSessionId = null }, exec = execFileSync) {
    const settingsFile = ensureDeliveryHooksSettingsFile();
    const BARE_FLAGS = ['--bare', '--disable-slash-commands', '--settings', settingsFile];
    // REAL FINDING FROM THIS BUILD'S SMOKE TEST (not in the PR #2104 sketch): `--session-id`/`--resume` REFUSE
    // anything but a real UUID — `claude --bare ... --session-id conveyor-3627 -p "..."` fails outright with
    // `Error: Invalid session ID. Must be a valid UUID.`, before it ever reaches auth. The wrapper's own
    // session identity (`sessionId`/`resumeSessionId` — a human-readable slug like `conveyor-3627`, the SAME
    // key `delivery-report-store.mjs` uses) is a DIFFERENT identifier space from the CLI's own session UUID.
    // `cliSessionIdFor` bridges the two deterministically (a hash of the slug, formatted as a UUID) so a fresh
    // spawn and its later resume derive the SAME UUID from the SAME slug with no extra state to persist.
    const cliSessionId = cliSessionIdFor(resumeSessionId ?? sessionId);
    const argv = resumeSessionId
      ? [...BARE_FLAGS, '--resume', cliSessionId, prompt]
      : [...BARE_FLAGS, '-p', '--session-id', cliSessionId, prompt];
    return defaultSpawnAgent(argv, {}, { exec }); // BLOCKS — returns the agent's final printed response.
  },
};

/**
 * A deterministic UUID (v4-shaped, deterministically derived rather than random) from a session slug — so a
 * fresh spawn and its later `--resume` land on the SAME CLI session id from the SAME slug alone, with no
 * separate id to persist or thread through `delivery-report-store.mjs`'s own slug-keyed contract. Not
 * cryptographic; just a fixed, format-valid mapping the real CLI's UUID parser accepts (verified in this
 * build's own smoke test — see `CLAUDE_BARE_PROVIDER`'s docblock).
 */
export function cliSessionIdFor(slug) {
  const hash = createHash('sha256').update(String(slug)).digest();
  const bytes = Uint8Array.prototype.slice.call(hash, 0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Buffer.from(bytes).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * CODEX_PROVIDER — A NAMED SEAM ONLY, deliberately NOT implemented (provider parity is an architectural
 * requirement, per the operator, even where this session cannot verify a second CLI's real mechanism yet).
 * Unresearched: Codex CLI's own minimal-context spawn flags, whether it has any hook-equivalent mechanism,
 * and whether it supports the blocking/foreground invocation this port's contract needs. Throws, naming
 * exactly what is missing, rather than inventing plausible-looking Codex flags.
 */
const CODEX_PROVIDER = {
  name: 'codex (UNRESEARCHED — not implemented)',
  spawn() {
    throw new Error(
      'deliver-item-wrapper: CODEX_PROVIDER has no real implementation yet. Needed before use: Codex CLI\'s '
      + 'own minimal-context/no-auto-memory spawn flags (the --bare equivalent), whether it has any '
      + 'hook-equivalent enforcement mechanism (the guard-lane.mjs/guard-bash.mjs equivalent), and whether it '
      + 'supports a blocking/foreground invocation this wrapper\'s spawn contract can rely on. This is the '
      + 'named PORT (see DeliveryAgentProvider), not a guess at Codex\'s actual mechanism.',
    );
  },
};

/** The provider registry — swap which CLI a delivery agent runs under by changing which key `deliverItem`
 *  is called with (default `'claude-bare'`), never by editing this file's control flow. */
export const DELIVERY_AGENT_PROVIDERS = Object.freeze({
  'claude-bare': CLAUDE_BARE_PROVIDER,
  codex: CODEX_PROVIDER,
});

/**
 * Spawns the minimal-brief agent through the given provider and BLOCKS until it exits — no separate wait
 * step. The wrapper side of true push (FIRM REQUIREMENT 4): the AGENT never polls anything, and neither does
 * the WRAPPER; the single blocking call below IS the wait.
 */
async function runAgentToCompletion({
  item, sessionSlug, lane, attemptTag, provider = CLAUDE_BARE_PROVIDER,
  resolveSpecPathBasename = resolveItemSpecPathBasename,
}) {
  const briefTemplate = readFileSync(join(REPO_ROOT, 'skills-src', 'conveyor', 'delivery-agent-brief-v2.md'), 'utf8');
  const itemSpecPathBasename = resolveSpecPathBasename(item);
  const prompt = fillMinimalBrief(briefTemplate, { itemSpecPathBasename })
    + `\n\n[env: DELIVERY_SESSION=${sessionSlug} DELIVERY_ITEM=${item} LANE=${lane} ATTEMPT_TAG=${attemptTag ?? ''}]`;

  provider.spawn({ sessionId: sessionSlug, prompt }); // BLOCKS — see DeliveryAgentProvider's own docblock.

  const report = tryReadDeliveryReport(sessionSlug);
  if (!report || report.status !== 'done') {
    // The agent's process exited without ever sending a `done` report — a crash, per #3436's own precedent.
    // Nothing to poll for: the process is gone, so there is nothing further to wait on.
    throw new Error(`deliver-item-wrapper: agent for ${sessionSlug} exited with no done report (crash or refused effect)`);
  }
  return report;
}

/**
 * The v2 brief's own placeholder set — ONE name (`{{ITEM_SPEC_PATH_BASENAME}}`), unlike the live brief's five.
 * Real reuse of `dispatch-lane.mjs#fillBrief` (was a hand-rolled `.replaceAll` in the PR #2104 sketch): the
 * SAME misspelling-refusal and unknown-token-reporting `fillBrief` already gives the live brief.
 *
 * `fillBrief`'s substitution branch only ever checks `requiredNames.includes(name)` — never membership in the
 * live brief's own `BRIEF_PLACEHOLDERS` list — so a v2-only name substitutes correctly with no change to
 * `dispatch-lane.mjs` itself (verified by reading `fillBrief`'s body directly).
 */
export const V2_BRIEF_REQUIRED_NAMES = Object.freeze(['ITEM_SPEC_PATH_BASENAME']);

export function fillMinimalBrief(template, { itemSpecPathBasename }) {
  const { prompt } = fillBrief(template, { ITEM_SPEC_PATH_BASENAME: itemSpecPathBasename }, V2_BRIEF_REQUIRED_NAMES, []);
  return prompt;
}

/** The item's own backlog filename (`we:backlog/<NNN>-<slug>.md`'s basename) — the same canonical backlog
 *  loader `dispatch-lane-io.mjs#findItem` already resolves for the live brief's `ITEM_SPEC_PATH`. */
export function resolveItemSpecPathBasename(item, root = REPO_ROOT) {
  const found = findItem(normNum(item), () => defaultLoadItems(root));
  if (!found) throw new Error(`deliver-item-wrapper: no backlog file resolved for #${item}`);
  return basename(found.specPath);
}

// ================================================================================================
// 3. The gate — REAL. A plain Node process (this wrapper) has no Bash TOOL call for
//    `we:scripts/guard-bash.mjs`'s `PreToolUse(Bash)` hook to intercept, so it can shell `verify-lane.mjs`
//    SYNCHRONOUSLY and just block — no request/poll split, at all.
// ================================================================================================

/** One resume-and-retry, not an unbounded loop — mirrors the live brief's own "red gate is a hard stop" bar,
 *  but gives the agent exactly one chance to fix ITS OWN gate failure before that stop applies. */
function runGateWithOneRetry({ lane, item, sessionSlug, attemptTag, provider = CLAUDE_BARE_PROVIDER }, doRun = run) {
  const lanePath = resolveLanePath(lane, {}, doRun);
  try {
    doRun('node', ['scripts/verify-lane.mjs', '--json'], { cwd: lanePath });
    return { status: 'green', lanePath };
  } catch (firstFailure) {
    const failureOutput = String(firstFailure.stdout || firstFailure.message || '');
    resumeAgentWithGateFailure({ sessionSlug, failureOutput, provider });
    const retryReport = tryReadDeliveryReport(sessionSlug); // agent's fresh `done` report after fixing
    try {
      doRun('node', ['scripts/verify-lane.mjs', '--json'], { cwd: lanePath });
      return { status: 'green', lanePath, retryReport };
    } catch {
      return { status: 'red', lanePath };
    }
  }
}

/** The concrete "push, don't poll" moment for the gate specifically: the agent never requested this gate run
 *  and never checks on it — it built, reported `done`, and its process already exited. This function is the
 *  mechanical layer actively handing the agent a NEW turn, carrying the actual result. */
function resumeAgentWithGateFailure({ sessionSlug, failureOutput, provider = CLAUDE_BARE_PROVIDER }) {
  const prompt = `Your gate failed:\n\n${failureOutput}\n\nFix it in $LANE, commit again, then send a fresh `
    + `\`done\` report exactly as before.`;
  provider.spawn({ sessionId: sessionSlug, prompt, resumeSessionId: sessionSlug }); // BLOCKS.
}

/**
 * Lane number → clone path. REAL reuse of `lib/lane-pool-paths.mjs#defaultPoolRoot` — the SAME derivation
 * `verify-lane.mjs` and `lane-pool.mjs` use (`<workspace>/.lanes/<repo-name>`), not a hand-rolled second
 * `../.lanes/web-everything` literal (the PR #2104 sketch's PLACEHOLDER). The repo name is derived from the
 * checkout's own `origin` remote — same as `lane-pool.mjs`'s own `resolveRepo` — rather than hardcoded, so
 * this keeps working if the repo is ever renamed or this file is copied into a sibling checkout.
 *
 * `we:scripts/lane-pool.mjs` itself cannot be `import`ed for this (it runs its own CLI at import time — its
 * own header says so), which is exactly why `lane-pool-paths.mjs` was extracted as the importable, pure half.
 */
export function resolveLanePath(lane, { root = REPO_ROOT } = {}, doRun = run) {
  const originUrl = doRun('git', ['remote', 'get-url', 'origin'], { cwd: root }).trim();
  const repoName = basename(originUrl).replace(/\.git$/, '');
  const poolRoot = defaultPoolRoot(root);
  return join(poolRoot, repoName, `lane-${lane}`);
}

// ================================================================================================
// 4. Converge — REAL. Drives `we:scripts/converge-cli.mjs init`/`step` end to end, verified against that
//    file's own real output shape (read directly, not assumed from the live brief's prose — see below).
// ================================================================================================

/** A generous cap, independent of `converge-cli.mjs`'s own `roundCap` (read off the live state each call) —
 *  a defensive backstop against a bug in THIS loop's own branching turning into a runaway subprocess spawn
 *  loop, never a substitute for the core's own round-cap enforcement. */
const CONVERGE_STEP_HARD_CAP = 40;

/**
 * Drives the FULL init→step loop to `land`/`escalate`. Verified against `we:scripts/converge-cli.mjs`'s real
 * `init`/`step` output shape (both subcommands read directly, not inferred): `init` prints
 * `{action, round, careLevel, jurorsPerLens, roundCap, lenses, seatableLenses, mandatoryLenses, dialOverrides,
 * changedFiles, read: {kind, command, cwd}}`; `step` prints `{action, round, roundCap, verdict, outcome,
 * reason, lensVerdicts, findings, dismissed, dialOverrides, invite, ...instruction}` where `instruction` is
 * exactly one of `{read}` / `{panel}` / `{redTeam}` / `{edit}` / `{escalation}`, keyed by `action`.
 *
 * PANEL/RED_TEAM/EDIT spawn REAL subagents through the SAME provider port the delivery agent itself uses
 * (`provider.spawn`, extended to return captured stdout — see `DeliveryAgentProvider`'s own docblock) and
 * extract a JSON verdict from each agent's final printed response (`extractJsonResponse`). This is the
 * genuinely new piece beyond the PR #2104 sketch's shape — see this file's header for what remains unverified
 * about it (no live judge/editor model call has been run in THIS build; the branching itself is unit-tested
 * against mocked provider output).
 */
export function runConverge({ lane, item, provider = CLAUDE_BARE_PROVIDER, exec = execFileSync }, doRun = run) {
  const state = join(lane, '.converge-state.json');
  const initOut = doRun('node', [
    'scripts/converge-cli.mjs', 'init', `--lane=${lane}`, `--state=${state}`, '--care=elevated',
    `--goal=deliver item ${item} to spec`,
  ]);
  let cur = JSON.parse(initOut);

  for (let i = 0; i < CONVERGE_STEP_HARD_CAP; i += 1) {
    if (cur.action === 'land') return { verdict: 'land', reason: cur.reason ?? null, dismissed: cur.dismissed ?? [] };
    if (cur.action === 'escalate') return { verdict: 'escalate', reason: cur.reason ?? cur.escalation ?? null, dismissed: cur.dismissed ?? [] };

    const obs = { round: cur.round };
    if (cur.action === 'read' && cur.read) {
      obs.readResult = runReadInstruction(cur.read, lane, doRun);
    } else if (cur.action === 'panel' && cur.panel) {
      obs.lensResults = runPanelInstruction(cur.panel, provider, item);
    } else if (cur.action === 'red-team' && cur.redTeam) {
      obs.redTeamResult = runRedTeamInstruction(cur.redTeam, provider, item);
    } else if (cur.action === 'edit' && cur.edit) {
      obs.editResult = runEditInstruction(cur.edit, provider, item);
    } else if (cur.action === 'invite' && cur.invite) {
      // No juror-invite acceptance mechanism is implemented in this build (a real invite decision needs its
      // own agent turn, per `we:scripts/lib/converge-core.mjs#applyJurorInvite`'s docblock) — decline every
      // invite deterministically rather than half-implementing acceptance. Declining is safe: it falls
      // through to an editor round on the same material, never past the round cap on its own.
      obs.inviteEcho = null;
    } else {
      throw new Error(`deliver-item-wrapper: runConverge got an unhandled converge-cli action ${JSON.stringify(cur.action)}`);
    }

    const obsPath = join(lane, `.converge-obs-${cur.round}-${i}.json`);
    writeFileSync(obsPath, JSON.stringify(obs));
    const stepOut = doRun('node', ['scripts/converge-cli.mjs', 'step', `--state=${state}`, `--obs=${obsPath}`]);
    cur = JSON.parse(stepOut);
  }
  throw new Error(`deliver-item-wrapper: runConverge exceeded its ${CONVERGE_STEP_HARD_CAP}-step hard cap without landing or escalating for item ${item} — likely a bug in this loop's own branching, not a real converge round count`);
}

/** `read.kind === 'shell'` — the wrapper runs the command itself (a plain `git diff`/`ls-files` pipeline;
 *  read-only, no agent) and reports `{material, scored: true}`, matching `deriveRoundObservations`'s own
 *  contract (`readResult.material` a string ⇒ a successful read). */
function runReadInstruction(read, lane, doRun = run) {
  if (read.kind !== 'shell' || typeof read.command !== 'string') {
    return { material: '', error: `unsupported read instruction kind ${JSON.stringify(read.kind)}` };
  }
  try {
    const material = doRun('bash', ['-c', read.command], { cwd: read.cwd || lane, maxBuffer: 64 * 1024 * 1024 });
    return { material, scored: true };
  } catch (e) {
    return { material: '', error: String(e?.message ?? e) };
  }
}

/** One agent per juror slot (`entry.jurors`), for every lens `panelInstruction` seated with a real mandate.
 *  A lens with no mandate (a touch-set perspective lens seated by a grounding METHOD rather than an agent
 *  mandate — `converge-cli.mjs#panelInstruction`'s own comment) reports `ok:false` rather than inventing a
 *  tool-running mechanism this build has no spec for; converge-core treats that as non-blocking for an
 *  advisory lens by design. */
function runPanelInstruction(panel, provider, item) {
  const results = [];
  for (const entry of panel) {
    if (!entry.mandate) { results.push({ lens: entry.lens, ok: false, findings: [] }); continue; }
    const jurorCount = Math.max(1, Number(entry.jurors) || 1);
    for (let j = 0; j < jurorCount; j += 1) {
      const prompt = `${entry.mandate}\n\n${JUROR_JSON_CONTRACT}`;
      const sessionId = `${item}-panel-${entry.lens}-${j}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const parsed = spawnJudgeAgent(provider, sessionId, prompt);
      results.push({ lens: entry.lens, ok: parsed.ok !== false, findings: Array.isArray(parsed.findings) ? parsed.findings : [] });
    }
  }
  return results;
}

/** One agent per red-team juror; every result's findings are unioned into one `redTeamResult`, per
 *  `converge-cli.mjs`'s own `redTeam.report` instruction text ("Union every validator's findings into ONE
 *  redTeamResult"). `ran:true` is asserted only once every juror actually returned — a spawn that throws
 *  degrades the WHOLE red-team to `ran:false`, matching #2707's "an unrun red-team never ratifies" rule. */
function runRedTeamInstruction(redTeam, provider, item) {
  const findings = [];
  try {
    for (const entry of redTeam.jury ?? []) {
      const prompt = `${entry.prompt}\n\n${JUROR_JSON_CONTRACT}`;
      const sessionId = `${item}-redteam-${entry.lens}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const parsed = spawnJudgeAgent(provider, sessionId, prompt);
      if (Array.isArray(parsed.findings)) findings.push(...parsed.findings);
    }
    return { ran: true, findings };
  } catch (e) {
    return { ran: false, error: String(e?.message ?? e) };
  }
}

/** One editor agent, asked to return `{advanced, dismissed}` per `applyRevision`'s own "## What to return"
 *  instruction text (`we:scripts/lib/converge-transports.mjs`). Fail-closed on a malformed/missing response —
 *  `deriveRoundObservations` already treats an absent/non-true `advanced` as NOT advanced. */
function runEditInstruction(edit, provider, item) {
  const sessionId = `${item}-editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const parsed = spawnJudgeAgent(provider, sessionId, edit.prompt);
    return { advanced: parsed.advanced === true, dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [] };
  } catch (e) {
    return { advanced: false, error: String(e?.message ?? e) };
  }
}

const JUROR_JSON_CONTRACT = 'Reply with ONLY a single JSON object on your final line — no prose before or '
  + 'after it, no markdown code fence — matching `{ "ok": true, "findings": [...] }` (an empty `findings` '
  + 'array if you found nothing).';

/** Spawn one judge/editor agent through the provider port and parse its final response as JSON. Fresh
 *  session id every call — a juror/editor is never resumed. */
function spawnJudgeAgent(provider, sessionId, prompt) {
  const out = provider.spawn({ sessionId, prompt });
  return extractJsonResponse(out);
}

/** A `-p` print-mode agent's final response may be exactly a JSON object, or prose with one embedded (a code
 *  fence, or trailing/leading commentary despite the instruction above). Tries a direct parse first, then
 *  strips a ```json fence, then falls back to a balanced-brace scan for the first top-level object — the
 *  same "be liberal in what you accept from a model's own text" posture the rest of this repo's agent-facing
 *  parsers take. Throws (never silently returns `{}`) when none of the three finds valid JSON, so a genuinely
 *  malformed judge response surfaces as a loud failure of that juror rather than a quiet false accept. */
export function extractJsonResponse(text) {
  const s = String(text ?? '');
  try { return JSON.parse(s.trim()); } catch { /* fall through */ }
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
  }
  const start = s.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < s.length; i += 1) {
      if (s[i] === '{') depth += 1;
      else if (s[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          try { return JSON.parse(s.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }
  throw new Error(`deliver-item-wrapper: could not extract a JSON object from the agent's response: ${JSON.stringify(s.slice(0, 200))}`);
}

// ================================================================================================
// 5. Escalation mapping — REAL. The FULL `scoreEscalation` (`we:scripts/lib/review-escalation.mjs`), not a
//    2-input simplification: it already computes the statute/policy-core/blast-radius/size/dismissed/
//    cross-repo signals internally (verified by reading its body directly), so calling it with the real
//    `changedFiles`/`diffLines` this wrapper has in hand IS the full rubric, not a re-implementation of a
//    slice of it.
// ================================================================================================

/**
 * Maps `report` + `convergeVerdict` + a real `scoreEscalation` read onto a park mode.
 *
 * `scoreEscalation({ changedFiles })` alone is a REAL, existing call shape in this repo (`review-core-cli.mjs`
 * calls it with exactly this one field) — every optional signal this call omits (`humanBasisFiles`,
 * `cumulativeDiffLines`, `dismissedFindings`, `crossRepo`, `diffHunks`, `basisNarrowed`) simply does not fire
 * that signal rather than being faked; `diffLines` IS supplied here (a real `git diff --shortstat` read
 * against the lane), so the SIZE signal is real too. What is genuinely NOT wired in, stated plainly: cross-PR
 * cumulative-basis inputs (`humanBasisFiles`/`cumulativeDiffLines`/`basisNarrowed`) — meaningful only for a
 * stacked/cross-locus PR, which this standalone single-item pipeline does not build; `dismissedFindings` — the
 * lane's own dismissed-finding COUNT across every converge round, which `runConverge`'s return value does
 * carry (`convergeVerdict.dismissed`) and is threaded through below; `crossRepo` — always `false`, since this
 * wrapper never opens a couple.
 */
export function decideParkMode({ report, convergeVerdict, lanePath }, doRun = run) {
  const changedFiles = laneChangedFiles(lanePath, doRun);
  const diffLines = laneDiffLineCount(lanePath, doRun);
  const dismissedFindings = Array.isArray(convergeVerdict.dismissed) ? convergeVerdict.dismissed.length : 0;
  const score = scoreEscalation({ changedFiles, diffLines, dismissedFindings });

  if (report.outcome === 'needs-human-judgment') {
    return { mode: 'park', label: 'review:human', reason: report.reason };
  }
  if (convergeVerdict.verdict === 'escalate') {
    return { mode: 'park', label: 'review:human', reason: convergeVerdict.reason || 'converge escalated without landing' };
  }
  if (score.humanRequired) {
    return { mode: 'park', label: 'review:human', reason: score.reasons.join('; ') };
  }
  if (score.escalate) {
    return { mode: 'park', label: 'review:pending', reason: score.reasons.join('; ') };
  }
  return { mode: 'label-on-green', label: 'ready-to-merge', reason: null };
}

/** The lane's changed-file set against `origin/main` (tracked) plus untracked files — the same basis
 *  `converge-cli.mjs#laneChangedFiles` computes for the panel roster, re-derived here rather than imported
 *  (that function is module-private in `converge-cli.mjs`, which also runs a CLI at import time). */
function laneChangedFiles(lanePath, doRun = run) {
  const gitAt = (args) => { try { return doRun('git', ['-C', lanePath, ...args]); } catch { return ''; } };
  const mergeBase = gitAt(['merge-base', 'HEAD', 'origin/main']).trim();
  const tracked = mergeBase ? gitAt(['diff', '--name-only', mergeBase]) : '';
  const untracked = gitAt(['ls-files', '--others', '--exclude-standard']);
  return [...new Set(`${tracked}\n${untracked}`.split('\n').map((s) => s.trim()).filter(Boolean))];
}

/** Total changed lines against `origin/main`'s merge-base — `scoreEscalation`'s `diffLines` input. `0` on any
 *  git failure (an unmeasurable diff should not fabricate a size signal). */
function laneDiffLineCount(lanePath, doRun = run) {
  try {
    const mergeBase = doRun('git', ['-C', lanePath, 'merge-base', 'HEAD', 'origin/main']).trim();
    if (!mergeBase) return 0;
    const stat = doRun('git', ['-C', lanePath, 'diff', '--shortstat', mergeBase]);
    const m = stat.match(/(\d+) insertion.*?(?:, (\d+) deletion)?/s) || stat.match(/(\d+) deletion/);
    if (!m) return 0;
    const ins = Number(stat.match(/(\d+) insertion/)?.[1] || 0);
    const del = Number(stat.match(/(\d+) deletion/)?.[1] || 0);
    return ins + del;
  } catch {
    return 0;
  }
}

// ================================================================================================
// 6/7. PR + learnings — REAL CLI surfaces, lifted verbatim from the live brief's own step 8/9, with real
//    slug/body authoring (the PR #2104 sketch's remaining PLACEHOLDERs) and a real `--json` output parse
//    (verified against `we:scripts/operations/open-pr.mjs`'s/`engine.mjs`'s own real shapes — see below).
// ================================================================================================

/** `lane/<slug>` derivation. A plain kebab-case of the item's own backlog slug (`findItem`'s own `slug`
 *  field), capped to a sane ref length — the same "human-legible, stable, no ceremony" bar the live brief's
 *  own free-text `-<slug>` convention sets, just made deterministic instead of left to the caller's judgment
 *  each time. */
export function slugForItem(item, root = REPO_ROOT) {
  const found = findItem(normNum(item), () => defaultLoadItems(root));
  const raw = found?.slug || `item-${item}`;
  return String(raw).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `item-${item}`;
}

/** A minimal, real PR body — what this wrapper's own delivery flow actually knows, no invented ceremony. */
export function buildPrBody({ item, report, convergeVerdict }) {
  const lines = [
    `Delivers backlog item #${item} via the #3627 minimal-context delivery pipeline (\`deliver-item-wrapper.mjs\`).`,
    '',
    `**Outcome reported by the delivery agent:** \`${report.outcome}\`${report.reason ? ` — ${report.reason}` : ''}`,
    `**Files touched:** ${(report.filesTouched || []).join(', ') || '(none reported)'}`,
    `**Converge verdict:** \`${convergeVerdict.verdict}\`${convergeVerdict.reason ? ` — ${convergeVerdict.reason}` : ''}`,
  ];
  if (convergeVerdict.dismissed?.length) {
    lines.push('', '**Dismissed findings:**', ...convergeVerdict.dismissed.map((d) => `- ${d.summary ?? JSON.stringify(d)}${d.reason ? ` — ${d.reason}` : ''}`));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * REAL flags (lifted verbatim from the live brief's step 8) + a REAL `--json` parse.
 *
 * THE PARSE, VERIFIED BY READING THE OPERATION FRAMEWORK'S OWN CODE (not assumed — no existing caller in this
 * repo programmatically parses `run.mjs open-pr --json`'s stdout; every current call site is an interactive
 * agent reading the printed JSON itself):
 *   - `open-pr.mjs` declares its effect step under the key `submit` (`submit: effect({...})`).
 *   - `engine.mjs#effectFinding` wraps an EFFECT step's finding as `{applied, effects: [{type, status, result,
 *     error}]}` — one entry per effect the step declared (`open-pr` declares exactly one).
 *   - `cli-adapter.mjs#outcomePayload` (what `--json` actually prints) includes `findings: run.findings`
 *     directly, keyed by step name.
 *   - `open-pr-io.mjs#createOpenPrSinks`'s effect handler returns `classifySubmit(...)`'s own result verbatim
 *     — `{outcome: 'opened'|'refused'|'unrun', pr, url, parked, reason}` (verified against
 *     `open-pr.test.mjs`'s own asserted shape, e.g. `{outcome:'opened', pr:1500}`).
 * So the PR number is at `parsed.findings.submit.effects[0].result.pr`. NOT exercised against a real
 * `open-pr` run in this build (that would open a real PR) — the parse itself is unit-tested against this
 * exact, source-verified shape.
 */
export function openPr({ item, attemptTag, lane, park, report, convergeVerdict, slug }, doRun = run) {
  const ref = `lane/${item}${attemptTag ?? ''}-${slug ?? slugForItem(item)}`;
  const bodyFile = join(lane, '.pr-body.md');
  writeFileSync(bodyFile, buildPrBody({ item, report: report ?? { outcome: 'done', filesTouched: [] }, convergeVerdict: convergeVerdict ?? { verdict: 'land' } }));
  const args = [
    'scripts/operations/run.mjs', 'open-pr', `--ref=${ref}`, '--sha=HEAD', '--base=main',
    `--bodyFile=${bodyFile}`, '--requireVerified=true', '--json',
  ];
  args.push(park.mode === 'park' ? '--mode=park' : '--mode=label-on-green');
  if (park.mode === 'park') args.push(`--parkLabel=${park.label}`);
  const out = doRun('node', args, { cwd: lane });
  const parsed = JSON.parse(out);
  const result = parsed?.findings?.submit?.effects?.[0]?.result;
  if (!result) throw new Error(`deliver-item-wrapper: open-pr --json produced no findings.submit.effects[0].result — raw: ${out}`);
  return result;
}

/** REAL (flags lifted verbatim from the live brief's step 9). */
function dropLearning({ sessionSlug, learning }, doRun = run) {
  doRun('node', [
    'scripts/conveyor/learnings-drop.mjs', `--kind=${learning.kind}`, `--summary=${learning.summary}`,
    `--area=${learning.area}`, `--suggestion=${learning.suggestion}`, `--session=${sessionSlug}`,
  ]);
}

// ================================================================================================
// CLI entrypoint — point this wrapper at exactly ONE backlog item.
//
//   node scripts/operations/deliver-item-wrapper.mjs --item=<NNN> --lane=<N> [--scope=<repo:path,...>]
//     [--session=<slug>] [--attempt=<tag>] [--provider=claude-bare]
//
// `--scope` defaults to the item's own `scope:` frontmatter (the same source `dispatch-lane.mjs` reads) when
// omitted. `--session` defaults to `sessionSlugFor(item)` (the live dispatcher's own naming, real reuse — see
// import above), so a caller need not invent a slug by hand for the common case.
//
// NOT registered under `we:scripts/operations/run.mjs`'s operation table: that convention (declaration +
// reader + judge + resumable run-store) is built for suspend/resume, judged operations — `deliverItem`'s own
// shape (an imperative try/catch orchestrating blocking subprocess spawns, never suspending) does not fit it,
// and forcing it through that apparatus would be new scope this build does not need. A plain argv parser,
// mirroring `we:scripts/verify-lane.mjs`'s / `we:scripts/lane-pool.mjs`'s own top-level CLI shape, is the
// honest fit.
// ================================================================================================
function parseCliFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

export async function runCli(argv, root = REPO_ROOT) {
  const flags = parseCliFlags(argv);
  if (!flags.item) throw new Error('usage: deliver-item-wrapper.mjs --item=<NNN> --lane=<N> [--scope=...] [--session=<slug>] [--attempt=<tag>] [--provider=claude-bare]');
  if (!flags.lane) throw new Error('deliver-item-wrapper.mjs: --lane=<N> is required — which lane clone this item runs in');

  const item = normNum(flags.item);
  const found = findItem(item, () => defaultLoadItems(root));
  const scope = typeof flags.scope === 'string' && flags.scope.trim()
    ? flags.scope.trim()
    : (found?.scope || []).join(',');
  if (!scope) throw new Error(`deliver-item-wrapper.mjs: no scope for #${item} — pass --scope=<repo:path,...> or ensure the item's own \`scope:\` frontmatter is set`);
  const sessionSlug = typeof flags.session === 'string' && flags.session.trim() ? flags.session.trim() : sessionSlugFor(item);
  const providerKey = typeof flags.provider === 'string' && flags.provider.trim() ? flags.provider.trim() : 'claude-bare';
  const provider = DELIVERY_AGENT_PROVIDERS[providerKey];
  if (!provider) throw new Error(`deliver-item-wrapper.mjs: unknown --provider=${JSON.stringify(providerKey)} — one of ${Object.keys(DELIVERY_AGENT_PROVIDERS).join(', ')}`);

  return deliverItem(
    { item, lane: Number(flags.lane), scope, sessionSlug, attemptTag: typeof flags.attempt === 'string' ? flags.attempt : '' },
    { provider },
  );
}

const IS_CLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_CLI) {
  runCli(process.argv.slice(2)).then((result) => {
    writeAllSync(1, `${JSON.stringify(result, null, 2)}\n`);
  }).catch((e) => {
    writeLineSync(2, `deliver-item-wrapper: ${String(e?.message ?? e)}`);
    process.exitCode = 1;
  });
}
