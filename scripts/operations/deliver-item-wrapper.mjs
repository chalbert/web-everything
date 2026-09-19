#!/usr/bin/env node
/**
 * @file scripts/operations/deliver-item-wrapper.mjs
 * @description PROTOTYPE / DESIGN SKETCH for #3627 — the wrapper a MINIMAL delivery agent
 * (`we:skills-src/conveyor/delivery-agent-brief-v2.md`) would run under, if #3627 is ever ratified.
 *
 * ================================================================================================
 * HONESTY LABEL, READ THIS FIRST. This file is NOT wired into `we:scripts/operations/dispatch-lane.mjs`,
 * is NOT imported by anything, and NOT covered by tests — it is a concrete SKETCH of shape and call order,
 * not a shipped implementation. Every function below is marked with one of:
 *   REAL      — the shell-out uses a CLI surface this session read directly (usage strings, or a working
 *               example) from the live scripts it calls, and the call shape is correct as written.
 *   SKETCH    — the call shape is my best-informed guess at the real API (I read adjacent code, but not
 *               enough of the target file to be sure of every flag/return shape), and would need
 *               verification against the real function before this is wired in.
 *   PLACEHOLDER — deliberately unresolved design question, stubbed so the control flow reads top-to-bottom;
 *               see the inline TODO for what actually needs deciding.
 * ================================================================================================
 *
 * THE SHAPE, IN ONE PARAGRAPH. Today, `we:scripts/operations/dispatch-lane.mjs` spawns a `claude --bg`
 * process directly, handing it the ENTIRE 527-line brief as its prompt — acquire, claim, readiness, build,
 * gate-poll, converge, PR, label, escalate, learnings-drop are ALL the agent's own responsibility. This
 * wrapper is what runs INSTEAD of that spawn: it does the mechanical acquire/claim/gate/PR/label/escalation
 * work itself, in its OWN process (never inside the agent's turn budget, never subject to the
 * `PreToolUse(Bash)` guard that only fires inside a live Claude Code session's own tool calls — see the note
 * on `runGate` below), and only asks the agent to do the one thing that is actually judgment: build the item
 * and report a three-value outcome.
 *
 * SIX FIRM REQUIREMENTS, applied throughout (not open questions — stated by the operator across three rounds
 * of follow-up after this session's first draft, and this version is written to satisfy all six):
 *   1. The agent never initiates `/converge` or any review of its own diff — see `runConverge` below, called
 *      ONLY by this wrapper, never by the agent.
 *   2. The agent never opens or watches its own PR — see `openPr` below, likewise wrapper-only.
 *   3. The mechanical layer (this file) drives review, PR lifecycle, and verification, end to end. The
 *      agent's job is exactly: build, report. Nothing else appears in
 *      `we:skills-src/conveyor/delivery-agent-brief-v2.md`.
 *   4. NO POLLING anywhere in this flow — not by the agent, and not by this wrapper standing in for it. Every
 *      wait below is a single BLOCKING call (`execFileSync` inside `defaultSpawnAgent`/`run`) that returns
 *      exactly when the underlying process ends — the return itself IS the notification. Where the agent
 *      needs a result mid-run (the gate came back red), the wrapper does not re-poll the agent for progress —
 *      it RESUMES the agent's own session with the actual result already in hand (`resumeAgentWithGateFailure`),
 *      exactly once, and that resume call is itself blocking, not a fire-and-check loop. An earlier draft of
 *      this sketch had the wrapper poll a report file in a loop after a `--bg` spawn; that was wrong — it
 *      just moved the poll to a different process — and is corrected below (see `runAgentToCompletion`).
 *   5. The agent gets NO knowledge of the mechanical/delivery system at all — not "minimal doctrine", NOTHING:
 *      no lanes, no dispatch, no PR mechanics, not even that a "conveyor" exists. Not just the operator's
 *      PERSONAL `~/.claude/CLAUDE.md` (interactive-collaboration preferences, irrelevant to an autonomous
 *      build) — the repo's own `we:CLAUDE.md` → `we:AGENTS.md` → `we:docs/agent/*.md` doctrine chain and the
 *      project's `.claude/skills/` auto-discovery listing too. See `CLAUDE_BARE_PROVIDER` below for the
 *      concrete, VERIFIED mechanism (`--bare` + `--disable-slash-commands` + a TRIMMED `--settings` file
 *      carrying ONLY `guard-lane.mjs`/`guard-bash.mjs`, updated in this revision to close the safety-hooks gap
 *      requirement 6 below names) and the one honest cost that remains after that fix.
 *   6. PROVIDER PARITY — the minimal-context spawn mechanism must be a swappable PORT, not Claude-CLI flags
 *      hardcoded into this file's core control flow, mirroring the SAME provider-port pattern already
 *      extracted for `we:scripts/operations/dispatch-lane-io.mjs`'s dispatcher seam (#3579, `provider` param
 *      on `createDispatchSinks`) and `we:scripts/operations/cli-adapter.mjs`'s judge seam (#3370,
 *      `createDefaultJudge`'s injected implementation) — both landed, both real. Applied here: see
 *      `DeliveryAgentProvider` below — `CLAUDE_BARE_PROVIDER` is the REAL, Claude-verified implementation;
 *      `CODEX_PROVIDER` is a NAMED SEAM ONLY, deliberately left throwing, because this session has NOT
 *      independently verified Codex CLI's actual flags for minimal-context spawning or whether it has any
 *      hook-equivalent at all — inventing those flags here would be worse than leaving the gap explicit.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// REAL — every one of these is an existing exported function this session read directly.
import { defaultSpawnAgent } from './dispatch-lane-io.mjs';
import { tryReadDeliveryReport } from './delivery-report-store.mjs';
import { isStatutePath, isPolicyCorePath } from '../lib/gate-config.mjs';

const REPO_ROOT = new URL('../..', import.meta.url).pathname;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', cwd: REPO_ROOT, ...opts });

// ================================================================================================
// 0. The minimal-context hook settings file — REAL SCHEMA, closes the "cost 1" gap the first draft of this
//    sketch left open. `we:.claude/settings.json` (read directly from this repo, verbatim shape below) is
//    the REAL hook-registration schema Claude Code loads; this is the SAME shape, trimmed to carry ONLY the
//    two hooks a delivery agent's own Bash/Edit/Write calls still need for safety — `guard-lane.mjs` (refuses
//    an Edit/Write from a foreign session onto a lane it does not own) and `guard-bash.mjs` (the destructive-
//    git-op / main-push / backgrounded-verification-set denials) — dropping the other three Edit|Write hooks
//    the real settings.json also carries (`lint-locus-prefix.mjs`, `check-memory.mjs`, `backlog-guard.mjs`,
//    `guard-backward-edge.mjs`), none of which apply to a minimal delivery agent that never touches
//    `backlog/*.md`/`reports/*.md`/agent-memory files itself (the wrapper owns claim/release/scaffold).
//
//    `--bare`'s own help text lists `--settings` among what a caller may layer BACK ON TOP of it ("Explicitly
//    provide context via: ... --settings ..."), and `--settings <file-or-json>` is documented as loading
//    "ADDITIONAL settings" (not a replacement) — both re-confirmed directly against `claude --help` on the
//    installed CLI (v2.1.266) before writing this in. So `--bare --settings=<this file>` is REAL and
//    VERIFIED as a combination, not a guess: `--bare` strips CLAUDE.md/memory/skills/hooks/plugins down to
//    nothing, and this file re-adds ONLY the two safety hooks, nothing else — no memory, no doctrine, no
//    skill discovery leaks back in through the settings layer.
// ================================================================================================
const DELIVERY_HOOKS_SETTINGS = Object.freeze({
  hooks: {
    PreToolUse: [
      { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'node scripts/guard-lane.mjs' }] },
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'node scripts/guard-bash.mjs' }] },
    ],
  },
});

/**
 * SKETCH (the write itself is straightforward REAL fs code; what's unverified is whether a real cutover
 * wants this materialized once per-repo, once per-lane, or fresh per-spawn — left as the simplest correct
 * choice for this sketch: idempotent, written once to a fixed path under the SAME `.operations/` sidecar
 * family `we:scripts/operations/delivery-report-store.mjs` already uses). Returns the settings file's path.
 */
