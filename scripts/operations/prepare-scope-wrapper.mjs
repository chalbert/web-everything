#!/usr/bin/env node
/**
 * @file scripts/operations/prepare-scope-wrapper.mjs
 * @description THE PREPARE-SCOPE WRAPPER (`#3641`, under epic `#3383`) — the mechanical arc a `prepare`
 * dispatch runs instead of handing a `claude --bg` agent the 242-line
 * `we:skills-src/conveyor/prepare-scope-agent-brief.md` and trusting it to run its own lifecycle.
 *
 * FOURTH OF THE SIX LAUNCH KINDS TO GET ONE, and deliberately the SAME shape as the three before it:
 *   - `we:scripts/operations/review-dispatch-wrapper.mjs` (`#xu2pp2m`) — purely mechanical, no agent at all;
 *   - `we:scripts/operations/deliver-item-wrapper.mjs` (`#3627`, wired by `#3645`) — mechanical arc around ONE
 *     minimal agent turn that does the judgment;
 *   - `we:scripts/operations/fix-dispatch-wrapper.mjs` (`#xu2pp2m`) — the same, for a repair.
 *
 * ── WHICH OF THE TWO SHAPES THIS IS, AND WHY (the small design call `we:backlog/3641-*.md` left to the build) ──
 *
 * `#3641` names the real fork: is a prepare-scope dispatch ZERO-AGENT-TURN like the review wrapper, or does it
 * keep ONE minimal agent turn like build/fix? The card points at the review shape because "prepare-scope
 * authors a small, mostly-mechanical scope: field prediction" — and asks this build to CHECK that rather than
 * assume it.
 *
 * CHECKED, AND THE ANSWER IS THE BUILD SHAPE. The review wrapper can be zero-agent because the judgment it
 * needs was ALREADY packaged behind a CLI: `we:scripts/operations/review-loop-cli.mjs` spawns its own jurors
 * and returns a verdict, so the wrapper only has to read that verdict. There is no equivalent
 * "predict-this-item's-touch-set" CLI, and predicting a touch-set is not mechanical in the review sense — it is
 * reading a prose story, reading the code it implies, and naming where a build would land. `#3412`'s successful
 * live prepare run (cited by the parent epic) proves an AGENT can do it unattended; it does not show a script
 * can. So: everything AROUND the prediction becomes mechanical here — lane acquire, the gate, the
 * single-file-touched check, the commit, the PR, the learnings drop, the release — and the prediction itself
 * stays exactly one minimal agent turn (`we:skills-src/conveyor/prepare-scope-agent-brief-v2.md`).
 *
 * ── WHAT THE AGENT NO LONGER DOES (all of it moved into this file) ──────────────────────────────────────────
 *
 * The live brief's steps 1, 4, 5, 6, 7 and its Escalations table: `lane-pool acquire`, the
 * `verify-lane request` → `check` poll dance, its OWN adversarial review subagent, `git commit`, `run.mjs
 * open-pr --mode=label-on-green`, `learnings-drop`, and the reasoning about which of four escalation cases it
 * is in. The v2 brief has none of it. What remains for the agent is one sentence: predict the touch-set, write
 * `scope:` into one file, report.
 *
 * THE SELF-REVIEW STEP IS DROPPED, NOT SILENTLY LOST — the same call `we:backlog/3629-*.md` ratified for the fix
 * wrapper (see `fix-dispatch-wrapper.mjs`'s header, point 2): an agent spawning its own adversarial reviewer
 * INSIDE its own dispatched turn is the anti-pattern `#3627` already removed from the build agent. Its
 * replacement here is deliberately NOT a converge pass (that is sized for a code diff; this diff is one
 * frontmatter key). It is two mechanical checks this wrapper runs and the prose brief could only ask for:
 * {@link assertOnlyItemSpecTouched} (the "edit exactly one file" guardrail, now enforced against the real
 * working tree instead of trusted) and the gate itself, which is what actually rejects a malformed or empty
 * `scope:` (`check:standards` errors on `scope: []`). What is NOT replaced, and is named rather than papered
 * over: nothing here re-judges whether a WELL-FORMED prediction is a GOOD one. The live brief asked an agent to
 * self-review that; this wrapper does not, and the honest fallback is that a bad-but-well-formed scope is
 * caught where every other scope error already is — the PR, and the build that later runs under it. Building a
 * real second-opinion pass on a scope prediction is follow-up work, flagged here loudly rather than faked.
 *
 * ── RESTART SURVIVAL (`#3641`'s own second acceptance clause) ───────────────────────────────────────────────
 *
 * NOTHING IN THIS FILE RUNS INSIDE THE RESIDENT RUNNER. Same reasoning, and the same mechanism, as `#3645`:
 * this arc BLOCKS (one agent turn, plus a 150-350s gate, plus `open-pr --mode=label-on-green` waiting on a
 * required check), and the dispatch path it sits on is `we:skills-src/conveyor/runner.mjs`'s
 * `makeCliDispatchPass` — a SYNCHRONOUS `execFileSync` of `run.mjs dispatch-lane --num=N` inside the runner's
 * own tick. So the block lives in a separate, DETACHED process: `we:scripts/operations/prepare-scope-run.mjs`
 * is this file's only production caller, and the dispatch provider spawns it `detached: true` / `.unref()`'d.
 * See that file's header, and `prepareScopeDetachedProvider`, for the full account.
 *
 * ── HONESTY LABEL (`we:docs/agent/prototype-based-dev.md`) ──────────────────────────────────────────────────
 *
 * NOT LIVE-EXERCISED. Every CLI surface below was read from the live source it shells, and the wiring is
 * covered by real tests with every process boundary injected — but "the code is real" and "the pipeline has run
 * end to end against a real item" are different claims, and only the first holds today. `#3641` says park until
 * a real driver+observer run proves it.
 *
 * IMPURE: `node:child_process` (via the shared `run`), `node:crypto` (session ids), `node:fs` (the PR body).
 * Every impure call is injectable, mirroring the three sibling wrappers' own convention.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import {
  REPO_ROOT, run, RESTRICTED_PROVIDER_TOOLS, acquireLane, releaseLane, resolveLanePath,
  buildRestrictedProviderArgv, createHooksSettingsWriter, persistSpawnFailure, runVerifyOperation,
} from './minimal-context-provider.mjs';
import { defaultSpawnAgent, findItem, defaultLoadItems } from './dispatch-lane-io.mjs';
import {
  tryReadDeliveryReport, deleteDeliveryReport, resolveDeliveryReportsDir,
} from './delivery-report-store.mjs';

/** The lane-pool `--purpose` this wrapper's acquire carries — the SAME string
 *  `we:skills-src/conveyor/prepare-scope-agent-brief.md` step 1 already used, so a lane's purpose field keeps
 *  meaning what it meant before the lifecycle moved out of the brief. */
