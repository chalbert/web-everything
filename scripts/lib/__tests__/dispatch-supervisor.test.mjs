import { describe, it, expect } from 'vitest';
import * as c from '../dispatch-contracts.mjs';
import { selectSupervisionLevel } from '../provider-routing.mjs';
import { thresholdsForRisk } from '../dispatch-thresholds.mjs';
import { validateScorecard } from '../../conveyor/run-scorecard-store.mjs';

const profile = (extra = {}) => c.buildDispatchProfile({ taskType: 'doc-fix', estimatedLoc: 30, filesTouched: ['docs/readme.md'], acceptanceTestable: true, dependsOn: [], ...extra }).profile;
const identity = { taskId: 'a', storyRef: '3383', round: 1, attempt: 1 };
const supervisor = { provider: 'antigravity', model: c.SUPERVISOR_CANDIDATES[0].model, sessionId: 'supervisor' };
const execution = (extra = {}) => ({ ...identity, authorRef: 'author', supervisionLevel: 'full', supervisor, sessionName: null, taskType: 'doc-fix', status: 'landed', provider: 'codex', model: 'gpt-6-astra', executor: 'codex-direct-task', evidence: { pr: 42, tests: { command: 'test', passed: 1, failed: 0 } }, findings: [], ...extra });
const verdict = (extra = {}) => ({ ...identity, mode: 'acting', supervisor, storyTaskType: 'doc-fix', verdict: 'accept', findings: [], verifiedBy: 'other', ...extra });
const gt = (outcome = 'clean') => ({ taskId: 'a', storyRef: '3383', round: 1, recordedBy: 'orchestrator', sources: [{ kind: 'independent-pr-review', outcome, actorRef: 'reviewer', verifiedBy: 'independent-claude', ...(outcome === 'unclean' ? { findings: ['Independent review found missing coverage'] } : {}) }] });
const options = (extra = {}) => ({ now: '2026-09-20T00:00:00Z', groundTruth: gt(), ...extra });
function rows(candidate = c.SUPERVISOR_CANDIDATES[0], count = 2, informative = false) {
  return Array.from({ length: count + Number(informative) }, (_, i) => {
    const groundTruth = gt();
    if (informative && i === 0) groundTruth.sources.push({ kind: 'rework-rounds', outcome: 'unclean', reworkRounds: 1, actorRef: 'counter', findings: ['Fixed assertion'] });
    const out = c.supervisorTrialFromVerdict(execution(), verdict({ supervisor: { provider: candidate.provider, model: candidate.model, sessionId: 'supervisor' } }), options({ now: `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`, groundTruth }));
    expect(out.ok).toBe(true); expect(validateScorecard(out.row).ok).toBe(true);
    // #3889 (Rule 5 of #3690): a confirmed miss needs a rootCause note in its own field before any
    // post-miss trial counts toward restoration; informative:true is likewise its own recorded field
    // (#3888, rule 4), never inferred from outcome/findings. Harmless for callers whose clean count never
    // reaches the post-miss bar anyway (still blocked, just by streak length instead of the missing note).
    if (informative && i === 0) { out.row.informative = true; out.row.rootCause = 'Diagnosed: assertion ordering flaked under load; fixed and root-caused.'; }
    return out.row;
  });
}

