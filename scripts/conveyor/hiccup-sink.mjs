/**
 * @file scripts/conveyor/hiccup-sink.mjs
 * @description The MECHANICAL SINK for classified delivery hiccups (#3421, Done-when #2). Writes a blocking
 *   hiccup ({@link ../conveyor/hiccup-classify.mjs}) into the SAME learnings-pool store
 *   scripts/conveyor/learnings-drop.mjs already writes to (never a parallel store) — a `friction` entry
 *   stamped `blocking:true`, carrying the classifier's generalized `proposedFix` and `approvalPending:true`.
 *   Non-blocking hiccups need no sink of their own: they are the PRE-EXISTING learnings-drop shape (kind +
 *   summary/area/suggestion, no `blocking` field), filed straight through by the delivery-agent brief's own
 *   step 9 exactly as before — this file only exists for the NEW blocking path.
 *
 *   IDEMPOTENT BY SUMMARY (not a new dedup mechanism — the pool is append-only JSONL, so "already filed"
 *   means "an unresolved blocking entry with this exact summary already sits in this session's pool file").
 *   A guard suppression can persist across many ticks until its TTL retires it; without this check the
 *   mechanical runner pass (skills-src/conveyor/runner.mjs) would file one entry PER TICK for the same
 *   suppressed item, flooding the pool. The summary text is deterministic per (kind, num, by) — see
 *   {@link guardSuppressionSummary} / {@link freeFormReturnSummary} — so an exact match is a safe, cheap key.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { appendEntry, resolveDropboxPath } from './learnings-drop.mjs';
import { approvalsPath, readApprovals, isApproved } from './hiccup-approve.mjs';

export const DEFAULT_RUNNER_SESSION = 'conveyor-runner';

/** The deterministic summary for a #3416-shaped guard-suppression hiccup — also this entry's dedup key. */
export function guardSuppressionSummary({ num, by }) {
  return `Dispatch for #${num} suppressed by the live in-flight guard (${by}) — tick did not proceed.`;
}

/** The deterministic summary for a #3412-shaped free-form-response hiccup — also this entry's dedup key. */
export function freeFormReturnSummary({ num }) {
  return `Dispatched agent for #${num != null ? num : '?'} returned free-form prose instead of a predefined structured response.`;
}

function summaryFor(hiccup) {
  if (hiccup.kind === 'guard-suppression') return guardSuppressionSummary(hiccup);
  if (hiccup.kind === 'free-form-response') return freeFormReturnSummary(hiccup);
  throw new Error(`hiccup-sink: unknown hiccup kind ${JSON.stringify(hiccup.kind)}`);
}

/** readPoolLines(path) → parsed records, skipping blank/malformed lines. Line-tolerant (a torn line is
 *  skipped, never fatal) — mirrors readPool's own tolerance in learnings-harvest.mjs. */
function readPoolLines(path) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a torn line */ }
  }
  return out;
}

/** isUnresolvedDuplicate(records, summary, session, approvals) → true when `records` already contains an
 *  UNRESOLVED blocking entry with this exact summary. An APPROVED entry (per hiccup-approve.mjs's store)
 *  does NOT count — a genuine recurrence after approval must be re-filed, not silently swallowed as
 *  "already filed" forever (#3421 review fix: the original check matched ANY blocking entry regardless of
 *  resolution). */
function isUnresolvedDuplicate(records, summary, session, approvals) {
  for (const rec of records) {
    if (!rec || rec.blocking !== true || rec.summary !== summary) continue;
    if (!isApproved({ session, ts: rec.ts }, approvals)) return true;
  }
  return false;
}

/** maxTsMs(records) → the latest `ts` (as epoch ms) among `records`, or null when empty. Used to keep
 *  newly-filed timestamps strictly increasing within one pool file — see fileHiccup's collision-avoidance
 *  comment. */
function maxTsMs(records) {
  let max = null;
  for (const rec of records) {
    const ms = rec && typeof rec.ts === 'string' ? Date.parse(rec.ts) : NaN;
    if (Number.isFinite(ms) && (max == null || ms > max)) max = ms;
  }
  return max;
}

/**
 * fileHiccup(hiccup, opts) → append ONE blocking learnings entry for a classified hiccup (from
 * classifySuppressedBuilds / classifyAgentReturn), unless an identical unresolved entry is already filed for
 * this session (see module doc). Total — never throws for the "already filed" case; a genuinely malformed
 * hiccup still throws via `appendEntry`'s own validation (a caller bug, not a runtime condition to swallow).
 * @param {{kind:string, num:*, area:string, proposedFix:string, [x:string]:*}} hiccup
 * @param {{file?:string, session?:string, now?:*}} [opts]
 * @returns {{ filed:boolean, path:string, record?:object }}
 */
export function fileHiccup(hiccup, opts = {}) {
  const session = opts.session || DEFAULT_RUNNER_SESSION;
  const summary = summaryFor(hiccup);
  const path = resolveDropboxPath({ file: opts.file, session });
  // ONE read of the pool file feeds both checks below (review fix: the first pass read it twice).
  const records = readPoolLines(path);
  const approvals = readApprovals(approvalsPath({ dir: dirname(path) }));
  if (isUnresolvedDuplicate(records, summary, session, approvals)) return { filed: false, path };
  // Strictly-increasing `ts` per pool file (#3421 review fix): hiccup-approve.mjs keys an approval on
  // `<session>#<ts>` alone, so two entries sharing a millisecond-resolution timestamp would share one
  // approval key — approving one would silently approve the other too, unseen.
  const candidateMs = opts.now != null ? new Date(opts.now).getTime() : Date.now();
  const maxMs = maxTsMs(records);
  const now = maxMs != null && candidateMs <= maxMs ? maxMs + 1 : candidateMs;
  const { record } = appendEntry({
    kind: 'friction',
    summary,
    area: hiccup.area || 'conveyor dispatch',
    suggestion: 'A repeat suppression / free-form return on the same item may need a code fix, not just a re-dispatch — investigate before approving.',
    blocking: true,
    proposedFix: hiccup.proposedFix,
    approvalPending: true,
  }, { file: opts.file, session, now });
  return { filed: true, path, record };
}

/**
 * fileHiccups(hiccups, opts) → fileHiccup over a batch, tolerant of one bad hiccup (mirrors the mechanical
 * runner pass's "best-effort; a failure never wedges the tick" contract) — a single malformed record is
 * skipped and reported in `errors`, not thrown.
 * @returns {{ filed:number, skipped:number, errors:Array<{hiccup:object, message:string}> }}
 */
export function fileHiccups(hiccups, opts = {}) {
  let filed = 0;
  let skipped = 0;
  const errors = [];
  for (const h of Array.isArray(hiccups) ? hiccups : []) {
    try {
      const r = fileHiccup(h, opts);
      if (r.filed) filed++; else skipped++;
    } catch (e) {
      errors.push({ hiccup: h, message: String(e && e.message || e) });
    }
  }
  return { filed, skipped, errors };
}
