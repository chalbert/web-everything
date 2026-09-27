#!/usr/bin/env node
/**
 * @file scripts/conveyor/run-rating.mjs
 * @description RUN RATING & EFFICIENCY, slice 1 (parent #4075) — (a) an automatic per-run MECHANICAL grade and
 *   (d) token efficiency per demand. MECHANICAL ONLY: no LLM judge reads the diff or the reasoning quality here
 *   — that is slice (b), cross-model judge rating, filed as a follow-up. Everything in this file is a
 *   deterministic function of a session transcript / review-job log plus its completion record; the same input
 *   always produces the same grade.
 *
 * WHY MECHANICAL FIRST: a judge call costs real tokens and real judgment; a mechanical pass costs neither and
 * already answers "was this run clean or wasteful" for the bulk of cases (guard blocks, repeated calls, blown
 * wall-clock budgets, an outcome that never needed the work at all). Slice (b) later adds the harder question
 * ("was the CODE actually good") on top of this — never instead of it.
 *
 * INPUTS THIS MODULE READS (never writes, except the scorecard store below):
 *   • a dispatched daemon session's OWN transcript — under a `~/.claude/projects/` directory whose name contains
 *     `operations-dispatch`, one `<sessionId>.jsonl` file per dispatched agent
 *     (`fix-<pr>` / `ci-heal-<pr>` / `review-<pr>` [session mode] / `conveyor-<item>` sessions). Every line is one
 *     JSON object; `type:'assistant'` lines carry `message.usage` (`input_tokens`, `output_tokens`,
 *     `cache_read_input_tokens`, `cache_creation` split `ephemeral_5m_input_tokens`/`ephemeral_1h_input_tokens`)
 *     and `message.model`; `type:'custom-title'`'s `customTitle` is the session's own dispatcher-minted slug;
 *     `tool_use` blocks live on assistant lines, their `tool_result` counterpart on a later `user` line, joined
 *     by `tool_use_id`.
 *   • a review-job's plain-text log (`.operations/review-jobs/review-<pr>.log`, `we:scripts/operations/
 *     review-job.mjs`) for the default job-mode review dispatch, which has NO transcript of its own (no
 *     `sessionId` — see that file's header). Its final line is a structured JSON summary (`timings`, `outcome`,
 *     `verdict`). KNOWN GAP (documented, not silently papered over): a job-mode review's OWN token/cost is not
 *     observable from this log — the jurors it spawns (`we:scripts/lib/judge-spawn.mjs`) are separate `claude -p`
 *     processes with their own session ids this slice does not chase down. `rateReviewJobLog` reports
 *     `tokens: null, costUsd: null, dataQuality: 'job-log-only'` for these rows rather than guessing — a reader
 *     must check `dataQuality` before summing tokens across rows.
 *   • the session's completion record (`we:scripts/operations/completion-store.mjs#tryReadCompletion`) for the
 *     final `outcome` — this file never re-derives an outcome by scraping the transcript's text.
 *   • `we:scripts/backlog/cost-rates.mjs` — THE canonical Claude per-token USD table (reused verbatim, never
 *     duplicated — see that file's own header on why a duplicate table is exactly the bug this whole area
 *     already had once).
 *
 * PURE CORE / IO SHELL split, same discipline as `run-scorecard-store.mjs` / `lease-reaper.mjs`:
 *   • PURE (no fs, no clock, no process): every `extract*`/`compute*`/`count*`/`classify*`/`grade*` function
 *     below, plus {@link rateTranscript} and {@link rateReviewJobTimings} which only combine them. Unit-tested
 *     directly against fixture transcript arrays — no tmpdir, no real jsonl file needed.
 *   • IO SHELL: {@link findTranscriptPath}, {@link readTranscriptLines}, {@link rateSession},
 *     {@link rateReviewJobLog} (reads a real log file), {@link appendRunRating}, {@link rateAndRecordSession} (the
 *     function hooked into `session-reaper.mjs` / `review-job.mjs`), and the `report` CLI.
 *
 * WHERE A RATING LANDS: appended to the ALREADY-CANONICAL scorecard store (`run-scorecard-store.mjs`) — never a
 * second store. `validateScorecard`'s required fields are satisfied with a mechanical proxy (`score` = a fixed
 * per-grade number, `deductions[]` = one entry per mechanical criterion that cost points); every other field this
 * module cares about (`grade`, `wallMs`, `shares`, `tokens`, `costUsd`, `cacheHitRatio`, `outcome`) rides through
 * as an EXTRA field, which that store's own docs say pass through unvalidated.
 *
 * NEVER PRINTS raw tool content, transcript text, or secrets — only counts, ms, USD, and grades. A guard-block /
 * error match only ever contributes to a COUNT; the matched text itself is never retained past the check.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { rateFor, usdFromTokens } from '../backlog/cost-rates.mjs';
import { appendScorecard, readStore } from './run-scorecard-store.mjs';
import { tryReadCompletion } from '../operations/completion-store.mjs';
import { readField } from '../backlog/frontmatter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

// ── DECLARED CONSTANTS ──────────────────────────────────────────────────────────────────────────────────────────

/** Stamped on every row this module writes — bump when the rubric's weights below change (Fork 3 discipline,
 *  same as `run-scorecard-store.mjs`: a rubric change never re-scores old history). */
export const RUBRIC_VERSION = 'run-rating-mechanical.1';

/** The four mechanical criteria {@link toScorecardRow} always evaluates (guard blocks, non-guard tool errors,
 *  repeated identical calls, test/gate reruns) — `criteriaEvaluated` on every row this module appends. */
export const MECHANICAL_CRITERIA_COUNT = 4;

export const GRADES = Object.freeze(['A', 'B', 'C', 'D']);

/** The conceptual outcome buckets the operator asked for. `unclassified` is not a failure of this module — it
 *  is the honest answer for a raw outcome word this file's {@link OUTCOME_MAP} has never seen (never guessed
 *  into a bucket it might not belong in). */
