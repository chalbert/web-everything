#!/usr/bin/env node
/**
 * pipeline-trace.mjs — the ONE shared per-item pipeline TRACE GRAMMAR (#2818).
 *
 * WHY: the delivery pipeline already PRODUCES rich step-level detail (the jury ledger's per-round events, the
 * drain's escalation reason + disposition, plateau-app's drain-daemon history) — almost none of it is SURFACED
 * as one coherent per-item timeline. This module is the ONE normalizer that folds each of those existing,
 * already-tested ledgers into a single `Step` shape, so a future renderer (plateau-app, out of scope here —
 * WE holds zero standard implementation, MEMORY #6) never re-derives any of them itself.
 *
 * REUSE, NEVER RE-DERIVE (the #2641 guardrail, extended here): `reviewStepFromLedger` calls
 * `we:scripts/lib/jury-ledger.mjs`'s `foldJuryLedger` UNCHANGED — a second copy of the fold logic here would be
 * exactly the bug #2641 already ruled against. This module only adds a timestamp-span derivation ALONGSIDE the
 * fold (the fold itself discards each event's `at`), never a parallel reconstruction of the ledger.
 *
 * `landStepFromHistoryEntries` never reads `plateau:.drain-daemon/history.jsonl` itself — it takes already-parsed
 * rows as a parameter. WE holds zero implementation of that read (MEMORY #6); the fs boundary stays in
 * plateau-app, mirroring how #2470/#2500 kept it there.
 *
 * A DATA grammar, distinct from the ratified VISUAL card grammar (#2789/#2554 — the console-board's single box +
 * tokens): this module answers "what shape is one step's data", not "what box renders it". A future renderer
 * should reuse that box; it must not reuse this shape as if it were the same decision.
 *
 * PURE-CORE / IO-SHELL: every export below is a pure, tolerant, never-throwing normalizer/builder — a step that
 * cannot be built (malformed or missing input) degrades to `status: 'unknown'` rather than crashing the trace.
 * The `assemble` CLI (gated on direct invocation, mirroring jury-ledger.mjs's `--file`/stdin shape) is the one
 * fs/stdin-touching shell, for a caller (the plateau-app dev-panel proxy) that already shells `review-detail.mjs`
 * and `jury-ledger.mjs show` to gather the three raw inputs and wants one combined `{ steps: [...] }` back.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { foldJuryLedger } from './jury-ledger.mjs';
import { writeAllSync } from './write-all-sync.mjs';

/** The step lifecycle statuses `normalizeStep` accepts as-is; anything else degrades to `'unknown'`. */
const VALID_STATUSES = new Set(['pending', 'running', 'done', 'landed', 'parked', 'unknown', 'not-yet-traced']);

/**
 * The ONE shape every pipeline stage normalizes into. PURE, tolerant of any input shape — never throws, never
 * reads a field that could be attacker/PR-authored text and treats it as anything but a string.
 * @typedef {{
 *   name: string, status: 'pending'|'running'|'done'|'landed'|'parked'|'unknown'|'not-yet-traced',
 *   verdict: string|null, reasons: string[], careLevel?: string, rounds?: number,
 *   actor: string, startedAt: string|null, endedAt: string|null, detail?: object,
 * }} Step
 * @param {object} [raw]
 * @returns {Step}
 */
export function normalizeStep(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const step = {
    name: typeof r.name === 'string' ? r.name : '',
    status: VALID_STATUSES.has(r.status) ? r.status : 'unknown',
    verdict: typeof r.verdict === 'string' ? r.verdict : null,
    reasons: Array.isArray(r.reasons) ? r.reasons.filter((x) => typeof x === 'string') : [],
    actor: typeof r.actor === 'string' ? r.actor : '',
    startedAt: typeof r.startedAt === 'string' ? r.startedAt : null,
    endedAt: typeof r.endedAt === 'string' ? r.endedAt : null,
  };
  if (typeof r.careLevel === 'string') step.careLevel = r.careLevel;
  if (Number.isFinite(r.rounds)) step.rounds = r.rounds;
  if (r.detail && typeof r.detail === 'object' && !Array.isArray(r.detail)) step.detail = r.detail;
  return step;
}

/** Sort a batch of ISO-8601 `at` strings and return `{ startedAt, endedAt }` (both `null` on an empty batch).
 *  Lexical sort is chronological for same-format ISO-8601 UTC strings — no `Date` parsing needed. Pure. */
