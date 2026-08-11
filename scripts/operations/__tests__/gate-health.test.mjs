/**
 * @file gate-health.test.mjs — proof of the `gate-health` operation and the pure analysis behind it.
 *
 * The load-bearing tests are not the arithmetic ones. They are the two CORRECTIONS: that a review-driven
 * follow-up is not counted as a defect, and that the comparison is stratified by size. A naive version of this
 * measurement produced a confident 23%-versus-7% that was almost entirely those two artefacts, so each has a
 * test that FAILS if the correction is removed — including one fixture built so the uncorrected reading and
 * the corrected reading disagree in opposite directions.
 */
import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRegistry } from '../registry.mjs';
import { startRun, advanceWhileRunning } from '../engine.mjs';
import { isReadOnlyDeclaration } from '../http-adapter.mjs';
import { importGraph } from './import-graph.mjs';
import {
  bandOf,
  classifyFollowUp,
  stratifyBySize,
  compareProportions,
  compareGroups,
  assessCriteria,
  SIZE_BANDS,
} from '../../lib/gate-health.mjs';
import { joinHistory, hotFileCut, HOT_FILE_MIN } from '../gate-health-io.mjs';
import { gateHealthOperation, GATE_HEALTH_OP, clampLimit, shapeHistoryFinding } from '../gate-health.mjs';

const pr = (n, lines, escalated, followUp = null) => ({ number: n, title: `pr ${n}`, lines, files: 2, escalated, followUp });

function runGateHealth(input = {}, history) {
  const declaration = gateHealthOperation({ loadHistory: () => history });
  const registry = createRegistry();
  registry.register(declaration);
  return {
    declaration,
    run: advanceWhileRunning(startRun({ op: GATE_HEALTH_OP, id: 'run-gate-health-test', input, registry }), { registry }),
  };
}

describe('classifyFollowUp — the correction that stops the gate taking credit for its own work', () => {
  it('reads a review-driven fix as evidence the gate WORKED, not as a defect', () => {
    // Real merge subjects from this repo's history. Counting these as defects is circular: an escalated PR
    // gets reviewed, the review finds things, and the fixes become commits.
    for (const s of [
      'Merge pull request #1147 from chalbert/lane/fix-live-review-findings',
      'Merge pull request #1043 from chalbert/lane/memory-land-bar-review-fix',
      'Merge pull request #1076 from chalbert/lane/xme425q-review-followup-fixes',
    ]) expect(classifyFollowUp(s), s).toBe('review-followup');
  });

  it('reads a fix with no review provenance as the real defect signal', () => {
    for (const s of [
      'fix(board): count the standard\'s own declarations',
      'Revert "the digest change"',
      'repair the truncated stdout drain',
    ]) expect(classifyFollowUp(s), s).toBe('independent-fix');
  });

  it('reads an ordinary commit as neither', () => {
    for (const s of ['feat(judge): the tool-free juror spawn', 'docs: rewrite the header', '']) {
      expect(classifyFollowUp(s), s).toBeNull();
    }
  });
});

describe('the two corrections, proven against a fixture the naive reading gets backwards', () => {
  // Built so the UNCORRECTED reading says "escalated PRs are 3x more defective" and the corrected reading
  // says the opposite — the escalated group's follow-ups are all review-driven, and the two groups are only
  // comparable inside a size band. If either correction is removed, one of these two expectations flips.
  const records = [
    // Escalated, all XL, every follow-up review-driven — the gate working, not the PR failing.
    ...Array.from({ length: 10 }, (_, i) => pr(100 + i, 1200, true, 'review-followup')),
    // …plus a couple of genuine ones.
    pr(120, 1200, true, 'independent-fix'),
    pr(121, 1200, true, null),
    // Clean, all XS, several genuinely defective.
    ...Array.from({ length: 6 }, (_, i) => pr(200 + i, 20, false, 'independent-fix')),
    ...Array.from({ length: 6 }, (_, i) => pr(210 + i, 20, false, null)),
  ];

  it('does not count a review-driven follow-up as a defect', () => {
    const bands = stratifyBySize(records);
    const xl = compareGroups(bands.xl);
    // 12 escalated XL PRs, 10 of them followed by a review-driven fix — exactly ONE counts as a defect.
    expect(xl.escalated.n).toBe(12);
    expect(xl.escalated.k).toBe(1);
    expect(xl.escalated.reviewDriven).toBe(10);
  });

  it('never compares an XL escalated PR against an XS clean one', () => {
    const bands = stratifyBySize(records);
    // The two populations do not share a band here, so every comparison has an empty side and NOTHING is
    // concluded. That is the correct answer for this data, and the naive version's headline number.
    expect(bands.xl.clean).toHaveLength(0);
    expect(bands.xs.escalated).toHaveLength(0);
    expect(compareGroups(bands.xl).comparison.usable).toBe(false);
    expect(compareGroups(bands.xs).comparison.usable).toBe(false);
  });

  it('reports "not enough data" rather than a number, for this fixture', () => {
    const out = assessCriteria({ records });
    expect(out.verdict.conclusive).toBe(false);
    expect(out.verdict.bandsShowingADifference).toEqual([]);
    expect(out.verdict.summary).toMatch(/no size band has enough observations/);
  });
});

