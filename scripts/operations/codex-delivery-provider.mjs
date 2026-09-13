/**
 * @file scripts/operations/codex-delivery-provider.mjs
 * @description The REAL Codex implementation of `we:scripts/operations/deliver-item-wrapper.mjs`'s
 * `DeliveryAgentProvider` port (#3580 / #3627 FIRM REQUIREMENT 6) — a WRITE-CAPABLE, foreground-blocking
 * delivery agent, not the tool-FREE schema-constrained judge role (`we:scripts/lib/codex-judge-spawn.mjs`)
 * and not the operator's manual escape hatch (`we:scripts/codex-direct-task.mjs`).
 *
 * ── SEQUENCING NOTE, STATED PLAINLY ──────────────────────────────────────────────────────────────────────
 * `#3581` ratified that Codex proves itself as a REVIEWER before it does delivery work. The operator
 * explicitly chose to build this ahead of that gate — a deliberate, informed call, recorded here rather than
 * left to look like an oversight. Nothing below makes Codex the DEFAULT: `deliverItem`'s default provider is
 * still `CLAUDE_RESTRICTED_PROVIDER`, and reaching this file requires naming `--provider=codex` (or
 * `DELIVERY_AGENT_PROVIDER=codex`) on purpose.
 *
 * ── EVERY FLAG BELOW WAS CONFIRMED LIVE, NOT ASSUMED (codex-cli 0.153.4, 2026-09-12) ─────────────────────
 * The previous `CODEX_PROVIDER` stub named three unknowns and threw rather than guess. All three are now
 * answered by real invocations, each reproduced in a scratch git repo before a line of this file was written
 * (the `we:docs/agent/prototype-based-dev.md` discipline: mock the spawn in the TEST, but ground the argv in
 * a real run first, because the spawn seam is exactly where every real bug has lived).
 *
 * UNKNOWN 1 — "does Codex have a write-capable invocation, and what turns it on?"  ANSWERED.
 *   Two shapes work, and this file deliberately picks the SECOND:
 *     (a) `-s workspace-write` — the obvious one. REJECTED, for two independent measured reasons below.
 *     (b) `-c default_permissions=locked -c 'permissions={locked={extends=":workspace", …}}'` — the named
 *         permission profile. `extends=":workspace"` grants the SAME write access `-s workspace-write` does
 *         (live: a file was created in the working root under (b) with no `-s` flag present at all).
 *   WHY (b) AND NOT (a), on evidence:
 *     1. `codex exec resume` DOES NOT ACCEPT `-s` AT ALL — confirmed against the real `codex exec resume
 *        --help`, whose entire flag list is `-c --last --all --enable --disable -i --strict-config -m
 *        --dangerously-* --thread-source --skip-git-repo-check --ephemeral --ignore-user-config --ignore-rules
 *        --output-schema --json -o`. There is no `-s` and no `-C`. This port's contract needs ONE sandbox
 *        posture that holds across BOTH a fresh spawn and a resume (`resumeAgentWithGateFailure` hands the
 *        agent a new turn on the same thread), and `-c` is the only mechanism that spans both. A `-s`-based
 *        provider would silently run its resume turn under a DIFFERENT, un-chosen sandbox.
 *     2. `-s` silently DEFEATS the deny map. `we:scripts/lib/isolation-provider.mjs#buildNativeDenyCodexArgs`
 *        documents this from #3371 Probe 14f's own re-verification: `-s workspace-write` and
 *        `-s danger-full-access` each made the `permissions` deny entries have ZERO effect. `-s` is Codex's
 *        selector for one of its three BUILT-IN profiles and wins over a custom `default_permissions`
 *        selection rather than composing with it — the two are alternatives, not a combination.
 *   So this file passes NO `-s`, ever, on either branch. See {@link buildCodexDeliveryArgv}.
 *
 * UNKNOWN 2 — "is there a blocking/foreground invocation this port's `spawn` contract can rely on?"  YES.
 *   `codex exec` is non-interactive by design and returns when the turn ends. Confirmed through the EXACT
 *   primitive this file uses — a real `execFileSync('codex', argv, { stdio: ['ignore','pipe','pipe'] })` from
 *   Node — which blocked for 8.5s, exited 0, and left the requested file on disk. Two earlier shell-level
 *   runs behaved identically (12s and 11s). There is no `--bg`, no detach, no poll.
 *   THE ONE REAL TRAP, AND WHY `stdio[0]` IS `'ignore'` AND NOT INHERITED: `codex exec`'s own `--help` says
 *   "If not provided as an argument (or if `-` is used), instructions are read from stdin. If stdin is piped
 *   and a prompt is also provided, stdin is appended as a `<stdin>` block." A spawn that supplies BOTH a
 *   positional prompt AND a piped, never-closed stdin HANGS FOREVER — reproduced and documented by
 *   `we:scripts/lib/codex-judge-spawn.mjs`'s own header. That module dodges it by passing no positional
 *   prompt and closing stdin itself; it can, because it uses async `spawn`. This port's contract is a
 *   SYNCHRONOUS blocking call (`execFileSync` cannot write to a child's stdin at all), so the dodge here is
 *   the other one: a positional prompt plus `stdio[0] = 'ignore'`, which hands the child `/dev/null` and an
 *   immediate EOF. That exact combination is what the 8.5s live run above exercised. NEVER change `stdio[0]`
 *   here — an inherited or piped stdin turns a 60-minute timeout into the only thing that ends the run.
 *
 * UNKNOWN 3 — "does Codex have any hook-equivalent, i.e. what replaces guard-lane.mjs / guard-bash.mjs?"
 *   ANSWERED, and the answer is that it needs no PORT of those two hooks, because its NATIVE permission
 *   profile already enforces the same two protections at the OS layer, more strongly. Measured, not reasoned:
 *   with `-c default_permissions=locked -c 'permissions={locked={extends=":workspace"}}'` rooted at a real
 *   lane clone, via `codex sandbox -P locked` (a raw command wrapper with NO model in the loop, so this is a
 *   syscall result and not model cooperation):
 *     • write into the PRIMARY checkout (`~/workspace/webeverything/PWNED.txt`) → `Operation not permitted`.
 *       `we:scripts/guard-lane.mjs`'s whole first arm, enforced by Seatbelt instead of a `PreToolUse` hook —
 *       and STRICTLY STRONGER, because that hook matches `Edit|Write` TOOL calls and cannot stop a shell
 *       redirect, which this does.
 *     • write into a SIBLING lane (`…/.lanes/web-everything/lane-18/PWNED.txt`) → `Operation not permitted`.
 *       This closes `guard-lane.mjs`'s OWN documented residual #2 ("an `Edit` into a sibling's lane therefore
 *       still passes"), which is open today under the Claude provider.
 *     • write inside its own lane → allowed (exit 0, file present). The build still works.
 *     • network: `git ls-remote origin` → `ssh: Could not resolve hostname github.com`; a `curl` to
 *       api.github.com → exit 6, HTTP 000. The `:workspace` profile has NO network. So `git push` — the
 *       single most important thing `we:scripts/guard-bash.mjs` denies (the `main`-push block) — is not
 *       denied by a rule the agent could argue with; it is STRUCTURALLY IMPOSSIBLE. Nothing in the delivery
 *       brief needs the network (the wrapper owns the gate, converge, the PR and the labels — FIRM
 *       REQUIREMENTS 1-3 — and the lane arrives with deps already installed), so this costs nothing.
 *   WHAT IS THEREFORE *NOT* BUILT HERE, AND WHY THAT IS THE RIGHT CALL: no re-implementation of
 *   `guard-bash.mjs`'s destructive-git-op table. What that table protects against — `git reset --hard`,
 *   `git clean -fdx`, a broad `git add` — is, for an agent Seatbelt has confined to one lane clone, damage
 *   to a DISPOSABLE, ISOLATED directory and nothing else. The lane IS the blast radius, and the lane is
 *   rebuilt by `lane-pool.mjs` as a matter of course. Building a guard for that would be building a guard for
 *   a risk that is already bounded to the thing it would protect.
 *   THE HONEST RESIDUAL, stated rather than papered over: `:workspace` confines WRITES, not READS. A Codex
 *   delivery agent can still READ outside its lane. {@link defaultDeliveryDenyPaths} closes the one read
 *   that actually matters (the shared primary checkout, which routinely holds another session's in-flight
 *   uncommitted work) via the `filesystem` deny map, and `denyPaths` is a parameter so a caller can close
 *   more. Sibling-lane READS remain open — their committed content is identical to the agent's own lane copy,
 *   so the marginal leak is another agent's uncommitted diff, and expressing "every sibling lane but mine" as
 *   a glob is exactly the kind of fragile guess this file refuses to make. Read isolation in the adversarial
 *   sense is `we:scripts/lib/isolation-provider.mjs`'s territory (#3371) and #3621's read-allowlist work, not
 *   this port's.
 *   A FURTHER HONEST LIMIT on the deny map specifically, carried over verbatim from `isolation-provider.mjs`
 *   because it applies here unchanged: inside `codex exec` the deny is surfaced to the MODEL, which
 *   self-declines (live: "the active permission policy explicitly denies reading that path"). That is a
 *   model-cooperation signal. The OS-enforced half of the identical profile is what `codex sandbox -P locked`
 *   proves above. Treat the `codex exec` read-deny as strong-in-practice, and the write/network confinement
 *   as the genuinely OS-level guarantee — they are different strengths and this file does not conflate them.
 *
 * ── THE MINIMAL-CONTEXT HALF (FIRM REQUIREMENT 5) ────────────────────────────────────────────────────────
 * `-c project_doc_max_bytes=0` is Codex's `--restricted`-equivalent for doctrine: it suppresses the CLI's
 * automatic startup read of `we:AGENTS.md` into the model's context. Live-confirmed here a third time, in
 * write mode, by asking a real run whether any instructions file had been auto-loaded: *"No `AGENTS.md` was
 * automatically loaded into my startup context."* It is also MANDATORY alongside any `filesystem` deny, not
 * an optional extra — #3371 Probe 14f found the AGENTS.md auto-loader trips its own denial and kills session
 * startup outright ("failed to load AGENTS.md instructions … Operation not permitted") without it. Both
 * reasons point the same way, so it is passed unconditionally.
 * `--strict-config` is passed for the reason Probe 14h found the hard way: plain `-c` keys are NOT validated
 * without it, which makes "this key had no effect" and "this key does not exist" indistinguishable. With it, a
 * key that a future Codex release renames fails LOUD instead of silently dropping the sandbox.
 *
 * ── THE THREAD-ID MAPPING, AND WHY IT EXISTS ─────────────────────────────────────────────────────────────
 * Claude lets the CALLER mint the session id (`--session-id <uuid>`) and resume by it. Codex does not: `codex
 * exec` has no `--session-id`, mints its own thread id, and announces it in the `thread.started` event of the
 * `--json` stream. The port's `spawn({ resumeSessionId })` therefore arrives carrying the CLAUDE-side UUID,
 * which Codex would not recognise. Rather than widen the port for one provider, this file keeps its own
 * sidecar map: the fresh spawn parses `thread_id` out of its own stdout and records it under
 * `.operations/codex-delivery-threads/<sessionSlug>.json`, and a resume reads it back. The port's shape is
 * untouched, and `CLAUDE_RESTRICTED_PROVIDER` is unaffected.
 *
 * PURE / IMPURE SPLIT, the same discipline `codex-judge-spawn.mjs` and `minimal-context-provider.mjs` keep:
 * `buildCodexDeliveryArgv`, `parseCodexThreadId` and `assertDenyPathsUsable` are PURE — no fs, no spawn, no
 * clock — so the argv, which IS the contract with the CLI, is assertable by a test with no subprocess at all.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { buildNativeDenyCodexArgs } from '../lib/isolation-provider.mjs';
import { REPO_ROOT } from './minimal-context-provider.mjs';
import { usageReportSecretDir } from '../lib/usage-report-secret-paths.mjs';

/** The binary. Named, not inlined, for the same reason `codex-judge-spawn.mjs#CODEX_CLI` is. */
export const CODEX_CLI = 'codex';