function timestampSpan(values) {
  const ats = (Array.isArray(values) ? values : []).filter((v) => typeof v === 'string' && v).sort();
  return { startedAt: ats.length ? ats[0] : null, endedAt: ats.length ? ats[ats.length - 1] : null };
}

/**
 * The REVIEW step, folded from a subject's raw jury-ledger event stream. Calls `foldJuryLedger` UNCHANGED (the
 * #2641 guardrail) and separately derives `startedAt`/`endedAt` as the min/max `at` across the RAW stream — the
 * fold itself discards timestamps, so this is a new derivation alongside it, never a fold edit. `rounds` is the
 * ledger's 0-based `round` widened to the loop's 1-based count (`ledger.round + 1`, matching
 * `buildReviewLedgerEvents`'s own 1-based→0-based convention, inverted). `status`: `'pending'` before any roster
 * is seated, `'done'` once the panel has reached a verdict, `'running'` in between.
 * @param {object[]} events - raw (unfolded) jury-ledger events, as read from a subject's durable `.jsonl` log.
 * @returns {Step}
 */
export function reviewStepFromLedger(events) {
  // A structurally-invalid input (not an array at all — e.g. missing, null, or the wrong type) is MALFORMED, not
  // "a real empty log": it degrades to 'unknown' (the Done-when contract). A validly-shaped empty array (`[]`,
  // meaning "no events recorded yet") is real data, not malformed, and folds normally below to 'pending'.
  if (!Array.isArray(events)) return normalizeStep({ name: 'review', status: 'unknown', actor: 'jury' });
  const raw = events;
  let ledger = null;
  try { ledger = foldJuryLedger(raw); } catch { ledger = null; }
  if (!ledger) return normalizeStep({ name: 'review', status: 'unknown', actor: 'jury' });

  const { startedAt, endedAt } = timestampSpan(raw.map((e) => e && e.at));
  const status = !ledger.rosterKnown ? 'pending' : ledger.panelVerdict != null ? 'done' : 'running';
  return normalizeStep({
    name: 'review',
    status,
    verdict: ledger.panelVerdict ?? null,
    actor: 'jury',
    rounds: ledger.round + 1,
    startedAt,
    endedAt,
    detail: ledger,
  });
}

/**
 * The DRAIN-ESCALATION step, from the widened `we:scripts/review-detail.mjs`'s `assembleReviewDetail` output
 * (#2818's own task 1 — `careLevel`/`advisoryCommentAt`/`humanCommentAt`). Carries `careLevel` straight through
 * (never re-derived here — `assembleReviewDetail` already computed it via `careLevelFromReasons`). `endedAt`
 * prefers the human-verdict comment's timestamp, falling back to the advisory comment's, `null` when neither
 * exists (mirrors `assembleReviewDetail`'s own null convention). `status`: `'parked'` when the PR carries any
 * escalation reason, `'unknown'` otherwise (never escalated, or not yet observed).
 * @param {object} detail - `assembleReviewDetail`'s return shape (or any subset of it — every field is optional).
 * @returns {Step}
 */
export function escalationStepFromReviewDetail(detail) {
  const d = detail && typeof detail === 'object' ? detail : {};
  const reasons = Array.isArray(d.escalationReason) ? d.escalationReason : [];
  const endedAt = typeof d.humanCommentAt === 'string'
    ? d.humanCommentAt
    : typeof d.advisoryCommentAt === 'string' ? d.advisoryCommentAt : null;
  const mode = d.disposition && typeof d.disposition === 'object' && typeof d.disposition.mode === 'string'
    ? d.disposition.mode
    : null;
  return normalizeStep({
    name: 'escalation',
    status: reasons.length ? 'parked' : 'unknown',
    verdict: mode,
    reasons,
    careLevel: typeof d.careLevel === 'string' ? d.careLevel : undefined,
    actor: 'drain',
    endedAt,
  });
}

/**
 * The LAND step, from plateau-app's already-parsed drain-daemon history ROWS (each `{ at, mergedPrs, parked:
 * [{num, reasons}], consideredPrs }` — this module never reads `plateau:.drain-daemon/history.jsonl` itself,
 * MEMORY #6). Filters to rows that reference `pr` (via `mergedPrs`, `consideredPrs`, or a `parked[].num` match).
 * `status`: `'landed'` if any matching row merged it, else `'parked'` if any matching row parked it, else
 * `'unknown'` (considered but neither — e.g. still queued). `reasons` comes from the LATEST matching `parked`
 * entry. `startedAt`/`endedAt` span the matching rows' `at` timestamps.
 * @param {object[]} entries - already-parsed history rows.
 * @param {{ pr: number }} o
 * @returns {Step}
 */
