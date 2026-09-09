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
 *      project's `.claude/skills/` auto-discovery listing too. See `CLAUDE_RESTRICTED_PROVIDER` below for the
 *      concrete, VERIFIED mechanism (`--restricted` + an explicit `--tools` allowlist + `--strict-mcp-config`
 *      + `--disable-slash-commands` + a TRIMMED `--settings` file carrying ONLY `guard-lane.mjs`/
 *      `guard-bash.mjs`). A PRIOR revision of this file used `--bare` for this, then a REAL prerequisite gap
 *      surfaced (`--bare` requires `ANTHROPIC_API_KEY`/`apiKeyHelper` — it never reads the keychain, so it
 *      cannot ride the operator's own OAuth/subscription auth). The FIRST replacement candidate, `--safe-mode`,
 *      was independently smoke-tested (not just help-text-read) and FAILED the safety-hooks requirement: a
 *      `--settings=<hooks file>` layered on top of `--safe-mode` never fires — confirmed by running a real
 *      denied command (a hand-set git-commit identity override, which `guard-bash.mjs` denies) through
 *      `claude --safe-mode --settings=<real hooks file> -p ...` and observing it actually EXECUTE (git ran
 *      for real and failed only because nothing was staged — `permission_denials: []`, no hook fired) where
 *      the identical command under `--restricted --tools=<allowlist> --settings=<same file>` was correctly
 *      BLOCKED with `guard-bash.mjs`'s own deny text. `--restricted`'s own `claude --help` text is the reason:
 *      it explicitly documents "managed settings and --settings still apply", where `--safe-mode`'s help text
 *      lists hooks among the customizations it disables and makes no such carve-out for `--settings`. See
 *      `CLAUDE_RESTRICTED_PROVIDER`'s own docblock below for the full verification trail (auth-without-a-key,
 *      hooks-firing, and `--resume`, each independently re-run against the real CLI, not assumed from a single
 *      earlier text-only probe).
 *   6. PROVIDER PARITY — the minimal-context spawn mechanism must be a swappable PORT, not Claude-CLI flags
 *      hardcoded into this file's core control flow, mirroring the SAME provider-port pattern already
 *      extracted for `we:scripts/operations/dispatch-lane-io.mjs`'s dispatcher seam (#3579, `provider` param
 *      on `createDispatchSinks`) and `we:scripts/operations/cli-adapter.mjs`'s judge seam (#3370,
 *      `createDefaultJudge`'s injected implementation) — both landed, both real. Applied here: see
 *      `DeliveryAgentProvider` below — `CLAUDE_RESTRICTED_PROVIDER` is the REAL, Claude-verified implementation;
 *      `CODEX_PROVIDER` is a NAMED SEAM ONLY, deliberately left throwing, because this session has NOT
 *      independently verified Codex CLI's actual flags for minimal-context spawning or whether it has any
 *      hook-equivalent at all — inventing those flags here would be worse than leaving the gap explicit.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// REAL — every one of these is an existing exported function this session read directly.
import { defaultSpawnAgent, findItem, defaultLoadItems } from './dispatch-lane-io.mjs';
import { fillBrief } from './dispatch-lane.mjs';
import { tryReadDeliveryReport } from './delivery-report-store.mjs';
import { isPolicyCorePath } from '../lib/gate-config.mjs';
import { isStatutePath, scoreEscalation, producerReviewLabel } from '../lib/review-escalation.mjs';

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
//    `--restricted`'s own help text says explicitly that "managed settings and `--settings` still apply" even
//    though it "ignores user, project and local settings files" — and unlike an earlier draft's `--bare`
//    (which makes the same textual claim but was never checked against a real denied command), THIS claim was
//    checked for real: a command `guard-bash.mjs` denies, run through `--restricted --settings=<this file>`,
//    came back blocked with the hook's own deny text; the SAME command through `--safe-mode --settings=<this
//    file>` did NOT — it executed for real (see `CLAUDE_RESTRICTED_PROVIDER`'s own docblock below for the full
//    trail). So `--restricted --settings=<this file>` is REAL and VERIFIED as a combination, not a guess:
//    `--restricted` (plus the explicit `--tools` allowlist and `--strict-mcp-config` the provider below also
//    passes) strips CLAUDE.md/skill-discovery/stray-MCP-surface down to nothing, and this file re-adds ONLY
//    the two safety hooks, nothing else — no memory, no doctrine, no skill discovery leaks back in through the
//    settings layer.
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
 *   REQUIREMENT 6, provider parity). Defaults to `CLAUDE_RESTRICTED_PROVIDER`, the only real implementation today;
 *   pass `DELIVERY_AGENT_PROVIDERS.codex` once that provider is actually built. Threaded through unchanged to
 *   every call that spawns or resumes the agent (`runAgentToCompletion`, `runGateWithOneRetry` →
 *   `resumeAgentWithGateFailure`) — nothing else in this function's control flow is provider-specific.
 */
