/**
 * provider-routing.mjs — deterministic LLM dispatch-provider and supervision-level router (#3690).
 *
 * This module provides the routing intelligence for picking the optimal dispatch provider
 * ('gemini' | 'codex' | 'both' | 'claude') and model supervision level ('full' | 'spot-check').
 *
 * REACH: the mechanical dispatch path only. Mechanical provider routing binds the mechanical dispatch
 * path only (the autonomous conveyor/runner dispatch machinery). An interactive orchestrating loop
 * keeps its own inline routing verdict under [docs/agent/backlog-workflow.md#model-routing] Inline (3)
 * and [docs/agent/backlog-workflow.md#effort-routing]; the router may inform that verdict, never
 * replace it (per [docs/agent/platform-decisions.md#delegation-trial-record-graduation] "Reach", #3690).
 *
 * PURE MODULE ARCHITECTURE (per [docs/agent/platform-decisions.md#deterministic-core-thin-judgment]):
 *   • Zero filesystem (fs) or process environment reads at import or execution time.
 *   • Callers explicitly load and pass in scorecard records (from the shared scorecard store — `run-scorecard-store.mjs#readStore`, #4155
 *     or in-memory fixtures) and backdown thresholds.
 *   • Fully deterministic: identical arguments produce byte-identical return objects every time.
 *   • No Date.now(), Math.random(), or implicit time reads. Timestamps in scorecards are treated as
 *     deterministic ISO-8601 strings.
 *
 * `explorationHint` is an ADDITIONAL, purely advisory field sourced from caller-loaded
 * `we:scripts/lib/model-capability-ratings.mjs` data, consulted ONLY inside `selectProvider`,
 * NEVER inside `selectSupervisionLevel`. It cannot change recommendation, claudeTier, or level.
 *
 * PROGRESSIVE BACKDOWN & GRADUATION MODEL (#3690):
 *   • Unit of trust is strictly {provider, model, subjectClass, taskType}, never broader (identity never
 *     inherits trust). `taskType` carries whatever the caller's subject axis is — a work task type, a role
 *     kind, or a review lens — and `subjectClass` keeps those axes from colliding: a review-lens or role-kind
 *     subject never counts toward a work triple's streak, and a work subject never counts toward one of theirs,
 *     even where the subject strings happen to match (#3801 Fork 3).
 *   • N = 5 consecutive clean trials (verified by claude-subagent or independent-claude) required for spot-check.
 *   • 'other'-verified trials (e.g. smoke tests) neither advance nor reset the streak.
 *   • Informative-trial requirement: at least one historical trial for the triple must have caught and fixed
 *     a real finding from independent review.
 *   • Calibration-miss hard veto: any confirmed finding as the most recent trial immediately forces full
 *     supervision, resetting the streak.
 *
 * CASCADE EVALUATION ORDER (first fit wins):
 *   1. Gemini / Antigravity fitness check -> 'gemini'
 *   2. Codex fitness check -> 'codex'
 *   3. Both together (high-stakes critical or thin history without informative trials) -> 'both'
 *   4. Claude fallback by effort tier ('haiku' | 'sonnet' | 'opus') -> 'claude'
 *
 * DEFAULT AGY ALTERNATE: Claude Sonnet/Opus offers alternateBackend via gemini-direct-task.mjs and
 * Antigravity's separate quota by default for capacity relief. Three opt-outs return null: Haiku has no
 * agy equivalent; statute-tier paths, architectural-decision and triage-research require native Claude
 * session identity/tools; or the most recent Antigravity trial for this exact taskType is not clean.
 * Antigravity's sandbox is a different execution context from a native Claude Code session. This routing
 * recommendation does not change supervision or graduation. Every Claude branch appends an
 * agy-alternate-backend audit entry after claude-tier; other branches omit the alternateBackend field.
 *
 * STATUTE-TIER PATHS:
 *   Per AGENTS.md line 49 and docs/agent/ conventions: docs/agent/platform-decisions.md and any path
 *   under docs/agent/ constitute the repo's statute/governance layer. Touching ANY statute-tier path
 *   forces Claude Opus, never Gemini or Codex, regardless of track record.
 *
 * GEMINI/ANTIGRAVITY SCOPE (observational, not enforced — 2026-09-15/16 evidence): dispatch Gemini via
 * Antigravity for well-scoped EXECUTION work where another agent (Codex or Claude) has already designed
 * the solution and defined success criteria, not for open-ended design/judgment work. Its one clean,
 * independently-verified success this session was real merge-conflict resolution on PR #2291 and PR
 * #2292 (gemini-3.8-flash-low; the conflict, both sides' intent, and correctness were all already known
 * — see PR #2294's scorecard trials). By contrast its one attempt to DECIDE what to build (the
 * `stale-state` operation folded into #2292) failed immediately on an internal tool error before
 * touching a file, and was redone by Codex — there is still no clean trial of it choosing *what* to
 * build, only of it reconciling an already-known target. This is a documented judgment call for whoever
 * dispatches work, not a coded gate on `taskType`; re-derive once real build-new-feature trial data exists.
 */

import { isUsableForExploration } from './model-capability-ratings.mjs';

// ── EXPLORATION SIGNAL ONLY — advisory benchmarks, separate from supervision ──
// @test-only-export-ok: Shared threshold for caller-visible exploration hints
export const THIN_TRIAL_THRESHOLD = 3;

/** Pure advisory lookup used only when finalizing selectProvider's return value. */
function getExplorationHint(taskType, scorecards, context) {
  let geminiCount = 0;
  let codexCount = 0;
  for (const record of scorecards) {
    if (!record || record.taskType !== taskType) continue;
    if (['gemini', 'antigravity'].includes(record.provider)) geminiCount++;
    else if (record.provider === 'codex') codexCount++;
  }
  // Sufficient real evidence prevents even consulting the external registry.
  if (geminiCount >= THIN_TRIAL_THRESHOLD && codexCount >= THIN_TRIAL_THRESHOLD) return null;

  const registry = context?.capabilityRatings;
  const entries = Array.isArray(registry) ? registry : (Array.isArray(registry?.entries) ? registry.entries : []);
  const category = typeof context?.capabilityCategory === 'string'
    ? context.capabilityCategory
    : (['bugfix', 'build-new-feature', 'self-fix'].includes(taskType)
      ? 'autonomousAgenticWork'
      : (['conflict-resolution', 'doc-fix'].includes(taskType) ? 'cliToolUse' : 'overallCodingIndex'));

  let best = null;
  for (const entry of entries) {
    if (!['gemini', 'antigravity', 'codex'].includes(entry?.provider) || !isUsableForExploration(entry)) continue;
    const value = entry.categories?.[category]?.value;
    // Unknown values never rank; retain registry order for equal measured values.
    if (!Number.isFinite(value)) continue;
    if (best === null || value > best.categories[category].value) best = entry;
  }
  if (best === null) return null;

  const { value, unit } = best.categories[category];
  return {
    suggestedProvider: best.provider,
    suggestedModel: best.model,
    category,
    value,
    unit,
    asOf: best.asOf,
    source: best.source,
    reason: `Real trial history for taskType '${taskType}' is thin (gemini/antigravity: ${geminiCount}, codex: ${codexCount} trials, threshold ${THIN_TRIAL_THRESHOLD}); verified external rating suggests trying ${best.provider}/${best.model} (${category}=${value}) next.`,
  };
}

