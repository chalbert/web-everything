/**
 * @file we:scripts/operations/graduation-progress-report.mjs
 * @description Read-only graduation progress for session delegation (#3690, #xtw2rap). Rebuilt to call the
 * router (`selectSupervisionLevel`, we:scripts/lib/provider-routing.mjs) instead of re-deriving its
 * predicates: the prior version counted any non-null `findings` as a problem, which disagreed with the
 * router (rule 1 of `#delegation-trial-record-graduation` binds every reader of the record to the same
 * predicates — never a parallel copy). Returns the schema-2 contract `plateau:docs/graduation-page.md` →
 * "Data contract" reads: per-agent triples with `state`, owed evidence, promotion and criteria status.
 *
 * The pure declaration takes injected data (`records`, `promotions`, `probation`, `asOfIso`) and does no IO;
 * the io file (graduation-progress-report-io.mjs) reads the scorecard store plus the two optional registry
 * files, classifying each source `ok` | `absent` | `invalid` before this module ever sees it.
 *
 * `selectSupervisionLevel` and its default thresholds are INJECTED (a constructor parameter), never
 * statically imported here, even though `provider-routing.mjs` is itself pure. That module's `selectProvider`
 * transitively imports `model-capability-ratings.mjs` for an unrelated exploration-hint helper, which pulls
 * in `node:fs`/`node:path`/`node:url` — reachable, never called from this path, but still visible to the
 * static import-graph scanner `#3036`'s read-only property is checked with (every operation registered as
 * read-only must declare in a module whose own import graph "reaches nothing that can act"). Injecting the
 * function (the same escape the scanner's own header documents: "a module that imports nothing can still be
 * HANDED a writer at call time") keeps rule 1's real predicates without smuggling that transitive dependency
 * into this module's graph. `run.mjs` — not a graph-checked declaring module — does the real import.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';

export const GRADUATION_PROGRESS_REPORT_OP = 'graduation-progress-report';
export const REPORT_SCHEMA = 2;

const COUNTED_VERIFIERS = new Set(['claude-subagent', 'independent-claude']);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Group raw delegation trial rows by exact `{provider, model, taskType}` triple. Trust never crosses one. */
function groupDelegationTrials(rows) {
  const groups = new Map();
  for (const row of rows) {
    const { provider, model, taskType } = row;
    const key = JSON.stringify([provider, model, taskType]);
    if (!groups.has(key)) groups.set(key, { provider, model, taskType, rows: [] });
    groups.get(key).rows.push(row);
  }
  return groups;
}

/** One trial's page-facing shape, oldest → newest, sorted by `scoredAt` (store order preserved on ties). */
function buildTrialList(rows) {
  return [...rows]
    .sort((a, b) => compare(a.scoredAt, b.scoredAt))
    .map((row) => {
      const counted = COUNTED_VERIFIERS.has(row.verifiedBy);
      const informative = counted
        && (row.outcome === 'rejected' || row.outcome === 'reworked')
        && row.findings !== undefined && row.findings !== null && String(row.findings).trim() !== '';
      return {
        scoredAt: row.scoredAt,
        outcome: row.outcome ?? null,
        verifiedBy: row.verifiedBy ?? null,
        pr: row.pr ?? null,
        item: row.item ?? null,
        counted,
        informative,
      };
    });
}

/** Plain-sentence "what's still owed" text, one per `state` — never invents a threshold value. */
function owedFor(state, { minCleanStreak, cleanStreak }) {
  switch (state) {
    case 'unverified':
      return 'No trial here was independently checked, so none counts yet. Next: one checked trial.';
    case 'vetoed':
      return 'The latest checked trial had a problem. Next: a root-cause note, then a fresh clean streak.';
    case 'accruing': {
      const remaining = Math.max(0, minCleanStreak - cleanStreak);
      return `${remaining} more clean checked trial${remaining === 1 ? '' : 's'} in a row.`;
    }
    case 'needs-positive-control':
      return 'One trial where review caught a real problem that was then fixed (proves the check works).';
    case 'awaiting-promotion':
      return 'Nothing from the agent. Lighter checking needs your ratified promotion.';
    case 'promoted':
      return 'Nothing owed. One miss demotes it at once.';
    /* c8 ignore next 2 -- state is always one of the six above; kept fail-closed rather than throwing. */
    default:
      return '';
  }
}

/** The one promotion row naming this exact triple, or `null`. Only consulted when the source is `ok`. */
function findPromotion(promotionEntries, provider, model, taskType) {
  const hit = promotionEntries.find((entry) =>
    entry.provider === provider && entry.model === model && entry.taskType === taskType);
  return hit ? { ratifiedBy: hit.ratifiedBy, ratifiedOn: hit.ratifiedOn, anchor: hit.anchor } : null;
}

/**
 * Build one triple's report row. `evidenceLevel`, `cleanStreak`, `hasInformative` and `mostRecentVetoed` all
 * come from `selectSupervisionLevel`'s own result — never a second copy of its predicates (rule 1).
 */