export const OUTCOME_BUCKETS = Object.freeze(['accepted', 'bounced', 'escalated', 'nothing-to-fix', 'pushed', 'unclassified']);

/**
 * Raw completion-record `outcome` strings (fix/ci-heal brief vocabulary — `we:skills-src/conveyor/
 * fix-agent-brief.md` / `ci-heal-*` — and review-job vocabulary — `we:scripts/operations/review-job.mjs`) →
 * one of {@link OUTCOME_BUCKETS}. Anything starting with `escalated` but not listed here still resolves to
 * `escalated` (a closed prefix rule, not a guess); anything else unseen resolves to `unclassified`.
 */
export const OUTCOME_MAP = Object.freeze({
  're-armed': 'pushed',
  healed: 'pushed',
  done: 'pushed',
  'gate-red': 'escalated',
  diagnosed: 'escalated',
  'no-change': 'nothing-to-fix',
  'not-applicable': 'nothing-to-fix',
  blocked: 'escalated',
  'blocked-on-infra': 'escalated',
  'escalated-needs-human': 'escalated',
  'escalated-needs-judgment': 'escalated',
  'escalated-conflict': 'escalated',
  'escalated-rearm-refused': 'escalated',
  'needs-human': 'escalated',
  'needs-human-judgment': 'escalated',
  'waiting-on-system-fix': 'escalated',
  'auto-cleared': 'accepted',
  parked: 'escalated',
  bounced: 'bounced',
  'deferred-no-lane': 'unclassified',
});

/**
 * Median wall time baselines by dispatch kind, from the delivery-time report
 * (https://claude.ai/artifact/UhgARA3ySm91z9aC3tgngd): a daemon FIX session runs ~10 min median; a WORKER
 * (item-kind build/conveyor session) runs ~40 min median. `review`/`ci-heal` share the fix-session daemon
 * family; `conveyor`/`prepare`/`prepare-decision` share the worker family. An unrecognised kind falls back to
 * the fix baseline (the more common, shorter case — a false "this ran long" is cheaper to mis-flag than a false
 * "this was fine").
 */
export const BASELINE_WALL_MS_BY_KIND = Object.freeze({
  fix: 10 * 60 * 1000,
  'ci-heal': 10 * 60 * 1000,
  review: 10 * 60 * 1000,
  inspect: 10 * 60 * 1000,
  conveyor: 40 * 60 * 1000,
  prepare: 40 * 60 * 1000,
  'prepare-decision': 40 * 60 * 1000,
});
export const DEFAULT_BASELINE_WALL_MS = BASELINE_WALL_MS_BY_KIND.fix;

/** Same report: "~4 guard blocks/session is bad; target <1." */
export const GUARD_BLOCKS_BAD = 4;
export const GUARD_BLOCKS_TARGET = 1;

/** The report's other baseline: a fix session's median tests/gates time SHARE is ~65%. Recorded for the CLI
 *  report to compare against, not currently used as a per-run grading deduction (a below-baseline tests share
 *  is not necessarily bad — it can mean a genuinely small diff). */
export const BASELINE_TESTS_SHARE_FIX = 0.65;

export const TOOL_CATEGORIES = Object.freeze(['tests-gates', 'gh', 'git', 'edits', 'platform-ops', 'other']);

