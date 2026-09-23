/**
 * concurrent-baseline-comparison.mjs — mechanizes the CONCURRENT-BASELINE comparison #3690 Fork 2 names
 * as the PREFERRED evidence shape for whether a delegation trial is clean/informative (#3783).
 *
 * WHY THIS EXISTS (grounding, from backlog/3690 and backlog/3783): counting a trailing clean streak against
 * a fixed N is not statistical evidence — the 95% upper bound on the failure rate at N=5 is 45.07%. Mature
 * progressive-delivery systems (Spinnaker Kayenta's per-metric Mann-Whitney test, wrapped by Argo Rollouts as
 * an AnalysisTemplate) compare a canary against a CONCURRENT BASELINE instead. The equivalent here: run the
 * SAME task through Claude and through a delegated provider, and record both outcomes as one linked pair in
 * `we:scripts/conveyor/run-scorecards.json`, so a same-task comparison — not two independent trials of
 * dissimilar tasks — becomes readable evidence. Two rows already exist by hand (claude-native vs
 * antigravity/claude-sonnet-4-6 reviewing the same PR 2223 diff, both `scoredAt` 2026-09-15T14:35) — this
 * module is the mechanization of producing that shape, not a re-derivation of it.
 *
 * WHAT THIS MODULE DOES NOT DO, and why (a structural fact, not a scope-narrowing choice):
 *   - It does NOT dispatch Claude's own side of the comparison. There is no `claude-direct-task.mjs` the way
 *     there is a `we:scripts/codex-direct-task.mjs` / `we:scripts/gemini-direct-task.mjs` — Claude can only be
 *     dispatched by a live orchestrating session's own Task/Agent tool, never shelled out to from a script.
 *     `recordConcurrentBaselineComparison`'s `claude` argument is therefore an ALREADY-PRODUCED result (a
 *     diff that ran, then was independently judged — by a human, an independent Claude subagent, or a judge
 *     spawn — into `{outcome, verifiedBy, findings}`), supplied by the calling session, exactly how the two
 *     hand-written precedent rows were actually produced.
 *   - It does NOT re-implement diff *judging*. Turning a raw diff into `{outcome, verifiedBy, findings}` is
 *     the job of the existing jury/judge machinery (`we:scripts/lib/jury-core.mjs`'s `deriveVerdict` over
 *     normalized findings, `we:scripts/lib/judge-spawn.mjs` family, `we:scripts/operations/review-pr.mjs`) —
 *     this module accepts that judgment as input on both sides, same contract `log-delegation-trial.mjs`
 *     already has for a single trial.
 *   - It DOES dispatch the delegated provider for real: `dispatchDelegatedProvider` is a thin selector over
 *     the existing `codexDirectTask`/`geminiDirectTask` dispatch machinery (never re-implemented here),
 *     producing a real diff + gate result a caller then judges before calling `recordConcurrentBaselineComparison`.
 *
 * "JUDGING THE DIFFERENCE" is `compareTrialOutcomes`: a PURE, deterministic comparison of two ALREADY-JUDGED
 * outcomes for the same task — the Kayenta/Argo sense of comparing canary metrics against a baseline's
 * metrics, not a second LLM call re-litigating which diff reads better. No filesystem, clock, or randomness.
 *
 * RECORDING is `recordConcurrentBaselineComparison`: validates both sides up front (throws before any IO,
 * same contract as `logDelegationTrial`), mints one `comparisonId`, and writes BOTH rows via
 * `logDelegationTrial` so every existing validation (schema, secret scrub) applies identically to each side —
 * this module adds no second write path. A row for a side whose write fails is `null` in the return value;
 * the other side is still attempted, so one store hiccup does not silently drop both trials.
 */
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { logDelegationTrial, TASK_TYPES } from './log-delegation-trial.mjs';
import { codexDirectTask } from '../codex-direct-task.mjs';
import { geminiDirectTask } from '../gemini-direct-task.mjs';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

