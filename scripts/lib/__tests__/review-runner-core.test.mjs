/**
 * @file review-runner-core.test.mjs — proof of the PURE core of the #2830 scheduled SHADOW review runner.
 *
 * Covers:
 *   • `partitionRunnerPRs` — the fail-closed discovery filter: review:human skipped (never touched, #2439 /
 *     INVARIANT 2), label-unverifiable skipped, review:pending kept clearable; a PR carrying BOTH pending and
 *     human is skipped as human.
 *   • `runnerShadowPlan` — THE ZERO-MUTATION GUARANTEE: whatever the ledger and PR labels, the plan is ALWAYS
 *     observe-only (`plan.apply === false`, `plan.mode === 'shadow'`). A clean auto-dispose ledger yields a
 *     would-CLEAR intent that is never applied; a review:human PR is kept parked (INVARIANT 2); an empty ledger
 *     is kept parked (fail-closed).
 *   • `buildShadowRecord` — the structured shadow-log record: `mutated:false` / `applied:false` always;
 *     `wouldClear` mirrors the intent; an empty ledger records `ledgerFound:false`.
 *
 * The auto-dispose ledger builders mirror `disposition-land-seam.test.mjs` (the SAME clean-diverse-accept fixture
 * the seam under test is proven with).
 */
import { describe, it, expect } from 'vitest';
import {
  partitionRunnerPRs, runnerShadowPlan, buildShadowRecord, summarizeLedger,
  RUNNER_PENDING, RUNNER_HUMAN,
} from '../review-runner-core.mjs';
import { resolveDispositionConfig } from '../review-policy.mjs';
import { REVIEW_LABELS } from '../review-escalation.mjs';
import { VERDICTS, MANDATORY_LENSES } from '../jury-core.mjs';
import { LAND_ACTIONS } from '../disposition-land-seam.mjs';

const CONFIG = resolveDispositionConfig(); // present-unless-all-agree, dissentThreshold 0, equal weights; landMode shadow

// ── ledger builders (mirror disposition-land-seam.test.mjs / disposition-judge.test.mjs) ───────────────────────
const CHARTER = 'judge';
const rosterEvent = (jurors, round = 0) => ({ type: 'roster-picked', round, jurors });
const verdictEvent = (jurorId, verdict, round = 0) => ({ type: 'verdict', round, jurorId, verdict });
const findingEvent = (jurorId, finding, round = 0) => ({ type: 'finding', round, jurorId, finding });

/** A clean two-mandatory-lens ledger, TWO jurors per lens all accepting, no findings — the clean-winner case
 *  (green auto-disposes AND red finds no grounds to refute). */
function cleanDiverseLedger() {
  const jurors = [];
  const verdicts = [];
  for (const lens of MANDATORY_LENSES) {
    for (const slot of [1, 2]) {
      const id = `${lens}#${slot}`;
      jurors.push({ id, lens, charter: CHARTER });
      verdicts.push(verdictEvent(id, VERDICTS.ACCEPT));
    }
  }
  return [rosterEvent(jurors), ...verdicts];
}