/**
 * The Codex model pin. RATIFIED as a repo rule (#x8wbivt, 2026-09-11 —
 * `we:docs/agent/backlog-workflow.md#codex-model-routing`) on measured evidence: 89 logged `codex exec` runs
 * across 8 selectable models, and this one scored top on every probe at the lowest reasoning-token burn. The
 * rule's own words are "never inherit, never implicit", so `-m` is ALWAYS passed and there is no code path
 * here that omits it. Confirmed live in this file's own probes (`-m gpt-6-astra`, real write-capable runs).
 *
 * A LOCAL COPY, NOT AN IMPORT — the same deliberate, documented call `we:scripts/codex-direct-task.mjs`'s own
 * `CODEX_EFFORT_MAP` makes for the same reason ("kept as a local copy because `codex-judge-spawn.mjs` is a
 * different, unmerged lane's file at the time this was written"). #x8wbivt's constants landed on `main` AFTER
 * this prototype branch forked, so importing them from here would not resolve. CONSOLIDATE to that single
 * source when this branch merges — that is a real follow-up, not a note to ignore.
 */
export const CODEX_DELIVERY_MODEL = 'gpt-6-astra';

/**
 * The `model_reasoning_effort` levels this provider accepts. IDENTITY, not a clamp: `#x8wbivt` re-checked the
 * older clamp-to-`high` convention (still present on this branch's `codex-direct-task.mjs` /
 * `codex-judge-spawn.mjs`) against the CLI's own server-fetched catalogue AND against execution —
 * `gpt-6-astra`'s `supported_reasoning_levels` are all six below, and a live ping at each of `xhigh`/`max`/
 * `ultra` completed normally. Clamping was therefore silently DOWNGRADING an explicit choice and recording
 * nothing. A caller who overrides `model` may name a level that model does not offer; Codex answers that with
 * its own error. This map validates the VOCABULARY, not the entitlement.
 */