export const PREPARE_SCOPE_LANE_PURPOSE = 'conveyor-prepare-scope';

/**
 * The timeout budget for the ONE blocking agent spawn — DELIBERATELY SMALLER than
 * `deliver-item-wrapper.mjs#DELIVERY_AGENT_SPAWN_TIMEOUT_MS` (60 minutes) and deliberately NOT imported from
 * it, for the same reason that constant refuses to reuse `dispatch-lane-io.mjs#SPAWN_TIMEOUT_MS`: the two calls
 * are different shapes and a shared number would be sized for neither.
 *
 * A delivery agent's hour covers build + gate + a full converge loop (whose own first real run, PR #1018, took
 * 56 minutes by itself — the floor that number is picked above). A prepare agent does none of that: it reads
 * one story, greps the modules it implies, and writes one frontmatter key. It never compiles, never runs a
 * test, and never spawns anything. 20 minutes is generous against that work and still bounded — past it,
 * `execFileSync`'s `killSignal: 'SIGKILL'` reclaims a genuinely wedged agent instead of letting it hold a lane
 * for an hour doing nothing.
 */
export const PREPARE_AGENT_SPAWN_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

/**
 * The trimmed hooks-settings file this wrapper's agent spawns under — the SAME four `PreToolUse` hooks
 * `deliver-item-wrapper.mjs#DELIVERY_HOOKS_SETTINGS` carries, and the same `permissions.allow` reasoning (under
 * `--restricted` the CLI ignores the repo's own permissions files entirely, so without this an ordinary
 * headless command comes back "requires approval" with nobody there to approve it).
 *
 * TWO OF THE FOUR MATTER MORE HERE THAN ANYWHERE ELSE, which is why this is not trimmed further.
 * `lint-locus-prefix.mjs --pre` denies a write that would put a BARE code-path reference into `backlog/*.md` —
 * and a bare prefix is precisely the failure mode a scope prediction is most prone to (the v2 brief's own first
 * rule). `backlog-guard.mjs --pre` guards the same `backlog/*.md` write path. This agent's ONLY edit is to a
 * `backlog/*.md` file, so those two hooks are on its critical path every single run, not a precaution.
 */