// ── EVIDENCE-BASED SIGNAL — existing routing and supervision policy ────────────

// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export const RECOMMENDATIONS = Object.freeze({
  GEMINI: 'gemini',
  CODEX: 'codex',
  BOTH: 'both',
  CLAUDE: 'claude',
});

// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export const CLAUDE_TIERS = Object.freeze({
  HAIKU: 'haiku',
  SONNET: 'sonnet',
  OPUS: 'opus',
});

// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export const AGY_CLAUDE_MODEL_BY_TIER = Object.freeze({
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6-thinking',
});

// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export const SUPERVISION_LEVELS = Object.freeze({
  FULL: 'full',
  SPOT_CHECK: 'spot-check',
});

// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export const DEFAULT_BACKDOWN_THRESHOLDS = Object.freeze({
  minCleanStreak: 5,
  requireInformativeTrial: true,
  // Post-miss bar (platform-decisions.md#delegation-trial-record-graduation, rule 5; #3889): once a
  // confirmed miss is on record for a triple, the clean-streak bar to reach spot-check becomes
  // minCleanStreak + k, strictly higher than the cold-start bar. `k`, like `minCleanStreak`, is a config
  // default proposed only by a future ordinary batched finding against real trial-count data — this is a
  // structural addition (a new config field), not a recalibration; the placeholder value below is
  // explicitly out of scope for #3889 to justify.
  k: 3,
});

/**
 * Proven trial envelopes grounded in the empirical trials recorded in
 * the shared scorecard store (`run-scorecard-store.mjs#resolveScorecardStorePath`, #4155) and documented in `backlog/3690`:
 *
 * - `doc-fix`: Observed trials were small single-file text fixes (e.g. #3539).
 *   Proven envelope: max 100 LOC, max 2 files.
 * - `bugfix`: Observed trials were targeted script/engine fixes (PR #2223 pid-forwarding,
 *   #3428 NUL-byte bug, ENOBUFS fix, and hardening rounds 1-3). Max observed was ~150 LOC
 *   across 2 files. Proven envelope: max 250 LOC, max 4 files.
 * - `conflict-resolution`: Observed trial was PR #2212 branch conflict resolution (~80 LOC).
 *   Proven envelope: max 200 LOC, max 3 files.
 * - `build-new-feature` / `self-fix` / `other`: Observed trial was gemini-direct-task.mjs
 *   (single utility script, ~180 LOC). Proven envelope: max 300 LOC, max 3 files.
 *
 * Any task exceeding 300 LOC or touching > 4 files exceeds the historical envelope
 * of session-delegated external model trials.
 */
// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export const PROVEN_TASK_ENVELOPES = Object.freeze({
  'doc-fix': Object.freeze({ maxLoc: 100, maxFiles: 2 }),
  'bugfix': Object.freeze({ maxLoc: 250, maxFiles: 4 }),
  'conflict-resolution': Object.freeze({ maxLoc: 200, maxFiles: 3 }),
  'build-new-feature': Object.freeze({ maxLoc: 300, maxFiles: 3 }),
  'self-fix': Object.freeze({ maxLoc: 200, maxFiles: 2 }),
  'other': Object.freeze({ maxLoc: 300, maxFiles: 3 }),
});

/**
 * Check if a repo-relative path is within the statute/governance layer.
 * Per AGENTS.md line 49 and docs/agent/ conventions:
 * `docs/agent/platform-decisions.md` and any path under `docs/agent/` constitute the repo's statute layer.
 * Touching any statute path forces human/Claude review (Claude opus), never Gemini or Codex.
 * @param {string} filePath
 * @returns {boolean}
 */
// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export function isStatuteTierPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return false;
  const normalized = filePath.trim().replace(/^\.?\//, '').toLowerCase();
  return normalized === 'docs/agent/platform-decisions.md' || normalized.startsWith('docs/agent/');
}

/**
 * WIDE-BLAST-RADIUS DISPATCH MACHINERY (#3857). Every Claude dispatch's argv passes through
 * `buildAgentArgv` (`we:scripts/operations/dispatch-lane-io.mjs`), which composes the criteria this
 * file and `we:scripts/lib/dispatch-contracts.mjs` compute — so a scope that touches any of these five
 * files or the tick core that drives them is the machinery choosing its own successor's routing, not an
 * ordinary edit. Frozen and short on purpose: a table to change a row of, not a heuristic to widen.
 */
// @test-only-export-ok: Shared library exported for the model-tier table (#3857) and its own test
export const DISPATCH_MACHINERY_PATHS = Object.freeze([
  'scripts/operations/dispatch-lane-io.mjs',
  'scripts/operations/dispatch-task.mjs',
  'scripts/lib/dispatch-contracts.mjs',
  'scripts/lib/provider-routing.mjs',
  'scripts/conveyor/tick-core.mjs',
]);

/**
 * THE MODEL-TIER TABLE (#3857) — the ONE checked-in table deciding a dispatch worker's Claude tier, by
 * dispatch fact, replacing both the old size/file-count/testability Opus criteria this function's Step 4
 * used to compute inline and the standalone `STORY_KIND_RUNGS` table (`dispatch-contracts.mjs`), which
 * this folds in rather than keeping beside. Sourced verbatim from the operator's 2026-09-22 routing rule
 * (narrower and later than `docs/agent/backlog-workflow.md#model-routing`, which governs the INTERACTIVE
 * orchestrating loop's own sub-agent spawns and is untouched by this table — see
 * [delegation-trial-record-graduation](/docs/agent/platform-decisions.md#delegation-trial-record-graduation),
 * "Reach": mechanical routing binds the mechanical dispatch path only).
 *
 * RAISE-ONLY: every row below can only move a dispatch from `sonnet` up to `opus`, never down — the
 * function returns as soon as one row matches, and the fallback (no row matches) is always `sonnet`.
 * `haiku` is never a table output.
 *
 * @param {{kind?: string, taskType?: string, scopePaths?: string[], tags?: string[]}} [o]
 * @returns {{tier: 'sonnet'|'opus', reason: string}}
 */
