/**
 * @file gate-health.test.mjs — proof of the `gate-health` operation and the statistics behind it.
 *
 * The load-bearing tests are the four PRECONDITIONS. Each removes a way the naive comparison lies, and each
 * has a mutation test: delete the correction and a named test goes red.
 */
import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRegistry } from '../registry.mjs';
import { startRun, advanceWhileRunning } from '../engine.mjs';
import { isReadOnlyDeclaration } from '../http-adapter.mjs';
import { importGraph } from './import-graph.mjs';
import {
  bandOf, classifyFollowUp, stratifyBySize, compareProportions, compareGroups,
  assessCriteria, censor, clusterEffectiveN, requiredNPerGroup, zForAlpha, SIZE_BANDS,
} from '../../lib/gate-health.mjs';
import { joinHistory, hotFileCut, HOT_FILE_MIN, createHistoryReader } from '../gate-health-io.mjs';
import { gateHealthOperation, GATE_HEALTH_OP, clampLimit, shapeHistoryFinding } from '../gate-health.mjs';
import { OPERATIONS } from '../run.mjs';

const NOW = 1_800_000_000;
const DAY = 86_400;
/** A record merged `ageDays` ago — old enough to be observable unless stated. */
const pr = (n, lines, escalated, followUp = null, ageDays = 60, followUpSource = null) => ({
  number: n, title: `pr ${n}`, lines, files: 2, escalated, followUp, followUpSource,
  mergedAtSec: NOW - ageDays * DAY,
});

function runGateHealth(input = {}, history) {
  const declaration = gateHealthOperation({ loadHistory: () => history });
  const registry = createRegistry();
  registry.register(declaration);
  return { declaration, run: advanceWhileRunning(startRun({ op: GATE_HEALTH_OP, id: 'run-gh-test', input, registry }), { registry }) };
}

describe('the operation is REGISTERED — it shipped callable by nothing', () => {
  it('run.mjs can resolve it', () => {
    // PR #1163 declared it and never registered it, so `resolveOperation` threw and the whole
    // "an operation, not a script" claim was false. A declaration nothing can reach is a script with extra steps.
    expect(Object.keys(OPERATIONS)).toContain(GATE_HEALTH_OP);
    expect(typeof OPERATIONS[GATE_HEALTH_OP]).toBe('function');
  });
});

describe('precondition 1 — a review-driven fix is the gate WORKING, not a defect', () => {
  it('separates the two populations by real merge subjects', () => {
    for (const s of ['Merge pull request #1147 from chalbert/lane/fix-live-review-findings',
      'Merge pull request #1043 from chalbert/lane/memory-land-bar-review-fix']) {
      expect(classifyFollowUp(s), s).toBe('review-followup');
    }
    for (const s of ['fix(board): count declarations', 'Revert "the digest change"']) {
      expect(classifyFollowUp(s), s).toBe('independent-fix');
    }
    expect(classifyFollowUp('feat(judge): the tool-free juror spawn')).toBeNull();
  });

  it('counts only independent fixes as defects', () => {
    const band = { escalated: Array.from({ length: 12 }, (_, i) => pr(100 + i, 1200, true, i < 10 ? 'review-followup' : 'independent-fix')), clean: [] };
    const out = compareGroups(band);
    expect(out.escalated.k).toBe(2);
    expect(out.escalated.reviewDriven).toBe(10);
  });
});

describe('precondition 2 — censoring, the confound that survived the first build', () => {
  it('excludes a PR whose follow-up window has not closed', () => {
    // A PR merged 3 days ago cannot show a 14-day follow-up. Scoring it "no defect" is not an observation.
    const recent = pr(1, 100, true, null, 3);
    const old = pr(2, 100, true, null, 60);
    const out = censor([recent, old], { nowSec: NOW, windowDays: 14 });
    expect(out.observed.map((r) => r.number)).toEqual([2]);
    expect(out.censored).toBe(1);
  });

  it('reports the per-group age gap, which is what makes censoring a BIAS rather than noise', () => {
    const out = censor([pr(1, 10, true, null, 2), pr(2, 10, true, null, 4), pr(3, 10, false, null, 40), pr(4, 10, false, null, 60)], { nowSec: NOW });
    expect(out.medianAgeDaysEscalated).toBeLessThan(out.medianAgeDaysClean);
  });

  it('blocks a verdict when most of the window is unobservable', () => {
    const records = Array.from({ length: 20 }, (_, i) => pr(i, 100, i % 2 === 0, null, 2));
    const out = assessCriteria({ records, nowSec: NOW });
    expect(out.verdict.conclusive).toBe(false);
    expect(out.verdict.blockers.join(' ')).toMatch(/censoring/);
  });
});