function ensureDeliveryHooksSettingsFile() {
  const dir = `${REPO_ROOT}.operations`;
  const path = `${dir}/delivery-agent-hooks-settings.json`;
  if (!existsSync(path)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, `${JSON.stringify(DELIVERY_HOOKS_SETTINGS, null, 2)}\n`);
  }
  return path;
}

/**
 * SKETCH — top-level entry the conveyor's tick would call in place of today's direct `claude --bg` spawn
 * (`we:scripts/operations/dispatch-lane.mjs`'s build-launch branch). One call = one item = one attempt.
 *
 * @param {{ item: string, lane: number, scope: string, sessionSlug: string, attemptTag: string, briefPath: string }} launch
 *   the SAME launch-entry shape `dispatch-lane.mjs` already receives from `planTick`'s `spawnBuilds` list —
 *   this wrapper does not change what feeds it, only what it does with it.
 * @param {DeliveryAgentProvider} [provider] — which CLI spawns and resumes this delivery agent (FIRM
 *   REQUIREMENT 6, provider parity). Defaults to `CLAUDE_BARE_PROVIDER`, the only real implementation today;
 *   pass `DELIVERY_AGENT_PROVIDERS.codex` once that provider is actually built. Threaded through unchanged to
 *   every call that spawns or resumes the agent (`runAgentToCompletion`, `runGateWithOneRetry` →
 *   `resumeAgentWithGateFailure`) — nothing else in this function's control flow is provider-specific.
 */
