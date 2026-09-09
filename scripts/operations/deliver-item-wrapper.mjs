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
 * FIVE FIRM REQUIREMENTS, applied throughout (not open questions — stated by the operator across two rounds
 * of follow-up after this session's first draft, and this version is written to satisfy all five):
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
 *      project's `.claude/skills/` auto-discovery listing too. See `buildForegroundAgentArgv` below for the
 *      concrete, VERIFIED mechanism (`--bare` + `--disable-slash-commands`) and the two honest costs that come
 *      with it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// REAL — every one of these is an existing exported function this session read directly.
import { defaultSpawnAgent } from './dispatch-lane-io.mjs';
import { tryReadDeliveryReport } from './delivery-report-store.mjs';
import { isStatutePath, isPolicyCorePath } from '../lib/gate-config.mjs';

const REPO_ROOT = new URL('../..', import.meta.url).pathname;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', cwd: REPO_ROOT, ...opts });

/**
 * SKETCH — top-level entry the conveyor's tick would call in place of today's direct `claude --bg` spawn
 * (`we:scripts/operations/dispatch-lane.mjs`'s build-launch branch). One call = one item = one attempt.
 *
 * @param {{ item: string, lane: number, scope: string, sessionSlug: string, attemptTag: string, briefPath: string }} launch
 *   the SAME launch-entry shape `dispatch-lane.mjs` already receives from `planTick`'s `spawnBuilds` list —
 *   this wrapper does not change what feeds it, only what it does with it.
 */
export async function deliverItem(launch) {
  const { item, lane, scope, sessionSlug, attemptTag } = launch;

  // ---- 1. Acquire + claim (REAL CLI surface, verbatim from the live brief's own step 1/2) -----------------
  acquireLane({ lane, sessionSlug, scope, item });
  try {
    claimItem({ item, sessionSlug });

    // ---- 2. Spawn the MINIMAL agent, wait for its structured report (SKETCH) -----------------------------
    const report = await runAgentToCompletion({ item, sessionSlug, lane, attemptTag });

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
    const gate = runGateWithOneRetry({ lane, item, sessionSlug, attemptTag });
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
// 2. Spawn + get the structured report — SKETCH shell over a REAL primitive. `defaultSpawnAgent` (REAL,
//    imported below) blocks via `execFileSync` until its child process exits — the fact this whole
//    no-polling design rests on. `buildAgentArgv` (also REAL, same file) is NOT used here because it
//    hardcodes `--bg` on every branch, which is exactly what would make the call return early and force a
//    poll loop back in; `buildForegroundAgentArgv` below is an un-verified sibling written for this
//    synchronous topology instead — see its own docblock for what's unverified about it.
//
//    FIRM OPERATOR REQUIREMENT: no polling anywhere in this flow, by the agent OR by the wrapper standing in
//    for it. Earlier drafts of this sketch had the wrapper poll the delivery-report sidecar in a loop after a
//    backgrounded (`--bg`) spawn — that is NOT what "push, not poll" means; it is exactly the poll it was
//    supposed to replace, just moved to a different process. The fix below is structural, not a nicer poll:
//    spawn the agent WITHOUT `--bg`, so the parent call does not return until the run is genuinely over.
// ================================================================================================

/**
 * SKETCH. Spawns the minimal-brief agent and BLOCKS until it exits — no separate wait step, because there is
 * nothing left to wait for once the blocking call itself returns. This is the wrapper side of true push (a
 * firm operator requirement on #3627, not the earlier "wrapper polls instead of the agent" draft): the AGENT
 * never polls anything — it runs once, reports once, and exits — and neither does the WRAPPER; the single
 * blocking call below IS the wait, and it costs nothing extra because this process was already going to sit
 * idle for exactly as long as the agent's run takes, poll loop or not.
 */
async function runAgentToCompletion({ item, sessionSlug, lane, attemptTag }) {
  const briefTemplate = readFileSync(`${REPO_ROOT}/skills-src/conveyor/delivery-agent-brief-v2.md`, 'utf8');
  const prompt = fillMinimalBrief(briefTemplate, { item, sessionSlug, lane, attemptTag }); // SKETCH — see below

  // FIRM OPERATOR REQUIREMENT, applied here: true push, not "the wrapper polls instead of the agent". The
  // agent's own CLI process, run WITHOUT `--bg`, is a single blocking call from the wrapper's point of view —
  // `execFileSync` (inside `defaultSpawnAgent`, REAL) does not return until the WHOLE agentic run has ended
  // (the agent wrote its `done` report and its own process exited). That return IS the notification; there is
  // no separate channel to poll and nothing to check in a loop. `--bg` exists in `buildAgentArgv` ONLY because
  // `dispatch-lane.mjs` itself must return quickly to plan its NEXT lane in the same tick — this wrapper has no
  // such constraint (it is already the thing the conveyor backgrounds, one per item), so it can let the child
  // run to its own natural completion and simply resume executing the next line once it does.
  //
  // SKETCH gap, stated plainly: `buildAgentArgv` (REAL, imported above) hardcodes `--bg` on every branch — it
  // was built for the always-background dispatch topology. A real implementation needs either a foreground
  // variant of it (drop `--bg`, keep `--session-id`/`--append-system-prompt-file`) or a new sibling builder;
  // `buildForegroundAgentArgv` below is that sibling, written from the same flag set but NOT itself verified
  // against the real CLI the way `buildAgentArgv` was (I read its output shape, not its argv-parsing code).
  const argv = buildForegroundAgentArgv({ sessionId: sessionSlug, payload: prompt, systemPromptFile: null });
  defaultSpawnAgent(argv, {}); // BLOCKS here until the agent's own run ends — this line is the only "wait".

  const report = tryReadDeliveryReport(sessionSlug);
  if (!report || report.status !== 'done') {
    // The agent's process exited without ever sending a `done` report — a crash, per #3436's own precedent.
    // Nothing to poll for: the process is gone, so there is nothing further to wait on. This is itself a
    // result the wrapper acts on (treat as `blocked`, surface literally), never a reason to start waiting.
    throw new Error(`deliver-item-wrapper: agent for ${sessionSlug} exited with no done report (crash or refused effect)`);
  }
  return report;
}

/**
 * SKETCH shell over a REAL, VERIFIED flag: `--bare`. NOT the real `buildAgentArgv` (that function is REAL but
 * `--bg`-only, see the comment above) — a foreground sibling, same flags minus `--bg`, so the parent's
 * `execFileSync` genuinely blocks for the run's full duration instead of returning the instant a background
 * daemon forks. `-p`/`--session-id` are the real, documented flags; their exact interaction with `--bare`
 * here is NOT independently verified against the CLI's own argv parser — flagged rather than asserted.
 *
 * THE PERSONAL/PROJECT-CLAUDE.MD LEAK — INVESTIGATED, NOT ASSUMED. Ran `claude --help` directly against this
 * machine's installed CLI (v2.1.266) to check: does `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv`
 * (the REAL function `dispatch-lane.mjs` calls today) suppress `~/.claude/CLAUDE.md` / project `CLAUDE.md` /
 * skill auto-discovery for a spawned agent? Read its full body — it does NOT: the `--bg` branch passes only
 * `--session-id`/`-n`/`--append-system-prompt-file`, none of which touch CLAUDE.md loading, hooks, or skill
 * discovery. So TODAY, every dispatched delivery agent — including under the LIVE 527-line brief, not just a
 * hypothetical v2 — auto-loads the operator's personal `~/.claude/CLAUDE.md` (timezone, response-format,
 * planning-style preferences meant for interactive collaboration, not an autonomous build) and this repo's own
 * `we:CLAUDE.md` → `we:AGENTS.md` → `we:docs/agent/*.md` doctrine chain, plus the full project
 * `.claude/skills/` auto-discovery listing, exactly like this interactive session does. This is a REAL,
 * confirmed gap in the CURRENT system, not a v2-only concern.
 *
 * `claude --help`'s own `--bare` entry is the fix, and it is a REAL flag on the installed CLI, verbatim:
 * "Minimal mode: skip hooks, LSP, plugin sync, attribution, auto-memory, background prefetches, keychain
 * reads, and CLAUDE.md auto-discovery. Sets CLAUDE_CODE_SIMPLE=1. ... Skills still resolve via /skill-name.
 * Explicitly provide context via: --system-prompt[-file], --append-system-prompt[-file], --add-dir (CLAUDE.md
 * dirs), --mcp-config, --settings, --agents, --plugin-dir." Paired with `--disable-slash-commands` (also REAL
 * — "Disable all skills") as defense in depth, so even a brief that accidentally NAMES a skill can't invoke
 * one: this agent's entire world becomes the prompt text below plus whatever `--add-dir`/`--mcp-config` are
 * explicitly given (neither is given here — no MCP servers, no extra dirs — on purpose, per the operator's
 * "literally nothing about how the mechanical system works" requirement).
 *
 * TWO HONEST COSTS OF `--bare`, NOT PAPERED OVER:
 *   1. `--bare` ALSO skips hooks — so `we:scripts/guard-bash.mjs`'s general safety nets (destructive-git-op
 *      protection, the `main`-push block, etc.) would be OFF for this session, not just the lane-mechanics
 *      awareness this design wants removed. `--bare`'s own help text says a caller may still layer in
 *      "context" via `--settings <file-or-json>` — a real, documented flag independent of `--bare` — which
 *      *could* reinstate JUST a `PreToolUse(Bash)` hook pointing at `guard-bash.mjs` without reintroducing
 *      CLAUDE.md/memory/skills. I did NOT verify the exact settings-JSON hook schema well enough to write that
 *      injection correctly here — flagged as a real open task for whoever wires this in, not asserted as done.
 *   2. `--bare`'s own text states plainly: "Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper via
 *      --settings (OAuth and keychain are never read)." If today's dispatched sessions currently authenticate
 *      via an interactive OAuth/keychain session (not independently confirmed either way in this sketch),
 *      switching to `--bare` requires `ANTHROPIC_API_KEY` (or an `apiKeyHelper`) to be available in whatever
 *      environment spawns this wrapper — a real prerequisite to check before this is ever wired in, not an
 *      assumption to build on.
 */
function buildForegroundAgentArgv({ sessionId, payload, systemPromptFile = null, resumeSessionId = null }) {
  const BARE_FLAGS = ['--bare', '--disable-slash-commands'];
  if (resumeSessionId) return [...BARE_FLAGS, '--resume', String(resumeSessionId), payload];
  return [
    ...BARE_FLAGS,
    '-p', '--session-id', String(sessionId),
    ...(systemPromptFile ? ['--append-system-prompt-file', String(systemPromptFile)] : []),
    payload,
  ];
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
function runGateWithOneRetry({ lane, item, sessionSlug, attemptTag }) {
  const lanePath = resolveLanePath(lane); // PLACEHOLDER — lane number → clone path lookup, real form TBD
  try {
    run('node', ['scripts/verify-lane.mjs', '--json'], { cwd: lanePath });
    return { status: 'green', lanePath };
  } catch (firstFailure) {
    const failureOutput = String(firstFailure.stdout || firstFailure.message || '');
    resumeAgentWithGateFailure({ sessionSlug, lane, failureOutput }); // SKETCH — see below
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
 *  BLOCKS (same `defaultSpawnAgent`/`execFileSync` reasoning as `runAgentToCompletion`) until that new turn
 *  itself ends, so the caller (`runGateWithOneRetry`) can safely read the agent's fresh report the very next
 *  line with no loop of its own either. Real `buildAgentArgv`'s own `resumeSessionId` branch hardcodes `--bg`
 *  (built for the always-background dispatch topology); `buildForegroundAgentArgv`'s `resumeSessionId` branch
 *  is the un-verified foreground sibling used here instead, for the same reason `runAgentToCompletion` needed
 *  one for the initial spawn. */
function resumeAgentWithGateFailure({ sessionSlug, lane, failureOutput }) {
  const prompt = `Your gate failed:\n\n${failureOutput}\n\nFix it in $LANE, commit again, then send a fresh `
    + `\`done\` report exactly as before.`;
  const argv = buildForegroundAgentArgv({ sessionId: sessionSlug, payload: prompt, resumeSessionId: sessionSlug });
  defaultSpawnAgent(argv, {}); // BLOCKS until the resumed turn itself ends — the fresh report is ready right after.
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