// @test-only-export-ok: Shared library exported for the mechanical dispatch spawn path (#3857) and its own test
export function workerTierFor({ kind, taskType, scopePaths, tags } = {}) {
  const k = typeof kind === 'string' ? kind.trim() : '';
  const t = typeof taskType === 'string' ? taskType.trim() : '';
  const paths = Array.isArray(scopePaths) ? scopePaths.map(String) : [];
  const tagList = Array.isArray(tags) ? tags.map(String) : [];

  if (k === 'prepare-decision' || t === 'architectural-decision') {
    return { tier: CLAUDE_TIERS.OPUS, reason: "preparing a decision's forks is judgment" };
  }
  if (paths.some(isStatuteTierPath) || k === 'statute-wording') {
    return { tier: CLAUDE_TIERS.OPUS, reason: 'rewording statute or rule text' };
  }
  if (k === 'security-fix' || tagList.includes('security')) {
    return { tier: CLAUDE_TIERS.OPUS, reason: 'a security-critical fix' };
  }
  if (paths.some((p) => DISPATCH_MACHINERY_PATHS.includes(p)) || k === 'dispatch-machinery') {
    return { tier: CLAUDE_TIERS.OPUS, reason: 'wide-blast-radius dispatch machinery' };
  }
  return { tier: CLAUDE_TIERS.SONNET, reason: "the standard's default" };
}

/**
 * Check if a task scope fits within the proven historical envelope for that taskType.
 * Grounded in the real trial observations in the shared scorecard store (`run-scorecard-store.mjs`).
 * Unit for estimatedSize: net changed lines of code (LOC).
 * @param {string} taskType
 * @param {number} estimatedSize
 * @param {number} filesTouchedCount
 * @returns {boolean}
 */
// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export function isWithinProvenEnvelope(taskType, estimatedSize, filesTouchedCount) {
  const envelope = PROVEN_TASK_ENVELOPES[taskType] || { maxLoc: 200, maxFiles: 3 };
  if (typeof estimatedSize === 'number' && estimatedSize > envelope.maxLoc) return false;
  if (typeof filesTouchedCount === 'number' && filesTouchedCount > envelope.maxFiles) return false;
  return true;
}

/**
 * Check if a task is high-stakes / correctness-critical (#3690).
 * Touching test files alone (`/\.test\.|__tests__/`) is NOT sufficient alone per the brief.
 * A task is high-stakes iff:
 * 1. taskType is 'bugfix' or 'conflict-resolution', AND
 * 2. It touches at least one test file (matching /\.test\.|__tests__|\.spec\./), AND
 * 3. It ALSO touches critical infrastructure/runtime paths:
 *    - `scripts/conveyor/`, `scripts/lib/`, `scripts/operations/` (the conveyor harness and review gate engine), OR
 *    - `blocks/`, `plugs/`, `src/_data/` (core standards contracts and runtime protocols), OR
 *    - touches 3 or more implementation files alongside the test files.
 * @param {{ taskType?: string }} task
 * @param {{ filesTouched?: string[] }} context
 * @returns {boolean}
 */
// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export function isHighStakesTask(task, context) {
  const taskType = task?.taskType;
  if (taskType !== 'bugfix' && taskType !== 'conflict-resolution') return false;
  const files = Array.isArray(context?.filesTouched) ? context.filesTouched : [];
  const touchesTests = files.some((p) => typeof p === 'string' && /(\.test\.|__tests__|\.spec\.)/.test(p));
  if (!touchesTests) return false;

  const CRITICAL_PREFIXES = [
    'scripts/conveyor/',
    'scripts/lib/',
    'scripts/operations/',
    'blocks/',
    'plugs/',
    'src/_data/',
  ];
  const touchesCritical = files.some((p) => {
    if (typeof p !== 'string') return false;
    const clean = p.replace(/^\.?\//, '');
    return CRITICAL_PREFIXES.some((prefix) => clean.startsWith(prefix));
  });
  if (touchesCritical) return true;

  const implFiles = files.filter((p) => typeof p === 'string' && !/(\.test\.|__tests__|\.spec\.)/.test(p));
  return implFiles.length >= 3;
}

/** Check if a scorecard record is clean (explicit landed outcome; fail-closed otherwise). Pure. */
function isCleanRecord(record) {
  if (!record || typeof record !== 'object') return false;
  return record.outcome === 'landed';
}

/**
 * Check if a scorecard record was informative (independent review found a real problem that was
 * then fixed). Pure. Reads ONLY the explicit `informative` field the logging CLI writes — never
 * inferred from `outcome` or `findings` (platform-decisions.md#delegation-trial-record-graduation,
 * rule 4; #3888).
 */
function isInformativeRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const isVerified = record.verifiedBy === 'claude-subagent' || record.verifiedBy === 'independent-claude';
  if (!isVerified) return false;
  return record.informative === true;
}

/**
 * Check if a scorecard record carries a root-cause note in its own recorded field — never inferred
 * from `findings` or any other free-text field (platform-decisions.md#delegation-trial-record-graduation,
 * rule 5; #3889). Pure.
 */
function hasRootCauseNote(record) {
  if (!record || typeof record !== 'object') return false;
  return typeof record.rootCause === 'string' && record.rootCause.trim() !== '';
}

/**
 * Filter and sort scorecards for a specific provider and taskType.
 * Pure and deterministic.
 */
function getSortedRecordsForProviderAndTask(scorecards, providers, taskType) {
  const matching = scorecards.filter((r) =>
    r && typeof r === 'object' &&
    providers.includes(r.provider) &&
    r.taskType === taskType
  );
  return [...matching].sort((a, b) => {
    const tA = typeof a.scoredAt === 'string' ? a.scoredAt : '';
    const tB = typeof b.scoredAt === 'string' ? b.scoredAt : '';
    return tB.localeCompare(tA);
  });
}

/**
 * Evaluate single-provider fitness (Gemini or Codex) according to the 5 brief criteria.
 * @param {string[]} providerNames
 * @param {string} taskType
 * @param {string[]} filesTouched
 * @param {number} estimatedSize
 * @param {Array<object>} scorecards
 * @param {string|undefined} [preferredModel]
 * @returns {{ fit: boolean, fitModel: string|null, reason: string }}
 */