// @test-only-export-ok: shared outcome ranking, exported so a caller can reason about a comparison result
// without re-deriving the ordering.
export const OUTCOME_RANK = Object.freeze({ landed: 2, reworked: 1, rejected: 0 });

export const AGREEMENTS = Object.freeze({
  CONCORDANT_CLEAN: 'concordant-clean',
  CONCORDANT_FAILED: 'concordant-failed',
  CLAUDE_BETTER: 'claude-better',
  DELEGATED_BETTER: 'delegated-better',
});

/**
 * Compare two ALREADY-JUDGED trial outcomes for the SAME task. Pure — no IO, no clock, no randomness.
 * @param {{outcome: 'landed'|'rejected'|'reworked'}} claudeSide
 * @param {{outcome: 'landed'|'rejected'|'reworked'}} delegatedSide
 * @returns {{agreement: string, claudeOutcome: string, delegatedOutcome: string, summary: string}}
 */
export function compareTrialOutcomes(claudeSide, delegatedSide) {
  const claudeOutcome = claudeSide?.outcome;
  const delegatedOutcome = delegatedSide?.outcome;
  if (!Object.hasOwn(OUTCOME_RANK, claudeOutcome)) {
    throw new TypeError(`concurrent-baseline-comparison: claude side outcome must be one of ${Object.keys(OUTCOME_RANK).join(', ')}`);
  }
  if (!Object.hasOwn(OUTCOME_RANK, delegatedOutcome)) {
    throw new TypeError(`concurrent-baseline-comparison: delegated side outcome must be one of ${Object.keys(OUTCOME_RANK).join(', ')}`);
  }
  const claudeRank = OUTCOME_RANK[claudeOutcome];
  const delegatedRank = OUTCOME_RANK[delegatedOutcome];

  let agreement;
  let summary;
  if (claudeRank === delegatedRank) {
    if (claudeRank === OUTCOME_RANK.landed) {
      agreement = AGREEMENTS.CONCORDANT_CLEAN;
      summary = `Both sides landed clean on the same task (claude=${claudeOutcome}, delegated=${delegatedOutcome}) — concurrent baselines agree.`;
    } else {
      agreement = AGREEMENTS.CONCORDANT_FAILED;
      summary = `Both sides fell short on the same task (claude=${claudeOutcome}, delegated=${delegatedOutcome}) — concurrent baselines agree the task was hard, not that either provider is weak.`;
    }
  } else if (claudeRank > delegatedRank) {
    agreement = AGREEMENTS.CLAUDE_BETTER;
    summary = `Claude outperformed the delegated provider on the same task (claude=${claudeOutcome}, delegated=${delegatedOutcome}).`;
  } else {
    agreement = AGREEMENTS.DELEGATED_BETTER;
    summary = `The delegated provider outperformed Claude on the same task (claude=${claudeOutcome}, delegated=${delegatedOutcome}).`;
  }
  return { agreement, claudeOutcome, delegatedOutcome, summary };
}

/** Validate one side's shape before any IO. Throws with `sideName` in the message, matching logDelegationTrial's style. */
function requireSide(side, sideName) {
  if (!side || typeof side !== 'object' || Array.isArray(side)) {
    throw new TypeError(`concurrent-baseline-comparison: ${sideName} must be an object`);
  }
  if (!isNonEmptyString(side.model)) {
    throw new TypeError(`concurrent-baseline-comparison: ${sideName}.model must be a non-empty string`);
  }
  if (!Object.hasOwn(OUTCOME_RANK, side.outcome)) {
    throw new TypeError(`concurrent-baseline-comparison: ${sideName}.outcome must be one of landed, reworked, rejected`);
  }
}