export const CODEX_DELIVERY_EFFORT_LEVELS = Object.freeze([
  'low', 'medium', 'high', 'xhigh', 'max', 'ultra',
]);

/**
 * The delivery agent's default reasoning effort. `'medium'` is the `sonnet` rung of #x8wbivt's ratified
 * three-rung ladder — the rung that card's routing rule makes the default for ordinary build-shaped work, and
 * chosen EXPLICITLY here rather than inherited (the same card refuses an implicit default). Overridable per
 * call via `buildCodexDeliveryArgv`'s `effort`.
 */
export const CODEX_DELIVERY_EFFORT = 'medium';

/**
 * The `.operations/` sidecar holding the `sessionSlug → Codex thread id` map — the same sidecar family
 * `delivery-report-store.mjs` and `persistSpawnFailure` already write into, so a Codex delivery leaves its
 * durable crumbs in the one place an operator already looks.
 */
export const CODEX_THREAD_DIR_NAME = 'codex-delivery-threads';

/**
 * The default `filesystem` deny entries for a delivery run — the shared PRIMARY checkout, which is the one
 * off-lane READ that carries real risk (it routinely holds another session's uncommitted work; see the file
 * header's residual note for what this deliberately does NOT cover). A caller may pass its own `denyPaths`.
 *
 * A FUNCTION, not a frozen constant, because the answer depends on where the WRAPPER process is running:
 * `REPO_ROOT` is this module's own checkout, which in a lane-clone deployment is itself a lane.
 */