export const PREPARE_HOOKS_SETTINGS = Object.freeze({
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

/** Generated by the shared factory, never a re-derived copy — see `createHooksSettingsWriter`'s own docblock
 *  for why it re-writes every call rather than skipping when the file exists. */
export const ensurePrepareHooksSettingsFile = createHooksSettingsWriter(
  'prepare-scope-agent-hooks-settings.json', PREPARE_HOOKS_SETTINGS,
);

/**
 * PURE. The REAL environment variables `we:skills-src/conveyor/prepare-scope-agent-brief-v2.md` reads as actual
 * shell variables (`$LANE`, `$ITEM_SPEC_PATH`, `$DELIVERY_SESSION`, `$DELIVERY_ITEM`) — not the text-appended
 * `[env: …]` footer that looks like a shell line and is not one (`#3627` bug 7, confirmed live).
 *
 * WHY `DELIVERY_SESSION`/`DELIVERY_ITEM` AND NOT `PREPARE_*`: the report channel this brief uses IS the
 * delivery-report CLI (`we:scripts/operations/delivery-report-cli.mjs`), reused rather than cloned — see
 * {@link runPrepareAgentToCompletion}'s docblock for why a third report family was not created. The env var
 * names are that CLI's own, so the brief's one reporting command is byte-identical to the delivery brief's.
 *
 * `ITEM_SPEC_PATH` is the one genuinely prepare-specific variable: the single repo-relative backlog file this
 * agent may edit. It is handed down rather than left to the agent to derive, because "which file" is exactly
 * the thing the wrapper already knows and the agent must not guess at.
 *
 * `OPERATION_DELIVERY_REPORTS_DIR` is resolved ONCE in THIS process (`#3627` bug 9): a lane is a separate
 * `git clone`, so the agent's own copy of `delivery-report-store.mjs` would otherwise resolve a DIFFERENT,
 * lane-local reports directory and the wrapper would read a false-negative "no report" back.
 *
 * `WE_DISPATCH_KIND: 'prepare'` — the same channel `we:scripts/guard-bash.mjs` reads. NAMED GAP, and a gap
 * this item deliberately does NOT close, for a reason that file states itself. Its deny table matches the
 * literal string `'delivery'`, so nothing extra is enforced on a prepare agent beyond `--restricted`'s own
 * `--tools` allowlist. A `dispatchKind === 'prepare'` arm CANNOT simply be added: the table's own header names
 * the blocker for the identical `'fix'` case ("A REAL AMBIGUITY TO SETTLE BEFORE ANY `'fix'` ARM IS ADDED …
 * one env value, two contracts"), and `'prepare'` has exactly that collision. Two different spawners stamp it
 * for two INCOMPATIBLE agent contracts — `dispatch-lane-io.mjs#defaultClaudeProvider` (the
 * `WE_PREPARE_DISPATCH_MODE=agent` fallback, running the v1 brief, which runs its OWN lane acquire, gate,
 * commit and `open-pr`) and this wrapper (running the v2 brief under a wrapper that owns all of it). A deny arm
 * correct for the second would deny the first its own step 1. Resolving that — a distinct kind, or a second
 * signal — is real follow-up work and is the prerequisite, not an oversight.
 *
 * WHAT DOES ALREADY FIRE, so this is not read as "no enforcement at all": `guard-bash.mjs`'s `#3105`
 * verification-set deny covers EVERY `WE_DISPATCH_KIND`, prepare included, so the one thing the v2 brief most
 * needs the agent not to do — run the gate itself — is already denied today.
 */
export function buildPrepareAgentEnv({ sessionSlug, item, lanePath, itemSpecPath, reportsDir }) {
  return {
    WE_DISPATCH_KIND: 'prepare',
    DELIVERY_SESSION: sessionSlug,
    DELIVERY_ITEM: String(item),
    ITEM_SPEC_PATH: itemSpecPath,
    LANE: lanePath,
    OPERATION_DELIVERY_REPORTS_DIR: reportsDir,
  };
}

/** Best-effort capture of a spawn failure's own stdout/stderr, under `.operations/prepare-spawn-failures/`. */
function persistPrepareSpawnFailure(sessionSlug, error, opts = {}) {
  return persistSpawnFailure('prepare-spawn-failures', sessionSlug, error, opts);
}

/**
 * The REAL provider — the same `--restricted --tools=… --strict-mcp-config --disable-slash-commands
 * --settings=<trimmed hooks file>` argv `deliver-item-wrapper.mjs` verified against the real CLI (auth without
 * an API key, hooks genuinely firing, `--resume` preserving both), built here through the shared
 * `buildRestrictedProviderArgv` rather than re-derived.
 *
 * Implements the SAME `DeliveryAgentProvider` port `deliver-item-wrapper.mjs` declares: `spawn` BLOCKS until
 * the agent's turn ends and returns nothing, because the outcome rides the report sidecar, not the spawn.
 */
export const CLAUDE_RESTRICTED_PREPARE_PROVIDER = {
  name: 'claude-restricted (prepare-scope)',
  spawn(
    { sessionId, prompt, resumeSessionId = null, lanePath, sessionSlug, item, itemSpecPath } = {},
    {
      ensureSettingsFile = ensurePrepareHooksSettingsFile,
      spawnAgent = defaultSpawnAgent,
      persistFailure = persistPrepareSpawnFailure,
      resolveReportsDir = resolveDeliveryReportsDir,
    } = {},
  ) {
    const settingsFile = ensureSettingsFile();
    const argv = buildRestrictedProviderArgv({ sessionId, prompt, resumeSessionId, settingsFile });
    const prepareEnv = buildPrepareAgentEnv({
      sessionSlug, item, lanePath, itemSpecPath, reportsDir: resolveReportsDir(),
    });
    try {
      // `cwd: lanePath` is load-bearing, not cosmetic: `--restricted` confines the file tools to the process's
      // own working directory, so a wrong cwd sandboxes the agent into editing the wrong repo entirely
      // (`#3627` bug 7(a), confirmed live).
      spawnAgent(argv, {
        cwd: lanePath,
        env: { ...process.env, ...prepareEnv },
        timeout: PREPARE_AGENT_SPAWN_TIMEOUT_MS,
      }); // BLOCKS — the only "wait" in the whole arc.
    } catch (e) {
      persistFailure(sessionSlug, e, { resumeSessionId });
      throw e;
    }
  },
};

/**
 * Spawns the minimal prepare agent and BLOCKS until it exits, then reads its structured report.
 *
 * THE REPORT FAMILY IS REUSED, NOT CLONED. `fix-dispatch-wrapper.mjs` needed its own
 * `fix-report-{cli,store,record}.mjs` triple because a fix's outcome enum is genuinely different
 * (`fixed`/`blocked`/`escalated-needs-judgment`/`escalated-conflict`). A prepare's is not: `DELIVERY_OUTCOMES`
 * (`done`/`blocked`/`needs-human-judgment`) already names every outcome a scope prediction has — it worked, the
 * spec was too vague to predict from, or one specific call needs a person — and the record's `filesTouched` and
 * optional `learning` fields carry the rest unchanged. Building a third identical triple would have been
 * duplication for its own sake.
 */
export async function runPrepareAgentToCompletion(
  { item, sessionSlug, lanePath, itemSpecPath, provider = CLAUDE_RESTRICTED_PREPARE_PROVIDER, claudeSessionId },
  {
    // The explicit `/` (never relying on REPO_ROOT's own trailing slash) mirrors both sibling wrappers' own
    // default `readBrief` — REPO_ROOT's trailing slash does not resolve reliably under vitest's SSR transform,
    // and a redundant `//` collapses harmlessly on a real POSIX read.
    readBrief = () => readFileSync(`${REPO_ROOT}/skills-src/conveyor/prepare-scope-agent-brief-v2.md`, 'utf8'),
    readReport = tryReadDeliveryReport,
  } = {},
) {
  const prompt = readBrief();
  provider.spawn({ sessionId: claudeSessionId, prompt, lanePath, sessionSlug, item, itemSpecPath }); // BLOCKS.
  const report = readReport(sessionSlug);
  if (!report || report.status !== 'done') {
    throw new Error(
      `prepare-scope-wrapper: agent for ${sessionSlug} exited with no done report (crash or refused effect)`,
    );
  }
  return report;
}

/** The resume prompt — `unrun` is NOT treated as "your change is broken" (the same `#3627` attempt-5 finding
 *  both sibling wrappers already encode): a gate that could not RUN is an environment problem, and telling an
 *  agent to fix code that may be fine invites a guessed edit. */
function resumePrepareAgentWithGateFailure({
  sessionSlug, lanePath, item, itemSpecPath, failureOutput, gateOutcome = 'fail',
  provider = CLAUDE_RESTRICTED_PREPARE_PROVIDER, claudeSessionId,
}) {
  const prompt = gateOutcome === 'unrun'
    ? 'The verification gate could not RUN against your lane (this looks like a wrapper/environment problem, '
      + `not necessarily a problem in the \`scope:\` you wrote):\n\n${failureOutput}\n\nIf you can see something `
      + 'genuinely wrong in your own frontmatter, fix it and send a fresh `done` report exactly as before. If '
      + 'you cannot, do not guess at an edit — send a report with `outcome: blocked` and a precise `reason` '
      + 'describing what you observed.'
    : `Your gate failed:\n\n${failureOutput}\n\nThis is almost always the \`scope:\` frontmatter you wrote in `
      + `${itemSpecPath} — a malformed YAML shape, or an empty \`scope: []\` (which the gate errors on by `
      + 'design). Fix that one file, then send a fresh `done` report exactly as before.';
  provider.spawn({
    sessionId: claudeSessionId, prompt, resumeSessionId: claudeSessionId, lanePath, sessionSlug, item, itemSpecPath,
  }); // BLOCKS.
}

/**
 * One resume-and-retry, not an unbounded loop — the same bar both sibling wrappers set, and for the same
 * reason: a self-inflicted red on a fresh, one-key frontmatter edit is common and cheap to hand back exactly
 * once.
 *
 * The resumed agent's own second report is honored BEFORE a second non-passing verify is allowed to collapse to
 * `red` (`#3627` attempt-5): an honest `blocked` self-diagnosis is its own distinct `gate-blocked` status, never
 * silently rewritten into "the gate failed".
 *
 * @returns {{status: ('green'|'red'|'gate-blocked'), lanePath: string, reason?: (string|null)}}
 */
export function runPrepareGateWithOneRetry(
  {
    lanePath, item, sessionSlug, itemSpecPath,
    provider = CLAUDE_RESTRICTED_PREPARE_PROVIDER, claudeSessionId,
  },
  { run: runFn = run, readReport = tryReadDeliveryReport } = {},
) {
  const first = runVerifyOperation(lanePath, { run: runFn });
  if (first.outcome === 'pass') return { status: 'green', lanePath };

  resumePrepareAgentWithGateFailure({
    sessionSlug, lanePath, item, itemSpecPath, failureOutput: first.detail, gateOutcome: first.outcome,
    provider, claudeSessionId,
  });
  const retryReport = readReport(sessionSlug);
  const second = runVerifyOperation(lanePath, { run: runFn });
  if (second.outcome === 'pass') return { status: 'green', lanePath, retryReport };

  if (retryReport && retryReport.outcome === 'blocked') {
    return { status: 'gate-blocked', lanePath, retryReport, reason: retryReport.reason || null };
  }
  return { status: 'red', lanePath, retryReport };
}

// ================================================================================================
// The mechanical steps the live brief asked the AGENT to perform — all REAL CLI surfaces, lifted from that
// brief's own steps 6 and 7.
// ================================================================================================

/**
 * THE "EDIT EXACTLY ONE FILE" GUARDRAIL, ENFORCED — the live brief's own first non-negotiable, which until now
 * was prose an agent could simply not follow. A prepare lane's whole parallel-safety story is that it owns one
 * known-in-advance backlog file and therefore cannot collide with any sibling lane; a second edited path
 * silently breaks that for every lane running beside it.
 *
 * Reads `git status --porcelain` in the lane and REFUSES (throws) on any path that is not `itemSpecPath`.
 * Porcelain v1 lines are `XY <path>` — two status columns, a space, then the path — so the path is everything
 * from column 3 on. A rename (`R  old -> new`) would appear as one line naming both; it is refused by the same
 * check, correctly, because a prepare never renames anything.
 *
 * @returns {string[]} the touched paths (exactly `[itemSpecPath]` when it returns at all).
 */
export function assertOnlyItemSpecTouched({ lanePath, itemSpecPath, item }, { run: runFn = run } = {}) {
  const out = runFn('git', ['status', '--porcelain'], { cwd: lanePath });
  const touched = String(out ?? '')
    .split('\n')
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  const foreign = touched.filter((p) => p !== itemSpecPath);
  if (foreign.length) {
    throw new Error(
      `prepare-scope-wrapper: the prepare agent for #${item} touched ${foreign.length} path(s) outside its own `
      + `backlog file (${foreign.join(', ')}) — a prepare lane's scope is exactly ${itemSpecPath}, and committing `
      + 'anything else would break the disjointness every sibling lane depends on',
    );
  }
  if (!touched.length) {
    throw new Error(
      `prepare-scope-wrapper: the prepare agent for #${item} reported done but left ${itemSpecPath} unmodified `
      + '— there is no `scope:` prediction to commit',
    );
  }
  return touched;
}

/**
 * REAL — one commit, explicit path, on the lane's CURRENT branch (its local `main`). Never `git add -A`, never
 * `git checkout -b`: the single-branch hook blocks branch creation even inside a lane clone, and `pr-land`
 * publishes HEAD to the `lane/…` ref itself (`--ref=… --sha=HEAD`).
 *
 * The message goes through `execFileSync`'s argv array, so the live brief's own heredoc footgun (a backtick in
 * the message running as a subshell) cannot occur here — there is no shell.
 */
export function commitScopeEdit({ lanePath, itemSpecPath, item }, { run: runFn = run } = {}) {
  const message = `WE #${item}: author scope: for #${item}\n\n`
    + 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>\n';
  runFn('git', ['commit', '-m', message, '--', itemSpecPath], { cwd: lanePath });
}

/** PURE. The PR body — one backlog file, so it says exactly that and nothing more speculative. */
export function buildScopePrBody({ item, itemSpecPath, report }) {
  const files = (report && Array.isArray(report.filesTouched) && report.filesTouched.length)
    ? report.filesTouched
    : [itemSpecPath];
  const note = (report && typeof report.reason === 'string' && report.reason.trim())
    ? `\n\nAgent note: ${report.reason.trim()}`
    : '';
  return `## #${item} — predicted \`scope:\`\n\nAuthors the \`scope:\` frontmatter for #${item} so the `
    + `dispatcher can stop holding it \`unshaped-no-scope\` and launch it to build.${note}\n\nFiles touched:\n`
    + `${files.map((f) => `- ${f}`).join('\n')}\n\n---\nPrepared by the #3641 mechanical prepare-scope pipeline `
    + '(the wrapper drove the lane, gate, commit and PR — the agent only predicted the touch-set).\n';
}

/** REAL — writes {@link buildScopePrBody} to the exact path `openScopePr`'s `--bodyFile` reads. */
export function writeScopePrBody({ item, lanePath, itemSpecPath, report }, { writeFile = writeFileSync } = {}) {
  const bodyFile = `${lanePath}/.pr-body.md`;
  writeFile(bodyFile, buildScopePrBody({ item, itemSpecPath, report }));
  return bodyFile;
}

/**
 * REAL — the canonical producer, never a hand-rolled `gh pr create`, so `pr-land`'s own `#2307` review-label
 * rubric applies at open (which is what parks a statute-touching scope PR `review:human` on its own).
 *
 * `--mode=label-on-green` is the DEFAULT and expected outcome, verbatim from the live brief's step 6: the diff
 * is one backlog file — low-risk and bounded — so it auto-lands with no human in the loop. This wrapper does
 * NOT blanket-park a scope PR; `pr-land`'s rubric is the only thing that parks one.
 *
 * `--ref=lane/<item>-scope-<slug>` keeps the live brief's own ref grammar (`lane/{{ITEM_NUM}}-scope-<slug>`),
 * which is deliberately DIFFERENT from a build's `lane/<item><attempt>-<slug>`: a prepare PR and a later build
 * PR for the same item must never collide on one ref.
 */
export function openScopePr({ item, lanePath, itemSpecPath, report, slug }, { run: runFn = run } = {}) {
  if (!slug) {
    throw new Error(`prepare-scope-wrapper: openScopePr needs the item's real slug for #${item}`);
  }
  const bodyFile = writeScopePrBody({ item, lanePath, itemSpecPath, report });
  const out = runFn('node', [
    'scripts/operations/run.mjs', 'open-pr', `--ref=lane/${item}-scope-${slug}`, '--sha=HEAD', '--base=main',
    `--bodyFile=${bodyFile}`, '--requireVerified=true', '--mode=label-on-green', '--json',
  ], { cwd: lanePath });
  return JSON.parse(out);
}

/** REAL (flags lifted verbatim from the live brief's step 7). */
function dropLearning({ sessionSlug, learning }, { run: runFn = run } = {}) {
  runFn('node', [
    'scripts/conveyor/learnings-drop.mjs', `--kind=${learning.kind}`, `--summary=${learning.summary}`,
    `--area=${learning.area}`, `--suggestion=${learning.suggestion}`, `--session=${sessionSlug}`,
  ]);
}

// ================================================================================================
// THE ENTRY POINT
// ================================================================================================

/**
 * Prepare ONE item's `scope:`: acquire its lane, spawn the minimal agent exactly once (plus, rarely, one
 * gate-failure resume), check it touched only its own backlog file, commit, open the PR, forward any learning,
 * and return. Never merges, never resolves, never claims the item — a prepare only authors `scope:`.
 *
 * THE LANE IS RELEASED ON EVERY NON-PR PATH AND HELD ON THE PR PATH, exactly as `deliverItem` does: an open,
 * unmerged PR's lane still owns its ref until the resident drain lands it.
 *
 * @param {{item: string|number, lane: string|number, sessionSlug: string, scope?: string}} launch — the SAME
 *   launch shape `dispatch-lane.mjs`'s dispatch step already emits. `scope` is accepted and, when given, used
 *   verbatim for the lane lease; omitted, it is derived as `we:<specPath>` — the value that dispatch step
 *   computes for a prepare anyway (`dispatch-lane.mjs`: "a PREPARE's lane scope is `we:<specPath>`").
 * @param {object} [provider] — the `DeliveryAgentProvider` the one judgment turn runs under.
 * @param {{newSessionId?: () => string, run?: Function, loadItems?: Function, deleteReport?: Function}} [deps]
 *   — every one of them injectable for the same reason the sibling wrappers' are: the whole arc must be
 *   assertable with no lane pool, no `claude`, and no real report sidecar on disk.
 */
export async function prepareScope(
  launch,
  provider = CLAUDE_RESTRICTED_PREPARE_PROVIDER,
  {
    newSessionId = randomUUID, run: runFn = run, loadItems = () => defaultLoadItems(REPO_ROOT),
    deleteReport = deleteDeliveryReport,
  } = {},
) {
  const { item, lane, sessionSlug } = launch ?? {};
  const claudeSessionId = String(newSessionId());

  const found = findItem(String(item), loadItems);
  if (!found) {
    throw new Error(
      `prepare-scope-wrapper: could not resolve a backlog file for item #${item} — findItem returned nothing`,
    );
  }
  const itemSpecPath = found.specPath;
  const laneScope = String(launch?.scope ?? '').trim() || `we:${itemSpecPath}`;

  // A prepare's session slug is `prepare-<num>` — IDENTICAL across every attempt at the same item (there is no
  // per-attempt suffix in that grammar, unlike a build's). A delivery report is keyed purely by that slug, so a
  // PRIOR attempt's report left on disk would be read as THIS attempt's outcome if this one's agent crashes
  // before writing its own. That exact bug was confirmed live for the fix wrapper (a wrong stand-down comment
  // on real PR #2027 describing attempt 2 using attempt 1's outcome). Deleting first makes "no fresh report"
  // unambiguous; it is a no-op on a genuine first attempt.
  deleteReport(sessionSlug);

  acquireLane({
    lane, sessionSlug, scope: laneScope, item, claudeSessionId, purpose: PREPARE_SCOPE_LANE_PURPOSE,
  }, { run: runFn });

  try {
    const lanePath = resolveLanePath(lane, { run: runFn });
    const report = await runPrepareAgentToCompletion({
      item, sessionSlug, lanePath, itemSpecPath, provider, claudeSessionId,
    });

    if (report.outcome === 'blocked') {
      // The live brief's Escalations case 1, decided by the WRAPPER reading a report rather than by the agent
      // reasoning about release mechanics: the spec is too vague to predict from. No PR, frontmatter unchanged,
      // and the item stays held `unshaped-no-scope` for an operator to shape.
      releaseLane({ lane, sessionSlug }, { run: runFn });
      return { item, result: `could-not-predict (${report.reason || 'no reason reported'})` };
    }

    const gate = runPrepareGateWithOneRetry({
      lanePath, item, sessionSlug, itemSpecPath, provider, claudeSessionId,
    }, { run: runFn });
    if (gate.status === 'red') {
      releaseLane({ lane, sessionSlug }, { run: runFn });
      return { item, result: 'gate-red' };
    }
    if (gate.status === 'gate-blocked') {
      releaseLane({ lane, sessionSlug }, { run: runFn });
      return { item, result: `gate-blocked (${gate.reason || 'no reason reported'})` };
    }

    assertOnlyItemSpecTouched({ lanePath, itemSpecPath, item }, { run: runFn });
    commitScopeEdit({ lanePath, itemSpecPath, item }, { run: runFn });
    const prResult = openScopePr({ item, lanePath, itemSpecPath, report, slug: found.slug }, { run: runFn });

    if (report.learning) dropLearning({ sessionSlug, learning: report.learning }, { run: runFn });

    // STOP. No merge, no drain, no release — the resident drain daemon lands the PR, and the now-scoped item
    // dispatches to BUILD on a later tick.
    return { item, result: `scope → PR #${prResult.pr} (ready-to-merge)` };
  } catch (e) {
    // A wrapper-side failure (acquire refused, the agent crashed, the one-file check refused) is not an agent
    // outcome. Release what was taken, best-effort, and surface the raw error.
    releaseLane({ lane, sessionSlug, bestEffort: true }, { run: runFn });
    throw e;
  }
}