describe('compareProportions — it refuses to call a difference real on a point estimate', () => {
  it('reports a difference only when the 95% interval excludes zero', () => {
    const wide = compareProportions({ n: 20, k: 12 }, { n: 20, k: 8 });
    expect(wide.diff).toBeCloseTo(0.2, 10);
    expect(wide.ci95[0]).toBeLessThan(0); // 20 vs 20 cannot resolve 20 points
    expect(wide.separated).toBe(false);
    expect(wide.note).toMatch(/spans zero/);

    const clear = compareProportions({ n: 500, k: 300 }, { n: 500, k: 200 });
    expect(clear.separated).toBe(true);
    expect(clear.note).toMatch(/excludes zero/);
  });

  it('forces `separated` false when the normal approximation does not hold', () => {
    // 2 successes in one group: the interval is meaningless even if it happens to exclude zero. This is the
    // single most dangerous output the module could produce, so it is suppressed at the source.
    const tiny = compareProportions({ n: 8, k: 2 }, { n: 200, k: 180 });
    expect(tiny.usable).toBe(false);
    expect(tiny.separated).toBe(false);
    expect(tiny.note).toMatch(/too few observations/);
  });

  it('says so plainly when a group is empty', () => {
    const empty = compareProportions({ n: 0, k: 0 }, { n: 50, k: 10 });
    expect(empty.diff).toBeNull();
    expect(empty.separated).toBe(false);
    expect(empty.note).toMatch(/empty/);
  });

  it('finds a real difference when the data genuinely supports one', () => {
    // Same band, ample n, a wide gap — the one shape where a conclusion is warranted.
    const records = [
      ...Array.from({ length: 60 }, (_, i) => pr(300 + i, 200, true, i < 30 ? 'independent-fix' : null)),
      ...Array.from({ length: 60 }, (_, i) => pr(400 + i, 200, false, i < 6 ? 'independent-fix' : null)),
    ];
    const out = assessCriteria({ records });
    expect(out.verdict.conclusive).toBe(true);
    expect(out.verdict.bandsShowingADifference).toEqual(['m']);
    expect(out.bands.m.comparison.separated).toBe(true);
  });
});

describe('bandOf / stratifyBySize', () => {
  it('places a line count in the largest band it reaches', () => {
    expect(bandOf(0)).toBe('xs');
    expect(bandOf(49)).toBe('xs');
    expect(bandOf(50)).toBe('s');
    expect(bandOf(150)).toBe('m');
    expect(bandOf(400)).toBe('l');
    expect(bandOf(1000)).toBe('xl');
    expect(bandOf(99999)).toBe('xl');
  });

  it('always returns every band, so an empty one is visible rather than missing', () => {
    const out = stratifyBySize([pr(1, 10, true)]);
    expect(Object.keys(out).sort()).toEqual(SIZE_BANDS.map(([l]) => l).sort());
  });
});