export async function deliverItem(launch, provider = CLAUDE_BARE_PROVIDER) {
  const { item, lane, scope, sessionSlug, attemptTag } = launch;

  // ---- 1. Acquire + claim (REAL CLI surface, verbatim from the live brief's own step 1/2) -----------------
  acquireLane({ lane, sessionSlug, scope, item });
  try {
    claimItem({ item, sessionSlug });

    // ---- 2. Spawn the MINIMAL agent, wait for its structured report (SKETCH) -----------------------------
    const report = await runAgentToCompletion({ item, sessionSlug, lane, attemptTag, provider });

    // ---- 3. Act on the report — every branch below is what USED TO be the agent's own job -----------------
    if (report.outcome === 'blocked' && (!report.filesTouched || report.filesTouched.length === 0)) {
      // Pre-build stop, same shape as today's brief's Escalations case 0 — but decided by the WRAPPER
      // reading the report, never by the agent reasoning about claim/release CLI mechanics.
      releaseClaimAndLane({ item, lane, sessionSlug });
      return { item, result: `not-ready (${report.reason})` };
    }

    if (report.outcome === 'blocked') {
      // A runtime blocker hit mid-build, with real (uncommitted or committed) work already in the lane.
      // TODO (PLACEHOLDER): today's brief has no analogous mid-build "blocked with partial work" case —
      // every existing exit either finishes the build or stops before writing anything. Decide: discard the
      // partial work and release (safest, matches "no PR is opened" bar 0 sets), or open a draft/park PR so
      // the partial diff is not silently lost? Left open for whoever actually specs this out.
      releaseClaimAndLane({ item, lane, sessionSlug });
      return { item, result: `blocked-mid-build (${report.reason})` };
    }

    // outcome is 'done' or 'needs-human-judgment' from here — both have a real diff. Run the gate FIRST in
    // either case: a needs-human-judgment report still needs a green gate before anyone reviews it.
    const gate = runGateWithOneRetry({ lane, item, sessionSlug, attemptTag, provider });
    if (gate.status === 'red') {
      releaseClaimAndLane({ item, lane, sessionSlug });
      return { item, result: 'gate-red' };
    }

    // ---- 4. Converge — driven BY THE WRAPPER, not the agent (this session's call on step 6, see the design
    // amendment on #3627: KEEP the substance, MOVE the driving). SKETCH — the exact init/step loop shape is
    // taken from the live brief's own step 6 prose, not verified against `converge-cli.mjs`'s real output. --
    const convergeVerdict = runConverge({ lane: gate.lanePath, item });

    // ---- 5. Map outcome + convergeVerdict + statute-touch to a park mode, via the EXISTING deterministic
    // rubric (`review-escalation.mjs`) — REAL import, SKETCH call (the real `scoreEscalation` signature takes
    // more inputs — diff stats, dismissed-finding counts — than sketched here). -------------------------------
    const parkDecision = decideParkMode({ report, convergeVerdict, filesTouched: report.filesTouched });

    // ---- 6. Open the PR through the SAME canonical producer the live brief already uses — REAL CLI surface,
    // verbatim from the live brief's own step 8. ------------------------------------------------------------
    const prResult = openPr({ item, attemptTag, lane: gate.lanePath, park: parkDecision });

    // ---- 7. Forward the optional learning, if the agent supplied one (REAL CLI surface). --------------------
    if (report.learning) dropLearning({ sessionSlug, learning: report.learning });

    // ---- 8. Exit. Same "never merge, never release, the drain lands it" contract as today. -----------------
    return { item, result: `PR #${prResult.number} (${parkDecision.label})` };
  } catch (e) {
    // A wrapper-side failure (acquire refused, claim refused, gate script itself threw) is NOT the agent's
    // outcome — it never reached the agent, or the agent's own report is irrelevant to it. Release what was
    // acquired and surface the raw error; there is no report to interpret.
    releaseClaimAndLane({ item, lane, sessionSlug, best_effort: true });
    throw e;
  }
}

