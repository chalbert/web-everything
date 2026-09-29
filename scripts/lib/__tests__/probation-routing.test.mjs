/**
 * agy-launcher-probation — the routing half: the opened doc-fix / ci-heal / bugfix gate rows, the probation roster, the
 * `ci-heal` taskType, and the pick riding on the routing record while Claude stays the fallback.
 */
import { describe, expect, it } from 'vitest';
import {
  AGY_CLAUDE_MODEL_BY_TIER, AGY_GEMINI_SIMPLE_MODEL, AGY_MODEL_CATALOG_CHECK, CRITICAL_WORK_GATE, PROBATION_ROSTER,
  PROBATION_WORKERS, PROVEN_TASK_ENVELOPES, RECOMMENDATIONS, selectProbationWorker, selectProvider,
} from '../provider-routing.mjs';
import { decideDispatchRoute } from '../dispatch-contracts.mjs';
import { taskTypeFor } from '../dispatch-task-type.mjs';
import { CODEX_MODEL } from '../codex-model-routing.mjs';

const row = (o) => ({ subjectClass: 'work-agent', verifiedBy: 'independent-claude', outcome: 'landed', scoredAt: '2026-09-20T00:00:00Z', ...o });
const open = { criticalWork: { critical: false, reasons: [] }, criticalMisses: [] };

describe('the Antigravity Claude models were checked against the live catalog', () => {
  it('pins the two Claude backends `agy models` lists on agy 1.2.12, and records the check', () => {
    expect(AGY_CLAUDE_MODEL_BY_TIER).toEqual({ sonnet: 'claude-sonnet-4-6', opus: 'claude-opus-4-6-thinking' });
    expect(AGY_MODEL_CATALOG_CHECK).toEqual({ agyVersion: '1.2.12', checkedOn: '2026-09-27' });
    expect(AGY_GEMINI_SIMPLE_MODEL).toMatch(/^gemini-3\.8-flash-/);
  });
});

describe('ci-heal is its own taskType, with a bounded envelope', () => {
  it('a ci-heal dispatch derives ci-heal, and a fix still derives bugfix', () => {
    expect(taskTypeFor({ kind: 'ci-heal', cause: null, scopePaths: ['we:scripts/a.mjs'] }).taskType).toBe('ci-heal');
    expect(taskTypeFor({ kind: 'fix', cause: null, scopePaths: ['we:scripts/a.mjs'] }).taskType).toBe('bugfix');
  });
  it('the ci-heal envelope is smaller than bugfix', () => {
    expect(PROVEN_TASK_ENVELOPES['ci-heal']).toEqual({ maxLoc: 150, maxFiles: 3 });
  });
  it('the gate opens doc-fix, ci-heal and bugfix on probation, but keeps build-new-feature closed', () => {
    expect(CRITICAL_WORK_GATE.openForNonCritical).toMatchObject({ 'doc-fix': true, 'ci-heal': true, bugfix: true, 'build-new-feature': false });
  });
});