/** A contested ledger — one juror per mandatory lens wanting changes (kept parked). */
function contestedLedger() {
  const jurors = MANDATORY_LENSES.map((lens) => ({ id: `${lens}#1`, lens, charter: CHARTER }));
  return [rosterEvent(jurors), ...MANDATORY_LENSES.map((lens) => verdictEvent(`${lens}#1`, VERDICTS.CHANGES))];
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('partitionRunnerPRs — fail-closed discovery filter (INVARIANT 2 / #2439)', () => {
  it('keeps a review:pending PR clearable', () => {
    const { clearable, skippedHuman, skippedUnverified } = partitionRunnerPRs([
      { pr: 974, repo: 'we', labels: [RUNNER_PENDING] },
    ]);
    expect(clearable.map((c) => c.pr)).toEqual([974]);
    expect(skippedHuman).toEqual([]);
    expect(skippedUnverified).toEqual([]);
  });

  it('skips a review:human PR — never agent-cleared', () => {
    const { clearable, skippedHuman } = partitionRunnerPRs([
      { pr: 976, repo: 'we', labels: [RUNNER_HUMAN] },
    ]);
    expect(clearable).toEqual([]);
    expect(skippedHuman).toEqual([{ pr: 976, repo: 'we' }]);
  });

  it('a PR carrying BOTH review:pending AND review:human is skipped as human (human wins, fail-closed)', () => {
    const { clearable, skippedHuman } = partitionRunnerPRs([
      { pr: 982, repo: 'we', labels: [RUNNER_PENDING, RUNNER_HUMAN] },
    ]);
    expect(clearable).toEqual([]);
    expect(skippedHuman).toEqual([{ pr: 982, repo: 'we' }]);
  });

  it('skips a label-UNVERIFIABLE PR (no labels array) — cannot prove it is not review:human', () => {
    const { clearable, skippedUnverified } = partitionRunnerPRs([{ pr: 999, repo: 'we' }]);
    expect(clearable).toEqual([]);
    expect(skippedUnverified).toEqual([{ pr: 999, repo: 'we' }]);
  });

  it('drops a PR that is neither pending nor human (not this runner\'s business)', () => {
    const { clearable, skippedHuman, skippedUnverified } = partitionRunnerPRs([
      { pr: 500, repo: 'we', labels: ['ready-to-merge'] },
    ]);
    expect(clearable).toEqual([]);
    expect(skippedHuman).toEqual([]);
    expect(skippedUnverified).toEqual([]);
  });

  it('partitions a mixed real-world set (the #2830 proof set) correctly', () => {
    const { clearable, skippedHuman } = partitionRunnerPRs([
      { pr: 974, repo: 'we', labels: [RUNNER_PENDING] },
      { pr: 975, repo: 'we', labels: [RUNNER_PENDING] },
      { pr: 983, repo: 'we', labels: ['ready-to-merge', RUNNER_PENDING] },
      { pr: 976, repo: 'we', labels: [RUNNER_HUMAN] },
      { pr: 982, repo: 'we', labels: ['ready-to-merge', RUNNER_HUMAN] },
      { pr: 984, repo: 'we', labels: ['ready-to-merge', RUNNER_HUMAN] },
    ]);
    expect(clearable.map((c) => c.pr).sort()).toEqual([974, 975, 983]);
    expect(skippedHuman.map((s) => s.pr).sort()).toEqual([976, 982, 984]);
  });
});

describe('runnerShadowPlan — THE ZERO-MUTATION GUARANTEE (forced shadow, never applies)', () => {
  it('a clean auto-dispose ledger yields a WOULD-CLEAR intent that is NEVER applied in shadow', () => {
    const { intent, plan } = runnerShadowPlan({
      ledger: cleanDiverseLedger(), config: CONFIG, currentLabels: [REVIEW_LABELS.pending],
    });
    // the seams' INTENT is to clear (WOULD clear) …
    expect(intent.action).toBe(LAND_ACTIONS.CLEAR);
    expect(plan.action).toBe('clear');
    // … but SHADOW never applies it — the runner mutates nothing.
    expect(plan.apply).toBe(false);
    expect(plan.mode).toBe('shadow');
    expect(plan.observation).toMatch(/SHADOW/);
    expect(plan.observation).toMatch(/WOULD write/);
  });

  it('a review:human PR is kept parked even on a clean ledger (INVARIANT 2), never applied', () => {
    const { intent, plan } = runnerShadowPlan({
      ledger: cleanDiverseLedger(), config: CONFIG, currentLabels: [REVIEW_LABELS.human],
    });
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(plan.apply).toBe(false);
    expect(plan.mode).toBe('shadow');
  });

  it('an EMPTY ledger is kept parked (fail-closed — no roster / no verdicts), never applied', () => {
    const { intent, plan } = runnerShadowPlan({ ledger: [], config: CONFIG, currentLabels: [REVIEW_LABELS.pending] });
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(plan.apply).toBe(false);
  });

  it('a contested ledger is kept parked, never applied', () => {
    const { intent, plan } = runnerShadowPlan({
      ledger: contestedLedger(), config: CONFIG, currentLabels: [REVIEW_LABELS.pending],
    });
    expect(intent.action).toBe(LAND_ACTIONS.KEEP_PARKED);
    expect(plan.apply).toBe(false);
  });

  it('plan.apply is ALWAYS false across every ledger/label combination (the invariant, exhaustively)', () => {
    const ledgers = [cleanDiverseLedger(), contestedLedger(), []];
    const labelSets = [[REVIEW_LABELS.pending], [REVIEW_LABELS.human], ['ready-to-merge', REVIEW_LABELS.pending], []];
    for (const ledger of ledgers) {
      for (const currentLabels of labelSets) {
        const { plan } = runnerShadowPlan({ ledger, config: CONFIG, currentLabels });
        expect(plan.apply).toBe(false);
        expect(plan.mode).toBe('shadow');
      }
    }
  });
});

describe('buildShadowRecord — the structured shadow-log record', () => {
  it('records mutated:false / applied:false and wouldClear:true for a clean auto-dispose', () => {
    const item = { pr: 974, repo: 'we', labels: [REVIEW_LABELS.pending] };
    const ledger = cleanDiverseLedger();
    const { intent, plan } = runnerShadowPlan({ ledger, config: CONFIG, currentLabels: item.labels });
    const rec = buildShadowRecord({ item, ledger, intent, plan });
    expect(rec.subject).toBe('we#974');
    expect(rec.mutated).toBe(false);
    expect(rec.applied).toBe(false);
    expect(rec.mode).toBe('shadow');
    expect(rec.wouldClear).toBe(true);
    expect(rec.disposition).toBe('auto-dispose');
    expect(rec.ledgerFound).toBe(true);
  });

  it('records ledgerFound:false and wouldClear:false for a PR with no persisted ledger (the #2830 live case)', () => {
    const item = { pr: 975, repo: 'we', labels: [REVIEW_LABELS.pending] };
    const { intent, plan } = runnerShadowPlan({ ledger: [], config: CONFIG, currentLabels: item.labels });
    const rec = buildShadowRecord({ item, ledger: [], intent, plan });
    expect(rec.ledgerFound).toBe(false);
    expect(rec.wouldClear).toBe(false);
    expect(rec.mutated).toBe(false);
    expect(rec.applied).toBe(false);
    expect(rec.rounds).toBe(0);
    expect(rec.panelVerdict).toBe('none');
  });

  it('mutated is ALWAYS false regardless of intent (the record\'s invariant)', () => {
    for (const ledger of [cleanDiverseLedger(), contestedLedger(), []]) {
      const item = { pr: 1, repo: 'we', labels: [REVIEW_LABELS.pending] };
      const { intent, plan } = runnerShadowPlan({ ledger, config: CONFIG, currentLabels: item.labels });
      const rec = buildShadowRecord({ item, ledger, intent, plan });
      expect(rec.mutated).toBe(false);
      expect(rec.applied).toBe(false);
    }
  });
});

describe('summarizeLedger — the ledger projection (reuses reduceLedger, never re-derives)', () => {
  it('summarizes a clean ledger: rosterKnown, no outstanding findings, accept per mandatory lens', () => {
    const s = summarizeLedger(cleanDiverseLedger());
    expect(s.ledgerFound).toBe(true);
    expect(s.rosterKnown).toBe(true);
    expect(s.outstandingFindings).toBe(0);
    for (const lens of MANDATORY_LENSES) expect(s.lensVerdicts[lens]).toBe(VERDICTS.ACCEPT);
  });

  it('counts an outstanding finding and attributes it by lens category', () => {
    const ledger = [
      ...cleanDiverseLedger(),
      findingEvent('correctness#1', { file: 'x.mjs', summary: 'a flaw', outcome: 'open', category: 'correctness' }),
    ];
    const s = summarizeLedger(ledger);
    expect(s.outstandingFindings).toBe(1);
    expect(s.findingsByLens.correctness).toBe(1);
  });

  it('an empty ledger summarizes as not-found with zero rounds', () => {
    const s = summarizeLedger([]);
    expect(s.ledgerFound).toBe(false);
    expect(s.rounds).toBe(0);
    expect(s.rosterKnown).toBe(false);
  });
});