const TEST_GATE_RE = /\b(npm run (?:test\S*|check:standards)|vitest|verify-lane\.mjs|heavy-admission\.mjs|check-standards\.mjs)\b/;
const GH_RE = /(^|[\s;&|(])gh(\s|$)/;
const GIT_RE = /(^|[\s;&|(])git(\s|$)/;
const OPS_RE = /scripts\/(?:operations|conveyor|lib|backlog)\/[\w.-]+\.mjs/;
const GUARD_BLOCK_RE = /hook error:\s*blocked/i;

// ── PURE: transcript extraction ─────────────────────────────────────────────────────────────────────────────────

/** Is this an assistant turn's `message.model` the harness's own synthetic marker (an auth failure / internal
 *  error turn) rather than a real model call? Its `usage` is meaningless and must never be summed. */
export function isSyntheticModel(model) {
  return typeof model === 'string' && model.trim().startsWith('<') && model.trim().endsWith('>');
}

/**
 * Every REAL (non-synthetic) assistant turn's `{ts, model, usage}`, in transcript order.
 * @param {object[]} lines - already-JSON-parsed transcript lines.
 * @returns {{ts:number|null, model:string|null, in:number, out:number, cacheRead:number, cacheWrite5m:number,
 *   cacheWrite1h:number, thinkingTokens:number}[]}
 */
export function extractTurns(lines) {
  const turns = [];
  for (const line of Array.isArray(lines) ? lines : []) {
    if (line?.type !== 'assistant') continue;
    const message = line.message ?? {};
    const model = typeof message.model === 'string' ? message.model : null;
    if (isSyntheticModel(model)) continue;
    const usage = message.usage ?? {};
    const cacheCreation = usage.cache_creation ?? null;
    const cacheWrite5m = Number(cacheCreation?.ephemeral_5m_input_tokens) || 0;
    // No per-tier split reported (older/plain shape) — the whole amount is priced at the 1h tier, same
    // assumption `cost-rates.mjs` itself documents for this user's sessions.
    const cacheWrite1h = cacheCreation
      ? (Number(cacheCreation.ephemeral_1h_input_tokens) || 0)
      : (Number(usage.cache_creation_input_tokens) || 0);
    const ts = Date.parse(line.timestamp ?? '');
    turns.push({
      ts: Number.isFinite(ts) ? ts : null,
      model,
      in: Number(usage.input_tokens) || 0,
      out: Number(usage.output_tokens) || 0,
      cacheRead: Number(usage.cache_read_input_tokens) || 0,
      cacheWrite5m,
      cacheWrite1h,
      thinkingTokens: Number(usage.output_tokens_details?.thinking_tokens) || 0,
    });
  }
  return turns;
}

/** The dispatcher-minted slug this transcript's own `custom-title` line names, or `null` if absent. */
export function sessionNameFromLines(lines) {
  for (const line of Array.isArray(lines) ? lines : []) {
    if (line?.type === 'custom-title' && typeof line.customTitle === 'string') return line.customTitle;
  }
  return null;
}

/** First and last parseable `timestamp` across every line — the session's own wall-clock span, in ms. `null`
 *  when fewer than two timestamps are found (nothing to measure). */
export function computeWallMs(lines) {
  let min = null;
  let max = null;
  for (const line of Array.isArray(lines) ? lines : []) {
    const ts = Date.parse(line?.timestamp ?? '');
    if (!Number.isFinite(ts)) continue;
    if (min === null || ts < min) min = ts;
    if (max === null || ts > max) max = ts;
  }
  return min !== null && max !== null && max >= min ? max - min : null;
}

/**
 * Every `tool_use`/`tool_result` pair, joined by `tool_use_id`. A `tool_use` with no matching result (the
 * session is still running, or the transcript was truncated) is still reported, with `endTs`/`durationMs: null`
 * — never dropped, since it is still real evidence of what the run attempted.
 * @returns {{id:string, name:string|null, input:*, startTs:number|null, endTs:number|null, durationMs:number|null,
 *   isError:boolean, category:string, resultText:string}[]}
 */
export function pairToolEvents(lines) {
  const pending = new Map();
  const events = [];
  for (const line of Array.isArray(lines) ? lines : []) {
    const ts = Date.parse(line?.timestamp ?? '');
    const tsOrNull = Number.isFinite(ts) ? ts : null;
    if (line?.type === 'assistant') {
      const content = Array.isArray(line.message?.content) ? line.message.content : [];
      for (const block of content) {
        if (block?.type === 'tool_use' && typeof block.id === 'string') {
          pending.set(block.id, { name: typeof block.name === 'string' ? block.name : null, input: block.input ?? null, startTs: tsOrNull });
        }
      }
    } else if (line?.type === 'user') {
      const content = Array.isArray(line.message?.content) ? line.message.content : [];
      for (const block of content) {
        if (block?.type !== 'tool_result' || typeof block.tool_use_id !== 'string') continue;
        const call = pending.get(block.tool_use_id);
        pending.delete(block.tool_use_id);
        const resultText = typeof block.content === 'string'
          ? block.content
          : Array.isArray(block.content)
            ? block.content.map((c) => (typeof c === 'string' ? c : (typeof c?.text === 'string' ? c.text : ''))).join('\n')
            : '';
        const startTs = call?.startTs ?? null;
        const name = call?.name ?? null;
        const input = call?.input ?? null;
        events.push({
          id: block.tool_use_id, name, input, startTs, endTs: tsOrNull,
          durationMs: startTs !== null && tsOrNull !== null && tsOrNull >= startTs ? tsOrNull - startTs : null,
          isError: block.is_error === true,
          category: classifyToolCall(name, input),
          // bounded — a mechanical guard-block/error CHECK only, never retained or printed past this module.
          resultText: resultText.slice(0, 4000),
        });
      }
    }
  }
  for (const [id, call] of pending) {
    events.push({
      id, name: call.name, input: call.input, startTs: call.startTs, endTs: null, durationMs: null,
      isError: false, category: classifyToolCall(call.name, call.input), resultText: '',
    });
  }
  return events;
}

/** PURE — which mechanical bucket a tool call belongs to. `Bash` is further split by command text; every other
 *  tool name resolves by name alone. */
export function classifyToolCall(name, input) {
  if (name === 'Edit' || name === 'Write' || name === 'MultiEdit' || name === 'NotebookEdit') return 'edits';
  if (name === 'Bash') {
    const cmd = String(input?.command ?? '');
    if (TEST_GATE_RE.test(cmd)) return 'tests-gates';
    if (GH_RE.test(cmd)) return 'gh';
    if (GIT_RE.test(cmd)) return 'git';
    if (OPS_RE.test(cmd)) return 'platform-ops';
    return 'other';
  }
  return 'other';
}

/**
 * Wall time attributed to each mechanical category, plus the leftover (no tool call in flight) split into
 * `reasoning` (a real assistant turn with `thinkingTokens > 0` falls inside the gap) vs `idle` (no such turn —
 * e.g. waiting on lane/admission, or a plain non-thinking turn). This is a MECHANICAL, approximate split:
 * overlapping parallel tool calls each contribute their own full duration to their own category (so category
 * totals can sum to slightly over 100% of wall time when calls ran in parallel) — documented here rather than
 * built out into a true interval union, which slice 1 does not need.
 * @returns {{testsMs:number, ghMs:number, gitMs:number, editsMs:number, opsMs:number, otherMs:number,
 *   reasoningMs:number, idleMs:number, shares:Record<string, number|null>}}
 */
export function computeTimeShares(events, turns, wallMs) {
  const byCategory = { 'tests-gates': 0, gh: 0, git: 0, edits: 0, 'platform-ops': 0, other: 0 };
  const known = (Array.isArray(events) ? events : []).filter((e) => typeof e.durationMs === 'number');
  for (const e of known) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.durationMs;

  // Busy-time union (deduplicated) purely to size the leftover "gap" time correctly even when calls overlap.
  const intervals = known
    .filter((e) => e.startTs !== null && e.endTs !== null)
    .map((e) => [e.startTs, e.endTs])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of intervals) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const busyMs = merged.reduce((sum, [s, e]) => sum + (e - s), 0);
  const leftoverMs = typeof wallMs === 'number' ? Math.max(0, wallMs - busyMs) : null;

  // Gaps = the complement of the busy union. For each gap, a real turn with thinkingTokens>0 landing inside it
  // marks the WHOLE gap as reasoning; otherwise idle. Turns are cheap (usually few) so a linear scan is fine.
  let reasoningMs = 0;
  let idleMs = 0;
  if (leftoverMs !== null) {
    const gapBounds = [];
    let cursor = null;
    for (const [s, e] of merged) {
      if (cursor !== null && s > cursor) gapBounds.push([cursor, s]);
      cursor = cursor === null ? e : Math.max(cursor, e);
    }
    // No busy intervals at all → the whole wall span is one gap (nothing to bound it with beyond wallMs itself,
    // which the caller already has — we simply can't locate it on the absolute timeline, so treat it as one
    // gap covering everything and let the thinkingTokens check below decide reasoning vs idle for all of it).
    if (merged.length === 0 && typeof wallMs === 'number') gapBounds.push([null, null]);
    const realTurns = (Array.isArray(turns) ? turns : []).filter((t) => t.ts !== null);
    for (const [gs, ge] of gapBounds) {
      const span = gs === null ? leftoverMs : Math.max(0, ge - gs);
      const hasThinking = gs === null
        ? realTurns.some((t) => t.thinkingTokens > 0)
        : realTurns.some((t) => t.ts >= gs && t.ts <= ge && t.thinkingTokens > 0);
      if (hasThinking) reasoningMs += span; else idleMs += span;
    }
  }

  const denom = typeof wallMs === 'number' && wallMs > 0 ? wallMs : null;
  const share = (ms) => (denom === null ? null : ms / denom);
  return {
    testsMs: byCategory['tests-gates'], ghMs: byCategory.gh, gitMs: byCategory.git,
    editsMs: byCategory.edits, opsMs: byCategory['platform-ops'], otherMs: byCategory.other,
    reasoningMs, idleMs,
    shares: {
      tests: share(byCategory['tests-gates']), gh: share(byCategory.gh), git: share(byCategory.git),
      edits: share(byCategory.edits), ops: share(byCategory['platform-ops']), other: share(byCategory.other),
      reasoning: share(reasoningMs), idle: share(idleMs),
    },
  };
}

/** Guard-hook refusals — the literal `hook error: Blocked` marker on an errored tool result. Counted, never
 *  the matched text retained. */
export function countGuardBlocks(events) {
  return (Array.isArray(events) ? events : []).filter((e) => e.isError && GUARD_BLOCK_RE.test(e.resultText)).length;
}

/** Every errored tool result (guard blocks are a SUBSET of this — see {@link countGuardBlocks} — callers that
 *  want non-guard errors alone compute `errors - guardBlocks`). */
export function countErrors(events) {
  return (Array.isArray(events) ? events : []).filter((e) => e.isError).length;
}

/** A stable signature for "the same call again": `name` + a deterministic stringify of `input` (sorted keys,
 *  so key order never hides a duplicate). */
function callSignature(name, input) {
  const stable = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(stable);
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  };
  try { return `${name ?? ''}::${JSON.stringify(stable(input))}`; } catch { return `${name ?? ''}::[unstringifiable]`; }
}