describe('precondition 3 — clustered observations', () => {
  it('counts one fix commit touching many PRs as ONE source, not many trials', () => {
    const records = Array.from({ length: 15 }, (_, i) => pr(200 + i, 100, true, 'independent-fix', 60, 'sha-one'));
    const out = clusterEffectiveN(records);
    expect(out.observations).toBe(15);
    expect(out.distinctSources).toBe(1);
    expect(out.largestClusterShare).toBe(1);
    expect(out.clustered).toBe(true);
  });

  it('does not flag genuinely independent observations', () => {
    const records = Array.from({ length: 10 }, (_, i) => pr(300 + i, 100, true, 'independent-fix', 60, `sha-${i}`));
    expect(clusterEffectiveN(records).clustered).toBe(false);
  });

  // MEDIUM clumping used to pass. A 0.5 threshold let 20 observations from 11 commits read as independent
  // while the interval was built on 20 trials that do not exist. The test is "are these independent at all".
  it('flags medium clumping, not only the extreme case', () => {
    const records = [
      ...Array.from({ length: 10 }, (_, i) => pr(400 + i, 100, true, 'independent-fix', 60, 'shared-sha')),
      ...Array.from({ length: 10 }, (_, i) => pr(420 + i, 100, true, 'independent-fix', 60, `own-${i}`)),
    ];
    const out = clusterEffectiveN(records);
    expect(out.observations).toBe(20);
    expect(out.distinctSources).toBe(11);
    expect(out.clustered).toBe(true);
  });
});

describe('the repo input reaches the reader', () => {
  // It was validated against the enum and then never passed, so `--repo=chalbert/frontierui` was accepted and
  // answered with web-everything's history — a wrong answer wearing the right label.
  it('a request for another repo is refused, not silently answered with this one', () => {
    const reader = createHistoryReader({ repo: 'chalbert/web-everything', classify: classifyFollowUp });
    expect(() => reader({ repo: 'chalbert/frontierui' })).toThrow(/bound to chalbert\/web-everything/);
  });

  it('the declaration passes `repo` through', () => {
    let seen = null;
    const declaration = gateHealthOperation({
      loadHistory: (o) => { seen = o.repo; return { repo: o.repo, nowSec: NOW, records: [], unmeasurable: 0, hotFiles: [] }; },
    });
    const registry = createRegistry();
    registry.register(declaration);
    advanceWhileRunning(startRun({ op: GATE_HEALTH_OP, id: 'r-repo', input: { repo: 'chalbert/frontierui' }, registry }), { registry });
    expect(seen).toBe('chalbert/frontierui');
  });
});

describe('precondition 4 — multiplicity, and the interval', () => {
  it('tightens alpha for the number of bands actually tested', () => {
    // Five uncorrected tests at 0.05 is a family-wise error near 25%. An untestable band is not a test, so
    // the correction is over the testable ones only.
    const wide = compareProportions({ n: 60, k: 30 }, { n: 60, k: 20 }, { alpha: 0.05 });
    const tight = compareProportions({ n: 60, k: 30 }, { n: 60, k: 20 }, { alpha: 0.01 });
    expect(tight.ci[1] - tight.ci[0]).toBeGreaterThan(wide.ci[1] - wide.ci[0]);
    expect(zForAlpha(0.05)).toBeCloseTo(1.96, 2);
    expect(zForAlpha(0.01)).toBeCloseTo(2.576, 2);
  });

  it('forces `separated` false when the normal approximation is invalid', () => {
    const tiny = compareProportions({ n: 8, k: 2 }, { n: 200, k: 180 });
    expect(tiny.usable).toBe(false);
    expect(tiny.separated).toBe(false);
  });

  it('reports WHICH group is worse — the headline used to assert one direction regardless', () => {
    // Fed data where CLEAN PRs are worse, the old summary still said escalation correlates with defects.
    const records = [
      ...Array.from({ length: 60 }, (_, i) => pr(400 + i, 200, true, i < 6 ? 'independent-fix' : null, 60, `e${i}`)),
      ...Array.from({ length: 60 }, (_, i) => pr(500 + i, 200, false, i < 30 ? 'independent-fix' : null, 60, `c${i}`)),
    ];
    const out = assessCriteria({ records, nowSec: NOW });
    expect(out.bands.m.comparison.direction).toBe('clean-worse');
    expect(out.verdict.summary).toMatch(/UNESCALATED/);
    expect(out.verdict.summary).not.toMatch(/escalated PRs are followed/);
  });
});