export async function deliverItem(launch, provider = CLAUDE_RESTRICTED_PROVIDER) {
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
    const parkDecision = decideParkMode({ report, convergeVerdict, filesTouched: report.filesTouched, lanePath: gate.lanePath });

    // ---- 6. Open the PR through the SAME canonical producer the live brief already uses — REAL CLI surface,
    // verbatim from the live brief's own step 8. `openPr` is a PURE function of its params (no hidden
    // `findItem`/backlog-loader dependency of its own) — the item's REAL slug is resolved ONCE, here, the SAME
    // way `resolveItemSpecPathBasename` resolves it for the brief, and passed straight through. -----------------
    const foundForPr = findItem(String(item), () => defaultLoadItems(REPO_ROOT));
    if (!foundForPr) {
      throw new Error(`deliver-item-wrapper: could not resolve a slug for item #${item} — findItem returned nothing`);
    }
    const prResult = openPr({ item, attemptTag, lane: gate.lanePath, park: parkDecision, report, slug: foundForPr.slug });

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

// #3627 follow-up — raw script call, not routed through `run.mjs`: no `lane-pool` operation is registered
// yet (`we:scripts/operations/registry.mjs` has no `acquire`/`release` declaration for lane-pool at all —
// unlike `claim`/`verify`/`open-pr`, which do exist and are what `claimItem`/`runGateWithOneRetry`/`openPr`
// route through in this file). Would need one built first (see #3627 follow-up) before this could move off
// the raw `scripts/lane-pool.mjs` CLI — out of scope for this hardening pass; not built here.
/** REAL. Same flags the live brief's step 1 documents. */
function acquireLane({ lane, sessionSlug, scope, item }) {
  run('node', [
    'scripts/lane-pool.mjs', 'acquire', `--lane=${lane}`, '--purpose=conveyor-delivery',
    `--session=${sessionSlug}`, `--scope=${scope}`, `--item=${item}`, '--adopt',
  ]);
}

/**
 * REAL — routed through the DECLARED `claim` operation (`scripts/operations/claim.mjs`, wired into
 * `run.mjs`) instead of a raw `backlog.mjs claim` shell-out (#3627 follow-up: `run.mjs <op>` is the
 * sanctioned, OS-agnostic, traceable interface for a mechanical caller — `openPr` below already does this
 * for `open-pr`). Exported, and takes an injectable `run` (mirrors `resolveLanePath`/`openPr`'s own
 * pattern), for the same "argv IS the contract" reason those are.
 *
 * THE REAL INPUT SCHEMA (read from `claimOperation` in `claim.mjs`, not guessed): `ref` (required string),
 * `as` (optional, default `'active'`, enum `active|preparing`), `force` (optional boolean, default `false`).
 * THERE IS NO `session` FIELD. The `--session` bookkeeping the raw `backlog.mjs claim` CLI does around this
 * SAME operation — the gate-attribution claims-registry baseline (`recordClaim`), the reservation-clear-on-
 * claim, `recordCliTouch`, and the background/stop-for-rename UX — all live in `backlog.mjs`'s OWN
 * `claimViaOperation` wrapper AROUND the operation, never in the operation itself, so none of it is reachable
 * through `run.mjs claim`. `sessionSlug` is accepted here only so the caller's shape is unchanged and is
 * deliberately not forwarded — this pipeline's own gate call (`runGateWithOneRetry` → `run.mjs verify`) does
 * not use claims-registry scoping either, so nothing this delivery flow depends on is lost by the omission,
 * but it IS a real behavioral difference from a raw `backlog.mjs claim --session=…` call and is called out
 * here rather than silently dropped.
 */
export function claimItem({ item, sessionSlug }, { run: runFn = run } = {}) {
  void sessionSlug; // accepted, not forwarded — see the docblock above for why.
  runFn('node', ['scripts/operations/run.mjs', 'claim', `--ref=${item}`, '--json']);
}

// #3627 follow-up — both calls below are raw script calls, not routed through `run.mjs`: `release` has no
// registered operation (only `claim`, its OPEN, is declared — `resolve`/`scaffold` exist but neither is
// `release`) and `lane-pool` has no registered operation at all (same gap `acquireLane` notes above). Would
// need one — or two — built first (see #3627 follow-up); out of scope for this hardening pass.
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
 * CLAUDE_RESTRICTED_PROVIDER — the REAL, INDEPENDENTLY-VERIFIED implementation of {@link DeliveryAgentProvider}.
 * This revision REPLACES an earlier `--bare`-based draft (`CLAUDE_BARE_PROVIDER`); see below for exactly why,
 * with evidence, not assertion — this file has already been burned once by an unverified assumption about
 * flag interaction, so every claim here was re-run against the real CLI (v2.1.266) immediately before writing
 * it in, several of them TWICE (once to confirm the defect, once against the fix).
 *
 * WHY NOT `--bare` (the previous draft). `--bare`'s own help text: "Anthropic auth is strictly
 * ANTHROPIC_API_KEY or apiKeyHelper via --settings (OAuth and keychain are never read)." Confirmed on this
 * machine: no `ANTHROPIC_API_KEY` and no `apiKeyHelper` configured — every dispatched sessions today
 * authenticates via the operator's own OAuth/subscription login, which `--bare` cannot use at all. Switching
 * to `--bare` would require provisioning a separate, real, pay-per-token API key with no such budget line
 * today — a genuine added cost, not a config nit.
 *
 * WHY NOT `--safe-mode` either (the FIRST replacement candidate — REJECTED after real testing, not on the
 * operator's earlier text-only smoke test). `--safe-mode`'s own help text: "Start with all customizations
 * (CLAUDE.md, skills, plugins, hooks, MCP servers, custom commands and agents, output styles, workflows,
 * custom themes, keybindings, and more) disabled ... Admin-managed (policy) settings still apply." Unlike
 * `--bare`'s help text (which explicitly lists `--settings` among what may be layered back on top),
 * `--safe-mode`'s text makes NO such carve-out for an ad-hoc `--settings` file — only "admin-managed (policy)"
 * settings, a fixed system location this file never writes to. That reading was CONFIRMED empirically, not
 * left as a documentation ambiguity: ran a command `we:scripts/guard-bash.mjs` denies for real — a hand-set
 * git-commit identity override (`git commit --author=...`), which the deny table blocks with a named reason
 * — through `claude --safe-mode --settings=<the real ensureDeliveryHooksSettingsFile() output> -p ...`
 * (`ANTHROPIC_API_KEY` unset in the test shell). The command EXECUTED — `git` ran for real and only failed
 * because nothing was staged (`no changes added to commit`); `permission_denials` in the JSON result was
 * `[]`. No hook fired. This is exactly the gap the operator's OWN earlier smoke test could not have caught: it
 * used a pure-text prompt that never invoked the Bash tool at all, so it verified auth and nothing else. A
 * `--safe-mode` swap would have fixed auth while SILENTLY dropping `we:scripts/guard-lane.mjs`/
 * `we:scripts/guard-bash.mjs` protection entirely — destructive-git-op guard, the `main`-push block, lane
 * ownership — for every delivery agent it spawned, which is a regression, not a fix.
 *
 * THE ACTUAL FIX: `--restricted`. Its own help text: "removes the built-in tools that run commands or code
 * (Bash, PowerShell, REPL and the other code-running tools) and WebFetch unless `--tools` names them, and
 * ignores user, project and local settings files (**managed settings and `--settings` still apply**; add
 * `--strict-mcp-config` to skip MCP servers too)." That explicit `--settings`-still-applies carve-out is
 * exactly what `--safe-mode` lacked, and it was CONFIRMED to hold for hooks specifically, not just read from
 * the help text: the identical denied git-commit-identity-override command, run through
 * `claude --restricted --tools=Bash,Edit,Write,Read,Glob,Grep --strict-mcp-config --disable-slash-commands
 * --settings=<same real hooks file> -p ...` (again `ANTHROPIC_API_KEY` unset), came back BLOCKED with
 * `guard-bash.mjs`'s own deny text verbatim. A second, POSITIVE-path run of an undenied command
 * (`` `echo test` ``) through the same argv returned its real output (`` `test` ``) — confirming the hook
 * layer does not over-block ordinary commands either.
 *
 * `--tools` IS REQUIRED EXPLICITLY — verified, not assumed: `--restricted --tools=default` still reported "no
 * shell tool available" for a Bash request (`"default"` does not restore what `--restricted` removed); only a
 * literal tool-name allowlist does. `Bash,Edit,Write,Read,Glob,Grep` is the set this wrapper's agent actually
 * needs (build + report); extend it here, in one place, if a future brief needs more.
 *
 * `--strict-mcp-config` closes a DIFFERENT leak `--restricted` alone does NOT: without it, a `--restricted`
 * session still surfaced this operator's own personal MCP tool defs (Gmail/Calendar/Drive) in the agent's
 * tool list — `--restricted`'s own help text says as much ("add `--strict-mcp-config` to skip MCP servers
 * too"). With it, a follow-up probe asking the agent to list every skill/tool it could see in context showed
 * none of that — no skill names, no slash-command list, no personal MCP surface, and (separately probed) no
 * CLAUDE.md/AGENTS.md content either (confirmed by asking the agent directly whether either was loaded; it
 * reported neither was, and could only quote their contents after reading them itself, on request, via Bash —
 * i.e. a deliberate read it performed, not auto-loaded context). `--disable-slash-commands` ("Disable all
 * skills") is KEPT as defense in depth: `--restricted`'s own help text, unlike `--safe-mode`'s, never mentions
 * skills at all, so unlike under `--safe-mode` (where the two flags plausibly overlapped completely) this flag
 * is doing real, independent, unverified-to-be-redundant work here — cheap to keep, not proven safe to drop.
 *
 * `--resume` UNDER THIS COMBINATION — independently verified, not assumed from the `--bare` draft's own
 * unresolved flag. Started a real session with `-p --session-id <uuid>`, then resumed it with the FULL
 * `--restricted`/`--tools`/`--strict-mcp-config`/`--disable-slash-commands`/`--settings` argv plus
 * `--resume <same uuid>` and a fresh prompt (no `-p` in the resume branch, matching the code below) — it
 * returned the SAME `session_id` in its result (a genuine resume, not a fresh session), completed with no
 * hang despite the missing `-p` (this CLI treats non-TTY/redirected stdout as non-interactive on its own,
 * confirmed by inspecting `claude --help`'s own note on `-p`/print mode), and — run a second time with a
 * denied command instead of a benign one — the hook STILL fired on the resumed turn. All three (auth without
 * a key, hooks firing, `--resume` preserving both) hold for this exact argv, not inferred from the fresh-spawn
 * case alone.
 */
/** The tool allowlist `--restricted` needs handed back explicitly (verified: `--tools=default` does NOT
 *  restore what `--restricted` removes — a probe asking for a Bash call under `--tools=default` came back
 *  "no shell tool available"). This is exactly what this wrapper's agent needs to build + report; extend it
 *  here, in the one place, if a future brief needs more. */
const RESTRICTED_PROVIDER_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep';

/**
 * PURE argv builder for {@link CLAUDE_RESTRICTED_PROVIDER}, exported for the same reason
 * `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv` is: "the argv IS the contract with the CLI and
 * a test that asserts it is the only thing standing between a flag rename and a silent non-dispatch." No
 * `-p` in the resume branch — verified, not a bug: a real `--resume <uuid> "<prompt>"` run with redirected
 * (non-TTY) stdout and no `-p` completed as a clean headless turn and returned the SAME `session_id`, because
 * this CLI treats non-interactive stdout as non-interactive on its own (see `CLAUDE_RESTRICTED_PROVIDER`'s
 * own docblock for the full verification trail).
 */
export function buildRestrictedProviderArgv({ sessionId, prompt, resumeSessionId = null, settingsFile }) {
  const RESTRICTED_FLAGS = [
    '--restricted', '--tools', RESTRICTED_PROVIDER_TOOLS, '--strict-mcp-config',
    '--disable-slash-commands', '--settings', settingsFile,
  ];
  return resumeSessionId
    ? [...RESTRICTED_FLAGS, '--resume', String(resumeSessionId), prompt]
    : [...RESTRICTED_FLAGS, '-p', '--session-id', String(sessionId), prompt];
}

const CLAUDE_RESTRICTED_PROVIDER = {
  name: 'claude-restricted',
  spawn({ sessionId, prompt, resumeSessionId = null }) {
    const settingsFile = ensureDeliveryHooksSettingsFile();
    const argv = buildRestrictedProviderArgv({ sessionId, prompt, resumeSessionId, settingsFile });
    // #3627 hardening — stamp `WE_DISPATCH_KIND=delivery` onto the agent's own process env. Every hook that
    // fires inside the agent's own Bash tool calls inherits this (the same inheritance
    // `we:scripts/guard-bash.mjs`'s #3105 arm already relies on for a mechanically-dispatched build/fix/
    // ci-heal agent), and `guard-bash.mjs` now reads it to deny the delivery agent from ever running the
    // mechanical lifecycle commands this wrapper drives itself (lane-pool/backlog-claim/gh-pr/open-pr/
    // pr-land/learnings-drop/converge-cli/verify-lane/review-core-cli — see guard-bash.mjs's own #3627 arm).
    // REUSES the existing `WE_DISPATCH_KIND` channel rather than inventing a second session-type signal — but
    // note nothing else in this repo stamps that var onto a real spawn yet (the build/fix/ci-heal emitter side
    // in `dispatch-lane-io.mjs` is a separate, not-yet-landed graduation, #3488); this is the first live
    // caller of it, scoped to only this spawn.
    defaultSpawnAgent(argv, { env: { ...process.env, WE_DISPATCH_KIND: 'delivery' } }); // BLOCKS — the only "wait".
  },
};

/**
 * CODEX_PROVIDER — A NAMED SEAM ONLY, deliberately NOT implemented (per operator follow-up: provider parity
 * must be an architectural requirement now, even where this session cannot verify a second CLI's real
 * mechanism yet). What is genuinely UNRESEARCHED, stated plainly rather than guessed at: Codex CLI's actual
 * flags (if any) for a minimal-context, no-project-doctrine, no-auto-memory, hooks-still-active spawn
 * equivalent to Claude's `--restricted` (+ `--tools`/`--strict-mcp-config`/`--settings`) combination;
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
      + 'own minimal-context/no-auto-memory spawn flags (the --restricted equivalent), whether it has any '
      + 'hook-equivalent enforcement mechanism (the guard-lane.mjs/guard-bash.mjs equivalent), and whether it '
      + 'supports a blocking/foreground invocation this wrapper\'s spawn contract can rely on. This is the '
      + 'named PORT (see DeliveryAgentProvider), not a guess at Codex\'s actual mechanism — see this '
      + 'function\'s own docblock.',
    );
  },
};

/** The provider registry — swap which CLI a delivery agent runs under by changing which key `deliverItem`
 *  is called with (default `'claude-restricted'`), never by editing this file's control flow. */
export const DELIVERY_AGENT_PROVIDERS = Object.freeze({
  'claude-restricted': CLAUDE_RESTRICTED_PROVIDER,
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
async function runAgentToCompletion({ item, sessionSlug, lane, attemptTag, provider = CLAUDE_RESTRICTED_PROVIDER }) {
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

/**
 * REAL (was PLACEHOLDER) — the v2 brief's ONLY placeholder (`{{ITEM_SPEC_PATH_BASENAME}}`,
 * `we:skills-src/conveyor/delivery-agent-brief-v2.md`) is a name `dispatch-lane.mjs`'s own
 * {@link BRIEF_PLACEHOLDERS} has never heard of — this fill does not need it to have: {@link fillBrief}'s
 * substitution branch keys on `requiredNames.includes(name)` for the EXACT-SPELLING match, never on the wider
 * canonical/misspelling table, so a v2-only name substitutes correctly through the SAME function every other
 * kind's fill already trusts. This is the fix the file's own prior docblock named: "real placeholder
 * substitution would reuse `dispatch-lane.mjs#fillBrief` against a v2-specific required-names list, not a
 * hand-rolled replace" — done exactly that way, not a second `String#replaceAll`.
 */
const V2_BRIEF_REQUIRED_NAMES = Object.freeze(['ITEM_SPEC_PATH_BASENAME']);
const V2_BRIEF_OPTIONAL_NAMES = Object.freeze([]);

/**
 * The item's own backlog filename basename (`we:backlog/<num>-<slug>.md`'s `<num>-<slug>.md`), resolved the
 * SAME way `we:scripts/operations/dispatch-lane-io.mjs#findItem` already resolves `ITEM_SPEC_PATH` for every
 * other launch kind — never a second, hand-rolled lookup. `loadItems` is injectable (mirrors `findItem`'s own
 * signature) so a test can hand this a synthetic backlog without touching `src/_data/backlog.js`.
 */
export function resolveItemSpecPathBasename(item, loadItems = () => defaultLoadItems(REPO_ROOT)) {
  const found = findItem(String(item), loadItems);
  if (!found) {
    throw new Error(`deliver-item-wrapper: could not resolve a backlog filename for item #${item} — findItem returned nothing`);
  }
  return found.specPath.split('/').pop();
}

/** REAL. Substitutes the v2 brief's ONE placeholder through `fillBrief`, then appends the same env footer the
 *  sketch already carried (not a placeholder — this repo has no shared "env footer" convention to reuse; it is
 *  plain text outside the brief's own template, never itself a `{{TOKEN}}`). */
export function fillMinimalBrief(template, { item, sessionSlug, lane, attemptTag }, { loadItems } = {}) {
  const basename = resolveItemSpecPathBasename(item, loadItems);
  const { prompt } = fillBrief(template, { ITEM_SPEC_PATH_BASENAME: basename }, V2_BRIEF_REQUIRED_NAMES, V2_BRIEF_OPTIONAL_NAMES);
  return `${prompt}\n\n[env: DELIVERY_SESSION=${sessionSlug} DELIVERY_ITEM=${item} LANE=${lane} ATTEMPT_TAG=${attemptTag ?? ''}]`;
}

// ================================================================================================
// 3. The gate — REAL insight, REAL call (#3627 follow-up graduated this from a raw `verify-lane.mjs` shell-out
//    to the declared `verify` operation — see `runVerifyOperation` below). The load-bearing claim is
//    unchanged: `we:scripts/guard-bash.mjs`'s verification-set deny is a `PreToolUse(Bash)` HOOK — it only
//    fires inside a live Claude Code session's OWN tool calls. This wrapper is a plain Node process the
//    conveyor runs; it is not a Claude Code session and has no Bash TOOL calls for any hook to intercept, so
//    it can run the gate SYNCHRONOUSLY and just block for the 150-350s it takes — no `request`/`check` split,
//    no polling, at all. This is the single biggest concrete win the #3621 push-not-poll idea buys here: the
//    request→poll dance in the live brief's steps 5/8 exists ONLY because the agent's own tool call is what's
//    constrained; a wrapper process was never subject to that constraint to begin with.
// ================================================================================================

/**
 * REAL — routed through the DECLARED `verify` operation (`scripts/operations/verify.mjs`, wired into
 * `run.mjs`) instead of a raw `verify-lane.mjs --json` shell-out (#3627 follow-up: `run.mjs <op>` is the
 * sanctioned, OS-agnostic, traceable interface — `openPr` above already does this for `open-pr`).
 *
 * THE REAL INPUT SCHEMA (read from `verifyOperation` in `verify.mjs`, not guessed): `checkout` (required
 * string — the tree to verify; NOT `cwd`, which is the adapter's own control flag for a tool-bearing juror's
 * lane and would collide), `mode` (optional, default `'run'`, enum `run|check`), `gate` (optional string,
 * the suite command forwarded to the home's own `--gate`; empty means the home's default).
 *
 * UNLIKE THE RAW HOME, THE EXIT CODE DOES NOT CARRY THE VERDICT. `verify-lane.mjs --json` exits 2 on a red
 * gate, which is what let the old `try`/`catch` around `runFn` stand in for "did it pass". The `verify`
 * OPERATION is a `compute`-only declaration with no `confirm`/`judge`, so it reports `stopped: 'complete'`
 * (exit 0) whenever it successfully RAN the checks, red or green — a red gate is a successfully completed
 * verdict, not a failed run. So `runVerifyOperation` below reads `verdict.ok` out of the `--json` envelope
 * instead of relying on `runFn` throwing.
 */
function runVerifyOperation(lanePath, { run: runFn = run } = {}) {
  let out;
  try {
    out = runFn('node', ['scripts/operations/run.mjs', 'verify', `--checkout=${lanePath}`, '--json']);
  } catch (e) {
    // A non-zero exit here means the OPERATION itself could not complete (a refusal/crash), not a red gate —
    // still `unrun`-shaped, not a `pass`, so this correctly reads as not-ok.
    return { ok: false, detail: String(e.stdout || e.message || e) };
  }
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch {
    return { ok: false, detail: String(out) };
  }
  const verdict = parsed.verdict || {};
  if (verdict.ok === true) return { ok: true, detail: null };
  return { ok: false, detail: JSON.stringify(verdict.blocking ?? verdict, null, 2) };
}

/** One resume-and-retry, not an unbounded loop — mirrors the live brief's own "red gate is a hard stop" bar,
 *  but gives the agent exactly one chance to fix ITS OWN gate failure before that stop applies, since a
 *  transient/self-inflicted red on a fresh diff is common and cheap to hand back once. */
export function runGateWithOneRetry(
  { lane, item, sessionSlug, attemptTag, provider = CLAUDE_RESTRICTED_PROVIDER },
  { run: runFn = run } = {},
) {
  const lanePath = resolveLanePath(lane, { run: runFn });
  const first = runVerifyOperation(lanePath, { run: runFn });
  if (first.ok) return { status: 'green', lanePath };

  resumeAgentWithGateFailure({ sessionSlug, lane, failureOutput: first.detail, provider }); // SKETCH — see below
  const retryReport = tryReadDeliveryReport(sessionSlug); // agent's fresh `done` report after fixing
  const second = runVerifyOperation(lanePath, { run: runFn });
  if (second.ok) return { status: 'green', lanePath, retryReport };
  return { status: 'red', lanePath };
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
function resumeAgentWithGateFailure({ sessionSlug, lane, failureOutput, provider = CLAUDE_RESTRICTED_PROVIDER }) {
  const prompt = `Your gate failed:\n\n${failureOutput}\n\nFix it in $LANE, commit again, then send a fresh `
    + `\`done\` report exactly as before.`;
  provider.spawn({ sessionId: sessionSlug, prompt, resumeSessionId: sessionSlug }); // BLOCKS.
}

/**
 * REAL (was PLACEHOLDER — a hardcoded `${REPO_ROOT}/../.lanes/web-everything/lane-${lane}` computation that
 * only resolved correctly by coincidence when this file happened to be imported from the PRIMARY checkout
 * root; it silently computed the WRONG path when run from an isolated worktree/clone, e.g.
 * `.../webeverything/.claude/worktrees/<name>/scripts/operations/deliver-item-wrapper.mjs` resolving to
 * `.../worktrees/.lanes/web-everything/lane-N` instead of the real pool path). Shells
 * `scripts/lane-pool.mjs status --json` — the SAME single source of truth `we:scripts/lib/lane-pool-paths.mjs`/
 * `verify-lane.mjs` already trust — and reads the `path` field off the entry whose `lane` matches, rather than
 * re-deriving path math a second time (this file's job is shape, not a second copy of that resolution). `run`
 * is injectable (mirrors `computeLaneDiffStats`/`decideParkMode`'s own `{ run }` pattern) so this is testable
 * without a real lane-pool clone on disk.
 */
export function resolveLanePath(lane, { run: runFn = run } = {}) {
  const out = runFn('node', ['scripts/lane-pool.mjs', 'status', '--json']);
  const parsed = JSON.parse(out);
  const rows = Array.isArray(parsed.lanes) ? parsed.lanes : [];
  const found = rows.find((r) => Number(r.lane) === Number(lane));
  if (!found || !found.path) {
    throw new Error(`deliver-item-wrapper: lane-pool.mjs status --json reported no entry/path for lane-${lane}`);
  }
  return found.path;
}

// ================================================================================================
// 4. Converge — REAL LOOP (was SKETCH — a single `step` call mistaken for the whole loop). Verified against
//    `scripts/converge-cli.mjs`'s own source (not assumed): `init`'s action is always `read`; `step` prints
//    `{action, round, roundCap, verdict, outcome, reason, lensVerdicts, findings, dismissed, dialOverrides,
//    invite, ...instruction}`, where `instruction` carries exactly the field the printed `action` needs
//    (`read`/`panel`/`redTeam`/`edit`/`escalation`). This loop executes EVERY action
//    `we:skills-src/converge/SKILL.md`'s action table names and keeps calling `step` — stamped with the
//    `round` it just printed, per the SKILL's own bolded warning — until the action is genuinely `land` or
//    `escalate`, never stopping after the first call.
//
//    WHO RUNS EACH ACTION, AND WHY THAT MATCHES THE SKILL'S OWN INVARIANTS EVEN THOUGH THIS IS A PLAIN NODE
//    PROCESS WITH NO AGENT TOOL:
//      - `read`   — shell the printed `read.command` (verified real: `converge-transports.mjs#readMaterial`
//                    returns `{kind:'shell', command, cwd}` — read directly, not assumed).
//      - `panel` / `red-team` — seat headless jurors through `skills-src/jury/panel-fanout.mjs`, THE SAME shim
//                    the SKILL requires ("never the Agent tool") — this wrapper has no Agent tool to misuse
//                    either way, but the underlying reason (independence is a property of the JUDGE, not of
//                    who launched it) is identical, so the same non-subagent path applies.
//      - `edit`   — the ONE tool-bearing spawn. Goes through THIS FILE's own verified `--restricted` +
//                    hooks-settings argv (see `CLAUDE_RESTRICTED_PROVIDER`'s docblock above), NEVER
//                    `judge-spawn.mjs`'s `--safe-mode` argv — that combination was independently confirmed
//                    elsewhere in this file to drop `guard-lane.mjs`/`guard-bash.mjs` enforcement for a
//                    TOOL-BEARING spawn, which is exactly the protection an editor writing into the lane needs.
//      - `invite` — shell `scripts/review-core-cli.mjs invite` for the growth delta.
//    Every sub-driver takes an injectable `run` (mirrors this file's own `run` helper) so the loop is
//    unit-testable without spawning a real `claude`/`node` child.
// ================================================================================================

const CONVERGE_PANEL_DEPTH = 0; // this wrapper is the top-level driver, never itself a nested panel seat.
const CONVERGE_PANEL_MAX_DEPTH = 2; // `skills-src/converge/SKILL.md`'s own worked `panel-fanout.mjs` example.
const CONVERGE_PANEL_MAX_BUDGET_USD = 8; // same worked example's aggregate ceiling.
// Defensive backstop ONLY. The REAL termination bound is `converge-core.mjs`'s own round cap
// (`deriveNegotiationOutcome`), which guarantees a `land`/`escalate` verdict long before this could fire — if
// it ever does, that is a bug in this loop (or in the core), not a legitimately long real run.
const CONVERGE_MAX_LOOP_STEPS = 200;

function writeJsonFile(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

/**
 * Seat one headless panel over the round's material, through `panel-fanout.mjs` (REAL — verified against that
 * file's own `panelFanout`/`panelJurors` source: payload is `{subject, subjectNoun, round, materialFile,
 * jurors:[{id, lens, mandate}]}`, the result's `seats` array carries `{lens, ok, findings, ...}` per seat).
 *
 * A touch-set perspective lens (`a11y`/`visual-vs-target`/`perf`) that `converge-cli.mjs` seated with a
 * GROUNDING METHOD instead of a mandate (`entry.mandate === null`) is reported `ok:false` with no findings —
 * this wrapper has no browser/vision tooling to run that method, and the SKILL states that is non-blocking for
 * an advisory lens ("the driver runs that tool and reports the lens `ok: false` if it cannot").
 */
function runConvergePanel(panelEntries, { lane, item, round, material, run: runFn, writeFile = writeJsonFile }) {
  const jurors = [];
  const groundingOnly = [];
  for (const entry of panelEntries || []) {
    if (entry.mandate === null) { groundingOnly.push({ lens: entry.lens, ok: false, findings: [] }); continue; }
    for (let slot = 1; slot <= (entry.jurors || 1); slot += 1) {
      jurors.push({ id: `${entry.lens}#${slot}`, lens: entry.lens, mandate: entry.mandate });
    }
  }
  if (!jurors.length) return { lensResults: groundingOnly };
  const materialFile = `${lane}/.converge-material-r${round}.txt`;
  writeFileSync(materialFile, material ?? '');
  const payloadFile = writeFile(`${lane}/.converge-panel-r${round}.json`, {
    subject: 'pr-diff', subjectNoun: 'diff', round, materialFile, jurors,
  });
  // #3627 follow-up — raw script call, not routed through `run.mjs`: no `panel-fanout`/`jury` operation is
  // registered yet. Would need one built first (see #3627 follow-up); out of scope for this hardening pass.
  const out = runFn('node', [
    'skills-src/jury/panel-fanout.mjs', `--payload-file=${payloadFile}`, `--depth=${CONVERGE_PANEL_DEPTH}`,
    `--max-depth=${CONVERGE_PANEL_MAX_DEPTH}`, `--max-total-budget-usd=${CONVERGE_PANEL_MAX_BUDGET_USD}`,
    `--run-id=converge-${item}-r${round}`,
  ]);
  const result = JSON.parse(out);
  const seated = (result.seats || []).map((s) => ({ lens: s.lens, ok: s.ok, findings: s.findings || [] }));
  return { lensResults: [...seated, ...groundingOnly] };
}

/**
 * Ratify (or fail to ratify) the panel's accept — an independent adversary judging the SAME material with no
 * visibility into the panel's own reasoning (#2707). Same shim, a DISTINCT `--run-id` per the SKILL's stated
 * invariant: reusing the panel's run id would mint the red-team the identity of the juror it must be able to
 * contradict.
 */
function runConvergeRedTeam(redTeam, { lane, item, round, material, run: runFn, writeFile = writeJsonFile }) {
  const jury = (redTeam && Array.isArray(redTeam.jury)) ? redTeam.jury : [];
  if (!jury.length) return { ran: false, findings: [] };
  const materialFile = `${lane}/.converge-material-r${round}.txt`;
  writeFileSync(materialFile, material ?? '');
  const jurors = jury.map((j) => ({ id: `${j.lens}#redteam`, lens: j.lens, mandate: j.prompt }));
  const payloadFile = writeFile(`${lane}/.converge-redteam-r${round}.json`, {
    subject: 'pr-diff', subjectNoun: 'diff', round, materialFile, jurors,
  });
  // #3627 follow-up — raw script call, not routed through `run.mjs`: no `panel-fanout`/`jury` operation is
  // registered yet. Would need one built first (see #3627 follow-up); out of scope for this hardening pass.
  const out = runFn('node', [
    'skills-src/jury/panel-fanout.mjs', `--payload-file=${payloadFile}`, `--depth=${CONVERGE_PANEL_DEPTH}`,
    `--max-depth=${CONVERGE_PANEL_MAX_DEPTH}`, `--max-total-budget-usd=${CONVERGE_PANEL_MAX_BUDGET_USD}`,
    `--run-id=converge-${item}-r${round}-redteam`,
  ]);
  const result = JSON.parse(out);
  const findings = (result.seats || []).flatMap((s) => (s.ok ? (s.findings || []) : []));
  return { ran: true, findings };
}

/** PURE. The argv for the converge editor's one-off, tool-bearing, `--output-format json` spawn — a SIBLING of
 *  {@link buildRestrictedProviderArgv}, not a reuse of it: the editor always spawns fresh (never `--resume`,
 *  a converge round is self-contained) and needs `--output-format json` for a parseable reply, which the
 *  delivery-agent argv has no reason to carry. Exported for the same "argv IS the contract" reason
 *  {@link buildRestrictedProviderArgv} is exported. */
export function buildConvergeEditorArgv({ sessionId, prompt, settingsFile }) {
  return [
    '--restricted', '--tools', RESTRICTED_PROVIDER_TOOLS, '--strict-mcp-config', '--disable-slash-commands',
    '--settings', settingsFile, '--output-format', 'json',
    '-p', '--session-id', String(sessionId), prompt,
  ];
}

/**
 * Best-effort parse of the editor's `--output-format json` reply into `{advanced, dismissed}`. Two JSON
 * layers: the CLI's own envelope (`{result: "<the editor's own text>", ...}`), and the editor's own text —
 * the transport's prompt (`converge-transports.mjs#applyRevision`) told it to return PURE JSON. Either layer
 * failing to parse degrades to `{advanced:false, dismissed:[]}` rather than throwing — the SAME fail-closed
 * direction `deriveRoundObservations` already takes for a stalled editor (an unadvanced round escalates; it
 * does not crash the driver). Exported so this degradation is asserted directly, not only through the loop.
 */
export function parseConvergeEditResult(rawOut) {
  try {
    const envelope = JSON.parse(String(rawOut));
    const text = typeof envelope.result === 'string' ? envelope.result : String(rawOut);
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    return {
      advanced: parsed.advanced === true,
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
    };
  } catch {
    return { advanced: false, dismissed: [] };
  }
}

/** Spawn ONE fresh restricted editor session for this round. See the section header above for why this goes
 *  through this file's own `--restricted` argv rather than `judge-spawn.mjs`. */
function runConvergeEdit(editInstruction, { item, round, run: runFn, ensureSettingsFile = ensureDeliveryHooksSettingsFile }) {
  const settingsFile = ensureSettingsFile();
  const sessionId = `${item}-converge-editor-r${round}`;
  const argv = buildConvergeEditorArgv({ sessionId, prompt: editInstruction.prompt, settingsFile });
  const out = runFn('claude', argv);
  return parseConvergeEditResult(out);
}

/** Shell `review-core-cli.mjs invite` for the jury-growth delta (#2640), per the SKILL's `invite` row. A
 *  crashed/unparseable answer reports back as `null` — exactly what the SKILL says to do ("Report
 *  `inviteEcho: null` if the invite agent crashed"), extended here to any answer this driver could not parse. */
function runConvergeInvite(invite, { lane, round, careLevel, seatedLenses, jurorsPerLens, run: runFn, writeFile = writeJsonFile }) {
  const payloadFile = writeFile(`${lane}/.converge-invite-r${round}.json`, {
    careLevel, seatedLenses, jurorsPerLens, invitedLens: invite.lens, citedFinding: invite.citedFinding,
  });
  // #3627 follow-up — raw script call, not routed through `run.mjs`: no `review-core-cli`/`invite` operation
  // is registered yet. Would need one built first (see #3627 follow-up); out of scope for this hardening pass.
  try {
    const out = runFn('node', ['scripts/review-core-cli.mjs', 'invite', `--file=${payloadFile}`, '--json']);
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/**
 * THE LOOP. Drives `converge-cli.mjs` `init` → repeated `step` calls, executing whatever action each call
 * prints, until the action is genuinely `land` or `escalate` — replacing the sketch's single `step` call.
 * `run` is injectable (defaults to this file's own `run`) so the whole loop is testable against a scripted
 * fake CLI without spawning real processes.
 */
export function runConverge({ lane, item, goal }, { run: runFn = run, ensureSettingsFile = ensureDeliveryHooksSettingsFile } = {}) {
  const state = `${lane}/.converge-state.json`;
  // #3627 follow-up — raw script call, not routed through `run.mjs`: no `converge` operation is registered
  // yet. Would need one built first (see #3627 follow-up); out of scope for this hardening pass. Same for the
  // `step` call further down this loop.
  const initOut = JSON.parse(runFn('node', [
    'scripts/converge-cli.mjs', 'init', `--lane=${lane}`, `--state=${state}`, '--care=elevated',
    `--goal=${goal || `deliver item ${item} to spec`}`,
  ]));

  let step = initOut;
  const careLevel = initOut.careLevel;
  let seatedLenses = initOut.seatableLenses || initOut.lenses || [];
  let jurorsPerLens = initOut.jurorsPerLens;
  let material = '';
  let lastLensResults = [];

  for (let i = 0; i < CONVERGE_MAX_LOOP_STEPS; i += 1) {
    if (step.action === 'land' || step.action === 'escalate') return step;

    const obs = { round: step.round };
    if (step.action === 'read') {
      const out = runFn('bash', ['-c', step.read.command], { cwd: step.read.cwd, maxBuffer: 64 * 1024 * 1024 });
      material = out;
      obs.readResult = { material: out };
    } else if (step.action === 'panel') {
      const { lensResults } = runConvergePanel(step.panel, { lane, item, round: step.round, material, run: runFn });
      lastLensResults = lensResults;
      obs.lensResults = lensResults;
      // #2640 juror-invite-on-discovery needs a GROUNDED citation from a tool this wrapper ran — it runs no
      // grounding-method tooling of its own (see `runConvergePanel`'s docblock), so it has nothing to invite
      // on. REAL, not a stub: reporting none here is the honest answer for a driver with no such tool, exactly
      // as a human driver who ran no invite-eligible tool would report none.
      obs.invites = [];
    } else if (step.action === 'red-team') {
      obs.lensResults = lastLensResults;
      obs.redTeamResult = runConvergeRedTeam(step.redTeam, { lane, item, round: step.round, material, run: runFn });
    } else if (step.action === 'edit') {
      obs.editResult = runConvergeEdit(step.edit, { item, round: step.round, run: runFn, ensureSettingsFile });
    } else if (step.action === 'invite') {
      obs.invite = step.invite;
      obs.inviteEcho = runConvergeInvite(step.invite, {
        lane, round: step.round, careLevel, seatedLenses, jurorsPerLens, run: runFn,
      });
    } else {
      throw new Error(`deliver-item-wrapper: converge-cli reported an action this loop does not know how to run: ${JSON.stringify(step.action)}`);
    }

    const obsPath = writeJsonFile(`${lane}/.converge-obs-${step.round}-${i}.json`, obs);
    const stepOut = JSON.parse(runFn('node', ['scripts/converge-cli.mjs', 'step', `--state=${state}`, `--obs=${obsPath}`]));
    if (Array.isArray(stepOut.lenses)) seatedLenses = stepOut.lenses;
    if (Number.isFinite(stepOut.jurorsPerLens)) jurorsPerLens = stepOut.jurorsPerLens;
    step = stepOut;
  }
  throw new Error(
    `deliver-item-wrapper: the converge loop for item #${item} exceeded ${CONVERGE_MAX_LOOP_STEPS} steps `
    + 'without a land/escalate verdict — converge-core\'s own round cap should have terminated it long before '
    + 'this; treat as a bug in this loop (or in converge-core), not as a legitimately long real run.',
  );
}

// ================================================================================================
// 5. Escalation mapping — REAL rubric, REAL glue (was: real imports over a SKETCH two-input stand-in). Wires in
//    the FULL `scoreEscalation` (`we:scripts/lib/review-escalation.mjs`) — diff stats and dismissed-finding
//    count included, not just path-shape — via `producerReviewLabel`, the SAME mapping
//    `we:scripts/pr-land.mjs`'s own producer-time label derivation uses, so this wrapper's park decision agrees
//    with the label a normal `open-pr --mode=label-on-green` PR would have been scored with at open.
// ================================================================================================

/** Real, cheap diff stats for `scoreEscalation`'s `changedFiles`/`diffLines` inputs — the SAME shape
 *  `git diff --numstat` produces, read directly off the lane clone (mirrors `converge-cli.mjs`'s own
 *  `laneChangedFiles`, read above while verifying `runConverge`'s `read` action). `run` is injectable so this
 *  is testable without a real git checkout. Fails soft to an empty/zero reading — a wrapper-side git failure
 *  here must not crash the whole delivery; it just means `scoreEscalation` sees no size/blast-radius signal,
 *  which is the safe direction for a signal that only ever ADDS review capacity, never blocks (#3320). */
export function computeLaneDiffStats(lanePath, { run: runFn = run, baseRef = 'origin/main' } = {}) {
  try {
    const mergeBase = runFn('git', ['-C', lanePath, 'merge-base', 'HEAD', baseRef]).trim();
    const numstat = runFn('git', ['-C', lanePath, 'diff', '--numstat', mergeBase]);
    const changedFiles = [];
    let diffLines = 0;
    for (const line of numstat.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [add, del, ...pathParts] = trimmed.split('\t');
      const path = pathParts.join('\t');
      if (path) changedFiles.push(path);
      const a = Number(add);
      const d = Number(del);
      if (Number.isFinite(a)) diffLines += a;
      if (Number.isFinite(d)) diffLines += d;
    }
    return { changedFiles, diffLines };
  } catch {
    return { changedFiles: [], diffLines: 0 };
  }
}

/**
 * REAL. `touchesStatute` stays as a cheap, explicit up-front check — it is a DIFFERENT rubric surface from
 * `scoreEscalation`'s own statute/leash signal (`isPolicyCorePath`, from `gate-config.mjs`, is not one of
 * `scoreEscalation`'s own terms), so it is kept alongside the full rubric rather than folded into or replaced
 * by it. `report.outcome === 'needs-human-judgment'` and `convergeVerdict.verdict === 'escalate'` are likewise
 * kept as their own forcing reasons: they are signals `scoreEscalation` has no way to know about (the agent's
 * own self-reported call, and converge's own independent-panel verdict), not duplicates of anything it scores.
 * On top of all three, the FULL rubric now runs for real: diff stats read off the lane
 * ({@link computeLaneDiffStats}) plus the round's dismissed-finding count feed `scoreEscalation`, and
 * `producerReviewLabel` — the same function `pr-land.mjs` itself uses — turns its verdict into a label.
 */
export function decideParkMode({ report, convergeVerdict, filesTouched, lanePath, crossRepo = false }, { run: runFn = run } = {}) {
  const touchesStatute = (filesTouched || []).some((f) => isStatutePath(f) || isPolicyCorePath(f));
  if (touchesStatute) return { mode: 'park', label: 'review:human', reason: 'statute/policy-core path touched' };
  if (report.outcome === 'needs-human-judgment') return { mode: 'park', label: 'review:human', reason: report.reason };
  if (convergeVerdict.verdict === 'escalate') return { mode: 'park', label: 'review:human', reason: convergeVerdict.reason };

  const dismissedFindings = Array.isArray(convergeVerdict.dismissed) ? convergeVerdict.dismissed.length : 0;
  const diffStats = lanePath ? computeLaneDiffStats(lanePath, { run: runFn }) : { changedFiles: filesTouched || [], diffLines: 0 };
  const score = scoreEscalation({
    changedFiles: diffStats.changedFiles, diffLines: diffStats.diffLines, dismissedFindings, crossRepo,
  });
  const scoreLabel = producerReviewLabel(score);
  if (scoreLabel) {
    return { mode: 'park', label: scoreLabel, reason: `scoreEscalation: ${score.reasons.join('; ') || 'escalated'}`, score };
  }
  return { mode: 'label-on-green', label: 'ready-to-merge', reason: null, score };
}

// ================================================================================================
// 6/7. PR + learnings — REAL CLI surfaces, lifted verbatim from the live brief's own step 8/9.
// ================================================================================================

/**
 * REAL (was PLACEHOLDER) — `openPr`'s `--bodyFile` names `${lane}/.pr-body.md`, and this is the writer that
 * actually puts a real body there before `openPr` reads it. `open-pr.mjs#planOpen` REFUSES a create with no
 * body (`prCreateBodyGuard`, "the drain gate rejects a bodyless PR at land"), so the ENOENT this file's own
 * honesty label warned about was never merely cosmetic — the very next real run would have thrown here.
 *
 * MINIMAL, ON PURPOSE. `we:scripts/pr-land.mjs#composePrBody` is the FULLER body composer (it also embeds a
 * lane manifest and the #2844 author-actor stamp), but it is scoped to `pr-land.mjs`'s own CLI invocation —
 * it reads `process.argv`/`currentActorId()` at module load, so importing it here would run a second,
 * unrelated CLI's flag parsing as a side effect of this file's own import. `pr-land.mjs` (which `open-pr`
 * shells) applies its OWN author stamp to whatever body it is handed, so this generator does not need to
 * duplicate that half — only the human-readable content pr-land does not invent on its own.
 *
 * The one-line summary is pulled from the delivery agent's own report (`report.reason` — the only prose field
 * {@link DELIVERY_REPORT_VERSION}'s schema carries; optional on a `done` outcome, so a report that supplied
 * none falls back to a generic, still-accurate line rather than an empty body section).
 */
export function buildPrBody({ item, report }) {
  const summary = (report && typeof report.reason === 'string' && report.reason.trim())
    || `Delivers item #${item} per its backlog spec.`;
  const filesLine = (report && Array.isArray(report.filesTouched) && report.filesTouched.length)
    ? `\n\nFiles touched:\n${report.filesTouched.map((f) => `- ${f}`).join('\n')}`
    : '';
  return `## #${item}\n\n${summary}${filesLine}\n\n---\nDelivered by the #3627 minimal delivery-agent pipeline `
    + '(the mechanical wrapper drove review/gate/PR — the agent only built and reported).\n';
}

/** REAL — writes {@link buildPrBody}'s content to the exact path `openPr`'s `--bodyFile` reads, so the file
 *  genuinely exists (with real content) by the time `openPr` runs. `writeFile` is injectable for tests. */
export function writePrBody({ item, lane, report }, { writeFile = writeFileSync } = {}) {
  const bodyFile = `${lane}/.pr-body.md`;
  writeFile(bodyFile, buildPrBody({ item, report }));
  return bodyFile;
}

/** REAL (was PLACEHOLDER — `<slug>` was dead, never-substituted text that would have produced an invalid ref
 *  like `lane/3371-<slug>`). PURE function of its params — deliberately does NOT call `findItem` or import the
 *  backlog loader itself; the caller (`deliverItem`) resolves the item's REAL slug ONCE, the SAME way
 *  `resolveItemSpecPathBasename` resolves it for the brief, and passes it straight through as `slug` (already
 *  the canonical `<num>-<slug>.md` basename's slug half — never re-derived from the title via
 *  `scaffold.mjs#slugFor`). `run` is injectable (mirrors `computeLaneDiffStats`/`decideParkMode`'s own
 *  pattern), so this is testable with no hidden dependency and no real `open-pr` process. Flags otherwise
 *  lifted verbatim from the live brief's step 8, both branches. */
export function openPr({ item, attemptTag, lane, park, report, slug }, { run: runFn = run } = {}) {
  if (!slug) {
    throw new Error(`deliver-item-wrapper: openPr needs the item's real slug for #${item} — never substitutes a literal placeholder`);
  }
  const ref = `lane/${item}${attemptTag ?? ''}-${slug}`;
  const bodyFile = writePrBody({ item, lane, report }); // REAL — was a PLACEHOLDER path nothing wrote.
  const args = [
    'scripts/operations/run.mjs', 'open-pr', `--ref=${ref}`, '--sha=HEAD', '--base=main',
    `--bodyFile=${bodyFile}`, '--requireVerified=true', '--json',
  ];
  args.push(park.mode === 'park' ? `--mode=park` : '--mode=label-on-green');
  if (park.mode === 'park') args.push(`--parkLabel=${park.label}`);
  const out = runFn('node', args, { cwd: lane });
  return JSON.parse(out);
}

// #3627 follow-up — raw script call, not routed through `run.mjs`: no `learnings-drop` operation is
// registered yet. Would need one built first (see #3627 follow-up); out of scope for this hardening pass.
/** REAL (flags lifted verbatim from the live brief's step 9). */
function dropLearning({ sessionSlug, learning }) {
  run('node', [
    'scripts/conveyor/learnings-drop.mjs', `--kind=${learning.kind}`, `--summary=${learning.summary}`,
    `--area=${learning.area}`, `--suggestion=${learning.suggestion}`, `--session=${sessionSlug}`,
  ]);
}
