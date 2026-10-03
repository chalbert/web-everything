/** Item-scoped activity and incarnation joins (#4198). Pure; IO supplies evidence. */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';
import { resolveAgentActivity } from './agent-activity.mjs';
import { parseSessionSlug } from '../conveyor/session-slug.mjs';
import { CONSTELLATION_REPOS } from '../lib/constellation-repos.mjs';
import { validateCompletionRecord, isForeignCompletionSessionId } from './completion-record.mjs';

export const ITEM_ACTIVITY_OP = 'item-activity';
export function itemSelector(input = {}) {
  const hasPr = input.pr !== undefined && input.pr !== null;
  const hasCard = input.card !== undefined && input.card !== null;
  if (hasPr === hasCard) throw new TypeError('item-activity requires exactly one of pr or card');
  const positive = (v) => /^(?:[1-9]\d*)$/.test(String(v)) && Number.isSafeInteger(Number(v));
  if (hasPr && !positive(input.pr)) throw new TypeError('pr must be a positive integer');
  if (hasCard && !positive(input.card) && !/^x[0-9a-z]{6}$/.test(String(input.card))) throw new TypeError('card must be a positive integer or card hash');
  const repo = input.repo ?? 'we';
  if (!Object.hasOwn(CONSTELLATION_REPOS, repo)) throw new TypeError('repo must be a canonical constellation key');
  return hasPr ? { pr: Number(input.pr), repo } : { card: String(input.card) };
}
const epoch = (v) => typeof v === 'number' ? v : Date.parse(v);

/** Keep terminal evidence separate from observed process state; resolve parents before filtering. */
export function selectItemActivity(input, { rows = [], completions = [], prToCard = {}, gaps = [] } = {}) {
  const selector = itemSelector(input);
  const sources = rows.map((row) => ({ ...row, completion: null, evidenceGaps: [] }));
  const issues = [...gaps];
  for (const record of completions) {
    if (!validateCompletionRecord(record).ok) { issues.push('Invalid completion record; outcome unknown'); continue; }
    const parsed = parseSessionSlug(record.session);
    if (!parsed || parsed.itemKind || (record.pr != null && Number(record.pr) !== Number(parsed.id)) || record.kind !== parsed.kind) {
      issues.push(`${record.session}: inconsistent completion identity`); continue;
    }
    const sameSlug = sources.filter((row) => (row.name ?? row.codexSlug) === record.session);
    const matches = sameSlug.filter((row) => !isForeignCompletionSessionId(row.sessionId, record.sessionId)
      && (!Number.isFinite(epoch(row.startedAt)) || epoch(record.startedAt) >= epoch(row.startedAt)));
    if (sameSlug.length) {
      for (const row of sameSlug) {
        if (matches.length === 1 && matches[0] === row) row.completion = record;
        else row.evidenceGaps.push('Completion rejected: foreign, older or ambiguous incarnation');
      }
    } else if (record.status === 'done') {
      sources.push({ id: `completion:${record.session}:${record.startedAt}`, name: record.session,
        sessionId: record.sessionId, kind: 'completion', runtime: null, state: null,
        startedAt: record.startedAt, completion: record, evidenceGaps: [] });
    }
  }
  const byId = new Map(sources.map((r) => [r.id, r]));
  const { runs } = resolveAgentActivity(sources, { prToCard });
  return {
    runs: runs.filter((r) => selector.pr !== undefined
      ? r.pr?.repo === selector.repo && r.pr?.number === selector.pr : String(r.card) === selector.card)
      .map((run) => {
        const row = byId.get(run.runId);
        const completion = row.completion;
        const evidenceGaps = [...row.evidenceGaps];
        if (!completion) evidenceGaps.push('Completion evidence unavailable; outcome unknown');
        else if (completion.status === 'done' && !completion.outcome) evidenceGaps.push('Terminal completion has no outcome');
        return { ...run, runtime: row.runtime ?? (row.kind === 'completion' ? null : run.runtime),
          live: row.kind === 'completion' ? false : row.state === 'working' || row.state === 'idle' ? true : null,
          completionStatus: completion?.status ?? null,
          outcome: completion?.status === 'done' ? completion.outcome || null : null,
          completedAt: completion?.status === 'done' ? completion.updatedAt : null,
          operationRunId: completion?.runId ?? null, source: row, evidenceGaps };
      }), gaps: issues,
  };
}

export function itemActivityOperation({ readActivity } = {}) {
  if (typeof readActivity !== 'function') throw new TypeError('item-activity needs a reader');
  return op(ITEM_ACTIVITY_OP, {
    input: { pr: { type: 'number', required: false }, card: { type: 'string', required: false },
      repo: { type: 'string', required: false, default: 'we' } },
    verdictFrom: 'read',
    read: compute({ reads: ['input.pr', 'input.card', 'input.repo'], fn: ({ input }) => {
      itemSelector(input);
      return readActivity(input);
    } }),
  });
}