describe('selectProbationWorker', () => {
  it('rosters: doc-fix → agy-Claude + Codex; ci-heal → agy-Claude + Codex + agy-Gemini (simple only, Codex-checked); bugfix → Codex + agy Claude + simple Gemini', () => {
    expect(PROBATION_ROSTER['doc-fix']).toEqual(['antigravity-claude', 'codex']);
    expect(PROBATION_ROSTER['ci-heal']).toEqual(['antigravity-claude', 'codex', 'antigravity-gemini']);
    expect(PROBATION_WORKERS['antigravity-gemini']).toMatchObject({ simpleOnly: true, checker: 'codex', model: AGY_GEMINI_SIMPLE_MODEL });
    expect(PROBATION_ROSTER.bugfix).toEqual(['codex', 'antigravity-claude', 'antigravity-gemini']);
    expect(PROBATION_ROSTER['build-new-feature']).toBeUndefined();
  });

  it('with no history, picks the first roster worker, at the tier\'s agy Claude model, fully supervised', () => {
    const { worker } = selectProbationWorker({ taskType: 'ci-heal', filesTouched: ['scripts/a.mjs'] });
    expect(worker).toMatchObject({ id: 'antigravity-claude', provider: 'antigravity', model: 'claude-sonnet-4-6', executor: 'antigravity', supervision: 'full', review: 'full', runRating: 'required' });
    expect(selectProbationWorker({ taskType: 'ci-heal', tier: 'opus', filesTouched: ['scripts/a.mjs'] }).worker.model).toBe('claude-opus-4-6-thinking');
  });

  it('rotates to the worker with fewer trials — a launch row with no outcome counts as a trial, not a failure', () => {
    const scorecards = [row({ provider: 'antigravity', model: 'claude-sonnet-4-6', taskType: 'ci-heal', outcome: null, verifiedBy: null, dispatchKind: 'probation-launch' })];
    const { worker } = selectProbationWorker({ taskType: 'ci-heal', filesTouched: ['scripts/a.mjs'], scorecards });
    expect(worker.id).toBe('codex');
  });

  it('ranks a worker whose last judged trial was not clean after one whose was', () => {
    const scorecards = [
      row({ provider: 'antigravity', model: 'claude-sonnet-4-6', taskType: 'ci-heal', outcome: 'reworked', scoredAt: '2026-09-21T00:00:00Z' }),
      row({ provider: 'codex', model: CODEX_MODEL, taskType: 'ci-heal' }),
      row({ provider: 'codex', model: CODEX_MODEL, taskType: 'ci-heal', scoredAt: '2026-09-22T00:00:00Z' }),
    ];
    expect(selectProbationWorker({ taskType: 'ci-heal', filesTouched: ['scripts/a.mjs'], scorecards }).worker.id).toBe('codex');
  });

  it('offers agy-Gemini only for a simple task', () => {
    const both = [
      row({ provider: 'antigravity', model: 'claude-sonnet-4-6', taskType: 'ci-heal' }),
      row({ provider: 'codex', model: CODEX_MODEL, taskType: 'ci-heal' }),
    ];
    expect(selectProbationWorker({ taskType: 'ci-heal', filesTouched: ['a.mjs'], scorecards: both }).worker.id).not.toBe('antigravity-gemini');
    const simple = selectProbationWorker({ taskType: 'ci-heal', filesTouched: ['a.mjs'], scorecards: both, simple: true });
    expect(simple.worker).toMatchObject({ id: 'antigravity-gemini', checker: 'codex' });
  });

  it('a critical miss on the exact triple vetoes that worker', () => {
    const vetoes = [{ provider: 'antigravity', model: 'claude-sonnet-4-6', taskType: 'ci-heal' }];
    expect(selectProbationWorker({ taskType: 'ci-heal', filesTouched: ['a.mjs'], vetoes }).worker.id).toBe('codex');
  });

  it('refuses statute paths, a roster-less taskType, and a doc-fix outside its envelope', () => {
    expect(selectProbationWorker({ taskType: 'doc-fix', filesTouched: ['docs/agent/platform-decisions.md'] }).worker).toBeNull();
    expect(selectProbationWorker({ taskType: 'build-new-feature', filesTouched: ['a.mjs'] }).worker).toBeNull();
    expect(selectProbationWorker({ taskType: 'doc-fix', filesTouched: ['a.md'], estimatedSize: 500 }).worker).toBeNull();
  });
});