describe('the verdict names blockers rather than producing a number it cannot support', () => {
  it('reports required-n at the observed base rate — the actionable output', () => {
    const out = assessCriteria({ records: Array.from({ length: 40 }, (_, i) => pr(i, 100, i % 2 === 0, i < 2 ? 'independent-fix' : null, 60, `s${i}`)), nowSec: NOW });
    expect(out.power.requiredNPerGroup).toBe(requiredNPerGroup(out.power.baseRate, 0.05));
    expect(out.verdict.blockers.join(' ')).toMatch(/insufficient observations/);
  });

  // PINNED AGAINST A REFERENCE, not against itself. The previous test compared the function to its own output,
  // so dropping the 80%-power term (404 → 232) left it green and the headline "~404" number unpinned.
  // Reference: n = (z_{α/2} + z_β)² · 2p̄(1−p̄) / d² with p̄ = p + d/2, z = 1.96 / 0.84. Computed
  // independently of this module, then rounded up: p=0.044,d=0.05 → 403; p=0.5,d=0.1 → 389.
  // Dropping the 0.84 power term changes both, which is what the previous self-comparison missed.
  it('required-n matches the textbook two-proportion formula, not just itself', () => {
    expect(requiredNPerGroup(0.044, 0.05)).toBe(403);
    expect(requiredNPerGroup(0.5, 0.1)).toBe(389);
    // A RARER event needs more, up to p̄=0.5 — pinned as values, not as an inequality, so a monotonicity bug
    // in either direction is caught.
    expect(requiredNPerGroup(0.02, 0.05)).toBe(270);
    expect(requiredNPerGroup(0.2, 0.05)).toBe(1094);
    // A bigger detectable difference needs far fewer.
    expect(requiredNPerGroup(0.044, 0.2)).toBe(49);
  });

  // The multiplicity correction had no test at all — making it a no-op stayed green.
  it('alpha is divided by the number of TESTABLE bands', () => {
    const twoBands = [
      ...Array.from({ length: 60 }, (_, i) => pr(800 + i, 200, i % 2 === 0, i < 30 ? 'independent-fix' : null, 60, `m${i}`)),
      ...Array.from({ length: 60 }, (_, i) => pr(900 + i, 600, i % 2 === 0, i < 30 ? 'independent-fix' : null, 60, `l${i}`)),
    ];
    const out = assessCriteria({ records: twoBands, nowSec: NOW });
    expect(out.multiplicity.bandsTested).toBe(2);
    expect(out.multiplicity.alphaPerBand).toBeCloseTo(0.025, 10);
    expect(out.bands.m.comparison.alpha).toBeCloseTo(0.025, 10);
  });

  // An off-by-one in the censor cutoff stayed green: nothing pinned the boundary itself.
  it('the censor boundary is exact — a PR at exactly the window edge is observable', () => {
    const atEdge = pr(1, 100, true, null, 14);
    const justInside = pr(2, 100, true, null, 13.9);
    const out = censor([atEdge, justInside], { nowSec: NOW, windowDays: 14 });
    expect(out.observed.map((r) => r.number)).toEqual([1]);
    expect(out.censored).toBe(1);
  });

  it('concludes only when a band separates AND nothing is blocking', () => {
    const records = [
      ...Array.from({ length: 60 }, (_, i) => pr(600 + i, 200, true, i < 30 ? 'independent-fix' : null, 60, `e${i}`)),
      ...Array.from({ length: 60 }, (_, i) => pr(700 + i, 200, false, i < 6 ? 'independent-fix' : null, 60, `c${i}`)),
    ];
    const out = assessCriteria({ records, nowSec: NOW });
    expect(out.verdict.blockers).toEqual([]);
    expect(out.verdict.conclusive).toBe(true);
    expect(out.bands.m.comparison.direction).toBe('escalated-worse');
  });

  it('does not put the whole record set inside the finding', () => {
    // `observability.observed` was the working array — 300 records of payload to say "23% were observable".
    const out = assessCriteria({ records: [pr(1, 10, true, null, 60)], nowSec: NOW });
    expect(typeof out.observability.observed).toBe('number');
  });
});