describe('supervisor ladder', () => {
  it('freezes the exact five candidates and all nine ladders', () => {
    expect(c.SUPERVISOR_CANDIDATES.map(r => r.id)).toEqual(['agy-sonnet-4-6', 'codex-astra', 'claude-sonnet-5', 'agy-opus-4-6', 'claude-opus-5']);
    expect(c.SUPERVISOR_CANDIDATES[1]).toEqual({ id: 'codex-astra', backend: 'codex', provider: 'codex', model: 'gpt-6-astra', tier: null });
    expect(Object.keys(c.SUPERVISOR_LADDERS)).toHaveLength(9);
    for (const risk of c.RISKS) for (const complexity of c.COMPLEXITIES) {
      const ladder = c.SUPERVISOR_LADDERS[`${risk}/${complexity}`];
      expect(Object.isFrozen(ladder)).toBe(true); expect(ladder.at(-1)).toBe('claude-opus-5');
    }
    for (const candidate of c.SUPERVISOR_CANDIDATES) expect(Object.isFrozen(candidate)).toBe(true);
    expect(c.SUPERVISOR_LADDERS['medium/M']).toEqual(['claude-sonnet-5', 'agy-opus-4-6', 'claude-opus-5']);
  });
  it('cold starts on the fallback, shadowing the cheapest rung', () => {
    const selected = c.selectSupervisor(profile());
    expect(selected).toMatchObject({ role: c.SUPERVISOR_ROLE, provider: 'claude', model: 'claude-opus-5', tier: 'opus', backend: 'claude-native', mode: 'acting', supervision: 'full', alternateBackend: null,
      shadow: { provider: 'antigravity', model: supervisor.model, tier: 'sonnet', backend: 'agy', mode: 'shadow' } });
    expect(selected.auditTrail.filter(a => a.criterion === 'supervisor-candidate')).toHaveLength(5);
    expect(selected.auditTrail.at(-1)).toMatchObject({ criterion: 'supervisor-selected', result: 'claude-opus-5', reasoning: 'fallback' });
    expect(c.routeDispatch(profile(), { stage: 'story', kind: 'build' })).toEqual({ ...selected, spotCheck: null });
  });
  it('graduates only supervisor driver records for the exact unit', () => {
    const scorecards = rows();
    expect(c.selectSupervisor(profile(), { scorecards })).toMatchObject({ provider: 'antigravity', model: supervisor.model, shadow: null });
    for (const change of [{ role: 'work' }, { role: undefined }, { subjectClass: 'work-agent' }, { subjectClass: undefined }, { taskType: 'other' }, { model: 'different' }, { provider: 'claude' }, { verifiedBy: 'other' }]) {
      expect(c.selectSupervisor(profile(), { scorecards: scorecards.map(r => ({ ...r, ...change })) }).model).toBe('claude-opus-5');
    }
    const miss = c.supervisorTrialFromVerdict(execution(), verdict(), options({ groundTruth: gt('unclean') }));
    expect(c.selectSupervisor(profile(), { scorecards: [...scorecards, miss.row] }).model).toBe('claude-opus-5');
    // Supervisor evidence cannot select a work provider or graduate native story work.
    expect(c.routeDispatch(profile(), { stage: 'task', scorecards }).provider).toBe('claude');
    const native = rows(c.SUPERVISOR_CANDIDATES[2]);
    expect(c.routeDispatch(profile(), { stage: 'story', kind: 'prepare', scorecards: native }).supervision).toBe('full');
  });
  it('uses hard floors with no shadow regardless of history', () => {
    for (const p of [profile({ filesTouched: ['docs/agent/rules.md'] }), profile({ taskType: 'architectural-decision' }), profile({ taskType: 'triage-research' })]) {
      const out = c.selectSupervisor(p, { scorecards: rows() });
      expect(out).toMatchObject({ model: 'claude-opus-5', shadow: null });
      expect(out.auditTrail.filter(a => a.criterion === 'supervisor-candidate')).toHaveLength(1);
    }
  });
  it('selects graduated Codex where allowed and skips it on medium/M', () => {
    const candidate = c.SUPERVISOR_CANDIDATES[1];
    expect(c.selectSupervisor(profile(), { scorecards: rows(candidate) })).toMatchObject({ model: 'gpt-6-astra', provider: 'codex', backend: 'codex', tier: null, shadow: { provider: 'antigravity' } });
    const p = profile({ estimatedLoc: 200, risk: 'medium' });
    expect(p.complexity).toBe('M');
    expect(c.selectSupervisor(p, { scorecards: rows(candidate, 5, true) }).shadow.model).toBe('claude-sonnet-5');
    // 8 clean trials = minCleanStreak(5) + default k(3) — the post-miss bar, not the cold-start bar (#3889).
    expect(c.selectSupervisor(p, { scorecards: rows(c.SUPERVISOR_CANDIDATES[2], 8, true) })).toMatchObject({ model: 'claude-sonnet-5', shadow: null });
  });
  it('uses high-risk supervisor thresholds independently of task spot-check prohibition', () => {
    // 11 clean trials = minCleanStreak(8) + default k(3) — high has no explicit k, so selectSupervisionLevel
    // falls back to DEFAULT_BACKDOWN_THRESHOLDS.k (#3889).
    const candidate = c.SUPERVISOR_CANDIDATES[3], scorecards = rows(candidate, 11, true), p = profile({ risk: 'high' });
    expect(c.selectSupervisor(p, { scorecards: scorecards.slice(0, -1) }).model).toBe('claude-opus-5');
    expect(c.selectSupervisor(p, { scorecards })).toMatchObject({ provider: 'antigravity', model: candidate.model, shadow: null });
  });
  it('is deterministic with shuffled scorecards', () => {
    const p = Object.freeze(profile()), scorecards = rows(c.SUPERVISOR_CANDIDATES[1]);
    const before = JSON.stringify(scorecards), out = c.selectSupervisor(p, { scorecards });
    expect(JSON.stringify(c.selectSupervisor(p, { scorecards: [...scorecards].reverse() }))).toBe(JSON.stringify(out));
    expect(JSON.stringify(scorecards)).toBe(before);
    for (const input of [null, [], {}, { ...p, risk: 'bad' }]) expect(c.selectSupervisor(input)).toMatchObject({ role: 'refused', mode: null, shadow: null, backend: null, spotCheck: null });
  });
});

