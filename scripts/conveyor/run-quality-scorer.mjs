/**
 * @file scripts/conveyor/run-quality-scorer.mjs
 * @description THE RUN-QUALITY SCORER (`#3649`) — given a dispatched agent's transcript, ALREADY reduced to
 *   the small per-record shape `we:skills-src/inspect-codex-transcript/codex-transcript.mjs#summarizeRecord`
 *   produces (`{kind, ...}` — `tool_call`/`tool_output`/`message`/`reasoning`/`turn_started`/`turn_complete`/
 *   `tokens`/`turn_context`), scores it against `we:scripts/conveyor/run-quality-rubric.mjs` and returns the
 *   deduction VECTOR — never a bare number (Fork 2's ruling: the vector is the record, a scalar is derived).
 *
 * WHY THE CODEX RECORD SHAPE, NOT A NEW ONE. `#3649`'s own ruling names `#3477` as the single transcript
 * READER (this module is never a second reader — it consumes whatever shape a reader hands it). The two
 * subjects THIS build targets — Codex's `fix`-kind delivery (`we:scripts/operations/codex-delivery-provider.mjs`,
 * `we:scripts/codex-direct-task.mjs`) and its advisory review seat (`we:scripts/lib/codex-judge-spawn.mjs`) —
 * are BOTH real `codex exec` invocations, so both produce the identical rollout-transcript shape the
 * `inspect-codex-transcript` skill already reads and normalizes. Reusing its `summarizeRecord` (rather than a
 * bespoke parser here) is exactly the "reuse, do not rebuild" `#3649` asks for in scope; a future widening to
 * a Claude-dispatched subject's transcript (`we:skills-src/inspect-agent-health/agent-health.mjs#summarizeEntry`)
 * is a second, separate adapter feeding the SAME scorer core, not a rewrite of it — see {@link scoreRecords}.
 *
 * NEVER 100 ON AN EMPTY READ (Fork 2's skeptic amendment). `criteriaEvaluated` is 0, and `score` is `null`
 * (never 100), when there is nothing to evaluate — an unreadable or empty transcript is "no information",
 * not "a perfect run".
 *
 * SCRUBBED BEFORE IT LEAVES THIS MODULE. Every `evidence` string is a literal transcript excerpt, which is
 * exactly the automated-judge-paraphrasing-a-raw-transcript privacy gap `#automated-session-introspection`
 * clause 3 / `#3477` clause 5 exist to close. `scrubEvidence` runs `we:scripts/lib/secret-scrub.mjs#scrubReasons`
 * over every evidence string and DENIES (drops the evidence, keeps the finding) rather than redacting — the
 * store layer (`run-scorecard-store.mjs`) refuses outright if a dirty string somehow still reaches it, so this
 * is defence in depth, not the only gate.
 */

import { readFileSync } from 'node:fs';
import { isBlacklistedOperation, DEFAULT_OPERATION_BLACKLIST } from './hiccup-classify.mjs';
import { scrubReasons } from '../lib/secret-scrub.mjs';
import { CRITERIA_BY_ID, EVALUABLE_CRITERIA, RUBRIC_VERSION } from './run-quality-rubric.mjs';
import { parseJsonlEvents } from '../codex-direct-task.mjs';

/** Backgrounding shapes a command's own text can carry — the `passive-wait-no-poll` hunt. */
const BACKGROUND_PATTERN_RE = /(&\s*$|\bnohup\b|\bdisown\b|--background\b|run_in_background\s*[:=]\s*true)/i;

/** A test-failure shape in a tool's OUTPUT text — the `abandoned-failing-test` hunt. Conservative on purpose:
 *  a false positive here (calling a clean run "abandoned") is worse than a miss. */
const TEST_FAILURE_RE = /\bFAIL(?:ED|URES?)?\b|✗|\b\d+\s+failing\b|Tests:\s*\d+\s+failed/;
/** The matching "tests are clean now" shape a later tool output can carry, closing an earlier failure. */
const TEST_CLEAN_RE = /\b(?:\d+\s+)?passed\b.*\b0\s+failed\b|\bAll tests passed\b|\b0\s+failing\b/i;