/**
 * Record ONE concurrent-baseline trial pair (#3690 Fork 2; #3783). Throws before any IO on invalid input,
 * same contract `logDelegationTrial` already has. Mints a shared `comparisonId` and writes both rows through
 * `logDelegationTrial` unchanged — this module never bypasses that validation/scrub.
 *
 * @param {{description: string, taskType: string, item?: number, pr?: number, scoredAt?: string}} task
 * @param {{provider?: string, model: string, outcome: 'landed'|'rejected'|'reworked', verifiedBy: 'claude-subagent'|'independent-claude'|'other', findings?: string|null, informative?: boolean, rootCause?: string|null}} claude
 * @param {{provider: string, model: string, outcome: 'landed'|'rejected'|'reworked', verifiedBy: 'claude-subagent'|'independent-claude'|'other', findings?: string|null, informative?: boolean, rootCause?: string|null}} delegated
 * @param {object} [io] - forwarded to `logDelegationTrial`'s own injectable store IO.
 * @param {{idFn?: () => string}} [opts] - `idFn` is injectable so tests get a deterministic `comparisonId`.
 * @returns {{comparisonId: string, comparison: object, claudeRow: object|null, delegatedRow: object|null}}
 */
export function recordConcurrentBaselineComparison(task, claude, delegated, io = {}, { idFn = randomUUID } = {}) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    throw new TypeError('concurrent-baseline-comparison: task must be an object');
  }
  if (!isNonEmptyString(task.description)) {
    throw new TypeError('concurrent-baseline-comparison: task.description must be a non-empty string');
  }
  if (!TASK_TYPES.includes(task.taskType)) {
    throw new TypeError(`concurrent-baseline-comparison: task.taskType must be one of: ${TASK_TYPES.join(', ')}`);
  }
  requireSide(claude, 'claude');
  requireSide(delegated, 'delegated');
  if (!isNonEmptyString(delegated.provider)) {
    throw new TypeError('concurrent-baseline-comparison: delegated.provider must be a non-empty string');
  }

  // Computed BEFORE any write, so an invalid outcome pairing is refused before either row is stored — same
  // "throw before IO" discipline as logDelegationTrial.
  const comparison = compareTrialOutcomes(claude, delegated);
  const comparisonId = idFn();

  const buildRow = (side, provider) => ({
    provider,
    model: side.model,
    taskDescription: task.description,
    taskType: task.taskType,
    outcome: side.outcome,
    verifiedBy: side.verifiedBy,
    findings: side.findings ?? null,
    item: task.item ?? null,
    pr: task.pr ?? null,
    informative: side.informative ?? false,
    rootCause: side.rootCause ?? null,
    comparisonId,
    ...(task.scoredAt ? { scoredAt: task.scoredAt } : {}),
  });

  const claudeRow = logDelegationTrial(buildRow(claude, claude.provider ?? 'claude-native'), io);
  const delegatedRow = logDelegationTrial(buildRow(delegated, delegated.provider), io);

  return { comparisonId, comparison, claudeRow, delegatedRow };
}

/**
 * Dispatch the delegated provider's SIDE of the comparison for real, by selecting and calling the existing
 * `codexDirectTask`/`geminiDirectTask` machinery — never a re-implementation. Produces a raw diff + gate
 * result; turning that into `{outcome, verifiedBy, findings}` is the caller's judging step (see module doc).
 * @param {{provider: 'codex'|'gemini'|'antigravity', task: string, dir?: string, repoRoot?: string, model?: string}} opts
 * @param {{codexTaskFn?: Function, geminiTaskFn?: Function}} [deps] - injectable so tests never shell out for real.
 * @returns {Promise<object>} the underlying direct-task report (`diff`, `gate`, …), with `provider` attached.
 */
export async function dispatchDelegatedProvider({ provider, ...opts }, { codexTaskFn = codexDirectTask, geminiTaskFn = geminiDirectTask } = {}) {
  if (provider === 'codex') {
    const report = await codexTaskFn(opts);
    return { provider, ...report };
  }
  if (provider === 'gemini' || provider === 'antigravity') {
    const report = await geminiTaskFn(opts);
    return { provider, ...report };
  }
  throw new TypeError(`concurrent-baseline-comparison: unsupported delegated provider '${provider}' (expected 'codex', 'gemini', or 'antigravity')`);
}

