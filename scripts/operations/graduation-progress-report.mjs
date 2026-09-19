/**
 * @file we:scripts/operations/graduation-progress-report.mjs
 * @description Read-only graduation progress for session delegation (#3690, #xd9xwtn).
 * Keeps trust scoped to each provider/model/taskType triple; the reader supplies all IO and time.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';

export const GRADUATION_PROGRESS_REPORT_OP = 'graduation-progress-report';
export const THRESHOLD_N = 5;

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/**
 * Aggregate plain scorecard rows without mutating them. Triples use ascending code-unit order
 * by provider, model, then taskType. Trials use scoredAt order, preserving store order on ties.
 * Only counted review findings reset a streak; outcome does not substitute for review evidence.
 */
export function aggregateGraduationProgress(records) {
  const groups = new Map();
  const rows = records.filter((row) => row.dispatchKind === 'session-delegation')
    .sort((a, b) => compare(a.scoredAt, b.scoredAt));
  for (const row of rows) {
    const { provider, model, taskType } = row;
    const key = JSON.stringify([provider, model, taskType]);
    if (!groups.has(key)) {
      groups.set(key, {
        provider, model, taskType, trials: 0, countedTrials: 0,
        trailingCleanStreak: 0, everInformative: false, resets: [], lastTrialAt: null,
      });
    }
    const triple = groups.get(key);
    triple.trials += 1;
    triple.lastTrialAt = row.scoredAt;
    if (row.verifiedBy !== 'claude-subagent' && row.verifiedBy !== 'independent-claude') continue;
    triple.countedTrials += 1;
    if (row.findings != null) {
      triple.everInformative = true;
      triple.trailingCleanStreak = 0;
      triple.resets.push({ scoredAt: row.scoredAt, findings: row.findings });
    } else {
      triple.trailingCleanStreak += 1;
    }
  }
  return [...groups.values()]
    .sort((a, b) => compare(a.provider, b.provider) || compare(a.model, b.model) || compare(a.taskType, b.taskType))
    .map((triple) => {
      const qualifies = triple.trailingCleanStreak >= THRESHOLD_N && triple.everInformative;
      return { ...triple, qualifies, verificationTier: qualifies ? 'spot-check' : 'full' };
    });
}

/** Pure report envelope; the timestamp is supplied by the reader, never sampled here. */
export function buildGraduationProgressReport({ records, asOfIso }) {
  const triples = aggregateGraduationProgress(records);
  return {
    thresholdN: THRESHOLD_N, asOf: asOfIso, totalTriples: triples.length,
    qualifiedCount: triples.filter((triple) => triple.qualifies).length, triples,
  };
}

/** Bind the injected scorecard reader, following the compute-only gate-health declaration. */
export function graduationProgressReportOperation({ readScorecards } = {}) {
  if (typeof readScorecards !== 'function') {
    throw new TypeError('graduation-progress-report: needs a `readScorecards()` reader');
  }
  return op(GRADUATION_PROGRESS_REPORT_OP, {
    input: {},
    verdictFrom: 'report',
    scorecards: compute({ reads: [], fn: () => readScorecards() }),
    report: compute({
      reads: ['findings.scorecards'],
      fn: (view) => buildGraduationProgressReport(view.findings.scorecards),
    }),
  });
}