// ================================================================================================
// 1. Lane + claim — REAL, lifted verbatim from the live brief's step 1/2 CLI surface.
// ================================================================================================

/** REAL. Same flags the live brief's step 1 documents. */
function acquireLane({ lane, sessionSlug, scope, item }) {
  run('node', [
    'scripts/lane-pool.mjs', 'acquire', `--lane=${lane}`, '--purpose=conveyor-delivery',
    `--session=${sessionSlug}`, `--scope=${scope}`, `--item=${item}`, '--adopt',
  ]);
}

/** REAL. Same flags the live brief's step 2 documents. */
function claimItem({ item, sessionSlug }) {
  run('node', ['scripts/backlog.mjs', 'claim', String(item), `--session=${sessionSlug}`]);
}

/** REAL (release flags lifted from the live brief's Escalations case-0 mechanism). */
function releaseClaimAndLane({ item, lane, sessionSlug, best_effort = false }) {
  const opts = best_effort ? { stdio: 'ignore' } : {};
  try { run('node', ['scripts/backlog.mjs', 'release', String(item), `--session=${sessionSlug}`], opts); } catch { /* best-effort on the failure path */ }
  try { run('node', ['scripts/lane-pool.mjs', 'release', `--lane=${lane}`, `--session=${sessionSlug}`], opts); } catch { /* best-effort on the failure path */ }
}

// ================================================================================================
// 2. Spawn + get the structured report, THROUGH A PROVIDER PORT — SKETCH shell over a REAL primitive, now
//    restructured (per operator follow-up) to mirror the SAME provider-port extraction already landed for
//    #3579 (`createDispatchSinks`'s `provider` param, `we:scripts/operations/dispatch-lane-io.mjs`) and #3370
//    (`createDefaultJudge`'s injected implementation, `we:scripts/operations/cli-adapter.mjs`). Those two
//    extractions named the SAME shape this file needs: "the CLI-specific argv construction and spawn call
//    stay exactly where they are; only what sits BETWEEN them and the call site becomes a named port." Here,
//    the port is `DeliveryAgentProvider` — one provider per CLI a delivery agent might run under.
//
//    `defaultSpawnAgent` (REAL, imported below) blocks via `execFileSync` until its child process exits — the
//    fact this whole no-polling design rests on (FIRM REQUIREMENT 4) — and stays the shared low-level spawn
//    primitive every provider's `spawn` ultimately calls; what varies PER PROVIDER is only the argv/settings
//    a given CLI needs to achieve "minimal context, no hooks lost, no polling."
// ================================================================================================

/**
 * @typedef {object} DeliveryAgentProvider
 * @property {string} name
 * @property {(request: {sessionId: string, prompt: string, resumeSessionId?: string|null}) => void} spawn
 *   BLOCKS until the agent's own turn ends (FIRM REQUIREMENT 4 — no polling, ever). No return value is
 *   needed: the delivery-report contract (`we:scripts/operations/delivery-report-cli.mjs`) is
 *   PROVIDER-AGNOSTIC BY DESIGN — whichever CLI a provider spawns, the AGENT shells the same report CLI
 *   inside its own run, so `runAgentToCompletion`/`resumeAgentWithGateFailure` always read the result via
 *   `tryReadDeliveryReport`, never via anything provider-specific. This is exactly why the port can be this
 *   small: "minimal-context spawn" is the only CLI-specific behavior a provider owns.
 */