describe('bandOf / stratifyBySize', () => {
  it('places a line count in the largest band it reaches', () => {
    expect([0, 49, 50, 150, 400, 1000, 99999].map(bandOf)).toEqual(['xs', 'xs', 's', 'm', 'l', 'xl', 'xl']);
  });
  it('always returns every band, so an empty one is visible rather than missing', () => {
    expect(Object.keys(stratifyBySize([pr(1, 10, true)])).sort()).toEqual(SIZE_BANDS.map(([l]) => l).sort());
  });
});

describe('joinHistory', () => {
  const commits = [
    { sha: 'fix1', t: 2000, subject: 'fix the thing', files: ['a.mjs'] },
    { sha: 'rev1', t: 1900, subject: 'Merge pull request #9 from chalbert/lane/x-review-fix', files: ['a.mjs'] },
    { sha: 'm1', t: 1000, subject: 'Merge pull request #1', files: ['a.mjs'] },
    { sha: 'm2', t: 900, subject: 'Merge pull request #2', files: ['hot.mjs'] },
  ];
  const prs = [
    { number: 1, title: 'one', labels: [{ name: 'review:accepted' }], additions: 10, deletions: 0, changedFiles: 1, mergeCommit: { oid: 'm1' } },
    { number: 2, title: 'two', labels: [], additions: 10, deletions: 0, changedFiles: 1, mergeCommit: { oid: 'm2' } },
    { number: 3, title: 'three', labels: [], additions: 10, deletions: 0, changedFiles: 1, mergeCommit: { oid: 'gone' } },
  ];

  it('drops a PR with no attributable surface rather than scoring it clean', () => {
    const { records, unmeasurable } = joinHistory({ prs, commits, classify: classifyFollowUp });
    expect(unmeasurable).toBeGreaterThanOrEqual(1);
    expect(records.map((r) => r.number)).not.toContain(3);
  });

  it('records the merge time and the follow-up SOURCE, which the preconditions need', () => {
    const r = joinHistory({ prs, commits, classify: classifyFollowUp }).records.find((x) => x.number === 1);
    expect(r.mergedAtSec).toBe(1000);
    expect(r.followUp).toBe('independent-fix');
    expect(r.followUpSource).toBe('fix1');
  });

  it('does not call a file hot on a short history', () => {
    expect(hotFileCut(4)).toBe(HOT_FILE_MIN);
    expect(hotFileCut(10_000)).toBe(200);
    expect(joinHistory({ prs, commits, classify: classifyFollowUp }).hotFiles).toEqual([]);
  });
});

describe('the declaration', () => {
  const history = { repo: 'chalbert/web-everything', nowSec: NOW, records: [pr(1, 10, true, null, 60)], unmeasurable: 2, hotFiles: ['x'] };

  it('is read-only and GET-shaped — both steps are `compute`', () => {
    expect(isReadOnlyDeclaration(runGateHealth({}, history).declaration)).toBe(true);
  });

  it('reaches no `node:` specifier and not its own io module', () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const { files, external } = importGraph(resolve(HERE, '..', 'gate-health.mjs'));
    expect(external.filter((s) => s.startsWith('node:'))).toEqual([]);
    expect(files.filter((f) => f.endsWith('gate-health-io.mjs'))).toEqual([]);
  });

  it('refuses a reader with no clock — censoring cannot be assessed without one', () => {
    expect(() => shapeHistoryFinding({ repo: 'x', records: [] })).toThrow(/nowSec/);
    expect(() => shapeHistoryFinding({ repo: 'x' })).toThrow(/must return/);
  });

  it('refuses a repo outside the closed set, before a run record exists', () => {
    const registry = createRegistry();
    registry.register(gateHealthOperation({ loadHistory: () => history }));
    expect(() => startRun({ op: GATE_HEALTH_OP, id: 'r', input: { repo: 'chalbert/nope' }, registry })).toThrow();
  });

  it('reports requested and applied limit, so an underpowered verdict is not read as a real one', () => {
    const { run } = runGateHealth({ limit: 99999 }, history);
    expect(run.findings.assess.requestedLimit).toBe(99999);
    expect(run.findings.assess.limit).toBe(1000);
    expect(clampLimit(1)).toBe(10);
    expect(clampLimit('nonsense')).toBe(300);
  });

  it('carries the unknown-parameter-set caveat beside the numbers', () => {
    const { run } = runGateHealth({}, history);
    expect(run.findings.assess.parameterSet).toBeNull();
    expect(run.findings.assess.parameterSetCaveat).toMatch(/nothing stamps the policy-contract version/);
  });
});