function buildTriple(group, { thresholds, promotionsOk, promotionEntries, selectSupervisionLevel }) {
  const { provider, model, taskType, rows } = group;
  const trialList = buildTrialList(rows);
  const countedTrials = trialList.filter((t) => t.counted).length;
  const lastTrialAt = trialList.length ? trialList[trialList.length - 1].scoredAt : null;

  const routed = selectSupervisionLevel(provider, model, taskType, rows, thresholds);
  const evidenceLevel = routed.level;
  const cleanStreak = routed.cleanStreak;
  const hasInformative = routed.hasInformativeTrial;
  const mostRecentVetoed = routed.mostRecentVetoed;
  // The bar `cleanStreak` is actually checked against: cold-start `minCleanStreak`, or the higher post-miss
  // `minCleanStreak + k` once a confirmed miss is on record (#3897 ports #3889 rule 5). Read from the
  // router's own structured field — never re-derived here (rule 1: no second copy of its predicates).
  const requiredCleanStreak = typeof routed.requiredCleanStreak === 'number'
    ? routed.requiredCleanStreak
    : thresholds.minCleanStreak;

  const promotion = promotionsOk ? findPromotion(promotionEntries, provider, model, taskType) : null;
  const promoted = promotion !== null && evidenceLevel === 'spot-check';
  const effectiveLevel = promoted ? 'spot-check' : 'full';

  // First match wins (plateau:docs/graduation-page.md → "States and the one live-action rule").
  let state;
  if (countedTrials === 0) state = 'unverified';
  else if (mostRecentVetoed) state = 'vetoed';
  else if (cleanStreak < requiredCleanStreak) state = 'accruing';
  else if (thresholds.requireInformativeTrial && !hasInformative) state = 'needs-positive-control';
  else state = promoted ? 'promoted' : 'awaiting-promotion';

  return {
    taskType,
    trials: rows.length,
    countedTrials,
    cleanStreak,
    hasInformative,
    mostRecentVetoed,
    evidenceLevel,
    promotion,
    effectiveLevel,
    state,
    owed: owedFor(state, { minCleanStreak: requiredCleanStreak, cleanStreak }),
    lastTrialAt,
    trialList,
  };
}

/**
 * "The bar" panel rows — every rule of the ratified ruling with its REAL status, never a hard-coded claim.
 * Rules 4, 5 and 6 are detected from data (own field present / `k` configured / promotions source `ok`);
 * the rest are stated with their tracking card, per the card's own instruction. Each `detail` is derived
 * from the SAME source state as its `state` tag, so a built rule 6 can never read "In force" over text that
 * says no promotion exists (the mock-review finding this guards against).
 */
function buildCriteria({ thresholds, promotionsOk, anyRowHasInformativeField }) {
  const rule5Built = typeof thresholds.postMissK === 'number';
  return [
    {
      rule: 3,
      label: 'Clean streak length N',
      state: 'config-default',
      detail: `N = ${thresholds.minCleanStreak}. A config default, changed by an ordinary finding against real data — not a ratified number.`,
      ref: null,
    },
    {
      rule: 4,
      label: 'A trial is "informative" only by its own recorded field',
      state: anyRowHasInformativeField ? 'built' : 'not-on-main',
      detail: anyRowHasInformativeField
        ? 'Built: at least one recorded trial carries its own `informative` field.'
        : 'Built on the prototype branch. On main the router still infers it from the outcome.',
      ref: '3888',
    },
    {
      rule: 5,
      label: 'After a miss: root-cause note, then a higher bar (N + k)',
      state: rule5Built ? 'built' : 'not-on-main',
      detail: rule5Built
        ? `Built: the post-miss bar is N + k = ${thresholds.minCleanStreak + thresholds.postMissK}.`
        : 'k is not set on main.',
      ref: '3889',
    },
    {
      rule: 6,
      label: 'Promotion only by your ratified act',
      state: promotionsOk ? 'built' : 'not-built',
      detail: promotionsOk
        ? 'A ratified promotion record exists; a named triple may show spot-check.'
        : 'No promotion record exists yet, so every task type stays at Full.',
      ref: '3784',
    },
    {
      rule: 7,
      label: 'Spot-check keeps a shallower independent look',
      state: 'not-on-main',
      detail: 'Built on the prototype branch.',
      ref: '3887',
    },
    {
      rule: null,
      label: 'May family or benchmark data count toward the bar?',
      state: 'open-decision',
      detail: 'Prepared; recommendation is no.',
      ref: '3734',
    },
  ];
}

/**
 * Pure report envelope (schema 2); the timestamp and every source are supplied by the reader, never sampled
 * here. `selectSupervisionLevel` and `backdownThresholds` are INJECTED (never imported by this module) — see
 * the file header for why: it keeps this declaration's own import graph reaching nothing that can act.
 */
