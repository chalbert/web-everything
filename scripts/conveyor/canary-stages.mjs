/**
 * @file scripts/conveyor/canary-stages.mjs
 * @description x0nxuqd (epic #4075/#3383) — the PURE stage-evaluator core for the real end-to-end dispatch
 * canary (`we:scripts/conveyor/canary.mjs`). Given the spawned session's own transcript entries (the same
 * `summarizeEntry`-shaped rows `we:scripts/conveyor/hung-session.mjs` and
 * `we:skills-src/inspect-agent-health/agent-health.mjs` already produce) plus a handful of externally-observed
 * ground-truth facts (did the lane pool actually record a lease, did the branch actually land on origin, is the
 * `claude agents` listing still carrying this session, did cleanup actually happen), decides a PASS / FAIL /
 * PENDING verdict for each of the eight stages the canary reports:
 *
 *   spawned · no-permission-prompt · lane-acquired · edit-ok · gate-ran · pushed · session-finished · cleaned-up
 *
 * WHY A SEPARATE PURE MODULE (not folded into `canary.mjs`'s own IO shell): this is the one part of the whole
 * canary that unit tests can actually exercise without a real `claude --bg` spawn — feed it a constructed
 * transcript (a fixture) and a handful of booleans, and assert the verdict. `canary.mjs` itself does nothing
 * this file does not already decide; it only supplies the facts (transcript tail, lane-pool read, git read,
 * `claude agents` read) and prints/aggregates this file's answers.
 *
 * THE PERMISSION-PROMPT SIGNATURE, stated once here because it is the one stage this module exists to catch
 * that the fake-session soak harness cannot (PR #2701's live regression). A real permission prompt has no
 * transcript entry of its own — the CLI simply stops appending anything once it asks and nobody answers. The
 * one visible fact is a `tool_use` (typically `Edit`/`Write`/`MultiEdit`/`Bash`) with no matching `tool_result`
 * ANYWHERE in the tail, held past a grace window with no newer entry at all — exactly the shape
 * `we:skills-src/inspect-agent-health/agent-health.mjs#detectBlockedOnChild` already detects for the unrelated
 * "blocked on a nested Agent() call" case, and exactly the shape `we:scripts/conveyor/hung-session.mjs
 * #classifyHungSession` already grants EXTRA grace for ("still working a long foreground command"). This module
 * reuses that same "pending tool_use, aged past a threshold" signal but does NOT grant the hung-session's 3x
 * foreground-call grace: a permission prompt nobody will ever answer does not resolve itself given more time,
 * so the canary's own (much shorter) threshold is a deliberate STALL detector, not a "maybe still working"
 * detector — see {@link PERMISSION_PROMPT_TOOL_NAMES}.
 */

/** Tool names whose pending (unresolved) call, held past the grace window, reads as a permission-prompt stall
 *  rather than ordinary long-running work. Bounded to the file-mutating / shell tools a permission prompt can
 *  actually fire on — a pending `Read`/`Grep`/`Glob` is never gated by a permission prompt in this harness's
 *  target scenario (editing a freshly-acquired lane clone from a scratch cwd), so treating one as a stall
 *  signature would be a false positive on ordinary slow research. */
