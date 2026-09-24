/**
 * hung-session.mjs — shared pure-core/IO-shell "hung session" detection (epic #3383 continuation).
 *
 * WHY THIS EXISTS (root cause, live 2026-09-24, chalbert/web-everything#2599/#2596/#2594/#2588/#2587/#2582).
 * `skills-src/review/review-agent-brief.md` tells a review agent, IN PROSE, to self-report
 * `status: done, outcome: blocked-on-infra` via `scripts/operations/completion-cli.mjs` before it exits on an
 * infra failure. Under stress (a crash, an unhandled error) an agent can exit WITHOUT ever running that
 * command, so its completion record is stuck at `status: started` forever. Two existing mechanisms depend on
 * that self-report and therefore never fire for such a session:
 *   - `we:scripts/conveyor/reconcile-core.mjs#markSelfReportedDone` (only acts once `rec.status === 'done'`).
 *   - `we:scripts/conveyor/session-reaper.mjs#classifySessionReapWithGroundTruth`'s axis 1
 *     (`completionFor(name)` → `record.done === true`).
 * The ONLY remaining path, session-reaper's axis 3 idle-timeout backstop, is a 6-HOUR last resort gated to
 * `state === 'blocked'` ONLY — it can never catch a session the listing still reports as `state: 'working'`.
 *
 * This module is a THIRD, MECHANICAL signal that never depends on the dispatched agent doing anything: the
 * session's OWN transcript file on disk simply stops growing when nothing is actually happening, self-report
 * or not. It is deliberately separate from, and does not touch, `assessLiveness`'s PR-level `transcriptMtimeMs`
 * evidence field (see that function's own pinned docblock/tests — freshness never grants liveness and
 * staleness never withdraws it, ON PURPOSE, for THAT field). This is a different fact about a different
 * object: not "how stale does the PR's transcript evidence look", but "has THIS session's own transcript file
 * been written to at all lately" — consumed as a new, separately-named `hung` flag on AGENT rows, never folded
 * into that pinned function.
 *
 * PURE CORE: {@link classifyHungSession} — given the transcript's last known real activity, now, a threshold,
 * and whether the newest transcript entry is a still-pending tool_use, decides hung/not. Every fact is a
 * parameter; no IO, no env, no clock read internally, per this codebase's pure/IO-shell law.
 *
 * IO SHELL: {@link readHungInfo} — resolves ONE session's own transcript path via
 * `we:scripts/operations/agent-usage-report.mjs#resolveSessionTranscript` (REUSED, not re-derived — it already
 * builds `~/.claude/projects/<slugified-cwd>/<sessionId>.jsonl` and falls back to a full-store scan by session
 * id), reads a BOUNDED tail (`tailLines`, never the whole file) via
 * `we:skills-src/inspect-agent-health/agent-health.mjs`, and asks that same file's `detectBlockedOnChild`
 * whether the newest tool-bearing entry has an unresolved call. WIDENS those exports rather than growing a
 * private reimplementation, matching this repo's own "WIDEN, do not grow a private copy" law
 * (`reconcile-core.mjs`'s own docblock states it verbatim).
 *
 * `lastActivityMs` PREFERS THE TRANSCRIPT'S OWN EMBEDDED ENTRY TIMESTAMPS OVER THE FILE'S mtime, and this is
 * load-bearing, not a style choice — MEASURED LIVE while building this axis (chalbert/web-everything
 * `review-2599`'s real transcript, 2026-09-24): its last real JSONL line carried `timestamp:
 * "2026-09-24T18:46:09Z"`, while `fs.statSync` on the very same file reported an `mtime` almost THREE HOURS
 * LATER. Something in this environment can bump a transcript file's mtime with no new content (a backup pass,
 * an indexing touch, a filesystem sync — the exact mechanism was not identified, only the effect). Trusting
 * mtime alone would have read that session as freshly active when its own content proves it went silent hours
 * earlier — precisely the false negative this axis exists to avoid. So `readHungInfo` takes the NEWEST
 * parseable `timestamp` field off the entries in the tail as ground truth, and consults the file's mtime only
 * as a last-resort fallback when nothing in the tail carries one at all (an all-metadata tail, or every line
 * failing to parse).
 *
 * Any read failure (missing file, unreadable store, no `cwd`/`sessionId` on the row) answers
 * `{ hung: false, reason: 'no-signal' }` — ABSENCE OF A TRANSCRIPT IS NEVER EVIDENCE OF HUNG, mirroring every
 * other resolver in this codebase (`markSelfReportedDone`'s "no record ⇒ untouched", session-reaper's
 * completion/ground-truth resolvers' "any read failure answers null, never a guess").
 *
 * {@link resolveHungThresholdMs} reads `WE_HUNG_TRANSCRIPT_MINUTES` (mirrors the `WE_BACKLOG_DIR`/
 * `OPERATION_COMPLETIONS_DIR` naming convention), default 30 minutes. The env lookup lives ONLY here, in the IO
 * shell; the pure core takes `thresholdMs` as a plain parameter.
 *
 * Imported by BOTH `we:scripts/conveyor/reconcile-core.mjs`'s `markHungSessions` pre-pass and
 * `we:scripts/conveyor/session-reaper.mjs`'s hung axis, so there is exactly ONE implementation of "is this
 * session's transcript stale", not two.
 */
import { statSync } from 'node:fs';
import { tailLines, summarizeEntry, detectBlockedOnChild } from '../../skills-src/inspect-agent-health/agent-health.mjs';
import { resolveSessionTranscript } from '../operations/agent-usage-report.mjs';