export function buildGraduationProgressReport({
  records, asOfIso, promotions, probation, selectSupervisionLevel, backdownThresholds,
}) {
  if (typeof selectSupervisionLevel !== 'function') {
    throw new TypeError('graduation-progress-report: needs a `selectSupervisionLevel` function (injected, never imported)');
  }
  const recordsIsArray = Array.isArray(records);
  const recordsArray = recordsIsArray ? records : [];
  const delegationRows = recordsArray.filter((row) => row && row.dispatchKind === 'session-delegation');

  const promotionsSource = promotions?.source ?? 'absent';
  const promotionsOk = promotionsSource === 'ok';
  const promotionEntries = promotionsOk && Array.isArray(promotions.entries) ? promotions.entries : [];

  const probationSource = probation?.source ?? 'absent';
  const probationOk = probationSource === 'ok';
  const probationEntries = probationOk && Array.isArray(probation.entries) ? probation.entries : [];

  const thresholds = {
    minCleanStreak: backdownThresholds.minCleanStreak,
    requireInformativeTrial: backdownThresholds.requireInformativeTrial,
    source: 'config-default',
    postMissK: typeof backdownThresholds.k === 'number' ? backdownThresholds.k : null,
  };

  const anyRowHasInformativeField = delegationRows.some((row) =>
    Object.prototype.hasOwnProperty.call(row, 'informative'));

  const triplesByAgent = new Map();
  for (const group of groupDelegationTrials(delegationRows).values()) {
    const agentKey = JSON.stringify([group.provider, group.model]);
    if (!triplesByAgent.has(agentKey)) {
      triplesByAgent.set(agentKey, { provider: group.provider, model: group.model, triples: [] });
    }
    triplesByAgent.get(agentKey).triples.push(buildTriple(group, { thresholds, promotionsOk, promotionEntries, selectSupervisionLevel }));
  }

  const agents = [...triplesByAgent.values()]
    .map((agent) => {
      const triples = [...agent.triples].sort((a, b) => compare(b.trials, a.trials) || compare(a.taskType, b.taskType));
      const probationEntry = probationOk
        ? probationEntries.find((entry) => entry.provider === agent.provider && entry.model === agent.model)
        : undefined;
      return {
        provider: agent.provider,
        model: agent.model,
        probation: probationEntry ? { roles: probationEntry.roles, since: probationEntry.since } : null,
        triples,
        totalTrials: triples.reduce((sum, triple) => sum + triple.trials, 0),
      };
    })
    .sort((a, b) => compare(b.totalTrials, a.totalTrials) || compare(a.provider, b.provider) || compare(a.model, b.model))
    .map(({ totalTrials, ...agent }) => agent);

  return {
    schema: REPORT_SCHEMA,
    asOf: asOfIso,
    thresholds,
    sources: {
      scorecards: recordsIsArray ? 'ok' : 'failed',
      promotions: promotionsSource,
      probation: probationSource,
    },
    criteria: buildCriteria({ thresholds, promotionsOk, anyRowHasInformativeField }),
    agents,
  };
}

/**
 * Bind the injected scorecard/promotions/probation readers plus the router, following the compute-only
 * gate-health declaration. `selectSupervisionLevel`/`backdownThresholds` are constructor parameters — see
 * the file header for why the real `provider-routing.mjs` values must be handed in by the caller (`run.mjs`)
 * rather than imported here.
 */
export function graduationProgressReportOperation({
  readScorecards, readPromotions, readProbation, selectSupervisionLevel, backdownThresholds,
} = {}) {
  if (typeof readScorecards !== 'function') {
    throw new TypeError('graduation-progress-report: needs a `readScorecards()` reader');
  }
  if (typeof readPromotions !== 'function') {
    throw new TypeError('graduation-progress-report: needs a `readPromotions()` reader');
  }
  if (typeof readProbation !== 'function') {
    throw new TypeError('graduation-progress-report: needs a `readProbation()` reader');
  }
  if (typeof selectSupervisionLevel !== 'function') {
    throw new TypeError('graduation-progress-report: needs a `selectSupervisionLevel` function (injected, never imported)');
  }
  if (!backdownThresholds || typeof backdownThresholds !== 'object') {
    throw new TypeError('graduation-progress-report: needs a `backdownThresholds` object (injected, never imported)');
  }
  return op(GRADUATION_PROGRESS_REPORT_OP, {
    input: {},
    verdictFrom: 'report',
    scorecards: compute({ reads: [], fn: () => readScorecards() }),
    promotions: compute({ reads: [], fn: () => readPromotions() }),
    probation: compute({ reads: [], fn: () => readProbation() }),
    report: compute({
      reads: ['findings.scorecards', 'findings.promotions', 'findings.probation'],
      fn: (view) => buildGraduationProgressReport({
        records: view.findings.scorecards.records,
        asOfIso: view.findings.scorecards.asOfIso,
        promotions: view.findings.promotions,
        probation: view.findings.probation,
        selectSupervisionLevel,
        backdownThresholds,
      }),
    }),
  });
}