export function defaultDeliveryDenyPaths(repoRoot = REPO_ROOT) {
  const root = String(repoRoot).replace(/\/+$/, '');
  // epic #3383 — the usage-report tool's external admin-key directory is ALWAYS included here, unconditionally,
  // alongside the caller's own repo root: a Codex delivery/repair agent must never be able to read
  // ~/.we-usage-report/ even if a caller overrides denyPaths for its own reasons. Imported from the SAME shared
  // constant usage-report.mjs itself resolves (scripts/lib/usage-report-secret-paths.mjs), so the two can never
  // drift — see that module's own header for why this directory sits outside the repo entirely in the first
  // place (a lane clone would otherwise carry it on disk regardless of any deny-list).
  return [`${root}/**`, `${usageReportSecretDir()}/**`];
}

/**
 * PURE guard. A deny entry that covers the agent's OWN lane would deny the build itself — an impossible
 * configuration that must fail loudly at argv-build time rather than as a baffling mid-run permission error.
 * Compares resolved path PREFIXES only (the deny entries this file produces are always `<dir>/**`), which is
 * exactly the shape `defaultDeliveryDenyPaths` emits; a caller passing an exotic glob is trusted, because
 * re-implementing Codex's own glob matcher to second-guess them would be a guess, not a check.
 *
 * @param {string[]} denyPaths
 * @param {string} lanePath - the resolved, absolute lane clone the agent will work in.
 */