describe('selectProvider — an opened roster taskType keeps Claude as the recommendation and adds the pick', () => {
  it('ci-heal, not critical: recommendation claude/sonnet, probationWorker agy-Claude', () => {
    const res = selectProvider({ taskType: 'ci-heal' }, { kind: 'ci-heal', filesTouched: ['scripts/a.mjs'], ...open });
    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.claudeTier).toBe('sonnet');
    expect(res.probationWorker.id).toBe('antigravity-claude');
    expect(res.auditTrail.find((a) => a.criterion === 'critical-work-gate').result).toBe('open-non-critical');
  });

  it('an EARNED Codex doc-fix record does not switch the recommendation — the pick still rides beside Claude', () => {
    const scorecards = [row({ provider: 'codex', model: CODEX_MODEL, taskType: 'doc-fix', verifiedBy: 'claude-subagent' })];
    const res = selectProvider({ taskType: 'doc-fix' }, { kind: 'build', filesTouched: ['docs/x.md'], estimatedSize: 40, scorecards, ...open });
    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.auditTrail.find((a) => a.criterion === 'codex-fitness').result).toBe('fit');
    expect(res.probationWorker.id).toBe('antigravity-claude');
  });

  it('critical work, or no verdict at all, gets no probation worker', () => {
    const critical = selectProvider({ taskType: 'ci-heal' }, { kind: 'ci-heal', filesTouched: ['a.mjs'], criticalWork: { critical: true, reasons: [] }, criticalMisses: [] });
    expect(critical.probationWorker).toBeNull();
    const unknown = selectProvider({ taskType: 'ci-heal' }, { kind: 'ci-heal', filesTouched: ['a.mjs'] });
    expect(unknown.probationWorker).toBeNull();
  });

  it('default gate: non-critical bugfix starts with Codex on full-review probation; critical bugfix gets no pick', () => {
    const context = { kind: 'fix', filesTouched: ['a.mjs'], ...open };
    const res = selectProvider({ taskType: 'bugfix' }, context);
    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.probationWorker).toMatchObject({ id: 'codex', supervision: 'full', review: 'full', runRating: 'required' });
    expect(res.auditTrail.find((a) => a.criterion === 'critical-work-gate').result).toBe('open-non-critical');

    const critical = selectProvider({ taskType: 'bugfix' }, { ...context, criticalWork: { critical: true, reasons: [] } });
    expect(critical.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(critical.probationWorker).toBeNull();
    expect(critical.auditTrail.find((a) => a.criterion === 'critical-work-gate').result).toBe('claude-only');
  });

  it('a build-new-feature stays closed — no pick', () => {
    const res = selectProvider({ taskType: 'build-new-feature' }, { kind: 'fix', filesTouched: ['a.mjs'], ...open });
    expect(res.recommendation).toBe(RECOMMENDATIONS.CLAUDE);
    expect(res.probationWorker).toBeNull();
  });
});

describe('decideDispatchRoute carries the pick on the record', () => {
  it('a non-critical ci-heal: routed claude, probationWorker set; a `behind` heal may go to agy-Gemini once the others have trials', () => {
    const scope = ['we:scripts/operations/operator-queue.mjs'];
    const plain = decideDispatchRoute({ kind: 'ci-heal', scopePaths: scope });
    expect(plain).toMatchObject({ outcome: 'routed', taskType: 'ci-heal', routed: 'claude', tier: 'sonnet' });
    expect(plain.probationWorker.id).toBe('antigravity-claude');
    const scorecards = [
      row({ provider: 'antigravity', model: 'claude-sonnet-4-6', taskType: 'ci-heal' }),
      row({ provider: 'codex', model: CODEX_MODEL, taskType: 'ci-heal' }),
    ];
    expect(decideDispatchRoute({ kind: 'ci-heal', scopePaths: scope, reason: 'behind' }, { scorecards }).probationWorker.id).toBe('antigravity-gemini');
    expect(decideDispatchRoute({ kind: 'ci-heal', scopePaths: scope, reason: 'red-ci' }, { scorecards }).probationWorker.id).not.toBe('antigravity-gemini');
  });

  it('a critical ci-heal scope gets no pick', () => {
    const out = decideDispatchRoute({ kind: 'ci-heal', scopePaths: ['we:scripts/merge-ai-prs.mjs', 'we:scripts/lane-drain.mjs'] });
    expect(out.probationWorker).toBeNull();
  });

  it('an all-docs build (doc-fix) records a pick too', () => {
    const out = decideDispatchRoute({ kind: 'build', scopePaths: ['we:docs/guide.md'], size: 2 });
    expect(out.taskType).toBe('doc-fix');
    expect(out.probationWorker?.id).toBe('antigravity-claude');
  });
});