/** Default hung threshold (30 minutes) when `WE_HUNG_TRANSCRIPT_MINUTES` is unset/invalid. */
export const DEFAULT_HUNG_THRESHOLD_MS = 30 * 60 * 1000;

/**
 * How much EXTRA grace (as a multiple of `thresholdMs`) a session gets when its newest transcript entry is a
 * still-unresolved tool_use — i.e. it may genuinely be mid a long foreground call (e.g. a `verify-lane` run)
 * rather than dead. Conservative on purpose, per this axis's own charter ("do not flag a session that's
 * genuinely still working a long foreground command"): a session with a PENDING call gets 3x the base
 * threshold before it is flagged hung too; a session with nothing pending — plain silence, no excuse — gets
 * no extra grace at all.
 */
export const PENDING_CALL_GRACE_MULTIPLIER = 3;

// Bounded read — never the whole file. This axis only needs to know whether the newest tool-bearing entry
// is still unresolved, which a short tail already answers; see `tailLines`'s own hard ceilings for why an
// unbounded read is never the right shape here regardless.
const READ_TAIL_LINES = 15;
const READ_MAX_BYTES = 400_000;
const READ_FIELD_MAX = 200;

/**
 * we:scripts/conveyor/hung-session.mjs#classifyHungSession — PURE. See file header for the full contract.
 * `lastActivityMs` is the newest known real activity — see {@link readHungInfo} for why this is the
 * transcript's OWN embedded entry timestamp, preferred over the file's mtime, not the raw mtime itself.
 * @param {{lastActivityMs:number, nowMs:number, thresholdMs:number, pendingToolUse?:boolean}} o
 * @returns {{hung:boolean, reason:string, ageMs:number|null}}
 */
export function classifyHungSession({ lastActivityMs, nowMs, thresholdMs, pendingToolUse = false } = {}) {
  if (!Number.isFinite(lastActivityMs) || !Number.isFinite(nowMs) || !Number.isFinite(thresholdMs) || thresholdMs <= 0) {
    return { hung: false, reason: 'no-signal', ageMs: null };
  }
  const ageMs = nowMs - lastActivityMs;
  if (ageMs < thresholdMs) return { hung: false, reason: 'fresh', ageMs };
  if (pendingToolUse && ageMs < thresholdMs * PENDING_CALL_GRACE_MULTIPLIER) {
    return { hung: false, reason: 'pending-foreground-call-within-grace', ageMs };
  }
  return { hung: true, reason: pendingToolUse ? 'stale-with-pending-call-past-grace' : 'stale-no-activity', ageMs };
}

/**
 * `WE_HUNG_TRANSCRIPT_MINUTES` → ms, floor-clamped to 1 minute so a bad env value can't silently disable this
 * axis by going zero/negative; falls back to {@link DEFAULT_HUNG_THRESHOLD_MS} on anything unset/unparsable.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function resolveHungThresholdMs(env = process.env) {
  const raw = env?.WE_HUNG_TRANSCRIPT_MINUTES;
  const n = Number(raw);
  if (raw === undefined || raw === '' || !Number.isFinite(n) || n <= 0) return DEFAULT_HUNG_THRESHOLD_MS;
  return Math.max(1, n) * 60 * 1000;
}

/**
 * we:scripts/conveyor/hung-session.mjs#readHungInfo — THE IO SHELL for one session (a `claude agents --json`
 * row, or a session-reaper listing row — both carry `cwd`+`sessionId`). NEVER throws; any failure to locate or
 * read the transcript answers `{ hung: false, reason: 'no-signal' }` rather than guessing.
 * @param {{cwd?:string, sessionId?:string}} agent
 * @param {number} nowMs
 * @param {number} thresholdMs
 * @returns {{hung:boolean, reason:string, ageMs:number|null, transcriptPath?:string}}
 */
export function readHungInfo(agent, nowMs, thresholdMs) {
  const cwd = agent?.cwd, sessionId = agent?.sessionId;
  if (!cwd || !sessionId) return { hung: false, reason: 'no-signal', ageMs: null };

  let file;
  try {
    file = resolveSessionTranscript({ session: String(sessionId), cwd: String(cwd) });
  } catch {
    return { hung: false, reason: 'no-signal', ageMs: null }; // no transcript found — never guess hung
  }

  let entries;
  try {
    const { lines } = tailLines(file, READ_TAIL_LINES, READ_MAX_BYTES);
    entries = lines.map((l) => summarizeEntry(l, READ_FIELD_MAX));
  } catch {
    return { hung: false, reason: 'no-signal', ageMs: null }; // unreadable transcript — never guess hung
  }

  // The newest PARSEABLE entry timestamp in the tail is ground truth — see the file header for why this beats
  // the file's own mtime. Only when NOTHING in the tail carries one (an all-metadata tail, or every line
  // failing to parse) does this fall back to mtime, as a last resort rather than refusing the whole signal.
  let lastActivityMs = null;
  for (const e of entries) {
    const t = Date.parse(e?.ts ?? '');
    if (Number.isFinite(t) && (lastActivityMs === null || t > lastActivityMs)) lastActivityMs = t;
  }
  if (lastActivityMs === null) {
    try {
      lastActivityMs = statSync(file).mtimeMs;
    } catch {
      return { hung: false, reason: 'no-signal', ageMs: null };
    }
  }

  const pendingToolUse = detectBlockedOnChild(entries).pending === true;
  const verdict = classifyHungSession({ lastActivityMs, nowMs, thresholdMs, pendingToolUse });
  return { ...verdict, transcriptPath: file };
}