export function assertDenyPathsUsable(denyPaths, lanePath) {
  if (typeof lanePath !== 'string' || !lanePath.trim()) {
    throw new TypeError('codex-delivery-provider: `lanePath` must be a non-empty absolute path');
  }
  const lane = lanePath.replace(/\/+$/, '');
  for (const entry of denyPaths) {
    const prefix = entry.replace(/\/\*\*$/, '').replace(/\/+$/, '');
    if (lane === prefix || lane.startsWith(`${prefix}/`)) {
      throw new Error(
        `codex-delivery-provider: refusing to deny ${JSON.stringify(entry)} — it covers the agent's own lane `
        + `(${lane}), which would make the build itself unreadable. Pass a \`denyPaths\` that excludes the lane.`,
      );
    }
  }
  return denyPaths;
}

/**
 * PURE. The `codex` argv — the fresh-`exec` shape, or the `exec resume <thread-id>` shape when
 * `resumeThreadId` is given. THE ARGV IS THE CONTRACT WITH THE CLI, so this is separated out and exported for
 * the same reason `buildRestrictedProviderArgv` and `buildAgentArgv` are: a flag rename upstream must break a
 * test, not a production delivery.
 *
 * DIFFERENCES BETWEEN THE TWO BRANCHES ARE NOT STYLISTIC — they are what the real CLI accepts (verified
 * against `codex exec --help` and `codex exec resume --help` on 0.153.4):
 *   - `-C <cwd>` appears ONLY on the fresh branch. `exec resume` has no `-C`; the resume's working root comes
 *     from the spawned process's own `cwd` option instead (live-confirmed: a resume run from inside the
 *     working root wrote its file there correctly).
 *   - NO `-s` on EITHER branch, deliberately — see the file header, UNKNOWN 1.
 *   - NO `--ephemeral` on either branch, deliberately: `--ephemeral` writes no session to disk, and a session
 *     that was never persisted cannot be resumed. This port REQUIRES resume (the gate-failure hand-back), so
 *     persistence is load-bearing here, unlike in the fire-and-forget judge role which does pass it.
 *   - The prompt is POSITIONAL on both branches, which is safe only because the spawn closes stdin — see the
 *     file header's stdin-trap note before changing either half of that pair.
 *
 * @param {object} o
 * @param {string} o.prompt
 * @param {string} o.cwd - the resolved lane clone.
 * @param {string[]} o.denyPaths - `filesystem` deny entries, non-empty.
 * @param {string|null} [o.resumeThreadId] - Codex's own thread id; the resume branch when present.
 * @param {string} [o.model]
 * @param {string} [o.effort]
 * @returns {string[]} argv AFTER the binary name.
 */
export function buildCodexDeliveryArgv({
  prompt, cwd, denyPaths, resumeThreadId = null,
  model = CODEX_DELIVERY_MODEL, effort = CODEX_DELIVERY_EFFORT,
}) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new TypeError('codex-delivery-provider: `prompt` must be a non-empty string');
  }
  if (typeof cwd !== 'string' || !cwd.trim()) {
    throw new TypeError('codex-delivery-provider: `cwd` must be the resolved lane clone path');
  }
  if (typeof model !== 'string' || !model.trim() || model.trim().startsWith('-')) {
    throw new TypeError(`codex-delivery-provider: \`model\` must be a plain non-empty string, got ${JSON.stringify(model)}`);
  }
  if (!CODEX_DELIVERY_EFFORT_LEVELS.includes(effort)) {
    throw new TypeError(
      `codex-delivery-provider: \`effort\` must be one of ${CODEX_DELIVERY_EFFORT_LEVELS.join('|')}, `
      + `got ${JSON.stringify(effort)}`,
    );
  }
  // `buildNativeDenyCodexArgs` (`we:scripts/lib/isolation-provider.mjs`, #3371 Probe 14f/14h) is REUSED, not
  // re-derived: it already emits exactly `--strict-config -c permissions={locked={extends=":workspace",
  // filesystem={…}}} -c default_permissions=locked -c project_doc_max_bytes=0`, which is the whole sandbox +
  // doctrine-suppression posture this provider needs, and it already validates its input. Re-typing that
  // string here would be a second copy of a contract that has been burned into once already.
  const sandboxArgs = buildNativeDenyCodexArgs(denyPaths);
  const common = [
    '--json',
    '--skip-git-repo-check',
    '-m', model.trim(),
    '-c', `model_reasoning_effort=${effort}`,
    ...sandboxArgs,
  ];
  return resumeThreadId
    ? ['exec', 'resume', String(resumeThreadId), ...common, prompt]
    : ['exec', '-C', cwd, ...common, prompt];
}