const isToolCall = (r) => r?.kind === 'tool_call';
const isToolOutput = (r) => r?.kind === 'tool_output';
/** Best-effort normalized command text off a `tool_call`/`tool_output` record — both carry it differently. */
const commandText = (r) => String(r?.input ?? '').trim();

/** Redact an evidence string to a safe placeholder when it fails the append-time scrub — DENY, never redact
 *  the actual bytes (Fork 2's amendment: deny on a hit). Returns `{evidence, denied}`. */
function scrubEvidence(evidence) {
  const reasons = scrubReasons(evidence);
  // The COUNT is reported, never the reason labels themselves — some of `scrubReasons`'s own reason strings
  // (e.g. "repo-identifying name (webeverything)") name the exact fragment they are protecting, so echoing
  // the reason text back would be denying on a hit while still leaking the hit.
  if (reasons.length > 0) {
    const word = reasons.length === 1 ? 'reason' : 'reasons';
    return { evidence: `evidence withheld -- failed the append-time scrub -- ${reasons.length} scrub ${word} total`, denied: true };
  }
  return { evidence, denied: false };
}

/**
 * `blacklisted-operation` — every `tool_call`'s command text against the standing blacklist. REUSES
 * `isBlacklistedOperation` verbatim rather than re-deriving a second copy of the list.
 * @returns {{count:number, evidence:string}|null}
 */
function huntBlacklistedOperation(records) {
  const hits = records.filter(isToolCall).filter((r) => isBlacklistedOperation(commandText(r), DEFAULT_OPERATION_BLACKLIST));
  if (!hits.length) return null;
  return { count: hits.length, evidence: `blacklisted call(s): ${hits.map((r) => commandText(r).slice(0, 80)).join(' | ')}` };
}

/**
 * `abandoned-failing-test` — a `tool_output` matching {@link TEST_FAILURE_RE} with no LATER `tool_output`
 * matching {@link TEST_CLEAN_RE}.
 */
function huntAbandonedFailingTest(records) {
  let lastFailureIdx = -1;
  let clearedAfter = false;
  records.forEach((r, i) => {
    if (!isToolOutput(r)) return;
    const text = String(r.text ?? '');
    if (TEST_FAILURE_RE.test(text)) { lastFailureIdx = i; clearedAfter = false; }
    else if (lastFailureIdx !== -1 && i > lastFailureIdx && TEST_CLEAN_RE.test(text)) clearedAfter = true;
  });
  if (lastFailureIdx === -1 || clearedAfter) return null;
  return { count: 1, evidence: `a test failure at record ${lastFailureIdx} was never followed by a clean re-run` };
}

/** `passive-wait-no-poll` — the transcript's LAST tool_call matches a backgrounding shape, with no later
 *  tool_call/tool_output reading its result (it IS the last substantive record). */
function huntPassiveWaitNoPoll(records) {
  const toolCalls = records.filter(isToolCall);
  if (!toolCalls.length) return null;
  const last = toolCalls[toolCalls.length - 1];
  const lastIdx = records.lastIndexOf(last);
  const hasLaterActivity = records.slice(lastIdx + 1).some((r) => r.kind === 'tool_call' || r.kind === 'tool_output');
  if (BACKGROUND_PATTERN_RE.test(commandText(last)) && !hasLaterActivity) {
    return { count: 1, evidence: `ended right after a backgrounded command: ${commandText(last).slice(0, 120)}` };
  }
  return null;
}

