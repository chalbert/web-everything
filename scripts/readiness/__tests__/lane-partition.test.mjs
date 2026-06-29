/**
 * @file scripts/readiness/__tests__/lane-partition.test.mjs
 * @description Unit proof of the optimistic-first partition predicate (#1950, slice A of epic #1949) — the
 *   pure logic the /workflow clone orchestrator inline-mirrors. Pins the model: serial is forced ONLY by a
 *   failed probe, a real blockedBy edge, a shared merge-risk (blacklist) file, or a low-confidence item that
 *   also overlaps another — and confident items whose only overlaps are ordinary (build config, barrels,
 *   their own spill) run CONCURRENT under the optimistic floor. The headline regression: the 4 pairwise-
 *   disjoint items that batch-2026-06-28-1946-1945 ran fully serial must now all partition concurrent.
 */
import { describe, it, expect } from 'vitest';
import {
  RESERVED_MERGE_RISK, isMergeRiskFile, filesOf, mergeRiskFilesOf, disjoint, blockEdge,
  mustSerialize, conflicts, partition, serialReason,
} from '../lane-partition.mjs';

// A probed entry: { num, file, declaredFiles?, blockedBy?, probe: { predictedFiles, extraRepos, touchesMonolith, confident } }
const entry = (num, probe, extra = {}) => ({ num: String(num), file: `${num}-x.md`, ...extra, probe });
const we = (...predictedFiles) => ({ predictedFiles, confident: true });

describe('isMergeRiskFile — only WE-qualified blacklist paths', () => {
  it('matches a reserved single-doc registry', () => {
    expect(isMergeRiskFile('we:src/_data/traits.json')).toBe(true);
    expect(isMergeRiskFile('we:tsconfig.json')).toBe(true);
  });
  it('matches the curated-sweep prefix', () => {
    expect(isMergeRiskFile('we:src/_data/benchmarkFoo.json')).toBe(true);
    expect(isMergeRiskFile('we:src/_data/workbenchBar.json')).toBe(true);
  });
  it('does NOT match per-entry registry files or ordinary source', () => {
    expect(isMergeRiskFile('we:src/_data/adapters/foo.json')).toBe(false);
    expect(isMergeRiskFile('we:src/foo.ts')).toBe(false);
  });
  it('is WE-only — a same-named path in another repo is NOT merge-risk (slice B extends this)', () => {
    expect(isMergeRiskFile('frontierui:tsconfig.json')).toBe(false);
  });
});

describe('filesOf — repo-qualified, backlog file always included', () => {
  it('qualifies WE predicted/declared and cross-repo extraRepos', () => {
    const e = entry(1, { predictedFiles: ['src/a.ts'], extraRepos: [{ repo: 'frontierui', files: ['x.ts'] }] }, { declaredFiles: ['src/b.ts'] });
    const f = filesOf(e);
    expect(f.has('we:backlog/1-x.md')).toBe(true);
    expect(f.has('we:src/a.ts')).toBe(true);
    expect(f.has('we:src/b.ts')).toBe(true);
    expect(f.has('frontierui:x.ts')).toBe(true);
  });
});

describe('mergeRiskFilesOf — touchesMonolith ∪ blacklist members of the touch-set', () => {
  it('folds touchesMonolith (WE-qualified) and a blacklist predicted file', () => {
    const e = entry(1, { predictedFiles: ['tsconfig.json', 'src/own.ts'], touchesMonolith: ['src/_data/traits.json'], confident: true });
    const m = mergeRiskFilesOf(e);
    expect(m.has('we:src/_data/traits.json')).toBe(true); // from touchesMonolith
    expect(m.has('we:tsconfig.json')).toBe(true);          // blacklist member of predictedFiles
    expect(m.has('we:src/own.ts')).toBe(false);            // ordinary file is not merge-risk
  });
});

describe('mustSerialize — only a failed/absent probe is unconditional', () => {
  it('serializes a probe-less entry', () => {
    expect(mustSerialize(entry(1, null))).toBe(true);
  });
  it('does NOT serialize a low-confidence or monolith-touching probe on its own', () => {
    expect(mustSerialize(entry(1, { predictedFiles: ['a'], confident: false }))).toBe(false);
    expect(mustSerialize(entry(1, { predictedFiles: ['a'], touchesMonolith: ['src/_data/traits.json'], confident: true }))).toBe(false);
  });
});