/**
 * PURE. Pull Codex's own thread id out of a `--json` run's stdout. The stream is JSONL — one object per line —
 * and the id arrives in the FIRST `thread.started` event (live shape, verbatim:
 * `{"type":"thread.started","thread_id":"01a09887-f68c-7352-b8b3-5da35f7d0b68"}`). A resume re-announces the
 * SAME id, which is how the resume was confirmed to be a genuine continuation rather than a new session.
 *
 * Tolerant of unparseable lines on purpose: the stream is Codex's, not ours, and a single malformed line must
 * not cost the caller the thread id that a later line still carries.
 *
 * @param {string} stdout
 * @returns {string|null}
 */
export function parseCodexThreadId(stdout) {
  if (typeof stdout !== 'string' || !stdout) return null;
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== '{') continue;
    let event;
    try { event = JSON.parse(trimmed); } catch { continue; }
    if (event?.type === 'thread.started' && typeof event.thread_id === 'string' && event.thread_id) {
      return event.thread_id;
    }
  }
  return null;
}

/** The sidecar path for one session's Codex thread id. Exported so a test can assert the location rather
 *  than re-derive it, and so an operator can find it. */
export function codexThreadIdPath(sessionSlug, repoRoot = REPO_ROOT) {
  return `${repoRoot}.operations/${CODEX_THREAD_DIR_NAME}/${sessionSlug}.json`;
}

/**
 * Record the Codex thread id a fresh spawn minted, keyed by the wrapper's own `sessionSlug`. Best-effort:
 * a failure to write the crumb must not fail a delivery that has otherwise just succeeded — the only thing
 * lost is the ability to resume, which `readCodexThreadId`'s own caller reports clearly if it comes to that.
 */
export function writeCodexThreadId(sessionSlug, threadId, repoRoot = REPO_ROOT) {
  try {
    const path = codexThreadIdPath(sessionSlug, repoRoot);
    mkdirSync(`${repoRoot}.operations/${CODEX_THREAD_DIR_NAME}`, { recursive: true });
    writeFileSync(path, `${JSON.stringify({ sessionSlug, threadId, at: new Date().toISOString() }, null, 2)}\n`);
    return path;
  } catch { return null; }
}

/** Read back the thread id a previous fresh spawn recorded, or `null` when there is none. */
export function readCodexThreadId(sessionSlug, repoRoot = REPO_ROOT) {
  try {
    const parsed = JSON.parse(readFileSync(codexThreadIdPath(sessionSlug, repoRoot), 'utf8'));
    return typeof parsed?.threadId === 'string' && parsed.threadId ? parsed.threadId : null;
  } catch { return null; }
}

/**
 * The blocking spawn primitive — the Codex counterpart to `dispatch-lane-io.mjs#defaultSpawnAgent`, which
 * hardcodes `'claude'` and so cannot be reused. RETURNS STDOUT (unlike the Claude one, which discards it),
 * because the thread id this port's resume branch depends on exists nowhere else.
 *
 * `stdio: ['ignore', 'pipe', 'pipe']` is LOAD-BEARING, not housekeeping — see the file header's stdin-trap
 * note. `killSignal: 'SIGKILL'` mirrors `defaultSpawnAgent`: a wedged agent is still reclaimed when the
 * caller's `timeout` fires.
 */
export function defaultSpawnCodexAgent(argv, opts = {}, { exec = execFileSync } = {}) {
  return exec(CODEX_CLI, argv, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    killSignal: 'SIGKILL',
    ...opts,
  });
}