/** Total REPEAT calls (occurrences beyond the first) sharing an identical `(name, input)` signature — the
 *  waste this exists to catch: the same read, the same failing command, tried again with no change. */
export function countRepeatedCalls(events) {
  const counts = new Map();
  for (const e of Array.isArray(events) ? events : []) {
    const sig = callSignature(e.name, e.input);
    counts.set(sig, (counts.get(sig) ?? 0) + 1);
  }
  let repeats = 0;
  for (const n of counts.values()) if (n > 1) repeats += n - 1;
  return repeats;
}

/** {@link countRepeatedCalls}, restricted to `tests-gates` calls — the "ran the same test/gate command over
 *  and over" waste specifically (a stronger signal than a generic repeated call: no code changed in between,
 *  by definition, if the command AND its context are identical). */
export function countTestReruns(events) {
  return countRepeatedCalls((Array.isArray(events) ? events : []).filter((e) => e.category === 'tests-gates'));
}

/** Sum every real turn's usage into one `{in, out, cacheRead, cacheWrite5m, cacheWrite1h}` bag. */
export function sumTokens(turns) {
  const sums = { in: 0, out: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };
  for (const t of Array.isArray(turns) ? turns : []) {
    sums.in += t.in; sums.out += t.out; sums.cacheRead += t.cacheRead;
    sums.cacheWrite5m += t.cacheWrite5m; sums.cacheWrite1h += t.cacheWrite1h;
  }
  return sums;
}

/** The most-common real model id across turns, or `null` when there are none — never guessed as "probably
 *  opus" the way `cost-rates.mjs` itself refuses to (see that file's `rateFor` doc). */
export function dominantModel(turns) {
  const counts = new Map();
  for (const t of Array.isArray(turns) ? turns : []) {
    if (!t.model) continue;
    counts.set(t.model, (counts.get(t.model) ?? 0) + 1);
  }
  let best = null;
  let bestN = 0;
  for (const [model, n] of counts) if (n > bestN) { best = model; bestN = n; }
  return best;
}

/**
 * USD for a token bag, priced at `model`'s rate (`we:scripts/backlog/cost-rates.mjs`, the ONE declared price
 * table — never duplicated here). `null` for an unrecognised model family — matches `rateFor`'s own
 * "no silent opus fallback" rule; a caller must not sum a `null` cost into a total as if it were 0.
 */
export function computeCostUsd(tokenSums, model) {
  if (!rateFor(model)) return null;
  const cost5m = usdFromTokens({ cw: tokenSums.cacheWrite5m }, model, { cacheTier: '5m' });
  const cost1h = usdFromTokens(
    { in: tokenSums.in, cr: tokenSums.cacheRead, out: tokenSums.out, cw: tokenSums.cacheWrite1h },
    model,
    { cacheTier: '1h' },
  );
  return cost5m + cost1h;
}

/** Of every input token this run needed (fresh + served-from-cache), what share was served from cache —
 *  `cacheRead / (in + cacheRead)`. `null` when neither occurred (nothing to rate a hit ratio on). */
export function computeCacheHitRatio(tokenSums) {
  const denom = (tokenSums.in ?? 0) + (tokenSums.cacheRead ?? 0);
  return denom > 0 ? tokenSums.cacheRead / denom : null;
}

// ── PURE: outcome + grade ───────────────────────────────────────────────────────────────────────────────────────