function evaluateProviderFitness(providerNames, taskType, filesTouched, estimatedSize, scorecards, preferredModel) {
  const providerLabel = providerNames[0];

  // Criterion 5: architectural-decision or triage-research always require human/Claude judgment
  if (taskType === 'architectural-decision' || taskType === 'triage-research') {
    return {
      fit: false,
      fitModel: null,
      reason: `Task type '${taskType}' requires deep repo judgment; external models are excluded by policy.`,
    };
  }

  // Criterion 3: statute-tier paths force Claude, never external models
  const touchesStatute = filesTouched.some(isStatuteTierPath);
  if (touchesStatute) {
    return {
      fit: false,
      fitModel: null,
      reason: 'Touched files contain statute-tier paths (docs/agent/); forces Claude.',
    };
  }

  // Criterion 4: estimatedSize and filesTouched count within proven envelope
  if (!isWithinProvenEnvelope(taskType, estimatedSize, filesTouched.length)) {
    return {
      fit: false,
      fitModel: null,
      reason: `Scope (${filesTouched.length} files, ${estimatedSize} LOC) exceeds ${providerLabel}'s proven envelope for '${taskType}'.`,
    };
  }

  // Group candidate trials by model
  const records = getSortedRecordsForProviderAndTask(scorecards, providerNames, taskType);
  const models = preferredModel
    ? [preferredModel]
    : [...new Set(records.map((r) => r.model).filter((m) => typeof m === 'string' && m.trim().length > 0))];

  if (models.length === 0) {
    return {
      fit: false,
      fitModel: null,
      reason: `No recorded trials found for ${providerLabel} on taskType '${taskType}'.`,
    };
  }

  for (const model of models) {
    const modelRecords = records.filter((r) => r.model === model);
    if (modelRecords.length === 0) continue;

    // Criterion 1: at least one clean trial with verifiedBy in ('claude-subagent', 'independent-claude')
    const verifiedCleanTrials = modelRecords.filter((r) =>
      (r.verifiedBy === 'claude-subagent' || r.verifiedBy === 'independent-claude') &&
      isCleanRecord(r)
    );
    if (verifiedCleanTrials.length === 0) {
      continue;
    }

    // Criterion 2: no trial for this triple has an unresolved finding as its MOST RECENT record
    const mostRecentTrial = modelRecords[0];
    if (!isCleanRecord(mostRecentTrial)) {
      continue;
    }

    // All criteria satisfied for this model
    return {
      fit: true,
      fitModel: model,
      reason: `At least one clean verified trial exists for model '${model}', most recent trial is clean, and scope is within proven envelope.`,
    };
  }

  return {
    fit: false,
    fitModel: null,
    reason: `No model under ${providerLabel} has a qualifying clean track record without unresolved findings for '${taskType}'.`,
  };
}

/**
 * @typedef {Object} AuditTrailEntry
 * @property {string} criterion - The name of the criterion evaluated.
 * @property {string} result - The outcome or decision token for this step.
 * @property {string} dataConsulted - Summary of inputs and scorecards consulted.
 * @property {string} reasoning - Detailed rationale for this evaluation step.
 */

/**
 * @typedef {Object} ProviderRecommendation
 * @property {'gemini'|'codex'|'both'|'claude'} recommendation - The selected provider.
 * @property {'haiku'|'sonnet'|'opus'|null} claudeTier - Claude tier when recommendation is 'claude', otherwise null.
 * @property {{ tool: string, cliModel: string, reason: string }|null} [alternateBackend] - Default capacity-relief agy route on the Claude branch only; null for Haiku, forced-native identity, or an unclean latest Antigravity trial for this taskType.
 * @property {AuditTrailEntry[]} auditTrail - Sequence of criteria evaluated in cascade order.
 * @property {string} reasoning - Human-readable summary paragraph explaining the recommendation.
 * @property {{ suggestedProvider: string, suggestedModel: string, category: string, value: number, unit: string, asOf: string, source: string, reason: string }|null} explorationHint - Advisory verified external rating when either provider group's trial history is thin.
 */

/**
 * SELECT DISPATCH PROVIDER (`selectProvider`).
 *
 * Deterministic cascade:
 *   1. Gemini / Antigravity fitness check -> 'gemini'
 *   2. Codex fitness check -> 'codex'
 *   3. Both together (high-stakes correctness or thin history without informative trials) -> 'both'
 *   4. Claude fallback by effort tier ('haiku' | 'sonnet' | 'opus') -> 'claude'
 *
 * PURE: No filesystem or process reads. Deterministic over its arguments.
 *
 * @param {{ description?: string, taskType: 'bugfix'|'doc-fix'|'conflict-resolution'|'triage-research'|'build-new-feature'|'architectural-decision' }} task
 * @param {{ filesTouched?: string[], estimatedSize?: number, scorecards?: Array<object>|{records: Array<object>}, acceptanceTestable?: boolean, model?: string, capabilityRatings?: Array<object>|{version: number, entries: Array<object>, dropped: Array<object>}, capabilityCategory?: string }} context - All data is caller-loaded; capabilityCategory overrides the task's default exploration category. Scorecards also inform the default agy alternate's taskType-specific reliability veto.
 * @returns {ProviderRecommendation} Includes optional alternateBackend on the Claude branch only (null when not applicable).
 */
// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export function selectProvider(task, context) {
  const taskType = task?.taskType || 'bugfix';
  const description = typeof task?.description === 'string' ? task.description : '';
  const filesTouched = Array.isArray(context?.filesTouched) ? context.filesTouched : [];
  const rawSize = context?.estimatedSize;
  const estimatedSize = typeof rawSize === 'number' && Number.isFinite(rawSize)
    ? rawSize
    : (filesTouched.length > 0 ? filesTouched.length * 50 : 0);
  const rawScorecards = context?.scorecards;
  const scorecards = Array.isArray(rawScorecards)
    ? rawScorecards
    : (Array.isArray(rawScorecards?.records) ? rawScorecards.records : []);
  const preferredModel = typeof context?.model === 'string' ? context.model : undefined;
  const acceptanceTestable = context?.acceptanceTestable;
  const kind = typeof context?.kind === 'string' ? context.kind : '';
  const tags = Array.isArray(context?.tags) ? context.tags : [];

  const auditTrail = [];
  const statuteFiles = filesTouched.filter(isStatuteTierPath);
  const hasStatuteFile = statuteFiles.length > 0;

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: Gemini / Antigravity Fitness Check
  // ──────────────────────────────────────────────────────────────────────────
  const geminiCheck = evaluateProviderFitness(
    ['gemini', 'antigravity'],
    taskType,
    filesTouched,
    estimatedSize,
    scorecards,
    preferredModel
  );
  auditTrail.push({
    criterion: 'gemini-fitness',
    result: geminiCheck.fit ? 'fit' : 'unfit',
    dataConsulted: `providers=['gemini','antigravity'], taskType='${taskType}', files=${filesTouched.length}, size=${estimatedSize} LOC, statute=${hasStatuteFile}`,
    reasoning: geminiCheck.reason,
  });

  if (geminiCheck.fit) {
    const reasoning = `Gemini is fit for task '${taskType}' (${description || 'unnamed'}): model '${geminiCheck.fitModel}' has a clean verified track record without unresolved findings, scope (${filesTouched.length} files, ${estimatedSize} LOC) is within proven envelope, and no statute-tier paths are touched.`;
    return {
      recommendation: RECOMMENDATIONS.GEMINI,
      claudeTier: null,
      auditTrail,
      reasoning,
      explorationHint: getExplorationHint(taskType, scorecards, context),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: Codex Fitness Check
  // ──────────────────────────────────────────────────────────────────────────
  const codexCheck = evaluateProviderFitness(
    ['codex'],
    taskType,
    filesTouched,
    estimatedSize,
    scorecards,
    preferredModel
  );
  auditTrail.push({
    criterion: 'codex-fitness',
    result: codexCheck.fit ? 'fit' : 'unfit',
    dataConsulted: `provider='codex', taskType='${taskType}', files=${filesTouched.length}, size=${estimatedSize} LOC, statute=${hasStatuteFile}`,
    reasoning: codexCheck.reason,
  });

  if (codexCheck.fit) {
    const reasoning = `Codex is fit for task '${taskType}' (${description || 'unnamed'}): model '${codexCheck.fitModel}' has a clean verified track record without unresolved findings, scope (${filesTouched.length} files, ${estimatedSize} LOC) is within proven envelope, and no statute-tier paths are touched.`;
    return {
      recommendation: RECOMMENDATIONS.CODEX,
      claudeTier: null,
      auditTrail,
      reasoning,
      explorationHint: getExplorationHint(taskType, scorecards, context),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: Both Together
  // ──────────────────────────────────────────────────────────────────────────
  let bothFit = false;
  let bothReason = '';

  if (hasStatuteFile) {
    bothFit = false;
    bothReason = 'Statute-tier paths touched; policy requires Claude Opus, not external dual dispatch.';
  } else if (taskType === 'architectural-decision' || taskType === 'triage-research') {
    bothFit = false;
    bothReason = `Task type '${taskType}' requires deep architectural or triage judgment; requires Claude.`;
  } else {
    // Condition 3A: High-stakes / correctness-critical
    const isHighStakes = isHighStakesTask(task, context);
    if (isHighStakes) {
      bothFit = true;
      bothReason = `Task '${taskType}' is high-stakes/correctness-critical touching test files alongside critical infrastructure; dispatching both Gemini and Codex mitigates single-model regression risk.`;
    } else {
      // Condition 3B: Thin history on record for this taskType
      const candidateRecords = scorecards.filter((r) =>
        r && typeof r === 'object' &&
        r.taskType === taskType &&
        ['gemini', 'antigravity', 'codex'].includes(r.provider)
      );
      const hasAnyGeminiInformative = scorecards.some((r) =>
        r && typeof r === 'object' &&
        ['gemini', 'antigravity'].includes(r.provider) &&
        r.taskType === taskType &&
        isInformativeRecord(r)
      );
      const hasAnyCodexInformative = scorecards.some((r) =>
        r && typeof r === 'object' &&
        r.provider === 'codex' &&
        r.taskType === taskType &&
        isInformativeRecord(r)
      );

      // Thin history applies when trials exist on record but neither has earned an informative trial,
      // or when dispatching both is warranted to build empirical data rather than picking blind.
      if (candidateRecords.length > 0 && !hasAnyGeminiInformative && !hasAnyCodexInformative) {
        bothFit = true;
        bothReason = `Trial history for '${taskType}' is too thin to trust either model alone (neither Gemini nor Codex has an informative trial with confirmed findings on record); dispatching both to compare rather than picking blind.`;
      }
    }
  }

  auditTrail.push({
    criterion: 'both-together',
    result: bothFit ? 'fit' : 'skipped',
    dataConsulted: `highStakes=${isHighStakesTask(task, context)}, taskType='${taskType}', statute=${hasStatuteFile}`,
    reasoning: bothFit ? bothReason : (bothReason || 'Neither high-stakes criteria nor thin-history dual dispatch condition was met.'),
  });

  if (bothFit) {
    const reasoning = `Both Gemini and Codex are recommended for task '${taskType}' (${description || 'unnamed'}): ${bothReason}`;
    return {
      recommendation: RECOMMENDATIONS.BOTH,
      claudeTier: null,
      auditTrail,
      reasoning,
      explorationHint: getExplorationHint(taskType, scorecards, context),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Step 4: Claude Fallback by Effort Tier — the ONE checked-in table (#3857), never inline criteria.
  // ──────────────────────────────────────────────────────────────────────────
  const tierDecision = workerTierFor({ kind, taskType, scopePaths: filesTouched, tags });
  const claudeTier = tierDecision.tier;
  const claudeReason = tierDecision.reason;

  auditTrail.push({
    criterion: 'claude-tier',
    result: claudeTier,
    dataConsulted: `taskType='${taskType}', files=${filesTouched.length}, size=${estimatedSize} LOC, statute=${hasStatuteFile}, testable=${acceptanceTestable !== false}`,
    reasoning: claudeReason,
  });

  const cliModel = AGY_CLAUDE_MODEL_BY_TIER[claudeTier];
  const forcedNativeIdentity = hasStatuteFile || taskType === 'architectural-decision' || taskType === 'triage-research';
  const latestAntigravityTrial = getSortedRecordsForProviderAndTask(scorecards, ['antigravity'], taskType)[0];
  const agyAlternateResult = !cliModel ? 'not-applicable'
    : forcedNativeIdentity ? 'forced-native'
      : latestAntigravityTrial && !isCleanRecord(latestAntigravityTrial) ? 'recent-failure'
        : 'offered';
  const alternateBackend = agyAlternateResult === 'offered' ? {
    tool: 'scripts/gemini-direct-task.mjs',
    cliModel,
    reason: `Default capacity-relief recommendation: run this ${claudeTier}-tier dispatch via \`node scripts/gemini-direct-task.mjs --model=${cliModel}\`, using Antigravity's separate quota for the same model family.`,
  } : null;

  auditTrail.push({
    criterion: 'agy-alternate-backend',
    result: agyAlternateResult,
    dataConsulted: `claudeTier='${claudeTier}', taskType='${taskType}', statute=${hasStatuteFile}, latestAntigravityTrial=${latestAntigravityTrial ? (latestAntigravityTrial.scoredAt || 'unscored') : 'none'}`,
    reasoning: agyAlternateResult === 'not-applicable'
      ? 'Haiku has no agy-hosted equivalent, so no alternate backend applies.'
      : agyAlternateResult === 'forced-native'
        ? 'Statute-tier paths, architectural decisions and triage research require native Claude session identity and tool access.'
        : agyAlternateResult === 'recent-failure'
          ? `The most recent Antigravity trial for taskType '${taskType}' is not clean; native Claude is required until a later clean trial supersedes it.`
          : `Offered agy model '${cliModel}' by default for capacity relief on the same Claude tier.`,
  });

  const reasoning = `Claude (${claudeTier}) is recommended for task '${taskType}' (${description || 'unnamed'}): external models (Gemini/Codex) were not fit or lacked clean track record. Effort tier '${claudeTier}' assigned because: ${claudeReason}`;

  return {
    recommendation: RECOMMENDATIONS.CLAUDE,
    claudeTier,
    alternateBackend,
    auditTrail,
    reasoning,
    explorationHint: getExplorationHint(taskType, scorecards, context),
  };
}

/**
 * @typedef {Object} SupervisionAuditTrail
 * @property {string} criterion
 * @property {string} result
 * @property {string} dataConsulted
 * @property {string} reasoning
 */

/**
 * @typedef {Object} SupervisionRecommendation
 * @property {'full'|'spot-check'} level
 * @property {SupervisionAuditTrail[]} auditTrail
 * @property {string} reasoning
 */

/**
 * SELECT SUPERVISION LEVEL (`selectSupervisionLevel`).
 *
 * Implements the progressive backdown plan from backlog item #3690:
 *   - Unit of trust: exact `{provider, model, subjectClass, taskType}` tuple. `taskType` is whatever the
 *     caller's subject is (a work task type, a role kind, or a review lens); `subjectClass` keeps those
 *     subject classes from mixing evidence even when the subject strings coincide (#3801 Fork 3).
 *   - Counts TRAILING consecutive clean streak (most recent first; verified by
 *     'claude-subagent' or 'independent-claude'; 'other'-verified records are skipped).
 *   - Clean record: outcome === 'landed' (fail-closed; missing/rejected/reworked all count unclean).
 *   - Informative trial: at least one verified trial EVER recorded had outcome 'rejected' or
 *     'reworked' with confirmed findings (a 'landed' record's findings text alone never counts).
 *   - Hard veto: any unclean/unresolved record as the MOST RECENT verified trial immediately
 *     forces 'full' supervision, resetting the streak.
 *   - Post-miss bar (platform-decisions.md#delegation-trial-record-graduation, rule 5; #3889): once ANY
 *     verified record for the triple was ever unclean (a confirmed miss, anywhere in its recorded
 *     history — not only as the current most-recent trial), post-miss trials count toward restoration
 *     only once a `rootCause` note is on record in its own field for that triple (never inferred from a
 *     later row's `findings`); the clean-streak bar to clear then becomes `minCleanStreak + k`, strictly
 *     higher than the cold-start bar. A cold-start triple with no miss ever recorded is unaffected and
 *     still graduates at exactly `minCleanStreak`.
 *   - Returns 'spot-check' iff cleanStreak >= the applicable bar (cold-start `minCleanStreak`, or
 *     post-miss `minCleanStreak + k` once a rootCause is on record) AND (requireInformativeTrial === false
 *     OR hasInformativeTrial === true).
 *
 * PURE: No filesystem or process reads. Deterministic over its arguments.
 *
 * @param {string} provider
 * @param {string} model
 * @param {string} taskType - the caller's subject: a work task type, a role kind, or a review lens.
 * @param {Array<object>} scorecards
 * @param {{ minCleanStreak?: number, requireInformativeTrial?: boolean, k?: number }} [backdownThresholds={}]
 * @param {string} [subjectClass='work-agent'] - which subject class `taskType` belongs to; only records with
 *   the same `subjectClass` count toward this triple (#3801 Fork 3).
 * @returns {SupervisionRecommendation}
 */
// @test-only-export-ok: Shared library exported for interactive Claude sessions and conveyor runners
export function selectSupervisionLevel(provider, model, taskType, scorecards, backdownThresholds = {}, subjectClass = 'work-agent') {
  const minCleanStreak = typeof backdownThresholds?.minCleanStreak === 'number'
    ? backdownThresholds.minCleanStreak
    : DEFAULT_BACKDOWN_THRESHOLDS.minCleanStreak;
  const requireInformativeTrial = typeof backdownThresholds?.requireInformativeTrial === 'boolean'
    ? backdownThresholds.requireInformativeTrial
    : DEFAULT_BACKDOWN_THRESHOLDS.requireInformativeTrial;
  const k = typeof backdownThresholds?.k === 'number'
    ? backdownThresholds.k
    : DEFAULT_BACKDOWN_THRESHOLDS.k;

  const records = Array.isArray(scorecards)
    ? scorecards
    : (Array.isArray(scorecards?.records) ? scorecards.records : []);

  // Filter to exact {provider, model, subjectClass, taskType} tuple — subjectClass keeps a review-lens or
  // role-kind subject from ever counting toward a work triple's streak, or vice versa (#3801 Fork 3).
  const matching = records.filter((r) =>
    r && typeof r === 'object' &&
    r.provider === provider &&
    r.model === model &&
    r.taskType === taskType &&
    r.subjectClass === subjectClass
  );

  // Walk in scoredAt order, most recent first (deterministic ISO-8601 string sort)
  const sorted = [...matching].sort((a, b) => {
    const tA = typeof a.scoredAt === 'string' ? a.scoredAt : '';
    const tB = typeof b.scoredAt === 'string' ? b.scoredAt : '';
    return tB.localeCompare(tA);
  });

  const consulted = sorted.map((r) => ({
    handle: r.handle || (r.pr ? `PR #${r.pr}` : (r.item ? `#${r.item}` : (r.taskDescription || 'trial'))),
    scoredAt: r.scoredAt || 'unscored',
    outcome: r.outcome,
    verifiedBy: r.verifiedBy,
    findings: r.findings,
  }));

  // Find most recent verified trial ('claude-subagent' or 'independent-claude')
  const mostRecentVerified = sorted.find((r) =>
    r.verifiedBy === 'claude-subagent' || r.verifiedBy === 'independent-claude'
  );
  const mostRecentHasFinding = mostRecentVerified ? !isCleanRecord(mostRecentVerified) : false;

  // Compute trailing clean streak:
  // Walk records from newest to oldest. Skip 'other'-verified records.
  // Count consecutive clean records until the first finding or rejection.
  let cleanStreak = 0;
  for (const r of sorted) {
    if (r.verifiedBy !== 'claude-subagent' && r.verifiedBy !== 'independent-claude') {
      // 'other'-verified record: does not count toward or break the streak
      continue;
    }
    if (isCleanRecord(r)) {
      cleanStreak++;
    } else {
      // Confirmed finding or rejection caps the trailing streak
      break;
    }
  }

  // Check if at least one record EVER for this triple was informative (confirmed finding from independent review)
  const hasInformativeTrial = sorted.some(isInformativeRecord);

  // Post-miss bar (platform-decisions.md#delegation-trial-record-graduation, rule 5; #3889).
  // A confirmed miss is any verified record for this triple that was NOT clean, anywhere in its recorded
  // history — not only as the current most-recent trial (that narrower case is the hard veto above; this
  // is broader, since a triple can have re-accumulated a clean trailing streak since an earlier miss).
  // Fail-closed, matching the hard veto's own `!isCleanRecord` test: a missing/undefined outcome counts
  // as a miss here too.
  const hasConfirmedMiss = sorted.some((r) =>
    (r.verifiedBy === 'claude-subagent' || r.verifiedBy === 'independent-claude') && !isCleanRecord(r)
  );
  // A root-cause note in its own recorded field — never inferred from `findings` or any other row.
  const hasRootCause = sorted.some(hasRootCauseNote);
  // Once a miss is on record, the bar to clear is strictly higher than the cold-start bar.
  const requiredCleanStreak = hasConfirmedMiss ? minCleanStreak + k : minCleanStreak;

  // Decision logic
  let level;
  let summaryReason;

  if (mostRecentHasFinding) {
    level = SUPERVISION_LEVELS.FULL;
    summaryReason = `Calibration-miss hard veto: the most recent verified trial for {"${provider}", "${model}", "${taskType}"} (${mostRecentVerified.scoredAt}) had an unresolved finding. Streak counter reset to 0.`;
  } else if (hasConfirmedMiss && !hasRootCause) {
    level = SUPERVISION_LEVELS.FULL;
    summaryReason = `A confirmed miss is on record for {"${provider}", "${model}", "${taskType}"}, but no root-cause note has been recorded in its own field — no number of post-miss clean trials counts toward restoration until one is.`;
  } else if (cleanStreak < requiredCleanStreak) {
    level = SUPERVISION_LEVELS.FULL;
    summaryReason = hasConfirmedMiss
      ? `Trailing clean streak of ${cleanStreak} is below the post-miss threshold ${requiredCleanStreak} (minCleanStreak ${minCleanStreak} + k ${k}) for {"${provider}", "${model}", "${taskType}"}.`
      : `Trailing clean streak of ${cleanStreak} is below required threshold ${requiredCleanStreak} for {"${provider}", "${model}", "${taskType}"}.`;
  } else if (requireInformativeTrial && !hasInformativeTrial) {
    level = SUPERVISION_LEVELS.FULL;
    summaryReason = `Trailing clean streak of ${cleanStreak} reaches ${requiredCleanStreak}, but no informative trial with confirmed findings has ever been recorded for {"${provider}", "${model}", "${taskType}"}.`;
  } else {
    level = SUPERVISION_LEVELS.SPOT_CHECK;
    summaryReason = `Spot-check supervision approved: trailing clean streak of ${cleanStreak} meets threshold ${requiredCleanStreak}${hasConfirmedMiss ? ' (post-miss bar, root-cause note on record)' : ''}, informative trial requirement is satisfied, and the most recent trial was clean.`;
  }

  const recordsSummary = consulted.length > 0
    ? consulted.map((c) => `${c.handle}@${c.scoredAt}`).join(', ')
    : 'none';

  const auditTrail = [
    {
      criterion: 'most-recent-trial-veto',
      result: mostRecentHasFinding ? 'veto-fired' : 'clean',
      dataConsulted: mostRecentVerified ? `${mostRecentVerified.handle || mostRecentVerified.pr || mostRecentVerified.taskDescription || 'trial'} (${mostRecentVerified.scoredAt})` : 'none',
      reasoning: mostRecentHasFinding
        ? 'Most recent verified trial had a finding; hard veto resets streak to 0.'
        : 'Most recent verified trial has no unresolved findings.',
    },
    {
      // States which bar applied (cold-start vs post-miss) and why, per rule 5 (#3889).
      criterion: 'post-miss-bar-selection',
      result: hasConfirmedMiss ? 'post-miss' : 'cold-start',
      dataConsulted: `hasConfirmedMiss=${hasConfirmedMiss}, requiredCleanStreak=${requiredCleanStreak} (minCleanStreak=${minCleanStreak}${hasConfirmedMiss ? ` + k=${k}` : ''})`,
      reasoning: hasConfirmedMiss
        ? `A confirmed miss is on record for {"${provider}", "${model}", "${taskType}"}; the post-miss bar (minCleanStreak ${minCleanStreak} + k ${k} = ${requiredCleanStreak}) applies instead of the cold-start bar.`
        : `No confirmed miss is on record for {"${provider}", "${model}", "${taskType}"}; the cold-start bar (minCleanStreak = ${minCleanStreak}) applies.`,
    },
    {
      criterion: 'post-miss-root-cause-requirement',
      result: (!hasConfirmedMiss || hasRootCause) ? 'pass' : 'fail',
      dataConsulted: `hasConfirmedMiss=${hasConfirmedMiss}, hasRootCause=${hasRootCause}`,
      reasoning: !hasConfirmedMiss
        ? 'No confirmed miss is on record for this triple, so no root-cause note is required.'
        : (hasRootCause
          ? 'A root-cause note is on record in its own field for this triple.'
          : 'No root-cause note has been recorded in its own field for this triple — findings text alone never counts.'),
    },
    {
      criterion: 'trailing-clean-streak',
      result: cleanStreak >= requiredCleanStreak ? 'pass' : 'fail',
      dataConsulted: `streak=${cleanStreak}, threshold=${requiredCleanStreak}, consulted=[${recordsSummary}]`,
      reasoning: `Computed trailing consecutive clean streak is ${cleanStreak} (required: ${requiredCleanStreak}).`,
    },
    {
      criterion: 'informative-trial-requirement',
      result: (!requireInformativeTrial || hasInformativeTrial) ? 'pass' : 'fail',
      dataConsulted: `hasInformativeTrial=${hasInformativeTrial}, required=${requireInformativeTrial}`,
      reasoning: hasInformativeTrial
        ? 'At least one verified trial with confirmed findings exists in historical records.'
        : 'No verified trial with confirmed findings on record for this triple.',
    },
  ];

  return {
    level,
    auditTrail,
    reasoning: summaryReason,
    // Structured predicates alongside the audit trail's prose, so a caller (graduation-progress-report,
    // #xtw2rap) never re-derives them from parsing `auditTrail[].dataConsulted` text. Rule 1 of
    // #delegation-trial-record-graduation: every reader of this record uses the SAME predicates this
    // function already computed — never a second, parallel implementation.
    cleanStreak,
    // The actual bar `cleanStreak` was just checked against (cold-start `minCleanStreak`, or the higher
    // post-miss `minCleanStreak + k` once a confirmed miss is on record; #3889 rule 5) — a caller that needs
    // to know "how far from graduating" (e.g. graduation-progress-report's `owed` text) reads this field
    // instead of re-deriving hasConfirmedMiss/k itself (rule 1, same reasoning as above).
    requiredCleanStreak,
    hasInformativeTrial,
    mostRecentVetoed: mostRecentHasFinding,
  };
}

// ── REVIEW-SEAT ROUTING (#4194) — which non-Claude provider backs one ADDED review seat ─────────────────
//
// An added review seat (an ADVISORY lens, or the one extra juror seat) sits BESIDE Claude's mandatory seats and
// can only ADD findings — its failure or silence never blocks or accepts a PR (`review-extra-seats.mjs`). So,
// unlike `selectProvider`'s work cascade, a seat needs NO graduated track record before it may run: a miss is
// still covered by Claude's mandatory seats. What the record DOES decide is WHICH provider backs each seat:
//   1. a provider the caller reports unavailable (CLI missing, quota exhausted, daily cap) is never picked;
//   2. a provider whose MOST RECENT seat row for this lens failed (error / timeout / unparseable / quota) is
//      ranked after one whose last row was clean — the same "most recent trial must be clean" test
//      `evaluateProviderFitness` applies (criterion 2), fail-closed on an unknown status;
//   3. then the provider carrying less of THIS review's planned load (spread seats across providers);
//   4. then the provider with FEWER recorded rows for this lens (explore evenly, so both earn a record);
//   5. then a stable per-lens tie-break (never a clock, never random).
// The rows read are the `review-seat` rows `review-extra-seats.mjs` appends to the shared scorecard store, keyed
// by `taskType: reviewSeatTaskType(lens)` — a prefixed subject that can never collide with a work taskType, so a
// review seat's history never counts toward a work triple's graduation streak (#3801 Fork 3).

/** The non-Claude providers an added review seat can be routed to, in tie-break order. */
export const REVIEW_SEAT_PROVIDERS = Object.freeze(['codex', 'gemini']);

/** The `dispatchKind` every added-review-seat evidence row carries. */
export const REVIEW_SEAT_DISPATCH_KIND = 'review-seat';

/** The prefixed `taskType` subject of one lens's seat rows — never a work taskType. PURE. */
export function reviewSeatTaskType(lens) {
  return `review-lens:${String(lens ?? '').trim()}`;
}

function stableLensHash(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) % 1_000_003;
  return h;
}

/**
 * SELECT THE PROVIDER FOR ONE ADDED REVIEW SEAT (#4194). PURE and deterministic over its arguments.
 * @param {object} o
 * @param {string} o.lens - the seat's lens (an advisory lens, or the extra juror's lens).
 * @param {string[]} [o.available] - providers the caller found usable right now (subset of REVIEW_SEAT_PROVIDERS).
 * @param {Array<object>|{records:Array<object>}} [o.scorecards] - the shared store's rows (caller-loaded).
 * @param {Record<string, number>} [o.plannedLoad] - seats already assigned per provider in THIS review.
 * @returns {{provider: (string|null), auditTrail: Array<{criterion:string,result:string,reasoning:string}>, reasoning: string}}
 */
export function selectReviewSeatProvider({ lens, available = REVIEW_SEAT_PROVIDERS, scorecards = [], plannedLoad = {} } = {}) {
  const records = Array.isArray(scorecards) ? scorecards : (Array.isArray(scorecards?.records) ? scorecards.records : []);
  const taskType = reviewSeatTaskType(lens);
  const auditTrail = [];
  const candidates = REVIEW_SEAT_PROVIDERS.filter((p) => Array.isArray(available) && available.includes(p));
  auditTrail.push({
    criterion: 'available',
    result: candidates.join(',') || 'none',
    reasoning: candidates.length ? `usable now: ${candidates.join(', ')}` : 'no non-Claude provider is usable right now',
  });
  if (!candidates.length) {
    return { provider: null, auditTrail, reasoning: `no provider for the "${lens}" seat: none available` };
  }
  const rowsFor = (p) => records
    .filter((r) => r && r.dispatchKind === REVIEW_SEAT_DISPATCH_KIND && r.provider === p && r.taskType === taskType)
    .sort((a, b) => String(b.scoredAt ?? '').localeCompare(String(a.scoredAt ?? '')));
  const base = stableLensHash(taskType);
  const ranked = candidates.map((p, i) => {
    const rows = rowsFor(p);
    return {
      provider: p,
      recentFailure: rows.length > 0 && rows[0].status !== 'ok' ? 1 : 0,
      load: Number(plannedLoad?.[p]) || 0,
      history: rows.length,
      tie: (base + i) % candidates.length,
    };
  }).sort((a, b) => a.recentFailure - b.recentFailure || a.load - b.load || a.history - b.history || a.tie - b.tie);
  for (const r of ranked) {
    auditTrail.push({
      criterion: `rank:${r.provider}`,
      result: `recentFailure=${r.recentFailure} load=${r.load} history=${r.history} tie=${r.tie}`,
      reasoning: r.recentFailure ? 'most recent seat row for this lens was not clean — ranked after a clean one' : 'last seat row clean (or none yet)',
    });
  }
  const pick = ranked[0].provider;
  return {
    provider: pick,
    auditTrail,
    reasoning: `"${lens}" seat → ${pick} (recent-failure, then planned load, then fewest recorded ${taskType} rows, then a stable tie-break)`,
  };
}