/**
 * CLAUDE_BARE_PROVIDER — the REAL, Claude-verified implementation of {@link DeliveryAgentProvider}.
 *
 * `-p`/`--session-id` are the real, documented flags; `--bare`+`--settings` is a REAL, VERIFIED combination
 * (`--bare`'s own help text lists `--settings` among what may be layered back on top of it; `--settings
 * <file-or-json>` is documented as loading ADDITIONAL settings, not a replacement — both re-confirmed
 * directly against `claude --help` on the installed CLI, v2.1.266, immediately before writing this). Their
 * exact interaction with `--resume`/`-p` together is NOT independently verified against the CLI's own argv
 * parser — flagged rather than asserted.
 *
 * THE PERSONAL/PROJECT-CLAUDE.MD LEAK — INVESTIGATED, NOT ASSUMED. Checked whether
 * `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv` (the REAL function `dispatch-lane.mjs` calls
 * TODAY) suppresses `~/.claude/CLAUDE.md` / project `CLAUDE.md` / skill auto-discovery for a spawned agent:
 * it does NOT — its `--bg` branch passes only `--session-id`/`-n`/`--append-system-prompt-file`, none of
 * which touch CLAUDE.md loading, hooks, or skill discovery. So TODAY, every dispatched delivery agent —
 * including under the LIVE 527-line brief, not just a hypothetical v2 — auto-loads the operator's personal
 * `~/.claude/CLAUDE.md` and this repo's own `we:CLAUDE.md` → `we:AGENTS.md` → `we:docs/agent/*.md` doctrine
 * chain, plus the full project `.claude/skills/` auto-discovery listing, exactly like an interactive session
 * does. This is a REAL, confirmed gap in the CURRENT system, not a v2-only concern.
 *
 * `--bare` (verbatim from `claude --help`): "Minimal mode: skip hooks, LSP, plugin sync, attribution,
 * auto-memory, background prefetches, keychain reads, and CLAUDE.md auto-discovery." — paired with
 * `--disable-slash-commands` ("Disable all skills") as defense in depth, so even a brief that accidentally
 * NAMES a skill can't invoke one.
 *
 * THE SAFETY-HOOKS GAP — NOW CLOSED, not just flagged. An earlier draft of this file left `--bare` bare: it
 * skips hooks entirely, which would also drop `we:scripts/guard-bash.mjs`'s general safety nets
 * (destructive-git-op protection, the `main`-push block) alongside the lane-mechanics awareness this design
 * wants gone — an unnecessary all-or-nothing tradeoff. The fix: `--settings=<ensureDeliveryHooksSettingsFile()>`
 * layers `DELIVERY_HOOKS_SETTINGS` (above) back on top of `--bare` — ONLY `guard-lane.mjs`/`guard-bash.mjs`,
 * nothing else — so the agent keeps its safety net without any of the CLAUDE.md/memory/skill/doctrine surface
 * `--bare` was chosen to remove in the first place.
 *
 * ONE HONEST COST REMAINING (the settings-file fix above resolves the other one from the prior draft):
 * `--bare`'s own text states plainly: "Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper via
 * --settings (OAuth and keychain are never read)." If today's dispatched sessions currently authenticate via
 * an interactive OAuth/keychain session (not independently confirmed either way in this sketch), switching to
 * `--bare` requires `ANTHROPIC_API_KEY` (or an `apiKeyHelper`) to be available in whatever environment spawns
 * this wrapper — a real prerequisite to check before this is ever wired in, not an assumption to build on.
 */
const CLAUDE_BARE_PROVIDER = {
  name: 'claude-bare',
  spawn({ sessionId, prompt, resumeSessionId = null }) {
    const settingsFile = ensureDeliveryHooksSettingsFile();
    const BARE_FLAGS = ['--bare', '--disable-slash-commands', '--settings', settingsFile];
    const argv = resumeSessionId
      ? [...BARE_FLAGS, '--resume', String(resumeSessionId), prompt]
      : [...BARE_FLAGS, '-p', '--session-id', String(sessionId), prompt];
    defaultSpawnAgent(argv, {}); // BLOCKS until the agent's own run ends — this line is the only "wait".
  },
};