/** Raw completion-record `outcome` string → one of {@link OUTCOME_BUCKETS}. See {@link OUTCOME_MAP}'s own doc
 *  for the closed-prefix `escalated-*` rule. */
export function classifyOutcome(rawOutcome) {
  if (typeof rawOutcome !== 'string' || !rawOutcome.trim()) return 'unclassified';
  if (Object.hasOwn(OUTCOME_MAP, rawOutcome)) return OUTCOME_MAP[rawOutcome];
  return rawOutcome.startsWith('escalated') ? 'escalated' : 'unclassified';
}

/**
 * THE MECHANICAL GRADING RUBRIC (A–D), first-pass and explicitly declared here so it can be tuned in one place.
 * Weights are chosen to match the delivery-time report's own stated bads:
 *   • `guardBlocks`: −15/block. 1 block (at the report's own "target <1") costs 15 points — still comfortably
 *     an A (≥85); 4 blocks (the report's own "is bad") costs 60 — well into D territory alone.
 *   • non-guard tool errors (`errors − guardBlocks`, never double-counting a guard block as also a plain
 *     error): −5 each — errors that are not a guard refusal are usually recovered from, but still cost a retry.
 *   • `repeatedCalls` (identical calls beyond the first): −3 each — mild, most repeats are cheap reads.
 *   • `testReruns` (identical test/gate reruns specifically): −5 each — a rerun burns a full gate invocation.
 *   • wall time vs this kind's baseline (`BASELINE_WALL_MS_BY_KIND`): >4x −30, >2x −15, >1.5x −5 — a single
 *     ratio bucket, not a continuous penalty, so a run just over a boundary is not cliff-edged by a rounding
 *     error.
 * A run with none of the above stays at 100 (`A`) regardless of `outcome` — an `escalated`/`bounced` outcome is
 * NOT itself penalised here (escalating correctly, cleanly, with no waste, is a GOOD mechanical run; whether
 * escalation was the right call is a judgment question for slice (b), never this file's).
 * Bands: A ≥85, B ≥65, C ≥40, D otherwise.
 */
export function gradeRun({ guardBlocks = 0, errors = 0, repeatedCalls = 0, testReruns = 0, wallMs = null, kind = null } = {}) {
  let score = 100;
  score -= guardBlocks * 15;
  score -= Math.max(0, errors - guardBlocks) * 5;
  score -= repeatedCalls * 3;
  score -= testReruns * 5;
  if (typeof wallMs === 'number') {
    const baseline = BASELINE_WALL_MS_BY_KIND[kind] ?? DEFAULT_BASELINE_WALL_MS;
    const ratio = baseline > 0 ? wallMs / baseline : null;
    if (ratio !== null) {
      if (ratio > 4) score -= 30;
      else if (ratio > 2) score -= 15;
      else if (ratio > 1.5) score -= 5;
    }
  }
  score = Math.max(0, Math.min(100, score));
  if (score >= 85) return 'A';
  if (score >= 65) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

// ── PURE: orchestrator ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Combine every pure piece above into one rating record. `rawOutcome` is INJECTED (read from the completion
 * record by the IO shell) — this function never scrapes an outcome out of the transcript text itself.
 * @returns {object} the full per-run rating shape the operator asked for.
 */
export function rateTranscript(lines, { kind, pr = null, item = null, sessionName = null, rawOutcome = null } = {}) {
  const turns = extractTurns(lines);
  const events = pairToolEvents(lines);
  const wallMs = computeWallMs(lines);
  const time = computeTimeShares(events, turns, wallMs);
  const guardBlocks = countGuardBlocks(events);
  const errors = countErrors(events);
  const repeatedCalls = countRepeatedCalls(events);
  const testReruns = countTestReruns(events);
  const tokenSums = sumTokens(turns);
  const model = dominantModel(turns);
  const costUsd = computeCostUsd(tokenSums, model);
  const cacheHitRatio = computeCacheHitRatio(tokenSums);
  const outcome = classifyOutcome(rawOutcome);
  const grade = gradeRun({ guardBlocks, errors, repeatedCalls, testReruns, wallMs, kind });
  return {
    kind: kind ?? null, pr, item, sessionName: sessionName ?? sessionNameFromLines(lines), model,
    wallMs,
    testsMs: time.testsMs, ghMs: time.ghMs, gitMs: time.gitMs, editsMs: time.editsMs, opsMs: time.opsMs,
    otherMs: time.otherMs, reasoningMs: time.reasoningMs, idleMs: time.idleMs, shares: time.shares,
    guardBlocks, errors, repeatedCalls, testReruns,
    outcome, rawOutcome: rawOutcome ?? null,
    tokens: { in: tokenSums.in, out: tokenSums.out, cacheRead: tokenSums.cacheRead, cacheWrite: tokenSums.cacheWrite5m + tokenSums.cacheWrite1h },
    costUsd, cacheHitRatio, grade,
    dataQuality: 'transcript',
  };
}

/**
 * A review-job (job-mode dispatch, no transcript of its own — see this file's header) rated from its parsed
 * log summary alone. Tokens/cost/guard-blocks are NOT observable at this layer — reported `null`/`0` with
 * `dataQuality: 'job-log-only'` so a reader never mistakes an absence for a real zero.
 */
export function rateReviewJobTimings({ pr = null, outcome = null, timings = {} } = {}) {
  const wallMs = Number.isFinite(timings?.totalMs) ? timings.totalMs : null;
  const classified = classifyOutcome(outcome);
  const grade = gradeRun({ guardBlocks: 0, errors: 0, repeatedCalls: 0, testReruns: 0, wallMs, kind: 'review' });
  return {
    kind: 'review', pr, item: null, sessionName: null, model: null,
    wallMs,
    testsMs: 0, ghMs: 0, gitMs: 0, editsMs: 0, opsMs: 0, otherMs: 0, reasoningMs: 0, idleMs: 0,
    shares: { tests: null, gh: null, git: null, edits: null, ops: null, other: null, reasoning: null, idle: null },
    guardBlocks: 0, errors: 0, repeatedCalls: 0, testReruns: 0,
    outcome: classified, rawOutcome: outcome ?? null,
    tokens: null, costUsd: null, cacheHitRatio: null, grade,
    dataQuality: 'job-log-only',
  };
}