/** `redundant-command` — the same normalized command text 3+ times. Accrual, not always-actionable. */
function huntRedundantCommand(records) {
  const counts = new Map();
  for (const r of records.filter(isToolCall)) {
    const key = commandText(r);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeated = [...counts.entries()].filter(([, n]) => n >= 3);
  if (!repeated.length) return null;
  const totalExtra = repeated.reduce((sum, [, n]) => sum + (n - 2), 0); // first 2 reads are normal; 3rd+ counts
  return { count: totalExtra, evidence: repeated.map(([cmd, n]) => `"${cmd.slice(0, 60)}" ×${n}`).join(' | ') };
}

/** `command-churn` — a raw count, NEVER a deduction (Fork 4: no par band in v1). Always returns a count so
 *  the aggregate distribution exists once a population accrues; `weight` is 0 in the rubric so it never
 *  moves the score. */
function huntCommandChurn(records) {
  const n = records.filter(isToolCall).length;
  return { count: n, evidence: `${n} tool call(s) in this run` };
}

const HUNTERS = Object.freeze({
  'blacklisted-operation': huntBlacklistedOperation,
  'abandoned-failing-test': huntAbandonedFailingTest,
  'passive-wait-no-poll': huntPassiveWaitNoPoll,
  'redundant-command': huntRedundantCommand,
  'command-churn': huntCommandChurn,
});

/**
 * Score an already-normalized record list against the rubric. PURE — no fs, no clock.
 *
 * @param {object[]} records - `summarizeRecord`-shaped entries, oldest to newest.
 * @returns {{rubricVersion: string, criteriaEvaluated: number, deductions: object[], score: number|null}}
 */
export function scoreRecords(records) {
  const list = Array.isArray(records) ? records : [];
  if (list.length === 0) {
    // Nothing to evaluate — Fork 2's amendment: null, never 100.
    return { rubricVersion: RUBRIC_VERSION, criteriaEvaluated: 0, deductions: [], score: null };
  }

  const deductions = [];
  for (const id of EVALUABLE_CRITERIA) {
    const hunter = HUNTERS[id];
    if (!hunter) continue; // named evaluable in the rubric but no hunter wired yet — never silently "evaluates".
    const hit = hunter(list);
    if (!hit || hit.count <= 0) continue;
    const meta = CRITERIA_BY_ID[id];
    const { evidence, denied } = scrubEvidence(hit.evidence);
    deductions.push({ criterion: id, weight: meta.weight, count: hit.count, evidence, evidenceDenied: denied });
  }

  const criteriaEvaluated = EVALUABLE_CRITERIA.filter((id) => HUNTERS[id]).length;
  const totalDeduction = deductions.reduce((sum, d) => sum + d.weight * d.count, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeduction));
  return { rubricVersion: RUBRIC_VERSION, criteriaEvaluated, deductions, score };
}

/**
 * ADAPTER — read a Codex rollout transcript file (already resolved to a path) and score it, using the SAME
 * bounded parser `inspect-codex-transcript` uses. Injectable `readTranscriptRecords` so tests never touch a
 * real rollout file.
 *
 * @param {string} rolloutFile - an ALREADY-RESOLVED path (see `codex-transcript.mjs#resolveTranscript`).
 * @param {{readTranscriptRecords?: (file:string) => object[]}} [io]
 * @test-only-export-ok: the permanent call site (a `#3477` SessionEnd/reaper trigger) is owed follow-on
 *   wiring, not built this session — proven instead via a scratch script against two REAL Codex transcripts
 *   (see `we:backlog/3651-*.md`'s update note).
 */
export function scoreCodexTranscriptFile(rolloutFile, { readTranscriptRecords } = {}) {
  if (typeof readTranscriptRecords !== 'function') {
    throw new TypeError('run-quality-scorer: `readTranscriptRecords` must be supplied — this module never reads the filesystem itself, see codex-transcript.mjs for the real reader');
  }
  return scoreRecords(readTranscriptRecords(rolloutFile));
}