/**
 * CODEX_PROVIDER — A NAMED SEAM ONLY, deliberately NOT implemented (per operator follow-up: provider parity
 * must be an architectural requirement now, even where this session cannot verify a second CLI's real
 * mechanism yet). What is genuinely UNRESEARCHED, stated plainly rather than guessed at: Codex CLI's actual
 * flags (if any) for a minimal-context, no-project-doctrine, no-auto-memory spawn equivalent to `--bare`;
 * whether Codex has any hook-equivalent mechanism at all, and if so its config schema (so a
 * `DELIVERY_HOOKS_SETTINGS`-equivalent trimmed-safety-net file could be written for it); and whether Codex's
 * CLI exposes a synchronous/foreground invocation this wrapper's blocking `spawn` contract can rely on the
 * same way it relies on `defaultSpawnAgent`'s `execFileSync` for Claude. Inventing plausible-looking flags
 * here would be worse than leaving this an explicit, loud gap — so `spawn` throws, naming exactly what is
 * missing, rather than silently no-op'ing or guessing.
 */
const CODEX_PROVIDER = {
  name: 'codex (UNRESEARCHED — not implemented)',
  spawn() {
    throw new Error(
      'deliver-item-wrapper: CODEX_PROVIDER has no real implementation yet. Needed before use: Codex CLI\'s '
      + 'own minimal-context/no-auto-memory spawn flags (the --bare equivalent), whether it has any '
      + 'hook-equivalent enforcement mechanism (the guard-lane.mjs/guard-bash.mjs equivalent), and whether it '
      + 'supports a blocking/foreground invocation this wrapper\'s spawn contract can rely on. This is the '
      + 'named PORT (see DeliveryAgentProvider), not a guess at Codex\'s actual mechanism — see this '
      + 'function\'s own docblock.',
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
 * SKETCH. Spawns the minimal-brief agent through the given provider and BLOCKS until it exits — no separate
 * wait step, because there is nothing left to wait for once the blocking call itself returns. This is the
 * wrapper side of true push (FIRM REQUIREMENT 4): the AGENT never polls anything — it runs once, reports
 * once, and exits — and neither does the WRAPPER; the single blocking call below IS the wait, and it costs
 * nothing extra because this process was already going to sit idle for exactly as long as the agent's run
 * takes, poll loop or not.
 */
async function runAgentToCompletion({ item, sessionSlug, lane, attemptTag, provider = CLAUDE_BARE_PROVIDER }) {
  const briefTemplate = readFileSync(`${REPO_ROOT}/skills-src/conveyor/delivery-agent-brief-v2.md`, 'utf8');
  const prompt = fillMinimalBrief(briefTemplate, { item, sessionSlug, lane, attemptTag }); // SKETCH — see below

  provider.spawn({ sessionId: sessionSlug, prompt }); // BLOCKS — see DeliveryAgentProvider's own docblock.

  const report = tryReadDeliveryReport(sessionSlug);
  if (!report || report.status !== 'done') {
    // The agent's process exited without ever sending a `done` report — a crash, per #3436's own precedent.
    // Nothing to poll for: the process is gone, so there is nothing further to wait on. This is itself a
    // result the wrapper acts on (treat as `blocked`, surface literally), never a reason to start waiting.
    throw new Error(`deliver-item-wrapper: agent for ${sessionSlug} exited with no done report (crash or refused effect)`);
  }
  return report;
}

/** PLACEHOLDER — real placeholder substitution would reuse `we:scripts/operations/dispatch-lane.mjs#fillBrief`
 *  against a v2-specific required-names list, not a hand-rolled replace. Sketched inline only so this file
 *  reads standalone. */
function fillMinimalBrief(template, { item, sessionSlug, lane, attemptTag }) {
  return template
    .replaceAll('{{ITEM_SPEC_PATH_BASENAME}}', `<item's actual backlog filename for #${item}>`)
    + `\n\n[env: DELIVERY_SESSION=${sessionSlug} DELIVERY_ITEM=${item} LANE=${lane} ATTEMPT_TAG=${attemptTag ?? ''}]`;
}

// ================================================================================================
// 3. The gate — REAL insight, SKETCH call. The load-bearing claim: `we:scripts/guard-bash.mjs`'s
//    verification-set deny is a `PreToolUse(Bash)` HOOK — it only fires inside a live Claude Code session's
//    OWN tool calls. This wrapper is a plain Node process the conveyor runs; it is not a Claude Code session
//    and has no Bash TOOL calls for any hook to intercept, so it can shell `verify-lane.mjs` SYNCHRONOUSLY
//    and just block for the 150-350s it takes — no `request`/`check` split, no polling, at all. This is the
//    single biggest concrete win the #3621 push-not-poll idea buys here: the request→poll dance in the live
//    brief's steps 5/8 exists ONLY because the agent's own tool call is what's constrained; a wrapper process
//    was never subject to that constraint to begin with.
// ================================================================================================

/** SKETCH (exact flags for `--gate=` overrides not re-verified here; the bare invocation is REAL — see the
 *  live brief's own step-5 prose, `we:scripts/verify-lane.mjs`'s header). One resume-and-retry, not an
 *  unbounded loop — mirrors the live brief's own "red gate is a hard stop" bar, but gives the agent exactly
 *  one chance to fix ITS OWN gate failure before that stop applies, since a transient/self-inflicted red on
 *  a fresh diff is common and cheap to hand back once. */
function runGateWithOneRetry({ lane, item, sessionSlug, attemptTag, provider = CLAUDE_BARE_PROVIDER }) {
  const lanePath = resolveLanePath(lane); // PLACEHOLDER — lane number → clone path lookup, real form TBD
  try {
    run('node', ['scripts/verify-lane.mjs', '--json'], { cwd: lanePath });
    return { status: 'green', lanePath };
  } catch (firstFailure) {
    const failureOutput = String(firstFailure.stdout || firstFailure.message || '');
    resumeAgentWithGateFailure({ sessionSlug, lane, failureOutput, provider }); // SKETCH — see below
    const retryReport = tryReadDeliveryReport(sessionSlug); // agent's fresh `done` report after fixing
    try {
      run('node', ['scripts/verify-lane.mjs', '--json'], { cwd: lanePath });
      return { status: 'green', lanePath, retryReport };
    } catch {
      return { status: 'red', lanePath };
    }
  }
}

/** SKETCH — this is the concrete "push, don't poll" moment for the gate specifically, and it is a firm
 *  operator requirement, not a nice-to-have: the agent never requested this gate run and never checks on it —
 *  it built, reported `done`, and its process already exited (see `runAgentToCompletion`, above). THIS
 *  function is the mechanical layer actively handing the agent a NEW turn, carrying the actual result, only
 *  because there is now a real result to hand it — never a resume-to-ask-"are-you-done-yet". The call below
 *  BLOCKS (same reasoning as `runAgentToCompletion`) until that new turn itself ends, so the caller
 *  (`runGateWithOneRetry`) can safely read the agent's fresh report the very next line with no loop of its
 *  own either. Goes THROUGH THE SAME PROVIDER PORT the initial spawn used (`provider.spawn` with
 *  `resumeSessionId` set) rather than a second, resume-specific Claude-CLI code path — a provider owns BOTH
 *  its fresh-spawn and its resume shape, so `CODEX_PROVIDER` (once real) would supply both from one place. */
function resumeAgentWithGateFailure({ sessionSlug, lane, failureOutput, provider = CLAUDE_BARE_PROVIDER }) {
  const prompt = `Your gate failed:\n\n${failureOutput}\n\nFix it in $LANE, commit again, then send a fresh `
    + `\`done\` report exactly as before.`;
  provider.spawn({ sessionId: sessionSlug, prompt, resumeSessionId: sessionSlug }); // BLOCKS.
}

function resolveLanePath(lane) {
  // PLACEHOLDER — `we:scripts/lib/lane-pool-paths.mjs` almost certainly already owns this lookup (seen
  // imported by `verify-lane.mjs` itself); not re-derived here since this file's job is shape, not a second
  // copy of that resolution.
  return `${REPO_ROOT}/../.lanes/web-everything/lane-${lane}`;
}

// ================================================================================================
// 4. Converge — SKETCH. Driven by the wrapper now, not the agent; substance (panel/red-team/editor) unchanged.
// ================================================================================================

/** SKETCH — the live brief's own step 6 documents `init`/`step` to `land`/`escalate`; this wrapper drives
 *  that same loop instead of the agent, which is the concrete form of this session's step-6 design call (see
 *  `we:backlog/3627-*.md`'s amendment): KEEP the review, MOVE who drives it. Not verified against
 *  `converge-cli.mjs`'s real `step` output shape. */
function runConverge({ lane, item }) {
  const state = `${lane}/.converge-state.json`;
  run('node', [
    'scripts/converge-cli.mjs', 'init', `--lane=${lane}`, `--state=${state}`, '--care=elevated',
    `--goal=deliver item ${item} to spec`,
  ]);
  // PLACEHOLDER — real loop would read `step`'s own printed state and repeat until `land`/`escalate`, per
  // `we:skills-src/converge/SKILL.md`'s action table (not re-read in full for this sketch).
  const stepOut = run('node', ['scripts/converge-cli.mjs', 'step', `--state=${state}`]);
  return JSON.parse(stepOut); // e.g. { verdict: 'land' } | { verdict: 'escalate', reason: '...' }
}

// ================================================================================================
// 5. Escalation mapping — REAL rubric imports, SKETCH glue. This is the piece that most directly replaces
//    today's live brief's Escalations section (7 cases, 3 exit codes, park-mode prose) with a table the
//    WRAPPER evaluates instead of the agent reasoning through prose.
// ================================================================================================

/** SKETCH glue over REAL rubric primitives (`isStatutePath`/`isPolicyCorePath` from `gate-config.mjs`, both
 *  actually imported above) — a real implementation would call the FULL `scoreEscalation` from
 *  `we:scripts/lib/review-escalation.mjs` (diff stats + dismissed-finding counts, not just path-shape),
 *  simplified here to the two inputs this sketch actually has in scope. */
function decideParkMode({ report, convergeVerdict, filesTouched }) {
  const touchesStatute = (filesTouched || []).some((f) => isStatutePath(f) || isPolicyCorePath(f));
  if (touchesStatute) return { mode: 'park', label: 'review:human', reason: 'statute/policy-core path touched' };
  if (report.outcome === 'needs-human-judgment') return { mode: 'park', label: 'review:human', reason: report.reason };
  if (convergeVerdict.verdict === 'escalate') return { mode: 'park', label: 'review:human', reason: convergeVerdict.reason };
  return { mode: 'label-on-green', label: 'ready-to-merge', reason: null };
}

// ================================================================================================
// 6/7. PR + learnings — REAL CLI surfaces, lifted verbatim from the live brief's own step 8/9.
// ================================================================================================

/** REAL (flags lifted verbatim from the live brief's step 8, both branches). */
function openPr({ item, attemptTag, lane, park }) {
  const ref = `lane/${item}${attemptTag ?? ''}-<slug>`; // <slug> — PLACEHOLDER, same free-text the live brief already leaves to the caller
  const bodyFile = `${lane}/.pr-body.md`; // PLACEHOLDER — body authoring itself is out of this sketch's scope
  const args = [
    'scripts/operations/run.mjs', 'open-pr', `--ref=${ref}`, '--sha=HEAD', '--base=main',
    `--bodyFile=${bodyFile}`, '--requireVerified=true', '--json',
  ];
  args.push(park.mode === 'park' ? `--mode=park` : '--mode=label-on-green');
  if (park.mode === 'park') args.push(`--parkLabel=${park.label}`);
  const out = run('node', args, { cwd: lane });
  return JSON.parse(out);
}

/** REAL (flags lifted verbatim from the live brief's step 9). */
function dropLearning({ sessionSlug, learning }) {
  run('node', [
    'scripts/conveyor/learnings-drop.mjs', `--kind=${learning.kind}`, `--summary=${learning.summary}`,
    `--area=${learning.area}`, `--suggestion=${learning.suggestion}`, `--session=${sessionSlug}`,
  ]);
}