// ── IO SHELL: locating and reading real transcripts / logs ─────────────────────────────────────────────────────

/** `~/.claude/projects` (or `WE_CLAUDE_PROJECTS_DIR` for tests / an alternate machine layout). */
export function defaultProjectsRoot(env = process.env) {
  const override = env?.WE_CLAUDE_PROJECTS_DIR;
  return override && override.trim() ? resolve(override.trim()) : join(homedir(), '.claude', 'projects');
}

function firstLineJson(path) {
  try {
    const text = readFileSync(path, 'utf8');
    const nl = text.indexOf('\n');
    const first = nl === -1 ? text : text.slice(0, nl);
    if (!first.trim()) return null;
    return JSON.parse(first);
  } catch { return null; }
}

/**
 * Locate a dispatched session's own transcript file. Fast path: `sessionId` known (from `claude agents --json`)
 * → direct filename match. Fallback (a finished/backfill session, no longer in the live listing): scan every
 * `*operations-dispatch*` directory's files for one whose OWN first line is `{type:'custom-title', customTitle:
 * sessionName}` — bounded by `sinceMs` (an mtime floor) so a backfill sweep never re-scans the whole directory.
 * `null` when nothing matches (never guessed).
 */
export function findTranscriptPath(sessionName, { sessionId = null, projectsRoot = defaultProjectsRoot(), sinceMs = null } = {}) {
  if (!existsSync(projectsRoot)) return null;
  let dirEntries;
  try { dirEntries = readdirSync(projectsRoot, { withFileTypes: true }); } catch { return null; }
  const dirs = dirEntries.filter((d) => d.isDirectory() && d.name.includes('operations-dispatch')).map((d) => join(projectsRoot, d.name));
  if (sessionId) {
    for (const dir of dirs) {
      const p = join(dir, `${sessionId}.jsonl`);
      if (existsSync(p)) return p;
    }
  }
  if (!sessionName) return null;
  for (const dir of dirs) {
    let names;
    try { names = readdirSync(dir); } catch { continue; }
    for (const name of names) {
      if (!name.endsWith('.jsonl')) continue;
      const p = join(dir, name);
      if (sinceMs !== null) {
        try { if (statSync(p).mtimeMs < sinceMs) continue; } catch { /* fall through to checking it anyway */ }
      }
      const first = firstLineJson(p);
      if (first?.type === 'custom-title' && first.customTitle === sessionName) return p;
    }
  }
  return null;
}

/** Parse a transcript file into an array of line objects, skipping any line that fails to parse (never
 *  throws — a torn last line from a still-writing session is expected, not corrupt). */
export function readTranscriptLines(path) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return []; }
  const lines = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    try { lines.push(JSON.parse(raw)); } catch { /* torn/partial line — skip it, not fatal */ }
  }
  return lines;
}

/**
 * Rate ONE dispatched session end-to-end: find its transcript, read it, read its completion record for the
 * real outcome, and combine via {@link rateTranscript}. Returns `{ok:false, reason}` rather than throwing when
 * evidence is missing (a session whose transcript has already been pruned, or was never a real dispatch).
 */
export function rateSession({ sessionName, sessionId = null, kind, pr = null, item = null, sinceMs = null, transcriptPath = null } = {}) {
  const path = transcriptPath ?? findTranscriptPath(sessionName, { sessionId, sinceMs });
  if (!path) return { ok: false, reason: 'transcript-not-found', sessionName, kind, pr, item };
  const lines = readTranscriptLines(path);
  if (!lines.length) return { ok: false, reason: 'transcript-unreadable-or-empty', sessionName, kind, pr, item, transcriptPath: path };
  let record = null;
  try { record = tryReadCompletion(sessionName); } catch { record = null; }
  const rating = rateTranscript(lines, { kind, pr, item, sessionName, rawOutcome: record?.outcome ?? null });
  return { ok: true, transcriptPath: path, ...rating };
}

/**
 * Rate ONE review-job log file (`.operations/review-jobs/<slug>.log`). Parses the LAST line that is valid JSON
 * (the job's own structured summary, written once at exit — see `we:scripts/operations/review-job.mjs`'s
 * `finally` block) rather than the whole log, since every earlier line is plain narrative text.
 */
export function rateReviewJobLog(logPath) {
  let text;
  try { text = readFileSync(logPath, 'utf8'); } catch { return { ok: false, reason: 'log-unreadable', logPath }; }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let summary = null;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].startsWith('{')) continue;
    try { summary = JSON.parse(lines[i]); break; } catch { /* keep looking backwards */ }
  }
  if (!summary) return { ok: false, reason: 'no-summary-line', logPath };
  const rating = rateReviewJobTimings({ pr: summary.pr ?? null, outcome: summary.outcome ?? null, timings: summary.timings ?? {} });
  return { ok: true, logPath, ...rating, sessionName: summary.sessionSlug ?? null, verdict: summary.verdict ?? null };
}

// ── IO SHELL: recording a rating onto the scorecard store ───────────────────────────────────────────────────────

/**
 * A rating record → a valid `run-scorecard-store.mjs` row. Required-schema fields get a MECHANICAL proxy
 * (`score`: a fixed number per grade band, `deductions[]`: one entry per criterion that cost points); every
 * field this module actually cares about rides through as an extra field (that store's own docs: "extra
 * fields pass through").
 */
