#!/usr/bin/env node
/**
 * @file scripts/operations/minimal-context-provider.mjs
 * @description THE SHARED PRIMITIVES behind every minimal-context dispatch mechanism — extracted from
 * `we:scripts/operations/deliver-item-wrapper.mjs` (#3627, PR #2107, live-tested end to end against real item
 * #3371) once a SECOND dispatch kind needed the same proven shape (#xu2pp2m, downstream of #3627/#3628).
 *
 * WHY THIS FILE EXISTS, PER THE OPERATOR'S OWN RULING (recorded on `we:backlog/xu2pp2m-*.md`): the reviewer
 * mechanism (`we:scripts/operations/review-dispatch-wrapper.mjs`) and the fixer mechanism (not built yet — out
 * of scope for the item that created this file) are TWO SEPARATE PRIMITIVES, never one monolithic file and
 * never literal duplication. The parts of `deliver-item-wrapper.mjs`'s pattern that are genuinely NOT
 * delivery-specific — the `CLAUDE_RESTRICTED_PROVIDER` argv shape, the trimmed-hooks-settings-file generation,
 * lane acquire/release, and the "run one declared operation, read its structured verdict" gate-running pattern
 * — live HERE, so both mechanisms import the same proven code instead of each re-deriving or copy-pasting it.
 *
 * HONESTY LABEL, SAME CONVENTION `deliver-item-wrapper.mjs` USES. Every export below is a VERBATIM or
 * mechanically-generalized (parameterized, never behaviourally changed) lift of code that was already proven
 * live against real item #3371 — see that file's own header for the verification trail (the `--restricted`
 * vs `--bare` vs `--safe-mode` evidence in particular). Nothing here is a fresh, unverified design; the only
 * new code is the PARAMETERIZATION itself (a `purpose`/`fileName`/`dirName` argument in place of a hardcoded
 * delivery-specific literal), which is mechanical and covered by this file's own tests plus
 * `deliver-item-wrapper.test.mjs`'s pre-existing ~106 tests (unchanged, still passing — see that file's own
 * import list, which now resolves several of its names through this module instead of a local definition).
 *
 * PARK-UNTIL-EXERCISED APPLIES TO THE CONSUMERS, NOT TO A RE-EXTRACTION OF ALREADY-PROVEN CODE. This module
 * itself changes no runtime behaviour for `deliver-item-wrapper.mjs` (an extraction, not a rewrite — its own
 * test suite is the proof); `we:docs/agent/prototype-based-dev.md`'s "park until genuinely exercised" rule
 * applies to the NEW consumer (`review-dispatch-wrapper.mjs`), which is unwired and unexercised, exactly as
 * `deliver-item-wrapper.mjs` itself was before its own live test.
 *
 * IMPURE: `node:child_process`, `node:fs`. Every impure call takes an injectable `run`/`spawnAgent` (mirrors
 * `deliver-item-wrapper.mjs`'s own convention) so every export here is unit-testable with no real subprocess.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

/** The repo root, resolved by SCRIPT LOCATION (this file lives in `scripts/operations/`, same depth as
 *  `deliver-item-wrapper.mjs`, so this resolves to the identical path that file's own `REPO_ROOT` did). */
export const REPO_ROOT = new URL('../..', import.meta.url).pathname;

/** The one blocking `execFileSync` wrapper every mechanical CLI call in this file (and every caller of it)
 *  goes through — cwd defaults to {@link REPO_ROOT}, matching `deliver-item-wrapper.mjs`'s own `run` verbatim. */
export const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', cwd: REPO_ROOT, ...opts });

/** The tool allowlist `--restricted` needs handed back explicitly (verified against the real CLI while writing
 *  `deliver-item-wrapper.mjs`: `--tools=default` does NOT restore what `--restricted` removes — a probe asking
 *  for a Bash call under `--tools=default` came back "no shell tool available"). This is what a minimal-context
 *  agent needs to build/edit + report; extend it here, in the one place, if a future brief needs more. */
export const RESTRICTED_PROVIDER_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep';