export function landStepFromHistoryEntries(entries, { pr } = {}) {
  const rows = Array.isArray(entries) ? entries : [];
  const num = Number(pr);
  if (!Number.isFinite(num)) return normalizeStep({ name: 'land', status: 'unknown', actor: 'drain-daemon' });

  const refersToNum = (row) => {
    if (!row || typeof row !== 'object') return false;
    const merged = Array.isArray(row.mergedPrs) ? row.mergedPrs : [];
    const considered = Array.isArray(row.consideredPrs) ? row.consideredPrs : [];
    const parked = Array.isArray(row.parked) ? row.parked : [];
    return merged.includes(num) || considered.includes(num) || parked.some((p) => p && p.num === num);
  };
  const matching = rows.filter(refersToNum);
  if (!matching.length) return normalizeStep({ name: 'land', status: 'unknown', actor: 'drain-daemon' });

  const landed = matching.some((row) => Array.isArray(row.mergedPrs) && row.mergedPrs.includes(num));
  const parkedRows = matching.filter((row) => Array.isArray(row.parked) && row.parked.some((p) => p && p.num === num));
  const status = landed ? 'landed' : parkedRows.length ? 'parked' : 'unknown';

  const lastParkedRow = parkedRows.length ? parkedRows[parkedRows.length - 1] : null;
  const lastParkedEntry = lastParkedRow ? lastParkedRow.parked.find((p) => p && p.num === num) : null;
  const reasons = lastParkedEntry && Array.isArray(lastParkedEntry.reasons) ? lastParkedEntry.reasons : [];

  const { startedAt, endedAt } = timestampSpan(matching.map((row) => row && row.at));
  return normalizeStep({ name: 'land', status, reasons, actor: 'drain-daemon', startedAt, endedAt });
}

// ─────────────────────────────────────────────────────────────────────────────
// THE `assemble` CLI — the one fs/stdin-touching shell. Gated on direct invocation so importing the pure
// exports above never runs it (mirrors `we:scripts/review-detail.mjs` / `we:scripts/lib/jury-ledger.mjs`).
// ─────────────────────────────────────────────────────────────────────────────

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return flags;
}

/** Read a `--flag=<file|->` value: `-` reads stdin (fd 0), a path reads that file. `undefined`/missing → `null`
 *  (that input is simply absent — never a throw). Tolerant of a file that doesn't exist or isn't valid text. */
function readFlagText(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    return value === '-' ? readFileSync(0, 'utf8') : readFileSync(value, 'utf8');
  } catch {
    return null;
  }
}

/** Parse text as either one JSON value (an array or object) or newline-delimited JSON (one value per line,
 *  malformed/blank lines skipped) — accepts both a durable `.jsonl` log and a plain JSON array/object file.
 *  Never throws; unparsable input yields `null`. */
function parseJsonFlexible(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); } catch { /* fall through to line-delimited */ }
  const out = [];
  for (const line of trimmed.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    try { out.push(JSON.parse(l)); } catch { /* skip malformed line */ }
  }
  return out;
}

function runAssemble(flags) {
  const pr = Number(flags.pr);
  const reviewEvents = parseJsonFlexible(readFlagText(flags['review-log']));
  const reviewDetail = parseJsonFlexible(readFlagText(flags['review-detail']));
  const historyRows = parseJsonFlexible(readFlagText(flags.history));

  const steps = [
    reviewStepFromLedger(Array.isArray(reviewEvents) ? reviewEvents : []),
    escalationStepFromReviewDetail(reviewDetail && typeof reviewDetail === 'object' ? reviewDetail : {}),
    // Layer-1 build-time self-review has no ledger to fold yet (#3113 — its prerequisite, not yet landed): a
    // placeholder row rather than inventing data, per this card's Done-when.
    normalizeStep({ name: 'self-review', status: 'not-yet-traced', actor: 'build-lane' }),
    landStepFromHistoryEntries(Array.isArray(historyRows) ? historyRows : [], { pr }),
  ];

  writeAllSync(1, `${JSON.stringify({ steps }, null, 2)}\n`);
  process.exit(0);
}

function main(argv) {
  const sub = argv[0];
  const flags = parseFlags(argv.slice(1));
  if (sub === 'assemble') { runAssemble(flags); return; }
  process.stderr.write(
    'usage: pipeline-trace.mjs assemble --pr=<n> [--review-log=<file|->] [--review-detail=<file|->] [--history=<file|->]\n',
  );
  process.exit(2);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || '')).href) {
  main(process.argv.slice(2));
}