export function toScorecardRow(rating, { provider = 'anthropic' } = {}) {
  const gradeScore = { A: 95, B: 80, C: 55, D: 25 }[rating.grade] ?? null;
  // Evidence strings are deliberately plain plural, never `(s)` — that reads to the append-time secret scrub
  // as call-syntax (`name(...)`) and gets refused outright (Fork 2's amendment: deny on a hit, never redact —
  // found live running this module's own backfill against real production rows).
  const deductions = [];
  if (rating.guardBlocks > 0) {
    deductions.push({ criterion: 'guard-blocks', evidence: `${rating.guardBlocks} hook-error:Blocked tool results, target under ${GUARD_BLOCKS_TARGET}` });
  }
  const nonGuardErrors = Math.max(0, (rating.errors ?? 0) - (rating.guardBlocks ?? 0));
  if (nonGuardErrors > 0) deductions.push({ criterion: 'tool-errors', evidence: `${nonGuardErrors} non-guard tool errors` });
  if (rating.repeatedCalls > 0) deductions.push({ criterion: 'repeated-calls', evidence: `${rating.repeatedCalls} identical repeated tool calls` });
  if (rating.testReruns > 0) deductions.push({ criterion: 'test-reruns', evidence: `${rating.testReruns} identical test/gate reruns` });
  return {
    rubricVersion: RUBRIC_VERSION,
    provider,
    model: rating.model ?? 'unknown',
    subjectClass: 'work-agent',
    dispatchKind: rating.kind ?? 'unknown',
    criteriaEvaluated: MECHANICAL_CRITERIA_COUNT,
    score: gradeScore,
    deductions,
    item: rating.item ?? null,
    pr: rating.pr ?? null,
    handle: rating.sessionName ?? null,
    grade: rating.grade,
    wallMs: rating.wallMs ?? null,
    outcome: rating.outcome ?? null,
    rawOutcome: rating.rawOutcome ?? null,
    guardBlocks: rating.guardBlocks ?? 0,
    errors: rating.errors ?? 0,
    repeatedCalls: rating.repeatedCalls ?? 0,
    testReruns: rating.testReruns ?? 0,
    tokens: rating.tokens ?? null,
    costUsd: rating.costUsd ?? null,
    cacheHitRatio: rating.cacheHitRatio ?? null,
    shares: rating.shares ?? null,
    dataQuality: rating.dataQuality ?? 'transcript',
  };
}

/** Append a rating to the scorecard store. Returns what `appendScorecard` returns (the stored row), or `null`
 *  if the rating was not `ok` (nothing to append). Never throws on a missing-evidence rating — that is a
 *  normal, expected outcome (session gone, log not yet written), not a bug. */
export function appendRunRating(rating, io) {
  if (!rating || rating.ok === false) return null;
  return appendScorecard(toScorecardRow(rating), io);
}

/**
 * THE HOOK: rate a just-finished daemon session and append it — best-effort, NEVER throws (a rating failure
 * must never block the reap/report path that calls it). Called from `session-reaper.mjs` right after a session
 * is confirmed stopped, and from `review-job.mjs`'s own `finally` block for a job-mode review.
 */
export function rateAndRecordSession(params, io) {
  try {
    const rating = rateSession(params);
    if (!rating.ok) return rating;
    appendRunRating(rating, io);
    return rating;
  } catch (e) {
    return { ok: false, reason: `rate-and-record threw: ${String(e?.message || e).split('\n')[0]}` };
  }
}

/** Same best-effort contract as {@link rateAndRecordSession}, for a review-job log instead of a session
 *  transcript. */
export function rateAndRecordReviewJob(logPath, io) {
  try {
    const rating = rateReviewJobLog(logPath);
    if (!rating.ok) return rating;
    appendRunRating(rating, io);
    return rating;
  } catch (e) {
    return { ok: false, reason: `rate-and-record threw: ${String(e?.message || e).split('\n')[0]}` };
  }
}

// ── PURE: per-demand rollup ─────────────────────────────────────────────────────────────────────────────────────

const PHASE_BY_KIND = Object.freeze({
  fix: 'rework', 'ci-heal': 'rework', inspect: 'rework',
  review: 'review',
  conveyor: 'build', prepare: 'build', 'prepare-decision': 'build',
});

/** Which phase bucket (`build` / `review` / `rework`) a dispatch kind's tokens belong to for the per-demand
 *  token table. Unknown kinds land in `other` — never silently folded into one of the three named phases. */
export function phaseForKind(kind) {
  return PHASE_BY_KIND[kind] ?? 'other';
}

/** The demand a row belongs to: `<repo>#<pr-or-item>`. Rows with neither `pr` nor `item` are their own
 *  singleton group (`sessionName` keyed) rather than silently merged together under one `#unknown` bucket. */
export function rollupKey(row) {
  const repo = row.repo ?? 'chalbert/web-everything';
  if (row.pr) return `${repo}#pr${row.pr}`;
  if (row.item) return `${repo}#item${row.item}`;
  return `${repo}#session:${row.sessionName ?? 'unknown'}`;
}

/**
 * Group scored rows by demand (card/PR), summing tokens/cost per phase. `sizeForItem(itemOrPr)` is an
 * injectable resolver (defaults to reading the backlog frontmatter `size` field via `we:scripts/backlog/
 * frontmatter.mjs#readField` when the demand names a backlog item) so `tokensPerStoryPoint` can be computed
 * without this pure function itself touching the filesystem.
 */
export function rollupByDemand(rows, { sizeForItem = () => null } = {}) {
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = rollupKey(row);
    if (!groups.has(key)) {
      groups.set(key, {
        key, repo: row.repo ?? 'chalbert/web-everything', pr: row.pr ?? null, item: row.item ?? null,
        sessions: 0, byPhase: {},
      });
    }
    const g = groups.get(key);
    g.sessions += 1;
    const phase = phaseForKind(row.dispatchKind ?? row.kind);
    if (!g.byPhase[phase]) g.byPhase[phase] = { sessions: 0, tokensIn: 0, tokensOut: 0, tokensCacheRead: 0, tokensCacheWrite: 0, costUsd: 0, unknownCost: false };
    const p = g.byPhase[phase];
    p.sessions += 1;
    const t = row.tokens;
    if (t) { p.tokensIn += t.in ?? 0; p.tokensOut += t.out ?? 0; p.tokensCacheRead += t.cacheRead ?? 0; p.tokensCacheWrite += t.cacheWrite ?? 0; }
    if (typeof row.costUsd === 'number') p.costUsd += row.costUsd; else p.unknownCost = true;
  }
  return [...groups.values()].map((g) => {
    const totalTokens = Object.values(g.byPhase).reduce((s, p) => s + p.tokensIn + p.tokensOut + p.tokensCacheRead + p.tokensCacheWrite, 0);
    const totalCostUsd = Object.values(g.byPhase).reduce((s, p) => s + p.costUsd, 0);
    const size = g.item ? sizeForItem(g.item) : (g.pr ? sizeForItem(g.pr) : null);
    return {
      ...g, totalTokens, totalCostUsd,
      size: Number.isFinite(size) && size > 0 ? size : null,
      tokensPerStoryPoint: Number.isFinite(size) && size > 0 ? totalTokens / size : null,
    };
  });
}