// ================================================================================================
// 1. The `CLAUDE_RESTRICTED_PROVIDER` argv shape — VERIFIED against the real CLI (v2.1.266) while building
//    `deliver-item-wrapper.mjs`: `--restricted` (never `--bare`, which requires a real API key and cannot use
//    the operator's own OAuth/subscription auth; never `--safe-mode`, independently smoke-tested and REJECTED —
//    a `--settings=<hooks file>` layered on top of `--safe-mode` never fires) + an explicit `--tools` allowlist
//    (required — `--tools=default` does not restore what `--restricted` removes) + `--strict-mcp-config` (closes
//    a leak `--restricted` alone does not: without it a personal MCP tool surface still showed up) +
//    `--disable-slash-commands` (defense in depth — `--restricted`'s own help text never mentions skills at all,
//    unlike `--safe-mode`'s) + a TRIMMED `--settings` file. See `deliver-item-wrapper.mjs`'s own
//    `CLAUDE_RESTRICTED_PROVIDER` docblock for the full verification trail (auth-without-a-key, hooks-firing,
//    and `--resume`, each independently re-run against the real CLI).
// ================================================================================================

/**
 * PURE argv builder — the fresh-spawn/`-p --session-id` shape, or the `--resume` shape when `resumeSessionId`
 * is given. No `-p` in the resume branch — verified, not a bug: a real `--resume <uuid> "<prompt>"` run with
 * redirected (non-TTY) stdout and no `-p` completed as a clean headless turn (this CLI treats non-interactive
 * stdout as non-interactive on its own).
 *
 * `tools` is overridable (defaults to {@link RESTRICTED_PROVIDER_TOOLS}) so a future caller that genuinely
 * needs a narrower or wider allowlist than the delivery/review default can say so explicitly, in one place,
 * rather than hand-rolling a second argv builder.
 */
export function buildRestrictedProviderArgv({ sessionId, prompt, resumeSessionId = null, settingsFile, tools = RESTRICTED_PROVIDER_TOOLS }) {
  const RESTRICTED_FLAGS = [
    '--restricted', '--tools', tools, '--strict-mcp-config',
    '--disable-slash-commands', '--settings', settingsFile,
  ];
  return resumeSessionId
    ? [...RESTRICTED_FLAGS, '--resume', String(resumeSessionId), prompt]
    : [...RESTRICTED_FLAGS, '-p', '--session-id', String(sessionId), prompt];
}

// ================================================================================================
// 2. Minimal-context hooks-settings generation — REAL SCHEMA (`we:.claude/settings.json`'s own hook-
//    registration shape, trimmed). GENERALIZED (moved here from `deliver-item-wrapper.mjs`'s
//    `ensureDeliveryHooksSettingsFile`) into a FACTORY: `createHooksSettingsWriter(fileName, settings)` returns
//    a writer closed over its own filename + settings object, so a caller gets a real, independently-callable
//    `ensure<Whatever>HooksSettingsFile()` function rather than having to pass `fileName`/`settings` at every
//    call site. `deliver-item-wrapper.mjs`'s own `ensureDeliveryHooksSettingsFile` is now literally
//    `createHooksSettingsWriter('delivery-agent-hooks-settings.json', DELIVERY_HOOKS_SETTINGS)` — the exact
//    same generated function, not a re-derived copy.
//
//    WRITES EVERY CALL, never guarded behind `existsSync` — the same #3627 bug-8 correctness fix
//    `deliver-item-wrapper.mjs`'s own version already carries: a settings object is a pure function of its
//    caller's own frozen constant, so re-writing it every call is idempotent in the sense that matters (same
//    bytes out every time) and a STALE on-disk file from a schema that has since changed (e.g. a
//    `permissions.allow` block added later) must never survive because the file merely "already existed".
// ================================================================================================

/**
 * @param {string} fileName - written under `<REPO_ROOT>.operations/<fileName>`.
 * @param {object} settings - the hooks-settings object (already the real `--settings=<path>` JSON schema).
 * @returns {() => string} a writer that materializes `settings` to disk every call and returns the path.
 */