export const PERMISSION_PROMPT_TOOL_NAMES = Object.freeze(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash']);

/** Default grace (ms) before a pending file-mutating tool call reads as a permission-prompt stall rather than
 *  ordinary in-flight work. Short on purpose (see the file header): unlike a hung-session's foreground-call
 *  grace, this is not "maybe still working" — a real prompt never resolves itself, so there is nothing to wait
 *  out beyond long enough to rule out ordinary tool latency. */
export const DEFAULT_PERMISSION_PROMPT_GRACE_MS = 90 * 1000;

/** Every stage name, in report order — the canonical list both the evaluator and `canary.mjs`'s printer share,
 *  so a renamed/reordered stage cannot silently drift between the two. */
export const CANARY_STAGES = Object.freeze([
  'spawned',
  'no-permission-prompt',
  'lane-acquired',
  'edit-ok',
  'gate-ran',
  'pushed',
  'session-finished',
  'cleaned-up',
]);

/** One stage's verdict shape. `status` is `'pass'`, `'fail'`, or `'pending'` (not yet decidable — the overall
 *  run has not reached a point where this stage's answer is known one way or the other). */
function stage(name, status, detail) {
  return { name, status, detail: detail || '' };
}

/**
 * PURE: does `entries` (a bounded transcript tail, `summarizeEntry`-shaped — see the file header) show a
 * permission-prompt-shaped stall — a file-mutating tool call ({@link PERMISSION_PROMPT_TOOL_NAMES}) left
 * pending (no matching `tool_result` anywhere in the tail), with no NEWER entry of any kind appended since, for
 * at least `graceMs`.
 *
 * `newestEntryAtMs` is the transcript's own newest embedded timestamp (mirrors `hung-session.mjs`'s own
 * "trust the transcript's own timestamps over the file mtime" discipline) — the caller resolves it once and
 * passes it in, so this stays a pure function of its inputs, no clock/fs read here.
 *
 * @param {{entries:Array<object>, nowMs:number, newestEntryAtMs:number|null, graceMs?:number}} o
 * @returns {{stalled:boolean, toolName:string|null, ageMs:number|null}}
 */
export function detectPermissionPromptStall({ entries, nowMs, newestEntryAtMs, graceMs = DEFAULT_PERMISSION_PROMPT_GRACE_MS }) {
  if (!Array.isArray(entries) || !entries.length) return { stalled: false, toolName: null, ageMs: null };
  if (!Number.isFinite(newestEntryAtMs)) return { stalled: false, toolName: null, ageMs: null };
  const ageMs = nowMs - newestEntryAtMs;
  if (ageMs < graceMs) return { stalled: false, toolName: null, ageMs };

  const resultIds = new Set();
  for (const e of entries) for (const b of e.blocks || []) if (b.kind === 'tool_result') resultIds.add(b.toolUseId);

  // Walk back to the newest tool-bearing entry (mirrors `detectBlockedOnChild`'s own walk) and check whether
  // any of ITS tool_use calls are both unresolved AND a file-mutating tool name.
  for (let i = entries.length - 1; i >= 0; i--) {
    const toolUses = (entries[i].blocks || []).filter((b) => b.kind === 'tool_use');
    if (!toolUses.length) continue;
    const pending = toolUses.filter((b) => !resultIds.has(b.id) && PERMISSION_PROMPT_TOOL_NAMES.includes(b.name));
    if (!pending.length) return { stalled: false, toolName: null, ageMs };
    return { stalled: true, toolName: pending[0].name, ageMs };
  }
  return { stalled: false, toolName: null, ageMs };
}

/**
 * PURE: has `entries` produced a resolved (non-error) `tool_result` whose content matches `pattern` anywhere in
 * the tail? Used for both "lane acquired" (a Bash result containing `acquired lane-<N>`) and "gate ran" (a
 * result containing the gate's own green marker). Returns the matching detail line, or null.
 * @param {Array<object>} entries
 * @param {RegExp} pattern
 * @returns {string|null}
 */
function findResolvedResultMatching(entries, pattern) {
  for (const e of entries) {
    for (const b of e.blocks || []) {
      if (b.kind === 'tool_result' && !b.isError && pattern.test(String(b.content || ''))) return b.content;
    }
  }
  return null;
}

/** Lane-acquire evidence pattern — matches `lane-pool.mjs`'s own stdout (`"acquired lane-49 for ..."`). */
export const LANE_ACQUIRED_RE = /acquired lane-\d+/i;

/** Gate-green evidence pattern — matches either a direct gate run's own success line or a `verify-lane check`
 *  read reporting `status":"green"` / `status: green`. */
export const GATE_GREEN_RE = /"status"\s*:\s*"green"|status:\s*green\b|check:standards[^\n]*(pass|ok|✓)/i;

/**
 * THE EVALUATOR. PURE — every fact is a parameter, nothing here reads a clock, a file, or an env var.
 *
 * @param {object} o
 * @param {boolean} o.spawned - did the dispatch call itself return an `inFlight` handle (no throw)?
 * @param {Array<object>} [o.entries] - bounded transcript tail (`summarizeEntry`-shaped rows), oldest-first.
 * @param {number} o.nowMs
 * @param {number} [o.newestEntryAtMs] - transcript's own newest embedded timestamp, or null/undefined if none.
 * @param {number} [o.promptStallGraceMs]
 * @param {boolean|null} [o.laneAcquiredGroundTruth] - an authoritative lane-pool read (a live lease exists for
 *   this run), when the caller has one; null/undefined falls back to the transcript-inferred signal only.
 * @param {boolean|null} [o.pushedGroundTruth] - an authoritative `git ls-remote` read for the canary branch.
 * @param {boolean|null} [o.sessionFinished] - is the session ABSENT from a fresh `claude agents --json` read
 *   (and old enough that "not yet listed" is ruled out)? null while still undecided.
 * @param {{laneReleased:boolean|null, branchDeleted:boolean|null, scratchReaped:boolean|null}} [o.cleanup]
 * @param {boolean} [o.timedOut] - has the canary's own overall bounded watch run out? Turns every remaining
 *   `pending` stage into a `fail` (never leaves the report silently incomplete).
 * @returns {{stages:Array<{name:string,status:string,detail:string}>, overall:'pass'|'fail'|'pending'}}
 */
export function evaluateCanaryStages({
  spawned,
  entries = [],
  nowMs,
  newestEntryAtMs = null,
  promptStallGraceMs = DEFAULT_PERMISSION_PROMPT_GRACE_MS,
  laneAcquiredGroundTruth = null,
  pushedGroundTruth = null,
  sessionFinished = null,
  cleanup = {},
  timedOut = false,
}) {
  const stages = [];

  // 1. spawned — known immediately, never pending.
  stages.push(stage('spawned', spawned ? 'pass' : 'fail', spawned ? 'dispatch effect returned a handle' : 'dispatch effect threw before any process existed'));
  if (!spawned) {
    // Nothing downstream can have happened — every later stage is a hard fail, not merely pending, so the
    // report never implies a chance one of them still might.
    for (const name of CANARY_STAGES.slice(1)) stages.push(stage(name, 'fail', 'never reached — spawn itself failed'));
    return { stages, overall: 'fail' };
  }

  // 2. no-permission-prompt — the one stage this canary exists to catch (#2701).
  const promptStall = detectPermissionPromptStall({ entries, nowMs, newestEntryAtMs, graceMs: promptStallGraceMs });
  if (promptStall.stalled) {
    stages.push(stage('no-permission-prompt', 'fail', `pending ${promptStall.toolName} call unresolved for ${Math.round(promptStall.ageMs / 1000)}s — reads as an unanswered permission prompt`));
  } else if (sessionFinished === true || laneAcquiredGroundTruth === true) {
    stages.push(stage('no-permission-prompt', 'pass', 'no unresolved file-mutating tool call past the stall grace'));
  } else {
    stages.push(stage('no-permission-prompt', timedOut ? 'fail' : 'pending', timedOut ? 'timed out before a clear signal either way' : 'not yet decidable'));
  }

  // 3. lane-acquired — ground truth wins when the caller has it; else infer from the transcript.
  const laneEvidence = findResolvedResultMatching(entries, LANE_ACQUIRED_RE);
  if (laneAcquiredGroundTruth === true || laneEvidence) {
    stages.push(stage('lane-acquired', 'pass', laneEvidence || 'lane-pool read confirmed a live lease for this run'));
  } else if (laneAcquiredGroundTruth === false && (sessionFinished === true || timedOut)) {
    stages.push(stage('lane-acquired', 'fail', 'session ended (or the canary timed out) with no recorded lease'));
  } else {
    stages.push(stage('lane-acquired', timedOut ? 'fail' : 'pending', timedOut ? 'timed out with no lane recorded' : 'not yet decidable'));
  }
  const laneOk = stages[stages.length - 1].status === 'pass';

  // 4. edit-ok — a resolved (non-error) Edit/Write/MultiEdit tool_result, only meaningful once the lane exists.
  const editResolved = entries.some((e) => (e.blocks || []).some((b) => b.kind === 'tool_result' && !b.isError
    && entries.some((e2) => (e2.blocks || []).some((tu) => tu.kind === 'tool_use' && tu.id === b.toolUseId && PERMISSION_PROMPT_TOOL_NAMES.includes(tu.name) && tu.name !== 'Bash'))));
  if (editResolved) {
    stages.push(stage('edit-ok', 'pass', 'an Edit/Write/MultiEdit tool call resolved without error'));
  } else if (!laneOk) {
    stages.push(stage('edit-ok', timedOut ? 'fail' : 'pending', 'lane not yet acquired'));
  } else if (sessionFinished === true || timedOut) {
    stages.push(stage('edit-ok', 'fail', 'lane acquired but no resolved edit ever appeared'));
  } else {
    stages.push(stage('edit-ok', 'pending', 'not yet decidable'));
  }
  const editOk = stages[stages.length - 1].status === 'pass';

  // 5. gate-ran — a resolved result carrying the gate's own green marker.
  const gateEvidence = findResolvedResultMatching(entries, GATE_GREEN_RE);
  if (gateEvidence) {
    stages.push(stage('gate-ran', 'pass', gateEvidence));
  } else if (!editOk) {
    stages.push(stage('gate-ran', timedOut ? 'fail' : 'pending', 'edit not yet confirmed'));
  } else if (sessionFinished === true || timedOut) {
    stages.push(stage('gate-ran', 'fail', 'edit confirmed but no green-gate evidence ever appeared'));
  } else {
    stages.push(stage('gate-ran', 'pending', 'not yet decidable'));
  }
  const gateOk = stages[stages.length - 1].status === 'pass';

  // 6. pushed — ground truth (a real `git ls-remote` of the throwaway branch) is the only real evidence; the
  // transcript's own "git push" tool call resolving without error is corroborating but not sufficient (a push
  // can be rejected non-fast-forward and still print a resolved, non-`is_error` tool_result in some shells).
  if (pushedGroundTruth === true) {
    stages.push(stage('pushed', 'pass', 'the canary branch exists on origin'));
  } else if (!gateOk) {
    stages.push(stage('pushed', timedOut ? 'fail' : 'pending', 'gate not yet confirmed green'));
  } else if (sessionFinished === true || timedOut) {
    stages.push(stage('pushed', 'fail', 'gate was green but the canary branch never appeared on origin'));
  } else {
    stages.push(stage('pushed', 'pending', 'not yet decidable'));
  }
  const pushed = stages[stages.length - 1].status === 'pass';

  // 7. session-finished — a straight ground-truth read (absence from `claude agents --json`, aged past its own
  // listing grace — the caller resolves that, this just takes the answer).
  if (sessionFinished === true) {
    stages.push(stage('session-finished', 'pass', 'no longer listed by `claude agents --json`'));
  } else if (timedOut) {
    stages.push(stage('session-finished', 'fail', 'still listed (or listing unreadable) when the canary\'s own bounded watch ran out'));
  } else {
    stages.push(stage('session-finished', 'pending', 'still running or not yet checked'));
  }
  const finished = stages[stages.length - 1].status === 'pass';

  // 8. cleaned-up — every one of the three cleanup facts, only meaningful once the session is actually done.
  //
  // `!finished` is checked FIRST, before `allTrue` — deliberately, and this order is itself load-bearing
  // (caught live, x0nxuqd's own first real run): a canary that gives up on a session STILL confirmed alive
  // (the exact #2701 permission-prompt-stall shape — the process never finishes on its own) must never report
  // `cleaned-up: pass` merely because nothing was ever acquired/pushed to begin with (three vacuous `true`s).
  // "Nothing to clean up because we never got far enough" and "everything we needed to clean up, we cleaned
  // up" are different facts, and only the second one earns a pass — checking `finished` first is what keeps
  // them apart instead of letting an all-vacuous-true cleanup masquerade as a real one.
  const { laneReleased = null, branchDeleted = null, scratchReaped = null } = cleanup || {};
  const cleanupFacts = { laneReleased, branchDeleted, scratchReaped };
  const allTrue = Object.values(cleanupFacts).every((v) => v === true);
  const anyKnownFalse = Object.values(cleanupFacts).some((v) => v === false);
  if (!finished) {
    stages.push(stage('cleaned-up', timedOut ? 'fail' : 'pending', 'session not yet finished — a still-alive session\'s own files are deliberately left alone rather than deleted out from under it'));
  } else if (allTrue) {
    stages.push(stage('cleaned-up', 'pass', 'lane released, branch deleted, scratch folder reaped'));
  } else if (anyKnownFalse || timedOut) {
    const remaining = Object.entries(cleanupFacts).filter(([, v]) => v !== true).map(([k]) => k);
    stages.push(stage('cleaned-up', 'fail', `left behind: ${remaining.join(', ') || 'unknown'}`));
  } else {
    stages.push(stage('cleaned-up', 'pending', 'cleanup not yet attempted'));
  }

  const anyFail = stages.some((s) => s.status === 'fail');
  const anyPending = stages.some((s) => s.status === 'pending');
  const overall = anyFail ? 'fail' : anyPending ? 'pending' : 'pass';
  return { stages, overall };
}