/** Default `sizeForItem` — reads `backlog/<num>-*.md`'s `size:` frontmatter field via the canonical reader
 *  (`readField`), never a hand-rolled YAML parse. `null` for anything not found (no card, no size stamped, or
 *  a hash-identified item this glob can't match). */
export function backlogSizeForItem(itemOrPr, { repoRoot = REPO_ROOT } = {}) {
  const num = String(itemOrPr ?? '').trim();
  if (!/^\d+$/.test(num)) return null;
  let names;
  try { names = readdirSync(join(repoRoot, 'backlog')); } catch { return null; }
  const match = names.find((n) => n.startsWith(`${num}-`) && n.endsWith('.md'));
  if (!match) return null;
  try {
    const content = readFileSync(join(repoRoot, 'backlog', match), 'utf8');
    const raw = readField(content, 'size');
    const size = Number(raw);
    return Number.isFinite(size) ? size : null;
  } catch { return null; }
}

/**
 * Waste flags across a set of rows: a `nothing-to-fix` run (tokens spent confirming nothing needed doing), any
 * repeated-identical-call count, and — when rows carry a `headSha` (not populated by slice 1's own hooks, an
 * honest known gap; a future caller that plumbs it through gets this for free) — more than one `review` row
 * against the same PR+head.
 */
export function flagWaste(rows) {
  const waste = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.outcome === 'nothing-to-fix') {
      waste.push({ type: 'nothing-to-fix', sessionName: row.handle ?? row.sessionName ?? null, pr: row.pr ?? null, item: row.item ?? null, tokens: row.tokens ?? null, costUsd: row.costUsd ?? null });
    }
    if ((row.repeatedCalls ?? 0) > 0) {
      waste.push({ type: 'repeated-identical-calls', sessionName: row.handle ?? row.sessionName ?? null, pr: row.pr ?? null, item: row.item ?? null, count: row.repeatedCalls });
    }
  }
  const byPrHead = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if ((row.dispatchKind ?? row.kind) !== 'review' || !row.pr || !row.headSha) continue;
    const key = `${row.pr}@${row.headSha}`;
    byPrHead.set(key, (byPrHead.get(key) ?? []).concat(row));
  }
  for (const [key, group] of byPrHead) {
    if (group.length > 1) waste.push({ type: 'repeat-review-same-head', key, count: group.length, costUsd: group.reduce((s, r) => s + (r.costUsd ?? 0), 0) });
  }
  return waste;
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(a);
    if (m) flags[m[1]] = m[2] ?? true;
  }
  return flags;
}

/** Our own rows in the shared scorecard store, optionally filtered to `scoredAt >= sinceMs`. */
export function ourRows(sinceMs = null) {
  const store = readStore();
  return store.records.filter((r) => r.rubricVersion === RUBRIC_VERSION && (sinceMs === null || Date.parse(r.scoredAt ?? '') >= sinceMs));
}

function resolveSince(flag) {
  if (!flag || flag === true) return null;
  const m = /^(\d+)([hd])$/.exec(String(flag).trim());
  if (m) return Date.now() - Number(m[1]) * (m[2] === 'h' ? 3600_000 : 86_400_000);
  const t = Date.parse(String(flag));
  return Number.isFinite(t) ? t : null;
}

function buildReport(sinceMs) {
  const rows = ourRows(sinceMs);
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0 };
  for (const r of rows) if (gradeCounts[r.grade] !== undefined) gradeCounts[r.grade] += 1;
  const waste = flagWaste(rows);
  const wasteByType = {};
  for (const w of waste) wasteByType[w.type] = (wasteByType[w.type] ?? 0) + 1;
  const demand = rollupByDemand(rows, { sizeForItem: backlogSizeForItem });
  return { rowCount: rows.length, gradeCounts, wasteByType, wasteTotal: waste.length, demand };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);
  if (cmd !== 'report') {
    process.stderr.write('usage: run-rating.mjs report [--since=<Nh|Nd|ISO>] [--json]\n');
    process.exitCode = 2;
    return;
  }
  const sinceMs = resolveSince(flags.since);
  const report = buildReport(sinceMs);
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(`run-rating report${sinceMs ? ` (since ${new Date(sinceMs).toISOString()})` : ''}\n`);
  process.stdout.write(`  rows scored: ${report.rowCount}\n`);
  process.stdout.write(`  grade distribution: A=${report.gradeCounts.A} B=${report.gradeCounts.B} C=${report.gradeCounts.C} D=${report.gradeCounts.D}\n`);
  process.stdout.write(`  waste flags: ${report.wasteTotal} (${Object.entries(report.wasteByType).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'})\n`);
  process.stdout.write('  per-demand tokens:\n');
  for (const d of report.demand) {
    const sp = d.tokensPerStoryPoint !== null ? d.tokensPerStoryPoint.toFixed(0) : 'n/a';
    process.stdout.write(`    ${d.key}: ${d.totalTokens} tok, $${d.totalCostUsd.toFixed(2)}, ${d.sessions} session(s), tokens/pt=${sp}\n`);
  }
}

const isMain = (() => {
  try { return import.meta.url === `file://${process.argv[1]}`; } catch { return false; }
})();
if (isMain) main();