const usage = `Usage: node scripts/conveyor/concurrent-baseline-comparison.mjs
  --task=TEXT --task-type=${TASK_TYPES.join('|')} [--item=NUMBER] [--pr=NUMBER] [--scored-at=TIMESTAMP]
  --claude-model=NAME --claude-outcome=landed|rejected|reworked --claude-verified-by=claude-subagent|independent-claude|other
    [--claude-provider=NAME (default claude-native)] [--claude-findings=TEXT]
    [--claude-informative=true|false] [--claude-root-cause=TEXT]
  --delegated-provider=NAME --delegated-model=NAME --delegated-outcome=landed|rejected|reworked
    --delegated-verified-by=claude-subagent|independent-claude|other [--delegated-findings=TEXT]
    [--delegated-informative=true|false] [--delegated-root-cause=TEXT]
  [--help]

Records one concurrent-baseline trial pair (#3690 Fork 2; #3783): the SAME task run through Claude and
through a delegated provider, judged and linked by a shared comparisonId. Both sides' outcome/verifiedBy are
already-produced judgments (a human, an independent Claude subagent, or a judge spawn) — this command records
and compares them, it does not itself judge a diff. Quote values containing spaces.`;

const KNOWN_FLAGS = new Set([
  'task', 'task-type', 'item', 'pr', 'scored-at',
  'claude-provider', 'claude-model', 'claude-outcome', 'claude-verified-by',
  'claude-findings', 'claude-informative', 'claude-root-cause',
  'delegated-provider', 'delegated-model', 'delegated-outcome', 'delegated-verified-by',
  'delegated-findings', 'delegated-informative', 'delegated-root-cause',
]);

function parseArgv(argv) {
  const flat = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/s.exec(arg);
    if (!match || !KNOWN_FLAGS.has(match[1])) {
      throw new Error(`unknown or malformed flag: ${arg}; see --help`);
    }
    flat[match[1]] = match[2];
  }
  return flat;
}

function parseBoolFlag(flat, key) {
  if (!Object.hasOwn(flat, key)) return undefined;
  if (flat[key] !== 'true' && flat[key] !== 'false') {
    throw new Error(`--${key} must be true or false`);
  }
  return flat[key] === 'true';
}

function parseIntFlag(flat, key) {
  if (!Object.hasOwn(flat, key)) return undefined;
  const value = flat[key];
  if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    throw new Error(`--${key} must be a positive integer`);
  }
  return Number(value);
}

/** CLI seam accepts the store's injectable IO so tests never write the real store. */
export function main(argv, io = {}) {
  if (argv.includes('--help')) {
    console.log(usage);
    return 0;
  }
  try {
    const flat = parseArgv(argv);
    const task = {
      description: flat.task,
      taskType: flat['task-type'],
      item: parseIntFlag(flat, 'item'),
      pr: parseIntFlag(flat, 'pr'),
      scoredAt: flat['scored-at'],
    };
    const claude = {
      provider: flat['claude-provider'],
      model: flat['claude-model'],
      outcome: flat['claude-outcome'],
      verifiedBy: flat['claude-verified-by'],
      findings: flat['claude-findings'],
      informative: parseBoolFlag(flat, 'claude-informative'),
      rootCause: flat['claude-root-cause'],
    };
    const delegated = {
      provider: flat['delegated-provider'],
      model: flat['delegated-model'],
      outcome: flat['delegated-outcome'],
      verifiedBy: flat['delegated-verified-by'],
      findings: flat['delegated-findings'],
      informative: parseBoolFlag(flat, 'delegated-informative'),
      rootCause: flat['delegated-root-cause'],
    };
    const result = recordConcurrentBaselineComparison(task, claude, delegated, io);
    if (result.claudeRow === null || result.delegatedRow === null) {
      throw new Error('could not write one or both trials to the scorecard store');
    }
    console.log(JSON.stringify(result));
    return 0;
  } catch (error) {
    console.error(`concurrent-baseline-comparison: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