describe('conflicts — the optimistic-first pairwise gate', () => {
  it('(b) a real blockedBy edge forces same-lane', () => {
    const x = entry(2, we('src/a.ts'), { blockedBy: ['1'] });
    const y = entry(1, we('src/b.ts'));
    expect(conflicts(x, y)).toBe(true);
    expect(blockEdge(x, y)).toBe(true);
  });
  it('(c) a shared merge-risk file forces same-lane even when both are confident', () => {
    const x = entry(1, { predictedFiles: ['src/x.ts'], touchesMonolith: ['src/_data/traits.json'], confident: true });
    const y = entry(2, { predictedFiles: ['src/y.ts'], touchesMonolith: ['src/_data/traits.json'], confident: true });
    expect(conflicts(x, y)).toBe(true);
  });
  it('confident items sharing only an ORDINARY file run concurrent (optimistic floor handles it)', () => {
    const x = entry(1, we('src/shared.ts', 'src/x.ts'));
    const y = entry(2, we('src/shared.ts', 'src/y.ts'));
    expect(conflicts(x, y)).toBe(false);
  });
  it('(d) a low-confidence item overlapping another on ANY file stays same-lane', () => {
    const x = entry(1, { predictedFiles: ['src/shared.ts'], confident: false });
    const y = entry(2, we('src/shared.ts'));
    expect(conflicts(x, y)).toBe(true);
  });
  it('a low-confidence item that is file-disjoint still runs concurrent', () => {
    const x = entry(1, { predictedFiles: ['src/x.ts'], confident: false });
    const y = entry(2, we('src/y.ts'));
    expect(conflicts(x, y)).toBe(false);
  });
  it('cross-repo: same path in different repos does NOT collide', () => {
    const x = entry(1, { predictedFiles: [], extraRepos: [{ repo: 'frontierui', files: ['tsconfig.json'] }], confident: true });
    const y = entry(2, { predictedFiles: [], extraRepos: [{ repo: 'plateau-app', files: ['tsconfig.json'] }], confident: true });
    expect(conflicts(x, y)).toBe(false);
  });
});

describe('partition — concurrent set is pairwise-non-conflicting', () => {
  it('HEADLINE regression: 4 pairwise-disjoint items all run concurrent (the #1950 motivation)', () => {
    // Mirrors batch-2026-06-28-1946-1945's real touch-sets: disjoint across WE + frontierui, no shared
    // blacklist file. The old gate forced all 4 serial (confident:false on build-config spill); the new
    // gate runs all 4 concurrent.
    const i1946 = entry(1946, { predictedFiles: ['docs/agent/platform-decisions.md'], extraRepos: [{ repo: 'frontierui', files: ['tsconfig.tools.json', 'scripts/build-tools.mjs', 'package.json'] }], confident: false });
    const i1908 = entry(1908, { predictedFiles: ['conformance-vectors/webtheme.vectors.ts'], extraRepos: [{ repo: 'frontierui', files: ['webtheme/webthemeConformance.ts', 'tsconfig.json', 'vitest.config.ts'] }], confident: false });
    const i1941 = entry(1941, { extraRepos: [{ repo: 'frontierui', files: ['plugs/webcomponents/declareStates.ts', 'plugs/webcomponents/index.ts'] }], confident: false });
    const i1945 = entry(1945, { predictedFiles: ['scripts/readiness/file-locks.mjs', '.claude/skills/batch-backlog-items/parallel-execute.workflow.js'], confident: true });
    const { concurrent, serial } = partition([i1946, i1908, i1941, i1945]);
    expect(concurrent.map((e) => e.num).sort()).toEqual(['1908', '1941', '1945', '1946']);
    expect(serial).toHaveLength(0);
  });

  it('entangles only the contending pair, leaving the rest concurrent', () => {
    const a = entry(1, { predictedFiles: ['src/a.ts'], touchesMonolith: ['src/_data/docs.json'], confident: true });
    const b = entry(2, { predictedFiles: ['src/b.ts'], touchesMonolith: ['src/_data/docs.json'], confident: true });
    const c = entry(3, we('src/c.ts'));
    const { concurrent, serial } = partition([a, b, c]);
    expect(concurrent.map((e) => e.num)).toEqual(['3']);
    expect(serial.map((e) => e.num).sort()).toEqual(['1', '2']);
  });

  it('a probe-less item goes serial; independent peers stay concurrent', () => {
    const ok = entry(1, we('src/a.ts'));
    const broken = entry(2, null);
    const { concurrent, serial } = partition([ok, broken]);
    expect(concurrent.map((e) => e.num)).toEqual(['1']);
    expect(serial.map((e) => e.num)).toEqual(['2']);
  });

  it('degenerates to all-serial when every pair shares a blacklist file (correct, not a failure)', () => {
    const mk = (n) => entry(n, { predictedFiles: [`src/${n}.ts`], touchesMonolith: ['src/_data/traits.json'], confident: true });
    const { concurrent, serial } = partition([mk(1), mk(2), mk(3)]);
    expect(concurrent).toHaveLength(0);
    expect(serial).toHaveLength(3);
  });
});

describe('serialReason — the human-readable reason matches the predicate that fired', () => {
  it('names a failed probe, a blockedBy edge, a merge-risk file, and a low-conf overlap', () => {
    const dep = entry(2, we('src/a.ts'), { blockedBy: ['1'] });
    const dep0 = entry(1, we('src/b.ts'));
    expect(serialReason(dep, [dep, dep0])).toMatch(/blockedBy edge with #1/);

    const r1 = entry(1, { predictedFiles: [], touchesMonolith: ['src/_data/traits.json'], confident: true });
    const r2 = entry(2, { predictedFiles: [], touchesMonolith: ['src/_data/traits.json'], confident: true });
    expect(serialReason(r1, [r1, r2])).toMatch(/merge-risk file with #2/);

    expect(serialReason(entry(9, null), [])).toMatch(/probe failed/);

    const lc = entry(1, { predictedFiles: ['src/s.ts'], confident: false });
    const lc2 = entry(2, we('src/s.ts'));
    expect(serialReason(lc, [lc, lc2])).toMatch(/low-confidence touch-set overlapping #2/);
  });
});