export function createHooksSettingsWriter(fileName, settings) {
  return function ensureHooksSettingsFile() {
    const dir = `${REPO_ROOT}.operations`;
    const path = `${dir}/${fileName}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
    return path;
  };
}

// ================================================================================================
// 3. The blocking spawn + failure-capture pattern — the part of `CLAUDE_RESTRICTED_PROVIDER.spawn` that is NOT
//    delivery-specific (delivery-specific env construction / lane-path / reports-dir resolution stays in
//    `deliver-item-wrapper.mjs`, which composes those with this generic call).
// ================================================================================================

/**
 * Best-effort capture of a spawn failure's stdout/stderr, written under `.operations/<dirName>/` — GENERALIZED
 * from `deliver-item-wrapper.mjs`'s `persistDeliverySpawnFailure` (`dirName` used to be the hardcoded
 * `'delivery-spawn-failures'`). Never throws: a failure to write the capture must never mask the real spawn
 * error it exists to explain.
 *
 * @param {string} dirName - the `.operations/` subdirectory, e.g. `'delivery-spawn-failures'` /
 *   `'review-spawn-failures'`.
 * @param {string} sessionSlug
 * @param {Error} error
 * @param {{resumeSessionId?: (string|null)}} [o]
 * @returns {string|null} the path written, or `null` on a capture failure.
 */
export function persistSpawnFailure(dirName, sessionSlug, error, { resumeSessionId = null } = {}) {
  try {
    const dir = `${REPO_ROOT}.operations/${dirName}`;
    mkdirSync(dir, { recursive: true });
    const path = `${dir}/${sessionSlug}${resumeSessionId ? '-resume' : ''}-${Date.now()}.json`;
    writeFileSync(path, `${JSON.stringify({
      sessionSlug,
      resumeSessionId,
      at: new Date().toISOString(),
      message: error && error.message ? String(error.message) : null,
      status: error && 'status' in error ? error.status : null,
      signal: error && 'signal' in error ? error.signal : null,
      stdout: error && error.stdout != null ? String(error.stdout) : null,
      stderr: error && error.stderr != null ? String(error.stderr) : null,
    }, null, 2)}\n`);
    return path;
  } catch {
    return null; // best-effort — never let the CAPTURE itself mask the real spawn failure.
  }
}

// ================================================================================================
// 4. Lane acquire/release — REAL CLI surface, lifted verbatim from `deliver-item-wrapper.mjs`'s own
//    `acquireLane`/`resetStaleVerifyMarker`, GENERALIZED only by making `purpose` an explicit (still
//    `'conveyor-delivery'`-defaulted, so every existing call site is byte-identical) parameter instead of a
//    hardcoded literal — a review dispatch acquires for `--purpose=review-loop`, never `conveyor-delivery`.
// ================================================================================================

/**
 * REAL. Acquires a lane via `lane-pool.mjs acquire --adopt`, stamping the ACQUIRING subprocess's own
 * `CLAUDE_CODE_SESSION_ID` to `claudeSessionId` — never left to inherit whatever the CALLING wrapper process's
 * own env carries — so `--adopt` records the eventual occupant's real identity (`guard-lane.mjs` later compares
 * against exactly this). Then best-effort clears any STALE `.git/.lane-verify` marker a prior occupant left
 * behind via `verify-lane.mjs reset` (`resetStaleVerifyMarker`) — see that function's own docblock.
 *
 * TWO REAL SHAPES, BOTH VERIFIED, SELECTED BY WHETHER `lane` IS GIVEN:
 *   - NUMBERED (the ORIGINAL `deliver-item-wrapper.mjs` shape, byte-for-byte unchanged — argv order is a real
 *     contract several tests pin exactly): a tick plan hands this a specific lane NUMBER
 *     (`--lane=<N> --purpose=<p> --session=<slug> --scope=<s> --item=<i> --adopt`), and the real path is
 *     re-resolved afterward via `resolveLanePath` (a fresh, authoritative read) — this branch returns nothing,
 *     matching its pre-extraction behaviour (every existing caller discards the return value).
 *   - UNNUMBERED (`we:skills-src/review/review-agent-brief.md` step 1's own real, already-proven shape:
 *     `--purpose=<p> --session=<slug> [--wait-ms=<n>] --adopt`, no `--lane=`/`--scope=`/`--item=` at all) —
 *     lets `lane-pool.mjs` pick any free lane. VERIFIED against the real CLI while building this extraction:
 *     `lane-pool.mjs acquire`'s own stdout is JUST the acquired lane's absolute path (every informational line —
 *     "acquired lane-N for...", the holder slug, the release command — goes to STDERR, confirmed by a real
 *     `1>file 2>file` redirect), so this branch reads that stdout directly as the lane path and RETURNS it —
 *     there is no lane number to re-resolve a path from afterward.
 *
 * @param {{lane?: (number|string), sessionSlug: string, scope?: string, item?: (string|number), claudeSessionId: string, purpose?: string, waitMs?: number}} o
 *   `purpose` defaults to `'conveyor-delivery'` — the delivery wrapper's own pre-existing behaviour, unchanged.
 *   `lane` omitted (undefined/null) selects the UNNUMBERED shape; `waitMs` (only meaningful there) adds
 *   `--wait-ms=<n>`, matching the review brief's own `--wait-ms=30000` self-healing-momentary-capacity-flicker
 *   reasoning (see that brief's step 1 for the full account).
 * @param {{run?: Function}} [io]
 * @returns {string|undefined} the acquired lane's real path for the UNNUMBERED shape; `undefined` for the
 *   NUMBERED shape (unchanged — callers there already re-resolve via `resolveLanePath`).
 */
export function acquireLane(
  { lane, sessionSlug, scope, item, claudeSessionId, purpose = 'conveyor-delivery', waitMs } = {},
  { run: runFn = run } = {},
) {
  const env = { ...process.env, CLAUDE_CODE_SESSION_ID: claudeSessionId };
  let acquireOut;
  if (lane != null) {
    // NUMBERED — the ORIGINAL argv, unchanged (order is a real, test-pinned contract).
    acquireOut = runFn('node', [
      'scripts/lane-pool.mjs', 'acquire', `--lane=${lane}`, `--purpose=${purpose}`,
      `--session=${sessionSlug}`, `--scope=${scope}`, `--item=${item}`, '--adopt',
    ], { env });
  } else {
    // UNNUMBERED — the real review-brief shape: no --lane/--scope/--item, optional --wait-ms.
    const args = ['scripts/lane-pool.mjs', 'acquire', `--purpose=${purpose}`, `--session=${sessionSlug}`];
    if (waitMs != null) args.push(`--wait-ms=${waitMs}`);
    args.push('--adopt');
    acquireOut = runFn('node', args, { env });
  }

  // A freshly acquired lane must never inherit a STALE `.git/.lane-verify` marker from a prior occupant's run
  // (#3627 attempt-5 live-run finding) — best-effort: a marker-reset failure must not fail the whole acquire.
  if (lane != null) {
    try {
      const lanePath = resolveLanePath(lane, { run: runFn });
      resetStaleVerifyMarker(lanePath, { run: runFn, claudeSessionId });
    } catch {
      // best-effort — see docblock above.
    }
    return undefined;
  }

  const lanePath = String(acquireOut ?? '').trim();
  try {
    resetStaleVerifyMarker(lanePath, { run: runFn, claudeSessionId });
  } catch {
    // best-effort — see docblock above.
  }
  return lanePath;
}

/** REAL — shells `verify-lane.mjs reset` (its own sanctioned marker-clear subcommand) against a just-acquired
 *  lane. Swallows a refusal/crash rather than throwing (a `reset` refusal is either "no marker to clear" —
 *  already a no-op — or "a live foreign lease holds this lane" — a real reason to leave it alone). */
export function resetStaleVerifyMarker(lanePath, { run: runFn = run, claudeSessionId } = {}) {
  try {
    runFn('node', ['scripts/verify-lane.mjs', 'reset', `--repo=${lanePath}`, '--json'],
      { env: { ...process.env, CLAUDE_CODE_SESSION_ID: claudeSessionId } });
  } catch {
    // best-effort — see acquireLane's docblock above.
  }
}

/**
 * REAL — releases a lane-pool lease by session (`--all-pools --session=<slug>`, matching the review-agent
 * brief's own step-4 shape, `we:skills-src/review/review-agent-brief.md`). GENERALIZED out of
 * `deliver-item-wrapper.mjs`'s `releaseClaimAndLane` — that function ALSO releases a backlog CLAIM
 * (`scripts/backlog.mjs release`), which is delivery/build-specific (a review dispatch never claims a backlog
 * item), so only the lane-pool half moves here; `deliver-item-wrapper.mjs` keeps its own `releaseClaimAndLane`
 * calling this plus its own claim-release call.
 *
 * @param {{lane: number|string, sessionSlug: string, bestEffort?: boolean}} o
 * @param {{run?: Function}} [io]
 */
export function releaseLane({ lane, sessionSlug, bestEffort = false }, { run: runFn = run } = {}) {
  const opts = bestEffort ? { stdio: 'ignore' } : {};
  if (bestEffort) {
    try { runFn('node', ['scripts/lane-pool.mjs', 'release', `--lane=${lane}`, `--session=${sessionSlug}`], opts); } catch { /* best-effort */ }
    return;
  }
  runFn('node', ['scripts/lane-pool.mjs', 'release', `--lane=${lane}`, `--session=${sessionSlug}`], opts);
}

/**
 * REAL — releases EVERY pool's lease for a session in one call (`--all-pools`), the shape a dispatched agent
 * that does not track which numbered lane/pool it holds uses (`we:skills-src/review/review-agent-brief.md`
 * step 4: `node scripts/lane-pool.mjs release --all-pools --session={{SESSION_SLUG}}`). Best-effort by design
 * — a release failure at exit time must not crash an otherwise-complete dispatch.
 *
 * @param {string} sessionSlug
 * @param {{run?: Function}} [io]
 */
export function releaseAllPools(sessionSlug, { run: runFn = run } = {}) {
  try { runFn('node', ['scripts/lane-pool.mjs', 'release', '--all-pools', `--session=${sessionSlug}`]); } catch { /* best-effort */ }
}

/**
 * REAL (`deliver-item-wrapper.mjs`'s own `resolveLanePath`, verbatim) — the SINGLE source of truth for "which
 * real, absolute path is lane N right now" (`we:scripts/lib/lane-pool-paths.mjs`/`verify-lane.mjs`'s own
 * convention), read via `lane-pool.mjs status --json` rather than re-derived relative-path math (which silently
 * computes the WRONG path when this file is imported from anywhere but the primary checkout).
 */
export function resolveLanePath(lane, { run: runFn = run } = {}) {
  const out = runFn('node', ['scripts/lane-pool.mjs', 'status', '--json']);
  const parsed = JSON.parse(out);
  const rows = Array.isArray(parsed.lanes) ? parsed.lanes : [];
  const found = rows.find((r) => Number(r.lane) === Number(lane));
  if (!found || !found.path) {
    throw new Error(`minimal-context-provider: lane-pool.mjs status --json reported no entry/path for lane-${lane}`);
  }
  return found.path;
}

// ================================================================================================
// 5. The gate-running pattern — REAL, routed through the DECLARED `verify` operation
//    (`scripts/operations/verify.mjs`, wired into `run.mjs`), lifted verbatim from `deliver-item-wrapper.mjs`'s
//    own `runVerifyOperation`. "Run one declared operation, read its structured verdict" is the SAME shape a
//    purely-mechanical review dispatch needs for `review-loop-cli.mjs` — not reused directly (the review CLI's
//    own output shape and outcome enum differ from `verify`'s), but the THREE-VALUED, never-flat-ok/not-ok
//    reading discipline this function models is exactly what `review-dispatch-wrapper.mjs`'s own read of
//    `review-loop-cli.mjs --json` follows.
// ================================================================================================

/**
 * REAL — routed through the DECLARED `verify` operation instead of a raw `verify-lane.mjs --json` shell-out.
 * THREE-VALUED: `pass` / `fail` / `unrun` — an operation-level crash, or a verdict whose `unrun` count is
 * nonzero while `failed` is zero (a stale/foreign/corrupt marker — an environment problem, not evidence of
 * anything wrong in a diff) must never collapse into `fail`. See `deliver-item-wrapper.mjs`'s own
 * `runVerifyOperation` docblock (unchanged here) for the full reasoning and the #3627 live-run finding this
 * discipline traces to.
 */
export function runVerifyOperation(lanePath, { run: runFn = run } = {}) {
  let out;
  try {
    out = runFn('node', ['scripts/operations/run.mjs', 'verify', `--checkout=${lanePath}`, '--json']);
  } catch (e) {
    return { outcome: 'unrun', detail: String(e.stdout || e.message || e), verdict: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch {
    return { outcome: 'unrun', detail: String(out), verdict: null };
  }
  const verdict = parsed.verdict || {};
  if (verdict.ok === true) return { outcome: 'pass', detail: null, verdict };
  const outcome = (Number(verdict.failed) || 0) > 0 ? 'fail' : 'unrun';
  return { outcome, detail: JSON.stringify(verdict.blocking ?? verdict, null, 2), verdict };
}