/**
 * THE ADVISORY-JUDGE-SEAT WIRING (confirmed root cause fix, `we:scripts/lib/codex-judge-spawn.mjs`). That
 * provider's raw `codex exec --json` STDOUT STREAM is a DIFFERENT shape from the ROLLOUT FILE
 * `scoreCodexTranscriptFile`/`summarizeRecord` (`we:skills-src/inspect-codex-transcript/codex-transcript.mjs`)
 * read: a rollout record is `{timestamp, type, payload: {...}}`; the judge's own stream (identical family to
 * `we:scripts/codex-direct-task.mjs`'s agentic stream, which `parseJsonlEvents` already parses) is flatter —
 * `{type: 'item.completed', item: {type: 'command_execution'|'agent_message'|…, …}}`, with NO `payload`
 * wrapper. `persistCodexJudgeTranscript` (`codex-judge-spawn.mjs`) persists exactly THIS stream shape — Codex's
 * `--ephemeral` flag (kept, deliberately — see that module's header) means there is no rollout file for this
 * seat's runs to fall back to. `mapCodexJudgeEventsToRecords` is therefore a NEW adapter, not a reuse of
 * `summarizeRecord`, translating the stream's `command_execution` (which — unlike a rollout's separate call/
 * output pair — carries the command AND its output+exit code on the SAME item) into the ordered
 * `tool_call`/`tool_output` pair `scoreRecords`'s hunters already expect, and `agent_message` into `message`.
 *
 * PURE. Never throws on a malformed/unrecognised event — an event this function does not name a mapping for
 * (a `thread.started`, a bare `turn.started`, a `file_change`) is simply skipped, since no wired hunter reads
 * anything else today; widen this the day a hunter needs one of them.
 *
 * @param {object[]} events - `parseJsonlEvents`-shaped entries, oldest to newest.
 * @returns {object[]} `summarizeRecord`-shaped entries `scoreRecords` can consume directly.
 */
export function mapCodexJudgeEventsToRecords(events) {
  const out = [];
  for (const e of (Array.isArray(events) ? events : [])) {
    if (e?.type !== 'item.completed' || !e.item) {
      if (e?.type === 'turn.completed' || e?.type === 'turn.failed') out.push({ kind: 'turn_complete' });
      continue;
    }
    const { item } = e;
    if (item.type === 'command_execution') {
      out.push({ kind: 'tool_call', name: 'shell', input: String(item.command ?? '') });
      out.push({
        kind: 'tool_output',
        text: String(item.aggregated_output ?? ''),
        isError: item.exit_code != null && item.exit_code !== 0,
      });
    } else if (item.type === 'agent_message') {
      out.push({ kind: 'message', role: 'assistant', text: String(item.text ?? '') });
    }
    // `file_change` and anything else: no wired hunter reads it today — skipped, not mis-mapped.
  }
  return out;
}

/**
 * THE REAL (non-injected) READER for a Codex judge's own persisted transcript — the concrete
 * `readTranscriptRecords`-shaped function `scoreCodexJudgeTranscriptFile` below wires by default. Reads the
 * WHOLE file (unlike `inspect-codex-transcript`'s deliberately bounded tail read): a judge transcript is one
 * bounded schema-constrained call, not an open-ended coding session, so there is no unbounded-file hazard to
 * guard against here the way there is for `codex-transcript.mjs`'s subject.
 * @param {string} file
 * @param {{readFile?: (p:string) => string}} [io]
 * @returns {object[]} `summarizeRecord`-shaped entries.
 */
export function readCodexJudgeTranscriptRecords(file, { readFile = (p) => readFileSync(p, 'utf8') } = {}) {
  return mapCodexJudgeEventsToRecords(parseJsonlEvents(readFile(file)));
}

/**
 * Score a Codex advisory-judge-seat run from its persisted transcript FILE PATH — closing the exact gap the
 * confirmed root cause named: before `codex-judge-spawn.mjs` persisted anything, this seat's runs had no
 * transcript to read and were correctly (but unhelpfully) recorded `score: null, criteriaEvaluated: 0`. With a
 * real `transcriptFile` in hand (from a run record's stamped telemetry — see `we:scripts/operations/
 * run-record.mjs`'s `transcriptFile` telemetry field), this now reads real content and can score a real
 * deduction vector. `readFile` is injectable for tests; production callers get the real filesystem read.
 * @param {string} file - a `codex-judge-spawn.mjs#persistCodexJudgeTranscript` path.
 * @param {{readFile?: (p:string) => string}} [io]
 * @returns {{rubricVersion: string, criteriaEvaluated: number, deductions: object[], score: number|null}}
 */
export function scoreCodexJudgeTranscriptFile(file, io = {}) {
  return scoreRecords(readCodexJudgeTranscriptRecords(file, io));
}

export { RUBRIC_VERSION };