describe('acting and shadow supervisor trials', () => {
  it('stamps store-compatible supervisor provenance and one key per task', () => {
    const out = c.supervisorTrialFromVerdict(execution(), verdict(), options());
    expect(out.row).toMatchObject({ provider: supervisor.provider, model: supervisor.model, subjectClass: 'driver', role: 'supervise', rubricVersion: 'mechanical-supervise.1', dispatchKind: 'mechanical-supervise', outcome: 'landed', taskType: 'doc-fix', verifiedBy: 'independent-claude', idempotencyKey: 'mech-sup-trial:3383:r1:a' });
    expect(validateScorecard(out.row)).toEqual({ ok: true, errors: [] });
    expect(c.supervisorTrialFromVerdict(execution({ attempt: 2 }), verdict({ attempt: 2, storyTaskType: 'other' }), options()).row).toMatchObject({ idempotencyKey: out.idempotencyKey, taskType: 'other' });
  });
  it('records accepted-but-bounced work as a calibration miss that fires the router veto', () => {
    const clean = rows(), out = c.supervisorTrialFromVerdict(execution(), verdict(), options({ groundTruth: gt('unclean') }));
    expect(out.row.outcome).toBe('rejected'); expect(validateScorecard(out.row).ok).toBe(true);
    const level = scorecards => selectSupervisionLevel(supervisor.provider, supervisor.model, 'doc-fix', scorecards, thresholdsForRisk('low'), 'driver');
    expect(level(clean).level).toBe('spot-check');
    expect(level([...clean, out.row])).toMatchObject({ level: 'full', reasoning: expect.stringContaining('veto') });
    expect(level([...clean, out.row]).auditTrail[0].result).toBe('veto-fired');
  });
  it('gates supervisor trials with the same graduation and publish checks', () => {
    for (const [r, v, o] of [[execution(), verdict({ mode: 'shadow' }), options()], [execution(), verdict(), options({ groundTruth: undefined })], [execution(), verdict(), options({ now: 'today' })], [execution({ authorRef: '' }), verdict(), options()], [execution(), verdict({ supervisor: { ...supervisor, model: 'AKIAABCDEFGHIJKLMNOP' } }), options()]]) expect(c.supervisorTrialFromVerdict(r, v, o).ok).toBe(false);
  });
  it('refuses a shadow whose session is missing or shared with the author, acting supervisor or a ground-truth actor', () => {
    const shadowFor = (sessionId) => verdict({ mode: 'shadow', supervisor: { provider: 'codex', model: 'gpt-6-astra', sessionId } });
    expect(c.shadowTrialFromVerdict(execution(), shadowFor('shadow'), verdict(), options({ groundTruth: gt('clean') })).ok).toBe(true);
    for (const sessionId of [null, execution().authorRef, verdict().supervisor.sessionId, gt('clean').sources[0].actorRef]) {
      const out = c.shadowTrialFromVerdict(execution(), shadowFor(sessionId), verdict(), options({ groundTruth: gt('clean') }));
      expect(out.ok).toBe(false); expect(out.reason).toMatch(/shadow session must be independent/);
    }
  });
  it('scores shadow predictions against ground truth and records agreement without action', () => {
    const shadow = verdict({ mode: 'shadow', supervisor: { provider: 'codex', model: 'gpt-6-astra', sessionId: 'shadow' } });
    const before = JSON.stringify([execution(), shadow, verdict()]);
    for (const outcome of ['clean', 'unclean']) for (const judgment of ['accept', 'rework', 'reject']) {
      const v = { ...shadow, verdict: judgment, findings: judgment === 'accept' ? [] : ['Needs correction'] };
      const out = c.shadowTrialFromVerdict(execution(), v, verdict(), options({ groundTruth: gt(outcome) }));
      expect(out.ok).toBe(true); expect(validateScorecard(out.row).ok).toBe(true);
      expect(out.row).toMatchObject({ outcome: (judgment === 'accept') === (outcome === 'clean') ? 'landed' : 'rejected', agreedWithActing: judgment === 'accept', subjectClass: 'driver', role: 'supervise', dispatchKind: 'mechanical-supervise-shadow', idempotencyKey: 'mech-sup-shadow-trial:3383:r1:a:codex:gpt-6-astra' });
      expect(c.verdictEffects(v)).toEqual({ acted: false, newTasks: [], complete: false });
    }
    expect(JSON.stringify([execution(), shadow, verdict()])).toBe(before);
    for (const [s, a, o] of [[null, verdict(), options()], [{ ...shadow, mode: 'acting' }, verdict(), options()], [shadow, verdict({ mode: 'shadow' }), options()], [{ ...shadow, attempt: 2 }, verdict(), options()], [shadow, verdict({ attempt: 2 }), options()], [{ ...shadow, supervisor }, verdict(), options()], [shadow, verdict(), options({ groundTruth: undefined })], [shadow, verdict(), options({ now: 'bad' })], [{ ...shadow, complete: true }, verdict(), options()], [{ ...shadow, findings: ['AKIAABCDEFGHIJKLMNOP'] }, verdict(), options()]]) expect(c.shadowTrialFromVerdict(execution(), s, a, o).ok).toBe(false);
  });
});