describe('joinHistory — the join that made the first attempt report "0 measurable"', () => {
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

  it('drops a PR whose merge commit is outside the log window rather than scoring it clean', () => {
    // Counting an unmeasurable PR as "no follow-up" would deflate the defect rate of whichever group holds
    // more of them — a silent bias, not a missing row.
    const { records, unmeasurable } = joinHistory({ prs, commits, classify: classifyFollowUp });
    expect(unmeasurable).toBeGreaterThanOrEqual(1);
    expect(records.map((r) => r.number)).not.toContain(3);
  });

  it('prefers an independent fix over a review-driven one when both follow', () => {
    const { records } = joinHistory({ prs, commits, classify: classifyFollowUp });
    expect(records.find((r) => r.number === 1).followUp).toBe('independent-fix');
  });

  it('reads `escalated` off any review:* label, which survives the clear ceremony\'s label swap', () => {
    const { records } = joinHistory({ prs, commits, classify: classifyFollowUp });
    expect(records.find((r) => r.number === 1).escalated).toBe(true);
  });

  it('respects the follow-up window', () => {
    const far = [{ sha: 'late', t: 1000 + 60 * 24 * 3600, subject: 'fix it', files: ['a.mjs'] }, ...commits.slice(2)];
    const { records } = joinHistory({ prs: [prs[0]], commits: far, classify: classifyFollowUp, windowDays: 14 });
    expect(records[0].followUp).toBeNull();
  });

  // The floor exists because a share alone is unsafe on a short window: at 4 commits, 2% rounds to 1, and a
  // file touched twice would be classified as repo-wide churn — discarding nearly every record and reporting
  // an empty comparison as though the history were genuinely thin.
  it('does not call a file "hot" on a short history', () => {
    expect(hotFileCut(4)).toBe(HOT_FILE_MIN);
    expect(hotFileCut(10_000)).toBe(200);
    const { records, hotFiles } = joinHistory({ prs, commits, classify: classifyFollowUp });
    expect(hotFiles).toEqual([]);
    expect(records.map((r) => r.number).sort()).toEqual([1, 2]);
  });

  it('excludes a genuinely churned file, and drops the PRs left with no surface', () => {
    // `everywhere.mjs` in every one of 40 commits: any later fix would "follow" every PR that touched it.
    const churny = Array.from({ length: 40 }, (_, i) => ({
      sha: `c${i}`, t: 1000 + i, subject: i === 39 ? 'fix something' : `work ${i}`, files: ['everywhere.mjs'],
    }));
    const onlyHot = [{ number: 7, title: 'hot only', labels: [], additions: 5, deletions: 0, changedFiles: 1, mergeCommit: { oid: 'c0' } }];
    const { records, hotFiles, unmeasurable } = joinHistory({ prs: onlyHot, commits: churny, classify: classifyFollowUp });
    expect(hotFiles).toEqual(['everywhere.mjs']);
    expect(records).toEqual([]);
    expect(unmeasurable).toBe(1);
  });
});

describe('the declaration', () => {
  const history = { repo: 'chalbert/web-everything', records: [pr(1, 10, true)], unmeasurable: 2, hotFiles: ['x'] };

  it('is read-only and GET-shaped — both steps are `compute`', () => {
    const { declaration } = runGateHealth({}, history);
    expect(isReadOnlyDeclaration(declaration)).toBe(true);
  });

  it('reaches nothing that can act — no `node:` specifier in its own graph', () => {
    // The declaration must not be able to reach the io module either: that is where `gh` and `git` are, and
    // pulling it in would put a child-process spawner in the step functions' lexical scope.
    const HERE = dirname(fileURLToPath(import.meta.url));
    const { files, external } = importGraph(resolve(HERE, '..', 'gate-health.mjs'));
    expect(external.filter((s) => s.startsWith('node:'))).toEqual([]);
    expect(files.filter((f) => f.endsWith('gate-health-io.mjs'))).toEqual([]);
  });

  it('refuses a repo outside the closed set, before a run record exists', () => {
    const declaration = gateHealthOperation({ loadHistory: () => history });
    const registry = createRegistry();
    registry.register(declaration);
    expect(() => startRun({ op: GATE_HEALTH_OP, id: 'r', input: { repo: 'chalbert/nope' }, registry })).toThrow();
  });

  it('refuses a reader that returns the wrong shape rather than assessing an empty history', () => {
    // An empty result and a broken reader produce the same "no signal" verdict otherwise, and the second
    // silently reads as the first.
    expect(() => shapeHistoryFinding({ repo: 'x' })).toThrow(/must return/);
    expect(() => shapeHistoryFinding(null)).toThrow(/must return/);
  });

  it('refuses to be built without a reader', () => {
    expect(() => gateHealthOperation({})).toThrow(/loadHistory/);
  });

  it('reports both the requested and the applied limit, so an underpowered verdict is not read as a real one', () => {
    const { run } = runGateHealth({ limit: 99999 }, history);
    expect(run.findings.assess.requestedLimit).toBe(99999);
    expect(run.findings.assess.limit).toBe(1000);
    expect(clampLimit(1)).toBe(10);
    expect(clampLimit('nonsense')).toBe(300);
  });

  it('carries the unknown-parameter-set caveat WITH the numbers', () => {
    // A web caller renders the findings, not a report. If the caveat lives anywhere else it is not seen.
    const { run } = runGateHealth({}, history);
    expect(run.findings.assess.parameterSet).toBeNull();
    expect(run.findings.assess.parameterSetCaveat).toMatch(/nothing stamps the policy-contract version/);
    expect(run.findings.assess.unmeasurable).toBe(2);
  });
});
